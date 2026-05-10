import type { VectorOptions, VectorResult, VectorStats } from '../types';
import { fmt, labDist2, luma, oklabToRgb, rgbToOklab, toHex, type Oklab, type Rgb } from './color';
import { blurImageData } from './imageLoader';

interface BackgroundResult { mask: Uint8Array; pixels: number; paper: Rgb; }
interface QuantResult { labels: Int16Array; colors: string[]; counts: number[]; }
interface Point { x: number; y: number; }

const esc = (s: string): string => s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[c] ?? c));
const pixelRgb = (data: Uint8ClampedArray, p: number): Rgb => ({ r: data[p * 4], g: data[p * 4 + 1], b: data[p * 4 + 2] });
const countMask = (mask: Uint8Array): number => { let n = 0; for (const v of mask) n += v; return n; };

function median(values: number[]): number { if (!values.length) return 255; const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function estimatePaper(img: ImageData, options: VectorOptions['background']): Rgb {
  const { width, height, data } = img; const inset = Math.max(1, Math.floor(options.sampleInset)); const step = Math.max(1, Math.floor(Math.max(width, height) / 700));
  const bright: Rgb[] = []; const all: Rgb[] = [];
  const add = (x: number, y: number): void => { const p = y * width + x; if (data[p * 4 + 3] <= options.alphaThreshold) return; const rgb = pixelRgb(data, p); all.push(rgb); if (luma(rgb) >= options.minLightness * 2.55) bright.push(rgb); };
  for (let y = 0; y < height; y += step) { for (let x = 0; x < Math.min(inset, width); x += step) add(x, y); for (let x = Math.max(0, width - inset); x < width; x += step) add(x, y); }
  for (let x = 0; x < width; x += step) { for (let y = 0; y < Math.min(inset, height); y += step) add(x, y); for (let y = Math.max(0, height - inset); y < height; y += step) add(x, y); }
  const src = bright.length >= 16 ? bright : all;
  return { r: median(src.map((p) => p.r)), g: median(src.map((p) => p.g)), b: median(src.map((p) => p.b)) };
}
function buildBackground(img: ImageData, options: VectorOptions['background']): BackgroundResult {
  const { width, height, data } = img; const total = width * height; const mask = new Uint8Array(total); const paper = estimatePaper(img, options);
  if (!options.enabled || options.method === 'none') { let n = 0; for (let p = 0; p < total; p++) if (data[p * 4 + 3] <= options.alphaThreshold) { mask[p] = 1; n++; } return { mask, pixels: n, paper }; }
  const candidates = new Uint8Array(total); const paperLab = rgbToOklab(paper); const tol = 0.018 + options.tolerance * 0.0062; const tol2 = tol * tol; const minL = options.minLightness * 2.55;
  for (let p = 0; p < total; p++) { const i = p * 4; if (data[i + 3] <= options.alphaThreshold) { candidates[p] = 1; continue; } const rgb = pixelRgb(data, p); if (luma(rgb) >= minL && labDist2(rgbToOklab(rgb), paperLab) <= tol2) candidates[p] = 1; }
  if (options.method === 'global-light') { let n = 0; for (let p = 0; p < total; p++) if (candidates[p]) { mask[p] = 1; n++; } return { mask, pixels: n, paper }; }
  const queue = new Int32Array(total); let head = 0; let tail = 0;
  const enq = (p: number): void => { if (!candidates[p] || mask[p]) return; mask[p] = 1; queue[tail++] = p; };
  for (let x = 0; x < width; x++) { enq(x); enq((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enq(y * width); enq(y * width + width - 1); }
  while (head < tail) { const p = queue[head++]; const x = p % width; if (x > 0) enq(p - 1); if (x < width - 1) enq(p + 1); if (p >= width) enq(p - width); if (p < total - width) enq(p + width); }
  return { mask, pixels: tail, paper };
}

function gray(img: ImageData): Uint8Array { const out = new Uint8Array(img.width * img.height); for (let p = 0; p < out.length; p++) out[p] = Math.round(luma(pixelRgb(img.data, p))); return out; }
function otsu(g: Uint8Array, ignore: Uint8Array): number { const hist = new Uint32Array(256); let total = 0; for (let i = 0; i < g.length; i++) if (!ignore[i]) { hist[g[i]]++; total++; } if (!total) return 128; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i]; let sumB = 0, wB = 0, best = 0, th = 128; for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } } return th; }
function binaryMask(img: ImageData, bg: Uint8Array, options: VectorOptions['binary']): Uint8Array {
  const { width, height } = img; const g = gray(img); const mask = new Uint8Array(g.length);
  if (options.thresholdMode === 'sauvola') return sauvola(g, width, height, bg, options);
  const th = options.thresholdMode === 'otsu' ? otsu(g, bg) : options.threshold;
  for (let p = 0; p < g.length; p++) if (!bg[p] && (options.invert ? g[p] >= th : g[p] <= th)) mask[p] = 1;
  return mask;
}
function sauvola(g: Uint8Array, width: number, height: number, bg: Uint8Array, options: VectorOptions['binary']): Uint8Array {
  const mask = new Uint8Array(g.length); const w = Math.max(3, Math.floor(options.sauvolaWindow) | 1); const r = Math.floor(w / 2); const stride = width + 1; const sum = new Float64Array(stride * (height + 1)); const sq = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) { let row = 0, rowSq = 0; for (let x = 0; x < width; x++) { const v = g[y * width + x]; row += v; rowSq += v * v; const i = (y + 1) * stride + x + 1; sum[i] = sum[i - stride] + row; sq[i] = sq[i - stride] + rowSq; } }
  const rect = (arr: Float64Array, x0: number, y0: number, x1: number, y1: number): number => arr[y1 * stride + x1] - arr[y0 * stride + x1] - arr[y1 * stride + x0] + arr[y0 * stride + x0];
  for (let y = 0; y < height; y++) { const y0 = Math.max(0, y - r), y1 = Math.min(height, y + r + 1); for (let x = 0; x < width; x++) { const p = y * width + x; if (bg[p]) continue; const x0 = Math.max(0, x - r), x1 = Math.min(width, x + r + 1); const area = (x1 - x0) * (y1 - y0); const mean = rect(sum, x0, y0, x1, y1) / area; const variance = Math.max(0, rect(sq, x0, y0, x1, y1) / area - mean * mean); const th = mean * (1 + options.sauvolaK * (Math.sqrt(variance) / 128 - 1)); if (options.invert ? g[p] >= th : g[p] <= th) mask[p] = 1; } }
  return mask;
}

interface Sample { rgb: Rgb; lab: Oklab; }
function rng(seed: number): () => number { let s = seed >>> 0; return () => ((s = (1664525 * s + 1013904223) >>> 0) / 0xffffffff); }
function nearest(lab: Oklab, centers: Oklab[]): number { let best = 0, bd = Infinity; centers.forEach((c, i) => { const d = labDist2(lab, c); if (d < bd) { bd = d; best = i; } }); return best; }
function samples(img: ImageData, ignore: Uint8Array, limit: number): Sample[] { const ids: number[] = []; for (let p = 0; p < ignore.length; p++) if (!ignore[p]) ids.push(p); const step = Math.max(1, Math.ceil(ids.length / limit)); const out: Sample[] = []; for (let i = 0; i < ids.length; i += step) { const rgb = pixelRgb(img.data, ids[i]); out.push({ rgb, lab: rgbToOklab(rgb) }); } return out; }
function kmeans(ss: Sample[], k: number, iterations: number): Oklab[] { const rand = rng(ss.length + k * 997); k = Math.max(1, Math.min(k, ss.length)); const centers: Oklab[] = [ss[Math.floor(rand() * ss.length)].lab]; const dist = new Float64Array(ss.length); while (centers.length < k) { let total = 0; for (let i = 0; i < ss.length; i++) { let d = Infinity; for (const c of centers) d = Math.min(d, labDist2(ss[i].lab, c)); dist[i] = d; total += d; } let pick = rand() * total; let idx = ss.length - 1; for (let i = 0; i < ss.length; i++) { pick -= dist[i]; if (pick <= 0) { idx = i; break; } } centers.push(ss[idx].lab); }
  for (let it = 0; it < iterations; it++) { const sums = centers.map(() => ({ l: 0, a: 0, b: 0, n: 0 })); for (const s of ss) { const c = nearest(s.lab, centers); sums[c].l += s.lab.l; sums[c].a += s.lab.a; sums[c].b += s.lab.b; sums[c].n++; } let moved = 0; for (let i = 0; i < centers.length; i++) { if (!sums[i].n) { centers[i] = ss[Math.floor(rand() * ss.length)].lab; continue; } const next = { l: sums[i].l / sums[i].n, a: sums[i].a / sums[i].n, b: sums[i].b / sums[i].n }; moved += labDist2(centers[i], next); centers[i] = next; } if (moved < 1e-7) break; } return centers; }
function medianCut(ss: Sample[], k: number): Oklab[] {
  const channels: Array<keyof Rgb> = ['r', 'g', 'b'];
  let boxes: Sample[][] = [ss];
  while (boxes.length < k) {
    boxes.sort((a, b) => b.length - a.length);
    const box = boxes.shift();
    if (!box || box.length <= 1) break;
    const ranges = channels.map((ch) => {
      let min = Infinity;
      let max = -Infinity;
      for (const sample of box) {
        const value = sample.rgb[ch];
        if (value < min) min = value;
        if (value > max) max = value;
      }
      return { ch, range: max - min };
    }).sort((a, b) => b.range - a.range);
    const channel = ranges[0].ch;
    box.sort((a, b) => a.rgb[channel] - b.rgb[channel]);
    const mid = Math.floor(box.length / 2);
    boxes.push(box.slice(0, mid), box.slice(mid));
  }
  return boxes.filter((box) => box.length > 0).map((box) => {
    const sum = box.reduce((acc, p) => ({ l: acc.l + p.lab.l, a: acc.a + p.lab.a, b: acc.b + p.lab.b }), { l: 0, a: 0, b: 0 });
    return { l: sum.l / box.length, a: sum.a / box.length, b: sum.b / box.length };
  });
}
function quantize(img: ImageData, ignore: Uint8Array, options: VectorOptions['color']): QuantResult { const ss = samples(img, ignore, options.sampleLimit); const labels = new Int16Array(img.width * img.height); labels.fill(-1); if (!ss.length) return { labels, colors: [], counts: [] }; const centers = options.quantizer === 'rgb-median-cut' ? medianCut(ss, options.colors) : kmeans(ss, options.colors, options.iterations); const rawCounts = new Array<number>(centers.length).fill(0); for (let p = 0; p < labels.length; p++) if (!ignore[p]) { const c = nearest(rgbToOklab(pixelRgb(img.data, p)), centers); labels[p] = c; rawCounts[c]++; } const remap = new Int16Array(centers.length); remap.fill(-1); const colors: string[] = [], counts: number[] = []; centers.forEach((c, i) => { if (rawCounts[i] >= options.minClusterPixels) { remap[i] = colors.length; colors.push(toHex(oklabToRgb(c))); counts.push(rawCounts[i]); } }); for (let p = 0; p < labels.length; p++) if (labels[p] >= 0) labels[p] = remap[labels[p]]; return { labels, colors, counts }; }

function area(poly: Point[]): number { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }
function pd(p: Point, a: Point, b: Point): number { const dx = b.x - a.x, dy = b.y - a.y; return dx || dy ? Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.hypot(dx, dy) : Math.hypot(p.x - a.x, p.y - a.y); }
function rdp(points: Point[], eps: number): Point[] { if (points.length <= 2 || eps <= 0) return points; let d = 0, idx = 0; for (let i = 1; i < points.length - 1; i++) { const v = pd(points[i], points[0], points[points.length - 1]); if (v > d) { d = v; idx = i; } } return d > eps ? [...rdp(points.slice(0, idx + 1), eps).slice(0, -1), ...rdp(points.slice(idx), eps)] : [points[0], points[points.length - 1]]; }
function smoothPath(poly: Point[], smooth: number, precision: number): string { if (poly.length < 3) return ''; const t = Math.max(0, Math.min(1, smooth / 100)); const f = (v: number): string => fmt(v, precision); if (!t) return `M ${f(poly[0].x)} ${f(poly[0].y)} ` + poly.slice(1).map((p) => `L ${f(p.x)} ${f(p.y)}`).join(' ') + ' Z'; const parts = [`M ${f(poly[0].x)} ${f(poly[0].y)}`]; for (let i = 0; i < poly.length; i++) { const p0 = poly[(i - 1 + poly.length) % poly.length], p1 = poly[i], p2 = poly[(i + 1) % poly.length], p3 = poly[(i + 2) % poly.length]; const c1 = { x: p1.x + (p2.x - p0.x) * t / 6, y: p1.y + (p2.y - p0.y) * t / 6 }; const c2 = { x: p2.x - (p3.x - p1.x) * t / 6, y: p2.y - (p3.y - p1.y) * t / 6 }; parts.push(`C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`); } return parts.join(' ') + ' Z'; }
function trace(mask: Uint8Array, width: number, height: number, options: VectorOptions['trace']): { d: string; contours: number } { const stride = width + 1; const starts: number[] = [], ends: number[] = []; const map = new Map<number, number[]>(); const key = (x: number, y: number): number => y * stride + x; const pt = (k: number): Point => ({ x: k % stride, y: Math.floor(k / stride) }); const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1; const add = (x0: number, y0: number, x1: number, y1: number): void => { const s = key(x0, y0), e = key(x1, y1), i = ends.length; starts.push(s); ends.push(e); const b = map.get(s); if (b) b.push(i); else map.set(s, [i]); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (on(x, y)) { if (!on(x, y - 1)) add(x, y, x + 1, y); if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1); if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1); if (!on(x - 1, y)) add(x, y + 1, x, y); }
  const visited = new Uint8Array(ends.length); const paths: string[] = []; let contours = 0; for (let e = 0; e < ends.length; e++) { if (visited[e]) continue; const start = starts[e]; let edge = e, cur = start; const poly: Point[] = []; let guard = 0; while (!visited[edge] && guard++ < ends.length + 8) { visited[edge] = 1; poly.push(pt(cur)); const end = ends[edge]; if (end === start) break; const next = map.get(end)?.find((candidate) => !visited[candidate]); if (next == null) break; cur = end; edge = next; } if (poly.length < 3 || Math.abs(area(poly)) < options.minArea) continue; const simp = rdp([...poly, poly[0]], options.simplify).slice(0, -1); const d = smoothPath(simp.length >= 3 ? simp : poly, options.smooth, options.precision); if (d) { paths.push(d); contours++; } } return { d: paths.join(' '), contours }; }
function labelMask(labels: Int16Array, label: number): Uint8Array { const out = new Uint8Array(labels.length); for (let i = 0; i < labels.length; i++) if (labels[i] === label) out[i] = 1; return out; }
function merge(a: Uint8Array, b: Uint8Array): Uint8Array { const out = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] || b[i] ? 1 : 0; return out; }
function svg(width: number, height: number, body: string, options: VectorOptions, title: string): string { const bg = options.output.addBackground ? `<rect width="100%" height="100%" fill="${esc(options.output.backgroundColor)}"/>` : ''; return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-vector-lab="studio" data-vector-mode="${options.mode}"><title>${esc(title)}</title>${bg}${body}</svg>`; }

export async function vectorizeImage(input: ImageData, options: VectorOptions, log?: (message: string, data?: unknown) => void): Promise<VectorResult> {
  const started = performance.now(); const img = options.blur > 0 ? blurImageData(input, options.blur) : input; const bg = buildBackground(img, options.background); const warnings: string[] = []; const { width, height } = img; const total = width * height; log?.('Background mask built', { paper: bg.paper, backgroundPixels: bg.pixels });
  if (options.background.showMask) { const fg = new Uint8Array(total); for (let i = 0; i < total; i++) fg[i] = bg.mask[i] ? 0 : 1; const tr = trace(fg, width, height, options.trace); const body = `<g fill="#111827" fill-rule="evenodd"><path d="${tr.d}"/></g>`; return { svg: svg(width, height, body, options, 'Foreground mask preview'), stats: { width, height, paths: tr.d ? 1 : 0, contours: tr.contours, colors: 1, backgroundPixels: bg.pixels, foregroundPixels: total - bg.pixels, elapsedMs: performance.now() - started, warnings: ['Mask preview: dark areas are retained foreground.'] } }; }
  let body = '', paths = 0, contours = 0, colors = 0;
  const addLayer = (id: string, mask: Uint8Array, fill: string): void => { const tr = trace(mask, width, height, options.trace); if (!tr.d) return; body += `<g id="${id}" fill="${esc(fill)}" fill-rule="evenodd"><path d="${tr.d}"/></g>`; paths++; contours += tr.contours; colors++; };
  if (options.mode === 'binary') addLayer('lineart-layer', binaryMask(img, bg.mask, options.binary), options.binary.fill);
  else { let ignore = bg.mask; let line: Uint8Array | null = null; if (options.mode === 'layered' || options.color.excludeLineart) { line = binaryMask(img, bg.mask, { ...options.binary, thresholdMode: 'manual', threshold: options.color.lineartDarkness, invert: false }); if (options.color.excludeLineart) ignore = merge(ignore, line); }
    const q = quantize(img, ignore, options.color); const order = q.colors.map((color, index) => ({ color, index, count: q.counts[index] ?? 0 })).sort((a, b) => b.count - a.count); let colorBody = ''; for (const item of order) { const tr = trace(labelMask(q.labels, item.index), width, height, options.trace); if (!tr.d) continue; colorBody += `<path fill="${esc(item.color)}" fill-rule="evenodd" d="${tr.d}"/>`; paths++; contours += tr.contours; colors++; } if (colorBody) body += `<g id="color-layer">${colorBody}</g>`; if (options.mode === 'layered' && line) addLayer('lineart-layer', line, options.binary.fill); }
  if (!paths) warnings.push('No paths were generated. Lower background tolerance, threshold, or minimum area.'); if (bg.pixels < total * 0.02 && options.background.enabled) warnings.push('Very little background was removed. Try higher tolerance or edge-connected mode.'); if (bg.pixels > total * 0.85) warnings.push('Most pixels were removed as background. Lower tolerance or minimum lightness.');
  const stats: VectorStats = { width, height, paths, contours, colors, backgroundPixels: bg.pixels, foregroundPixels: total - bg.pixels, elapsedMs: performance.now() - started, warnings };
  log?.('Vectorization complete', stats); return { svg: svg(width, height, body, options, `Vectorized ${options.mode}: ${paths} paths, ${contours} contours`), stats };
}
