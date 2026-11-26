import { DEFAULTS, MAX_MEDIA_BYTES, MAX_PKG_BYTES, validateSettings } from './config.mjs';
import { localizeBuiltinTitle, localizePropLabel, localizeSource, resolveLanguage, tr } from './i18n.mjs';
import { sampleMonetFromImageUrl } from './monet.mjs';
import { createEffortSliderWidget } from './effort-slider.mjs';

const $ = id => document.getElementById(id);
const mode = document.documentElement.dataset.mode;
const qs = new URLSearchParams(location.search);
const token = qs.get('token');
const drawerKey = qs.get('drawer');

const SLIDERS = [
  ['blur', v => `${v}px`],
  ['opacity', v => `${v}%`],
  ['border', v => `${v}%`],
  ['radius', v => `${v}px`],
  ['glassSaturation', v => `${v}%`],
  ['fontSize', v => `${v}px`],
  ['wallpaperBlur', v => `${v}px`],
  ['brightness', v => `${v}%`],
  ['contrast', v => `${v}%`],
  ['saturation', v => `${v}%`],
  ['posX', v => `${v}%`],
  ['posY', v => `${v}%`],
  ['zoom', v => `${v}%`],
  ['wallpaperTransparency', v => `${v}%`],
  ['scrim', v => `${v}%`],
  ['volume', v => `${v}%`],
  ['petSize', v => `${v}px`],
];

const THEME_CARETS = { midnight: '#7dd3fc', frost: '#2563eb', ember: '#f6ad7b' };

let settings = { ...DEFAULTS };
let lastStatus = { code: 'waiting', windows: 0 };
let lastSources = [];
const currentLang = () => resolveLanguage(settings.language);
const L = (key, vars) => tr(currentLang(), key, vars);
const typeLabel = kind => L({
  video: 'typeVideo', image: 'typeImage', scene: 'typeScene', web: 'typeWeb', application: 'typeApplication',
}[kind] || 'typeUnknown');

const isMacPlatform = typeof navigator === 'object' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || '');
const hotkeyCombo = () => (isMacPlatform ? '⌘⌥W' : 'Ctrl+Alt+W');

function applyLanguage() {
  const lang = currentLang();
  document.documentElement.lang = lang;
  document.title = L('pageTitle');
  const langBtn = $('lang-toggle');
  if (langBtn) langBtn.textContent = lang === 'en' ? '中文' : 'EN';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = L(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = L(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = L(el.dataset.i18nTitle); });
  const hk = $('hotkey-hint');
  if (hk) hk.textContent = L('hotkeyHint', { keys: hotkeyCombo() });
  if (lastSources.length) {
    $('library-sources').textContent = lastSources.map(s => `${localizeSource(lang, s.source)}: ${s.path}`).join('\n');
  } else if (libraryItems !== null) {
    $('library-sources').textContent = L('sourceEmpty');
  }
  setStatus(lastStatus);
  if (libraryItems !== null) setLibraryStatus(librarySummary());
  if (typeof syncEffortDemo === 'function' && demoWidget) syncEffortDemo();
}
let media = null;
let sceneProperties = {};
let loaded = false;
let busy = false;
let previewReady = false;
let activeTab = 'wallpaper';
let activeFilter = 'all';
let libraryItems = null;
let hiddenIds = new Set();
let libraryTruncated = false;
let libraryPage = 0;
let libraryPages = 0;
let librarySelection = null;
let thumbnailGeneration = 0;
let saveTimer = null;
let propTimer = null;
const thumbnailCache = new Map();
const libraryPageSize = 12;

async function api(path, data = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (mode === 'preview') headers['X-Agy-Preview'] = '1';
  else if (mode === 'drawer' && drawerKey) headers['X-Drawer-Key'] = drawerKey;
  else if (token) headers['X-Sidecar-Token'] = token;
  const response = await fetch(`./api/${path}`, { method: 'POST', headers, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || L('errRequest'));
  return result;
}

async function uploadPkg(file) {
  const headers = { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) };
  if (mode === 'preview') headers['X-Agy-Preview'] = '1';
  else if (mode === 'drawer' && drawerKey) headers['X-Drawer-Key'] = drawerKey;
  else if (token) headers['X-Sidecar-Token'] = token;
  const response = await fetch('./api/import-pkg', { method: 'POST', headers, body: file });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || L('errPkgImport'));
  return result;
}

function setSaveState(text, error = false) {
  $('save-state').textContent = text;
  $('save-state').classList.toggle('error', error);
}

function setStatus(value) {
  lastStatus = value || { code: 'waiting', windows: 0 };
  const labels = {
    disabled: L('statusDisabled'), waiting: L('statusWaiting'),
    connected: L('statusConnected', { n: lastStatus.windows || 1 }),
    unsupported: L('statusUnsupported'), error: L('statusError'), preview: L('statusPreview'),
  };
  $('connection').textContent = labels[lastStatus.code] || lastStatus.message || L('statusWaiting');
  $('status-dot').className = `status-dot ${lastStatus.code === 'connected' || lastStatus.code === 'preview' ? 'connected' : lastStatus.code === 'error' ? 'error' : ''}`;
}

function updateSliderFill(el) {
  const min = Number(el.min) || 0;
  const max = Number(el.max) || 100;
  const pct = max > min ? ((Number(el.value) - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--pct', `${Math.max(0, Math.min(100, pct))}%`);
}

function updatePreview(reloadNonce = '') {
  if (!previewReady || !$('preview')?.contentWindow) return;
  const activeProps = librarySelection ? (sceneProperties[librarySelection] || {}) : {};
  $('preview').contentWindow.postMessage({
    type: 'agy-glass-preview',
    payload: { settings, media, sceneProperties: activeProps, reloadNonce },
  }, location.origin);
}

function rgbFloatToHex(str) {
  const parts = String(str || '1 1 1').trim().split(/\s+/).map(Number);
  const toHex = n => Math.max(0, Math.min(255, Math.round((Number.isFinite(n) ? n : 1) * 255))).toString(16).padStart(2, '0');
  return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`;
}
function hexToRgbFloat(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [1, 2, 3].map(i => (parseInt(m[i], 16) / 255).toFixed(3)).join(' ') : '1 1 1';
}

function updateNowPlaying() {
  const img = $('np-avatar-img');
  const glyph = $('np-avatar-glyph');
  const ambient = $('panel-ambient');
  const thumb = media?.thumbUrl || (media?.kind === 'image' ? (media.dataUrl || media.url) : null);
  if (thumb) {
    img.src = thumb;
    img.hidden = false;
    glyph.hidden = true;
    ambient.style.backgroundImage = `url("${thumb.replace(/"/g, '%22')}")`;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
    glyph.hidden = false;
    glyph.textContent = media?.kind === 'scene' ? '❖' : media?.kind === 'web' ? '◎' : media?.kind === 'video' ? '▶' : '✦';
    ambient.style.backgroundImage = '';
  }
  const lang = currentLang();
  $('media-name').textContent = media ? localizeBuiltinTitle(lang, media.name) : L('defaultBg');
  const kindLabel = media ? typeLabel(media.kind) : L('glassLabel');
  const stateLabel = !settings.enabled ? L('stateDisabled') : !media ? L('stateAmbient') : settings.paused ? L('statePaused')
    : media.kind === 'scene' ? L('stateRendering') : media.kind === 'web' ? L('stateRunning') : media.kind === 'video' ? L('statePlaying') : L('stateShowing');
  $('media-subtitle').textContent = `${kindLabel} · ${stateLabel}`;
  $('btn-pause').textContent = settings.paused ? L('btnResume') : L('btnPause');
  $('btn-pause').disabled = !loaded || busy || !media || media.kind === 'image';
  $('btn-reload').disabled = !loaded || busy || !media;
  $('clear-media').disabled = !loaded || busy || !media;
}

function renderSceneProperties() {
  const section = $('scene-props-section');
  const list = $('scene-props-list');
  const specs = Array.isArray(media?.properties) ? media.properties : [];
  if (!specs.length || !librarySelection) { section.hidden = true; list.replaceChildren(); return; }
  section.hidden = false;
  list.replaceChildren();
  const lang = currentLang();
  const overrides = sceneProperties[librarySelection] || {};
  const pushProp = (key, value) => {
    const next = { ...(sceneProperties[librarySelection] || {}), [key]: value };
    sceneProperties = { ...sceneProperties, [librarySelection]: next };
    updatePreview();
    clearTimeout(propTimer);
    propTimer = setTimeout(async () => {
      try {
        const res = await api('scene-properties', { id: librarySelection, properties: next });
        sceneProperties = res.sceneProperties;
        setSaveState(L('toastPropsSaved'));
      } catch (e) { setSaveState(e.message, true); }
    }, 140);
  };
  for (const spec of specs) {
    const cur = Object.hasOwn(overrides, spec.key) ? overrides[spec.key] : spec.value;
    const specLabel = localizePropLabel(lang, spec.text);
    if (spec.type === 'bool') {
      const row = document.createElement('div'); row.className = 'switch-row';
      const label = document.createElement('span'); label.className = 'prop-label'; label.textContent = specLabel;
      const sw = document.createElement('label'); sw.className = 'ios-switch';
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = Boolean(cur);
      input.addEventListener('change', () => pushProp(spec.key, input.checked));
      const track = document.createElement('span'); track.className = 'ios-track';
      sw.append(input, track); row.append(label, sw); list.append(row);
    } else if (spec.type === 'slider') {
      const row = document.createElement('label'); row.className = 'prop-slider';
      const label = document.createElement('span'); label.className = 'prop-label'; label.textContent = specLabel;
      const input = document.createElement('input'); input.type = 'range';
      input.min = String(spec.min); input.max = String(spec.max); input.step = String(spec.step); input.value = String(cur);
      updateSliderFill(input);
      const out = document.createElement('output'); out.className = 'val-pill'; out.textContent = Number(cur).toFixed(spec.step < 1 ? 1 : 0);
      input.addEventListener('input', () => { const v = Number(input.value); out.textContent = v.toFixed(spec.step < 1 ? 1 : 0); updateSliderFill(input); pushProp(spec.key, v); });
      row.append(label, input, out); list.append(row);
    } else if (spec.type === 'combo') {
      const row = document.createElement('div'); row.className = 'switch-row';
      const label = document.createElement('span'); label.className = 'prop-label'; label.textContent = specLabel;
      const sel = document.createElement('select'); sel.className = 'glass-select'; sel.style.maxWidth = '145px';
      for (const opt of spec.options || []) { const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label; sel.append(o); }
      sel.value = String(cur); sel.addEventListener('change', () => pushProp(spec.key, sel.value));
      row.append(label, sel); list.append(row);
    } else if (spec.type === 'color') {
      const row = document.createElement('div'); row.className = 'color-row';
      const label = document.createElement('span'); label.className = 'prop-label'; label.textContent = specLabel;
      const input = document.createElement('input'); input.type = 'color'; input.value = rgbFloatToHex(cur);
      input.addEventListener('input', () => pushProp(spec.key, hexToRgbFloat(input.value)));
      row.append(label, input); list.append(row);
    } else if (spec.type === 'textinput') {
      const row = document.createElement('label'); row.className = 'field-stack';
      const label = document.createElement('span'); label.textContent = specLabel;
      const input = document.createElement('input'); input.type = 'text'; input.className = 'glass-input'; input.maxLength = 200; input.value = String(cur ?? '');
      input.addEventListener('input', () => pushProp(spec.key, input.value));
      row.append(label, input); list.append(row);
    }
  }
}

function syncPaginationButtons() {
  $('library-prev').disabled = !loaded || busy || libraryPage <= 0;
  $('library-next').disabled = !loaded || busy || libraryPage >= libraryPages - 1;
  $('library-refresh').disabled = !loaded || busy;
  $('btn-import-folder').disabled = !loaded || busy;
}

let monetSampleKey = '';
let monetSampleSeq = 0;

function updateMonetPreview() {
  const bar = $('monet-bar');
  if (!bar) return;
  const enabled = Boolean(settings.dynamicAccent);
  bar.hidden = !enabled;
  if (!enabled) {
    document.documentElement.style.removeProperty('--accent');
    monetSampleKey = '';
    return;
  }
  const src = media?.thumbUrl || (media?.kind === 'image' ? (media.dataUrl || media.url) : null) || '';
  if (!src) {
    $('monet-meta').textContent = L('monetFallback');
    $('monet-hex').textContent = '';
    return;
  }
  const key = `${settings.theme}|${src}`;
  if (key === monetSampleKey) return;
  monetSampleKey = key;
  const seq = ++monetSampleSeq;
  $('monet-meta').textContent = L('monetSampling');
  void sampleMonetFromImageUrl(src, { theme: settings.theme }).then(pal => {
    if (seq !== monetSampleSeq || !settings.dynamicAccent) return;
    if (!pal) {
      $('monet-meta').textContent = L('monetFallback');
      $('monet-hex').textContent = '';
      return;
    }
    pal.swatches.forEach((hex, idx) => {
      const dot = $(`monet-dot-${idx}`);
      if (dot) dot.style.background = hex;
    });
    $('monet-meta').textContent = L('monetActive');
    $('monet-hex').textContent = pal.accentHex.toUpperCase();
    document.documentElement.style.setProperty('--accent', pal.accentHex);
  });
}

function renderControls() {
  for (const [key, fmt] of SLIDERS) {
    const el = $(key);
    if (!el) continue;
    el.value = String(settings[key]);
    updateSliderFill(el);
    $(`${key}-value`).textContent = fmt(settings[key]);
  }
  $('fontFamily').value = settings.fontFamily;
  $('caret').value = settings.caret;
  $('flipX').checked = settings.flipX;
  $('pauseWhenHidden').checked = settings.pauseWhenHidden;
  $('pointerParallax').checked = settings.pointerParallax;
  if ($('hostZhUi')) $('hostZhUi').checked = Boolean(settings.hostZhUi);
  if ($('dynamicAccent')) $('dynamicAccent').checked = Boolean(settings.dynamicAccent);
  if ($('effortSliderEnabled')) $('effortSliderEnabled').checked = settings.effortSliderEnabled !== false;
  if ($('effortSliderEffects')) $('effortSliderEffects').checked = settings.effortSliderEffects !== false;
  const effStyle = settings.effortSliderStyle || 'auto';
  document.querySelectorAll('[data-effort-style]').forEach(btn => btn.classList.toggle('active', btn.dataset.effortStyle === effStyle));
  syncEffortDemo();
  const entry = settings.entryMode === 'pill' || settings.petEnabled === false ? 'pill' : 'pet';
  document.querySelectorAll('[data-entry]').forEach(btn => btn.classList.toggle('active', btn.dataset.entry === entry));
  if ($('pet-size-row')) $('pet-size-row').hidden = entry !== 'pet';
  $('toggle-enabled').checked = settings.enabled;
  $('toggle-enabled').disabled = !loaded || busy;
  $('disable').disabled = !loaded || busy || !settings.enabled;

  document.querySelectorAll('[data-theme]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.theme === settings.theme)));
  document.querySelectorAll('[data-perf]').forEach(btn => btn.classList.toggle('active', btn.dataset.perf === (settings.performanceMode || 'balanced')));
  document.querySelectorAll('[data-fps]').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.fps) === (settings.fpsLimit || 30)));
  document.querySelectorAll('[data-rate]').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.rate) === settings.playbackRate));
  document.querySelectorAll('[data-fit]').forEach(btn => btn.classList.toggle('active', btn.dataset.fit === settings.fit));

  syncPaginationButtons();
  updateNowPlaying();
  updateMonetPreview();
  renderSceneProperties();
  updatePreview();
}

function setLibraryStatus(text, error = false) {
  $('library-status').textContent = text;
  $('library-status').classList.toggle('error', error);
}

function librarySummary() {
  if (!libraryItems) return '';
  const total = libraryItems.length;
  const avail = libraryItems.filter(i => i.available).length;
  const scenes = libraryItems.filter(i => i.type === 'scene' && i.available).length;
  const videos = libraryItems.filter(i => i.type === 'video' && i.available).length;
  return L('libSummary', { total, avail, scenes, videos }) + (libraryTruncated ? L('libTruncated') : '');
}

function renderLibrary() {
  const lang = currentLang();
  const query = $('library-search').value.trim().toLocaleLowerCase();
  const matches = (libraryItems || []).filter(item =>
    item.title.toLocaleLowerCase().includes(query) &&
    (activeFilter === 'hidden'
      ? hiddenIds.has(item.id)
      : !hiddenIds.has(item.id) && (activeFilter === 'all' || (activeFilter === 'builtin' ? item.builtin : item.type === activeFilter))));

  libraryPages = Math.ceil(matches.length / libraryPageSize);
  libraryPage = Math.max(0, Math.min(libraryPage, Math.max(0, libraryPages - 1)));
  const pageItems = matches.slice(libraryPage * libraryPageSize, (libraryPage + 1) * libraryPageSize);

  const grid = $('library-grid');
  grid.replaceChildren();
  const previews = [];

  for (const item of pageItems) {
    const hidden = hiddenIds.has(item.id);
    const displayTitle = item.builtin ? localizeBuiltinTitle(lang, item.title) : item.title;
    const card = document.createElement('div');
    card.className = `wp-card${item.id === librarySelection ? ' selected' : ''}${item.available ? '' : ' disabled'}`;

    const tools = document.createElement('div');
    tools.className = 'wp-card-tools';
    const vis = document.createElement('button');
    vis.type = 'button';
    vis.className = 'wp-mini-btn';
    vis.title = hidden ? L('cardShow') : L('cardHide');
    vis.textContent = hidden ? '↺' : '×';
    vis.addEventListener('click', e => {
      e.stopPropagation();
      void runBusy(async () => {
        const res = await api('library/hide', { id: item.id, hidden: !hidden });
        hiddenIds = new Set(res.hiddenIds);
        renderLibrary();
        setLibraryStatus(L(hidden ? 'toastShown' : 'toastHidden', { title: displayTitle }));
      });
    });
    tools.append(vis);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wp-select-btn';
    btn.disabled = !item.available;
    btn.addEventListener('click', () => void runBusy(async () => {
      setSaveState(L('toastLoading', { title: displayTitle }));
      const res = await api('library/select', { id: item.id });
      media = res.media;
      settings = res.settings;
      librarySelection = res.librarySelection;
      if (res.sceneProperties) sceneProperties = res.sceneProperties;
      setStatus(res.status);
      renderControls();
      renderLibrary();
      setSaveState(L('toastApplied', { title: displayTitle }));
    }));

    const thumb = document.createElement('div');
    thumb.className = 'wp-thumb';
    const placeholder = document.createElement('span');
    placeholder.className = 'wp-placeholder';
    placeholder.textContent = typeLabel(item.type);
    thumb.append(placeholder);
    if (item.hasPreview) {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.hidden = true;
      img.addEventListener('load', () => { img.hidden = false; placeholder.hidden = true; });
      img.addEventListener('error', () => { img.hidden = true; placeholder.hidden = false; });
      thumb.append(img);
      previews.push({ id: item.id, img });
    }
    const badge = document.createElement('span');
    badge.className = `wp-badge ${item.builtin ? 'builtin' : item.type}`;
    badge.textContent = item.builtin ? L('badgeBuiltin') : typeLabel(item.type);
    thumb.append(badge);

    const info = document.createElement('div');
    info.className = 'wp-info';
    const title = document.createElement('strong');
    title.textContent = displayTitle;
    const sub = document.createElement('small');
    const srcLabel = localizeSource(lang, item.source || L('cardSourceFallback'));
    sub.textContent = item.available
      ? `${srcLabel}${item.bytes != null ? ` · ${(item.bytes / 1024 / 1024).toFixed(1)} MB` : ''}`
      : (item.reason || L('cardUnavailable'));
    info.append(title, sub);
    btn.append(thumb, info);
    card.append(tools, btn);
    grid.append(card);
  }

  $('library-page').textContent = L('libPage', { total: matches.length, cur: libraryPages ? libraryPage + 1 : 0, pages: libraryPages });
  syncPaginationButtons();
  $('library-empty').hidden = matches.length > 0;
  $('library-empty').textContent = libraryItems === null
    ? L('emptyScanning')
    : query
      ? L('emptySearch')
      : activeFilter === 'hidden'
        ? L('emptyHidden')
        : !libraryItems.length
          ? L('emptyNone')
          : L('emptyFilter');

  const gen = ++thumbnailGeneration;
  let nextIdx = 0;
  async function pumpThumbs() {
    while (nextIdx < previews.length && gen === thumbnailGeneration && activeTab === 'wallpaper') {
      const { id, img } = previews[nextIdx++];
      try {
        let dataUrl = thumbnailCache.get(id);
        if (dataUrl === undefined) {
          ({ dataUrl } = await api('library/thumbnail', { id }));
          if (gen !== thumbnailGeneration) return;
          thumbnailCache.set(id, dataUrl);
          if (thumbnailCache.size > 48) thumbnailCache.delete(thumbnailCache.keys().next().value);
        }
        if (dataUrl && gen === thumbnailGeneration) img.src = dataUrl;
      } catch {}
    }
  }
  for (let i = 0; i < 4; i++) void pumpThumbs();
}

async function scanLibrary() {
  setLibraryStatus(L('libScanning'));
  const directories = $('library-directory').value.split(/\r\n?|\n/).map(s => s.trim()).filter(Boolean);
  if (directories.length > 12) throw new Error(L('errMaxDirs'));
  const result = await api('library/scan', { directories });
  libraryItems = result.items;
  hiddenIds = new Set(result.hiddenIds || []);
  libraryTruncated = Boolean(result.truncated);
  libraryPage = 0;
  thumbnailCache.clear();
  lastSources = result.sources || [];
  const lang = currentLang();
  $('library-sources').textContent = lastSources.length
    ? lastSources.map(s => `${localizeSource(lang, s.source)}: ${s.path}`).join('\n')
    : L('sourceEmpty');
  renderLibrary();
  setLibraryStatus(librarySummary());
}

async function runBusy(work) {
  if (!loaded || busy) return;
  busy = true;
  renderControls();
  try { await work(); }
  catch (err) { setSaveState(err.message, true); setLibraryStatus(err.message, true); }
  finally { busy = false; renderControls(); }
}

function patchSettings(patch, immediate = false) {
  try { settings = validateSettings(patch, settings); }
  catch (err) { setSaveState(err.message, true); return; }
  if (Object.hasOwn(patch, 'language')) {
    applyLanguage();
    if (libraryItems !== null) renderLibrary();
  }
  renderControls();
  clearTimeout(saveTimer);
  const send = async () => {
    try {
      const res = await api('settings', settings);
      settings = res.settings;
      setStatus(res.status);
      setSaveState(mode === 'preview' ? L('toastPreviewSynced') : L('toastSaved'));
    } catch (err) { setSaveState(err.message, true); }
  };
  if (immediate) void send();
  else saveTimer = setTimeout(send, 120);
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const on = btn.dataset.tab === tab;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  for (const name of ['wallpaper', 'style', 'creative']) {
    const panel = $(`tab-${name}`);
    if (!panel) continue;
    panel.hidden = name !== tab;
    panel.classList.toggle('active', name === tab);
  }
  if (tab === 'wallpaper' && libraryItems !== null) renderLibrary();
}

document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
for (const [key] of SLIDERS) {
  const el = $(key);
  if (el) el.addEventListener('input', () => patchSettings({ [key]: Number(el.value) }, false));
}
$('fontFamily').addEventListener('change', () => patchSettings({ fontFamily: $('fontFamily').value.trim() }, true));
$('caret').addEventListener('input', () => patchSettings({ caret: $('caret').value }, false));
document.querySelectorAll('.color-dot').forEach(dot => dot.addEventListener('click', () => patchSettings({ caret: dot.dataset.caret }, true)));
document.querySelectorAll('[data-theme]').forEach(btn => btn.addEventListener('click', () => {
  const theme = btn.dataset.theme;
  patchSettings({ theme, caret: THEME_CARETS[theme] || settings.caret, enabled: true }, true);
}));
document.querySelectorAll('[data-perf]').forEach(btn => btn.addEventListener('click', () => {
  const perf = btn.dataset.perf;
  const suggestedFps = perf === 'eco' ? 30 : perf === 'ultra' ? 60 : settings.fpsLimit;
  patchSettings({ performanceMode: perf, fpsLimit: suggestedFps }, true);
}));
document.querySelectorAll('[data-fps]').forEach(btn => btn.addEventListener('click', () => patchSettings({ fpsLimit: Number(btn.dataset.fps) }, true)));
$('lang-toggle')?.addEventListener('click', () => patchSettings({ language: currentLang() === 'en' ? 'zh-CN' : 'en' }, true));
document.querySelectorAll('[data-rate]').forEach(btn => btn.addEventListener('click', () => patchSettings({ playbackRate: Number(btn.dataset.rate) }, true)));
document.querySelectorAll('[data-fit]').forEach(btn => btn.addEventListener('click', () => patchSettings({ fit: btn.dataset.fit }, true)));
document.querySelectorAll('[data-entry]').forEach(btn => btn.addEventListener('click', () => {
  const entryMode = btn.dataset.entry;
  patchSettings({ entryMode, petEnabled: entryMode === 'pet' }, true);
}));
for (const boolKey of ['flipX', 'pauseWhenHidden', 'pointerParallax', 'hostZhUi', 'dynamicAccent', 'effortSliderEnabled', 'effortSliderEffects']) {
  const el = $(boolKey);
  if (el) el.addEventListener('change', () => patchSettings({ [boolKey]: el.checked }, true));
}
document.querySelectorAll('[data-effort-style]').forEach(btn => btn.addEventListener('click', () => {
  patchSettings({ effortSliderStyle: btn.dataset.effortStyle }, true);
}));

// Interactive live demo widget in Creative tab
let demoModel = 'gemini';
let demoIdx = { gemini: 2, claude: 1 };
let demoWidget = null;
const DEMO_LEVELS = {
  gemini: [
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Medium' },
    { key: 'high', label: 'High' },
    { key: 'xhigh', label: 'Extra High' },
  ],
  claude: [
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Medium' },
    { key: 'high', label: 'High' },
  ],
};
function syncEffortDemo() {
  const mount = $('effort-demo-mount');
  if (!mount || typeof createEffortSliderWidget !== 'function') return;
  if (!demoWidget) {
    demoWidget = createEffortSliderWidget({
      doc: document,
      title: L('effortSliderTitle'),
      lang: currentLang(),
      styleMode: settings.effortSliderStyle || 'auto',
      effects: settings.effortSliderEffects !== false,
      isDark: () => true,
      onCommit(_level, idx) { demoIdx[demoModel] = idx; },
    });
    mount.replaceChildren(demoWidget.el);
  }
  const levels = DEMO_LEVELS[demoModel] || DEMO_LEVELS.gemini;
  demoWidget.setProfile({
    baseName: demoModel === 'claude' ? 'Claude 4.7 Opus' : 'Gemini 4 Neon',
    isClaude: demoModel === 'claude',
    levels,
    activeIndex: Math.min(levels.length - 1, demoIdx[demoModel] ?? 1),
    locked: false,
  }, {
    title: L('effortSliderTitle'),
    lang: currentLang(),
    styleMode: settings.effortSliderStyle || 'auto',
    effects: settings.effortSliderEffects !== false,
  });
}
document.querySelectorAll('[data-demo-model]').forEach(btn => btn.addEventListener('click', () => {
  demoModel = btn.dataset.demoModel === 'claude' ? 'claude' : 'gemini';
  document.querySelectorAll('[data-demo-model]').forEach(b => b.classList.toggle('active', b === btn));
  syncEffortDemo();
}));
$('toggle-enabled').addEventListener('change', () => patchSettings({ enabled: $('toggle-enabled').checked }, true));
$('disable').addEventListener('click', () => patchSettings({ enabled: false }, true));
$('defaults').addEventListener('click', () => patchSettings({ ...DEFAULTS, enabled: settings.enabled, language: settings.language }, true));
$('btn-pause').addEventListener('click', () => patchSettings({ paused: !settings.paused }, true));
$('btn-reload').addEventListener('click', () => void runBusy(async () => {
  const res = await api('reload');
  setStatus(res.status);
  updatePreview(res.reloadNonce);
  setSaveState(L('toastReloaded'));
}));
$('clear-media').addEventListener('click', () => void runBusy(async () => {
  const res = await api('clear-media');
  media = null;
  librarySelection = null;
  setStatus(res.status);
  renderControls();
  if (libraryItems) renderLibrary();
  setSaveState(L('toastCleared'));
}));

$('library-search').addEventListener('input', () => { libraryPage = 0; renderLibrary(); });
document.querySelectorAll('#library-filter-chips .chip').forEach(chip => chip.addEventListener('click', () => {
  activeFilter = chip.dataset.filter;
  libraryPage = 0;
  document.querySelectorAll('#library-filter-chips .chip').forEach(c => c.classList.toggle('active', c === chip));
  renderLibrary();
}));
$('library-prev').addEventListener('click', () => {
  if (libraryPage <= 0) return;
  libraryPage--;
  renderLibrary();
  $('drawer-scroll').scrollTop = 0;
});
$('library-next').addEventListener('click', () => {
  if (libraryPage >= libraryPages - 1) return;
  libraryPage++;
  renderLibrary();
  $('drawer-scroll').scrollTop = 0;
});
$('library-refresh').addEventListener('click', () => void runBusy(scanLibrary));
$('library-directory-form').addEventListener('submit', e => { e.preventDefault(); void runBusy(scanLibrary); });

async function importFolderPath(directory) {
  const clean = directory.trim();
  if (!clean) throw new Error(L('errEmptyPath'));
  setLibraryStatus(L('libImporting'));
  const res = await api('library/import-directory', { directory: clean, autoSelect: true });
  $('library-directory').value = (res.libraryDirectories || []).join('\n');
  libraryItems = res.scan.items;
  hiddenIds = new Set(res.scan.hiddenIds || []);
  libraryTruncated = Boolean(res.scan.truncated);
  libraryPage = 0;
  thumbnailCache.clear();
  lastSources = res.scan.sources || [];
  const lang = currentLang();
  $('library-sources').textContent = lastSources.map(s => `${localizeSource(lang, s.source)}: ${s.path}`).join('\n');
  if (res.selected) {
    media = res.media;
    settings = res.settings;
    librarySelection = res.librarySelection;
    setStatus(res.status);
    setSaveState(L('toastApplied', { title: localizeBuiltinTitle(lang, media?.name || L('wallpaperLabel')) }));
  } else setSaveState(L('toastImportedDir'));
  $('folder-import-box').hidden = true;
  $('folder-import-path').value = '';
  renderControls();
  renderLibrary();
  setLibraryStatus(librarySummary());
}

$('btn-import-folder').addEventListener('click', () => void runBusy(async () => {
  try {
    const picked = await api('library/pick-directory');
    if (picked.cancelled) return;
    if (picked.directory) { await importFolderPath(picked.directory); return; }
  } catch {}
  $('folder-import-box').hidden = !$('folder-import-box').hidden;
  if (!$('folder-import-box').hidden) $('folder-import-path').focus();
}));
$('folder-import-confirm').addEventListener('click', () => void runBusy(() => importFolderPath($('folder-import-path').value)));

$('media-input').addEventListener('change', event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  void runBusy(async () => {
    if (file.name.toLowerCase().endsWith('.pkg')) {
      if (file.size > MAX_PKG_BYTES) throw new Error(L('errPkgTooLarge'));
      setSaveState(L('toastImportingPkg', { name: file.name }));
      const res = await uploadPkg(file);
      media = res.media;
      settings = res.settings;
      librarySelection = res.librarySelection;
      setStatus(res.status);
      renderControls();
      if (libraryItems !== null) await scanLibrary();
      setSaveState(L('toastImportedPkg', { name: media.name }));
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) throw new Error(L('errFileTooLarge'));
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'].includes(file.type)) {
      throw new Error(L('errFileType'));
    }
    setSaveState(L('toastImportingFile'));
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(L('errReadFile')));
      reader.readAsDataURL(file);
    });
    const res = await api('media', { name: file.name, dataUrl });
    media = res.media;
    librarySelection = null;
    if (!settings.enabled) {
      const en = await api('settings', { ...settings, enabled: true });
      settings = en.settings;
      setStatus(en.status);
    }
    renderControls();
    setSaveState(L('toastImportedFile', { name: file.name }));
  });
});

window.addEventListener('keydown', e => {
  if (mode !== 'drawer' || window.parent === window) return;
  const isW = e.code === 'KeyW' || (typeof e.key === 'string' && e.key.toLowerCase() === 'w');
  if (isW && e.altKey && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    window.parent.postMessage({ type: 'agy-glass-drawer-toggle' }, '*');
  } else if (e.key === 'Escape') {
    window.parent.postMessage({ type: 'agy-glass-drawer-close' }, '*');
  }
}, true);

window.addEventListener('message', event => {
  if (event.data?.type === 'agy-glass-pet-patch' && event.data.patch && typeof event.data.patch === 'object') {
    const allowed = {};
    for (const k of ['petY', 'petEnabled', 'entryMode', 'paused', 'theme', 'hostZhUi', 'dynamicAccent']) {
      if (Object.hasOwn(event.data.patch, k)) allowed[k] = event.data.patch[k];
    }
    if (Object.keys(allowed).length && loaded) patchSettings(allowed, true);
    return;
  }
  if (event.source !== $('preview')?.contentWindow || event.origin !== location.origin || event.data?.type !== 'agy-glass-preview-ready') return;
  previewReady = true;
  updatePreview();
});
$('preview')?.addEventListener('load', () => { previewReady = true; updatePreview(); });

applyLanguage();
try {
  const state = await api('state');
  settings = state.settings;
  media = state.media;
  sceneProperties = state.sceneProperties || {};
  librarySelection = state.librarySelection;
  hiddenIds = new Set(state.hiddenIds || []);
  $('library-directory').value = (Array.isArray(state.libraryDirectories) ? state.libraryDirectories : []).join('\n');
  loaded = true;
  applyLanguage();
  renderControls();
  setStatus(state.status);
  setSaveState(state.libraryWarning || L('toastReady'), Boolean(state.libraryWarning));
  void runBusy(scanLibrary);
} catch (err) {
  setSaveState(err.message, true);
  $('connection').textContent = L('connFailed');
}

setInterval(async () => {
  if (!loaded || busy || document.hidden) return;
  try { setStatus(await api('status')); }
  catch { setStatus({ code: 'error' }); }
}, 5000);
