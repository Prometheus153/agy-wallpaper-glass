import { DEFAULTS, MAX_MEDIA_BYTES, MAX_PKG_BYTES, validateSettings } from './config.mjs';

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

const TYPE_LABELS = { video: '视频', image: '图片', scene: '场景', web: '网页', application: '应用', unknown: '未知' };
const THEME_CARETS = { midnight: '#7dd3fc', frost: '#2563eb', ember: '#f6ad7b' };

let settings = { ...DEFAULTS };
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
  if (!response.ok) throw new Error(result.error || '请求失败');
  return result;
}

async function uploadPkg(file) {
  const headers = { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) };
  if (mode === 'preview') headers['X-Agy-Preview'] = '1';
  else if (mode === 'drawer' && drawerKey) headers['X-Drawer-Key'] = drawerKey;
  else if (token) headers['X-Sidecar-Token'] = token;
  const response = await fetch('./api/import-pkg', { method: 'POST', headers, body: file });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '场景包导入失败');
  return result;
}

function setSaveState(text, error = false) {
  $('save-state').textContent = text;
  $('save-state').classList.toggle('error', error);
}

function setStatus(value) {
  const labels = {
    disabled: '已停用', waiting: '等待连接', connected: `已连接 · ${value.windows || 1}`,
    unsupported: '不兼容', error: '连接不可用', preview: '实时预览',
  };
  $('connection').textContent = labels[value.code] || value.message || '等待连接';
  $('status-dot').className = `status-dot ${value.code === 'connected' || value.code === 'preview' ? 'connected' : value.code === 'error' ? 'error' : ''}`;
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
  $('media-name').textContent = media ? media.name : '内置氛围背景';
  const kindLabel = media ? (TYPE_LABELS[media.kind] || '壁纸') : '液态玻璃';
  const stateLabel = !settings.enabled ? '已停用' : !media ? '默认氛围' : settings.paused ? '已暂停' : media.kind === 'scene' ? '渲染中' : media.kind === 'web' ? '运行中' : media.kind === 'video' ? '播放中' : '显示中';
  $('media-subtitle').textContent = `${kindLabel} · ${stateLabel}`;
  $('btn-pause').textContent = settings.paused ? '继续' : '暂停';
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
        setSaveState('场景属性已生效');
      } catch (e) { setSaveState(e.message, true); }
    }, 140);
  };
  for (const spec of specs) {
    const cur = Object.hasOwn(overrides, spec.key) ? overrides[spec.key] : spec.value;
    if (spec.type === 'bool') {
      const row = document.createElement('div'); row.className = 'switch-row';
      const label = document.createElement('span'); label.className = 'prop-label'; label.textContent = spec.text;
      const sw = document.createElement('label'); sw.className = 'ios-switch';
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = Boolean(cur);
      input.addEventListener('change', () => pushProp(spec.key, input.checked));
      const track = document.createElement('span'); track.className = 'ios-track';
      sw.append(input, track); row.append(label, sw); list.append(row);
    } else if (spec.type === 'slider') {
      const row = document.createElement('label'); row.className = 'prop-slider';
      const label = document.createElement('span'); label.className = 'prop-label'; label.textContent = spec.text;
      const input = document.createElement('input'); input.type = 'range';
      input.min = String(spec.min); input.max = String(spec.max); input.step = String(spec.step); input.value = String(cur);
      updateSliderFill(input);
      const out = document.createElement('output'); out.className = 'val-pill'; out.textContent = Number(cur).toFixed(spec.step < 1 ? 1 : 0);
      input.addEventListener('input', () => { const v = Number(input.value); out.textContent = v.toFixed(spec.step < 1 ? 1 : 0); updateSliderFill(input); pushProp(spec.key, v); });
      row.append(label, input, out); list.append(row);
    } else if (spec.type === 'combo') {
      const row = document.createElement('div'); row.className = 'switch-row';
      const label = document.createElement('span'); label.className = 'prop-label'; label.textContent = spec.text;
      const sel = document.createElement('select'); sel.className = 'glass-select'; sel.style.maxWidth = '145px';
      for (const opt of spec.options || []) { const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label; sel.append(o); }
      sel.value = String(cur); sel.addEventListener('change', () => pushProp(spec.key, sel.value));
      row.append(label, sel); list.append(row);
    } else if (spec.type === 'color') {
      const row = document.createElement('div'); row.className = 'color-row';
      const label = document.createElement('span'); label.className = 'prop-label'; label.textContent = spec.text;
      const input = document.createElement('input'); input.type = 'color'; input.value = rgbFloatToHex(cur);
      input.addEventListener('input', () => pushProp(spec.key, hexToRgbFloat(input.value)));
      row.append(label, input); list.append(row);
    } else if (spec.type === 'textinput') {
      const row = document.createElement('label'); row.className = 'field-stack';
      const label = document.createElement('span'); label.textContent = spec.text;
      const input = document.createElement('input'); input.type = 'text'; input.className = 'glass-input'; input.maxLength = 200; input.value = String(cur ?? '');
      input.addEventListener('input', () => pushProp(spec.key, input.value));
      row.append(label, input); list.append(row);
    }
  }
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
  $('petEnabled').checked = settings.petEnabled;
  $('toggle-enabled').checked = settings.enabled;
  $('toggle-enabled').disabled = !loaded || busy;
  $('disable').disabled = !loaded || busy || !settings.enabled;

  document.querySelectorAll('[data-theme]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.theme === settings.theme)));
  document.querySelectorAll('[data-rate]').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.rate) === settings.playbackRate));
  document.querySelectorAll('[data-fit]').forEach(btn => btn.classList.toggle('active', btn.dataset.fit === settings.fit));

  updateNowPlaying();
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
  const available = libraryItems.filter(i => i.available).length;
  const scenes = libraryItems.filter(i => i.type === 'scene' && i.available).length;
  const videos = libraryItems.filter(i => i.type === 'video' && i.available).length;
  return `共 ${total} 项 · 可用 ${available}（场景 ${scenes} · 视频 ${videos}）` + (libraryTruncated ? ' · 已达上限' : '');
}

function renderLibrary() {
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
    const card = document.createElement('div');
    card.className = `wp-card${item.id === librarySelection ? ' selected' : ''}${item.available ? '' : ' disabled'}`;

    const tools = document.createElement('div');
    tools.className = 'wp-card-tools';
    const vis = document.createElement('button');
    vis.type = 'button';
    vis.className = 'wp-mini-btn';
    vis.title = hidden ? '恢复显示' : '隐藏壁纸';
    vis.textContent = hidden ? '↺' : '×';
    vis.addEventListener('click', e => {
      e.stopPropagation();
      void runBusy(async () => {
        const res = await api('library/hide', { id: item.id, hidden: !hidden });
        hiddenIds = new Set(res.hiddenIds);
        renderLibrary();
        setLibraryStatus(`已${hidden ? '恢复' : '隐藏'}「${item.title}」`);
      });
    });
    tools.append(vis);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wp-select-btn';
    btn.disabled = !item.available;
    btn.addEventListener('click', () => void runBusy(async () => {
      setSaveState(`正在加载「${item.title}」…`);
      const res = await api('library/select', { id: item.id });
      media = res.media;
      settings = res.settings;
      librarySelection = res.librarySelection;
      if (res.sceneProperties) sceneProperties = res.sceneProperties;
      setStatus(res.status);
      renderControls();
      renderLibrary();
      setSaveState(`已应用「${item.title}」`);
    }));

    const thumb = document.createElement('div');
    thumb.className = 'wp-thumb';
    const placeholder = document.createElement('span');
    placeholder.className = 'wp-placeholder';
    placeholder.textContent = TYPE_LABELS[item.type] || '壁纸';
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
    badge.textContent = item.builtin ? '内置动态' : (TYPE_LABELS[item.type] || '未知');
    thumb.append(badge);

    const info = document.createElement('div');
    info.className = 'wp-info';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const sub = document.createElement('small');
    sub.textContent = item.available
      ? `${item.source || '壁纸库'}${item.bytes != null ? ` · ${(item.bytes / 1024 / 1024).toFixed(1)} MB` : ''}`
      : (item.reason || '不可用');
    info.append(title, sub);
    btn.append(thumb, info);
    card.append(tools, btn);
    grid.append(card);
  }

  $('library-page').textContent = `${matches.length} 项 · ${libraryPages ? libraryPage + 1 : 0} / ${libraryPages}`;
  $('library-prev').disabled = !loaded || busy || libraryPage <= 0;
  $('library-next').disabled = !loaded || busy || libraryPage >= libraryPages - 1;
  $('library-empty').hidden = matches.length > 0;
  $('library-empty').textContent = libraryItems === null
    ? '正在扫描本机壁纸库…'
    : query
      ? '没有匹配的壁纸。'
      : activeFilter === 'hidden'
        ? '没有已隐藏的壁纸。'
        : !libraryItems.length
          ? '未自动发现壁纸，可点击上方导入场景目录或本地文件。'
          : '当前分类下暂无壁纸。';

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
  setLibraryStatus('正在扫描本机 Steam / Wallpaper Engine…');
  const directories = $('library-directory').value.split(/\r\n?|\n/).map(s => s.trim()).filter(Boolean);
  if (directories.length > 12) throw new Error('额外目录最多 12 个');
  const result = await api('library/scan', { directories });
  libraryItems = result.items;
  hiddenIds = new Set(result.hiddenIds || []);
  libraryTruncated = Boolean(result.truncated);
  libraryPage = 0;
  thumbnailCache.clear();
  $('library-sources').textContent = result.sources.length
    ? result.sources.map(s => `${s.source}：${s.path}`).join('\n')
    : '未自动发现 Steam / Wallpaper Engine，请手动导入目录。';
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
  renderControls();
  clearTimeout(saveTimer);
  const send = async () => {
    try {
      const res = await api('settings', settings);
      settings = res.settings;
      setStatus(res.status);
      setSaveState(mode === 'preview' ? '实时预览已同步' : '已实时生效');
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
  for (const name of ['wallpaper', 'style']) {
    const panel = $(`tab-${name}`);
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
document.querySelectorAll('[data-rate]').forEach(btn => btn.addEventListener('click', () => patchSettings({ playbackRate: Number(btn.dataset.rate) }, true)));
document.querySelectorAll('[data-fit]').forEach(btn => btn.addEventListener('click', () => patchSettings({ fit: btn.dataset.fit }, true)));
for (const boolKey of ['flipX', 'pauseWhenHidden', 'pointerParallax', 'petEnabled']) {
  $(boolKey).addEventListener('change', () => patchSettings({ [boolKey]: $(boolKey).checked }, true));
}
$('toggle-enabled').addEventListener('change', () => patchSettings({ enabled: $('toggle-enabled').checked }, true));
$('disable').addEventListener('click', () => patchSettings({ enabled: false }, true));
$('defaults').addEventListener('click', () => patchSettings({ ...DEFAULTS, enabled: settings.enabled }, true));
$('btn-pause').addEventListener('click', () => patchSettings({ paused: !settings.paused }, true));
$('btn-reload').addEventListener('click', () => void runBusy(async () => {
  const res = await api('reload');
  setStatus(res.status);
  updatePreview(res.reloadNonce);
  setSaveState('已刷新壁纸');
}));
$('clear-media').addEventListener('click', () => void runBusy(async () => {
  const res = await api('clear-media');
  media = null;
  librarySelection = null;
  setStatus(res.status);
  renderControls();
  if (libraryItems) renderLibrary();
  setSaveState('已恢复内置氛围');
}));

$('library-search').addEventListener('input', () => { libraryPage = 0; renderLibrary(); });
document.querySelectorAll('#library-filter-chips .chip').forEach(chip => chip.addEventListener('click', () => {
  activeFilter = chip.dataset.filter;
  libraryPage = 0;
  document.querySelectorAll('#library-filter-chips .chip').forEach(c => c.classList.toggle('active', c === chip));
  renderLibrary();
}));
$('library-prev').addEventListener('click', () => { libraryPage--; renderLibrary(); });
$('library-next').addEventListener('click', () => { libraryPage++; renderLibrary(); });
$('library-refresh').addEventListener('click', () => void runBusy(scanLibrary));
$('library-directory-form').addEventListener('submit', e => { e.preventDefault(); void runBusy(scanLibrary); });

async function importFolderPath(directory) {
  const clean = directory.trim();
  if (!clean) throw new Error('请输入本地文件夹路径');
  setLibraryStatus('正在导入并扫描目录…');
  const res = await api('library/import-directory', { directory: clean, autoSelect: true });
  $('library-directory').value = (res.libraryDirectories || []).join('\n');
  libraryItems = res.scan.items;
  hiddenIds = new Set(res.scan.hiddenIds || []);
  libraryTruncated = Boolean(res.scan.truncated);
  libraryPage = 0;
  thumbnailCache.clear();
  $('library-sources').textContent = res.scan.sources.map(s => `${s.source}：${s.path}`).join('\n');
  if (res.selected) {
    media = res.media;
    settings = res.settings;
    librarySelection = res.librarySelection;
    setStatus(res.status);
    setSaveState(`已应用「${media?.name || '壁纸'}」`);
  } else setSaveState('目录已导入');
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
      if (file.size > MAX_PKG_BYTES) throw new Error('scene.pkg 超过 256 MB，建议直接导入目录免复制播放');
      setSaveState(`正在导入场景包「${file.name}」…`);
      const res = await uploadPkg(file);
      media = res.media;
      settings = res.settings;
      librarySelection = res.librarySelection;
      setStatus(res.status);
      renderControls();
      if (libraryItems !== null) await scanLibrary();
      setSaveState(`已导入场景「${media.name}」`);
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) throw new Error('单文件超过 32 MB，建议通过「导入目录」免复制流式播放');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'].includes(file.type)) {
      throw new Error('支持 PNG/JPG/WebP/GIF/MP4/WebM 或 scene.pkg');
    }
    setSaveState('正在导入本地文件…');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('无法读取所选文件'));
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
    setSaveState(`已导入「${file.name}」`);
  });
});

window.addEventListener('message', event => {
  if (event.data?.type === 'agy-glass-pet-patch' && event.data.patch && typeof event.data.patch === 'object') {
    const allowed = {};
    for (const k of ['petY', 'petEnabled', 'paused', 'theme']) {
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

try {
  const state = await api('state');
  settings = state.settings;
  media = state.media;
  sceneProperties = state.sceneProperties || {};
  librarySelection = state.librarySelection;
  hiddenIds = new Set(state.hiddenIds || []);
  $('library-directory').value = (Array.isArray(state.libraryDirectories) ? state.libraryDirectories : []).join('\n');
  loaded = true;
  renderControls();
  setStatus(state.status);
  setSaveState(state.libraryWarning || '就绪 · 修改即时生效', Boolean(state.libraryWarning));
  void runBusy(scanLibrary);
} catch (err) {
  setSaveState(err.message, true);
  $('connection').textContent = '初始化失败';
}

setInterval(async () => {
  if (!loaded || busy || document.hidden) return;
  try { setStatus(await api('status')); }
  catch { setStatus({ code: 'error' }); }
}, 5000);
