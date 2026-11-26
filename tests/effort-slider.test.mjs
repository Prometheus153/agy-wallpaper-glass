import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, validateSettings } from '../sidecars/glass/config.mjs';
import {
  buildEffortIndexFromOptions,
  commitAntigravityModelOption,
  createEffortSlider,
  effortFillBackground,
  effortTextColor,
  isClaudeModel,
  normalizeEffortKey,
  parseModelLabel,
  readAntigravityFiberContext,
  resolveEffortProfile,
} from '../sidecars/glass/effort-slider.mjs';

function makeNode(tag, attrs = {}, children = []) {
  const listeners = new Map();
  const classSet = new Set();
  const el = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id: attrs.id || '',
    className: attrs.class || '',
    textContent: attrs.text || '',
    attrs: new Map(Object.entries(attrs)),
    childNodes: [],
    parentElement: null,
    parentNode: null,
    style: {},
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
    querySelector(sel) {
      const match = n => {
        if (sel.startsWith('#')) return n.id === sel.slice(1);
        if (sel.includes('model-selector-trigger')) return n.getAttribute('data-testid') === 'model-selector-trigger';
        if (sel.includes('model-selector-panel')) return n.getAttribute('data-testid') === 'model-selector-panel';
        if (sel.includes('opacity-70')) return n.className.includes('opacity-70') || n.getAttribute('data-agy-effort-badge') !== null;
        if (sel === '.agy-eff-track') return n.className.includes('agy-eff-track');
        if (sel === '.agy-eff-section') return n.className.includes('agy-eff-section');
        return false;
      };
      const walk = node => {
        for (const c of node.childNodes) {
          if (match(c)) return c;
          const found = walk(c);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    },
    closest(sel) {
      let cur = this;
      while (cur) {
        if (sel === '[data-agy-effort-own="true"]' && cur.getAttribute?.('data-agy-effort-own') === 'true') return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    contains(t) { return t === this || this.childNodes.some(c => c === t || c.contains?.(t)); },
  };
  el.append(...children);
  return el;
}

test('config validates effortSliderEnabled, effortSliderStyle, and effortSliderEffects', () => {
  assert.equal(DEFAULTS.effortSliderEnabled, true);
  assert.equal(DEFAULTS.effortSliderStyle, 'auto');
  assert.equal(DEFAULTS.effortSliderEffects, true);

  const s = validateSettings({ effortSliderEnabled: false, effortSliderStyle: 'claude', effortSliderEffects: false });
  assert.equal(s.effortSliderEnabled, false);
  assert.equal(s.effortSliderStyle, 'claude');
  assert.equal(s.effortSliderEffects, false);

  assert.throws(() => validateSettings({ effortSliderStyle: 'neon' }), /思考强度滑条风格无效/);
  assert.throws(() => validateSettings({ effortSliderEnabled: 'on' }), /开关值无效/);
});

test('effort-slider parses model labels, sorts effort tiers, and distinguishes Codex vs Claude palettes', () => {
  assert.equal(normalizeEffortKey('Extra High'), 'xhigh');
  assert.deepEqual(parseModelLabel('Gemini 4 Neon (High)'), { base: 'Gemini 4 Neon', effort: 'high', effortLabel: 'High' });
  assert.deepEqual(parseModelLabel('Claude 4.7 Opus Medium'), { base: 'Claude 4.7 Opus', effort: 'medium', effortLabel: 'Medium' });
  assert.equal(isClaudeModel('Claude 4.7 Opus'), true);
  assert.equal(isClaudeModel('Gemini 4 Neon'), false);

  const options = [
    { label: 'Gemini 4 Neon (High)', modelId: 'g4-hi' },
    { label: 'Gemini 4 Neon (Low)', modelId: 'g4-lo' },
    { label: 'Gemini 4 Neon (Extra High)', modelId: 'g4-xh' },
    { label: 'Gemini 4 Neon (Medium)', modelId: 'g4-md' },
    { label: 'Claude 4.7 Opus (Low)', modelId: 'c4-lo' },
    { label: 'Claude 4.7 Opus (High)', modelId: 'c4-hi' },
  ];
  const idx = buildEffortIndexFromOptions(options);
  assert.equal(idx.get('Gemini 4 Neon').size, 4);
  assert.equal(idx.get('Claude 4.7 Opus').size, 2);

  const prof = resolveEffortProfile({ modelOptions: options, selectedModel: options[3], effortIndex: idx, orchestratorPlanners: [] });
  assert.equal(prof.baseName, 'Gemini 4 Neon');
  assert.deepEqual(prof.levels.map(l => l.key), ['low', 'medium', 'high', 'xhigh']);
  assert.equal(prof.activeIndex, 1);
  assert.equal(prof.locked, false);

  assert.match(effortFillBackground(0.9, false), /#4d93f8/);
  assert.match(effortFillBackground(0.9, true), /rgba\(142, 118, 192/);
  assert.equal(effortTextColor('high', 2, 3, false), '#8b5cf6');
  assert.equal(effortTextColor('high', 2, 3, true), '#c4b5fd');
});

test('readAntigravityFiberContext prefers outermost unwrapped setter and commitAntigravityModelOption shields focus + keeps menu open', () => {
  const options = [
    { label: 'Gemini 4 Neon (Low)' },
    { label: 'Gemini 4 Neon (Medium)' },
    { label: 'Gemini 4 Neon (High)' },
  ];
  const calls = [];
  let focusCalled = false;
  const fakeEditable = { __lexicalEditor: { focus() { focusCalled = true; } } };
  const origDoc = globalThis.document;
  globalThis.document = { querySelector: sel => (sel.includes('contenteditable') ? fakeEditable : null) };

  try {
    const outerProps = {
      modelOptions: options,
      selectedModel: options[1],
      setSelectedModel(opt) {
        fakeEditable.__lexicalEditor.focus(); // should be temporarily silenced!
        calls.push(['outer-set', opt.label]);
      },
      setIsOpen(v) { calls.push(['setIsOpen', v]); },
    };
    const innerProps = {
      modelOptions: options,
      selectedModel: options[1],
      setSelectedModel() { calls.push(['inner-should-not-run']); },
      setIsOpen() {},
    };
    const panel = {};
    panel['__reactFiber$test'] = { memoizedProps: innerProps, return: { memoizedProps: outerProps, return: null } };

    const ctx = readAntigravityFiberContext(panel);
    assert.ok(ctx);
    assert.equal(commitAntigravityModelOption(ctx, options[2]), true);
    assert.equal(focusCalled, false, 'Lexical focus must be shielded during commit');
    assert.deepEqual(calls, [['outer-set', 'Gemini 4 Neon (High)'], ['setIsOpen', true]]);
    // Focus method must be cleanly restored after commit
    fakeEditable.__lexicalEditor.focus();
    assert.equal(focusCalled, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('createEffortSlider mounts inside model-selector-panel, switches tiers via keyboard, tints trigger, and cleans up on disable/dispose', () => {
  const head = makeNode('head');
  const badge = makeNode('span', { class: 'opacity-70', text: ' Medium' });
  const trigger = makeNode('button', { 'data-testid': 'model-selector-trigger', text: 'Claude 4.7 Opus Medium' }, [badge]);
  const panel = makeNode('div', { 'data-testid': 'model-selector-panel' });
  const body = makeNode('body', {}, [trigger, panel]);
  const doc = {
    head,
    body,
    createElement: tag => makeNode(tag),
    getElementById: id => head.querySelector(`#${id}`) || body.querySelector(`#${id}`),
    querySelector: sel => body.querySelector(sel),
  };

  const options = [
    { label: 'Claude 4.7 Opus (Low)' },
    { label: 'Claude 4.7 Opus (Medium)' },
    { label: 'Claude 4.7 Opus (High)' },
  ];
  let committed = null;
  panel['__reactFiber$live'] = {
    memoizedProps: {
      modelOptions: options,
      selectedModel: options[1],
      setSelectedModel(opt) { committed = opt.label; },
      setIsOpen() {},
    },
    return: null,
  };

  let curSettings = { ...DEFAULTS, enabled: true, effortSliderEnabled: true, effortSliderStyle: 'auto', effortSliderEffects: true };
  const ctrl = createEffortSlider({ doc, getSettings: () => curSettings });

  const section = panel.querySelector('.agy-eff-section');
  assert.ok(section, 'effort slider section should mount inside model-selector-panel');
  assert.equal(section.getAttribute('data-style'), 'claude', 'auto style should select Claude dither style for Claude model');
  assert.ok(badge.style.color, 'trigger effort badge should be tinted');

  // Keyboard ArrowRight advances Medium -> High and commits via Fiber setter
  const track = section.querySelector('.agy-eff-track');
  track.dispatch('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(committed, 'Claude 4.7 Opus (High)');

  // Disabling effortSliderEnabled removes injected DOM and clears trigger tint cleanly
  curSettings = { ...curSettings, effortSliderEnabled: false };
  ctrl.update(curSettings);
  assert.equal(panel.querySelector('.agy-eff-section'), null);
  assert.equal(badge.style.color, '');

  ctrl.dispose();
  assert.equal(head.querySelector('#agy-glass-effort-styles'), null);
});
