import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, open, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLibrary, discoverLibraryRoots, validateLibraryDirectory, validateLibraryDirectories } from '../sidecars/glass/library.mjs';
import { MAX_MEDIA_BYTES } from '../sidecars/glass/config.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=', 'base64');
const mp4 = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0]);
const pkg = Buffer.concat([Buffer.from([8, 0, 0, 0]), Buffer.from('PKGV0002', 'ascii'), Buffer.from([0, 0, 0, 0])]);
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'agy-library-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, 'projects');
  await mkdir(root);
  const library = createLibrary({ discover: async () => [{ path: root, source: 'Test' }] });
  const project = async (id, data, files = {}) => {
    const folder = join(root, id);
    await mkdir(folder);
    await writeFile(join(folder, 'project.json'), JSON.stringify(data));
    for (const [name, bytes] of Object.entries(files)) await writeFile(join(folder, name), bytes);
    return folder;
  };
  return { dir, root, library, project };
}

test('directory input rejects relative, remote and malformed paths', () => {
  assert.equal(validateLibraryDirectory(''), '');
  assert.ok(validateLibraryDirectory(tmpdir()));
  for (const value of [null, {}, '../outside', '\\\\server\\share', '//server/share', 'C:relative', 'x'.repeat(513), 'bad\0path']) {
    assert.throws(() => validateLibraryDirectory(value));
  }
});

test('scan, thumbnails, stable IDs and selection use local project metadata', async t => {
  const { root, library, project } = await fixture(t);
  await project('image', { title: '<script>plain title</script>', file: 'image.png', preview: 'preview.png' }, { 'image.png': png, 'preview.png': png });
  await project('movie', { title: 'Movie', type: 'VIDEO', file: 'movie.mp4' }, { 'movie.mp4': mp4 });
  const scene = await project('scene', {
    title: 'Scene', type: 'scene', file: 'scene.json', preview: 'preview.png',
    general: { properties: { bloom: { type: 'bool', text: '辉光', value: true }, speed: { type: 'slider', text: '速度', value: 1, min: 0, max: 3 } } },
  }, { 'scene.pkg': pkg, 'preview.png': png });
  await project('web', { title: 'Web', type: 'web', file: 'index.html' }, { 'index.html': '<!doctype html><html><body>ok</body></html>' });
  await project('app', { title: 'App', file: 'wallpaper.exe' });
  const result = await library.scan();
  assert.equal(result.items.length, 5);
  assert.equal(result.items.filter(i => i.available).length, 4);
  assert.deepEqual(new Set(result.items.map(i => i.type)), new Set(['image', 'video', 'scene', 'web', 'application']));
  const image = result.items.find(i => i.type === 'image');
  assert.match(image.id, /^[a-f0-9]{64}$/);
  assert.equal(image.hasPreview, true);
  assert.equal(image.bytes, png.length);
  assert.equal((await library.thumbnail(image.id)).dataUrl, `data:image/png;base64,${png.toString('base64')}`);
  assert.equal(image.title, '<script>plain title</script>');
  const selected = await library.select(image.id);
  assert.equal(selected.name, image.title);
  assert.equal(selected.dataUrl, undefined);
  const opened = await library.openMedia(selected.reference);
  assert.equal(opened.bytes, png.length);
  assert.deepEqual(await opened.handle.readFile(), png);
  await opened.handle.close();
  assert.equal((await library.scan()).items.find(i => i.type === 'image').id, image.id);
  const movie = result.items.find(i => i.type === 'video');
  assert.equal((await library.select(movie.id)).kind, 'video');
  assert.deepEqual(await library.thumbnail(movie.id), { dataUrl: null });
  const sceneItem = result.items.find(i => i.type === 'scene');
  assert.equal(sceneItem.available, true);
  assert.equal(sceneItem.properties.length, 2);
  const selectedScene = await library.select(sceneItem.id);
  assert.equal(selectedScene.kind, 'scene');
  assert.equal(selectedScene.reference.file, 'scene.pkg');
  const pkgAsset = await library.openAsset(selectedScene.reference, 'scene.pkg');
  assert.deepEqual(await pkgAsset.handle.readFile(), pkg);
  await pkgAsset.handle.close();
  await assert.rejects(library.openAsset(selectedScene.reference, '../outside.png'));
  await assert.rejects(library.openAsset(selectedScene.reference, 'malware.exe'), /可执行/);
  const webItem = result.items.find(i => i.type === 'web');
  assert.equal((await library.select(webItem.id)).kind, 'web');
  await assert.rejects(library.select(result.items.find(i => i.type === 'application').id), /应用/);
  await assert.rejects(library.select('not-an-id'), /重新扫描/);
  assert.ok((await discoverLibraryRoots(root)).some(s => s.path === root));
  assert.ok((await discoverLibraryRoots(scene)).some(s => s.path === scene));
});

test('unsafe paths, SVG and missing files fail while large local media streams', async t => {
  const { dir, library, project } = await fixture(t);
  await writeFile(join(dir, 'outside.png'), png);
  await project('traversal', { title: 'Traversal', file: '../../outside.png', preview: '../../outside.png' });
  await project('absolute', { title: 'Absolute', file: join(dir, 'outside.png') });
  await project('svg', { title: 'SVG', type: 'image', file: 'x.svg', preview: 'x.svg' }, { 'x.svg': '<svg onload="alert(1)"/>' });
  await project('missing', { title: 'Missing', file: 'missing.png' });
  await project('spoofed', { title: 'Spoofed', file: 'fake.png' }, { 'fake.png': 'not an image' });
  const large = await project('large', { title: 'Large', file: 'large.mp4' });
  const handle = await open(join(large, 'large.mp4'), 'w');
  await handle.write(mp4);
  await handle.truncate(MAX_MEDIA_BYTES + 1);
  await handle.close();
  const result = await library.scan();
  assert.equal(result.items.length, 6);
  assert.equal(result.items.filter(i => i.available).length, 1);
  const largeItem = result.items.find(i => i.title === 'Large');
  assert.equal(largeItem.available, true);
  assert.equal(largeItem.bytes, MAX_MEDIA_BYTES + 1);
  const selected = await library.select(largeItem.id);
  assert.equal(selected.bytes, MAX_MEDIA_BYTES + 1);
  assert.equal(selected.dataUrl, undefined);
  const opened = await library.openMedia(selected.reference);
  const prefix = Buffer.alloc(16);
  await opened.handle.read(prefix, 0, 16, 0);
  assert.deepEqual(prefix, mp4);
  await opened.handle.close();
  for (const item of result.items.filter(i => !i.available)) {
    await assert.rejects(library.select(item.id));
    assert.deepEqual(await library.thumbnail(item.id), { dataUrl: null });
  }
});

test('selection revalidates media and project metadata after scanning', async t => {
  const { library, project } = await fixture(t);
  const folder = await project('changing', { title: 'Changing', file: 'image.png' }, { 'image.png': png });
  const [{ id }] = (await library.scan()).items;
  await writeFile(join(folder, 'image.png'), 'changed');
  await assert.rejects(library.select(id), /内容/);
  await writeFile(join(folder, 'image.png'), png);
  await writeFile(join(folder, 'project.json'), JSON.stringify({ type: 'web', file: 'image.png' }));
  await assert.rejects(library.select(id), /网页/);
  await writeFile(join(folder, 'project.json'), '{'.repeat(128 * 1024 + 1));
  const [item] = (await library.scan()).items;
  assert.equal(item.available, false);
  assert.match(item.reason, /大小上限/);
});

test('symlinked media outside a project is rejected', async t => {
  const { dir, library, project } = await fixture(t);
  const outside = join(dir, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'image.png'), png);
  const folder = await project('linked', { title: 'Linked', file: 'linked/image.png', preview: 'linked/image.png' });
  try { await symlink(outside, join(folder, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('OS does not permit creating test symlinks'); return; } throw error; }
  const [item] = (await library.scan()).items;
  assert.equal(item.available, false);
  assert.equal(item.hasPreview, false);
  await assert.rejects(library.select(item.id));
});

test('overlapping scans are rejected and failed scans preserve the last catalog', async t => {
  const { root, project } = await fixture(t);
  await project('image', { file: 'image.png' }, { 'image.png': png });
  let release;
  let blocked = false;
  let fail = false;
  const library = createLibrary({ discover: async () => {
    if (blocked) await new Promise(resolve => { release = resolve; });
    if (fail) throw Error('private operating-system details');
    return [{ path: root }];
  } });
  const [item] = (await library.scan()).items;
  blocked = true;
  const pending = library.scan();
  await assert.rejects(library.scan(), /正在扫描/);
  release();
  await pending;
  blocked = false;
  fail = true;
  await assert.rejects(library.scan(), error => !error.message.includes('private'));
  assert.equal((await library.select(item.id)).kind, 'image');
});

test('multiple custom roots append to Steam VDF libraries and deduplicate', async t => {
  const { dir, root, project } = await fixture(t);
  await project('custom', { file: 'image.png' }, { 'image.png': png });
  const steam = join(dir, 'Steam');
  const extra = join(dir, 'Other library');
  const workshop = join(extra, 'steamapps', 'workshop', 'content', '431960');
  await mkdir(join(steam, 'steamapps'), { recursive: true });
  await mkdir(workshop, { recursive: true });
  await writeFile(join(steam, 'steamapps', 'libraryfolders.vdf'), `"libraryfolders" { "0" { "path" ${JSON.stringify(extra)} "apps" { } } }`);
  const env = { AGY_GLASS_STEAM_ROOT: steam };
  const roots = await discoverLibraryRoots([root, root], { env });
  assert.equal(roots.filter(r => r.path === root).length, 1);
  assert.ok(roots.some(r => r.path === workshop));
  assert.deepEqual(validateLibraryDirectories(['', root, root]), [root]);
  assert.throws(() => validateLibraryDirectories(Array(13).fill(root)), /12/);
  assert.throws(() => validateLibraryDirectories([root, '../bad']));
  const library = createLibrary({ discover: directories => discoverLibraryRoots(directories, { env }) });
  const result = await library.scan([root]);
  assert.equal(result.items.find(i => i.title === 'custom').source, '手动目录');
});

test('stream references cannot escape projects or silently follow changed entrypoints', async t => {
  const { dir, library, project } = await fixture(t);
  const folder = await project('selected', { file: 'image.png' }, { 'image.png': png });
  const [{ id }] = (await library.scan()).items;
  const { reference } = await library.select(id);
  await assert.rejects(library.openMedia({ ...reference, file: '../outside.png' }));
  await assert.rejects(library.openMedia({ ...reference, path: dir }));
  await writeFile(join(folder, 'project.json'), JSON.stringify({ file: 'other.png' }));
  await assert.rejects(library.openMedia(reference), /入口已更改/);
});

test('discovers Steam Workshop libraries from config/libraryfolders.vdf as well', async t => {
  const { dir } = await fixture(t);
  const steam = join(dir, 'SteamConfigOnly');
  const gameDrive = join(dir, 'GameDrive');
  const workshop = join(gameDrive, 'steamapps', 'workshop', 'content', '431960');
  await mkdir(join(steam, 'config'), { recursive: true });
  await mkdir(workshop, { recursive: true });
  await writeFile(join(steam, 'config', 'libraryfolders.vdf'), `"libraryfolders" { "1" { "path" ${JSON.stringify(gameDrive)} } }`);
  const roots = await discoverLibraryRoots([], { env: { AGY_GLASS_STEAM_ROOT: steam } });
  assert.ok(roots.some(r => r.path === workshop));
});
