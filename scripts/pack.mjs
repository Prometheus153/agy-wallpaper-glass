import { readdir, readFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const distDir = join(root, 'dist');

const COMMON_INCLUDE = [
  'package.json',
  'plugin.json',
  'logo.svg',
  'LICENSE',
  'README.md',
  'README.zh-CN.md',
  'scripts/install.mjs',
  'scripts/doctor.mjs',
  'sidecars',
];

const UNIVERSAL_INCLUDE = [...COMMON_INCLUDE, 'install.bat', 'install-mac.command'];
const MACOS_INCLUDE = [...COMMON_INCLUDE, 'install-mac.command'];

// Standard IEEE 802.3 CRC32 table for pure cross-platform ZIP generation
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTimeDate(date) {
  const y = Math.max(1980, date.getFullYear());
  const dosTime = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const dosDate = (((y - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

function isExecutableEntry(posixPath) {
  return posixPath.endsWith('.sh') || posixPath.endsWith('.command');
}

async function collectFiles(baseDir, relPath, out) {
  const full = join(baseDir, relPath);
  const info = await stat(full);
  if (info.isDirectory()) {
    const entries = await readdir(full, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      if (ent.name === '.DS_Store' || ent.name === 'Thumbs.db') continue;
      await collectFiles(baseDir, join(relPath, ent.name), out);
    }
  } else {
    let data = await readFile(full);
    const posixRel = relative(baseDir, full).replace(/\\/g, '/');
    if (isExecutableEntry(posixRel)) {
      data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    }
    out.push({
      name: `agy-wallpaper-glass/${posixRel}`,
      data,
      mtime: info.mtime,
      mode: isExecutableEntry(posixRel) ? 0o100755 : 0o100644,
    });
  }
}

export function buildPosixZip(entries) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const raw = entry.data;
    const compressed = deflateRawSync(raw, { level: 9 });
    const useStore = compressed.length >= raw.length;
    const payload = useStore ? raw : compressed;
    const method = useStore ? 0 : 8;
    const crc = crc32(raw);
    const { dosTime, dosDate } = dosTimeDate(entry.mtime || new Date());
    const extAttr = ((entry.mode || 0o100644) << 16) >>> 0;

    // Local file header (30 bytes + name)
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 flag
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(payload.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    localChunks.push(lh, nameBuf, payload);

    // Central directory header (46 bytes + name) — Version Made By = Unix (3) so macOS/Linux honor 0755 bits
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE((3 << 8) | 20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(payload.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(extAttr, 38);
    ch.writeUInt32LE(offset, 42);
    centralChunks.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralBuf, eocd]);
}

async function writeArchive(zipPath, includeList) {
  const entries = [];
  for (const rel of includeList) {
    await collectFiles(root, rel, entries);
  }
  const zipBuf = buildPosixZip(entries);
  await rm(zipPath, { force: true });
  await writeFile(zipPath, zipBuf);
  const info = await stat(zipPath);
  return { zipPath, bytes: info.size, count: entries.length };
}

export async function packRelease() {
  const vendorBundle = join(root, 'sidecars', 'glass', 'vendor', 'webwallgl.global.min.js');
  const info = await stat(vendorBundle).catch(() => null);
  if (!info || info.size < 100000) {
    throw new Error('缺少离线 WebWallGL 引擎文件，请先运行 npm run sync:vendor');
  }

  await mkdir(distDir, { recursive: true });
  const universalZip = join(distDir, `agy-wallpaper-glass-v${pkg.version}.zip`);
  const macosZip = join(distDir, `agy-wallpaper-glass-v${pkg.version}-macos.zip`);

  const universal = await writeArchive(universalZip, UNIVERSAL_INCLUDE);
  const macos = await writeArchive(macosZip, MACOS_INCLUDE);
  return { version: pkg.version, universal, macos };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await packRelease();
  console.log(`已生成双端通用离线包: ${result.universal.zipPath} (${(result.universal.bytes / 1024).toFixed(1)} KB, ${result.universal.count} files)`);
  console.log(`已生成 macOS 专版离线包: ${result.macos.zipPath} (${(result.macos.bytes / 1024).toFixed(1)} KB, ${result.macos.count} files)`);
}
