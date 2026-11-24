import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { MAX_PKG_BYTES, isValidPkgHeader, sanitizeDisplayName } from './config.mjs';

export function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function boundedBody(req, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        if (!failed) reject(Object.assign(new Error('请求太大；壁纸最大 32 MB'), { status: 413 }));
        failed = true;
        chunks.length = 0;
      } else if (!failed) chunks.push(chunk);
    });
    req.on('end', () => { if (!failed) resolveBody(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

export async function streamHandle(req, res, opened, reply, extraHeaders = {}) {
  let handle = opened.handle;
  try {
    if (res.destroyed) return;
    const { bytes, mime } = opened;
    let start = 0;
    let end = bytes - 1;
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let valid = Boolean(match && (match[1] || match[2]));
      if (valid) {
        start = match[1] ? Number(match[1]) : Math.max(0, bytes - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), bytes - 1) : bytes - 1;
        valid = Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < bytes;
      }
      if (!valid) {
        res.setHeader('Content-Range', `bytes */${bytes}`);
        reply(416, { error: '无效的媒体范围' });
        return;
      }
      res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes}`);
    }
    for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', bytes === 0 ? 0 : end - start + 1);
    res.statusCode = range ? 206 : 200;
    if (req.method === 'HEAD' || bytes === 0) { res.end(); return; }
    const stream = handle.createReadStream({ start, end });
    handle = null;
    stream.on('error', () => res.destroy());
    res.once('close', () => stream.destroy());
    stream.pipe(res);
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function saveImportedPkg(req, dataDir) {
  const rawName = decodeURIComponent(String(req.headers['x-file-name'] || 'scene.pkg'));
  const cleanName = sanitizeDisplayName(rawName, 'scene.pkg');
  const title = cleanName.replace(/\.pkg$/i, '') || '导入场景';
  const importedRoot = join(dataDir, 'imported-scenes');
  mkdirSync(importedRoot, { recursive: true });
  const tempFile = join(importedRoot, `.upload-${randomUUID()}.tmp`);
  let total = 0;
  try {
    await new Promise((resolveSave, rejectSave) => {
      const out = createWriteStream(tempFile, { flags: 'wx' });
      let done = false;
      const fail = err => {
        if (done) return;
        done = true;
        out.destroy();
        rejectSave(err);
      };
      req.on('data', chunk => {
        total += chunk.length;
        if (total > MAX_PKG_BYTES) {
          fail(Object.assign(new Error('scene.pkg 文件超过 256 MB 上限'), { status: 413 }));
          return;
        }
        if (!out.write(chunk)) {
          req.pause();
          out.once('drain', () => req.resume());
        }
      });
      req.on('end', () => { if (!done) out.end(); });
      req.on('error', fail);
      out.on('error', fail);
      out.on('finish', () => { if (!done) { done = true; resolveSave(); } });
    });
    const fh = await open(tempFile, 'r');
    try {
      const header = Buffer.alloc(24);
      const { bytesRead } = await fh.read(header, 0, header.length, 0);
      if (!isValidPkgHeader(header.subarray(0, bytesRead))) {
        throw Object.assign(new Error('不是有效的 Wallpaper Engine scene.pkg 文件'), { status: 400 });
      }
    } finally {
      await fh.close();
    }
    const folderName = `pkg-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const folder = join(importedRoot, folderName);
    mkdirSync(folder, { recursive: true });
    renameSync(tempFile, join(folder, 'scene.pkg'));
    writeFileSync(join(folder, 'project.json'), JSON.stringify({ title, type: 'scene', file: 'scene.pkg' }, null, 2), 'utf8');
    const canonicalRoot = await realpath(importedRoot);
    const canonicalFolder = await realpath(folder);
    const idKey = process.platform === 'win32' ? canonicalFolder.toLowerCase() : canonicalFolder;
    const id = createHash('sha256').update(idKey).digest('hex');
    return {
      id,
      name: title,
      kind: 'scene',
      bytes: total,
      previewFile: '',
      properties: [],
      reference: { root: canonicalRoot, path: canonicalFolder, file: 'scene.pkg', kind: 'scene' },
    };
  } catch (err) {
    rmSync(tempFile, { force: true });
    throw err;
  }
}

export async function pickLocalDirectory() {
  if (process.platform !== 'win32') {
    throw Object.assign(new Error('当前系统请直接粘贴本地文件夹路径'), { status: 400 });
  }
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$dlg.Description = "选择 Wallpaper Engine 场景/网页壁纸目录或壁纸库文件夹"',
    '$dlg.ShowNewFolderButton = $false',
    'if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dlg.SelectedPath) }',
  ].join('; ');
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-STA', '-Command', script], {
    timeout: 120000,
    maxBuffer: 16 * 1024,
    windowsHide: true,
    shell: false,
  });
  const chosen = stdout.trim();
  return chosen ? { cancelled: false, directory: chosen } : { cancelled: true, directory: '' };
}
