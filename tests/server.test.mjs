import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../sidecars/glass/server.mjs';
import { createLibrary } from '../sidecars/glass/library.mjs';
import { request, ServerResponse } from 'node:http';
import { Script } from 'node:vm';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=';

test('preview API saves, reloads, rejects cross-origin access and removes selected media', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'agy-glass-'));
  const app = await startServer({ preview: true, dataDir: dir });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${app.port}`;
  const post = (path, data = {}, extraHeaders = {}) => fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agy-preview': '1', ...extraHeaders }, body: JSON.stringify(data) });
  const html = await (await fetch(url + '/')).text();
  assert.match(html, /script defer src="\.\/panel\.js"/);
  assert.match(html, /data-tab="wallpaper"/);
  assert.match(html, /data-tab="style"/);
  assert.match(html, /id="btn-import-folder"/);
  for (const asset of ['/panel.js', '/preview.js', '/player.js']) {
    const response = await fetch(url + asset);
    assert.equal(response.status, 200);
    const source = await response.text();
    assert.doesNotThrow(() => new Script(source));
  }
  assert.equal((await fetch(url + '/api/state')).status, 405);
  assert.equal((await post('/api/state', {}, { origin: 'https://evil.invalid' })).status, 401);
  assert.equal((await post('/api/state', {}, { 'x-agy-preview': '0' })).status, 401);
  const rebindingStatus = await new Promise((resolveStatus, reject) => {
    const req = request(url + '/api/state', { method: 'POST', headers: { host: 'evil.invalid', 'content-type': 'application/json', 'x-agy-preview': '1' } }, res => { res.resume(); resolveStatus(res.statusCode); });
    req.on('error', reject);
    req.end('{}');
  });
  assert.equal(rebindingStatus, 401);
  assert.equal((await post('/api/state', {}, { 'sec-fetch-site': 'cross-site' })).status, 401);
  const state = await (await post('/api/state')).json();
  assert.equal(state.settings.enabled, false);
  assert.equal(state.status.code, 'preview');
  assert.equal((await post('/api/settings', { enabled: true, theme: 'frost' })).status, 200);
  assert.equal((await post('/api/settings', { fontFamily: 'x;}' })).status, 400);
  assert.equal((await post('/api/settings', { fontFamily: 'x'.repeat(18000) })).status, 413);
  assert.equal((await post('/api/media', { name: 'tiny.png', dataUrl: png })).status, 200);
  assert.equal((await post('/api/media', { name: 'x.svg', dataUrl: 'data:image/svg+xml;base64,eA==' })).status, 400);
  const afterMedia = await (await post('/api/state')).json();
  assert.equal(afterMedia.media.name, 'tiny.png');
  assert.equal(afterMedia.settings.theme, 'frost');
  assert.equal((await post('/api/settings', { enabled: false })).status, 200);
  const saved = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
  assert.equal(saved.settings.enabled, false);
  assert.equal(saved.media.name, 'tiny.png');
  const second = await startServer({ preview: true, dataDir: dir });
  try {
    const restored = await (await fetch(`http://127.0.0.1:${second.port}/api/state`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agy-preview': '1' }, body: '{}' })).json();
    assert.equal(restored.settings.theme, 'frost');
    assert.equal(restored.media.dataUrl, png);
  } finally { await second.close(); }
  assert.equal((await post('/api/clear-media')).status, 200);
  assert.equal((await (await post('/api/state')).json()).media, null);
  assert.equal((await fetch(url + '/state.json')).status, 404);
  assert.equal((await fetch(url + '/..%2fstate.json')).status, 404);
});

test('library authentication, streaming ranges, hide/restore and persistence', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'agy-glass-library-api-'));
  const root = join(dir, 'projects');
  const folder = join(root, 'sample');
  await mkdir(folder, { recursive: true });
  const image = Buffer.from(png.split(',')[1], 'base64');
  await writeFile(join(folder, 'image.png'), image);
  await writeFile(join(folder, 'project.json'), JSON.stringify({ title: 'Library wallpaper', file: 'image.png', preview: 'image.png' }));
  let scans = 0;
  const library = createLibrary({ discover: async () => { scans++; return [{ path: root, source: 'Test' }]; } });
  const app = await startServer({ preview: true, dataDir: dir, library });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${app.port}`;
  const post = (path, data = {}, headers = {}) => fetch(url + '/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agy-preview': '1', ...headers }, body: JSON.stringify(data) });
  for (const path of ['library/scan', 'library/thumbnail', 'library/select', 'library/hide']) {
    assert.equal((await post(path, {}, { 'x-agy-preview': '0' })).status, 401);
    assert.equal((await post(path, {}, { origin: 'https://evil.invalid' })).status, 401);
  }
  assert.equal(scans, 0);
  assert.equal((await post('library/scan', { directory: '../outside' })).status, 400);
  assert.equal((await post('library/scan', { directories: Array(13).fill(dir) })).status, 400);
  assert.equal((await post('library/scan', null)).status, 400);
  const scan = await (await post('library/scan', { directories: [dir] })).json();
  const id = scan.items[0].id;
  assert.deepEqual(scan.hiddenIds, []);
  assert.equal((await (await post('state')).json()).settings.enabled, false);
  assert.deepEqual((await (await post('state')).json()).libraryDirectories, [dir]);
  assert.equal((await (await post('library/thumbnail', { id })).json()).dataUrl, png);
  assert.equal((await post('library/select', { id: 'unsupported' })).status, 400);
  assert.equal((await post('library/hide', { id, hidden: 'true' })).status, 400);
  assert.equal((await post('library/hide', { id: 'f'.repeat(64), hidden: true })).status, 400);
  assert.deepEqual((await (await post('library/hide', { id, hidden: true })).json()).hiddenIds, [id]);
  assert.deepEqual((await (await post('library/hide', { id, hidden: true })).json()).hiddenIds, [id]);
  const applied = await (await post('library/select', { id })).json();
  assert.equal(applied.settings.enabled, true);
  assert.equal(applied.librarySelection, id);
  assert.equal(applied.media.dataUrl, undefined);
  assert.equal(applied.media.name, 'Library wallpaper');
  assert.equal(applied.media.bytes, image.length);
  const mediaUrl = applied.media.url;
  assert.equal((await fetch(url + '/wallpaper/guess')).status, 404);
  assert.equal((await fetch(mediaUrl, { method: 'POST' })).status, 405);
  const rebinding = await new Promise((resolve, reject) => {
    const req = request(mediaUrl, { headers: { host: 'evil.invalid' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(rebinding, 404);
  const full = await fetch(mediaUrl);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), image);
  assert.equal((await fetch(mediaUrl, { method: 'HEAD' })).headers.get('content-length'), String(image.length));
  for (const [range, start, end] of [['bytes=0-7', 0, 7], ['bytes=8-', 8, image.length - 1], ['bytes=-4', image.length - 4, image.length - 1]]) {
    const response = await fetch(mediaUrl, { headers: { range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${image.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), image.subarray(start, end + 1));
  }
  for (const range of ['bytes=999-', 'bytes=-0', 'bytes=8-2', 'bytes=0-1,4-5', 'invalid', 'bytes=-']) {
    const response = await fetch(mediaUrl, { headers: { range } });
    assert.equal(response.status, 416, range);
    await response.arrayBuffer();
  }
  const stored = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
  assert.equal(stored.media, null);
  assert.equal(stored.libraryMedia.path, folder);
  assert.equal(JSON.stringify(stored).includes(mediaUrl), false);
  const second = await startServer({ preview: true, dataDir: dir, library });
  try {
    const state = await (await fetch(`http://127.0.0.1:${second.port}/api/state`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agy-preview': '1' }, body: '{}' })).json();
    assert.equal(state.librarySelection, id);
    assert.equal(state.libraryDirectory, dir);
    assert.deepEqual(state.hiddenIds, [id]);
    assert.equal(state.libraryMedia, undefined);
    assert.notEqual(state.media.url, mediaUrl);
    assert.deepEqual(Buffer.from(await (await fetch(state.media.url)).arrayBuffer()), image);
  } finally { await second.close(); }
  assert.deepEqual((await (await post('library/hide', { id, hidden: false })).json()).hiddenIds, []);
  assert.deepEqual(await readFile(join(folder, 'image.png')), image);
  await post('media', { name: 'manual.png', dataUrl: png });
  assert.equal((await fetch(mediaUrl)).status, 404);
  assert.equal((await (await post('state')).json()).librarySelection, null);
  const selectedAgain = await (await post('library/select', { id })).json();
  await writeFile(join(folder, 'image.png'), 'not an image');
  assert.equal((await fetch(selectedAgain.media.url)).status, 404);
  await post('clear-media');
  assert.equal((await (await post('state')).json()).librarySelection, null);
  assert.equal((await fetch(url + '/api/library/thumbnail')).status, 405);
});

test('disconnect during media opening closes the handle without creating a stream', { timeout: 5000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'agy-glass-cancel-'));
  const opening = Promise.withResolvers();
  const release = Promise.withResolvers();
  const closed = Promise.withResolvers();
  const disconnected = Promise.withResolvers();
  const emit = ServerResponse.prototype.emit;
  t.mock.method(ServerResponse.prototype, 'emit', function (event, ...args) {
    const result = emit.call(this, event, ...args);
    if (event === 'close' && this.req.url.startsWith('/wallpaper/')) disconnected.resolve();
    return result;
  });
  let streamsCreated = 0;
  const library = {
    select: async () => ({ reference: { root: dir, path: dir, file: 'image.png' }, name: 'Test', kind: 'image', bytes: 1 }),
    openMedia: async () => {
      opening.resolve();
      await release.promise;
      return { bytes: 1, mime: 'image/png', handle: {
        close: async () => closed.resolve(),
        createReadStream: () => { streamsCreated++; throw new Error('Disconnected response must not stream'); },
      } };
    },
  };
  const app = await startServer({ preview: true, dataDir: dir, library });
  t.after(async () => { release.resolve(); await app.close(); await rm(dir, { recursive: true, force: true }); });
  const response = await fetch(`http://127.0.0.1:${app.port}/api/library/select`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-agy-preview': '1' }, body: '{"id":"test"}',
  });
  const { media } = await response.json();
  const req = request(media.url);
  req.on('error', () => {});
  req.end();
  await opening.promise;
  req.destroy();
  await disconnected.promise;
  release.resolve();
  await closed.promise;
  assert.equal(streamsCreated, 0);
});

test('production mode refuses missing token; corrupted storage is not overwritten', async () => {
  await assert.rejects(startServer({ dataDir: 'unused', port: 12345 }), /插件面板/);
  const dir = await mkdtemp(join(tmpdir(), 'agy-glass-broken-'));
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'state.json'), 'not json');
    await assert.rejects(startServer({ preview: true, dataDir: dir }), /配置损坏/);
    assert.equal(await readFile(join(dir, 'state.json'), 'utf8'), 'not json');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('scene player, scoped asset streaming, .pkg import, folder import, playlists and scene properties', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'agy-glass-scene-api-'));
  const sceneDir = join(dir, 'my-scene');
  await mkdir(sceneDir, { recursive: true });
  const pkgBytes = Buffer.concat([Buffer.from([8, 0, 0, 0]), Buffer.from('PKGV0002', 'ascii'), Buffer.from([0, 0, 0, 0])]);
  const imageBytes = Buffer.from(png.split(',')[1], 'base64');
  await writeFile(join(sceneDir, 'scene.pkg'), pkgBytes);
  await writeFile(join(sceneDir, 'preview.png'), imageBytes);
  await writeFile(join(sceneDir, 'project.json'), JSON.stringify({
    title: 'Neon City Scene',
    type: 'scene',
    file: 'scene.pkg',
    preview: 'preview.png',
    general: { properties: { bloom: { type: 'bool', text: 'Bloom', value: true } } },
  }));
  const app = await startServer({ preview: true, dataDir: join(dir, 'state') });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${app.port}`;
  const post = (path, data = {}) => fetch(url + '/api/' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-agy-preview': '1' },
    body: JSON.stringify(data),
  });

  // Import local scene directory directly
  const imported = await (await post('library/import-directory', { directory: sceneDir })).json();
  assert.equal(imported.media.kind, 'scene');
  assert.match(imported.media.url, /\/player\/[a-f0-9-]+$/);
  assert.equal(imported.media.properties.length, 1);

  // Player HTML & vendored WebWallGL bundle
  const playerHtml = await (await fetch(imported.media.url)).text();
  assert.match(playerHtml, /webwallgl\.global\.min\.js/);
  assert.match(playerHtml, /data-kind="scene"/);
  assert.equal((await fetch(url + '/vendor/webwallgl.global.min.js')).status, 200);

  // Scoped scene asset streaming + traversal rejection
  const key = imported.media.url.split('/').pop();
  const servedPkg = await fetch(`${url}/scene/${key}/scene.pkg`);
  assert.equal(servedPkg.status, 200);
  assert.equal(servedPkg.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(Buffer.from(await servedPkg.arrayBuffer()), pkgBytes);
  assert.equal((await fetch(`${url}/scene/${key}/..%2fstate/state.json`)).status, 404);
  assert.equal((await fetch(`${url}/thumb/${key}`)).status, 200);

  // Scene properties update
  const propRes = await (await post('scene-properties', { id: imported.librarySelection, properties: { bloom: false } })).json();
  assert.equal(propRes.sceneProperties[imported.librarySelection].bloom, false);

  // Binary .pkg upload
  const pkgUpload = await fetch(url + '/api/import-pkg', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'x-agy-preview': '1', 'x-file-name': encodeURIComponent('demo-scene.pkg') },
    body: pkgBytes,
  });
  assert.equal(pkgUpload.status, 200);
  const uploaded = await pkgUpload.json();
  assert.equal(uploaded.media.kind, 'scene');
  assert.equal(uploaded.media.name, 'demo-scene');

  // Reject bogus .pkg upload
  const badPkg = await fetch(url + '/api/import-pkg', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'x-agy-preview': '1', 'x-file-name': 'fake.pkg' },
    body: Buffer.from('not a valid pkg file at all'),
  });
  assert.equal(badPkg.status, 400);
});

test('bundled builtin dynamic wallpapers scan, expose thumbnails/properties, and serve live', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'agy-glass-builtins-'));
  const app = await startServer({ preview: true, dataDir: dir });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${app.port}`;
  const post = (path, data = {}) => fetch(url + '/api/' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-agy-preview': '1' },
    body: JSON.stringify(data),
  });
  const scan = await (await post('library/scan', { directories: [] })).json();
  const builtins = scan.items.filter(i => i.builtin);
  assert.equal(builtins.length, 6);
  assert.ok(builtins.every(i => i.available && i.hasPreview && i.type === 'web' && i.properties.length === 2));
  const selected = await (await post('library/select', { id: builtins[0].id })).json();
  assert.equal(selected.media.kind, 'web');
  assert.match(selected.media.url, /\/player\/[a-f0-9-]+$/);
  const key = selected.media.url.split('/').pop();
  assert.equal((await fetch(selected.media.url)).status, 200);
  assert.equal((await fetch(`${url}/scene/${key}/index.html`)).status, 200);
  assert.equal((await fetch(`${url}/thumb/${key}`)).status, 200);
});

test('pet assets serve with CORS and ephemeral drawer key authenticates floating panel without exposing sidecar token', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'agy-glass-pet-'));
  let capturedPayload = null;
  const app = await startServer({
    preview: false,
    port: 47912,
    dataDir: dir,
    token: 'secret-sidecar-token',
    startBridge: ({ getPayload }) => {
      capturedPayload = getPayload();
      return { refresh: () => {}, stop: async () => {}, status: () => ({ code: 'waiting', windows: 0 }) };
    },
  });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${app.port}`;
  for (const p of ['/assets/pet-open.webp', '/assets/pet-wink.webp', '/assets/pet-tail.webp']) {
    const res = await fetch(url + p);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/webp');
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.ok((await res.arrayBuffer()).byteLength > 3000);
  }
  assert.ok(capturedPayload.drawerUrl.includes('?drawer='));
  assert.equal(capturedPayload.drawerUrl.includes('secret-sidecar-token'), false);
  const drawerKey = new URL(capturedPayload.drawerUrl).searchParams.get('drawer');
  const drawerHtml = await (await fetch(capturedPayload.drawerUrl)).text();
  assert.match(drawerHtml, /data-mode="drawer"/);
  const okRes = await fetch(url + '/api/state', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-drawer-key': drawerKey },
    body: '{}',
  });
  assert.equal(okRes.status, 200);
  const badRes = await fetch(url + '/api/state', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-drawer-key': 'wrong-key' },
    body: '{}',
  });
  assert.equal(badRes.status, 401);
});
