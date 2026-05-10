import type { ColorModel, EditorSettings } from '../types';

export interface Rgb { r: number; g: number; b: number; }
export interface Rgba extends Rgb { a: number; }
export interface Oklab { l: number; a: number; b: number; }

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const fmt = (v: number, p = 2): string => String(Number(v.toFixed(p)));
export const luma = (rgb: Rgb): number => 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;

export function parseHex(value: string): Rgba | null {
  const m = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255 };
}

export function toHex(rgb: Rgb): string {
  const part = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
}

export function rgbCss(rgba: Rgba): string {
  if (rgba.a >= 255) return toHex(rgba);
  return `rgba(${Math.round(rgba.r)},${Math.round(rgba.g)},${Math.round(rgba.b)},${fmt(rgba.a / 255, 3)})`;
}

function srgbToLinear(v: number): number { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }
function linearToSrgb(v: number): number { const x = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return clamp(x * 255, 0, 255); }

export function rgbToOklab(rgb: Rgb): Oklab {
  const r = srgbToLinear(rgb.r), g = srgbToLinear(rgb.g), b = srgbToLinear(rgb.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6309787005 * b;
  const l1 = Math.cbrt(l), m1 = Math.cbrt(m), s1 = Math.cbrt(s);
  return { l: 0.2104542553 * l1 + 0.793617785 * m1 - 0.0040720468 * s1, a: 1.9779984951 * l1 - 2.428592205 * m1 + 0.4505937099 * s1, b: 0.0259040371 * l1 + 0.7827717662 * m1 - 0.808675766 * s1 };
}

export function oklabToRgb(lab: Oklab): Rgb {
  const l1 = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m1 = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s1 = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b;
  const l = l1 ** 3, m = m1 ** 3, s = s1 ** 3;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  };
}

export function labDist2(a: Oklab, b: Oklab): number { const dl = a.l - b.l, da = a.a - b.a, db = a.b - b.b; return dl * dl + da * da + db * db; }

export function rgbToHsl(rgb: Rgb): [number, number, number] {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); const d = max - min; let h = 0; const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) { if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60; else if (max === g) h = ((b - r) / d + 2) * 60; else h = ((r - g) / d + 4) * 60; }
  return [h, s, l];
}
export function hslToRgb(h: number, s: number, l: number): Rgb {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1); const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = l - c / 2; let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
export function rgbToHsv(rgb: Rgb): [number, number, number] {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0;
  if (d) { if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60; else if (max === g) h = ((b - r) / d + 2) * 60; else h = ((r - g) / d + 4) * 60; }
  return [h, max === 0 ? 0 : d / max, max];
}
export function hsvToRgb(h: number, s: number, v: number): Rgb { h = ((h % 360) + 360) % 360; const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }; }

export function transform(rgb: Rgb, model: ColorModel, s: EditorSettings): Rgb {
  if (model === 'hsv') { const [h, sat, v] = rgbToHsv(rgb); return hsvToRgb(h + s.hue, clamp(sat * (1 + s.saturation / 100), 0, 1), clamp(v + s.value / 100, 0, 1)); }
  const [h, sat, l] = rgbToHsl(rgb); return hslToRgb(h + s.hue, clamp(sat * (1 + s.saturation / 100), 0, 1), clamp(l + s.lightness / 100, 0, 1));
}

export function protectColor(rgba: Rgba, s: EditorSettings): boolean {
  const max = Math.max(rgba.r, rgba.g, rgba.b), min = Math.min(rgba.r, rgba.g, rgba.b);
  if (s.protectWhite && rgba.r > 238 && rgba.g > 238 && rgba.b > 238) return true;
  if (s.protectBlack && rgba.r < 32 && rgba.g < 32 && rgba.b < 32) return true;
  if (s.protectGray && max - min < 12) return true;
  return false;
}
