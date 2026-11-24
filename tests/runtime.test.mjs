import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { installGlass } from '../sidecars/glass/runtime.mjs';
import { DEFAULTS } from '../sidecars/glass/config.mjs';

function harness({ compatible = true, reduced = false, native = false } = {}) {
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = new Map(); this.events = new Map(); this.style = {}; this.playCalls = 0; this.pauseCalls = 0; }
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
    prepend(item) { item.parent = this; this.children.unshift(item); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    setAttribute(k, v) { this.attrs.set(k, v); }
    getAttribute(k) { return this.attrs.get(k) ?? null; }
    removeAttribute(k) { this.attrs.delete(k); }
    addEventListener(k, fn) { this.events.set(k, fn); }
    removeEventListener(k) { this.events.delete(k); }
    play() { this.playCalls++; return Promise.resolve(); }
    pause() { this.pauseCalls++; }
    load() {}
  }
  const doc = new Element('document');
  doc.documentElement = new Element('html');
  doc.body = new Element('body');
  doc.head = new Element('head');
  doc.hidden = false;
  doc.createElement = tag => new Element(tag);
  doc.querySelector = selector => compatible && (selector === '.agy-shell' || (native && selector === '[data-testid="title-menu-bar"]')) ? {} : null;
  doc.getElementById = id => compatible && id === 'root' ? {} : null;
  const query = new Element('mediaquery');
  query.matches = reduced;
  const timers = new Map();
  let time = 1000, nextTimer = 0;
  const overlays = [];
  const context = vm.createContext({ document: doc, matchMedia: () => query, Date: { now: () => time }, setInterval: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearInterval: id => timers.delete(id), getComputedStyle: () => ({ backgroundColor: 'rgb(16, 17, 21)', color: 'rgb(230, 230, 230)' }), electronNative: native ? { setTitleBarOverlay: options => { overlays.push(JSON.parse(JSON.stringify(options))); return Promise.resolve(); } } : undefined });
  vm.runInContext(`globalThis.install = (${installGlass.toString()})`, context);
  const payload = { owner: 'test', leaseMs: 15000, settings: { ...DEFAULTS, enabled: true }, media: null };
  return { context, doc, timers, query, payload, overlays, tick: ms => { time += ms; for (const fn of timers.values()) fn(); }, run: p => context.install(p ?? payload) };
}

test('unsupported layouts and disabled settings do not touch DOM', () => {
  for (const h of [harness({ compatible: false }), harness()]) {
    const result = h.run({ ...h.payload, settings: { ...DEFAULTS } });
    assert.equal(result.mounted, false);
    assert.equal(h.doc.head.children.length, 0);
    assert.equal(h.timers.size, 0);
  }
});
test('mount/update/restore is idempotent and keeps unrelated inline styles', () => {
  const h = harness();
  h.doc.documentElement.style.existing = 'keep';
  assert.equal(h.run().mounted, true);
  assert.equal(h.doc.head.children.length, 1);
  assert.equal(h.doc.body.children[0].inert, true);
  h.run({ ...h.payload, settings: { ...h.payload.settings, theme: 'frost', blur: 32 } });
  assert.equal(h.doc.head.children.length, 1);
  assert.match(h.doc.head.children[0].textContent, /blur\(32px\)/);
  assert.match(h.doc.head.children[0].textContent, /239 244 246/);
  h.context.__agyGlass.dispose();
  assert.equal(h.doc.head.children.length, 0);
  assert.equal(h.doc.body.children.length, 0);
  assert.equal(h.doc.documentElement.getAttribute('data-agy-glass'), null);
  assert.equal(h.doc.documentElement.style.existing, 'keep');
  assert.equal(h.timers.size, 0);
  assert.equal(h.doc.events.size, 0);
  assert.equal(h.query.events.size, 0);
  assert.equal(h.context.__agyGlass, undefined);
});
test('heartbeat keeps mount alive and an expired lease self-cleans', () => {
  const h = harness(); h.run();
  h.tick(14000);
  assert.ok(h.context.__agyGlass);
  h.context.__agyGlass.heartbeat();
  h.tick(14000);
  assert.ok(h.context.__agyGlass);
  h.tick(2000);
  assert.equal(h.context.__agyGlass, undefined);
  assert.equal(h.doc.head.children.length, 0);
});
test('video pauses when hidden, respects reduced motion and releases on dispose', () => {
  const h = harness();
  h.run({ ...h.payload, media: { kind: 'video', dataUrl: 'data:video/mp4;base64,test' } });
  const video = h.doc.body.children[0].children[0].children[0];
  assert.equal(video.tagName, 'VIDEO');
  assert.equal(video.muted, true);
  assert.equal(video.playCalls, 1);
  h.doc.hidden = true;
  h.doc.events.get('visibilitychange')();
  assert.equal(video.pauseCalls, 1);
  h.doc.hidden = false;
  h.query.matches = true;
  h.query.events.get('change')();
  assert.equal(video.pauseCalls, 2);
  h.context.__agyGlass.dispose();
  assert.equal(video.pauseCalls, 3);
  assert.equal(video.parent.children.length, 0);
  assert.doesNotThrow(() => video.events.get('error')());
});
test('new owner replaces existing instance; disabling removes it', () => {
  const h = harness(); h.run();
  h.run({ ...h.payload, owner: 'replacement' });
  assert.equal(h.context.__agyGlass.owner, 'replacement');
  assert.equal(h.doc.head.children.length, 1);
  assert.equal(h.timers.size, 1);
  h.run({ ...h.payload, owner: 'replacement', settings: { ...DEFAULTS } });
  assert.equal(h.context.__agyGlass, undefined);
  assert.equal(h.doc.documentElement.getAttribute('data-agy-glass'), null);
});

test('chat stays clear, toolbars keep contrast, and native caption colors restore', () => {
  const h = harness({ native: true });
  h.run({ ...h.payload, media: { kind: 'video', url: 'http://127.0.0.1:12345/wallpaper/test' } });
  const css = h.doc.head.children[0].textContent;
  assert.match(css, /:has\(\[data-testid="conversation-view"\]\) \{ background: transparent !important; backdrop-filter: none !important/);
  assert.match(css, /text-shadow: 0 1px 2px #000/);
  assert.match(css, /pane-titlebar-toolbar/);
  assert.match(css, /\[data-testid="toggle-aux-sidebar"\]\) \{ background: rgb\(17 23 37 \/ 0.72\) !important/);
  assert.match(css, /\[data-testid="toggle-overview-panel"\]/);
  assert.match(css, /rgb\(17 23 37 \/ 0.72\)/);
  assert.equal(h.doc.body.children[0].children[0].children[0].src, 'http://127.0.0.1:12345/wallpaper/test');
  assert.deepEqual(h.overlays[0], { color: '#00000000', symbolColor: '#e7ecf5' });
  h.context.__agyGlass.dispose();
  assert.deepEqual(h.overlays.at(-1), { color: 'rgb(16, 17, 21)', symbolColor: 'rgb(230, 230, 230)' });
});

test('scene wallpaper mounts player iframe, syncs playback/properties, and applies visual filters', () => {
  const h = harness();
  const posted = [];
  const origCreate = h.doc.createElement;
  h.doc.createElement = tag => {
    const el = origCreate(tag);
    if (tag === 'iframe') el.contentWindow = { postMessage: (msg, target) => posted.push({ msg, target }) };
    return el;
  };
  h.run({
    ...h.payload,
    settings: { ...h.payload.settings, theme: 'ember', brightness: 85, contrast: 110, saturation: 150, zoom: 115, flipX: true, wallpaperTransparency: 10, volume: 40, playbackRate: 1.5, fit: 'contain' },
    media: { kind: 'scene', url: 'http://127.0.0.1:47831/player/11111111-1111-4111-8111-111111111111' },
    sceneProperties: { bloom: true },
  });
  const iframe = h.doc.body.children[0].children[0].children[0];
  assert.equal(iframe.tagName, 'IFRAME');
  assert.equal(iframe.src, 'http://127.0.0.1:47831/player/11111111-1111-4111-8111-111111111111');
  const css = h.doc.head.children[0].textContent;
  assert.match(css, /brightness\(85%\) contrast\(110%\) saturate\(150%\)/);
  assert.match(css, /opacity: 0\.9;/);
  assert.ok(posted.some(p => p.msg.type === 'agy-glass-player-update' && p.msg.payload.volume === 40 && p.msg.payload.properties.bloom === true));
  h.run({ ...h.payload, reloadNonce: 'r2', media: { kind: 'scene', url: 'http://127.0.0.1:47831/player/11111111-1111-4111-8111-111111111111' } });
  assert.ok(posted.some(p => p.msg.type === 'agy-glass-player-reload'));
  h.context.__agyGlass.dispose();
  assert.equal(h.doc.body.children.length, 0);
});

test('frost theme enforces light readable surfaces, split borders, review frosted backing, and narrow sidecar pane sizing', () => {
  const h = harness();
  h.run({ ...h.payload, sidecarPort: 47831, settings: { ...h.payload.settings, theme: 'frost' } });
  const css = h.doc.head.children[0].textContent;
  assert.match(css, /color-scheme: light;/);
  assert.match(css, /--foreground: #0f172a !important/);
  assert.match(css, /:is\(button,\[role="button"\]\) \{ --background: #f8fafc !important; \}/);
  assert.match(css, /\[data-testid="agent-input-box"\] div:not\(button\):not\(\[role="button"\]\):not\(button \*\):not\(\[role="button"\] \*\)/);
  assert.match(css, /\[data-panel-resize-handle-id\]/);
  assert.match(css, /\[data-testid\*="review"\]/);
  assert.match(css, /iframe\[src\*="127\.0\.0\.1:47831\/"\]/);
  assert.match(css, /max-width: 356px !important/);
});
