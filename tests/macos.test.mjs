import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { portFile } from '../sidecars/glass/injector.mjs';
import { createLibrary, validateLibraryDirectories, validateLibraryDirectory } from '../sidecars/glass/library.mjs';
import { pickLocalDirectory } from '../sidecars/glass/server-helpers.mjs';
import { installPlugin, isSupportedNodeVersion } from '../scripts/install.mjs';
import { runDoctor } from '../scripts/doctor.mjs';
import { buildPosixZip } from '../scripts/pack.mjs';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test('injector portFile resolves macOS Application Support path without APPDATA', () => {
  const resolved = portFile({}, { platform: 'darwin', homeDir: '/Users/alice' });
  assert.equal(resolved, '/Users/alice/Library/Application Support/Antigravity/DevToolsActivePort');
  assert.equal(portFile({}, { platform: 'darwin', homeDir: 'relative/home' }), null);
});

test('library directory validation supports macOS POSIX & tilde paths and rejects unsafe input', () => {
  const opts = { platform: 'darwin', homeDir: '/Users/alice' };
  assert.equal(validateLibraryDirectory('/Users/alice/Wallpapers/', opts), '/Users/alice/Wallpapers/');
  assert.equal(validateLibraryDirectory('~/Desktop/Wallpapers', opts), '/Users/alice/Desktop/Wallpapers');
  assert.equal(validateLibraryDirectory('~', opts), '/Users/alice');

  const deduped = validateLibraryDirectories(['~/Wallpapers', '/Users/alice/Wallpapers'], opts);
  assert.deepEqual(deduped, ['/Users/alice/Wallpapers']);

  assert.throws(() => validateLibraryDirectory('C:\\Steam\\Wallpapers', opts));
  assert.throws(() => validateLibraryDirectory('//server/share/wallpapers', opts));
  assert.throws(() => validateLibraryDirectory('/Users/alice\\bad', opts));
});

test('library openAsset blocks macOS/Unix executables while allowing scene.pkg', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agy-mac-assets-'));
  try {
    const proj = join(dir, 'demo-scene');
    await mkdir(proj, { recursive: true });
    await writeFile(join(proj, 'project.json'), JSON.stringify({ title: 'Demo', type: 'scene', file: 'scene.pkg' }));
    await writeFile(join(proj, 'scene.pkg'), Buffer.concat([Buffer.from('\x08\x00\x00\x00PKGV0001'), Buffer.alloc(32)]));
    await writeFile(join(proj, 'evil.sh'), '#!/bin/sh\necho hi\n');
    await writeFile(join(proj, 'evil.command'), '#!/bin/bash\necho hi\n');
    await writeFile(join(proj, 'evil.dylib'), 'fake');

    const lib = createLibrary({ discover: async () => [{ path: dir, source: '手动目录' }] });
    const snap = await lib.scan('');
    const item = snap.items.find(i => i.title === 'Demo');
    assert.ok(item?.available);
    const sel = await lib.select(item.id);

    // scene.pkg remains readable
    const pkgOpened = await lib.openAsset(sel.reference, 'scene.pkg');
    await pkgOpened.handle.close();

    // macOS executables/scripts are blocked
    for (const bad of ['evil.sh', 'evil.command', 'evil.dylib']) {
      await assert.rejects(() => lib.openAsset(sel.reference, bad), /不允许读取可执行文件/);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('pickLocalDirectory uses native osascript on macOS and handles normal output & cancel', async () => {
  let called = null;
  const okRes = await pickLocalDirectory({
    platform: 'darwin',
    exec: async (cmd, args) => {
      called = { cmd, args };
      return { stdout: '/Users/alice/My Wallpapers/\n' };
    },
  });
  assert.equal(called.cmd, '/usr/bin/osascript');
  assert.deepEqual(okRes, { cancelled: false, directory: '/Users/alice/My Wallpapers' });

  const rootRes = await pickLocalDirectory({
    platform: 'darwin',
    exec: async () => ({ stdout: '/\n' }),
  });
  assert.deepEqual(rootRes, { cancelled: false, directory: '/' });

  const cancelEn = await pickLocalDirectory({
    platform: 'darwin',
    exec: async () => {
      const err = new Error('Command failed');
      err.code = 1;
      err.stderr = 'execution error: User canceled. (-128)';
      throw err;
    },
  });
  assert.deepEqual(cancelEn, { cancelled: true, directory: '' });

  const cancelZh = await pickLocalDirectory({
    platform: 'darwin',
    exec: async () => {
      const err = new Error('Command failed');
      err.code = 1;
      err.stderr = 'execution error: 用户已取消。 (-128)';
      throw err;
    },
  });
  assert.deepEqual(cancelZh, { cancelled: true, directory: '' });
});

test('installPlugin configures GUI-PATH-safe macOS sidecar launcher and enforces Node >= 22.12', async () => {
  assert.equal(isSupportedNodeVersion('20.18.0'), false);
  assert.equal(isSupportedNodeVersion('22.11.9'), false);
  assert.equal(isSupportedNodeVersion('22.12.0'), true);
  assert.equal(isSupportedNodeVersion('24.18.0'), true);

  const root = await mkdtemp(join(tmpdir(), 'agy-mac-install-'));
  const plugins = join(root, 'plugins');
  try {
    await assert.rejects(
      () => installPlugin({ source: REPO_ROOT, plugins, platform: 'darwin', nodeVersion: '20.11.0' }),
      /Node\.js >= 22\.12\.0/,
    );

    const res = await installPlugin({
      source: REPO_ROOT,
      plugins,
      platform: 'darwin',
      nodeExecPath: '/opt/homebrew/bin/node',
      nodeVersion: '22.14.0',
    });
    assert.equal(res.macSidecarLauncher, true);

    const installedSidecar = JSON.parse(await readFile(join(res.target, 'sidecars', 'glass', 'sidecar.json'), 'utf8'));
    assert.equal(installedSidecar.command, '/bin/sh');
    assert.deepEqual(installedSidecar.args, ['launch-mac.sh']);

    const nodeBin = await readFile(join(res.target, 'sidecars', 'glass', '.node-bin'), 'utf8');
    assert.equal(nodeBin, '/opt/homebrew/bin/node\n');

    const shContent = await readFile(join(res.target, 'sidecars', 'glass', 'launch-mac.sh'), 'utf8');
    assert.equal(shContent.includes('\r'), false, 'launch-mac.sh must use LF line endings');

    // Original repo sidecar.json stays untouched for Windows
    const repoSidecar = JSON.parse(await readFile(join(REPO_ROOT, 'sidecars', 'glass', 'sidecar.json'), 'utf8'));
    assert.equal(repoSidecar.command, 'node');

    // Update on macOS preserves backup and keeps macOS launcher intact
    const upd = await installPlugin({
      source: REPO_ROOT,
      plugins,
      update: true,
      platform: 'darwin',
      nodeExecPath: '/usr/local/bin/node',
      nodeVersion: '22.14.0',
    });
    assert.ok(upd.backup);
    assert.equal(upd.macSidecarLauncher, true);
    assert.equal(await readFile(join(upd.target, 'sidecars', 'glass', '.node-bin'), 'utf8'), '/usr/local/bin/node\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('doctor reports clean status on simulated macOS setup and warns on missing DevToolsActivePort', async () => {
  const fakeHome = await mkdtemp(join(tmpdir(), 'agy-mac-doc-'));
  const pluginsDir = join(fakeHome, '.gemini', 'config', 'plugins');
  try {
    await installPlugin({
      source: REPO_ROOT,
      plugins: pluginsDir,
      platform: 'darwin',
      nodeExecPath: '/opt/homebrew/bin/node',
      nodeVersion: '22.14.0',
    });

    // Missing DevToolsActivePort -> warns with macOS open -a fix
    const r1 = await runDoctor({
      platform: 'darwin',
      env: {},
      homeDir: '/Users/alice',
      pluginsDir,
      nodeVersion: '22.14.0',
      probePort: false,
    });
    assert.equal(r1.ok, true);
    assert.equal(r1.checks.find(c => c.id === 'mac-launcher')?.status, 'ok');
    const dtWarn = r1.checks.find(c => c.id === 'devtools-file');
    assert.equal(dtWarn?.status, 'warn');
    assert.match(dtWarn.fix, /open -a "Antigravity"/);

    // Outdated Node -> fails
    const rBadNode = await runDoctor({
      platform: 'darwin',
      env: {},
      homeDir: '/Users/alice',
      pluginsDir,
      nodeVersion: '18.20.0',
      probePort: false,
    });
    assert.equal(rBadNode.ok, false);
    assert.equal(rBadNode.checks.find(c => c.id === 'node')?.status, 'fail');
  } finally {
    await rm(fakeHome, { recursive: true, force: true });
  }
});

test('macOS shell scripts in repository use strict LF endings and valid shebangs', async () => {
  for (const rel of ['sidecars/glass/launch-mac.sh', 'install-mac.command']) {
    const raw = await readFile(join(REPO_ROOT, rel), 'utf8');
    assert.equal(raw.includes('\r'), false, `${rel} must not contain CRLF`);
    assert.match(raw, /^#!\/bin\/(sh|bash)\n/);
  }
});

test('buildPosixZip writes Unix version-made-by and 0755 permissions for executable entries', () => {
  const zip = buildPosixZip([
    { name: 'pkg/install-mac.command', data: Buffer.from('#!/bin/bash\necho ok\n'), mode: 0o100755 },
    { name: 'pkg/README.md', data: Buffer.from('# Hi\n'), mode: 0o100644 },
  ]);
  // Find central directory header signatures (0x02014b50) and inspect Unix external_attr
  const modes = [];
  for (let i = 0; i < zip.length - 46; i++) {
    if (zip.readUInt32LE(i) === 0x02014b50) {
      assert.equal(zip.readUInt16LE(i + 4) >> 8, 3, 'versionMadeBy high byte must be Unix (3)');
      modes.push(zip.readUInt32LE(i + 38) >>> 16);
    }
  }
  assert.deepEqual(modes, [0o100755, 0o100644]);
});
