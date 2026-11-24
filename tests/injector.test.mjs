import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import { startInjector, parsePort, parseLsAddress, validateTarget, isEligibleContext } from '../sidecars/glass/injector.mjs';

const ORIGIN = 'https://127.0.0.1:41001';
const CDP_PORT = 41002;
const LS_URL = 'http://127.0.0.1:41000/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary';
const LIST_URL = `http://127.0.0.1:${CDP_PORT}/json/list`;
const RUNTIME = `(function(payload){
  received.push(payload);
  const api = {
    owner: payload.owner, mounted: true,
    update(next){ received.push(next); return {mounted:true}; },
    heartbeat(){ beats++; },
    dispose(){ disposals++; delete globalThis.__agyGlass; }
  };
  globalThis.__agyGlass = api;
  return {mounted:true};
})`;
const page = (id = 'page-1', origin = ORIGIN) => ({
  id, type: 'page', url: `${origin}/workbench?chat=private#fragment`,
  webSocketDebuggerUrl: `ws://127.0.0.1:${CDP_PORT}/devtools/page/${id}`,
});
const context = (overrides = {}) => ({
  id: 7, uniqueId: 'document-1', origin: ORIGIN,
  auxData: { isDefault: true, frameId: 'top-frame' }, ...overrides,
});
const settle = () => new Promise(resolve => setImmediate(resolve));

// All host I/O is replaced in memory; no fixture files, listening ports or real tabs.
function harness(t, options = {}) {
  const home = resolve('never-created-home');
  const config = resolve('never-created-config');
  const env = {
    ANTIGRAVITY_LS_ADDRESS: '127.0.0.1:41000', ANTIGRAVITY_CSRF_TOKEN: 'private-token',
    APPDATA: config, XDG_CONFIG_HOME: config,
  };
  const root = process.platform === 'darwin' ? join(home, 'Library', 'Application Support') : config;
  const hubFile = join(home, '.gemini', 'antigravity', 'daemon', 'hub_41000.json');
  const portFile = join(root, 'Antigravity', 'DevToolsActivePort');
  const h = {
    env, hubFile, portFile, now: 100000,
    hub: { httpPort: 41000, httpsPort: 41001 }, portText: `${CDP_PORT}\r\n/devtools/browser/ignored\n`,
    targets: [page()], requests: [], reads: [], commands: [], sockets: [], statuses: [],
    fixtures: new Map(), cancellations: 0, accountReads: 0, getCalls: 0,
    payload: { revision: 'r1', settings: { enabled: true, opacity: 0.7 }, media: { kind: 'image', dataUrl: 'data:image/png;base64,AAAA' } },
    lsOK: true, listOK: true, autoOpen: true, ...options,
  };
  h.fixture = id => {
    if (!h.fixtures.has(id)) {
      h.fixtures.set(id, {
        frameId: 'top-frame', frameUrl: ORIGIN,
        contexts: [context({ uniqueId: `document-${id}` })],
        sandbox: vm.createContext({ location: { origin: ORIGIN }, received: [], beats: 0, disposals: 0 }),
      });
    }
    return h.fixtures.get(id);
  };
  t.mock.method(os, 'homedir', () => home);
  t.mock.method(Date, 'now', () => h.now);
  t.mock.method(fs, 'readFile', async (file, readOptions) => {
    h.reads.push(file);
    assert.equal(readOptions.encoding, 'utf8');
    assert.ok(readOptions.signal instanceof AbortSignal);
    if (file === hubFile) {
      if (h.missingHub) throw Object.assign(new Error('private-path'), { code: 'ENOENT' });
      return h.hubText ?? JSON.stringify(h.hub);
    }
    if (file === portFile) {
      if (h.missingPort) throw Object.assign(new Error('private-path'), { code: 'ENOENT' });
      return h.portText;
    }
    assert.fail(`Unexpected file access: ${file}`);
  });
  t.mock.method(globalThis, 'fetch', async (url, fetchOptions) => {
    h.requests.push({ url, options: fetchOptions });
    assert.equal(fetchOptions.redirect, 'error');
    assert.ok(fetchOptions.signal instanceof AbortSignal);
    if (h.fetchHook) {
      const response = await h.fetchHook(url, fetchOptions);
      if (response) return response;
    }
    if (url === LS_URL) return {
      ok: h.lsOK, redirected: false,
      body: { cancel: async () => { h.cancellations++; } },
      json() { h.accountReads++; throw new Error('Account body must not be read'); },
      text() { h.accountReads++; throw new Error('Account body must not be read'); },
    };
    assert.equal(url, LIST_URL, 'Only the published loopback /json/list may be fetched');
    return {
      ok: h.listOK, redirected: false,
      body: { cancel: async () => { h.cancellations++; } },
      json: async () => h.targets,
    };
  });

  class FakeWebSocket {
    constructor(url) {
      assert.match(url, /^ws:\/\/127\.0\.0\.1:41002\/devtools\/page\/[A-Za-z0-9_-]+$/);
      this.url = url;
      this.id = url.split('/').at(-1);
      this.fixture = h.fixture(this.id);
      this.readyState = 0;
      this.closeCalls = 0;
      h.sockets.push(this);
      if (h.autoOpen) queueMicrotask(() => this.open());
    }
    open() {
      if (this.readyState !== 0) return;
      this.readyState = 1;
      this.onopen?.({});
    }
    emit(method, params = {}) { this.onmessage?.({ data: JSON.stringify({ method, params }) }); }
    reply(command, result) { this.onmessage?.({ data: JSON.stringify({ id: command.id, result }) }); }
    fail(command, code = -32000) {
      this.onmessage?.({ data: JSON.stringify({ id: command.id, error: { code, message: 'private-token https://evil.invalid/chat' } }) });
    }
    send(text) {
      assert.equal(this.readyState, 1);
      const command = JSON.parse(text);
      h.commands.push({ ...command, socket: this });
      queueMicrotask(() => {
        if (this.readyState !== 1) return;
        if (h.onCommand?.(command, this)) return;
        if (command.method === 'Page.enable') this.reply(command, {});
        else if (command.method === 'Page.getFrameTree') {
          this.reply(command, { frameTree: { frame: { id: this.fixture.frameId, url: this.fixture.frameUrl } } });
        } else if (command.method === 'Runtime.enable') {
          for (const ctx of this.fixture.contexts) this.emit('Runtime.executionContextCreated', { context: ctx });
          this.reply(command, {});
        } else if (command.method === 'Runtime.evaluate') {
          assert.equal('contextId' in command.params, false);
          assert.equal(typeof command.params.uniqueContextId, 'string');
          assert.ok(this.fixture.contexts.some(ctx => ctx.uniqueId === command.params.uniqueContextId));
          assert.equal(command.params.returnByValue, true);
          assert.equal(command.params.timeout, 2000);
          try {
            const value = vm.runInContext(command.params.expression, this.fixture.sandbox, { timeout: 1000 });
            this.reply(command, { result: { type: 'string', value } });
          } catch {
            this.reply(command, { exceptionDetails: { text: 'private-token https://evil.invalid/chat' } });
          }
        } else assert.fail(`Unexpected CDP method ${command.method}`);
      });
    }
    close() {
      this.closeCalls++;
      this.readyState = 3;
      this.onclose?.({});
    }
  }
  t.mock.method(globalThis, 'WebSocket', function (url) { return new FakeWebSocket(url); });
  h.start = (extra = {}) => {
    const injector = startInjector({
      getPayload: () => { h.getCalls++; return h.payload; },
      runtimeSource: RUNTIME, env,
      onStatus: state => { h.statuses.push(state); }, ...extra,
    });
    h.injector = injector;
    t.after(() => injector.stop());
    return injector;
  };
  h.evaluations = () => h.commands.filter(command => command.method === 'Runtime.evaluate');
  h.fullPayloads = () => h.evaluations().filter(command => command.params.expression.includes('const payload='));
  h.assertClosed = () => {
    for (const socket of h.sockets) {
      assert.equal(socket.readyState, 3);
      for (const event of ['onopen', 'onmessage', 'onerror', 'onclose']) assert.equal(socket[event], null);
    }
  };
  return h;
}

test('streamed media is accepted only on this sidecar port with a scoped capability', async t => {
  const h = harness(t);
  h.env.ANTIGRAVITY_SIDECAR_WEB_PORT = '41003';
  const url = 'http://127.0.0.1:41003/wallpaper/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  h.payload.media = { kind: 'video', url };
  const injector = h.start();
  await injector.refresh();
  assert.equal(injector.status().code, 'connected');
  assert.equal(h.fixture('page-1').sandbox.received.at(-1).media.url, url);
  const count = h.fullPayloads().length;
  for (const bad of [url.replace('127.0.0.1', '127.1'), url.replace('41003', '41004'), url.replace('41003', '65536'), url.replace('http:', 'https:'), url + '?x=1', url.replace('/wallpaper/', '/api/'), 'https://evil.invalid/video.mp4']) {
    h.payload = { ...h.payload, revision: bad, media: { kind: 'video', url: bad } };
    await injector.refresh();
    assert.equal(injector.status().code, 'error');
    assert.equal(h.fullPayloads().length, count);
  }
  h.payload.media = { kind: 'image', url: 'https://evil.invalid/image.png', dataUrl: 'data:image/png;base64,AAAA' };
  await injector.refresh();
  assert.equal(injector.status().code, 'error');
  assert.equal(h.fullPayloads().length, count);
});

test('ports and LS addresses reject ambiguous, remote and out-of-range input', () => {
  for (const value of [1, 65535, '1', '65535', '41000']) assert.equal(parsePort(value), Number(value));
  for (const value of [0, -1, 65536, 1.2, NaN, Infinity, '', '0', '01', ' 12', '12 ', '+12', '1e3', '0x50', '12\n', null, true, {}, '65536']) {
    assert.equal(parsePort(value), null, String(value));
  }
  assert.deepEqual(parseLsAddress('127.0.0.1:1'), { host: '127.0.0.1', port: 1 });
  assert.deepEqual(parseLsAddress('localhost:65535'), { host: '127.0.0.1', port: 65535 });
  assert.deepEqual(parseLsAddress('[::1]:8080'), { host: '[::1]', port: 8080 });
  for (const address of ['evil.invalid:80', '127.0.0.1.evil:80', '127.1:80', '2130706433:80', '0.0.0.0:80', '192.168.1.1:80',
    'http://127.0.0.1:80', '127.0.0.1:0', 'localhost:65536', 'localhost:080', 'user@localhost:80', 'localhost:80/path', '[::]:80', null]) {
    assert.equal(parseLsAddress(address), null, String(address));
  }
});

test('target validation pins page origin, literal WS authority, port and exact page path', () => {
  assert.equal(validateTarget(page(), ORIGIN, CDP_PORT), true);
  const invalidWS = [
    'ws://evil.invalid:41002/devtools/page/page-1', 'wss://127.0.0.1:41002/devtools/page/page-1',
    'ws://localhost:41002/devtools/page/page-1', 'ws://127.1:41002/devtools/page/page-1',
    'ws://2130706433:41002/devtools/page/page-1', 'ws://127.0.0.1.evil:41002/devtools/page/page-1',
    'ws://127.0.0.1:41003/devtools/page/page-1', 'ws://127.0.0.1:41002/devtools/browser/page-1',
    'ws://127.0.0.1:41002/devtools/page/other', 'ws://user:pass@127.0.0.1:41002/devtools/page/page-1',
    'ws://127.0.0.1:41002/devtools/page/page-1?token=private', 'ws://127.0.0.1:41002/devtools/page/page-1#x',
    'ws://127.0.0.1:41002/devtools/page/page-1?', 'ws://127.0.0.1:41002/devtools/page/page-1#',
    'ws://127.0.0.1:41002/devtools/page/%70age-1', 'ws://127.0.0.1:41002/devtools/page/../page-1',
    'ws://127.0.0.1:041002/devtools/page/page-1', ' ws://127.0.0.1:41002/devtools/page/page-1',
    'ws://127.0.0.1:41002/devtools/page/page-1\n',
  ];
  for (const webSocketDebuggerUrl of invalidWS) assert.equal(validateTarget({ ...page(), webSocketDebuggerUrl }, ORIGIN, CDP_PORT), false, webSocketDebuggerUrl);
  for (const url of ['https://evil.invalid/', 'http://127.0.0.1:41001/', 'https://localhost:41001/',
    'https://127.0.0.1:41003/', 'blob:https://127.0.0.1:41001/id', 'about:blank', 'https://user:pass@127.0.0.1:41001/']) {
    assert.equal(validateTarget({ ...page(), url }, ORIGIN, CDP_PORT), false, url);
  }
  for (const changes of [{ type: 'iframe' }, { type: 'worker' }, { id: '../page-1' }, { id: '' }, { id: 'x'.repeat(129) }, { url: null }]) {
    assert.equal(validateTarget({ ...page(), ...changes }, ORIGIN, CDP_PORT), false);
  }
  for (const origin of [null, 'https://evil.invalid', 'http://127.0.0.1:41001', `${ORIGIN}/`, `${ORIGIN}?x`]) {
    assert.equal(validateTarget(page(), origin, CDP_PORT), false);
  }
  assert.equal(validateTarget(page(), ORIGIN, 65536), false);
  assert.equal(validateTarget({ ...page(), webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/page-1' }, ORIGIN, 80), true);
  assert.equal(validateTarget({ ...page(), webSocketDebuggerUrl: 'ws://127.0.0.1:80/devtools/page/page-1' }, ORIGIN, 80), true);
});

test('context selection requires the default top frame, exact origin and a unique ID', () => {
  assert.equal(isEligibleContext(context(), 'top-frame', ORIGIN), true);
  for (const ctx of [null, context({ uniqueId: undefined }), context({ uniqueId: '' }), context({ origin: 'null' }),
    context({ origin: `${ORIGIN}/` }), context({ origin: 'https://evil.invalid' }),
    context({ auxData: { isDefault: false, frameId: 'top-frame' } }),
    context({ auxData: { isDefault: 'true', frameId: 'top-frame' } }),
    context({ auxData: { isDefault: true, frameId: 'child-frame' } })]) {
    assert.equal(isEligibleContext(ctx, 'top-frame', ORIGIN), false);
  }
  assert.equal(isEligibleContext(context(), null, ORIGIN), false);
});

test('starts immediately, verifies LS without reading its body, mounts and stops cleanly', async t => {
  const h = harness(t);
  const injector = h.start();
  await settle();
  assert.equal(injector.status().code, 'connected');
  assert.equal(injector.status().windows, 1);
  assert.ok(h.getCalls >= 1);
  assert.deepEqual(h.requests.map(request => request.url), [LS_URL, LIST_URL]);
  const verification = h.requests[0].options;
  assert.equal(verification.method, 'POST');
  assert.equal(verification.headers['x-codeium-csrf-token'], 'private-token');
  assert.equal(verification.body, '{}');
  assert.equal(h.requests[1].options.headers, undefined);
  assert.equal(h.cancellations, 1);
  assert.equal(h.accountReads, 0);
  assert.deepEqual(h.reads, [h.hubFile, h.portFile]);
  const sandbox = h.fixture('page-1').sandbox;
  assert.equal(sandbox.received.length, 1);
  assert.equal(sandbox.received[0].leaseMs, 15000);
  assert.match(sandbox.received[0].owner, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  assert.deepEqual(h.commands.slice(0, 3).map(command => command.method), ['Page.enable', 'Page.getFrameTree', 'Runtime.enable']);
  assert.ok(Object.isFrozen(injector.status()));
  await injector.stop();
  assert.equal(sandbox.disposals, 1);
  assert.equal(injector.status().code, 'disabled');
  h.assertClosed();
  const calls = h.commands.length;
  await injector.stop();
  await injector.refresh();
  assert.equal(h.commands.length, calls);
});

test('unchanged revision sends only heartbeats; changes and missing runtime send media', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  const sandbox = h.fixture('page-1').sandbox;
  await injector.refresh();
  await injector.refresh();
  assert.equal(h.fullPayloads().length, 1);
  assert.equal(sandbox.beats, 2);
  assert.ok(h.evaluations().slice(2).every(command => !command.params.expression.includes('data:image')));
  h.payload = { ...h.payload, revision: 'r2', media: { kind: 'video', dataUrl: 'data:video/webm;base64,BBBB' } };
  await injector.refresh();
  assert.equal(h.fullPayloads().length, 2);
  assert.equal(sandbox.received.at(-1).revision, 'r2');
  assert.equal(sandbox.received.at(-1).media.kind, 'video');
  vm.runInContext('delete globalThis.__agyGlass', sandbox);
  await injector.refresh();
  assert.equal(h.fullPayloads().length, 3);
  assert.equal(injector.status().code, 'connected');
});

test('periodic work runs at three seconds, with no full media resend', async t => {
  const h = harness(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const injector = h.start();
  await injector.refresh();
  const calls = h.getCalls;
  t.mock.timers.tick(2999);
  await settle();
  assert.equal(h.getCalls, calls);
  t.mock.timers.tick(1);
  await settle();
  assert.equal(h.getCalls, calls + 1);
  assert.equal(h.fullPayloads().length, 1);
  await injector.stop();
  t.mock.timers.tick(30000);
  await settle();
  assert.equal(h.getCalls, calls + 1);
});

test('overlapping refreshes coalesce into one follow-up pass', async t => {
  const h = harness(t);
  let release;
  let active = 0, peak = 0;
  h.fetchHook = async url => {
    if (url !== LS_URL) return;
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => { release = resolve; });
    active--;
  };
  const injector = h.start();
  await settle();
  const refreshes = Array.from({ length: 10 }, () => injector.refresh());
  h.payload = { ...h.payload, revision: 'r2' };
  assert.equal(h.getCalls, 1);
  release();
  await Promise.all(refreshes);
  assert.equal(peak, 1);
  assert.equal(h.getCalls, 2);
  assert.equal(h.requests.filter(request => request.url === LS_URL).length, 1);
  assert.equal(h.fixture('page-1').sandbox.received.at(-1).revision, 'r2');
});

test('verification expires at 20 seconds and failure closes sockets without exposing data', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  h.now += 19999;
  await injector.refresh();
  assert.equal(h.requests.filter(request => request.url === LS_URL).length, 1);
  h.now++;
  h.lsOK = false;
  await injector.refresh();
  assert.equal(h.requests.filter(request => request.url === LS_URL).length, 2);
  assert.equal(h.cancellations, 2);
  assert.equal(h.accountReads, 0);
  assert.equal(injector.status().code, 'error');
  assert.equal(injector.status().message, '本机连接不可用');
  h.assertClosed();
  for (const state of h.statuses) {
    assert.deepEqual(Object.keys(state).sort(), ['code', 'message', 'windows']);
    assert.doesNotMatch(JSON.stringify(state), /token|https?:|chat|private/);
  }
});

test('hub port changes invalidate verification immediately and never target another local service', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  h.hub.httpsPort = 41003;
  await injector.refresh();
  assert.equal(h.requests.filter(request => request.url === LS_URL).length, 2);
  assert.equal(injector.status().code, 'waiting');
  assert.equal(h.sockets.length, 1);
  h.assertClosed();
});

test('invalid env, missing/mismatched hub and unavailable port file fail closed', async t => {
  for (const variant of ['remote', 'missing-token', 'missing-hub', 'mismatch', 'string-port', 'bad-port', 'malformed-hub', 'missing-port', 'invalid-devtools-port']) {
    await t.test(variant, async t => {
      const h = harness(t);
      if (variant === 'remote') h.env.ANTIGRAVITY_LS_ADDRESS = 'evil.invalid:41000';
      if (variant === 'missing-token') delete h.env.ANTIGRAVITY_CSRF_TOKEN;
      if (variant === 'missing-hub') h.missingHub = true;
      if (variant === 'mismatch') h.hub.httpPort = 41004;
      if (variant === 'string-port') h.hub.httpsPort = '41001';
      if (variant === 'bad-port') h.hub.httpsPort = 65536;
      if (variant === 'malformed-hub') h.hubText = '{';
      if (variant === 'missing-port') h.missingPort = true;
      if (variant === 'invalid-devtools-port') h.portText = '65536\n';
      const injector = h.start();
      await injector.refresh();
      assert.equal(h.sockets.length, 0);
      assert.equal(h.requests.some(request => request.url === LIST_URL), false);
      if (!['missing-port', 'invalid-devtools-port'].includes(variant)) assert.equal(h.requests.length, 0);
      if (['remote', 'missing-token'].includes(variant)) assert.equal(h.reads.length, 0);
      assert.equal(injector.status().code, variant === 'invalid-devtools-port' ? 'error' : 'waiting');
    });
  }
});

test('unauthenticated or redirected LS does not permit DevTools discovery', async t => {
  for (const kind of ['denied', 'redirect']) await t.test(kind, async t => {
    const h = harness(t);
    if (kind === 'denied') h.lsOK = false;
    else h.fetchHook = async url => {
      if (url === LS_URL) throw new Error('redirect private-token https://evil.invalid');
    };
    const injector = h.start();
    await injector.refresh();
    assert.equal(h.requests.length, 1);
    assert.equal(h.sockets.length, 0);
    assert.equal(injector.status().message, '本机连接不可用');
  });
});

test('filters malicious targets, deduplicates IDs and bounds windows', async t => {
  const h = harness(t);
  h.targets = [
    page('external', 'https://evil.invalid'), page('other-service', 'https://127.0.0.1:42000'),
    { ...page('remote-ws'), webSocketDebuggerUrl: 'ws://evil.invalid:41002/devtools/page/remote-ws' },
    { ...page('worker'), type: 'worker' },
    page('duplicate'), page('duplicate'),
    ...Array.from({ length: 12 }, (_, index) => page(`safe-${index}`)),
  ];
  const injector = h.start();
  await injector.refresh();
  assert.equal(h.sockets.length, 8);
  assert.equal(new Set(h.sockets.map(socket => socket.id)).size, 8);
  assert.equal(injector.status().windows, 8);
  assert.equal(h.sockets.some(socket => ['external', 'other-service', 'remote-ws', 'worker'].includes(socket.id)), false);
});

test('missing, isolated and child contexts never trigger fallback evaluation', async t => {
  const h = harness(t);
  h.fixture('page-1').contexts = [
    context({ uniqueId: 'child', auxData: { isDefault: true, frameId: 'child-frame' } }),
    context({ uniqueId: 'isolated', auxData: { isDefault: false, frameId: 'top-frame' } }),
    context({ uniqueId: 'foreign', origin: 'https://evil.invalid' }),
  ];
  const injector = h.start();
  await injector.refresh();
  await injector.refresh();
  assert.equal(h.evaluations().length, 0);
  assert.equal(injector.status().code, 'waiting');
  await injector.stop();
  assert.equal(h.evaluations().length, 0);
});

test('old CDP without unique IDs is unsupported, not an invitation to use numeric contextId', async t => {
  const h = harness(t);
  h.fixture('page-1').contexts = [context({ uniqueId: undefined })];
  const injector = h.start();
  await injector.refresh();
  assert.equal(injector.status().code, 'unsupported');
  assert.equal(h.evaluations().length, 0);
});

test('top-level frame URL must independently match the verified origin', async t => {
  const h = harness(t);
  h.fixture('page-1').frameUrl = 'https://evil.invalid';
  const injector = h.start();
  await injector.refresh();
  assert.equal(h.evaluations().length, 0);
  assert.equal(injector.status().code, 'waiting');
});

test('navigation drops the context; only a new verified default top context can resume', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  const socket = h.sockets[0];
  const before = h.evaluations().length;
  socket.emit('Page.frameStartedLoading', { frameId: 'top-frame' });
  await injector.refresh();
  assert.equal(h.evaluations().length, before);
  const newContext = context({ id: 8, uniqueId: 'new-document', auxData: { isDefault: true, frameId: 'new-top' } });
  socket.fixture.frameId = 'new-top';
  socket.fixture.contexts = [newContext];
  vm.runInContext('delete globalThis.__agyGlass', socket.fixture.sandbox);
  await injector.refresh();
  assert.equal(h.fullPayloads().length, 2);
  assert.equal(h.evaluations().at(-1).params.uniqueContextId, 'new-document');
  const reconnected = h.sockets.at(-1);
  reconnected.emit('Page.frameNavigated', { frame: { id: 'new-top', url: 'https://evil.invalid' } });
  socket.fixture.frameUrl = 'https://evil.invalid';
  socket.fixture.sandbox.location.origin = 'https://evil.invalid';
  reconnected.emit('Runtime.executionContextCreated', { context: newContext });
  const after = h.evaluations().length;
  await injector.refresh();
  await injector.stop();
  assert.equal(h.evaluations().length, after);
  assert.equal(socket.fixture.sandbox.disposals, 0);
});

test('same-document loading reconnects and recovers the verified live context', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  h.sockets[0].emit('Page.frameStartedLoading', { frameId: 'top-frame' });
  const before = h.evaluations().length;
  await injector.refresh();
  assert.equal(h.evaluations().length, before);
  assert.equal(h.sockets[0].readyState, 3);
  await injector.refresh();
  assert.equal(injector.status().code, 'connected');
  assert.equal(h.sockets.length, 2);
  assert.equal(h.fullPayloads().length, 1);
  assert.equal(h.evaluations().at(-1).params.uniqueContextId, 'document-page-1');
});

test('destroyed/cleared/detached contexts are never evaluated or disposed', async t => {
  for (const event of ['Runtime.executionContextsCleared', 'Runtime.executionContextDestroyed', 'Page.frameDetached']) {
    await t.test(event, async t => {
      const h = harness(t);
      const injector = h.start();
      await injector.refresh();
      const socket = h.sockets[0];
      socket.emit(event, { executionContextUniqueId: 'document-page-1', frameId: 'top-frame' });
      const before = h.evaluations().length;
      await injector.refresh();
      await injector.stop();
      assert.equal(h.evaluations().length, before);
    });
  }
});

test('heartbeat, update and stop cannot touch a newer foreign owner', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  const sandbox = h.fixture('page-1').sandbox;
  const api = sandbox.__agyGlass;
  api.owner = 'newer-owner';
  h.payload = { ...h.payload, revision: 'r2' };
  await injector.refresh();
  assert.equal(sandbox.beats, 0);
  assert.equal(sandbox.received.length, 1);
  assert.equal(h.fullPayloads().length, 1);
  await injector.stop();
  assert.equal(sandbox.disposals, 0);
  assert.equal(sandbox.__agyGlass, api);
});

test('location guard blocks calls if navigation events have not arrived yet', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  const sandbox = h.fixture('page-1').sandbox;
  sandbox.location.origin = 'https://evil.invalid';
  await injector.refresh();
  await injector.stop();
  assert.equal(sandbox.beats, 0);
  assert.equal(sandbox.disposals, 0);
});

test('disabled starts without I/O; refresh disposes existing instances and re-enable remounts', async t => {
  const h = harness(t);
  h.payload.settings.enabled = false;
  const injector = h.start();
  await injector.refresh();
  assert.equal(injector.status().code, 'disabled');
  assert.equal(h.reads.length + h.requests.length + h.sockets.length, 0);
  h.payload.settings.enabled = true;
  await injector.refresh();
  const sandbox = h.fixture('page-1').sandbox;
  h.payload.settings.enabled = false;
  await injector.refresh();
  assert.equal(sandbox.disposals, 1);
  h.assertClosed();
  h.payload.settings.enabled = true;
  await injector.refresh();
  assert.equal(sandbox.received.length, 2);
  assert.equal(injector.status().code, 'connected');
});

test('reconnect retains revision bookkeeping and does not retransmit unchanged media', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  h.sockets[0].close();
  await injector.refresh();
  assert.equal(h.sockets.length, 2);
  assert.equal(h.fullPayloads().length, 1);
  assert.equal(h.fixture('page-1').sandbox.beats, 1);
});

test('unsupported evaluation parameters do not fall back to unscoped evaluation', async t => {
  const h = harness(t);
  h.onCommand = (command, socket) => {
    if (command.method !== 'Runtime.evaluate') return false;
    socket.fail(command, -32602);
    return true;
  };
  const injector = h.start();
  await injector.refresh();
  assert.equal(injector.status().code, 'unsupported');
  assert.equal(h.evaluations().length, 1);
  h.assertClosed();
});

test('command timeout retires the socket and handlers without leaking remote errors', async t => {
  const h = harness(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  h.onCommand = command => command.method === 'Runtime.evaluate';
  const injector = h.start();
  await settle();
  assert.equal(h.evaluations().length, 1);
  t.mock.timers.tick(3000);
  await settle();
  assert.equal(injector.status().code, 'error');
  assert.equal(injector.status().message, '本机连接不可用');
  h.assertClosed();
  await injector.stop();
});

test('stop aborts an opening socket and an in-progress HTTP verification', async t => {
  await t.test('opening socket', async t => {
    const h = harness(t, { autoOpen: false });
    const injector = h.start();
    await settle();
    assert.equal(h.sockets.length, 1);
    await injector.stop();
    h.assertClosed();
    assert.equal(h.commands.length, 0);
  });
  await t.test('verification', async t => {
    const h = harness(t);
    let signal;
    h.fetchHook = (url, options) => new Promise((resolve, reject) => {
      signal = options.signal;
      signal.addEventListener('abort', () => reject(new Error('private-token')), { once: true });
    });
    const injector = h.start();
    await settle();
    await injector.stop();
    assert.equal(signal.aborted, true);
    assert.equal(h.requests.length, 1);
    assert.equal(h.sockets.length, 0);
    assert.equal(injector.status().code, 'disabled');
  });
});

test('immediate stop prevents even the initial discovery pass', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.stop();
  assert.equal(h.getCalls, 0);
  assert.equal(h.reads.length + h.requests.length + h.sockets.length, 0);
  assert.equal(injector.status().code, 'disabled');
});

test('void heartbeats preserve the runtime mount result, including across reconnects', async t => {
  for (const mounted of [true, false]) await t.test(String(mounted), async t => {
    const h = harness(t);
    const runtimeSource = `(function(payload){
      received.push(payload);
      globalThis.__agyGlass = {
        owner: payload.owner, update(){}, heartbeat(){beats++;},
        dispose(){disposals++; delete globalThis.__agyGlass;}
      };
      return {mounted:${mounted}};
    })`;
    const injector = h.start({ runtimeSource });
    await injector.refresh();
    await injector.refresh();
    h.sockets[0].close();
    await injector.refresh();
    assert.equal(injector.status().code, mounted ? 'connected' : 'unsupported');
    assert.equal(h.fullPayloads().length, 1);
  });
});

test('stop waits for an in-flight command, then disposes before closing', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  h.onCommand = command => command.method === 'Runtime.evaluate';
  const refreshing = injector.refresh();
  await settle();
  const pending = h.commands.at(-1);
  const stopping = injector.stop();
  h.onCommand = null;
  pending.socket.reply(pending, { result: { type: 'string', value: 'mounted' } });
  await Promise.all([refreshing, stopping]);
  assert.equal(h.fixture('page-1').sandbox.disposals, 1);
  assert.equal(h.fullPayloads().length, 1);
  h.assertClosed();
});

test('late evaluation results cannot resurrect a destroyed document', async t => {
  const h = harness(t);
  const injector = h.start();
  await injector.refresh();
  h.onCommand = command => command.method === 'Runtime.evaluate';
  const refreshing = injector.refresh();
  await settle();
  const pending = h.commands.at(-1);
  pending.socket.emit('Runtime.executionContextDestroyed', { executionContextUniqueId: 'document-page-1' });
  pending.socket.reply(pending, { result: { type: 'string', value: 'mounted' } });
  await refreshing;
  assert.equal(injector.status().code, 'waiting');
  assert.equal(h.fullPayloads().length, 1);
  await injector.stop();
  assert.equal(h.fixture('page-1').sandbox.disposals, 0);
});

test('a stale frame-tree response cannot override a navigation event', async t => {
  const h = harness(t);
  h.onCommand = (command, socket) => {
    if (command.method !== 'Page.getFrameTree') return false;
    socket.emit('Page.frameNavigated', { frame: { id: 'top-frame', url: 'https://evil.invalid' } });
    socket.reply(command, { frameTree: { frame: { id: 'top-frame', url: ORIGIN } } });
    return true;
  };
  const injector = h.start();
  await injector.refresh();
  assert.equal(h.evaluations().length, 0);
  assert.equal(injector.status().code, 'waiting');
});

test('exceptions and throwing status observers cannot leak data or prevent cleanup', async t => {
  const h = harness(t);
  let notifications = 0;
  const injector = h.start({
    onStatus() { notifications++; throw new Error('private-token'); },
    runtimeSource: '(function(){ throw new Error("https://evil.invalid/chat private-token"); })',
  });
  await injector.refresh();
  assert.equal(injector.status().code, 'error');
  assert.equal(injector.status().message, '本机连接不可用');
  assert.equal(notifications, 1);
  await injector.stop();
  h.assertClosed();
});
