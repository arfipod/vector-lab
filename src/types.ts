export type Tab = 'editing' | 'vectorization';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type VectorMode = 'color' | 'binary' | 'layered';
export type BackgroundMethod = 'edge-connected' | 'global-light' | 'none';
export type Quantizer = 'oklab-kmeans' | 'rgb-median-cut';
export type ThresholdMode = 'manual' | 'otsu' | 'sauvola';
export type ColorModel = 'hsl' | 'hsv';

export interface LogEntry { id: string; level: LogLevel; message: string; time: number; data?: unknown; }
export interface ProgressState { active: boolean; label: string; detail?: string; value?: number; indeterminate?: boolean; }
export type ProgressUpdate = Omit<ProgressState, 'active'> & { active?: boolean };
export type ProgressCallback = (progress: ProgressUpdate) => void;
export interface SourceImage { fileName: string; fileType: string; kind: 'raster' | 'svg' | 'pdf'; width: number; height: number; imageData: ImageData; previewUrl: string; }
export interface TraceOptions { minArea: number; simplify: number; smooth: number; precision: number; }

export interface VectorOptions {
  mode: VectorMode;
  maxSide: number;
  blur: number;
  livePreview: boolean;
  background: { enabled: boolean; method: BackgroundMethod; tolerance: number; minLightness: number; sampleInset: number; alphaThreshold: number; showMask: boolean; };
  color: { quantizer: Quantizer; colors: number; iterations: number; sampleLimit: number; excludeLineart: boolean; lineartDarkness: number; minClusterPixels: number; blur: number; trace: TraceOptions; underpaintStrokeWidth: number; };
  binary: { thresholdMode: ThresholdMode; threshold: number; sauvolaWindow: number; sauvolaK: number; invert: boolean; fill: string; blur: number; trace: TraceOptions; strokeWidth: number; };
  trace: TraceOptions;
  output: { openInEditor: boolean; addBackground: boolean; backgroundColor: string; };
}

export interface VectorStats { width: number; height: number; paths: number; contours: number; colors: number; backgroundPixels: number; foregroundPixels: number; elapsedMs: number; warnings: string[]; }
export interface VectorResult { svg: string; stats: VectorStats; }

export interface EditorSettings {
  strokeScale: number;
  strokeOffset: number;
  model: ColorModel;
  hue: number;
  saturation: number;
  lightness: number;
  value: number;
  opacity: number;
  protectWhite: boolean;
  protectBlack: boolean;
  protectGray: boolean;
  selectedColors: Record<string, boolean>;
  replacements: Record<string, string>;
}

export interface PaletteItem { hex: string; count: number; }
