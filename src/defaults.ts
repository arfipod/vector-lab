import type { EditorSettings, TraceOptions, VectorOptions } from './types';

export const defaultTraceOptions: TraceOptions = { minArea: 5, simplify: 0.65, smooth: 6, precision: 2 };

export const defaultVectorOptions: VectorOptions = {
  mode: 'layered',
  maxSide: 1500,
  blur: 0.3,
  livePreview: false,
  background: { enabled: true, method: 'edge-connected', tolerance: 10, minLightness: 72, sampleInset: 14, alphaThreshold: 8, showMask: false },
  color: { quantizer: 'oklab-kmeans', colors: 24, iterations: 20, sampleLimit: 140000, excludeLineart: true, lineartDarkness: 150, minClusterPixels: 8, blur: 0.3, trace: { ...defaultTraceOptions }, underpaintStrokeWidth: 0 },
  binary: { thresholdMode: 'manual', threshold: 148, sauvolaWindow: 31, sauvolaK: 0.28, invert: false, fill: '#111111', blur: 0.3, maxChroma: 255, trace: { ...defaultTraceOptions }, strokeWidth: 0 },
  trace: { ...defaultTraceOptions },
  output: { openInEditor: false, addBackground: false, backgroundColor: '#ffffff' }
};

export const defaultEditorSettings: EditorSettings = {
  strokeScale: 1,
  strokeOffset: 0,
  model: 'hsl',
  hue: 0,
  saturation: 0,
  lightness: 0,
  value: 0,
  opacity: 1,
  protectWhite: true,
  protectBlack: false,
  protectGray: true,
  selectedColors: {},
  replacements: {}
};

export const presets: Record<string, Partial<VectorOptions>> = {
  'watercolor-balanced': {
    mode: 'layered', maxSide: 1500, blur: 0.3,
    background: { ...defaultVectorOptions.background, method: 'edge-connected', tolerance: 10, minLightness: 72 },
    color: { ...defaultVectorOptions.color, colors: 24, iterations: 20, sampleLimit: 140000, excludeLineart: true, blur: 0.3, trace: { ...defaultVectorOptions.trace, minArea: 5, simplify: 0.65, smooth: 6 } },
    binary: { ...defaultVectorOptions.binary, blur: 0.3, maxChroma: 70, trace: { ...defaultVectorOptions.trace, minArea: 5, simplify: 0.65, smooth: 6 } },
    trace: { ...defaultVectorOptions.trace, minArea: 5, simplify: 0.65, smooth: 6 }
  },
  'watercolor-maximum': {
    mode: 'layered', maxSide: 2400, blur: 0.3,
    background: { ...defaultVectorOptions.background, method: 'edge-connected', tolerance: 14, minLightness: 76, sampleInset: 22 },
    color: { ...defaultVectorOptions.color, colors: 56, iterations: 38, sampleLimit: 280000, excludeLineart: false, lineartDarkness: 145, minClusterPixels: 3, blur: 0.55, trace: { ...defaultVectorOptions.trace, minArea: 4, simplify: 0.46, smooth: 54, precision: 2 }, underpaintStrokeWidth: 0.55 },
    binary: { ...defaultVectorOptions.binary, blur: 0.12, maxChroma: 58, trace: { ...defaultVectorOptions.trace, minArea: 3, simplify: 0.28, smooth: 18, precision: 2 }, strokeWidth: 0.55 },
    trace: { ...defaultVectorOptions.trace, minArea: 3, simplify: 0.45, smooth: 5 }
  },
  'watercolor-detail': {
    mode: 'layered', maxSide: 2800, blur: 0.25,
    background: { ...defaultVectorOptions.background, method: 'edge-connected', tolerance: 14, minLightness: 76, sampleInset: 22 },
    color: { ...defaultVectorOptions.color, colors: 64, iterations: 44, sampleLimit: 360000, excludeLineart: false, lineartDarkness: 145, minClusterPixels: 3, blur: 0.55, trace: { ...defaultVectorOptions.trace, minArea: 3, simplify: 0.38, smooth: 56, precision: 2 }, underpaintStrokeWidth: 0.55 },
    binary: { ...defaultVectorOptions.binary, blur: 0.12, maxChroma: 58, trace: { ...defaultVectorOptions.trace, minArea: 3, simplify: 0.24, smooth: 18, precision: 2 }, strokeWidth: 0.55 },
    trace: { ...defaultVectorOptions.trace, minArea: 2, simplify: 0.32, smooth: 18, precision: 2 }
  },
  'svg-light': {
    mode: 'color', maxSide: 1100, blur: 0.5,
    background: { ...defaultVectorOptions.background, tolerance: 12 },
    color: { ...defaultVectorOptions.color, colors: 14, iterations: 14, sampleLimit: 60000, excludeLineart: false, blur: 0.5, trace: { ...defaultVectorOptions.trace, minArea: 14, simplify: 1.1, smooth: 10 } },
    trace: { ...defaultVectorOptions.trace, minArea: 14, simplify: 1.1, smooth: 10 }
  },
  'lineart-clean': {
    mode: 'binary', maxSide: 2200, blur: 0.08,
    background: { ...defaultVectorOptions.background, method: 'edge-connected', tolerance: 8, minLightness: 84, sampleInset: 28 },
    binary: { ...defaultVectorOptions.binary, thresholdMode: 'manual', threshold: 185, fill: '#111111', blur: 0.08, maxChroma: 80, trace: { ...defaultVectorOptions.trace, minArea: 4, simplify: 0.28, smooth: 12, precision: 2 }, strokeWidth: 0.2 },
    trace: { ...defaultVectorOptions.trace, minArea: 4, simplify: 0.28, smooth: 12, precision: 2 }
  },
  'lineart-detail': {
    mode: 'binary', maxSide: 2800, blur: 0.05,
    background: { ...defaultVectorOptions.background, method: 'edge-connected', tolerance: 8, minLightness: 84, sampleInset: 28 },
    binary: { ...defaultVectorOptions.binary, thresholdMode: 'manual', threshold: 190, fill: '#111111', blur: 0.05, maxChroma: 80, trace: { ...defaultVectorOptions.trace, minArea: 4, simplify: 0.24, smooth: 12, precision: 2 }, strokeWidth: 0.25 },
    trace: { ...defaultVectorOptions.trace, minArea: 4, simplify: 0.24, smooth: 12, precision: 2 }
  }
};
