import fs from 'node:fs/promises';
import os from 'node:os';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const INTERVAL_MS = 3000;
const LEASE_MS = 15000;
const VERIFY_MS = 20000;
const MAX_WINDOWS = 8;
const MESSAGES = Object.freeze({
  disabled: '已停用',
  waiting: '等待本机窗口',
  connected: '本机窗口已连接',
  unsupported: '本机接口不受支持',
  error: '本机连接不可用',
});
const unavailable = () => new Error(MESSAGES.error);
class Unsupported extends Error {}

export function parsePort(value) {
  if (typeof value === 'string' && !/^[1-9]\d{0,4}$/.test(value)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

export function parseLsAddress(value) {
  if (typeof value !== 'string') return null;
  const match = /^(127\.0\.0\.1|localhost|\[::1\]):([1-9]\d{0,4})$/.exec(value);
  const port = match && parsePort(match[2]);
  if (!port) return null;
  // Resolve localhost ourselves so a DNS/hosts override cannot receive the token.
  return { host: match[1] === 'localhost' ? '127.0.0.1' : match[1], port };
}

function sameOrigin(url, origin) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.origin === origin &&
      !parsed.username && !parsed.password;
  } catch { return false; }
}

export function validateTarget(target, verifiedOrigin, devtoolsPort) {
  try {
    const origin = new URL(verifiedOrigin);
    if (origin.protocol !== 'https:' || origin.hostname !== '127.0.0.1' ||
        origin.origin !== verifiedOrigin || !parsePort(origin.port || 443)) return false;
    if (!target || target.type !== 'page' || typeof target.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(target.id) || typeof target.url !== 'string' ||
        !sameOrigin(target.url, verifiedOrigin) || typeof target.webSocketDebuggerUrl !== 'string') return false;
    // Check the literal authority too: URL normalization accepts surprising IPv4 aliases.
    const ws = /^ws:\/\/127\.0\.0\.1(?::([1-9]\d{0,4}))?\/devtools\/page\/([A-Za-z0-9_-]{1,128})$/.exec(target.webSocketDebuggerUrl);
    return !!ws && parsePort(devtoolsPort) !== null &&
      parsePort(ws[1] || 80) === parsePort(devtoolsPort) && ws[2] === target.id;
  } catch { return false; }
}

export function isEligibleContext(context, frameId, origin) {
  return typeof frameId === 'string' && !!frameId && typeof origin === 'string' && !!origin &&
    context?.auxData?.isDefault === true && context.auxData.frameId === frameId &&
    context.origin === origin && typeof context.uniqueId === 'string' &&
    context.uniqueId.length > 0 && context.uniqueId.length <= 256;
}

function portFile(env) {
  let root;
  if (process.platform === 'win32') root = env.APPDATA;
  else if (process.platform === 'darwin') root = join(os.homedir(), 'Library', 'Application Support');
  else if (process.platform === 'linux') root = env.XDG_CONFIG_HOME || join(os.homedir(), '.config');
  if (typeof root !== 'string' || !isAbsolute(root)) return null;
  return join(root, 'Antigravity', 'DevToolsActivePort');
}

// runtimeSource is trusted main-thread code, never a string obtained from CDP.
function expression(action, owner, origin, payload, runtimeSource) {
  const guard = `if(globalThis.location?.origin!==${JSON.stringify(origin)})return 'boundary';
    const api=globalThis.__agyGlass, owner=${JSON.stringify(owner)};
    if(api && api.owner!==owner)return 'foreign';`;
  const check = `if(!globalThis.__agyGlass)return 'missing';
    if(globalThis.__agyGlass.owner!==owner)return 'foreign';`;
  let body;
  if (action === 'dispose') {
    body = `if(!api)return 'missing';
      if(typeof api.dispose!=='function')return 'unsupported';
      api.dispose();return 'disposed';`;
  } else if (action === 'heartbeat') {
    body = `if(!api)return 'missing';
      if(typeof api.heartbeat!=='function')return 'unsupported';
      const result=api.heartbeat();${check}
      if(result?.mounted===false || api.mounted===false)return 'unsupported';
      return result?.mounted===true || api.mounted===true ? 'mounted' : 'alive';`;
  } else {
    body = `const payload=${JSON.stringify({ ...payload, owner, leaseMs: LEASE_MS })};
      if(api){
        if(typeof api.update!=='function')return 'unsupported';
        const result=api.update(payload);${check}
        return result?.mounted===false || api.mounted===false ? 'unsupported' : 'mounted';
      }
      const result=(${runtimeSource})(payload);${check}
      return result?.mounted===true ? 'mounted' : 'unsupported';`;
  }
  return `(()=>{${guard}${body}})()`;
}

export function startInjector({ getPayload, runtimeSource, env = process.env, onStatus } = {}) {
  const owner = randomUUID();
  const lifetime = new AbortController();
  const sockets = new Map();
  // Remember a document across a socket reconnect, without retaining its media.
  const revisions = new Map();
  let verification = null;
  let snapshot = Object.freeze({ code: 'waiting', windows: 0, message: MESSAGES.waiting });
  let stopped = false, rerun = false, running = null, timer = null, stopping = null;

  function publish(code, windows = 0) {
    if (snapshot.code === code && snapshot.windows === windows) return;
    snapshot = Object.freeze({ code, windows, message: MESSAGES[code] });
    try { onStatus?.(snapshot); } catch { /* Observers cannot stop lease maintenance. */ }
  }

  function clearContext(entry) {
    entry.context = null;
    entry.contextId = null;
    entry.mounted = false;
    entry.unsupportedContext = false;
  }

  function retire(entry) {
    if (entry.closed) return;
    entry.closed = true;
    clearContext(entry);
    clearTimeout(entry.openTimer);
    entry.rejectOpen?.(unavailable());
    entry.rejectOpen = null;
    for (const pending of entry.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(unavailable());
    }
    entry.pending.clear();
    entry.ws.onopen = entry.ws.onmessage = entry.ws.onerror = entry.ws.onclose = null;
    try { entry.ws.close(); } catch { /* An already closed socket needs no action. */ }
    if (sockets.get(entry.id) === entry) sockets.delete(entry.id);
  }

  function receive(entry, event) {
    if (entry.closed || typeof event.data !== 'string') return;
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (!message || typeof message !== 'object') return;
    const params = message.params;
    if (message.method === 'Page.frameNavigated' && params?.frame && !params.frame.parentId) {
      entry.navigation++;
      clearContext(entry);
      entry.frameId = params.frame.id;
      entry.frameAllowed = sameOrigin(params.frame.url, entry.origin);
    } else if (message.method === 'Page.frameStartedLoading' && params?.frameId === entry.frameId) {
      entry.navigation++;
      clearContext(entry);
    } else if (message.method === 'Page.frameDetached' && params?.frameId === entry.frameId) {
      entry.navigation++;
      clearContext(entry);
      entry.frameId = null;
      entry.frameAllowed = false;
    } else if (message.method === 'Runtime.executionContextsCleared') {
      clearContext(entry);
    } else if (message.method === 'Runtime.executionContextDestroyed' &&
        ((entry.context && params?.executionContextUniqueId === entry.context) ||
         (Number.isInteger(entry.contextId) && params?.executionContextId === entry.contextId))) {
      revisions.delete(entry.context);
      clearContext(entry);
    } else if (message.method === 'Runtime.executionContextCreated') {
      const context = params?.context;
      if (context?.auxData?.isDefault === true && context.auxData.frameId === entry.frameId) {
        clearContext(entry);
        if (entry.frameAllowed && isEligibleContext(context, entry.frameId, entry.origin)) {
          entry.context = context.uniqueId;
          entry.contextId = context.id;
        } else if (entry.frameAllowed && context.origin === entry.origin) {
          entry.unsupportedContext = true;
        }
      }
    } else if (message.method === 'Inspector.detached') {
      retire(entry);
      return;
    }
    const pending = entry.pending.get(message.id);
    if (!pending) return;
    entry.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) {
      pending.reject([-32601, -32602].includes(message.error.code) ? new Unsupported() : unavailable());
    } else pending.resolve(message.result);
  }

  function command(entry, method, params = {}) {
    if (entry.closed || entry.ws.readyState !== 1) return Promise.reject(unavailable());
    return new Promise((resolve, reject) => {
      const id = entry.nextId++;
      const timeout = setTimeout(() => retire(entry), INTERVAL_MS);
      entry.pending.set(id, { resolve, reject, timer: timeout });
      try { entry.ws.send(JSON.stringify({ id, method, params })); }
      catch { retire(entry); }
    });
  }

  async function connect(target, origin) {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const entry = {
      id: target.id, url: target.webSocketDebuggerUrl, origin, ws,
      pending: new Map(), nextId: 1, closed: false, frameId: null,
      frameAllowed: false, navigation: 0, context: null, mounted: false,
    };
    sockets.set(entry.id, entry);
    ws.onmessage = event => receive(entry, event);
    ws.onerror = ws.onclose = () => retire(entry);
    const abortOpening = () => retire(entry);
    try {
      await new Promise((resolve, reject) => {
        entry.rejectOpen = reject;
        entry.openTimer = setTimeout(() => retire(entry), INTERVAL_MS);
        ws.onopen = () => {
          clearTimeout(entry.openTimer);
          entry.rejectOpen = null;
          ws.onopen = null;
          resolve();
        };
        lifetime.signal.addEventListener('abort', abortOpening, { once: true });
        if (stopped) retire(entry);
      });
      lifetime.signal.removeEventListener('abort', abortOpening);
      if (stopped) return entry;
      await command(entry, 'Page.enable');
      if (stopped) return entry;
      const navigation = entry.navigation;
      const tree = await command(entry, 'Page.getFrameTree');
      if (stopped) return entry;
      if (entry.navigation === navigation) {
        const frame = tree?.frameTree?.frame;
        if (!frame || frame.parentId || typeof frame.id !== 'string' || !frame.id) throw new Unsupported();
        entry.frameId = frame.id;
        entry.frameAllowed = sameOrigin(frame.url, origin);
      }
      await command(entry, 'Runtime.enable');
      return entry;
    } catch (error) {
      retire(entry);
      throw error;
    } finally {
      lifetime.signal.removeEventListener('abort', abortOpening);
    }
  }

  async function evaluate(entry, context, source) {
    if (!context || context !== entry.context || entry.closed || !entry.frameAllowed) return null;
    try {
      const result = await command(entry, 'Runtime.evaluate', {
        uniqueContextId: context, expression: source, returnByValue: true, timeout: 2000,
      });
      if (entry.context !== context || entry.closed) return null;
      if (result?.exceptionDetails) throw unavailable();
      const state = result?.result?.value;
      if (!['mounted', 'alive', 'missing', 'foreign', 'unsupported', 'boundary', 'disposed'].includes(state)) {
        throw new Unsupported();
      }
      return state;
    } catch (error) {
      if (entry.context !== context && !entry.closed) return null;
      throw error;
    }
  }

  async function cleanup(dispose) {
    await Promise.all([...sockets.values()].map(async entry => {
      try {
        if (dispose && entry.context) {
          await evaluate(entry, entry.context, expression('dispose', owner, entry.origin));
        }
      } catch { /* Lease expiry is the fallback when a document is unavailable. */ }
      finally { retire(entry); }
    }));
  }

  async function readText(file) {
    try { return await fs.readFile(file, { encoding: 'utf8', signal: lifetime.signal }); }
    catch (error) { if (error?.code === 'ENOENT') return null; throw unavailable(); }
  }

  function request(url, options = {}) {
    return fetch(url, {
      ...options, redirect: 'error',
      signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(INTERVAL_MS)]),
    });
  }

  async function verifiedOrigin() {
    const address = parseLsAddress(env.ANTIGRAVITY_LS_ADDRESS);
    const token = env.ANTIGRAVITY_CSRF_TOKEN;
    if (!address || typeof token !== 'string' || !token) { verification = null; return null; }
    const text = await readText(join(os.homedir(), '.gemini', 'antigravity', 'daemon', `hub_${address.port}.json`));
    let hub;
    try { hub = JSON.parse(text); } catch { verification = null; return null; }
    if (hub?.httpPort !== address.port || typeof hub.httpsPort !== 'number' || !parsePort(hub.httpsPort)) {
      verification = null;
      return null;
    }
    const origin = new URL(`https://127.0.0.1:${hub.httpsPort}`).origin;
    if (verification?.host === address.host && verification.port === address.port &&
        verification.token === token && verification.origin === origin &&
        Date.now() - verification.at >= 0 && Date.now() - verification.at < VERIFY_MS) return origin;
    verification = null;
    const response = await request(`http://${address.host}:${address.port}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-codeium-csrf-token': token }, body: '{}',
    });
    // Deliberately do not deserialize, log or retain quota/account information.
    await response.body?.cancel();
    if (!response.ok || response.redirected) throw unavailable();
    if (stopped) return null;
    verification = { host: address.host, port: address.port, token, origin, at: Date.now() };
    return origin;
  }

  async function targets(origin) {
    const file = portFile(env);
    if (!file) throw new Unsupported();
    const text = await readText(file);
    if (text === null) return [];
    const port = parsePort(text.split(/\r?\n/, 1)[0].trim());
    if (!port) throw unavailable();
    const response = await request(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok || response.redirected) {
      await response.body?.cancel();
      throw unavailable();
    }
    const list = await response.json();
    if (!Array.isArray(list) || list.length > 256) throw unavailable();
    const ids = new Set();
    return list.filter(target => {
      if (ids.size >= MAX_WINDOWS || !validateTarget(target, origin, port) || ids.has(target.id)) return false;
      ids.add(target.id);
      return true;
    });
  }

  async function service(target, origin, payload) {
    let entry = sockets.get(target.id);
    try {
      if (!entry) entry = await connect(target, origin);
      if (stopped) return null;
      const context = entry.context;
      if (!context) {
        if (entry.unsupportedContext) return 'unsupported';
        // Same-document loading can keep the old context without emitting a new one.
        retire(entry);
        return 'waiting';
      }
      let state = await evaluate(entry, context, expression('heartbeat', owner, origin));
      if (stopped) return null;
      if (state && !['foreign', 'boundary'].includes(state) &&
          (state === 'missing' || revisions.get(context)?.revision !== payload.revision)) {
        state = await evaluate(entry, context, expression('update', owner, origin, payload, runtimeSource));
        if (state === 'mounted' || state === 'unsupported') {
          revisions.delete(context);
          revisions.set(context, { revision: payload.revision, mounted: state === 'mounted' });
          if (revisions.size > 64) revisions.delete(revisions.keys().next().value);
        }
      }
      const remembered = revisions.get(context);
      if (remembered && (state === 'mounted' || state === 'unsupported')) remembered.mounted = state === 'mounted';
      if (state === 'alive') state = remembered?.mounted ? 'mounted' : 'unsupported';
      entry.mounted = state === 'mounted';
      if (state === 'boundary') clearContext(entry);
      return state;
    } catch (error) {
      if (entry && !stopped) retire(entry);
      return error instanceof Unsupported ? 'unsupported' : 'error';
    }
  }

  async function tick() {
    if (stopped) return;
    try {
      if (typeof getPayload !== 'function') throw unavailable();
      const payload = getPayload();
      if (!payload || typeof payload.revision !== 'string' || typeof payload.settings?.enabled !== 'boolean') throw unavailable();
      if (!payload.settings.enabled) {
        await cleanup(true);
        verification = null;
        revisions.clear();
        if (!stopped) publish('disabled');
        return;
      }
      if (typeof runtimeSource !== 'string' || !runtimeSource.trim()) throw unavailable();
      if (typeof globalThis.fetch !== 'function' || typeof globalThis.WebSocket !== 'function') throw new Unsupported();
      if (payload.media !== null) {
        const media = payload.media;
        const stream = typeof media?.url === 'string' && /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/(wallpaper|player)\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.exec(media.url);
        const portMatch = stream && parsePort(stream[1]) && parsePort(stream[1]) === parsePort(env.ANTIGRAVITY_SIDECAR_WEB_PORT) && media.dataUrl == null;
        const isSceneOrWeb = media?.kind === 'scene' || media?.kind === 'web';
        const isImageOrVideo = media?.kind === 'image' || media?.kind === 'video';
        const localStream = portMatch && ((isImageOrVideo && stream[2] === 'wallpaper') || (isSceneOrWeb && stream[2] === 'player'));
        const embedded = isImageOrVideo && media?.url == null && typeof media?.dataUrl === 'string' && media.dataUrl.startsWith('data:');
        if ((!isImageOrVideo && !isSceneOrWeb) || (!localStream && !embedded)) throw unavailable();
      }
      const origin = await verifiedOrigin();
      if (stopped) return;
      if (!origin) {
        await cleanup(false);
        publish('waiting');
        return;
      }
      const pages = await targets(origin);
      if (stopped) return;
      for (const entry of sockets.values()) {
        if (entry.origin !== origin || !pages.some(target => target.id === entry.id && target.webSocketDebuggerUrl === entry.url)) retire(entry);
      }
      const results = await Promise.all(pages.map(target => service(target, origin, payload)));
      if (stopped) return;
      const windows = results.filter(state => state === 'mounted').length;
      const code = results.includes('error') ? 'error' : results.includes('unsupported') ? 'unsupported' : windows ? 'connected' : 'waiting';
      publish(code, windows);
    } catch (error) {
      if (stopped) return;
      verification = null;
      await cleanup(false);
      publish(error instanceof Unsupported ? 'unsupported' : 'error');
    }
  }

  function refresh() {
    if (stopped) return Promise.resolve(snapshot);
    clearTimeout(timer);
    rerun = true;
    if (!running) {
      running = Promise.resolve().then(async () => {
        do { rerun = false; await tick(); } while (rerun && !stopped);
      }).finally(() => {
        running = null;
        if (!stopped) {
          timer = setTimeout(refresh, INTERVAL_MS);
          timer.unref?.();
        }
      });
    }
    return running.then(() => snapshot);
  }

  function stop() {
    if (stopping) return stopping;
    stopped = true;
    rerun = false;
    clearTimeout(timer);
    lifetime.abort();
    stopping = (async () => {
      await running;
      await cleanup(true);
      revisions.clear();
      verification = null;
      publish('disabled');
      return snapshot;
    })();
    return stopping;
  }

  void refresh();
  return { refresh, stop, status: () => snapshot };
}
