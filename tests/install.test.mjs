import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installPlugin } from '../scripts/install.mjs';

test('installation refuses overwrite; update and uninstall preserve backups and data', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agy-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plugins = join(root, 'config', 'plugins');
  const userData = join(root, 'state.json');
  await writeFile(userData, 'personal data');
  assert.equal((await installPlugin({ plugins, dryRun: true })).preservesUserData, true);
  await assert.rejects(lstat(plugins), { code: 'ENOENT' });
  const first = await installPlugin({ plugins });
  await writeFile(join(first.target, 'logo.svg'), 'user edit');
  await assert.rejects(installPlugin({ plugins }), /已存在/);
  assert.equal(await readFile(join(first.target, 'logo.svg'), 'utf8'), 'user edit');
  const updated = await installPlugin({ plugins, update: true });
  assert.equal(await readFile(join(updated.backup, 'logo.svg'), 'utf8'), 'user edit');
  assert.match(await readFile(join(updated.target, 'logo.svg'), 'utf8'), /svg/);
  const removed = await installPlugin({ plugins, uninstall: true });
  await assert.rejects(lstat(removed.target), { code: 'ENOENT' });
  assert.equal(JSON.parse(await readFile(join(removed.backup, 'plugin.json'), 'utf8')).name, 'agy-glass');
  assert.equal(await readFile(userData, 'utf8'), 'personal data');
});

test('unrecognized destination and missing installation sources are never overwritten', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agy-install-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plugins = join(root, 'plugins');
  const target = join(plugins, 'agy-glass');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'keep.txt'), 'keep');
  await assert.rejects(installPlugin({ plugins, update: true }));
  await writeFile(join(target, 'plugin.json'), JSON.stringify({ name: 'another-plugin' }));
  await assert.rejects(installPlugin({ plugins, update: true }), /不是 AGY Glass/);
  await assert.rejects(installPlugin({ plugins, uninstall: true }), /不是 AGY Glass/);
  assert.equal(await readFile(join(target, 'keep.txt'), 'utf8'), 'keep');
  await assert.rejects(installPlugin({ plugins, update: true, uninstall: true }), /不能同时/);
});
