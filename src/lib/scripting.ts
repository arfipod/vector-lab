import type { EditorSettings, VectorOptions } from '../types';
import { presets } from '../defaults';
import { cloneOptions, mergeVectorOptions } from './options';

export interface ScriptOutput { options: VectorOptions; editor: EditorSettings; actions: Array<'vectorize' | 'send-to-editor' | 'export-svg' | 'export-png'>; messages: string[]; }
const aliases: Record<string, string> = {
  'vector.mode': 'mode', 'vector.maxSide': 'maxSide', 'vector.blur': 'blur', live: 'livePreview',
  'bg.method': 'background.method', 'bg.tolerance': 'background.tolerance', 'bg.minLightness': 'background.minLightness', 'bg.showMask': 'background.showMask',
  'color.colors': 'color.colors', 'color.quantizer': 'color.quantizer', 'color.iterations': 'color.iterations', 'color.samples': 'color.sampleLimit', 'color.minClusterPixels': 'color.minClusterPixels', 'color.excludeLineart': 'color.excludeLineart', 'color.lineartDarkness': 'color.lineartDarkness',
  'color.blur': 'color.blur', 'color.underpaintStrokeWidth': 'color.underpaintStrokeWidth',
  'color.trace.minArea': 'color.trace.minArea', 'color.trace.simplify': 'color.trace.simplify', 'color.trace.smooth': 'color.trace.smooth', 'color.trace.precision': 'color.trace.precision',
  'line.threshold': 'binary.threshold', 'line.mode': 'binary.thresholdMode', 'line.fill': 'binary.fill', 'line.blur': 'binary.blur', 'line.maxChroma': 'binary.maxChroma', 'line.strokeWidth': 'binary.strokeWidth',
  'line.trace.minArea': 'binary.trace.minArea', 'line.trace.simplify': 'binary.trace.simplify', 'line.trace.smooth': 'binary.trace.smooth', 'line.trace.precision': 'binary.trace.precision',
  'trace.minArea': 'trace.minArea', 'trace.simplify': 'trace.simplify', 'trace.smooth': 'trace.smooth', 'trace.precision': 'trace.precision',
  'output.openInEditor': 'output.openInEditor', 'output.background': 'output.addBackground'
};
export const scriptOptionPaths = Object.freeze(Object.keys(aliases));
export const scriptActions = Object.freeze(['vectorize', 'send-to-editor', 'open-editor', 'export-svg', 'export-png'] as const);
export const scriptPresetNames = Object.freeze(Object.keys(presets));
function parse(raw: string): unknown { const v = raw.trim(); if (/^(true|yes|on)$/i.test(v)) return true; if (/^(false|no|off)$/i.test(v)) return false; const n = Number(v.replace(',', '.')); return Number.isFinite(n) && v !== '' ? n : v.replace(/^['"]|['"]$/g, ''); }
function setPath(obj: Record<string, unknown>, path: string, value: unknown): void { const parts = path.split('.'); let cur = obj; for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]] as Record<string, unknown>; } cur[parts[parts.length - 1]] = value; }
function setVectorPath(options: VectorOptions, path: string, value: unknown): void {
  setPath(options as unknown as Record<string, unknown>, path, value);
  if (path === 'blur') {
    setPath(options as unknown as Record<string, unknown>, 'color.blur', value);
    setPath(options as unknown as Record<string, unknown>, 'binary.blur', value);
  } else if (path.startsWith('trace.')) {
    const traceKey = path.replace(/^trace\./, '');
    setPath(options as unknown as Record<string, unknown>, `color.trace.${traceKey}`, value);
    setPath(options as unknown as Record<string, unknown>, `binary.trace.${traceKey}`, value);
  }
}
export const scriptHelp = `# Vector Lab Script
preset watercolor-balanced
set vector.mode = layered
set bg.method = edge-connected
set bg.tolerance = 10
set color.colors = 24
set trace.simplify = 0.65
set output.openInEditor = false
run vectorize

# Watercolor pattern maximum-detail script
preset watercolor-detail
set vector.mode = layered
set vector.maxSide = 2800
set vector.blur = 0.25

set bg.method = edge-connected
set bg.tolerance = 14
set bg.minLightness = 76

set color.quantizer = oklab-kmeans
set color.colors = 64
set color.iterations = 44
set color.samples = 360000
set color.minClusterPixels = 3
set color.excludeLineart = false
set color.lineartDarkness = 145

set color.blur = 0.55
set line.blur = 0.12
set line.maxChroma = 58

set color.underpaintStrokeWidth = 0.55
set line.strokeWidth = 0.55

set color.trace.minArea = 3
set color.trace.simplify = 0.38
set color.trace.smooth = 56
set color.trace.precision = 2

set line.trace.minArea = 3
set line.trace.simplify = 0.24
set line.trace.smooth = 18
set line.trace.precision = 2

set output.openInEditor = false
run vectorize

# Line-art maximum-detail script
preset lineart-detail
set vector.mode = binary
set vector.maxSide = 2800
set bg.tolerance = 8
set bg.minLightness = 84
set line.threshold = 190
set line.maxChroma = 80
set line.blur = 0.05
set line.strokeWidth = 0.25
set line.trace.minArea = 4
set line.trace.simplify = 0.24
set line.trace.smooth = 12
set line.trace.precision = 2
set output.openInEditor = false
run vectorize

# Presets: watercolor-balanced, watercolor-maximum, watercolor-detail, svg-light, lineart-clean, lineart-detail
# Custom filters are managed in the UI and localStorage.
# Editor example: set editor.hue = 20`;
export function runScript(source: string, options: VectorOptions, editor: EditorSettings): ScriptOutput {
  let next = cloneOptions(options); const nextEditor = cloneOptions(editor); const actions: ScriptOutput['actions'] = []; const messages: string[] = [];
  source.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.replace(/#.*/, '').trim(); if (!line) return;
    const preset = line.match(/^preset\s+([\w-]+)$/i); if (preset) { const p = presets[preset[1]]; if (!p) throw new Error(`Unknown preset on line ${idx + 1}`); next = mergeVectorOptions(next, p); messages.push(`Applied preset ${preset[1]}.`); return; }
    const set = line.match(/^set\s+([\w.-]+)\s*(?:=|:)\s*(.+)$/i) ?? line.match(/^set\s+([\w.-]+)\s+(.+)$/i); if (set) { const path = aliases[set[1]] ?? set[1]; if (path.startsWith('editor.')) setPath(nextEditor as unknown as Record<string, unknown>, path.replace(/^editor\./, ''), parse(set[2])); else setVectorPath(next, path, parse(set[2])); messages.push(`Set ${set[1]}.`); return; }
    const run = line.match(/^run\s+([\w-]+)$/i); if (run) { const action = run[1].toLowerCase(); if (action === 'vectorize') actions.push('vectorize'); else if (action === 'send-to-editor' || action === 'open-editor') actions.push('send-to-editor'); else if (action === 'export-svg') actions.push('export-svg'); else if (action === 'export-png') actions.push('export-png'); else throw new Error(`Unknown action on line ${idx + 1}`); return; }
    throw new Error(`Cannot parse line ${idx + 1}: ${raw}`);
  });
  return { options: next, editor: nextEditor, actions, messages };
}
