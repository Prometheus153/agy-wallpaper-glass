import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, opendir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { MAX_MEDIA_BYTES, isValidPkgHeader, validateMedia } from './config.mjs';

const JSON_LIMIT = 128 * 1024;
const PREVIEW_LIMIT = 4 * 1024 * 1024;
const VDF_LIMIT = 1024 * 1024;
const PROJECT_LIMIT = 2000;
const windows = process.platform === 'win32';

const mediaMimeTypes = new Map([
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'],
  ['.webp', 'image/webp'], ['.gif', 'image/gif'],
  ['.mp4', 'video/mp4'], ['.webm', 'video/webm'],
]);

const assetMimeTypes = new Map([
  ...mediaMimeTypes,
  ['.bmp', 'image/bmp'], ['.ico', 'image/x-icon'], ['.svg', 'image/svg+xml'],
  ['.json', 'application/json; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'], ['.htm', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'], ['.xml', 'application/xml; charset=utf-8'],
  ['.glsl', 'text/plain; charset=utf-8'], ['.vert', 'text/plain; charset=utf-8'], ['.frag', 'text/plain; charset=utf-8'],
  ['.mp3', 'audio/mpeg'], ['.ogg', 'audio/ogg'], ['.wav', 'audio/wav'], ['.flac', 'audio/flac'], ['.m4a', 'audio/mp4'],
  ['.woff', 'font/woff'], ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf'], ['.otf', 'font/otf'],
  ['.wasm', 'application/wasm'],
  ['.pkg', 'application/octet-stream'], ['.tex', 'application/octet-stream'], ['.mdl', 'application/octet-stream'],
]);

const unsupported = {
  application: '出于安全考虑，不支持运行应用壁纸（Application）',
  unknown: '暂不支持此壁纸类型',
};

class LibraryError extends Error {
  constructor(message, bytes = null) {
    super(message);
    this.bytes = bytes;
  }
}

function publicError(error) {
  return error instanceof LibraryError ? error : new LibraryError('无法读取壁纸库，请检查目录和访问权限');
}

export function validateLibraryDirectory(value) {
  if (typeof value !== 'string' || value.length > 512 || /[\x00-\x1f\x7f]/.test(value)) {
    throw new LibraryError('壁纸库目录无效：请输入不超过 512 字符的本机绝对目录');
  }
  const directory = value.trim();
  if (!directory) return '';
  if (/^[\\/]{2}/.test(directory) || (windows
    ? !/^[a-z]:[\\/]/i.test(directory) || /[<>:"|?*]/.test(directory.slice(2))
    : !path.posix.isAbsolute(directory) || directory.includes('\\'))) {
    throw new LibraryError('壁纸库目录必须是本机绝对目录，不支持网络路径');
  }
  return path.normalize(directory);
}

const keyFor = value => windows ? value.toLowerCase() : value;
const samePath = (a, b) => keyFor(a) === keyFor(b);
function contained(root, target) {
  const relative = path.relative(keyFor(root), keyFor(target));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function canonicalDirectory(value) {
  const directory = validateLibraryDirectory(value);
  if (!directory) throw new LibraryError('壁纸库目录不存在或不是目录');
  try {
    const canonical = validateLibraryDirectory(await realpath(directory));
    if (!(await stat(canonical)).isDirectory()) throw new LibraryError('壁纸库目录不存在或不是目录');
    return canonical;
  } catch (error) {
    if (error instanceof LibraryError) throw error;
    throw new LibraryError('壁纸库目录不存在或无法访问');
  }
}

export function relativeFile(value) {
  if (typeof value !== 'string' || !value || value.length > 512 ||
      /^[\\/]/.test(value) || /[<>:"|?*\x00-\x1f\x7f]/.test(value)) {
    throw new LibraryError('文件路径无效或不安全');
  }
  const parts = value.split(/[\\/]/).filter(part => part !== '' && part !== '.');
  if (parts.length === 0) throw new LibraryError('文件路径无效或不安全');
  if (parts.some(part => part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new LibraryError('文件路径无效或不安全');
  }
  return parts.join(path.sep);
}

async function checkEntry(entry) {
  const root = await canonicalDirectory(entry.root);
  const project = await canonicalDirectory(entry.path);
  if (!samePath(root, entry.root) || !samePath(project, entry.path) || !contained(root, project)) {
    throw new LibraryError('项目目录不安全，请重新扫描');
  }
}

function tooLarge(limit, bytes) {
  return new LibraryError(limit === MAX_MEDIA_BYTES ? '媒体文件超过 32 MiB 上限' : '文件超过允许大小上限', bytes);
}

async function openChecked(file, limit, check) {
  let handle;
  try {
    await check();
    const before = await lstat(file);
    if (!before.isFile()) throw new LibraryError('文件不是普通文件');
    if (before.size > limit) throw tooLarge(limit, before.size);
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
    const info = await handle.stat();
    if (!info.isFile()) throw new LibraryError('文件不是普通文件');
    if (info.size > limit) throw tooLarge(limit, info.size);
    if (info.dev !== before.dev || info.ino !== before.ino) throw new LibraryError('文件已更改，请重新扫描');
    await check();
    return { handle, info };
  } catch (error) {
    await handle?.close().catch(() => {});
    throw publicError(error);
  }
}

// Read at most the cap plus one byte, even if a file grows after stat.
async function readBounded(file, limit, prefixBytes, check) {
  let handle;
  try {
    const opened = await openChecked(file, limit, check);
    handle = opened.handle;
    const info = opened.info;
    const buffer = Buffer.alloc(prefixBytes || Math.min(info.size + 1, limit + 1));
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await handle.stat();
    if (after.size > limit || length > limit) throw tooLarge(limit, after.size);
    if (after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs ||
        length !== (prefixBytes ? Math.min(prefixBytes, info.size) : info.size)) {
      throw new LibraryError('文件已更改，请重新扫描');
    }
    await check();
    return { buffer: buffer.subarray(0, length), bytes: info.size };
  } catch (error) {
    if (error instanceof LibraryError) throw error;
    throw new LibraryError('文件不存在或无法读取');
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

async function resolveInside(entry, name, mime = '') {
  const relative = relativeFile(name);
  await checkEntry(entry);
  const requested = path.resolve(entry.path, relative);
  let file;
  try { file = validateLibraryDirectory(await realpath(requested)); }
  catch (error) { throw error instanceof LibraryError ? error : new LibraryError('文件不存在或无法读取'); }
  const check = async () => {
    await checkEntry(entry);
    if (!contained(entry.path, file) || !samePath(await realpath(requested), file) || !samePath(await realpath(file), file)) {
      throw new LibraryError('文件路径无效或不安全');
    }
    if (mime && mediaMimeTypes.get(path.extname(file).toLowerCase()) !== mime) {
      throw new LibraryError('文件格式不安全或不受支持');
    }
  };
  return { file, check };
}

async function readInside(entry, name, limit, prefixBytes = 0, mime = '') {
  const { file, check } = await resolveInside(entry, name, mime);
  return readBounded(file, limit, prefixBytes, check);
}

async function existsProject(directory) {
  try { await lstat(path.join(directory, 'project.json')); return true; }
  catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false;
    throw new LibraryError('无法访问项目描述文件');
  }
}

async function optionalDirectory(directory) {
  try { return await canonicalDirectory(directory); }
  catch { return null; }
}

async function queryRegistryValue(key, valueName) {
  if (!windows) return '';
  try {
    const { stdout } = await promisify(execFile)(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe'),
      ['query', key, '/v', valueName],
      { timeout: 2000, maxBuffer: 64 * 1024, windowsHide: true, shell: false });
    const re = new RegExp(`\\b${valueName}\\s+REG_\\w+\\s+([^\\r\\n]+)`, 'i');
    return re.exec(stdout)?.[1].trim() || '';
  } catch { return ''; }
}

async function registrySteamPaths() {
  if (!windows) return [];
  const results = await Promise.all([
    queryRegistryValue('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
    queryRegistryValue('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    queryRegistryValue('HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'),
  ]);
  return results.filter(Boolean);
}

async function registryWallpaperEnginePath() {
  if (!windows) return '';
  const raw = await queryRegistryValue('HKCU\\Software\\WallpaperEngine', 'installDirectory');
  if (!raw) return '';
  return /\.exe$/i.test(raw) ? path.dirname(raw) : raw;
}

async function libraryFolders(directory) {
  const paths = [];
  for (const vdfFile of ['steamapps/libraryfolders.vdf', 'config/libraryfolders.vdf']) {
    try {
      const { buffer } = await readInside({ root: directory, path: directory }, vdfFile, VDF_LIMIT);
      const tokens = buffer.toString('utf8').match(/\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|[{}]/g) || [];
      for (let i = 0; i + 1 < tokens.length; i++) {
        if (tokens[i].toLowerCase() === '"path"' && tokens[i + 1].startsWith('"')) {
          const value = tokens[++i].slice(1, -1).replace(/\\([\\"])/g, '$1');
          try { if (validateLibraryDirectory(value)) paths.push(value); } catch { /* Ignore remote or malformed entries. */ }
        }
      }
    } catch { /* VDF file may not exist in this location. */ }
  }
  return paths;
}

export function validateLibraryDirectories(value) {
  const values = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(values) || values.length > 12) throw new LibraryError('最多添加 12 个本机壁纸目录');
  const unique = new Map();
  for (const item of values) {
    const directory = validateLibraryDirectory(item);
    if (directory) unique.set(keyFor(directory), directory);
  }
  return [...unique.values()];
}

export async function discoverLibraryRoots(directory = '', { env = process.env } = {}) {
  const directories = validateLibraryDirectories(directory);
  const roots = new Map();
  const add = async (candidate, source) => {
    const canonical = await optionalDirectory(candidate);
    if (canonical && !roots.has(keyFor(canonical))) roots.set(keyFor(canonical), { path: canonical, source });
  };
  const addInstallation = async installation => {
    for (const suffix of ['projects/defaultprojects', 'projects/myprojects', 'projects']) {
      await add(path.join(installation, suffix), 'Wallpaper Engine');
    }
  };
  const steamCandidates = windows
    ? [...(await registrySteamPaths()),
      path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
      path.join(env.ProgramFiles || 'C:\\Program Files', 'Steam'),
      ...'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').flatMap(drive => [`${drive}:\\Steam`, `${drive}:\\SteamLibrary`])]
    : process.platform === 'darwin'
      ? [path.join(homedir(), 'Library/Application Support/Steam')]
      : ['.steam/steam', '.local/share/Steam', '.var/app/com.valvesoftware.Steam/data/Steam'].map(suffix => path.join(homedir(), suffix));
  const regWe = await registryWallpaperEnginePath();
  if (regWe) {
    await addInstallation(regWe);
    const maybeCommon = path.dirname(regWe);
    const maybeSteamapps = path.dirname(maybeCommon);
    if (path.basename(maybeSteamapps).toLowerCase() === 'steamapps') {
      steamCandidates.push(path.dirname(maybeSteamapps));
    }
  }
  for (const value of (env.AGY_GLASS_STEAM_ROOT || '').split(/[;\r\n]/)) {
    try { if (validateLibraryDirectory(value)) steamCandidates.push(value); } catch {}
  }
  for (const dir of directories) {
    const manual = await canonicalDirectory(dir);
    if (await existsProject(manual)) await add(manual, '手动目录');
    else if (await optionalDirectory(path.join(manual, 'steamapps'))) steamCandidates.push(manual);
    else if (await optionalDirectory(path.join(manual, 'projects'))) await addInstallation(manual);
    else {
      await add(manual, '手动目录');
      for (const suffix of ['defaultprojects', 'myprojects']) await add(path.join(manual, suffix), 'Wallpaper Engine');
    }
  }
  const libraries = new Map();
  for (const candidate of steamCandidates) {
    const steam = await optionalDirectory(candidate);
    if (!steam || libraries.has(keyFor(steam))) continue;
    libraries.set(keyFor(steam), steam);
    for (const extra of await libraryFolders(steam)) {
      const canonical = await optionalDirectory(extra);
      if (canonical) libraries.set(keyFor(canonical), canonical);
    }
  }
  for (const library of libraries.values()) {
    await add(path.join(library, 'steamapps/workshop/content/431960'), 'Steam Workshop');
    await addInstallation(path.join(library, 'steamapps/common/wallpaper_engine'));
  }
  return [...roots.values()];
}

async function readProject(entry) {
  const { buffer } = await readInside(entry, 'project.json', JSON_LIMIT);
  try {
    const project = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
    if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error();
    return project;
  } catch { throw new LibraryError('项目描述文件无效'); }
}

function projectType(project) {
  const extension = typeof project.file === 'string' ? path.posix.extname(project.file.replace(/\\/g, '/')).toLowerCase() : '';
  if (extension === '.exe') return 'application';
  if (project.type == null || project.type === '') {
    return mediaMimeTypes.get(extension)?.split('/')[0] || ({ '.json': 'scene', '.pkg': 'scene', '.html': 'web', '.htm': 'web' })[extension] || 'unknown';
  }
  const type = typeof project.type === 'string' ? project.type.trim().toLowerCase() : '';
  return ['image', 'video', 'scene', 'web', 'application'].includes(type) ? type : 'unknown';
}

function projectTitle(project, entry) {
  return (typeof project.title === 'string' ? project.title.replace(/[\x00-\x1f\x7f]/g, '').trim() : '').slice(0, 180) || path.basename(entry.path).slice(0, 180) || 'wallpaper';
}

export function extractProjectProperties(project) {
  const raw = project?.general?.properties;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const list = [];
  for (const [key, spec] of Object.entries(raw)) {
    if (list.length >= 48) break;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype' || key.length > 100) continue;
    const type = typeof spec.type === 'string' ? spec.type.trim().toLowerCase() : '';
    if (!['bool', 'slider', 'combo', 'color', 'textinput'].includes(type)) continue;
    const text = (typeof spec.text === 'string' ? spec.text.replace(/<[^>]*>/g, '').replace(/[\x00-\x1f\x7f]/g, '').trim() : key).slice(0, 80) || key;
    const order = Number.isFinite(Number(spec.order)) ? Number(spec.order) : list.length + 1000;
    const entry = { key, text, type, order };
    if (type === 'bool') {
      entry.value = Boolean(spec.value);
    } else if (type === 'slider') {
      const min = Number.isFinite(Number(spec.min)) ? Number(spec.min) : 0;
      const max = Number.isFinite(Number(spec.max)) ? Number(spec.max) : 100;
      const step = Number.isFinite(Number(spec.step)) && Number(spec.step) > 0 ? Number(spec.step) : (max - min <= 5 ? 0.1 : 1);
      const val = Number.isFinite(Number(spec.value)) ? Number(spec.value) : min;
      entry.min = min;
      entry.max = max > min ? max : min + 1;
      entry.step = step;
      entry.value = Math.min(entry.max, Math.max(entry.min, val));
    } else if (type === 'color') {
      entry.value = typeof spec.value === 'string' ? spec.value.trim().slice(0, 64) : '1 1 1';
    } else if (type === 'combo') {
      const options = Array.isArray(spec.options)
        ? spec.options.slice(0, 40).filter(o => o && typeof o === 'object' && o.value != null).map(o => ({
            label: String(o.label ?? o.value).replace(/<[^>]*>/g, '').trim().slice(0, 60),
            value: String(o.value).slice(0, 60),
          }))
        : [];
      if (!options.length) continue;
      entry.options = options;
      entry.value = spec.value != null ? String(spec.value).slice(0, 60) : options[0].value;
    } else if (type === 'textinput') {
      entry.value = typeof spec.value === 'string' ? spec.value.slice(0, 200) : '';
    }
    list.push(entry);
  }
  list.sort((a, b) => a.order - b.order);
  return list.map(({ order, ...rest }) => rest);
}

async function loadMedia(entry, file, name, limit, prefixOnly = false) {
  const relative = relativeFile(file);
  const mime = mediaMimeTypes.get(path.extname(relative).toLowerCase());
  if (!mime || (limit === PREVIEW_LIMIT && !mime.startsWith('image/'))) throw new LibraryError('文件格式不受支持');
  const { buffer, bytes } = await readInside(entry, relative, limit, prefixOnly ? 16 : 0, mime);
  try {
    const media = validateMedia({ name, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` });
    return { ...media, bytes };
  } catch { throw new LibraryError('文件内容与扩展类型不匹配', bytes); }
}

export function validateLibraryReference(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LibraryError('壁纸引用无效');
  const root = validateLibraryDirectory(value.root);
  const directory = validateLibraryDirectory(value.path);
  if (!root || !directory || !contained(root, directory)) throw new LibraryError('壁纸引用无效');
  const file = relativeFile(value.file);
  const kind = value.kind && ['image', 'video', 'scene', 'web'].includes(value.kind) ? value.kind : undefined;
  return kind ? { root, path: directory, file, kind } : { root, path: directory, file };
}

async function resolveSceneEntry(entry, project) {
  const declared = typeof project.file === 'string' && project.file.trim() ? relativeFile(project.file) : '';
  const ext = declared ? path.extname(declared).toLowerCase() : '';
  if (declared && ext !== '.pkg' && ext !== '.json') {
    throw new LibraryError('场景壁纸入口文件格式不受支持');
  }
  const candidates = [];
  if (declared) candidates.push(declared);
  // Real-world Wallpaper Engine projects often declare file:"scene.json" while shipping packed scene.pkg on disk.
  if (!declared || ext === '.json') {
    if (!candidates.some(c => c.toLowerCase() === 'scene.pkg')) candidates.push('scene.pkg');
  }
  let lastError = new LibraryError('场景文件缺失或无法读取');
  for (const candidate of candidates) {
    try {
      const { file, check } = await resolveInside(entry, candidate);
      const { handle, info } = await openChecked(file, Number.MAX_SAFE_INTEGER, check);
      try {
        const candidateExt = path.extname(candidate).toLowerCase();
        if (candidateExt === '.pkg') {
          const header = Buffer.alloc(24);
          const { bytesRead } = await handle.read(header, 0, header.length, 0);
          if (!isValidPkgHeader(header.subarray(0, bytesRead))) {
            throw new LibraryError('scene.pkg 文件头无效或已损坏', info.size);
          }
        } else {
          // Verify scene.json starts with JSON object whitespace / '{'
          const probe = Buffer.alloc(64);
          const { bytesRead } = await handle.read(probe, 0, probe.length, 0);
          const head = probe.subarray(0, bytesRead).toString('utf8').replace(/^\uFEFF/, '').trimStart();
          if (!head.startsWith('{')) throw new LibraryError('场景描述 JSON 无效', info.size);
        }
        const after = await handle.stat();
        if (after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs) {
          throw new LibraryError('文件已更改，请重新扫描');
        }
        await check();
        return {
          handle,
          mime: candidateExt === '.pkg' ? 'application/octet-stream' : 'application/json; charset=utf-8',
          name: projectTitle(project, entry),
          kind: 'scene',
          bytes: info.size,
          previewFile: typeof project.preview === 'string' ? project.preview : '',
          properties: extractProjectProperties(project),
          reference: { root: entry.root, path: entry.path, file: candidate, kind: 'scene' },
        };
      } catch (error) {
        await handle.close().catch(() => {});
        throw publicError(error);
      }
    } catch (error) {
      lastError = publicError(error);
    }
  }
  throw lastError;
}

async function resolveWebEntry(entry, project) {
  const relative = relativeFile(typeof project.file === 'string' && project.file.trim() ? project.file : 'index.html');
  const ext = path.extname(relative).toLowerCase();
  if (ext !== '.html' && ext !== '.htm') throw new LibraryError('网页壁纸入口必须是 HTML 文件');
  const { file, check } = await resolveInside(entry, relative);
  const { handle, info } = await openChecked(file, Number.MAX_SAFE_INTEGER, check);
  try {
    const after = await handle.stat();
    if (after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs) {
      throw new LibraryError('文件已更改，请重新扫描');
    }
    await check();
    return {
      handle,
      mime: 'text/html; charset=utf-8',
      name: projectTitle(project, entry),
      kind: 'web',
      bytes: info.size,
      previewFile: typeof project.preview === 'string' ? project.preview : '',
      properties: extractProjectProperties(project),
      reference: { root: entry.root, path: entry.path, file: relative, kind: 'web' },
    };
  } catch (error) {
    await handle.close().catch(() => {});
    throw publicError(error);
  }
}

async function openProjectMedia(entry, project) {
  const type = projectType(project);
  if (type === 'scene') return resolveSceneEntry(entry, project);
  if (type === 'web') return resolveWebEntry(entry, project);
  if (type !== 'image' && type !== 'video') throw new LibraryError(unsupported[type] || unsupported.unknown);
  if (!project.file) throw new LibraryError('项目未指定媒体文件');
  const relative = relativeFile(project.file);
  const mime = mediaMimeTypes.get(path.extname(relative).toLowerCase());
  if (!mime || !mime.startsWith(`${type}/`)) throw new LibraryError('壁纸类型与媒体格式不匹配或不受支持');
  const { file, check } = await resolveInside(entry, relative, mime);
  const { handle, info } = await openChecked(file, Number.MAX_SAFE_INTEGER, check);
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    try { validateMedia({ name: 'wallpaper', dataUrl: `data:${mime};base64,${buffer.subarray(0, bytesRead).toString('base64')}` }); }
    catch { throw new LibraryError('文件内容与扩展类型不匹配', info.size); }
    const after = await handle.stat();
    if (after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs) {
      throw new LibraryError('文件已更改，请重新扫描');
    }
    await check();
    return {
      handle,
      mime,
      name: projectTitle(project, entry),
      kind: type,
      bytes: info.size,
      previewFile: typeof project.preview === 'string' ? project.preview : '',
      properties: [],
      reference: { root: entry.root, path: entry.path, file: relative, kind: type },
    };
  } catch (error) {
    await handle.close().catch(() => {});
    throw publicError(error);
  }
}

async function projectMedia(entry, project) {
  const { handle, ...media } = await openProjectMedia(entry, project);
  await handle.close();
  return media;
}

async function openMedia(reference) {
  const entry = validateLibraryReference(reference);
  const project = await readProject(entry);
  const type = projectType(project);
  const declared = typeof project.file === 'string' && project.file.trim() ? relativeFile(project.file) : (type === 'web' ? 'index.html' : '');
  const scenePkgFallback = type === 'scene' && entry.file.toLowerCase() === 'scene.pkg' && (!declared || path.extname(declared).toLowerCase() === '.json');
  if (!scenePkgFallback && declared !== entry.file) throw new LibraryError('壁纸入口已更改，请重新选择');
  const opened = await openProjectMedia(entry, project);
  if (opened.reference.file !== entry.file) {
    await opened.handle.close().catch(() => {});
    throw new LibraryError('壁纸入口已更改，请重新选择');
  }
  return opened;
}

async function openAsset(reference, assetPath) {
  const entry = validateLibraryReference(reference);
  const relative = relativeFile(assetPath);
  const ext = path.extname(relative).toLowerCase();
  // Never serve executable binaries from project directories
  if (['.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.msi', '.com', '.scr'].includes(ext)) {
    throw new LibraryError('不允许读取可执行文件');
  }
  const { file, check } = await resolveInside(entry, relative);
  const { handle, info } = await openChecked(file, Number.MAX_SAFE_INTEGER, check);
  const mime = assetMimeTypes.get(ext) || 'application/octet-stream';
  return { handle, bytes: info.size, mime };
}

async function readPreviewForReference(reference) {
  const entry = validateLibraryReference(reference);
  const project = await readProject(entry);
  const target = project.preview || (projectType(project) === 'image' ? project.file : '');
  if (!target) return null;
  const { dataUrl } = await loadMedia(entry, target, 'preview', PREVIEW_LIMIT);
  return dataUrl;
}

async function scanProject(entry, id) {
  let project;
  const item = {
    id,
    title: projectTitle({}, entry),
    source: entry.source,
    builtin: entry.source === '内置壁纸',
    type: 'unknown',
    bytes: null,
    available: false,
    reason: '',
    hasPreview: false,
    properties: [],
  };
  try {
    project = await readProject(entry);
    item.title = projectTitle(project, entry);
    item.type = projectType(project);
  } catch (error) {
    item.reason = publicError(error).message;
    return item;
  }
  try {
    const resolved = await projectMedia(entry, project);
    item.bytes = resolved.bytes;
    item.properties = resolved.properties || [];
    item.available = true;
  } catch (error) {
    const safe = publicError(error);
    item.reason = safe.message;
    item.bytes = safe.bytes;
  }
  const previewTarget = project.preview || (item.type === 'image' && item.available ? project.file : '');
  if (previewTarget) {
    try {
      await loadMedia(entry, previewTarget, 'preview', PREVIEW_LIMIT, true);
      item.hasPreview = true;
    } catch { /* Missing and invalid previews are not exposed. */ }
  }
  return item;
}

export function createLibrary({ discover = discoverLibraryRoots, builtinsDir = '' } = {}) {
  let snapshot = new Map();
  let scanning = false;
  const lookup = id => {
    const entry = typeof id === 'string' ? snapshot.get(id) : null;
    if (!entry) throw new LibraryError('壁纸项目不存在，请重新扫描');
    return entry;
  };
  return {
    openMedia,
    openAsset,
    readPreviewForReference,
    has: id => snapshot.has(id),
    async scan(directory = '') {
      if (scanning) throw new LibraryError('正在扫描壁纸库，请稍后重试');
      scanning = true;
      try {
        const discovered = await discover(validateLibraryDirectories(directory));
        const sources = new Map();
        if (builtinsDir) {
          const canonicalBuiltins = await optionalDirectory(builtinsDir);
          if (canonicalBuiltins) sources.set(keyFor(canonicalBuiltins), { path: canonicalBuiltins, source: '内置壁纸' });
        }
        for (const root of discovered) {
          const canonical = await canonicalDirectory(root.path);
          if (!sources.has(keyFor(canonical))) {
            sources.set(keyFor(canonical), { path: canonical, source: typeof root.source === 'string' ? root.source : '壁纸库' });
          }
        }
        const next = new Map();
        const items = [];
        let truncated = false;
        const addProject = async (root, candidate, source) => {
          const project = await canonicalDirectory(candidate);
          if (!contained(root, project)) return;
          const id = createHash('sha256').update(keyFor(project)).digest('hex');
          if (next.has(id) || !(await existsProject(project))) return;
          if (next.size === PROJECT_LIMIT) { truncated = true; return; }
          const entry = { root, path: project, source };
          items.push(await scanProject(entry, id));
          next.set(id, entry);
        };
        for (const { path: root, source } of sources.values()) {
          if (await existsProject(root)) await addProject(root, root, source);
          else {
            const directoryHandle = await opendir(root);
            for await (const child of directoryHandle) {
              if (child.isDirectory() || child.isSymbolicLink()) {
                const candidate = path.join(root, child.name);
                // Broken links and links to ordinary files are not projects.
                const canonical = await optionalDirectory(candidate);
                if (canonical && contained(root, canonical)) await addProject(root, canonical, source);
              }
              if (truncated) break;
            }
          }
          if (truncated) break;
        }
        items.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
        snapshot = next;
        return { items, sources: [...sources.values()], truncated };
      } catch (error) { throw publicError(error); }
      finally { scanning = false; }
    },
    async thumbnail(id) {
      const entry = lookup(id);
      try {
        const project = await readProject(entry);
        const target = project.preview || (projectType(project) === 'image' ? project.file : '');
        if (!target) return { dataUrl: null };
        const { dataUrl } = await loadMedia(entry, target, 'preview', PREVIEW_LIMIT);
        return { dataUrl };
      } catch { return { dataUrl: null }; }
    },
    async select(id) {
      const entry = lookup(id);
      try { return await projectMedia(entry, await readProject(entry)); }
      catch (error) { throw publicError(error); }
    },
  };
}
