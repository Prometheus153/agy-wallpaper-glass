import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync, cpSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  DEFAULTS, MAX_MEDIA_BYTES, migrateSavedSettings, validateSettings, validateMedia,
  validateScenePropertiesMap, validateScenePropertyValues,
} from './config.mjs';
import { installGlass } from './runtime.mjs';
import {
  createLibrary, validateLibraryDirectory, validateLibraryDirectories, validateLibraryReference,
} from './library.mjs';
import { boundedBody, escapeAttr, pickLocalDirectory, saveImportedPkg, streamHandle } from './server-helpers.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const STATIC = new Map([
  ['/', ['index.html', 'text/html']],
  ['/panel.css', ['panel.css', 'text/css']],
  ['/panel.js', ['panel.mjs', 'text/javascript']],
  ['/preview.html', ['preview.html', 'text/html']],
  ['/preview.js', ['preview.mjs', 'text/javascript']],
  ['/player.js', ['player.mjs', 'text/javascript']],
  ['/vendor/webwallgl.global.min.js', ['vendor/webwallgl.global.min.js', 'text/javascript']],
]);
const BINARY_STATIC = new Map([
  ['/assets/pet-open.webp', ['assets/pet-open.webp', 'image/webp']],
  ['/assets/pet-wink.webp', ['assets/pet-wink.webp', 'image/webp']],
  ['/assets/pet-sad.webp', ['assets/pet-sad.webp', 'image/webp']],
  ['/assets/pet-tail.webp', ['assets/pet-tail.webp', 'image/webp']],
  ['/assets/zh-dict.json', ['vendor/zh-dict.json', 'application/json; charset=utf-8']],
]);

const PANEL_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const PLAYER_CSP = "default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' blob: data:; font-src 'self' data: blob:; object-src 'none'; base-uri 'none'";

export async function startServer({ preview = false, port = 0, dataDir, token, startBridge, library = createLibrary({ builtinsDir: join(ROOT, 'builtins') }) } = {}) {
  if (!preview && (!token || !startBridge)) throw new Error('请从 Antigravity 插件面板启动；本地预览请用 npm run preview');
  if (!Number.isInteger(port) || port < 0 || port > 65535 || (!preview && port === 0)) throw new Error('无效的侧车端口');
  if (!dataDir) throw new Error('缺少插件数据目录');

  let current = {
    settings: { ...DEFAULTS },
    media: null,
    libraryDirectory: '',
    libraryDirectories: [],
    librarySelection: null,
    libraryMedia: null,
    hiddenIds: [],
    sceneProperties: {},
  };
  let revision = randomUUID();
  let reloadNonce = randomUUID();
  let mediaKey = randomUUID();
  const drawerKey = randomUUID();
  let activeMedia = null;
  let libraryWarning = '';
  let streams = 0;
  let assetStreams = 0;
  const stateFile = join(dataDir, 'state.json');

  try {
    const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
    current = {
      settings: migrateSavedSettings(saved.settings),
      media: saved.media ? validateMedia(saved.media) : null,
      libraryDirectory: validateLibraryDirectory(saved.libraryDirectory ?? ''),
      libraryDirectories: validateLibraryDirectories(saved.libraryDirectories ?? saved.libraryDirectory ?? ''),
      librarySelection: typeof saved.librarySelection === 'string' && saved.librarySelection.length <= 128 ? saved.librarySelection : null,
      libraryMedia: saved.libraryMedia ? validateLibraryReference(saved.libraryMedia) : null,
      hiddenIds: saved.hiddenIds ?? [],
      sceneProperties: validateScenePropertiesMap(saved.sceneProperties),
    };
    if (!Array.isArray(current.hiddenIds) || current.hiddenIds.length > 2000 || current.hiddenIds.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) {
      throw new Error('隐藏列表无效');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('插件配置损坏，已停止启动以避免覆盖原数据');
  }

  if (current.libraryMedia) {
    try {
      const opened = await library.openMedia(current.libraryMedia);
      await opened.handle.close();
      activeMedia = {
        name: opened.name, kind: opened.kind, bytes: opened.bytes,
        previewFile: opened.previewFile || '', properties: opened.properties || [],
      };
    } catch {
      libraryWarning = '上次壁纸的原文件不可用，请重新选择；未改动保存的设置。';
    }
  }

  function save(next) {
    mkdirSync(dataDir, { recursive: true });
    const temp = join(dataDir, `state.${randomUUID()}.tmp`);
    try {
      writeFileSync(temp, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
      renameSync(temp, stateFile);
    } finally { rmSync(temp, { force: true }); }
    current = next;
    revision = randomUUID();
  }

  let bridge;
  const basePort = () => server.address()?.port || port;
  const getStatus = () => preview ? { code: 'preview', windows: 0, message: '本地预览，不会修改 Antigravity' } : bridge.status();
  const activeSceneProps = () => current.librarySelection ? (current.sceneProperties[current.librarySelection] || {}) : {};

  function bridgeMedia() {
    if (!activeMedia) return current.media;
    const isPlayer = activeMedia.kind === 'scene' || activeMedia.kind === 'web';
    const route = isPlayer ? 'player' : 'wallpaper';
    return {
      name: activeMedia.name,
      kind: activeMedia.kind,
      bytes: activeMedia.bytes,
      url: `http://127.0.0.1:${basePort()}/${route}/${mediaKey}`,
    };
  }

  function publicMedia() {
    const base = bridgeMedia();
    if (!base) return null;
    if (!activeMedia) return base;
    const hasThumb = Boolean(activeMedia.previewFile || activeMedia.kind === 'image');
    return {
      ...base,
      thumbUrl: hasThumb ? `http://127.0.0.1:${basePort()}/thumb/${mediaKey}` : null,
      properties: activeMedia.properties || [],
    };
  }

  const getPayload = () => ({
    revision,
    reloadNonce,
    sidecarPort: basePort(),
    drawerUrl: `http://127.0.0.1:${basePort()}/?drawer=${drawerKey}`,
    zhDictUrl: `http://127.0.0.1:${basePort()}/assets/zh-dict.json`,
    mediaThumbUrl: activeMedia && (activeMedia.previewFile || activeMedia.kind === 'image')
      ? `http://127.0.0.1:${basePort()}/thumb/${mediaKey}`
      : null,
    petAssets: {
      open: `http://127.0.0.1:${basePort()}/assets/pet-open.webp`,
      wink: `http://127.0.0.1:${basePort()}/assets/pet-wink.webp`,
      sad: `http://127.0.0.1:${basePort()}/assets/pet-sad.webp`,
      tail: `http://127.0.0.1:${basePort()}/assets/pet-tail.webp`,
    },
    settings: current.settings,
    media: bridgeMedia(),
    sceneProperties: activeSceneProps(),
  });

  function scanDirectoriesWithImported(userDirs) {
    const importedRoot = join(dataDir, 'imported-scenes');
    if (existsSync(importedRoot) && userDirs.length < 12) {
      return [...userDirs, importedRoot];
    }
    return userDirs;
  }

  async function selectLibraryItem(id) {
    const selected = await library.select(id);
    save({
      ...current,
      media: null,
      libraryMedia: selected.reference,
      librarySelection: id,
      settings: { ...current.settings, enabled: true, paused: false },
    });
    activeMedia = {
      name: selected.name, kind: selected.kind, bytes: selected.bytes,
      previewFile: selected.previewFile || '', properties: selected.properties || [],
    };
    mediaKey = randomUUID();
    libraryWarning = '';
    void bridge?.refresh();
    return {
      settings: current.settings,
      media: publicMedia(),
      librarySelection: current.librarySelection,
      sceneProperties: current.sceneProperties,
      status: getStatus(),
    };
  }

  function authorized(req) {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const hostOk = req.headers.host === new URL(origin).host;
    const sameOriginOk = (!req.headers.origin || req.headers.origin === origin) && req.headers['sec-fetch-site'] !== 'cross-site';
    if (preview) {
      return hostOk && req.headers['x-agy-preview'] === '1' && sameOriginOk;
    }
    const providedDrawer = req.headers['x-drawer-key'];
    if (typeof providedDrawer === 'string' && hostOk && sameOriginOk) {
      const a = Buffer.from(providedDrawer), b = Buffer.from(drawerKey);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
    const provided = req.headers['x-sidecar-token'];
    if (typeof provided !== 'string') return false;
    const a = Buffer.from(provided), b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const reply = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    try {
      const path = new URL(req.url, 'http://127.0.0.1').pathname;
      const expectedHost = `127.0.0.1:${server.address().port}`;

      if (path.startsWith('/wallpaper/')) {
        if (!['GET', 'HEAD'].includes(req.method)) { reply(405, { error: 'Method not allowed' }); return; }
        if (req.headers.host !== expectedHost || path !== `/wallpaper/${mediaKey}` || !activeMedia || !current.libraryMedia) { reply(404, { error: 'Not found' }); return; }
        if (streams >= 4) { reply(429, { error: '媒体读取繁忙' }); return; }
        streams++;
        res.once('close', () => { streams--; });
        try {
          const opened = await library.openMedia(current.libraryMedia);
          await streamHandle(req, res, opened, reply, { 'Access-Control-Allow-Origin': '*' });
        } catch {
          if (res.headersSent) res.destroy();
          else reply(404, { error: '壁纸原文件不可用，请重新选择' });
        }
        return;
      }

      if (path.startsWith('/player/')) {
        if (req.method !== 'GET') { reply(405, { error: 'Method not allowed' }); return; }
        if (req.headers.host !== expectedHost || path !== `/player/${mediaKey}` || !activeMedia || !current.libraryMedia || !['scene', 'web'].includes(activeMedia.kind)) {
          reply(404, { error: 'Not found' });
          return;
        }
        const init = JSON.stringify({
          fit: current.settings.fit,
          paused: current.settings.paused,
          pauseWhenHidden: current.settings.pauseWhenHidden,
          volume: current.settings.volume,
          playbackRate: current.settings.playbackRate,
          posX: current.settings.posX,
          posY: current.settings.posY,
          zoom: current.settings.zoom,
          flipX: current.settings.flipX,
          pointerParallax: current.settings.pointerParallax,
          performanceMode: current.settings.performanceMode,
          fpsLimit: current.settings.fpsLimit,
          properties: activeSceneProps(),
        });
        const html = readFileSync(join(ROOT, 'player.html'), 'utf8')
          .replace('__MEDIA_KEY__', escapeAttr(mediaKey))
          .replace('__KIND__', escapeAttr(activeMedia.kind))
          .replace('__PREVIEW__', escapeAttr(activeMedia.previewFile || ''))
          .replace('__INIT__', escapeAttr(init));
        res.setHeader('Content-Security-Policy', PLAYER_CSP);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (path.startsWith('/scene/')) {
        if (!['GET', 'HEAD'].includes(req.method)) { reply(405, { error: 'Method not allowed' }); return; }
        const prefix = `/scene/${mediaKey}/`;
        if (req.headers.host !== expectedHost || !path.startsWith(prefix) || !activeMedia || !current.libraryMedia) {
          reply(404, { error: 'Not found' });
          return;
        }
        if (assetStreams >= 24) { reply(429, { error: '资源读取繁忙' }); return; }
        assetStreams++;
        res.once('close', () => { assetStreams--; });
        try {
          const encodedRel = path.slice(prefix.length);
          const relPath = encodedRel.split('/').map(seg => decodeURIComponent(seg)).join('/');
          const opened = await library.openAsset(current.libraryMedia, relPath);
          await streamHandle(req, res, opened, reply, { 'Access-Control-Allow-Origin': '*' });
        } catch {
          if (res.headersSent) res.destroy();
          else reply(404, { error: '场景资源不存在' });
        }
        return;
      }

      if (path.startsWith('/thumb/')) {
        if (req.method !== 'GET') { reply(405, { error: 'Method not allowed' }); return; }
        if (req.headers.host !== expectedHost || path !== `/thumb/${mediaKey}` || !activeMedia || !current.libraryMedia) {
          reply(404, { error: 'Not found' });
          return;
        }
        try {
          const dataUrl = await library.readPreviewForReference(current.libraryMedia);
          if (!dataUrl) { reply(404, { error: 'No preview' }); return; }
          const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
          if (!m) { reply(404, { error: 'Invalid preview' }); return; }
          const buf = Buffer.from(m[2], 'base64');
          res.writeHead(200, {
            'Content-Type': m[1],
            'Content-Length': buf.length,
            'Access-Control-Allow-Origin': '*',
          });
          res.end(buf);
        } catch {
          reply(404, { error: 'Preview unavailable' });
        }
        return;
      }

      if (req.method === 'GET' && BINARY_STATIC.has(path)) {
        const [file, type] = BINARY_STATIC.get(path);
        const buf = readFileSync(join(ROOT, file));
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length });
        res.end(buf);
        return;
      }

      if (req.method === 'GET' && STATIC.has(path)) {
        const [file, type] = STATIC.get(path);
        let body = readFileSync(join(ROOT, file), 'utf8');
        if (path === '/panel.js' || path === '/preview.js') {
          const i18nSrc = readFileSync(join(ROOT, 'i18n.mjs'), 'utf8');
          const monetSrc = readFileSync(join(ROOT, 'monet.mjs'), 'utf8');
          const effortSrc = readFileSync(join(ROOT, 'effort-slider.mjs'), 'utf8');
          const shared = path === '/panel.js'
            ? readFileSync(join(ROOT, 'config.mjs'), 'utf8') + '\n' + i18nSrc + '\n' + monetSrc + '\n' + effortSrc
            : i18nSrc + '\n' + monetSrc + '\n' + readFileSync(join(ROOT, 'zh-ui.mjs'), 'utf8') + '\n' + effortSrc + '\n' + readFileSync(join(ROOT, 'pet.mjs'), 'utf8') + '\n' + readFileSync(join(ROOT, 'runtime.mjs'), 'utf8');
          body = `(async () => {\n${shared.replace(/^export /gm, '')}\n${body.replace(/^import .*;\r?\n/gm, '')}\n})().catch(error => console.error('AGY Wallpaper Glass initialization failed:', error));`;
        }
        if (file === 'index.html') {
          const parsedUrl = new URL(req.url, 'http://127.0.0.1');
          const isDrawer = parsedUrl.searchParams.has('drawer');
          body = body.replace('data-mode="sidecar"', `data-mode="${isDrawer ? 'drawer' : preview ? 'preview' : 'sidecar'}"`);
        }
        if (path === '/vendor/webwallgl.global.min.js') res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Security-Policy', path === '/player.js' ? PLAYER_CSP : PANEL_CSP);
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        res.end(body);
        return;
      }

      if (!path.startsWith('/api/')) { reply(404, { error: 'Not found' }); return; }
      if (req.method !== 'POST') { reply(405, { error: '仅接受 POST 请求' }); return; }
      if (!authorized(req)) { reply(401, { error: '未授权，请从插件面板重新打开' }); return; }

      if (path === '/api/import-pkg') {
        const imported = await saveImportedPkg(req, dataDir);
        save({
          ...current,
          media: null,
          libraryMedia: imported.reference,
          librarySelection: imported.id,
          settings: { ...current.settings, enabled: true, paused: false },
        });
        activeMedia = {
          name: imported.name, kind: 'scene', bytes: imported.bytes,
          previewFile: '', properties: [],
        };
        mediaKey = randomUUID();
        libraryWarning = '';
        void bridge?.refresh();
        reply(200, {
          settings: current.settings,
          media: publicMedia(),
          librarySelection: current.librarySelection,
          status: getStatus(),
        });
        return;
      }

      if (!req.headers['content-type']?.startsWith('application/json')) { reply(415, { error: '需要 JSON 请求' }); return; }
      const limit = path === '/api/media' ? Math.ceil(MAX_MEDIA_BYTES * 4 / 3) + 4096 : 16384;
      if (Number(req.headers['content-length']) > limit) { reply(413, { error: '请求太大；壁纸最大 32 MB' }); return; }
      const data = JSON.parse((await boundedBody(req, limit)) || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('请求必须是对象');

      if (path === '/api/state') {
        const { libraryMedia, ...state } = current;
        reply(200, { ...state, media: publicMedia(), libraryWarning, status: getStatus() });
        return;
      }
      if (path === '/api/status') { reply(200, getStatus()); return; }
      if (path === '/api/reload') {
        reloadNonce = randomUUID();
        revision = randomUUID();
        void bridge?.refresh();
        reply(200, { ok: true, reloadNonce, status: getStatus() });
        return;
      }
      if (path === '/api/library/pick-directory') {
        reply(200, await pickLocalDirectory());
        return;
      }
      if (path === '/api/library/import-directory') {
        const dir = validateLibraryDirectory(data.directory);
        if (!dir) throw new Error('请输入有效的本地文件夹路径');
        const merged = validateLibraryDirectories([...current.libraryDirectories, dir]);
        const result = await library.scan(scanDirectoriesWithImported(merged));
        if (JSON.stringify(merged) !== JSON.stringify(current.libraryDirectories)) {
          save({ ...current, libraryDirectory: merged[0] || '', libraryDirectories: merged });
        }
        let selected = null;
        if (data.autoSelect !== false) {
          const importedRoot = dir.toLowerCase();
          const candidates = result.items.filter(item => item.available);
          if (candidates.length === 1) selected = await selectLibraryItem(candidates[0].id);
          else {
            const direct = candidates.find(item => item.source === '手动目录' && result.sources.some(s => s.path.toLowerCase() === importedRoot));
            if (direct && result.sources.some(s => s.path.toLowerCase() === importedRoot && s.source === '手动目录') && candidates.filter(i => i.source === '手动目录').length === 1) {
              selected = await selectLibraryItem(direct.id);
            }
          }
        }
        reply(200, {
          scan: { ...result, hiddenIds: current.hiddenIds },
          libraryDirectories: current.libraryDirectories,
          selected,
          settings: current.settings,
          media: publicMedia(),
          librarySelection: current.librarySelection,
          status: getStatus(),
        });
        return;
      }
      if (path === '/api/library/scan') {
        const directories = validateLibraryDirectories(data.directories ?? data.directory ?? current.libraryDirectories);
        const result = await library.scan(scanDirectoriesWithImported(directories));
        if (JSON.stringify(directories) !== JSON.stringify(current.libraryDirectories)) {
          save({ ...current, libraryDirectory: directories[0] || '', libraryDirectories: directories });
        }
        reply(200, { ...result, hiddenIds: current.hiddenIds });
        return;
      }
      if (path === '/api/library/thumbnail') { reply(200, await library.thumbnail(data.id)); return; }
      if (path === '/api/library/hide') {
        if (typeof data.id !== 'string' || !/^[a-f0-9]{64}$/.test(data.id) || typeof data.hidden !== 'boolean' || (!library.has(data.id) && !current.hiddenIds.includes(data.id))) {
          throw new Error('壁纸不存在，请重新扫描');
        }
        const hidden = new Set(current.hiddenIds);
        if (data.hidden) hidden.add(data.id); else hidden.delete(data.id);
        if (hidden.size > 2000) throw new Error('隐藏列表已满');
        save({ ...current, hiddenIds: [...hidden] });
        reply(200, { hiddenIds: current.hiddenIds });
        return;
      }
      if (path === '/api/library/select') {
        reply(200, await selectLibraryItem(data.id));
        return;
      }
      if (path === '/api/scene-properties') {
        const id = typeof data.id === 'string' && /^[a-f0-9]{64}$/.test(data.id) ? data.id : current.librarySelection;
        if (!id || !/^[a-f0-9]{64}$/.test(id)) throw new Error('当前未选中支持属性的壁纸');
        const values = validateScenePropertyValues(data.properties);
        const nextMap = validateScenePropertiesMap({ ...current.sceneProperties, [id]: values });
        save({ ...current, sceneProperties: nextMap });
        void bridge?.refresh();
        reply(200, { sceneProperties: current.sceneProperties, status: getStatus() });
        return;
      }
      if (path === '/api/settings') {
        save({ ...current, settings: validateSettings(data, current.settings) });
      } else if (path === '/api/media' || path === '/api/clear-media') {
        save({ ...current, media: path === '/api/media' ? validateMedia(data) : null, libraryMedia: null, librarySelection: null });
        activeMedia = null;
        mediaKey = randomUUID();
        libraryWarning = '';
      } else {
        reply(404, { error: 'Not found' });
        return;
      }
      void bridge?.refresh();
      reply(200, { settings: current.settings, media: publicMedia(), status: getStatus() });
    } catch (error) {
      const expected = error instanceof SyntaxError || error.status || !error.code;
      reply(error.status || (expected ? 400 : 500), { error: expected ? error.message : '无法保存插件配置，原配置未被覆盖' });
    }
  });

  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  const i18nSource = readFileSync(join(ROOT, 'i18n.mjs'), 'utf8').replace(/^export /gm, '');
  const monetSource = readFileSync(join(ROOT, 'monet.mjs'), 'utf8').replace(/^export /gm, '');
  const zhUiSource = readFileSync(join(ROOT, 'zh-ui.mjs'), 'utf8').replace(/^export /gm, '');
  const effortSource = readFileSync(join(ROOT, 'effort-slider.mjs'), 'utf8').replace(/^export /gm, '');
  const petSource = readFileSync(join(ROOT, 'pet.mjs'), 'utf8').replace(/^export /gm, '');
  const runtimeBundle = `(payload) => {\n${i18nSource}\n${monetSource}\n${zhUiSource}\n${effortSource}\n${petSource}\nreturn (${installGlass.toString()})(payload);\n}`;
  if (!preview) bridge = startBridge({ getPayload, runtimeSource: runtimeBundle });
  try {
    await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveListen); });
  } catch (error) { await bridge?.stop(); throw error; }

  return {
    port: server.address().port,
    close: async () => {
      await bridge?.stop();
      await new Promise(resolveClose => server.close(resolveClose));
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const preview = process.argv.includes('--preview');
  const port = Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || (preview ? 47831 : NaN));
  const newDataDir = join(homedir(), '.gemini', 'antigravity', 'agy-wallpaper-glass');
  const legacyDataDir = join(homedir(), '.gemini', 'antigravity', 'agy-glass');
  if (!preview && !existsSync(newDataDir) && existsSync(legacyDataDir)) {
    try { cpSync(legacyDataDir, newDataDir, { recursive: true }); } catch {}
  }
  const dataDir = preview ? join(ROOT, '..', '..', '.preview-state') : newDataDir;
  const startBridge = preview ? undefined : (await import('./injector.mjs')).startInjector;
  const app = await startServer({ preview, port, dataDir, token: process.env.ANTIGRAVITY_SIDECAR_UI_TOKEN, startBridge });
  console.log(preview ? `AGY Wallpaper Glass preview: http://127.0.0.1:${app.port}` : '[agy-wallpaper-glass] sidecar ready');
  let closing = false;
  const close = async () => { if (closing) return; closing = true; await app.close(); process.exit(0); };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
