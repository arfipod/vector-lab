import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { EditorSettings, LogEntry, LogLevel, PaletteItem, ProgressState, ProgressUpdate, SourceImage, Tab, VectorOptions, VectorResult } from './types';
import { defaultEditorSettings, defaultVectorOptions } from './defaults';
import { DropZone } from './components/DropZone';
import { SliderField } from './components/SliderField';
import { ConsolePanel } from './components/ConsolePanel';
import { PreviewStage } from './components/PreviewStage';
import { ProgressBar } from './components/ProgressBar';
import { FilterLibrary } from './components/FilterLibrary';
import { HelpButton, HelpGuide, HelpLabel, SectionHeading } from './components/Help';
import { loadSourceImage, rasterSvgWrapper } from './lib/imageLoader';
import { vectorizeImage } from './lib/vectorize';
import { applySvgEdit, extractPalette } from './lib/svgEdit';
import { downloadSvgPng, downloadText } from './lib/download';
import { runScript } from './lib/scripting';
import { yieldToBrowser } from './lib/progress';
import { mergeVectorOptions, vectorOptionsEqual } from './lib/options';

const uuid = (): string => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const safeName = (name: string, ext: string): string => `${name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-') || 'vector-lab'}.${ext}`;
const idleProgress: ProgressState = { active: false, label: '' };
const progressValue = (value: number | undefined): number | undefined => typeof value === 'number' ? Math.min(1, Math.max(0, value)) : undefined;

function CheckControl({ checked, helpId, label, onChange }: { checked: boolean; helpId: string; label: string; onChange: (checked: boolean) => void }) {
  const inputId = useId();
  return <div className="check"><input id={inputId} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><label htmlFor={inputId} className="check-text">{label}</label><HelpButton optionId={helpId} /></div>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('vectorization');
  const [headerHidden, setHeaderHidden] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([{ id: uuid(), level: 'info', message: 'Vector Lab Studio booted.', time: Date.now() }]);
  const [source, setSource] = useState<SourceImage | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceMaxSide, setSourceMaxSide] = useState(defaultVectorOptions.maxSide);
  const [vectorOptions, setVectorOptions] = useState<VectorOptions>(defaultVectorOptions);
  const [appliedFilter, setAppliedFilter] = useState<{ id: string; snapshot: VectorOptions } | null>(null);
  const [result, setResult] = useState<VectorResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressState>(idleProgress);
  const [editorSvg, setEditorSvg] = useState('');
  const [editor, setEditor] = useState<EditorSettings>(defaultEditorSettings);
  const liveSignature = useRef('');

  const log = useCallback((level: LogLevel, message: string, data?: unknown) => setLogs((cur) => [...cur.slice(-500), { id: uuid(), level, message, data, time: Date.now() }]), []);
  const showProgress = useCallback((next: ProgressUpdate): void => {
    setProgress({ active: next.active ?? true, label: next.label, detail: next.detail, value: progressValue(next.value), indeterminate: next.indeterminate ?? typeof next.value !== 'number' });
  }, []);
  const clearProgress = useCallback((): void => setProgress(idleProgress), []);
  const editedSvg = useMemo(() => editorSvg ? applySvgEdit(editorSvg, editor) : '', [editorSvg, editor]);
  const palette = useMemo<PaletteItem[]>(() => editorSvg ? extractPalette(editorSvg) : [], [editorSvg]);
  const appliedFilterModified = useMemo(() => appliedFilter ? !vectorOptionsEqual(vectorOptions, appliedFilter.snapshot) : false, [appliedFilter, vectorOptions]);

  useEffect(() => {
    let previous = window.scrollY;
    const onScroll = (): void => { const current = window.scrollY; if (current < 72) setHeaderHidden(false); else if (current > previous + 6) setHeaderHidden(true); else if (current < previous - 6) setHeaderHidden(false); previous = current; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const loadVectorFile = useCallback(async (file: File, maxSide = vectorOptions.maxSide): Promise<SourceImage> => {
    showProgress({ label: 'Loading source image', detail: file.name, indeterminate: true });
    try {
      log('info', `Loading source image: ${file.name}`);
      const loaded = await loadSourceImage(file, maxSide, showProgress);
      setSourceFile(file); setSourceMaxSide(maxSide); setSource(loaded); setResult(null);
      log('info', `Source loaded: ${loaded.width} × ${loaded.height}px`, { kind: loaded.kind });
      return loaded;
    } finally {
      clearProgress();
    }
  }, [clearProgress, log, showProgress, vectorOptions.maxSide]);

  const ensureSource = useCallback(async (options: VectorOptions): Promise<SourceImage | null> => {
    if (!source) return null;
    if (sourceFile && sourceMaxSide !== options.maxSide) return loadVectorFile(sourceFile, options.maxSide);
    return source;
  }, [loadVectorFile, source, sourceFile, sourceMaxSide]);

  const vectorize = useCallback(async (options: VectorOptions, manual: boolean): Promise<VectorResult | null> => {
    if (busy) { log('warn', 'Vectorization is already running.'); return null; }
    let actual: SourceImage | null = null;
    try {
      actual = await ensureSource(options);
    } catch (error) {
      log('error', `Cannot load source before vectorizing: ${(error as Error).message}`);
      return null;
    }
    if (!actual) { log('warn', 'Load an image before vectorizing.'); return null; }
    setBusy(true);
    const progressLabel = manual ? 'Vectorizing image' : 'Updating live preview';
    const reportVectorProgress = (next: ProgressUpdate): void => showProgress({ ...next, label: progressLabel });
    try {
      showProgress({ label: progressLabel, detail: 'Preparing image', value: 0.02 });
      await yieldToBrowser();
      log('info', manual ? 'Manual vectorization started.' : 'Live vectorization started.', { mode: options.mode });
      const next = await vectorizeImage(actual.imageData, options, (message, data) => log('debug', message, data), reportVectorProgress);
      setResult(next);
      if (manual && options.output.openInEditor) { setEditorSvg(next.svg); setTab('editing'); log('info', 'Vector result opened in Editing.'); }
      return next;
    } catch (error) { log('error', `Vectorization failed: ${(error as Error).message}`); return null; }
    finally { setBusy(false); clearProgress(); }
  }, [busy, clearProgress, ensureSource, log, showProgress]);

  useEffect(() => {
    if (!vectorOptions.livePreview || !source || busy) return;
    const sig = JSON.stringify({ source: source.fileName, w: source.width, h: source.height, vectorOptions });
    if (sig === liveSignature.current) return;
    const handle = window.setTimeout(() => { liveSignature.current = sig; void vectorize(vectorOptions, false); }, 850);
    return () => window.clearTimeout(handle);
  }, [busy, source, vectorOptions, vectorize]);

  const loadEditorRasterFile = useCallback(async (file: File): Promise<void> => {
    showProgress({ label: 'Loading source image', detail: file.name, indeterminate: true });
    try {
      const img = await loadSourceImage(file, vectorOptions.maxSide, showProgress);
      setEditorSvg(rasterSvgWrapper(img.imageData));
      setTab('editing');
      log('warn', 'Raster/PDF loaded as an SVG image wrapper. Use Vectorization for editable paths.');
    } catch (e) {
      log('error', `Cannot load editor file: ${(e as Error).message}`);
    } finally {
      clearProgress();
    }
  }, [clearProgress, log, showProgress, vectorOptions.maxSide]);

  const onVectorFiles = (files: FileList): void => { const file = files[0]; if (file) void loadVectorFile(file).catch((e) => log('error', `Cannot load file: ${(e as Error).message}`)); };
  const onEditorFiles = (files: FileList): void => {
    const file = files[0]; if (!file) return; const lower = file.name.toLowerCase(); log('info', `Loading editor file: ${file.name}`);
    if (lower.endsWith('.svg') || file.type === 'image/svg+xml') void file.text().then((text) => { setEditorSvg(text); setTab('editing'); log('info', 'SVG loaded into editor.'); }).catch((e) => log('error', `Cannot read SVG: ${(e as Error).message}`));
    else void loadEditorRasterFile(file);
  };

  const currentSvg = tab === 'editing' ? editedSvg : result?.svg;
  const sendToEditor = useCallback((svg = result?.svg): void => { if (!svg) return; setEditorSvg(svg); setTab('editing'); log('info', 'Vector result sent to Editing.'); }, [log, result?.svg]);
  const exportSvg = useCallback((svg = currentSvg): void => {
    if (!svg) return;
    downloadText(safeName(tab === 'editing' ? 'edited-vector' : source?.fileName ?? 'vectorized', 'svg'), svg);
    log('info', 'SVG exported.');
  }, [currentSvg, log, source?.fileName, tab]);
  const exportPng = useCallback(async (svg = currentSvg): Promise<void> => {
    if (!svg) return;
    showProgress({ label: 'Exporting PNG', detail: 'Preparing SVG', value: 0.05 });
    log('info', 'PNG export started.');
    try {
      await downloadSvgPng(safeName(tab === 'editing' ? 'edited-vector' : source?.fileName ?? 'vectorized', 'png'), svg, 2, showProgress);
      log('info', 'PNG exported.');
    } catch (e) {
      log('error', `PNG export failed: ${(e as Error).message}`);
    } finally {
      clearProgress();
    }
  }, [clearProgress, currentSvg, log, showProgress, source?.fileName, tab]);
  const runVectorScript = (script: string): void => {
    void (async () => {
      try {
        const out = runScript(script, vectorOptions, editor);
        setVectorOptions(out.options);
        setEditor(out.editor);
        out.messages.forEach((m) => log('info', `Script: ${m}`));
        let latestSvg = currentSvg ?? result?.svg;
        for (const action of out.actions) {
          if (action === 'vectorize') {
            const next = await vectorize(out.options, true);
            latestSvg = next?.svg;
          } else if (action === 'send-to-editor') {
            if (latestSvg) sendToEditor(latestSvg);
            else log('warn', 'Script: no SVG is available to send to Editing.');
          } else if (action === 'export-svg') {
            if (latestSvg) exportSvg(latestSvg);
            else log('warn', 'Script: no SVG is available to export.');
          } else if (action === 'export-png') {
            if (latestSvg) await exportPng(latestSvg);
            else log('warn', 'Script: no SVG is available to export.');
          }
        }
      } catch (e) {
        log('error', `Script error: ${(e as Error).message}`);
      }
    })();
  };

  const setBg = <K extends keyof VectorOptions['background']>(key: K, value: VectorOptions['background'][K]): void => setVectorOptions((o) => ({ ...o, background: { ...o.background, [key]: value } }));
  const setColor = <K extends keyof VectorOptions['color']>(key: K, value: VectorOptions['color'][K]): void => setVectorOptions((o) => ({ ...o, color: { ...o.color, [key]: value } }));
  const setBinary = <K extends keyof VectorOptions['binary']>(key: K, value: VectorOptions['binary'][K]): void => setVectorOptions((o) => ({ ...o, binary: { ...o.binary, [key]: value } }));
  const setVectorBlur = (value: number): void => setVectorOptions((o) => ({ ...o, blur: value, color: { ...o.color, blur: value }, binary: { ...o.binary, blur: value } }));
  const setTrace = <K extends keyof VectorOptions['trace']>(key: K, value: VectorOptions['trace'][K]): void => setVectorOptions((o) => ({ ...o, trace: { ...o.trace, [key]: value }, color: { ...o.color, trace: { ...o.color.trace, [key]: value } }, binary: { ...o.binary, trace: { ...o.binary.trace, [key]: value } } }));
  const setColorTrace = <K extends keyof VectorOptions['color']['trace']>(key: K, value: VectorOptions['color']['trace'][K]): void => setVectorOptions((o) => ({ ...o, color: { ...o.color, trace: { ...o.color.trace, [key]: value } } }));
  const setBinaryTrace = <K extends keyof VectorOptions['binary']['trace']>(key: K, value: VectorOptions['binary']['trace'][K]): void => setVectorOptions((o) => ({ ...o, binary: { ...o.binary, trace: { ...o.binary.trace, [key]: value } } }));
  const setOut = <K extends keyof VectorOptions['output']>(key: K, value: VectorOptions['output'][K]): void => setVectorOptions((o) => ({ ...o, output: { ...o.output, [key]: value } }));
  const applyFilter = useCallback((id: string, name: string, partial: Partial<VectorOptions>): void => {
    const next = mergeVectorOptions(vectorOptions, partial);
    setVectorOptions(next);
    setAppliedFilter({ id, snapshot: next });
    log('info', `Applied filter: ${name}.`);
  }, [log, vectorOptions]);

  const previewSvg = tab === 'editing' ? editedSvg : result?.svg;
  const previewImage = tab === 'vectorization' && !result ? source?.previewUrl : undefined;
  const previewSize = useMemo(() => tab === 'vectorization'
    ? result ? { width: result.stats.width, height: result.stats.height } : source ? { width: source.width, height: source.height } : null
    : null, [result, source, tab]);

  return <div className="app-shell">
    <ProgressBar progress={progress} />
    <HelpGuide open={helpOpen} onClose={() => setHelpOpen(false)} />
    <header className={`app-header ${headerHidden ? 'hidden' : ''}`}><div className="brand"><div className="brand-mark">VL</div><div><h1>Vector Lab Studio</h1><p>SVG editing and bitmap vectorization</p></div></div><div className="header-actions"><nav className="tabs"><button className={tab === 'editing' ? 'active' : ''} onClick={() => setTab('editing')}>Editing</button><button className={tab === 'vectorization' ? 'active' : ''} onClick={() => setTab('vectorization')}>Vectorization</button></nav><button type="button" className="help-guide-button" onClick={() => setHelpOpen(true)}>Help</button></div></header>
    <main className="workspace">
      <aside className="side-panel">
        {tab === 'editing' ? <>
          <section className="section"><SectionHeading title="1. Load vector" optionId="editor.loadVector" /><DropZone title="Drop SVG or PDF here" subtitle="SVG stays editable. PDF/raster files are wrapped as SVG images." accept=".svg,.pdf,image/svg+xml,application/pdf" buttonLabel="Choose vector file" onFiles={onEditorFiles} /></section>
          <section className="section"><SectionHeading title="2. Stroke" optionId="editor.strokeScale" /><SliderField label="Stroke scale" helpId="editor.strokeScale" value={editor.strokeScale} min={0} max={8} step={0.05} onChange={(v) => setEditor({ ...editor, strokeScale: v })} /><SliderField label="Stroke offset" helpId="editor.strokeOffset" value={editor.strokeOffset} min={-12} max={24} step={0.1} suffix=" px" onChange={(v) => setEditor({ ...editor, strokeOffset: v })} /></section>
          <section className="section"><SectionHeading title="3. Color" optionId="editor.model" /><div className="select-label"><HelpLabel optionId="editor.model">Model</HelpLabel><select aria-label="Model" value={editor.model} onChange={(e) => setEditor({ ...editor, model: e.target.value as EditorSettings['model'] })}><option value="hsl">HSL</option><option value="hsv">HSV</option></select></div><CheckControl checked={editor.protectWhite} helpId="editor.protectWhite" label="Protect whites" onChange={(checked) => setEditor({ ...editor, protectWhite: checked })} /><CheckControl checked={editor.protectBlack} helpId="editor.protectBlack" label="Protect blacks" onChange={(checked) => setEditor({ ...editor, protectBlack: checked })} /><CheckControl checked={editor.protectGray} helpId="editor.protectGray" label="Protect grays" onChange={(checked) => setEditor({ ...editor, protectGray: checked })} /><SliderField label="Hue" helpId="editor.hue" value={editor.hue} min={-180} max={180} step={1} suffix="°" onChange={(v) => setEditor({ ...editor, hue: v })} /><SliderField label="Saturation" helpId="editor.saturation" value={editor.saturation} min={-100} max={200} step={1} suffix="%" onChange={(v) => setEditor({ ...editor, saturation: v })} />{editor.model === 'hsl' ? <SliderField label="Lightness" helpId="editor.lightness" value={editor.lightness} min={-100} max={100} step={1} suffix="%" onChange={(v) => setEditor({ ...editor, lightness: v })} /> : <SliderField label="Value" helpId="editor.value" value={editor.value} min={-100} max={100} step={1} suffix="%" onChange={(v) => setEditor({ ...editor, value: v })} />}<SliderField label="Opacity" helpId="editor.opacity" value={editor.opacity} min={0} max={1} step={0.01} onChange={(v) => setEditor({ ...editor, opacity: v })} /></section>
          <section className="section"><SectionHeading title="4. Palette" optionId="editor.palette.enabled" meta={palette.length} /><div className="palette-help-row"><HelpLabel optionId="editor.palette.enabled">Enable color</HelpLabel><HelpLabel optionId="editor.palette.replacement">Replacement</HelpLabel></div><div className="palette-list">{palette.map((p) => <div className="palette-row" key={p.hex}><input type="checkbox" aria-label={`Enable ${p.hex}`} checked={editor.selectedColors[p.hex] !== false} onChange={(e) => setEditor({ ...editor, selectedColors: { ...editor.selectedColors, [p.hex]: e.target.checked } })} /><span className="swatch" style={{ background: p.hex }} /><code>{p.hex}</code><small>{p.count}</small><input type="color" aria-label={`Replace ${p.hex}`} value={editor.replacements[p.hex] ?? p.hex} onChange={(e) => setEditor({ ...editor, replacements: { ...editor.replacements, [p.hex]: e.target.value } })} /></div>)}</div></section>
        </> : <>
          <section className="section"><SectionHeading title="1. Load bitmap" optionId="vector.loadBitmap" /><DropZone title="Drop PNG, JPG, SVG or PDF here" subtitle="SVG/PDF are rasterized first. Output is editable SVG paths." accept=".png,.jpg,.jpeg,.webp,.bmp,.gif,.svg,.pdf,image/*,image/svg+xml,application/pdf" buttonLabel="Choose image" onFiles={onVectorFiles} />{source ? <div className="readout"><strong>{source.fileName}</strong><span>{source.width} × {source.height}px · {source.kind}</span></div> : null}</section>
          <FilterLibrary options={vectorOptions} appliedFilterId={appliedFilter?.id ?? null} appliedFilterModified={appliedFilterModified} onApply={applyFilter} onMessage={log} />
          <section className="section"><SectionHeading title="3. Method" optionId="vector.mode" /><div className="select-label"><HelpLabel optionId="vector.mode">Mode</HelpLabel><select aria-label="Mode" value={vectorOptions.mode} onChange={(e) => setVectorOptions({ ...vectorOptions, mode: e.target.value as VectorOptions['mode'] })}><option value="layered">Layered color + lineart</option><option value="color">Color quantization</option><option value="binary">Black and white</option></select></div><SliderField label="Max side" helpId="vector.maxSide" value={vectorOptions.maxSide} min={240} max={3200} step={20} suffix=" px" onChange={(v) => setVectorOptions({ ...vectorOptions, maxSide: v })} /><SliderField label="Pre-blur" helpId="vector.blur" value={vectorOptions.blur} min={0} max={4} step={0.05} suffix=" px" onChange={setVectorBlur} /><CheckControl checked={vectorOptions.livePreview} helpId="vector.livePreview" label="Live preview" onChange={(checked) => setVectorOptions({ ...vectorOptions, livePreview: checked })} /><CheckControl checked={vectorOptions.output.openInEditor} helpId="output.openInEditor" label="Open result in Editing" onChange={(checked) => setOut('openInEditor', checked)} /></section>
          <section className="section"><SectionHeading title="4. Background" optionId="background.enabled" /><CheckControl checked={vectorOptions.background.enabled} helpId="background.enabled" label="Remove paper/background" onChange={(checked) => setBg('enabled', checked)} /><div className="select-label"><HelpLabel optionId="background.method">Method</HelpLabel><select aria-label="Background method" value={vectorOptions.background.method} onChange={(e) => setBg('method', e.target.value as VectorOptions['background']['method'])}><option value="edge-connected">Edge-connected paper mask</option><option value="global-light">Global light mask</option><option value="none">None</option></select></div><SliderField label="Paper tolerance" helpId="background.tolerance" value={vectorOptions.background.tolerance} min={1} max={35} step={1} suffix="%" onChange={(v) => setBg('tolerance', v)} /><SliderField label="Min paper lightness" helpId="background.minLightness" value={vectorOptions.background.minLightness} min={40} max={98} step={1} suffix="%" onChange={(v) => setBg('minLightness', v)} /><SliderField label="Sample inset" helpId="background.sampleInset" value={vectorOptions.background.sampleInset} min={2} max={60} step={1} suffix=" px" onChange={(v) => setBg('sampleInset', v)} /><CheckControl checked={vectorOptions.background.showMask} helpId="background.showMask" label="Preview foreground mask" onChange={(checked) => setBg('showMask', checked)} /></section>
          {(vectorOptions.mode === 'color' || vectorOptions.mode === 'layered') ? <section className="section"><SectionHeading title="5. Color" optionId="color.quantizer" /><div className="select-label"><HelpLabel optionId="color.quantizer">Quantizer</HelpLabel><select aria-label="Quantizer" value={vectorOptions.color.quantizer} onChange={(e) => setColor('quantizer', e.target.value as VectorOptions['color']['quantizer'])}><option value="oklab-kmeans">OKLab k-means++</option><option value="rgb-median-cut">RGB median cut</option></select></div><SliderField label="Colors" helpId="color.colors" value={vectorOptions.color.colors} min={2} max={96} step={1} onChange={(v) => setColor('colors', v)} /><SliderField label="Iterations" helpId="color.iterations" value={vectorOptions.color.iterations} min={2} max={60} step={1} onChange={(v) => setColor('iterations', v)} /><SliderField label="Max samples" helpId="color.sampleLimit" value={vectorOptions.color.sampleLimit} min={5000} max={500000} step={5000} format={(v) => v.toLocaleString('en-US')} onChange={(v) => setColor('sampleLimit', v)} /><CheckControl checked={vectorOptions.color.excludeLineart} helpId="color.excludeLineart" label="Exclude lineart from color layer" onChange={(checked) => setColor('excludeLineart', checked)} /><SliderField label="Lineart darkness" helpId="color.lineartDarkness" value={vectorOptions.color.lineartDarkness} min={40} max={230} step={1} onChange={(v) => setColor('lineartDarkness', v)} /></section> : null}
          {(vectorOptions.mode === 'binary' || vectorOptions.mode === 'layered') ? <section className="section"><SectionHeading title="6. Lineart" optionId="binary.thresholdMode" /><div className="select-label"><HelpLabel optionId="binary.thresholdMode">Threshold</HelpLabel><select aria-label="Threshold mode" value={vectorOptions.binary.thresholdMode} onChange={(e) => setBinary('thresholdMode', e.target.value as VectorOptions['binary']['thresholdMode'])}><option value="manual">Manual</option><option value="otsu">Otsu automatic</option><option value="sauvola">Sauvola adaptive</option></select></div><SliderField label="Threshold" helpId="binary.threshold" value={vectorOptions.binary.threshold} min={0} max={255} step={1} onChange={(v) => setBinary('threshold', v)} />{vectorOptions.binary.thresholdMode === 'sauvola' ? <><SliderField label="Sauvola window" helpId="binary.sauvolaWindow" value={vectorOptions.binary.sauvolaWindow} min={9} max={101} step={2} suffix=" px" onChange={(v) => setBinary('sauvolaWindow', v)} /><SliderField label="Sauvola k" helpId="binary.sauvolaK" value={vectorOptions.binary.sauvolaK} min={0.05} max={0.8} step={0.01} onChange={(v) => setBinary('sauvolaK', v)} /></> : null}<SliderField label="Ink chroma guard" helpId="binary.maxChroma" value={vectorOptions.binary.maxChroma} min={0} max={255} step={1} onChange={(v) => setBinary('maxChroma', v)} /><CheckControl checked={vectorOptions.binary.invert} helpId="binary.invert" label="Invert" onChange={(checked) => setBinary('invert', checked)} /><div className="select-label"><HelpLabel optionId="binary.fill">Line color</HelpLabel><input aria-label="Line color" type="color" value={vectorOptions.binary.fill} onChange={(e) => setBinary('fill', e.target.value)} /></div></section> : null}
          <section className="section"><SectionHeading title="7. Contours" optionId="trace.minArea" /><SliderField label="Minimum area" helpId="trace.minArea" value={vectorOptions.trace.minArea} min={0} max={500} step={1} suffix=" px²" onChange={(v) => setTrace('minArea', v)} /><SliderField label="RDP simplification" helpId="trace.simplify" value={vectorOptions.trace.simplify} min={0} max={8} step={0.05} suffix=" px" onChange={(v) => setTrace('simplify', v)} /><SliderField label="Curve smoothing" helpId="trace.smooth" value={vectorOptions.trace.smooth} min={0} max={100} step={1} suffix="%" onChange={(v) => setTrace('smooth', v)} /><SliderField label="Precision" helpId="trace.precision" value={vectorOptions.trace.precision} min={0} max={4} step={1} onChange={(v) => setTrace('precision', v)} /></section>
          <section className="section"><SectionHeading title="8. Advanced layer controls" optionId="color.blur" /><div className="layer-control-grid">{(vectorOptions.mode === 'color' || vectorOptions.mode === 'layered') ? <div className="layer-control-group"><h3><HelpLabel optionId="color.blur">Color layer</HelpLabel></h3><SliderField label="Color blur" helpId="color.blur" value={vectorOptions.color.blur} min={0} max={4} step={0.05} suffix=" px" onChange={(v) => setColor('blur', v)} /><SliderField label="Underpaint stroke" helpId="color.underpaintStrokeWidth" value={vectorOptions.color.underpaintStrokeWidth} min={0} max={6} step={0.05} suffix=" px" onChange={(v) => setColor('underpaintStrokeWidth', v)} /><SliderField label="Trace min area" helpId="color.trace.minArea" value={vectorOptions.color.trace.minArea} min={0} max={500} step={1} suffix=" px²" onChange={(v) => setColorTrace('minArea', v)} /><SliderField label="Trace simplify" helpId="color.trace.simplify" value={vectorOptions.color.trace.simplify} min={0} max={8} step={0.05} suffix=" px" onChange={(v) => setColorTrace('simplify', v)} /><SliderField label="Trace smooth" helpId="color.trace.smooth" value={vectorOptions.color.trace.smooth} min={0} max={100} step={1} suffix="%" onChange={(v) => setColorTrace('smooth', v)} /></div> : null}{(vectorOptions.mode === 'binary' || vectorOptions.mode === 'layered') ? <div className="layer-control-group"><h3><HelpLabel optionId="binary.blur">Lineart layer</HelpLabel></h3><SliderField label="Lineart blur" helpId="binary.blur" value={vectorOptions.binary.blur} min={0} max={4} step={0.05} suffix=" px" onChange={(v) => setBinary('blur', v)} /><SliderField label="Lineart stroke" helpId="binary.strokeWidth" value={vectorOptions.binary.strokeWidth} min={0} max={8} step={0.05} suffix=" px" onChange={(v) => setBinary('strokeWidth', v)} /><SliderField label="Trace min area" helpId="binary.trace.minArea" value={vectorOptions.binary.trace.minArea} min={0} max={500} step={1} suffix=" px²" onChange={(v) => setBinaryTrace('minArea', v)} /><SliderField label="Trace simplify" helpId="binary.trace.simplify" value={vectorOptions.binary.trace.simplify} min={0} max={8} step={0.05} suffix=" px" onChange={(v) => setBinaryTrace('simplify', v)} /><SliderField label="Trace smooth" helpId="binary.trace.smooth" value={vectorOptions.binary.trace.smooth} min={0} max={100} step={1} suffix="%" onChange={(v) => setBinaryTrace('smooth', v)} /></div> : null}</div></section>
          <section className="section"><SectionHeading title="9. Output" optionId="output.addBackground" /><CheckControl checked={vectorOptions.output.addBackground} helpId="output.addBackground" label="Add real background rectangle" onChange={(checked) => setOut('addBackground', checked)} /><div className="select-label"><HelpLabel optionId="output.backgroundColor">Background color</HelpLabel><input aria-label="Background color" type="color" value={vectorOptions.output.backgroundColor} onChange={(e) => setOut('backgroundColor', e.target.value)} /></div><div className="action-help-row"><HelpLabel optionId="vector.vectorize">Run</HelpLabel><HelpLabel optionId="vector.sendToEditor">Edit</HelpLabel><HelpLabel optionId="vector.exportSvg">SVG</HelpLabel><HelpLabel optionId="vector.exportPng">PNG</HelpLabel></div><button type="button" className="primary" disabled={!source || busy} onClick={() => void vectorize(vectorOptions, true)}>{busy ? 'Vectorizing…' : 'Vectorize'}</button><div className="button-row"><button type="button" disabled={!result} onClick={() => sendToEditor()}>Send to Editing</button><button type="button" disabled={!currentSvg} onClick={() => exportSvg()}>Export SVG</button><button type="button" disabled={!currentSvg} onClick={() => void exportPng()}>Export PNG</button></div>{result ? <div className="readout"><strong>{result.stats.paths} paths · {result.stats.contours} contours</strong><span>{result.stats.colors} colors · {Math.round(result.stats.elapsedMs)} ms</span>{result.stats.warnings.map((w) => <span className="warning" key={w}>{w}</span>)}</div> : null}</section>
        </>}
        {tab === 'editing' ? <section className="section sticky-actions"><div className="action-help-row"><HelpLabel optionId="editor.exportSvg">SVG</HelpLabel><HelpLabel optionId="editor.exportPng">PNG</HelpLabel></div><button className="primary" disabled={!editedSvg} onClick={() => exportSvg()}>Export SVG</button><button disabled={!editedSvg} onClick={() => void exportPng()}>Export PNG</button></section> : null}
      </aside>
      <PreviewStage title={tab === 'editing' ? 'Editing preview' : 'Vectorization preview'} subtitle={tab === 'editing' ? `${palette.length} colors detected` : result ? `${result.stats.paths} paths · ${result.stats.contours} contours` : source ? `${source.width} × ${source.height}px source` : 'No image loaded'} svg={previewSvg} imageUrl={previewImage} imageAlt={previewSvg ? 'SVG preview' : 'Source preview'} intrinsicSize={previewSize} />
    </main>
    <footer className="footer">Made with 💙 by arrf</footer>
    <ConsolePanel logs={logs} onClear={() => setLogs([{ id: uuid(), level: 'info', message: 'Console cleared.', time: Date.now() }])} onRunScript={runVectorScript} />
  </div>;
}
