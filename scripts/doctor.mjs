import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSupportedNodeVersion, PLUGIN_NAME } from './install.mjs';
import { parsePort, portFile } from '../sidecars/glass/injector.mjs';
import { discoverLibraryRoots } from '../sidecars/glass/library.mjs';

async function fileExists(p) {
  try { await access(p, constants.R_OK); return true; } catch { return false; }
}

export async function runDoctor({
  platform = process.platform,
  env = process.env,
  homeDir = homedir(),
  pluginsDir = join(homeDir, '.gemini', 'config', 'plugins'),
  nodeVersion = process.versions.node,
  probePort = true,
} = {}) {
  const checks = [];
  const add = (id, status, title, detail, fix = '') => checks.push({ id, status, title, detail, fix });

  // 1. Node.js version
  if (isSupportedNodeVersion(nodeVersion)) {
    add('node', 'ok', 'Node.js 版本 / Version', `v${nodeVersion} (${process.execPath})`);
  } else {
    add('node', 'fail', 'Node.js 版本过低 / Outdated Node.js', `v${nodeVersion} (< 22.12.0)`,
      platform === 'darwin' ? 'brew install node  或访问 https://nodejs.org/' : '从 https://nodejs.org/ 安装 Node.js 22.12+');
  }

  // 2. Installed plugin files
  const target = join(pluginsDir, PLUGIN_NAME);
  const pluginJsonPath = join(target, 'plugin.json');
  const serverPath = join(target, 'sidecars', 'glass', 'server.mjs');
  const vendorPath = join(target, 'sidecars', 'glass', 'vendor', 'webwallgl.global.min.js');
  const installed = (await fileExists(pluginJsonPath)) && (await fileExists(serverPath)) && (await fileExists(vendorPath));
  if (installed) {
    let ver = '?';
    try { ver = JSON.parse(await readFile(pluginJsonPath, 'utf8')).version || '?'; } catch {}
    const vStat = await stat(vendorPath).catch(() => null);
    add('install', 'ok', '插件安装完整性 / Plugin Files', `${target} (v${ver}, WebWallGL ${Math.round((vStat?.size || 0) / 1024)} KB)`);
  } else {
    add('install', 'fail', '未检测到已安装插件 / Plugin Not Installed', `缺少文件：${target}`,
      platform === 'darwin' ? 'bash install-mac.command  或  node scripts/install.mjs' : '双击 install.bat 或运行 node scripts/install.mjs');
  }

  // 3. macOS GUI-PATH-safe Sidecar launcher check
  if (platform === 'darwin' && installed) {
    const sidecarPath = join(target, 'sidecars', 'glass', 'sidecar.json');
    const launcherPath = join(target, 'sidecars', 'glass', 'launch-mac.sh');
    try {
      const sc = JSON.parse(await readFile(sidecarPath, 'utf8'));
      const shRaw = await readFile(launcherPath, 'utf8');
      const hasCrlf = shRaw.includes('\r');
      const usesWrapper = sc.command === '/bin/sh' && Array.isArray(sc.args) && sc.args[0] === 'launch-mac.sh';
      if (usesWrapper && !hasCrlf) {
        const nodeBinFile = join(target, 'sidecars', 'glass', '.node-bin');
        const recorded = (await fileExists(nodeBinFile)) ? (await readFile(nodeBinFile, 'utf8')).trim() : 'auto-detect';
        add('mac-launcher', 'ok', 'macOS Sidecar 启动器 / GUI PATH Launcher', `/bin/sh launch-mac.sh (Node: ${recorded})`);
      } else {
        add('mac-launcher', 'warn', 'macOS Sidecar 启动器未配置 / Wrapper Missing',
          hasCrlf ? 'launch-mac.sh 包含 CRLF 换行' : `sidecar.json 当前 command=${sc.command}`,
          '重新运行 node scripts/install.mjs --update 自动修复');
      }
    } catch {
      add('mac-launcher', 'fail', 'macOS Sidecar 启动器缺失', '缺少 sidecar.json 或 launch-mac.sh',
        '重新运行 node scripts/install.mjs --update');
    }
  }

  // 4. DevToolsActivePort file & loopback CDP probe
  const devToolsFile = portFile(env, { platform, homeDir });
  let devPort = null;
  if (!devToolsFile) {
    add('devtools-file', 'fail', 'DevTools 路径无法解析', '缺少系统用户目录环境变量');
  } else if (await fileExists(devToolsFile)) {
    const firstLine = (await readFile(devToolsFile, 'utf8')).split(/\r?\n/, 1)[0].trim();
    devPort = parsePort(firstLine);
    if (devPort) {
      add('devtools-file', 'ok', 'DevToolsActivePort 已生成', `${devToolsFile} (port ${devPort})`);
    } else {
      add('devtools-file', 'warn', 'DevToolsActivePort 内容无效', `${devToolsFile} -> "${firstLine}"`,
        platform === 'darwin'
          ? '先 Cmd+Q 完全退出 Antigravity，再运行: open -a "Antigravity" --args --remote-debugging-port=9222'
          : '重启带 --remote-debugging-port=9222 参数的 Antigravity');
    }
  } else {
    add('devtools-file', 'warn', '未检测到 DevToolsActivePort', `未找到 ${devToolsFile}`,
      platform === 'darwin'
        ? '先 Cmd+Q 完全退出 Antigravity，再运行: open -a "Antigravity" --args --remote-debugging-port=9222（或使用 install-mac.command 选项 3 生成桌面启动图标）'
        : '右键 Antigravity 快捷方式 → 属性 → 目标末尾加 --remote-debugging-port=9222 后重启');
  }

  if (probePort && devPort) {
    try {
      const resp = await fetch(`http://127.0.0.1:${devPort}/json/version`, { signal: AbortSignal.timeout(1500) });
      if (resp.ok) {
        const info = await resp.json().catch(() => ({}));
        add('cdp-live', 'ok', '本地回环调试端口在线 / Loopback CDP Live', `127.0.0.1:${devPort} (${info.Browser || 'Electron'})`);
      } else {
        add('cdp-live', 'warn', '调试端口响应异常', `HTTP ${resp.status}`, '重启带 --remote-debugging-port=9222 的 Antigravity');
      }
    } catch {
      add('cdp-live', 'warn', 'Antigravity 当前未运行或端口未监听', `无法连接 127.0.0.1:${devPort}（若 Antigravity 已关闭则属正常）`,
        platform === 'darwin' ? 'open -a "Antigravity" --args --remote-debugging-port=9222' : '使用带调试参数的快捷方式启动 Antigravity');
    }
  }

  // 5. Steam / Wallpaper Engine library discovery
  try {
    const roots = await discoverLibraryRoots('', { env, platform, homeDir });
    if (roots.length > 0) {
      add('library', 'ok', '本机壁纸库扫描 / Steam Discovery', `已发现 ${roots.length} 个目录: ${roots.map(r => r.path).join(', ')}`);
    } else {
      add('library', 'ok', '本机壁纸库扫描 / Steam Discovery', '未检测到 Steam 小红车目录（开箱仍可直接使用 6 套内置动态壁纸，或手动导入本地视频/图片/场景目录）');
    }
  } catch (err) {
    add('library', 'warn', '壁纸库扫描异常', err.message);
  }

  const ok = checks.every(c => c.status !== 'fail');
  return { ok, platform, checks };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runDoctor();
  console.log(`\nAGY Wallpaper Glass Doctor (${report.platform})`);
  console.log('==============================================================');
  for (const c of report.checks) {
    const badge = c.status === 'ok' ? '[OK]  ' : c.status === 'warn' ? '[WARN]' : '[FAIL]';
    console.log(`${badge} ${c.title}`);
    console.log(`       ${c.detail}`);
    if (c.fix) console.log(`       -> ${c.fix}`);
  }
  console.log('==============================================================');
  console.log(report.ok
    ? '核心检查通过 / Core checks passed! 如顶部状态仍显示等待连接，请确保按上方命令启动 Antigravity。'
    : '发现需要修复的项 / Action required above before enabling in Antigravity.');
  process.exitCode = report.ok ? 0 : 1;
}
