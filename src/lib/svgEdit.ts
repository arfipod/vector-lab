import type { EditorSettings, PaletteItem } from '../types';
import { parseHex, protectColor, rgbCss, toHex, transform } from './color';

const ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'];
const STYLE_COLOR = /\b(fill|stroke|stop-color|flood-color|lighting-color)\s*:\s*([^;]+)/gi;
const STYLE_STROKE = /\bstroke-width\s*:\s*([^;]+)/gi;
const SKIP = /^(none|transparent|currentColor|inherit|url\()/i;

function normalize(value: string): string | null {
  const v = value.trim();
  if (!v || SKIP.test(v)) return null;
  const hex = parseHex(v);
  if (hex) return toHex(hex);
  const rgb = v.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgb) return null;
  const parts = rgb[1].split(',').map((p) => Number.parseFloat(p.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
  return toHex({ r: parts[0], g: parts[1], b: parts[2] });
}

function transformColor(value: string, settings: EditorSettings): string {
  const key = normalize(value);
  if (!key) return value;
  if (settings.selectedColors[key] === false) return value;
  const replacement = settings.replacements[key];
  if (replacement && parseHex(replacement)) return replacement;
  const rgba = parseHex(key);
  if (!rgba || protectColor(rgba, settings)) return value;
  const next = transform(rgba, settings.model, settings);
  return rgbCss({ ...next, a: Math.round(rgba.a * settings.opacity) });
}

function strokeWidth(value: string, settings: EditorSettings): string {
  const m = value.trim().match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
  if (!m) return value;
  const n = Math.max(0, Number(m[1]) * settings.strokeScale + settings.strokeOffset);
  return `${Number(n.toFixed(4))}${m[2] || ''}`;
}

export function applySvgEdit(svgText: string, settings: EditorSettings): string {
  if (!svgText.trim()) return '';
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return svgText;
  const root = doc.documentElement;
  root.setAttribute('data-vector-lab-edited', 'true');
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const attr of ATTRS) {
      const value = el.getAttribute(attr);
      if (value != null) el.setAttribute(attr, transformColor(value, settings));
    }
    const sw = el.getAttribute('stroke-width');
    if (sw != null) el.setAttribute('stroke-width', strokeWidth(sw, settings));
    const style = el.getAttribute('style');
    if (style) {
      el.setAttribute('style', style
        .replace(STYLE_COLOR, (_all, prop: string, color: string) => `${prop}: ${transformColor(color, settings)}`)
        .replace(STYLE_STROKE, (_all, width: string) => `stroke-width: ${strokeWidth(width, settings)}`));
    }
  }
  return new XMLSerializer().serializeToString(doc);
}

export function extractPalette(svgText: string): PaletteItem[] {
  const counts = new Map<string, number>();
  const add = (value: string): void => { const key = normalize(value); if (key) counts.set(key, (counts.get(key) ?? 0) + 1); };
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return [];
  for (const el of Array.from(doc.documentElement.querySelectorAll('*'))) {
    for (const attr of ATTRS) { const value = el.getAttribute(attr); if (value) add(value); }
    const style = el.getAttribute('style');
    if (style) for (const m of style.matchAll(STYLE_COLOR)) add(m[2]);
  }
  return Array.from(counts, ([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count);
}
