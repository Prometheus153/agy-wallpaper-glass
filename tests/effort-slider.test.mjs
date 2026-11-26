import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { DEFAULTS, migrateSavedSettings } from '../sidecars/glass/config.mjs';
import { installGlass } from '../sidecars/glass/runtime.mjs';
import { createHostLocalizer, setExternalHostDict } from '../sidecars/glass/zh-ui.mjs';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VENDOR_DIR = join(REPO_ROOT, 'sidecars', 'glass', 'vendor');
const require = createRequire(import.meta.url);

test('official MIT effort-slider client.js and LICENSE are bundled, valid, and expose CDP mount/stop API', async () => {
  const clientPath = join(VENDOR_DIR, 'effort-slider-client.js');
  const licensePath = join(VENDOR_DIR, 'antigravity-effort-slider.LICENSE');
  const [clientSrc, licenseText] = await Promise.all([
    readFile(clientPath, 'utf8'),
    readFile(licensePath, 'utf8'),
  ]);

  assert.ok(clientSrc.length > 200_000, 'full official client.js should be bundled');
  assert.match(licenseText, /MIT License/i);

  // Verify the vendor bundle executes cleanly inside the exact runtimeBundle wrapper pattern
  const sandbox = {
    globalThis: null,
    console,
    setTimeout,
    clearTimeout,
    Map,
    Set,
    WeakMap,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(`
    const boot = () => {
      if (!globalThis.AntigravityCodexEffortSlider) {
        globalThis.__agCodexEffortSliderDisableAutoBoot = true;
        ${clientSrc}
      }
      return globalThis.AntigravityCodexEffortSlider;
    };
    boot();
  `, sandbox);

  const api = sandbox.AntigravityCodexEffortSlider;
  assert.ok(api, 'AntigravityCodexEffortSlider global should be populated');
  assert.equal(typeof api.installCodexEffortSlider, 'function');
  assert.equal(typeof api.mountCodexEffortSlider, 'function');
  assert.equal(typeof api.readAntigravityFiberContext, 'function');
  assert.equal(typeof api.paintDither, 'function');
  assert.equal(sandbox.__agCodexEffortSliderInstance, undefined, 'auto-boot must stay disabled until runtime mounts it');
});

test('runtime mounts official MIT effort-slider automatically by default (non-configurable) and stops cleanly on dispose', () => {
  let installed = 0;
  let stopped = 0;
  const origApi = globalThis.AntigravityCodexEffortSlider;
  const origInst = globalThis.__agCodexEffortSliderInstance;
  const origDoc = globalThis.document;
  const origMatch = globalThis.matchMedia;
  const origKey = globalThis.__agyGlass;

  const fakeNode = () => ({
    style: {},
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    append() {},
    prepend() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
  });

  globalThis.AntigravityCodexEffortSlider = {
    installCodexEffortSlider() {
      installed++;
      const inst = {
        stop() {
          stopped++;
          if (globalThis.__agCodexEffortSliderInstance === inst) delete globalThis.__agCodexEffortSliderInstance;
        },
      };
      globalThis.__agCodexEffortSliderInstance = inst;
      return inst;
    },
  };
  delete globalThis.__agCodexEffortSliderInstance;
  delete globalThis.__agyGlass;
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.document = {
    documentElement: fakeNode(),
    head: fakeNode(),
    body: fakeNode(),
    hidden: false,
    createElement: () => fakeNode(),
    getElementById: id => (id === 'root' ? fakeNode() : null),
    querySelector: sel => (sel === '.agy-shell' ? fakeNode() : null),
    addEventListener() {},
    removeEventListener() {},
  };

  try {
    // Preview mode must NOT mount host effort slider
    installGlass({ owner: 'agy-glass-preview', settings: { ...DEFAULTS, enabled: true }, media: null, leaseMs: 15000 });
    assert.equal(installed, 0);
    globalThis.__agyGlass.dispose();

    // Live Antigravity host mode automatically mounts effort slider by default
    installGlass({ owner: 'live-owner', settings: { ...DEFAULTS, enabled: true }, media: null, leaseMs: 15000 });
    assert.equal(installed, 1);
    assert.equal(stopped, 0);

    // Disposing runtime stops the official effort slider cleanly
    globalThis.__agyGlass.dispose();
    assert.equal(stopped, 1);
    assert.equal(globalThis.__agCodexEffortSliderInstance, undefined);
  } finally {
    if (origApi === undefined) delete globalThis.AntigravityCodexEffortSlider;
    else globalThis.AntigravityCodexEffortSlider = origApi;
    if (origInst === undefined) delete globalThis.__agCodexEffortSliderInstance;
    else globalThis.__agCodexEffortSliderInstance = origInst;
    if (origKey === undefined) delete globalThis.__agyGlass;
    else globalThis.__agyGlass = origKey;
    globalThis.document = origDoc;
    globalThis.matchMedia = origMatch;
  }
});

test('Creative tab stays blank and config cleanly migrates any previously saved effortSlider keys', async () => {
  const html = await readFile(join(REPO_ROOT, 'sidecars', 'glass', 'index.html'), 'utf8');
  assert.match(html, /<section class="tab-panel" id="tab-creative" role="tabpanel" hidden><\/section>/);
  assert.equal(Object.hasOwn(DEFAULTS, 'effortSliderEnabled'), false);

  const migrated = migrateSavedSettings({
    enabled: true,
    effortSliderEnabled: false,
    effortSliderStyle: 'claude',
    effortSliderEffects: false,
  });
  assert.equal(migrated.enabled, true);
  assert.equal(Object.hasOwn(migrated, 'effortSliderEnabled'), false);
});

test('zh-ui skips model-selector and effort-slider nodes to prevent Medium/中等 ping-pong flicker', () => {
  setExternalHostDict({ Medium: '中等', High: '高', Low: '低', 'New Conversation': '新建对话' });
  const makeEl = (tag, attrs = {}, children = []) => {
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      id: attrs.id || '',
      className: attrs.class || '',
      attrs: new Map(Object.entries(attrs)),
      childNodes: [],
      parentElement: null,
      parentNode: null,
      getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
      setAttribute(k, v) { this.attrs.set(k, String(v)); },
    };
    for (const c of children) {
      c.parentElement = el;
      c.parentNode = el;
      el.childNodes.push(c);
    }
    return el;
  };
  const txt = v => ({ nodeType: 3, nodeValue: v, parentElement: null, parentNode: null });

  const sidebarTxt = txt('New Conversation');
  const sliderVal = txt('Medium');
  const triggerVal = txt('High');
  const panelVal = txt('Low');

  const root = makeEl('body', {}, [
    makeEl('div', {}, [sidebarTxt]),
    makeEl('div', { class: 'ces-ag-section' }, [makeEl('span', { 'data-ces-part': 'value' }, [sliderVal])]),
    makeEl('button', { 'data-testid': 'model-selector-trigger' }, [makeEl('span', {}, [triggerVal])]),
    makeEl('div', { 'data-testid': 'model-selector-panel' }, [makeEl('span', {}, [panelVal])]),
  ]);

  const loc = createHostLocalizer({ root });
  loc.setEnabled(true);
  assert.equal(sidebarTxt.nodeValue, '新建对话', 'normal host UI still translates');
  assert.equal(sliderVal.nodeValue, 'Medium', 'effort slider value must stay untouched');
  assert.equal(triggerVal.nodeValue, 'High', 'model selector trigger must stay untouched');
  assert.equal(panelVal.nodeValue, 'Low', 'model selector panel must stay untouched');
  loc.dispose();
});
