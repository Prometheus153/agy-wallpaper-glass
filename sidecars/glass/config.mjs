export const MAX_MEDIA_BYTES = 32 * 1024 * 1024;
export const MAX_PKG_BYTES = 256 * 1024 * 1024;
export const ALLOWED_THEMES = Object.freeze(['midnight', 'frost', 'ember']);
export const ALLOWED_RATES = Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 2]);
export const ALLOWED_FITS = Object.freeze(['cover', 'contain', 'center', 'stretch']);
export const ALLOWED_LANGUAGES = Object.freeze(['auto', 'zh-CN', 'en']);
export const ALLOWED_PERF_MODES = Object.freeze(['eco', 'balanced', 'ultra']);
export const ALLOWED_FPS_LIMITS = Object.freeze([30, 45, 60]);
export const ALLOWED_ENTRY_MODES = Object.freeze(['pet', 'pill', 'hotkey']);

export const DEFAULTS = Object.freeze({
  enabled: false,
  language: 'auto',
  theme: 'midnight',
  // Host UI localization & dynamic wallpaper accent
  hostZhUi: false,
  dynamicAccent: false,
  // Performance
  performanceMode: 'balanced',
  fpsLimit: 30,
  // Liquid Glass appearance
  blur: 16,
  scrim: 40,
  opacity: 58,
  border: 18,
  radius: 18,
  glassSaturation: 150,
  // Typography & caret
  fontFamily: '',
  fontSize: 14,
  caret: '#7dd3fc',
  // Playback & picture
  paused: false,
  wallpaperBlur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  posX: 50,
  posY: 50,
  zoom: 100,
  wallpaperTransparency: 0,
  playbackRate: 1,
  fit: 'cover',
  flipX: false,
  volume: 0,
  pauseWhenHidden: true,
  pointerParallax: true,
  // Quick entry & catgirl desktop pet
  entryMode: 'pet',
  petEnabled: true,
  petSize: 92,
  petY: 46,
});

const intRanges = {
  blur: [0, 32],
  scrim: [0, 85],
  opacity: [10, 95],
  border: [0, 50],
  radius: [0, 28],
  glassSaturation: [100, 220],
  wallpaperBlur: [0, 20],
  fontSize: [12, 20],
  brightness: [20, 200],
  contrast: [20, 200],
  saturation: [0, 200],
  posX: [0, 100],
  posY: [0, 100],
  zoom: [50, 200],
  wallpaperTransparency: [0, 100],
  volume: [0, 100],
  petSize: [60, 140],
  petY: [10, 86],
};

const boolKeys = new Set(['enabled', 'paused', 'flipX', 'pauseWhenHidden', 'pointerParallax', 'petEnabled', 'hostZhUi', 'dynamicAccent']);
const LEGACY_IGNORED_KEYS = new Set(['activePlaylistId', 'autoRotate', 'rotateMinutes']);

export function migrateSavedSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const cleaned = {};
  for (const [key, value] of Object.entries(input)) {
    if (LEGACY_IGNORED_KEYS.has(key)) continue;
    cleaned[key] = key === 'theme' && value === 'cyan' ? 'midnight' : value;
  }
  if (cleaned.entryMode === undefined && cleaned.petEnabled === false) {
    cleaned.entryMode = 'hotkey';
  }
  return validateSettings(cleaned);
}

export function validateSettings(input, previous = DEFAULTS) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('设置必须是对象');
  const next = { ...DEFAULTS, ...previous };
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULTS, key)) throw new Error('未知设置项');
    if (Object.hasOwn(intRanges, key)) {
      const [min, max] = intRanges[key];
      if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} 超出范围`);
    } else if (key === 'theme') {
      if (!ALLOWED_THEMES.includes(value)) throw new Error('未知主题');
    } else if (key === 'language') {
      if (!ALLOWED_LANGUAGES.includes(value)) throw new Error('语言设置无效');
    } else if (key === 'performanceMode') {
      if (!ALLOWED_PERF_MODES.includes(value)) throw new Error('性能档位无效');
    } else if (key === 'fpsLimit') {
      if (!Number.isInteger(value) || !ALLOWED_FPS_LIMITS.includes(value)) throw new Error('帧率上限无效');
    } else if (key === 'entryMode') {
      if (!ALLOWED_ENTRY_MODES.includes(value)) throw new Error('快捷入口形态无效');
    } else if (key === 'playbackRate') {
      if (typeof value !== 'number' || !ALLOWED_RATES.includes(value)) throw new Error('播放倍速无效');
    } else if (key === 'fit') {
      if (!ALLOWED_FITS.includes(value)) throw new Error('适配模式无效');
    } else if (key === 'fontFamily') {
      if (typeof value !== 'string' || value.length > 80 || !/^[\p{L}\p{N} _,-]*$/u.test(value)) {
        throw new Error('字体名称只能包含文字、数字、空格、逗号和短横线');
      }
    } else if (key === 'caret') {
      if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('光标颜色格式无效');
    } else if (boolKeys.has(key)) {
      if (typeof value !== 'boolean') throw new Error('开关值无效');
    } else {
      throw new Error('未知设置项');
    }
    next[key] = value;
  }
  if (Object.hasOwn(input, 'entryMode') && !Object.hasOwn(input, 'petEnabled')) {
    next.petEnabled = next.entryMode === 'pet';
  } else if (Object.hasOwn(input, 'petEnabled') && !Object.hasOwn(input, 'entryMode')) {
    next.entryMode = next.petEnabled ? 'pet' : 'hotkey';
  }
  return next;
}

export function isValidPkgHeader(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 16) return false;
  const magicLen = bytes.readUInt32LE(0);
  if (magicLen < 4 || magicLen > 16 || 4 + magicLen + 4 > bytes.length) return false;
  return bytes.toString('ascii', 4, 4 + magicLen).startsWith('PKGV');
}

export function sanitizeDisplayName(raw, fallback = 'wallpaper') {
  if (typeof raw !== 'string') return fallback;
  return raw.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 180) || fallback;
}

export function validateMedia(input) {
  if (!input || typeof input.name !== 'string' || input.name.length > 180 || typeof input.dataUrl !== 'string') {
    throw new Error('文件信息无效');
  }
  const match = /^data:(image\/(?:png|jpeg|webp|gif)|video\/(?:mp4|webm));base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.dataUrl);
  if (!match || match[2].length > Math.ceil(MAX_MEDIA_BYTES / 3) * 4) {
    throw new Error('只支持 PNG、JPG、WebP、GIF、MP4、WebM，最大 32 MB');
  }
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_MEDIA_BYTES || bytes.toString('base64') !== match[2]) {
    throw new Error('文件编码或大小无效');
  }
  const mime = match[1];
  const valid = {
    'image/png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    'image/webp': bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
    'image/gif': ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)),
    'video/mp4': bytes.toString('ascii', 4, 8) === 'ftyp',
    'video/webm': bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])),
  }[mime];
  if (!valid) throw new Error('文件内容与扩展类型不匹配');
  const name = sanitizeDisplayName(input.name);
  return { name, kind: mime.startsWith('video/') ? 'video' : 'image', dataUrl: input.dataUrl, bytes: bytes.length };
}

export function validateScenePropertyValues(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('场景属性必须是对象');
  const entries = Object.entries(input);
  if (entries.length > 128) throw new Error('场景属性数量过多');
  const clean = Object.create(null);
  for (const [key, value] of entries) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('场景属性名无效');
    if (key.length === 0 || key.length > 100 || /[\x00-\x1f\x7f]/.test(key)) throw new Error('场景属性名无效');
    if (typeof value === 'boolean') clean[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === 'string' && value.length <= 512 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) clean[key] = value;
    else throw new Error('场景属性值无效');
  }
  return Object.assign({}, clean);
}

export function validateScenePropertiesMap(input) {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('场景属性表无效');
  const entries = Object.entries(input);
  if (entries.length > 256) throw new Error('场景属性缓存条目过多');
  const out = {};
  for (const [id, values] of entries) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('场景属性壁纸标识无效');
    out[id] = validateScenePropertyValues(values);
  }
  return out;
}
