const EFFORT_ORDER = Object.freeze(['off', 'minimal', 'low', 'medium', 'high', 'xhigh']);
const EFFORT_LABELS = Object.freeze({
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra High',
});
const EFFORT_LABELS_ZH = Object.freeze({
  off: '关闭',
  minimal: '极简',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '极高',
});

const MODEL_PAREN_RE = /^(.+?)\s*\((Off|None|Minimal|Min|Low|Medium|Med|High|Extra\s+High|XHigh|Max)\)\s*$/i;
const MODEL_SUFFIX_RE = /^(.+?)\s+(Off|Minimal|Low|Medium|High|Extra\s+High|XHigh)\s*$/i;

export function normalizeEffortKey(raw) {
  const k = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (k === 'off' || k === 'none' || k === 'disabled') return 'off';
  if (k === 'minimal' || k === 'min') return 'minimal';
  if (k === 'low') return 'low';
  if (k === 'medium' || k === 'med' || k === 'default' || k === 'standard') return 'medium';
  if (k === 'high') return 'high';
  if (k === 'extra high' || k === 'xhigh' || k === 'max' || k === 'ultra') return 'xhigh';
  return k;
}

export function isClaudeModel(name) {
  return /\bclaude\b/i.test(String(name || ''));
}

export function isOrchestratorOption(opt) {
  if (!opt || typeof opt !== 'object' || opt.isCustom) return false;
  const id = String(opt.modelId || '');
  if (id === 'gemini-pro-coordinator' || id === 'gemini-pro-orchestrator' || id.startsWith('gemini-pro-orchestrator-')) return true;
  return typeof opt.label === 'string' && /^orchestrator(?:\b|\s*\()/i.test(opt.label.trim());
}

export function parseModelLabel(label) {
  if (typeof label !== 'string' || !label.trim()) return null;
  const trimmed = label.trim();
  const m = MODEL_PAREN_RE.exec(trimmed) || MODEL_SUFFIX_RE.exec(trimmed);
  if (!m) return null;
  const base = m[1].trim();
  const effort = normalizeEffortKey(m[2]);
  if (!base || !EFFORT_ORDER.includes(effort)) return null;
  return { base, effort, effortLabel: EFFORT_LABELS[effort] || m[2] };
}

export function effortDisplayLabel(key, lang = 'zh-CN') {
  const k = normalizeEffortKey(key);
  if (lang === 'zh-CN' && EFFORT_LABELS_ZH[k]) return `${EFFORT_LABELS[k]} · ${EFFORT_LABELS_ZH[k]}`;
  return EFFORT_LABELS[k] || String(key || '');
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function parseHexRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [77, 147, 248];
}

function mixHex(a, b, t) {
  const [r1, g1, b1] = parseHexRgb(a);
  const [r2, g2, b2] = parseHexRgb(b);
  const k = clamp01(t);
  const hex = n => Math.round(n).toString(16).padStart(2, '0');
  return `#${hex(r1 + (r2 - r1) * k)}${hex(g1 + (g2 - g1) * k)}${hex(b1 + (b2 - b1) * k)}`;
}

export function effortFillColor(pct, isClaude = false) {
  const p = clamp01(pct);
  if (isClaude) {
    if (p <= 0.2) return '#71717a';
    if (p <= 0.7) return mixHex('#71717a', '#a78bfa', (p - 0.2) / 0.5);
    return mixHex('#a78bfa', '#704ea2', (p - 0.7) / 0.3);
  }
  if (p <= 0.2) return '#4d93f8';
  if (p <= 0.72) return mixHex('#4d93f8', '#9333ea', (p - 0.2) / 0.52);
  return mixHex('#9333ea', '#4c1d95', (p - 0.72) / 0.28);
}

export function effortFillBackground(pct, isClaude = false) {
  const p = clamp01(pct);
  const endColor = effortFillColor(p, isClaude);
  if (isClaude) {
    if (p <= 0.05) return 'rgba(142, 118, 192, 0.18)';
    return `linear-gradient(90deg, rgba(142, 118, 192, 0.28) 0%, ${endColor} 100%)`;
  }
  if (p <= 0.2) return '#4d93f8';
  if (p <= 0.72) return `linear-gradient(90deg, #4d93f8 0%, ${endColor} 100%)`;
  return `linear-gradient(90deg, #4d93f8 0%, #9333ea 64%, ${endColor} 100%)`;
}

export function effortTextColor(key, index, count, isClaude = false) {
  if (normalizeEffortKey(key) === 'off' || count <= 1) return '';
  const t = count > 1 ? clamp01(index / (count - 1)) : 0;
  return isClaude ? mixHex('#94a3b8', '#c4b5fd', t) : mixHex('#4d93f8', '#8b5cf6', t);
}

export function getReactFiber(el) {
  if (!el || typeof el !== 'object') return null;
  const keys = Object.keys(el);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) return el[k];
  }
  return null;
}

export function buildEffortIndexFromOptions(modelOptions) {
  const indexMap = new Map();
  if (!Array.isArray(modelOptions)) return indexMap;
  for (const opt of modelOptions) {
    if (!opt || opt.isCustom || typeof opt.label !== 'string') continue;
    const parsed = parseModelLabel(opt.label);
    if (!parsed) continue;
    let byEffort = indexMap.get(parsed.base);
    if (!byEffort) {
      byEffort = new Map();
      indexMap.set(parsed.base, byEffort);
    }
    if (!byEffort.has(parsed.effort)) byEffort.set(parsed.effort, opt);
  }
  return indexMap;
}

export function normalizeEffortIndex(rawIndex, modelOptions) {
  const merged = buildEffortIndexFromOptions(modelOptions);
  if (rawIndex instanceof Map) {
    for (const [base, rawBy] of rawIndex.entries()) {
      if (typeof base !== 'string' || !rawBy) continue;
      let byEffort = merged.get(base);
      if (!byEffort) {
        byEffort = new Map();
        merged.set(base, byEffort);
      }
      const entries = rawBy instanceof Map ? rawBy.entries() : Object.entries(rawBy);
      for (const [rk, opt] of entries) {
        const key = normalizeEffortKey(rk);
        if (EFFORT_ORDER.includes(key) && opt && !byEffort.has(key)) byEffort.set(key, opt);
      }
    }
  }
  return merged;
}

export function readAntigravityFiberContext(el) {
  const start = getReactFiber(el);
  if (!start) return null;
  let selectorCtx = null;
  let innerPopover = null;
  let outerPopover = null;
  let conversationId;
  let hasConv = false;
  let globalModelCtx = null;

  let cur = start;
  for (let step = 0; cur && step < 450; step++, cur = cur.return) {
    const props = cur.memoizedProps;
    if (!props || typeof props !== 'object') continue;
    if (!selectorCtx && props.value && typeof props.value === 'object' && Array.isArray(props.value.modelOptions)) {
      selectorCtx = props.value;
    }
    if (typeof props.setIsOpen === 'function' && typeof props.setSelectedModel === 'function' && Array.isArray(props.modelOptions)) {
      if (!innerPopover) innerPopover = props;
      outerPopover = props;
    }
    if (!hasConv && 'conversationId' in props && 'placement' in props) {
      hasConv = true;
      conversationId = props.conversationId;
    }
    if (!globalModelCtx && props.value && typeof props.value === 'object' && typeof props.value.setModelConfigByLabelForConversation === 'function') {
      globalModelCtx = props.value;
    }
    if (selectorCtx && outerPopover && hasConv && globalModelCtx) break;
  }

  if (!selectorCtx && !innerPopover && !outerPopover && !globalModelCtx) return null;
  const modelOptions = outerPopover?.modelOptions || innerPopover?.modelOptions || selectorCtx?.modelOptions || globalModelCtx?.visibleModelConfigs || [];
  const selectedModel = outerPopover?.selectedModel || innerPopover?.selectedModel || selectorCtx?.selectedModel
    || (globalModelCtx && (hasConv && typeof globalModelCtx.getModelConfigForConversation === 'function'
      ? globalModelCtx.getModelConfigForConversation(conversationId)
      : globalModelCtx.currentModelConfig)) || null;
  const effortIndex = normalizeEffortIndex(selectorCtx?.effortIndex, modelOptions);
  const unwrappedSetSelectedModel = outerPopover?.setSelectedModel || innerPopover?.setSelectedModel || selectorCtx?.setSelectedModel || null;
  const setIsOpen = outerPopover?.setIsOpen || innerPopover?.setIsOpen || selectorCtx?.setIsOpen || null;
  const orchestratorPlanners = selectorCtx?.orchestratorPlanners || outerPopover?.orchestratorPlanners || innerPopover?.orchestratorPlanners || [];
  const orchestratorPlannerIndex = orchestratorPlanners.length
    ? normalizeEffortIndex(selectorCtx?.orchestratorPlannerIndex || outerPopover?.orchestratorPlannerIndex, orchestratorPlanners)
    : new Map();
  const orchestratorPick = selectorCtx?.orchestratorPick || outerPopover?.orchestratorPick || innerPopover?.orchestratorPick || null;
  const orchestratorDefaultPlanner = selectorCtx?.orchestratorDefaultPlanner || outerPopover?.orchestratorDefaultPlanner || null;
  const orchestratorModelOption = modelOptions.find(isOrchestratorOption) || null;

  return {
    modelOptions,
    selectedModel,
    effortIndex,
    conversationId,
    unwrappedSetSelectedModel,
    setIsOpen,
    setModelConfigByLabelForConversation: globalModelCtx?.setModelConfigByLabelForConversation || null,
    setCurrentModelConfigByLabel: globalModelCtx?.setCurrentModelConfigByLabel || null,
    orchestratorPlanners,
    orchestratorPlannerIndex,
    orchestratorPick,
    orchestratorDefaultPlanner,
    orchestratorModelOption,
  };
}

export function resolveEffortProfile(ctx, targetBase = null, preferredEffortMap = null) {
  if (!ctx) return null;
  const selected = ctx.selectedModel;
  const isOrch = !targetBase && isOrchestratorOption(selected) && ctx.orchestratorPlanners.length > 0;
  const index = isOrch ? ctx.orchestratorPlannerIndex : ctx.effortIndex;

  let activeOpt = selected;
  if (isOrch) {
    const pickedVal = ctx.orchestratorPick?.value ?? ctx.orchestratorPick?.selected;
    activeOpt = ctx.orchestratorPlanners.find(p => p.value === pickedVal || p.label === pickedVal)
      || ctx.orchestratorDefaultPlanner
      || ctx.orchestratorPlanners[0];
  }

  const parsedSelected = parseModelLabel(activeOpt?.label || '');
  const baseName = targetBase || parsedSelected?.base || activeOpt?.label || '';
  if (!baseName) return null;

  let byEffort = index.get(baseName);
  if (!byEffort) {
    const lowBase = baseName.toLowerCase();
    for (const [k, v] of index.entries()) {
      if (k.toLowerCase() === lowBase) { byEffort = v; break; }
    }
  }

  const levels = [];
  if (byEffort && byEffort.size > 0) {
    for (const key of EFFORT_ORDER) {
      const opt = byEffort.get(key);
      if (opt) levels.push({ key, label: EFFORT_LABELS[key] || key, option: opt });
    }
  }

  if (levels.length === 0) {
    const fallbackOpt = ctx.modelOptions.find(o => o?.label === baseName) || activeOpt;
    return {
      baseName,
      isClaude: isClaudeModel(baseName),
      isOrchestrator: isOrch,
      levels: [{ key: 'medium', label: 'Default', option: fallbackOpt }],
      activeIndex: 0,
      locked: true,
    };
  }

  let activeKey = parsedSelected?.base?.toLowerCase() === baseName.toLowerCase()
    ? parsedSelected.effort
    : (preferredEffortMap?.get(baseName) || 'medium');
  let activeIndex = levels.findIndex(l => l.key === activeKey);
  if (activeIndex < 0) activeIndex = Math.min(levels.length - 1, Math.floor(levels.length / 2));

  return {
    baseName,
    isClaude: isClaudeModel(baseName),
    isOrchestrator: isOrch,
    levels,
    activeIndex,
    locked: levels.length <= 1,
  };
}

export function commitAntigravityModelOption(ctx, targetOption, { isOrchestrator = false } = {}) {
  if (!ctx || !targetOption) return false;
  try {
    if (isOrchestrator && ctx.orchestratorPick && typeof ctx.orchestratorPick.select === 'function') {
      ctx.orchestratorPick.select(targetOption.value ?? targetOption.label);
      return true;
    }
    if (typeof ctx.setModelConfigByLabelForConversation === 'function' && targetOption.label) {
      ctx.setModelConfigByLabelForConversation(targetOption.label, ctx.conversationId, true);
      return true;
    }
    if (typeof ctx.unwrappedSetSelectedModel === 'function') {
      // Temporarily shield Lexical editor & DOM focus theft so the model popover stays open while dragging
      const editable = typeof document !== 'undefined' ? document.querySelector?.('[contenteditable="true"]') : null;
      const editor = editable?.__lexicalEditor || null;
      const editorProto = editor ? Object.getPrototypeOf(editor) : null;
      const origEditorFocus = typeof editorProto?.focus === 'function' ? editorProto.focus : null;
      const origInstFocus = editor && Object.hasOwn(editor, 'focus') ? editor.focus : null;
      const origHtmlFocus = typeof HTMLElement !== 'undefined' ? HTMLElement.prototype.focus : null;
      const noop = () => {};
      if (origEditorFocus) editorProto.focus = noop;
      if (origInstFocus) editor.focus = noop;
      if (origHtmlFocus) HTMLElement.prototype.focus = noop;
      try {
        ctx.unwrappedSetSelectedModel(targetOption);
      } finally {
        if (origEditorFocus) editorProto.focus = origEditorFocus;
        if (origInstFocus) editor.focus = origInstFocus;
        if (origHtmlFocus) HTMLElement.prototype.focus = origHtmlFocus;
      }
      if (typeof ctx.setIsOpen === 'function') {
        try { ctx.setIsOpen(true); } catch {}
      }
      return true;
    }
    if (typeof ctx.setCurrentModelConfigByLabel === 'function' && targetOption.label) {
      ctx.setCurrentModelConfigByLabel(targetOption.label);
      return true;
    }
  } catch {}
  return false;
}

function hash01(a, b, c) {
  let n = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1274126177, 2246822519) ^ Math.imul(c + 3266489917, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function paintClaudeDither(ctx, w, h, dark, pct, timeSec, effects) {
  if (!ctx || w <= 0 || h <= 0) return;
  ctx.clearRect(0, 0, w, h);
  const strength = Math.max(0.28, clamp01(pct));
  const wash = ctx.createLinearGradient(0, 0, w, 0);
  wash.addColorStop(0, dark ? 'rgba(112, 78, 162, 0.14)' : 'rgba(142, 118, 192, 0.16)');
  wash.addColorStop(1, dark ? 'rgba(128, 92, 196, 0.78)' : 'rgba(142, 118, 192, 0.88)');
  ctx.globalAlpha = strength;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  const rows = 5;
  const cell = Math.max(2, h / rows);
  const cols = Math.ceil(w / cell);
  const keepRatio = 0.32 + 0.68 * strength;
  for (let col = 0; col < cols; col++) {
    const x = col * cell;
    const t = clamp01(x / Math.max(1, w));
    for (let row = 0; row < rows; row++) {
      if (hash01(col, row, 101) > keepRatio) continue;
      const baseA = (0.18 + 0.78 * t) * (0.55 + 0.45 * hash01(col, row, 17));
      const wave = effects ? Math.pow(Math.max(0, Math.sin(t * 14 - timeSec * (3.2 + pct * 4.5) + row * 1.4)), 3) : 0;
      ctx.globalAlpha = clamp01(baseA + wave * 0.42);
      ctx.fillStyle = dark
        ? (wave > 0.45 ? '#ede9fe' : `rgb(${Math.round(188 + 42 * t)}, ${Math.round(166 + 48 * t)}, 248)`)
        : (wave > 0.45 ? '#ffffff' : `rgb(${Math.round(145 + 45 * t)}, ${Math.round(120 + 50 * t)}, 216)`);
      ctx.fillRect(x + 0.5, row * cell + 0.5, Math.max(1, cell - 1.2), Math.max(1, cell - 1.2));
    }
  }
  ctx.globalAlpha = 1;
}

export const EFFORT_SLIDER_CSS = `
@keyframes agy-eff-sweep { 0% { transform: translateX(-110%); } 100% { transform: translateX(220%); } }
@keyframes agy-eff-star { 0% { transform: translate3d(0,0,0); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translate3d(-110px,0,0); opacity: 0; } }
@keyframes agy-eff-pulse { 0% { box-shadow: 0 0 0 0 rgba(147,51,234,0.55); } 100% { box-shadow: 0 0 0 11px rgba(147,51,234,0); } }
.agy-eff-section { width: 100%; box-sizing: border-box; padding: 9px 10px 10px; margin-top: 4px; border-top: 1px solid var(--glass-border, rgba(255,255,255,0.12)); user-select: none; -webkit-user-select: none; }
.agy-eff-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; font-size: 11.5px; line-height: 1.2; }
.agy-eff-title { opacity: 0.78; font-weight: 500; }
.agy-eff-val { font-weight: 600; font-variant-numeric: tabular-nums; transition: color 0.16s ease; }
.agy-eff-track { position: relative; height: 22px; display: flex; align-items: center; cursor: pointer; touch-action: none; outline: none; }
.agy-eff-track[data-locked="true"] { cursor: default; opacity: 0.62; }
.agy-eff-rail { position: relative; width: 100%; height: 8px; border-radius: 999px; background: rgba(148,163,184,0.24); overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.22); }
.agy-eff-section[data-style="claude"] .agy-eff-rail { height: 14px; border-radius: 999px; border: 1px solid rgba(167,139,250,0.28); }
.agy-eff-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 50%; border-radius: 999px; overflow: hidden; will-change: width; }
.agy-eff-shimmer { position: absolute; inset: 0; width: 45%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent); animation: agy-eff-sweep 2.2s linear infinite; pointer-events: none; opacity: 0; transition: opacity 0.2s; }
.agy-eff-stars { position: absolute; inset: 0; overflow: hidden; pointer-events: none; opacity: 0; transition: opacity 0.2s; }
.agy-eff-star { position: absolute; right: -4px; width: 2px; height: 2px; border-radius: 50%; background: #fff; box-shadow: 0 0 4px rgba(255,255,255,0.9); animation: agy-eff-star linear infinite; }
.agy-eff-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: none; pointer-events: none; }
.agy-eff-section[data-style="claude"] .agy-eff-canvas { display: block; }
.agy-eff-section[data-style="claude"] .agy-eff-shimmer, .agy-eff-section[data-style="claude"] .agy-eff-stars { display: none; }
.agy-eff-ticks { position: absolute; inset: 0; pointer-events: none; }
.agy-eff-tick { position: absolute; top: 50%; width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.45); transform: translate(-50%, -50%); transition: transform 0.14s, background 0.14s; }
.agy-eff-tick.active { background: #fff; transform: translate(-50%, -50%) scale(1.25); }
.agy-eff-knob { position: absolute; top: 50%; left: 50%; width: 15px; height: 15px; border-radius: 50%; background: #fff; border: 2px solid #4d93f8; transform: translate(-50%, -50%); box-shadow: 0 2px 7px rgba(0,0,0,0.35); pointer-events: none; will-change: left, transform; }
.agy-eff-section[data-style="claude"] .agy-eff-knob { width: 16px; height: 16px; border-color: #a78bfa; }
.agy-eff-knob.max-burst { animation: agy-eff-pulse 0.52s ease-out; }
.agy-eff-labels { display: flex; justify-content: space-between; margin-top: 4px; font-size: 9.5px; opacity: 0.65; }
.agy-eff-labels span.on { opacity: 1; font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .agy-eff-shimmer, .agy-eff-star, .agy-eff-knob.max-burst { animation: none !important; } }
`;

export function ensureEffortSliderStyles(doc = document) {
  if (!doc?.head) return null;
  let el = doc.getElementById?.('agy-glass-effort-styles');
  if (!el) {
    el = doc.createElement('style');
    el.id = 'agy-glass-effort-styles';
    el.textContent = EFFORT_SLIDER_CSS;
    doc.head.append(el);
  }
  return el;
}

export function createEffortSliderWidget({
  doc = document,
  title = '推理强度',
  lang = 'zh-CN',
  styleMode = 'auto',
  effects = true,
  isDark = () => true,
  onCommit,
} = {}) {
  ensureEffortSliderStyles(doc);
  const section = doc.createElement('div');
  section.className = 'agy-eff-section';
  section.setAttribute('data-agy-effort-own', 'true');

  const head = doc.createElement('div');
  head.className = 'agy-eff-head';
  const titleEl = doc.createElement('span');
  titleEl.className = 'agy-eff-title';
  titleEl.textContent = title;
  const valEl = doc.createElement('span');
  valEl.className = 'agy-eff-val';
  head.append(titleEl, valEl);

  const track = doc.createElement('div');
  track.className = 'agy-eff-track';
  track.setAttribute('role', 'slider');
  track.setAttribute('tabindex', '0');

  const rail = doc.createElement('div');
  rail.className = 'agy-eff-rail';
  const fill = doc.createElement('div');
  fill.className = 'agy-eff-fill';
  const shimmer = doc.createElement('div');
  shimmer.className = 'agy-eff-shimmer';
  const stars = doc.createElement('div');
  stars.className = 'agy-eff-stars';
  for (let i = 0; i < 12; i++) {
    const s = doc.createElement('i');
    s.className = 'agy-eff-star';
    s.style.top = `${15 + Math.round(hash01(i, 3, 7) * 70)}%`;
    s.style.animationDuration = `${(1.1 + hash01(i, 9, 11) * 1.4).toFixed(2)}s`;
    s.style.animationDelay = `${(-hash01(i, 13, 19) * 2.2).toFixed(2)}s`;
    stars.append(s);
  }
  const canvas = doc.createElement('canvas');
  canvas.className = 'agy-eff-canvas';
  fill.append(shimmer, stars, canvas);
  const ticksEl = doc.createElement('div');
  ticksEl.className = 'agy-eff-ticks';
  rail.append(fill, ticksEl);

  const knob = doc.createElement('div');
  knob.className = 'agy-eff-knob';
  track.append(rail, knob);

  const labelsEl = doc.createElement('div');
  labelsEl.className = 'agy-eff-labels';
  section.append(head, track, labelsEl);

  let profile = { baseName: '', isClaude: false, levels: [{ key: 'medium', label: 'Medium' }], activeIndex: 0, locked: true };
  let curStyle = styleMode;
  let curEffects = Boolean(effects);
  let curLang = lang;
  let shownPct = 0.5;
  let targetPct = 0.5;
  let velocity = 0;
  let dragging = false;
  let disposed = false;
  let rafId = 0;
  let lastTs = 0;

  const isReduced = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const useClaudeVisual = () => (curStyle === 'claude' ? true : curStyle === 'codex' ? false : Boolean(profile.isClaude));
  const pctFor = idx => (profile.levels.length <= 1 ? 1 : clamp01(idx / (profile.levels.length - 1)));
  const idxFor = pct => (profile.levels.length <= 1 ? 0 : Math.round(clamp01(pct) * (profile.levels.length - 1)));

  function renderVisual(pct, ts = 0) {
    const claude = useClaudeVisual();
    const n = profile.levels.length;
    const idx = idxFor(pct);
    const active = profile.levels[idx] || profile.levels[0];
    const allowFx = curEffects && !isReduced();

    section.setAttribute('data-style', claude ? 'claude' : 'codex');
    track.setAttribute('data-locked', String(Boolean(profile.locked)));
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(Math.max(0, n - 1)));
    track.setAttribute('aria-valuenow', String(idx));
    track.setAttribute('aria-valuetext', active?.label || '');

    const pCss = `${(clamp01(pct) * 100).toFixed(2)}%`;
    fill.style.width = pCss;
    fill.style.background = effortFillBackground(pct, claude);
    knob.style.left = pCss;
    knob.style.borderColor = effortFillColor(pct, claude);

    const txtColor = effortTextColor(active?.key, idx, n, claude);
    valEl.textContent = profile.locked ? (active?.label || 'Default') : effortDisplayLabel(active?.key, curLang);
    valEl.style.color = txtColor;

    const fxStrength = allowFx && !profile.locked ? clamp01((pct - 0.3) / 0.7) : 0;
    shimmer.style.opacity = claude ? '0' : (fxStrength * 0.85).toFixed(2);
    stars.style.opacity = claude ? '0' : fxStrength.toFixed(2);

    const tickNodes = ticksEl.childNodes;
    for (let i = 0; i < tickNodes.length; i++) {
      tickNodes[i].classList?.toggle('active', i <= idx);
    }
    const lblNodes = labelsEl.childNodes;
    for (let i = 0; i < lblNodes.length; i++) {
      lblNodes[i].classList?.toggle('on', i === idx);
    }

    if (claude && canvas.getContext) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const w = Math.max(40, Math.round((fill.offsetWidth || 160)));
        const h = Math.max(12, Math.round((fill.offsetHeight || 14)));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        paintClaudeDither(ctx, w, h, Boolean(isDark()), pct, ts * 0.001, allowFx);
      }
    }
  }

  function rebuildTicks() {
    ticksEl.replaceChildren();
    labelsEl.replaceChildren();
    const n = profile.levels.length;
    if (n <= 1) return;
    for (let i = 0; i < n; i++) {
      const t = doc.createElement('span');
      t.className = 'agy-eff-tick';
      t.style.left = `${(pctFor(i) * 100).toFixed(2)}%`;
      ticksEl.append(t);
      const l = doc.createElement('span');
      l.textContent = profile.levels[i].label;
      labelsEl.append(l);
    }
  }

  function step(ts) {
    if (disposed) return;
    const dt = lastTs ? Math.min(0.05, Math.max(0.004, (ts - lastTs) / 1000)) : 0.016;
    lastTs = ts;
    const diff = targetPct - shownPct;
    if (dragging || isReduced()) {
      shownPct = targetPct;
      velocity = 0;
    } else {
      velocity += (diff * 260 - velocity * 22) * dt;
      shownPct = clamp01(shownPct + velocity * dt);
      if (Math.abs(diff) < 0.002 && Math.abs(velocity) < 0.01) {
        shownPct = targetPct;
        velocity = 0;
      }
    }
    renderVisual(shownPct, ts);
    const needContinuous = !disposed && (Math.abs(targetPct - shownPct) > 0.002 || Math.abs(velocity) > 0.01 || (useClaudeVisual() && curEffects && !isReduced()));
    rafId = needContinuous && typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame(step) : 0;
  }

  function ensureAnim() {
    if (disposed || rafId || typeof globalThis.requestAnimationFrame !== 'function') {
      if (!rafId) renderVisual(shownPct, 0);
      return;
    }
    lastTs = 0;
    rafId = globalThis.requestAnimationFrame(step);
  }

  function commitIndex(idx) {
    if (profile.locked || !profile.levels.length) return;
    const clamped = Math.max(0, Math.min(profile.levels.length - 1, idx));
    const prevIdx = profile.activeIndex;
    profile = { ...profile, activeIndex: clamped };
    targetPct = pctFor(clamped);
    if (clamped === profile.levels.length - 1 && clamped !== prevIdx && curEffects && !isReduced()) {
      knob.classList.remove('max-burst');
      void knob.offsetWidth;
      knob.classList.add('max-burst');
    }
    ensureAnim();
    if (clamped !== prevIdx && typeof onCommit === 'function') {
      onCommit(profile.levels[clamped], clamped, profile);
    }
  }

  function pctFromEvent(ev) {
    const r = track.getBoundingClientRect?.();
    if (!r || !r.width) return targetPct;
    return clamp01((ev.clientX - r.left) / r.width);
  }

  function onPointerDown(ev) {
    if (profile.locked || ev.button === 2) return;
    ev.preventDefault?.();
    ev.stopPropagation?.();
    dragging = true;
    try { track.setPointerCapture?.(ev.pointerId); } catch {}
    targetPct = pctFromEvent(ev);
    shownPct = targetPct;
    renderVisual(shownPct, lastTs);
    commitIndex(idxFor(targetPct));
  }
  function onPointerMove(ev) {
    if (!dragging || profile.locked) return;
    ev.stopPropagation?.();
    targetPct = pctFromEvent(ev);
    shownPct = targetPct;
    renderVisual(shownPct, lastTs);
    const idx = idxFor(targetPct);
    if (idx !== profile.activeIndex) commitIndex(idx);
  }
  function onPointerUp(ev) {
    if (!dragging) return;
    ev.stopPropagation?.();
    dragging = false;
    try { track.releasePointerCapture?.(ev.pointerId); } catch {}
    commitIndex(idxFor(targetPct));
  }
  function onKeyDown(ev) {
    if (profile.locked) return;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { ev.preventDefault(); commitIndex(profile.activeIndex + 1); }
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { ev.preventDefault(); commitIndex(profile.activeIndex - 1); }
    else if (ev.key === 'Home') { ev.preventDefault(); commitIndex(0); }
    else if (ev.key === 'End') { ev.preventDefault(); commitIndex(profile.levels.length - 1); }
  }
  const swallow = ev => ev.stopPropagation?.();

  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', onPointerUp);
  track.addEventListener('pointercancel', onPointerUp);
  track.addEventListener('keydown', onKeyDown);
  section.addEventListener('click', swallow);
  section.addEventListener('mouseup', swallow);

  return {
    el: section,
    setProfile(nextProfile, opts = {}) {
      profile = nextProfile || profile;
      if (opts.title !== undefined) titleEl.textContent = opts.title;
      if (opts.lang !== undefined) curLang = opts.lang;
      if (opts.styleMode !== undefined) curStyle = opts.styleMode;
      if (opts.effects !== undefined) curEffects = Boolean(opts.effects);
      rebuildTicks();
      targetPct = pctFor(profile.activeIndex);
      if (!dragging) shownPct = targetPct;
      renderVisual(shownPct, lastTs);
      ensureAnim();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (rafId && typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(rafId);
      rafId = 0;
      section.remove();
    },
  };
}

export function createEffortSlider({ doc = typeof document !== 'undefined' ? document : null, getSettings } = {}) {
  if (!doc?.body) return { update() {}, dispose() {} };

  let settings = typeof getSettings === 'function' ? getSettings() : {};
  let disposed = false;
  let enabled = false;
  let mo = null;
  let scanTimer = 0;
  let activePanel = null;
  let activeWidget = null;
  let activeBaseOverride = null;
  let panelCleanup = null;
  let tintedSpan = null;
  const preferredEffortMap = new Map();

  const getLang = () => (typeof resolveLanguage === 'function' ? resolveLanguage(settings?.language) : 'zh-CN');
  const titleText = () => (typeof tr === 'function' ? tr(getLang(), 'effortSliderTitle') : (getLang() === 'en' ? 'Reasoning Effort' : '推理强度'));
  const isDark = () => (settings?.theme || 'midnight') !== 'frost';
  const styleMode = () => settings?.effortSliderStyle || 'auto';
  const effectsOn = () => settings?.effortSliderEffects !== false;

  function findTrigger() {
    return doc.querySelector?.('[data-testid="model-selector-trigger"]')
      || doc.querySelector?.('button[aria-label^="Select model"]')
      || null;
  }

  function findPanel() {
    return doc.querySelector?.('[data-testid="model-selector-panel"]') || null;
  }

  function clearTriggerTint() {
    if (tintedSpan?.style) {
      tintedSpan.style.color = '';
      tintedSpan.style.opacity = '';
    }
    tintedSpan = null;
  }

  function syncTriggerTint(profile) {
    const trigger = findTrigger();
    const span = trigger?.querySelector?.('span.opacity-70, [data-agy-effort-badge]');
    if (!span?.style) { clearTriggerTint(); return; }
    let prof = profile;
    if (!prof) {
      const parsed = parseModelLabel(trigger.textContent || '');
      if (!parsed) { clearTriggerTint(); return; }
      const idx = Math.max(0, EFFORT_ORDER.indexOf(parsed.effort));
      prof = {
        isClaude: isClaudeModel(parsed.base),
        levels: EFFORT_ORDER.slice(2).map(k => ({ key: k })),
        activeIndex: Math.max(0, idx - 2),
        locked: false,
      };
    }
    const useClaude = styleMode() === 'claude' ? true : styleMode() === 'codex' ? false : Boolean(prof.isClaude);
    const active = prof.levels[prof.activeIndex];
    const color = prof.locked ? '' : effortTextColor(active?.key, prof.activeIndex, prof.levels.length, useClaude);
    if (tintedSpan && tintedSpan !== span) clearTriggerTint();
    tintedSpan = span;
    span.style.color = color;
    span.style.opacity = color ? '1' : '';
  }

  function detachPanel() {
    if (panelCleanup) { panelCleanup(); panelCleanup = null; }
    if (activeWidget) { activeWidget.dispose(); activeWidget = null; }
    activePanel = null;
    activeBaseOverride = null;
  }

  function mountOnPanel(panel) {
    const ctx = readAntigravityFiberContext(panel) || readAntigravityFiberContext(findTrigger());
    const profile = resolveEffortProfile(ctx, activeBaseOverride, preferredEffortMap);
    if (!profile) return;

    if (activePanel !== panel) {
      detachPanel();
      activePanel = panel;
      activeWidget = createEffortSliderWidget({
        doc,
        title: titleText(),
        lang: getLang(),
        styleMode: styleMode(),
        effects: effectsOn(),
        isDark,
        onCommit(level, _idx, prof) {
          if (!level?.option) return;
          preferredEffortMap.set(prof.baseName, level.key);
          const freshCtx = readAntigravityFiberContext(panel) || readAntigravityFiberContext(findTrigger()) || ctx;
          commitAntigravityModelOption(freshCtx, level.option, { isOrchestrator: prof.isOrchestrator });
          syncTriggerTint({ ...prof, activeIndex: prof.levels.findIndex(l => l.key === level.key) });
        },
      });
      panel.append(activeWidget.el);

      const findGroupBase = target => {
        const item = target?.closest?.('[role="menuitem"]');
        if (!item || !panel.contains?.(item)) return null;
        const g = item.querySelector?.('[data-testid="model-selector-effort-group"]');
        return g ? (g.getAttribute?.('data-model-base') || g.textContent?.trim() || null) : null;
      };
      const onUpCapture = ev => {
        if (ev.target?.closest?.('[data-agy-effort-own="true"]')) return;
        if (!findGroupBase(ev.target)) return;
        ev.stopPropagation?.();
        ev.stopImmediatePropagation?.();
      };
      const onClickCapture = ev => {
        if (ev.target?.closest?.('[data-agy-effort-own="true"]')) return;
        const base = findGroupBase(ev.target);
        if (!base) return;
        ev.preventDefault?.();
        ev.stopPropagation?.();
        ev.stopImmediatePropagation?.();
        activeBaseOverride = base;
        const freshCtx = readAntigravityFiberContext(panel) || readAntigravityFiberContext(findTrigger()) || ctx;
        const nextProf = resolveEffortProfile(freshCtx, base, preferredEffortMap);
        if (nextProf) {
          const targetOpt = nextProf.levels[nextProf.activeIndex]?.option;
          if (targetOpt) commitAntigravityModelOption(freshCtx, targetOpt, { isOrchestrator: nextProf.isOrchestrator });
          activeWidget?.setProfile(nextProf, { title: titleText(), lang: getLang(), styleMode: styleMode(), effects: effectsOn() });
          syncTriggerTint(nextProf);
        }
      };
      panel.addEventListener('pointerup', onUpCapture, true);
      panel.addEventListener('mouseup', onUpCapture, true);
      panel.addEventListener('click', onClickCapture, true);
      panelCleanup = () => {
        panel.removeEventListener('pointerup', onUpCapture, true);
        panel.removeEventListener('mouseup', onUpCapture, true);
        panel.removeEventListener('click', onClickCapture, true);
      };
    }

    activeWidget?.setProfile(profile, { title: titleText(), lang: getLang(), styleMode: styleMode(), effects: effectsOn() });
    syncTriggerTint(profile);
  }

  function scan() {
    if (disposed || !enabled) return;
    const panel = findPanel();
    if (panel) {
      mountOnPanel(panel);
    } else {
      if (activePanel) detachPanel();
      syncTriggerTint(null);
    }
  }

  function scheduleScan() {
    if (disposed || !enabled || scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = 0; scan(); }, 40);
  }

  function startObserver() {
    if (mo || typeof MutationObserver !== 'function') return;
    mo = new MutationObserver(records => {
      for (const r of records) {
        if (r.target?.closest?.('[data-agy-effort-own="true"]')) continue;
        scheduleScan();
        return;
      }
    });
    // Observe direct portals on body so model selector popovers are caught without chat-stream overhead
    mo.observe(doc.body, { childList: true });
  }

  function stopObserver() {
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = 0; }
    mo?.disconnect();
    mo = null;
  }

  function update(nextSettings) {
    if (disposed) return;
    if (nextSettings) settings = nextSettings;
    const nextEnabled = Boolean(settings?.enabled && settings?.effortSliderEnabled !== false);
    enabled = nextEnabled;
    if (!enabled) {
      stopObserver();
      detachPanel();
      clearTriggerTint();
      return;
    }
    ensureEffortSliderStyles(doc);
    startObserver();
    scan();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    enabled = false;
    stopObserver();
    detachPanel();
    clearTriggerTint();
    doc.getElementById?.('agy-glass-effort-styles')?.remove?.();
  }

  update(settings);
  return { update, dispose, scan };
}
