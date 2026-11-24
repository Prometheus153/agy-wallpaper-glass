import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const distDir = join(root, 'dist');
const stageDir = join(distDir, 'agy-glass');
const zipPath = join(distDir, `agy-glass-v${pkg.version}.zip`);

const include = [
  'package.json',
  'plugin.json',
  'logo.svg',
  'LICENSE',
  'README.md',
  'install.bat',
  'scripts/install.mjs',
  'sidecars',
];

export async function packRelease() {
  // Ensure vendored offline WebWallGL bundle exists before packing
  const vendorBundle = join(root, 'sidecars', 'glass', 'vendor', 'webwallgl.global.min.js');
  const info = await stat(vendorBundle).catch(() => null);
  if (!info || info.size < 100000) {
    throw new Error('缺少离线 WebWallGL 引擎文件，请先运行 npm run sync:vendor');
  }

  await rm(stageDir, { recursive: true, force: true });
  await rm(zipPath, { force: true });
  await mkdir(stageDir, { recursive: true });

  for (const rel of include) {
    const src = join(root, rel);
    const dst = join(stageDir, rel);
    await mkdir(dirname(dst), { recursive: true });
    await cp(src, dst, { recursive: true });
  }

  if (process.platform === 'win32') {
    await promisify(execFile)('powershell.exe', [
      '-NoProfile', '-Command',
      `Compress-Archive -Path '${stageDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ], { windowsHide: true });
  } else {
    await promisify(execFile)('zip', ['-r', '-q', zipPath, 'agy-glass'], { cwd: distDir });
  }

  await rm(stageDir, { recursive: true, force: true });
  const zipped = await stat(zipPath);
  return { zipPath, bytes: zipped.size, version: pkg.version };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await packRelease();
  console.log(`已生成离线发布包: ${result.zipPath} (${(result.bytes / 1024).toFixed(1)} KB)`);
}
