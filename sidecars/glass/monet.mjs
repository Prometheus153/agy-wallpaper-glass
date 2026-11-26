// 32x32 Dynamic Wallpaper Monet Color Extraction (zero external dependencies)

export function rgbToHsl(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h / 6) * 360, s, l];
}

export function hslToRgb(h, s, l) {
  const hn = (((h % 360) + 360) % 360) / 360;
  if (s <= 0) {
    const v = Math.round(Math.max(0, Math.min(1, l)) * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = t => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(hn + 1 / 3) * 255),
    Math.round(hue2rgb(hn) * 255),
    Math.round(hue2rgb(hn - 1 / 3) * 255),
  ];
}

export function rgbToHex(r, g, b) {
  const hex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const clampRange = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function extractPaletteFromRgba(data, width = 32, height = 32, { theme = 'midnight' } = {}) {
  const buckets = Array.from({ length: 12 }, () => ({ weight: 0, sinSum: 0, cosSum: 0, satSum: 0, lumSum: 0 }));
  const totalPixels = Math.min(width * height, Math.floor((data?.length || 0) / 4));

  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4;
    const a = data[off + 3];
    if (a < 128) continue;
    const [h, s, l] = rgbToHsl(data[off], data[off + 1], data[off + 2]);
    if (l < 0.08 || l > 0.94 || s < 0.14) continue;
    const lumWeight = 1 - Math.abs(l - 0.52) * 1.45;
    if (lumWeight <= 0.05) continue;
    const w = (a / 255) * (s * s + 0.12) * lumWeight;
    const idx = Math.floor((((h % 360) + 360) % 360) / 30) % 12;
    const b = buckets[idx];
    const rad = (h * Math.PI) / 180;
    b.weight += w;
    b.sinSum += Math.sin(rad) * w;
    b.cosSum += Math.cos(rad) * w;
    b.satSum += s * w;
    b.lumSum += l * w;
  }

  let best = buckets[0];
  for (let i = 1; i < buckets.length; i++) {
    if (buckets[i].weight > best.weight) best = buckets[i];
  }

  let hue = 205;
  let sat = 0.42;
  if (best.weight > 0.05) {
    hue = ((Math.atan2(best.sinSum, best.cosSum) * 180) / Math.PI + 360) % 360;
    sat = best.satSum / best.weight;
  }

  const isLight = theme === 'frost';
  if (isLight) {
    const accentRgb = hslToRgb(hue, clampRange(sat, 0.56, 0.84), 0.42);
    const tintRgb = hslToRgb(hue, clampRange(sat * 0.42, 0.14, 0.28), 0.95);
    const scrimRgb = hslToRgb(hue, clampRange(sat * 0.30, 0.10, 0.22), 0.96);
    const glowRgb = hslToRgb(hue, clampRange(sat, 0.46, 0.76), 0.68);
    const accentHex = rgbToHex(accentRgb[0], accentRgb[1], accentRgb[2]);
    return {
      hue: Math.round(hue),
      accentHex,
      glassRgb: `${tintRgb[0]} ${tintRgb[1]} ${tintRgb[2]}`,
      scrimRgb: `${scrimRgb[0]} ${scrimRgb[1]} ${scrimRgb[2]}`,
      specularRgb: '255 255 255',
      swatches: [accentHex, rgbToHex(tintRgb[0], tintRgb[1], tintRgb[2]), rgbToHex(glowRgb[0], glowRgb[1], glowRgb[2])],
    };
  }

  const accentRgb = hslToRgb(hue, clampRange(sat, 0.58, 0.88), 0.72);
  const tintRgb = hslToRgb(hue, clampRange(sat * 0.46, 0.22, 0.38), 0.13);
  const scrimRgb = hslToRgb(hue, clampRange(sat * 0.36, 0.16, 0.30), 0.06);
  const specRgb = hslToRgb(hue, clampRange(sat * 0.45, 0.20, 0.52), 0.88);
  const accentHex = rgbToHex(accentRgb[0], accentRgb[1], accentRgb[2]);
  return {
    hue: Math.round(hue),
    accentHex,
    glassRgb: `${tintRgb[0]} ${tintRgb[1]} ${tintRgb[2]}`,
    scrimRgb: `${scrimRgb[0]} ${scrimRgb[1]} ${scrimRgb[2]}`,
    specularRgb: `${specRgb[0]} ${specRgb[1]} ${specRgb[2]}`,
    swatches: [accentHex, rgbToHex(tintRgb[0], tintRgb[1], tintRgb[2]), rgbToHex(specRgb[0], specRgb[1], specRgb[2])],
  };
}

export function sampleMonetFromSource(source, { theme = 'midnight' } = {}) {
  if (!source || typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);
    return extractPaletteFromRgba(data, 32, 32, { theme });
  } catch {
    return null;
  }
}

export function sampleMonetFromImageUrl(url, { theme = 'midnight' } = {}) {
  if (!url || typeof Image !== 'function' || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(sampleMonetFromSource(img, { theme }));
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
