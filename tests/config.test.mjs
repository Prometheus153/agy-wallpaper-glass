import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, validateSettings, validateMedia } from '../sidecars/glass/config.mjs';

test('defaults are disabled and validation does not mutate them', () => {
  assert.equal(DEFAULTS.enabled, false);
  assert.equal(validateSettings({ blur: 20 }).blur, 20);
  assert.equal(DEFAULTS.blur, 16);
  assert.equal(validateSettings({ enabled: false }, { ...DEFAULTS, theme: 'frost' }).theme, 'frost');
});
test('reject malformed settings, unknown keys and CSS injection', () => {
  for (const value of [null, [], 'x', { opacity: 0 }, { blur: 33 }, { blur: NaN }, { scrim: 40.2 }, { enabled: 'true' }, { theme: 'remote' }, { caret: 'red;}' }, { fontFamily: 'x; color:red' }, { fontFamily: 'x"}body{display:none}' }, { arbitrary: true }, JSON.parse('{"__proto__":{}}')]) {
    assert.throws(() => validateSettings(value));
  }
  assert.equal(validateSettings({ fontFamily: '微软雅黑, Segoe UI' }).fontFamily, '微软雅黑, Segoe UI');
});
test('accept an actual small PNG and sanitize its display name', () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=';
  const media = validateMedia({ name: '../../a.png', dataUrl });
  assert.equal(media.kind, 'image');
  assert.equal(media.name, 'a.png');
  assert.ok(media.bytes > 0);
});
test('reject SVG, remote URLs, spoofed MIME and broken base64', () => {
  for (const dataUrl of ['https://example.invalid/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,aGVsbG8=', 'data:image/png;base64,AAA', 'data:video/mp4;base64,AAA=']) assert.throws(() => validateMedia({ name: 'x', dataUrl }));
});

import { migrateSavedSettings, validateScenePropertyValues, isValidPkgHeader } from '../sidecars/glass/config.mjs';

test('validate new playback, appearance, migration and scene property settings', () => {
  const next = validateSettings({
    theme: 'ember', brightness: 85, contrast: 110, saturation: 150,
    posX: 40, posY: 60, zoom: 120, wallpaperTransparency: 10,
    playbackRate: 1.5, fit: 'contain', flipX: true, volume: 35,
    glassSaturation: 180, pointerParallax: false,
    petEnabled: true, petSize: 108, petY: 62,
  });
  assert.equal(next.theme, 'ember');
  assert.equal(next.playbackRate, 1.5);
  assert.equal(next.fit, 'contain');
  assert.equal(next.flipX, true);
  assert.equal(next.petSize, 108);
  assert.equal(next.petY, 62);
  for (const bad of [{ theme: 'cyan' }, { playbackRate: 3 }, { fit: 'tile' }, { brightness: 10 }, { volume: 101 }, { zoom: 40 }, { wallpaperTransparency: -1 }, { petSize: 30 }, { petY: 99 }]) {
    assert.throws(() => validateSettings(bad));
  }
  const migrated = migrateSavedSettings({ theme: 'cyan', autoRotate: true, activePlaylistId: 'old', rotateMinutes: 10, blur: 20 });
  assert.equal(migrated.theme, 'midnight');
  assert.equal(migrated.blur, 20);
  assert.deepEqual(validateScenePropertyValues({ schemecolor: '0.5 0.2 0.8', speed: 1.2, bloom: true }), { schemecolor: '0.5 0.2 0.8', speed: 1.2, bloom: true });
  assert.throws(() => validateScenePropertyValues(JSON.parse('{"__proto__":1}')));
  const pkgBuf = Buffer.concat([Buffer.from([8, 0, 0, 0]), Buffer.from('PKGV0002', 'ascii'), Buffer.from([0, 0, 0, 0])]);
  assert.equal(isValidPkgHeader(pkgBuf), true);
  assert.equal(isValidPkgHeader(Buffer.from('not a pkg header file')), false);
});
