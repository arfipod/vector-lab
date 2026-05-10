import type { EditorSettings, VectorOptions } from './types';

export const defaultVectorOptions: VectorOptions = {
  mode: 'layered',
  maxSide: 1500,
  blur: 0.3,
  livePreview: false,
  background: { enabled: true, method: 'edge-connected', tolerance: 10, minLightness: 72, sampleInset: 14, alphaThreshold: 8, showMask: false },
  color: { quantizer: 'oklab-kmeans', colors: 24, iterations: 20, sampleLimit: 140000, excludeLineart: true, lineartDarkness: 150, minClusterPixels: 8 },
  binary: { thresholdMode: 'manual', threshold: 148, sauvolaWindow: 31, sauvolaK: 0.28, invert: false, fill: '#111111' },
  trace: { minArea: 5, simplify: 0.65, smooth: 6, precision: 2 },
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
    color: { ...defaultVectorOptions.color, colors: 24, iterations: 20, sampleLimit: 140000, excludeLineart: true },
    trace: { ...defaultVectorOptions.trace, minArea: 5, simplify: 0.65, smooth: 6 }
  },
  'watercolor-maximum': {
    mode: 'layered', maxSide: 1700, blur: 0.2,
    background: { ...defaultVectorOptions.background, method: 'edge-connected', tolerance: 9, minLightness: 70 },
    color: { ...defaultVectorOptions.color, colors: 30, iterations: 24, sampleLimit: 180000, excludeLineart: true },
    trace: { ...defaultVectorOptions.trace, minArea: 3, simplify: 0.45, smooth: 5 }
  },
  'svg-light': {
    mode: 'color', maxSide: 1100, blur: 0.5,
    background: { ...defaultVectorOptions.background, tolerance: 12 },
    color: { ...defaultVectorOptions.color, colors: 14, iterations: 14, sampleLimit: 60000, excludeLineart: false },
    trace: { ...defaultVectorOptions.trace, minArea: 14, simplify: 1.1, smooth: 10 }
  },
  'lineart-clean': {
    mode: 'binary', maxSide: 1500, blur: 0.15,
    binary: { ...defaultVectorOptions.binary, thresholdMode: 'manual', threshold: 145, fill: '#111111' },
    trace: { ...defaultVectorOptions.trace, minArea: 3, simplify: 0.45, smooth: 4 }
  }
};
