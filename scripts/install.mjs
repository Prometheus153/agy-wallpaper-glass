import { mkdir, lstat, readFile, cp, rename, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPlugins = join(homedir(), '.gemini', 'config', 'plugins');
const files = ['plugin.json', 'logo.svg', 'sidecars', 'LICENSE'];
const optionalFiles = ['README.md'];

export async function installPlugin({ source = sourceRoot, plugins = defaultPlugins, update = false, uninstall = false, dryRun = false } = {}) {
  if (update && uninstall) throw new Error('更新与卸载不能同时执行');
  const target = join(plugins, 'agy-glass');
  const operation = uninstall ? 'uninstall' : update ? 'update' : 'install';
  if (dryRun) return { operation, source, target, files, modifiesApp: false, enablesDebugPort: false, preservesUserData: true };
  let info;
  try { info = await lstat(target); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const exists = Boolean(info);
  if (exists) {
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('目标不是独立插件目录，已停止操作');
    if (JSON.parse(await readFile(join(target, 'plugin.json'), 'utf8')).name !== 'agy-glass') throw new Error('目标不是 AGY Glass，已停止操作');
  }
  if (exists && !update && !uninstall) throw new Error('插件已存在。请先停止此插件，再使用 --update；更新会保留旧版备份。');
  if (!exists && uninstall) throw new Error('未找到已安装的 AGY Glass');
  if (!uninstall && JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8')).name !== 'agy-glass') throw new Error('安装源无效');
  await mkdir(plugins, { recursive: true });
  const backup = exists ? join(dirname(plugins), 'agy-glass-backups', `${Date.now()}-${randomUUID()}`) : null;
  if (backup) await mkdir(dirname(backup), { recursive: true });
  if (uninstall) {
    await rename(target, backup);
    return { operation, target, backup, preservesUserData: true };
  }
  const staging = join(dirname(plugins), `.agy-glass-${randomUUID()}.tmp`);
  await mkdir(staging);
  try {
    for (const file of files) await cp(join(source, file), join(staging, file), { recursive: true, errorOnExist: true, force: false });
    for (const file of optionalFiles) {
      try { await cp(join(source, file), join(staging, file), { recursive: true, errorOnExist: true, force: false }); }
      catch (err) { if (err.code !== 'ENOENT') throw err; }
    }
    if (backup) {
      await cp(target, backup, { recursive: true, errorOnExist: true, force: false });
      try {
        for (const file of files) await cp(join(staging, file), join(target, file), { recursive: true });
        for (const file of optionalFiles) {
          try { await cp(join(staging, file), join(target, file), { recursive: true }); }
          catch (err) { if (err.code !== 'ENOENT') throw err; }
        }
      } catch (error) {
        await cp(backup, target, { recursive: true });
        throw error;
      }
    } else await rename(staging, target);
  } finally { await rm(staging, { recursive: true, force: true }); }
  return { operation, target, backup, preservesUserData: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--help', '--dry-run', '--update', '--uninstall'].includes(arg))) throw new Error('未知参数；使用 --help 查看说明');
  if (args.includes('--help')) {
    console.log(`AGY Glass v1.0.0 · Antigravity Desktop 液态玻璃与 Wallpaper Engine 壁纸插件
要求 Node.js >=22.12，Antigravity Desktop 的已有本机 DevTools 端口。
node scripts/install.mjs             首次安装，效果默认关闭
node scripts/install.mjs --update    更新并备份旧插件，完成后重启 AGY Glass
node scripts/install.mjs --uninstall 移走插件并保留备份，请先恢复原界面、停止 AGY Glass
node scripts/install.mjs --dry-run   仅查看安装位置，不写入
插件位于 ~/.gemini/config/plugins/agy-glass；内置离线 WebWallGL 引擎，免联网安装。
自动发现 Steam / Wallpaper Engine 库，支持场景（Scene）、网页（Web）、视频与图片实时渲染。
支持导入本地场景/网页文件夹（免复制流式读取）以及独立 scene.pkg（最大 256 MB）。
不修改宿主文件，不自动开启调试端口；不要向网络暴露调试端口。`);
  } else {
    const result = await installPlugin({ update: args.includes('--update'), uninstall: args.includes('--uninstall'), dryRun: args.includes('--dry-run') });
    console.log(JSON.stringify(result, null, 2));
    if (!args.includes('--dry-run')) console.log('操作完成。请在 Antigravity 自定义 → 已安装 中重新打开 AGY Glass。个人设置与原始壁纸未删除。');
  }
}
