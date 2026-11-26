import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, migrateSavedSettings, validateSettings } from '../sidecars/glass/config.mjs';
import { createHostLocalizer, setExternalHostDict, translateHostText } from '../sidecars/glass/zh-ui.mjs';
import { extractPaletteFromRgba } from '../sidecars/glass/monet.mjs';
import { createCatPet } from '../sidecars/glass/pet.mjs';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function makeFakeNode(tag, attrs = {}, children = []) {
  const listeners = new Map();
  const classSet = new Set();
  const el = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id: attrs.id || '',
    hidden: false,
    title: attrs.title || '',
    attrs: new Map(Object.entries(attrs)),
    childNodes: [],
    parentElement: null,
    parentNode: null,
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    classList: {
      add: c => classSet.add(c),
      remove: c => classSet.delete(c),
      toggle: (c, f) => (f === undefined ? (classSet.has(c) ? classSet.delete(c) : classSet.add(c)) : (f ? classSet.add(c) : classSet.delete(c))),
      contains: c => classSet.has(c),
    },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
    setAttribute(k, v) { this.attrs.set(k, String(v)); if (k === 'id') this.id = String(v); },
    append(...nodes) {
      for (const n of nodes) {
        if (!n) continue;
        n.parentElement = this;
        n.parentNode = this;
        this.childNodes.push(n);
      }
    },
    replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); },
    remove() {
      if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(c => c !== this);
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (listeners.has(type)) listeners.set(type, listeners.get(type).filter(f => f !== fn));
    },
    dispatch(type, ev = {}) {
      for (const fn of (listeners.get(type) || [])) fn(ev);
    },
    getBoundingClientRect() { return { left: 240, top: 34, right: 1040, bottom: 800, width: 800, height: 766 }; },
    closest() { return null; },
    contains(t) { return t === this || this.childNodes.some(c => c === t || c.contains?.(t)); },
  };
  el.append(...children);
  return el;
}

function makeText(val) {
  return { nodeType: 3, nodeValue: val, parentElement: null, parentNode: null };
}

test('config validates hostZhUi, dynamicAccent, pet/pill entryMode and migrates legacy hotkey/petEnabled', () => {
  assert.equal(DEFAULTS.hostZhUi, false);
  assert.equal(DEFAULTS.dynamicAccent, false);
  assert.equal(DEFAULTS.entryMode, 'pet');

  const s1 = validateSettings({ hostZhUi: true, dynamicAccent: true, entryMode: 'pill' });
  assert.equal(s1.hostZhUi, true);
  assert.equal(s1.dynamicAccent, true);
  assert.equal(s1.entryMode, 'pill');
  assert.equal(s1.petEnabled, false);

  const migratedLegacy = migrateSavedSettings({ enabled: true, petEnabled: false });
  assert.equal(migratedLegacy.entryMode, 'pill');
  assert.equal(migratedLegacy.petEnabled, false);

  const migratedHotkey = migrateSavedSettings({ enabled: true, entryMode: 'hotkey' });
  assert.equal(migratedHotkey.entryMode, 'pill');

  assert.throws(() => validateSettings({ entryMode: 'hotkey' }), /快捷入口形态无效/);
  assert.throws(() => validateSettings({ entryMode: 'invalid' }), /快捷入口形态无效/);
  assert.throws(() => validateSettings({ hostZhUi: 'yes' }), /开关值无效/);
  assert.throws(() => validateSettings({ dynamicAccent: 1 }), /开关值无效/);
});

test('zh-ui loads full MIT zh-dict.json, translates Models & Usage + quota timers, skips chats/code, and restores losslessly', async () => {
  const fullDict = JSON.parse(await readFile(join(REPO_ROOT, 'sidecars', 'glass', 'vendor', 'zh-dict.json'), 'utf8'));
  assert.ok(Object.keys(fullDict).length > 5000, 'bundled MIT dictionary should have >5000 entries');
  setExternalHostDict(fullDict);

  assert.equal(translateHostText('Application'), '应用设置');
  assert.equal(translateHostText('Not in Project'), '未归入项目');
  assert.equal(translateHostText('Models & Usage'), '模型与用量');
  assert.equal(translateHostText('Orchestrator Settings'), '编排器设置');
  assert.equal(translateHostText('Weekly Limit Remaining'), '每周剩余额度');
  assert.equal(translateHostText('Five Hour Limit Remaining'), '5 小时剩余额度');
  assert.equal(translateHostText('Enable AI credit overages'), '启用 AI 额度超额使用');
  assert.equal(translateHostText('Your plan: Google AI Pro'), '您的套餐：Google AI Pro');
  assert.equal(
    translateHostText('You have used some of your weekly limit, it will fully refresh in 5 days, 3 hours.'),
    '您已使用部分每周额度，将在 5 天 3 小时后完全刷新。',
  );
  assert.equal(
    translateHostText('You have used some of your 5-hour limit, it will fully refresh in 4 hours, 19 minutes.'),
    '您已使用部分 5 小时额度，将在 4 小时 19 分钟后完全刷新。',
  );
  assert.equal(translateHostText('新建对话'), null); // already Chinese -> untouched

  const sidebarText = makeText('New Conversation');
  const appText = makeText('Application');
  const externalZhText = makeText('已由外部汉化');
  const chatProse = makeText('Models & Usage'); // inside conversation-view -> MUST NOT translate!
  const codeText = makeText('Terminal'); // inside <code> -> MUST NOT translate!

  const sidebar = makeFakeNode('aside', {}, [
    makeFakeNode('div', {}, [sidebarText]),
    makeFakeNode('div', {}, [appText]),
    makeFakeNode('div', {}, [externalZhText]),
  ]);
  const input = makeFakeNode('textarea', { placeholder: 'Ask anything, @ to mention, / for actions' });
  const conv = makeFakeNode('section', { 'data-testid': 'conversation-view' }, [
    makeFakeNode('p', {}, [chatProse]),
    makeFakeNode('code', {}, [codeText]),
  ]);
  const root = makeFakeNode('body', {}, [sidebar, input, conv]);

  const loc = createHostLocalizer({ root });
  loc.setEnabled(true);

  assert.equal(sidebarText.nodeValue, '新建对话');
  assert.equal(appText.nodeValue, '应用设置');
  assert.equal(externalZhText.nodeValue, '已由外部汉化');
  assert.equal(input.getAttribute('placeholder'), '输入任何问题，使用 @ 提及，使用 / 执行操作');
  assert.equal(chatProse.nodeValue, 'Models & Usage');
  assert.equal(codeText.nodeValue, 'Terminal');

  loc.setEnabled(false);
  assert.equal(sidebarText.nodeValue, 'New Conversation');
  assert.equal(appText.nodeValue, 'Application');
  assert.equal(input.getAttribute('placeholder'), 'Ask anything, @ to mention, / for actions');
  loc.dispose();
});

test('monet 32x32 extractor outputs valid theme-adapted palettes for warm, cool, light, and monochrome images', () => {
  const fillRgba = (r, g, b) => {
    const arr = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < 32 * 32; i++) {
      arr[i * 4] = r; arr[i * 4 + 1] = g; arr[i * 4 + 2] = b; arr[i * 4 + 3] = 255;
    }
    return arr;
  };

  const warm = extractPaletteFromRgba(fillRgba(235, 110, 60), 32, 32, { theme: 'midnight' });
  assert.match(warm.accentHex, /^#[0-9a-f]{6}$/);
  assert.ok(warm.hue < 45 || warm.hue > 330, `expected warm hue, got ${warm.hue}`);
  assert.equal(warm.swatches.length, 3);

  const coolDark = extractPaletteFromRgba(fillRgba(40, 145, 235), 32, 32, { theme: 'midnight' });
  assert.ok(coolDark.hue >= 185 && coolDark.hue <= 235, `expected blue hue, got ${coolDark.hue}`);

  const coolLight = extractPaletteFromRgba(fillRgba(40, 145, 235), 32, 32, { theme: 'frost' });
  assert.match(coolLight.accentHex, /^#[0-9a-f]{6}$/);
  assert.equal(coolLight.specularRgb, '255 255 255');
  assert.notEqual(coolLight.accentHex, coolDark.accentHex);

  const mono = extractPaletteFromRgba(fillRgba(128, 128, 128), 32, 32, { theme: 'midnight' });
  assert.equal(mono.hue, 205);
  assert.match(mono.accentHex, /^#[0-9a-f]{6}$/);
});

test('pet/pill entry modes, safe drawer top below toolbar, trimmed right-click menu, and Ctrl+Alt+W / Cmd+Opt+KeyW hotkeys', () => {
  const origDoc = globalThis.document;
  const origAdd = globalThis.addEventListener;
  const origRem = globalThis.removeEventListener;
  const winListeners = new Map();

  const body = makeFakeNode('body');
  const fakeToolbar = { getBoundingClientRect: () => ({ left: 950, top: 44, right: 1030, bottom: 80, width: 80, height: 36 }) };
  globalThis.document = {
    body,
    createElement: tag => makeFakeNode(tag),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: sel => (sel.includes('pane-titlebar-toolbar') ? [fakeToolbar] : []),
  };
  globalThis.addEventListener = (t, fn) => {
    if (!winListeners.has(t)) winListeners.set(t, []);
    winListeners.get(t).push(fn);
  };
  globalThis.removeEventListener = (t, fn) => {
    if (winListeners.has(t)) winListeners.set(t, winListeners.get(t).filter(f => f !== fn));
  };

  try {
    let curSettings = { ...DEFAULTS, enabled: true, entryMode: 'pet', petEnabled: true };
    const inst = createCatPet({
      getSettings: () => curSettings,
      assets: null,
      drawerUrl: 'http://127.0.0.1:47831/?drawer=abc',
      isPreview: false,
      onPatch: p => { curSettings = { ...curSettings, ...p }; },
    });

    const petEl = body.childNodes.find(n => n.id === 'agy-glass-pet-root');
    const pillEl = body.childNodes.find(n => n.id === 'agy-glass-pill-root');
    const drawerEl = body.childNodes.find(n => n.id === 'agy-glass-drawer-host');
    const menuEl = body.childNodes.find(n => n.id === 'agy-glass-pet-menu');
    const hitEl = petEl.childNodes.find(n => n.id === 'agy-glass-pet-hit');
    assert.ok(petEl && pillEl && drawerEl && menuEl && hitEl);

    // Drawer clears top-right toolbar (bottom 80 -> top >= 88px)
    assert.ok(Number.parseInt(drawerEl.style.top, 10) >= 88, `drawer top should clear toolbar, got ${drawerEl.style.top}`);

    // Right-click menu has ONLY 3 items (no theme switch, no zh toggle)
    hitEl.dispatch('contextmenu', { preventDefault() {}, stopPropagation() {}, clientX: 800, clientY: 400 });
    assert.equal(menuEl.hidden, false);
    assert.equal(menuEl.childNodes.length, 3);
    const labels = menuEl.childNodes.map(b => b.textContent);
    assert.ok(labels.every(l => !/主题|Theme|汉化|Chinese/i.test(l)));

    // pet mode -> pill mode
    assert.equal(petEl.hidden, false);
    assert.equal(pillEl.hidden, true);
    curSettings = { ...curSettings, entryMode: 'pill', petEnabled: false };
    inst.update(curSettings);
    assert.equal(petEl.hidden, true);
    assert.equal(pillEl.hidden, false);

    // Global hotkeys work in pill mode too (Windows Ctrl+Alt+W, Escape, macOS Cmd+Opt+KeyW with '∑')
    const fireKey = ev => { for (const fn of (winListeners.get('keydown') || [])) fn(ev); };
    fireKey({ ctrlKey: true, altKey: true, metaKey: false, shiftKey: false, code: 'KeyW', key: 'w' });
    assert.equal(inst.isDrawerOpen(), true);
    fireKey({ key: 'Escape' });
    assert.equal(inst.isDrawerOpen(), false);
    fireKey({ ctrlKey: false, altKey: true, metaKey: true, shiftKey: false, code: 'KeyW', key: '∑' });
    assert.equal(inst.isDrawerOpen(), true);
    for (const fn of (winListeners.get('message') || [])) {
      fn({ origin: 'http://127.0.0.1:47831', data: { type: 'agy-glass-drawer-toggle' } });
    }
    assert.equal(inst.isDrawerOpen(), false);

    inst.dispose();
  } finally {
    globalThis.document = origDoc;
    globalThis.addEventListener = origAdd;
    globalThis.removeEventListener = origRem;
  }
});
