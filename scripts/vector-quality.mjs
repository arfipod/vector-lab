import { build } from 'esbuild';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const root = process.cwd();

function readArgs(argv) {
  const out = { output: '.vector-quality' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--watercolor') out.watercolor = argv[++i];
    else if (arg === '--lineart') out.lineart = argv[++i];
    else if (arg === '--out') out.output = argv[++i];
    else if (arg === '--help' || arg === '-h') out.help = true;
    else positional.push(arg);
  }
  if (!out.watercolor && positional[0]) out.watercolor = positional[0];
  if (!out.lineart && positional[1]) out.lineart = positional[1];
  if (out.output === '.vector-quality' && positional[2]) out.output = positional[2];
  return out;
}

function usage() {
  return [
    'Usage:',
    '  npm run quality -- --watercolor <image> --lineart <image> --out <dir>',
    '',
    'Any input can be omitted. The script writes SVG, transparent PNG, white-preview PNG, and metrics.json.'
  ].join('\n');
}

function clone(value) {
  return structuredClone(value);
}

function mergeOptions(base, partial = {}) {
  const trace = { ...base.trace, ...partial.trace };
  const inheritedTrace = partial.trace ?? {};
  return {
    ...base,
    ...partial,
    background: { ...base.background, ...partial.background },
    color: { ...base.color, ...partial.color, trace: { ...base.color.trace, ...inheritedTrace, ...partial.color?.trace } },
    binary: { ...base.binary, ...partial.binary, trace: { ...base.binary.trace, ...inheritedTrace, ...partial.binary?.trace } },
    trace,
    output: { ...base.output, ...partial.output }
  };
}

function fitSize(width, height, maxSide) {
  const side = Math.max(width, height);
  if (side <= maxSide) return { width, height };
  const scale = maxSide / side;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function loadImageData(file, maxSide) {
  const img = await loadImage(await readFile(file));
  const target = fitSize(img.width, img.height, maxSide);
  const canvas = createCanvas(target.width, target.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, target.width, target.height);
  return ctx.getImageData(0, 0, target.width, target.height);
}

async function rasterSvg(svg, width, height, whitePreview = false) {
  const img = await loadImage(Buffer.from(svg));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (whitePreview) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, imageData: ctx.getImageData(0, 0, width, height) };
}

function luma(data, offset) {
  return 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
}

function median(values) {
  if (!values.length) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function estimatePaper(img) {
  const { width, height, data } = img;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 700));
  const inset = Math.max(8, Math.floor(Math.min(width, height) * 0.03));
  const rs = [], gs = [], bs = [];
  const add = (x, y) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 8) return;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  };
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < inset; x += step) add(x, y);
    for (let x = Math.max(0, width - inset); x < width; x += step) add(x, y);
  }
  for (let x = 0; x < width; x += step) {
    for (let y = 0; y < inset; y += step) add(x, y);
    for (let y = Math.max(0, height - inset); y < height; y += step) add(x, y);
  }
  return { r: median(rs), g: median(gs), b: median(bs) };
}

function compareImages(source, rendered) {
  const paper = estimatePaper(source);
  const paperLuma = 0.2126 * paper.r + 0.7152 * paper.g + 0.0722 * paper.b;
  let fg = 0, bg = 0, miss = 0, leak = 0, mae = 0, dark = 0, darkHit = 0, darkVector = 0, darkFalse = 0;

  for (let p = 0; p < source.width * source.height; p++) {
    const i = p * 4;
    const sr = source.data[i], sg = source.data[i + 1], sb = source.data[i + 2], sa = source.data[i + 3];
    const sl = luma(source.data, i);
    const chroma = Math.max(sr, sg, sb) - Math.min(sr, sg, sb);
    const foreground = sa > 8 && (paperLuma - sl > 24 || chroma > 30 || Math.abs(sr - paper.r) + Math.abs(sg - paper.g) + Math.abs(sb - paper.b) > 70);
    const va = rendered.data[i + 3];
    const vr = va ? rendered.data[i] : paper.r;
    const vg = va ? rendered.data[i + 1] : paper.g;
    const vb = va ? rendered.data[i + 2] : paper.b;

    if (foreground) {
      fg++;
      if (va <= 8) miss++;
      mae += (Math.abs(sr - vr) + Math.abs(sg - vg) + Math.abs(sb - vb)) / 3;
    } else {
      bg++;
      if (va > 8) leak++;
    }

    const sourceDark = foreground && sl < 170;
    const vectorDark = va > 8 && luma(rendered.data, i) < 180;
    if (sourceDark) {
      dark++;
      if (vectorDark) darkHit++;
    }
    if (vectorDark) {
      darkVector++;
      if (!sourceDark) darkFalse++;
    }
  }

  const pct = (n, d) => Number(((n / Math.max(1, d)) * 100).toFixed(2));
  return {
    foregroundPixels: fg,
    backgroundPixels: bg,
    missPct: pct(miss, fg),
    leakPct: pct(leak, bg),
    colorMae: Number((mae / Math.max(1, fg)).toFixed(2)),
    darkRecallPct: pct(darkHit, dark),
    darkPrecisionPct: pct(darkVector - darkFalse, darkVector)
  };
}

async function loadVectorizer() {
  globalThis.document = {
    createElement(name) {
      if (name !== 'canvas') throw new Error(`Unsupported element in Node harness: ${name}`);
      return createCanvas(1, 1);
    }
  };

  const built = await build({
    stdin: {
      contents: "export { vectorizeImage } from './src/lib/vectorize.ts'; export { defaultVectorOptions, presets } from './src/defaults.ts';",
      resolveDir: root,
      loader: 'ts'
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    sourcemap: false
  });
  return import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
}

async function runCase({ kind, file, presetName, vectorizeImage, defaultVectorOptions, presets, outputDir }) {
  const options = mergeOptions(clone(defaultVectorOptions), presets[presetName]);
  const source = await loadImageData(file, options.maxSide);
  const result = await vectorizeImage(source, options);
  const transparent = await rasterSvg(result.svg, result.stats.width, result.stats.height);
  const white = await rasterSvg(result.svg, result.stats.width, result.stats.height, true);
  const id = `${kind}-${presetName}`;

  await writeFile(join(outputDir, `${id}.svg`), result.svg);
  await writeFile(join(outputDir, `${id}.png`), await transparent.canvas.encode('png'));
  await writeFile(join(outputDir, `${id}-white.png`), await white.canvas.encode('png'));

  return {
    id,
    source: basename(file),
    preset: presetName,
    size: `${result.stats.width}x${result.stats.height}`,
    paths: result.stats.paths,
    contours: result.stats.contours,
    colors: result.stats.colors,
    svgKB: Math.round(result.svg.length / 1024),
    elapsedMs: Math.round(result.stats.elapsedMs),
    warnings: result.stats.warnings,
    ...compareImages(source, transparent.imageData)
  };
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  if (args.help || (!args.watercolor && !args.lineart)) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const outputDir = resolve(args.output);
  await mkdir(outputDir, { recursive: true });
  const mod = await loadVectorizer();
  const jobs = [];

  if (args.watercolor) {
    const file = resolve(args.watercolor);
    jobs.push({ kind: 'watercolor', file, presetName: 'watercolor-maximum', ...mod, outputDir });
    jobs.push({ kind: 'watercolor', file, presetName: 'watercolor-detail', ...mod, outputDir });
  }
  if (args.lineart) {
    const file = resolve(args.lineart);
    jobs.push({ kind: 'lineart', file, presetName: 'lineart-clean', ...mod, outputDir });
    jobs.push({ kind: 'lineart', file, presetName: 'lineart-detail', ...mod, outputDir });
  }

  const metrics = [];
  for (const job of jobs) metrics.push(await runCase(job));
  await writeFile(join(outputDir, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  console.table(metrics.map(({ warnings, ...row }) => ({ ...row, warnings: warnings.length })));
  console.log(`Wrote quality artifacts to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
