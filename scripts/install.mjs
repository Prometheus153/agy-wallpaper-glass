import { chmod, cp, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export const PLUGIN_NAME = 'agy-wallpaper-glass';
export const LEGACY_PLUGIN_NAME = 'agy-glass';
export const MIN_NODE_MAJOR = 22;
export const MIN_NODE_MINOR = 12;

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPlugins = join(homedir(), '.gemini', 'config', 'plugins');
const files = ['plugin.json', 'logo.svg', 'sidecars', 'LICENSE'];
const optionalFiles = ['README.md', 'README.zh-CN.md'];

export function isSupportedNodeVersion(version = process.versions.node) {
  const parts = String(version || '').replace(/^v/i, '').split('.').map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return false;
  return parts[0] > MIN_NODE_MAJOR || (parts[0] === MIN_NODE_MAJOR && parts[1] >= MIN_NODE_MINOR);
}

async function configureMacSidecarLauncher(stagingRoot, nodeExecPath) {
  const glassDir = join(stagingRoot, 'sidecars', 'glass');
  const sidecarJsonPath = join(glassDir, 'sidecar.json');
  const launcherPath = join(glassDir, 'launch-mac.sh');

  const launcherRaw = await readFile(launcherPath, 'utf8');
  await writeFile(launcherPath, launcherRaw.replace(/\r\n/g, '\n'), 'utf8');
  try { await chmod(launcherPath, 0o755); } catch { /* ignore on non-POSIX filesystems */ }

  if (typeof nodeExecPath === 'string' && nodeExecPath.trim()) {
    await writeFile(join(glassDir, '.node-bin'), `${nodeExecPath.trim()}\n`, 'utf8');
  }

  const sidecarMeta = JSON.parse(await readFile(sidecarJsonPath, 'utf8'));
  sidecarMeta.command = '/bin/sh';
  sidecarMeta.args = ['launch-mac.sh'];
  await writeFile(sidecarJsonPath, `${JSON.stringify(sidecarMeta, null, 2)}\n`, 'utf8');
}

async function inspectPluginDir(dir, expectedName) {
  let info;
  try { info = await lstat(dir); }
  catch (error) { if (error.code === 'ENOENT') return { exists: false }; throw error; }
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error('目标不是独立插件目录，已停止操作');
  }
  const meta = JSON.parse(await readFile(join(dir, 'plugin.json'), 'utf8'));
  if (meta?.name !== expectedName) {
    throw new Error(`目标不是 ${expectedName}，已停止操作`);
  }
  return { exists: true, info, meta };
}

export async function installPlugin({
  source = sourceRoot,
  plugins = defaultPlugins,
  update = false,
  uninstall = false,
  dryRun = false,
  platform = process.platform,
  nodeExecPath = process.execPath,
  nodeVersion = process.versions.node,
} = {}) {
  if (update && uninstall) throw new Error('更新与卸载不能同时执行');
  if (!uninstall && !dryRun && !isSupportedNodeVersion(nodeVersion)) {
    throw new Error(`需要 Node.js >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0（当前为 v${nodeVersion}），请先升级 Node.js。`);
  }
  const target = join(plugins, PLUGIN_NAME);
  const legacyTarget = join(plugins, LEGACY_PLUGIN_NAME);
  const operation = uninstall ? 'uninstall' : update ? 'update' : 'install';
  if (dryRun) {
    return {
      operation, source, target, files, platform,
      macSidecarLauncher: platform === 'darwin',
      modifiesApp: false, enablesDebugPort: false, preservesUserData: true,
    };
  }

  const current = await inspectPluginDir(target, PLUGIN_NAME);
  let legacy = { exists: false };
  try { legacy = await inspectPluginDir(legacyTarget, LEGACY_PLUGIN_NAME); } catch { legacy = { exists: false }; }

  if (current.exists && !update && !uninstall) {
    throw new Error('插件已存在。请先停止此插件，再使用 --update；更新会保留旧版备份。');
  }
  if (!current.exists && !uninstall && !update && legacy.exists) {
    throw new Error('检测到旧版 agy-glass 已存在，请使用 --update 平滑迁移为 agy-wallpaper-glass（自动备份旧版并保留个人数据）。');
  }
  if (!current.exists && uninstall) throw new Error('未找到已安装的 AGY Wallpaper Glass');
  if (!uninstall && JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8')).name !== PLUGIN_NAME) {
    throw new Error('安装源无效');
  }

  await mkdir(plugins, { recursive: true });
  const backupDir = join(dirname(plugins), `${PLUGIN_NAME}-backups`);
  const backup = current.exists ? join(backupDir, `${Date.now()}-${randomUUID()}`) : null;
  let legacyBackup = null;
  if (backup || (update && legacy.exists)) await mkdir(backupDir, { recursive: true });

  if (uninstall) {
    await rename(target, backup);
    return { operation, target, backup, preservesUserData: true };
  }

  const staging = join(dirname(plugins), `.${PLUGIN_NAME}-${randomUUID()}.tmp`);
  await mkdir(staging);
  try {
    for (const file of files) await cp(join(source, file), join(staging, file), { recursive: true, errorOnExist: true, force: false });
    for (const file of optionalFiles) {
      try { await cp(join(source, file), join(staging, file), { recursive: true, errorOnExist: true, force: false }); }
      catch (err) { if (err.code !== 'ENOENT') throw err; }
    }
    const macSidecarLauncher = platform === 'darwin';
    if (macSidecarLauncher) {
      await configureMacSidecarLauncher(staging, nodeExecPath);
    }

    if (backup) {
      await cp(target, backup, { recursive: true, errorOnExist: true, force: false });
      try {
        for (const file of files) await cp(join(staging, file), join(target, file), { recursive: true });
        for (const file of optionalFiles) {
          try { await cp(join(staging, file), join(target, file), { recursive: true }); }
          catch (err) { if (err.code !== 'ENOENT') throw err; }
        }
        if (macSidecarLauncher) {
          try { await chmod(join(target, 'sidecars', 'glass', 'launch-mac.sh'), 0o755); } catch {}
        }
      } catch (error) {
        await cp(backup, target, { recursive: true });
        throw error;
      }
    } else {
      await rename(staging, target);
    }
    let legacyCleanupRequired = false;
    if (update && legacy.exists) {
      legacyBackup = join(backupDir, `legacy-agy-glass-${Date.now()}-${randomUUID()}`);
      try {
        await rename(legacyTarget, legacyBackup);
      } catch (err) {
        if (err?.code === 'EPERM' || err?.code === 'EBUSY') {
          await cp(legacyTarget, legacyBackup, { recursive: true, errorOnExist: true, force: false });
          legacyCleanupRequired = true;
        } else {
          throw err;
        }
      }
    }
    return {
      operation,
      target,
      backup: backup || legacyBackup,
      migratedFrom: legacyBackup ? LEGACY_PLUGIN_NAME : null,
      legacyCleanupRequired,
      macSidecarLauncher,
      preservesUserData: true,
    };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--help', '--dry-run', '--update', '--uninstall'].includes(arg))) throw new Error('未知参数；使用 --help 查看说明');
  if (args.includes('--help')) {
    console.log(`AGY Wallpaper Glass v1.2.0 (${PLUGIN_NAME}) · Windows & macOS Antigravity Desktop Plugin
Requires Node.js >=22.12 and Antigravity Desktop local DevTools port.
node scripts/install.mjs             First-time install (disabled by default)
node scripts/install.mjs --update    Update / migrate legacy agy-glass with backup
node scripts/install.mjs --uninstall Uninstall and keep backup + user data
node scripts/install.mjs --dry-run   Preview target paths without modifying files
Target: ~/.gemini/config/plugins/${PLUGIN_NAME} (bundled offline WebWallGL, zero npm install).`);
  } else {
    const result = await installPlugin({ update: args.includes('--update'), uninstall: args.includes('--uninstall'), dryRun: args.includes('--dry-run') });
    console.log(JSON.stringify(result, null, 2));
    if (!args.includes('--dry-run')) {
      console.log('Done! Enable AGY Wallpaper Glass in Antigravity Customizations → Installed. User settings & wallpapers are preserved.');
      if (result.macSidecarLauncher) {
        console.log('macOS launcher configured (/bin/sh launch-mac.sh + recorded Node path) for Finder/Dock GUI launches.');
      }
      if (result.legacyCleanupRequired) {
        console.log('Note: Legacy agy-glass is currently running in Antigravity. Please disable/remove old "AGY Glass" in Customizations → Installed, then enable "AGY Wallpaper Glass".');
      }
    }
  }
}
