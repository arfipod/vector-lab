import type { VectorOptions } from '../types';

const modes = new Set(['color', 'binary', 'layered']);
const backgroundMethods = new Set(['edge-connected', 'global-light', 'none']);
const quantizers = new Set(['oklab-kmeans', 'rgb-median-cut']);
const thresholdModes = new Set(['manual', 'otsu', 'sauvola']);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export function cloneOptions<T>(value: T): T {
  return structuredClone(value);
}

export function mergeVectorOptions(base: VectorOptions, partial: Partial<VectorOptions>): VectorOptions {
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

export function vectorOptionsEqual(a: VectorOptions, b: VectorOptions): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTraceOptions(value: unknown): boolean {
  return isRecord(value)
    && isNumber(value.minArea)
    && isNumber(value.simplify)
    && isNumber(value.smooth)
    && isNumber(value.precision);
}

export function isVectorOptions(value: unknown): value is VectorOptions {
  if (!isRecord(value)) return false;
  const background = value.background;
  const color = value.color;
  const binary = value.binary;
  const output = value.output;

  return modes.has(String(value.mode))
    && isNumber(value.maxSide)
    && isNumber(value.blur)
    && isBoolean(value.livePreview)
    && isRecord(background)
    && isBoolean(background.enabled)
    && backgroundMethods.has(String(background.method))
    && isNumber(background.tolerance)
    && isNumber(background.minLightness)
    && isNumber(background.sampleInset)
    && isNumber(background.alphaThreshold)
    && isBoolean(background.showMask)
    && isRecord(color)
    && quantizers.has(String(color.quantizer))
    && isNumber(color.colors)
    && isNumber(color.iterations)
    && isNumber(color.sampleLimit)
    && isBoolean(color.excludeLineart)
    && isNumber(color.lineartDarkness)
    && isNumber(color.minClusterPixels)
    && isNumber(color.blur)
    && isTraceOptions(color.trace)
    && isNumber(color.underpaintStrokeWidth)
    && isRecord(binary)
    && thresholdModes.has(String(binary.thresholdMode))
    && isNumber(binary.threshold)
    && isNumber(binary.sauvolaWindow)
    && isNumber(binary.sauvolaK)
    && isBoolean(binary.invert)
    && isString(binary.fill)
    && isNumber(binary.blur)
    && isNumber(binary.maxChroma)
    && isTraceOptions(binary.trace)
    && isNumber(binary.strokeWidth)
    && isTraceOptions(value.trace)
    && isRecord(output)
    && isBoolean(output.openInEditor)
    && isBoolean(output.addBackground)
    && isString(output.backgroundColor);
}
