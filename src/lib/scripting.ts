import type { EditorSettings, VectorOptions } from '../types';
import { presets } from '../defaults';

export interface ScriptOutput { options: VectorOptions; editor: EditorSettings; actions: Array<'vectorize' | 'send-to-editor' | 'export-svg' | 'export-png'>; messages: string[]; }
const aliases: Record<string, string> = {
  'vector.mode': 'mode', 'vector.maxSide': 'maxSide', 'vector.blur': 'blur', live: 'livePreview',
  'bg.method': 'background.method', 'bg.tolerance': 'background.tolerance', 'bg.minLightness': 'background.minLightness', 'bg.showMask': 'background.showMask',
  'color.colors': 'color.colors', 'color.quantizer': 'color.quantizer', 'color.iterations': 'color.iterations', 'color.samples': 'color.sampleLimit', 'color.excludeLineart': 'color.excludeLineart',
  'line.threshold': 'binary.threshold', 'line.mode': 'binary.thresholdMode', 'line.fill': 'binary.fill',
  'trace.minArea': 'trace.minArea', 'trace.simplify': 'trace.simplify', 'trace.smooth': 'trace.smooth',
  'output.openInEditor': 'output.openInEditor', 'output.background': 'output.addBackground'
};
function clone<T>(v: T): T { return structuredClone(v); }
function parse(raw: string): unknown { const v = raw.trim(); if (/^(true|yes|on)$/i.test(v)) return true; if (/^(false|no|off)$/i.test(v)) return false; const n = Number(v.replace(',', '.')); return Number.isFinite(n) && v !== '' ? n : v.replace(/^['"]|['"]$/g, ''); }
function setPath(obj: Record<string, unknown>, path: string, value: unknown): void { const parts = path.split('.'); let cur = obj; for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]] as Record<string, unknown>; } cur[parts[parts.length - 1]] = value; }
function merge(base: VectorOptions, partial: Partial<VectorOptions>): VectorOptions { return { ...base, ...partial, background: { ...base.background, ...partial.background }, color: { ...base.color, ...partial.color }, binary: { ...base.binary, ...partial.binary }, trace: { ...base.trace, ...partial.trace }, output: { ...base.output, ...partial.output } }; }
export const scriptHelp = `# Vector Lab Script
preset watercolor-balanced
set vector.mode = layered
set bg.method = edge-connected
set bg.tolerance = 10
set color.colors = 24
set trace.simplify = 0.65
set output.openInEditor = false
run vectorize

# Presets: watercolor-balanced, watercolor-maximum, svg-light, lineart-clean
# Editor example: set editor.hue = 20`;
export function runScript(source: string, options: VectorOptions, editor: EditorSettings): ScriptOutput {
  let next = clone(options); const nextEditor = clone(editor); const actions: ScriptOutput['actions'] = []; const messages: string[] = [];
  source.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.replace(/#.*/, '').trim(); if (!line) return;
    const preset = line.match(/^preset\s+([\w-]+)$/i); if (preset) { const p = presets[preset[1]]; if (!p) throw new Error(`Unknown preset on line ${idx + 1}`); next = merge(next, p); messages.push(`Applied preset ${preset[1]}.`); return; }
    const set = line.match(/^set\s+([\w.-]+)\s*(?:=|:)\s*(.+)$/i) ?? line.match(/^set\s+([\w.-]+)\s+(.+)$/i); if (set) { const path = aliases[set[1]] ?? set[1]; if (path.startsWith('editor.')) setPath(nextEditor as unknown as Record<string, unknown>, path.replace(/^editor\./, ''), parse(set[2])); else setPath(next as unknown as Record<string, unknown>, path, parse(set[2])); messages.push(`Set ${set[1]}.`); return; }
    const run = line.match(/^run\s+([\w-]+)$/i); if (run) { const action = run[1].toLowerCase(); if (action === 'vectorize') actions.push('vectorize'); else if (action === 'send-to-editor' || action === 'open-editor') actions.push('send-to-editor'); else if (action === 'export-svg') actions.push('export-svg'); else if (action === 'export-png') actions.push('export-png'); else throw new Error(`Unknown action on line ${idx + 1}`); return; }
    throw new Error(`Cannot parse line ${idx + 1}: ${raw}`);
  });
  return { options: next, editor: nextEditor, actions, messages };
}
