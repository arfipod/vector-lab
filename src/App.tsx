import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorSettings, LogEntry, LogLevel, PaletteItem, ProgressState, ProgressUpdate, SourceImage, Tab, VectorOptions, VectorResult } from './types';
import { defaultEditorSettings, defaultVectorOptions } from './defaults';
import { DropZone } from './components/DropZone';
import { SliderField } from './components/SliderField';
import { ConsolePanel } from './components/ConsolePanel';
import { PreviewStage } from './components/PreviewStage';
import { ProgressBar } from './components/ProgressBar';
import { FilterLibrary } from './components/FilterLibrary';
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

export default function App() {
  const [tab, setTab] = useState<Tab>('vectorization');
  const [headerHidden, setHeaderHidden] = useState(false);
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
    <header className={`app-header ${headerHidden ? 'hidden' : ''}`}><div className="brand"><div className="brand-mark">VL</div><div><h1>Vector Lab Studio</h1><p>SVG editing and bitmap vectorization</p></div></div><nav className="tabs"><button className={tab === 'editing' ? 'active' : ''} onClick={() => setTab('editing')}>Editing</button><button className={tab === 'vectorization' ? 'active' : ''} onClick={() => setTab('vectorization')}>Vectorization</button></nav></header>
    <main className="workspace">
      <aside className="side-panel">
        {tab === 'editing' ? <>
          <section className="section"><h2>1. Load vector</h2><DropZone title="Drop SVG or PDF here" subtitle="SVG stays editable. PDF/raster files are wrapped as SVG images." accept=".svg,.pdf,image/svg+xml,application/pdf" buttonLabel="Choose vector file" onFiles={onEditorFiles} /></section>
          <section className="section"><h2>2. Stroke</h2><SliderField label="Stroke scale" value={editor.strokeScale} min={0} max={8} step={0.05} onChange={(v) => setEditor({ ...editor, strokeScale: v })} /><SliderField label="Stroke offset" value={editor.strokeOffset} min={-12} max={24} step={0.1} suffix=" px" onChange={(v) => setEditor({ ...editor, strokeOffset: v })} /></section>
          <section className="section"><h2>3. Color</h2><label className="select-label">Model<select value={editor.model} onChange={(e) => setEditor({ ...editor, model: e.target.value as EditorSettings['model'] })}><option value="hsl">HSL</option><option value="hsv">HSV</option></select></label><label className="check"><input type="checkbox" checked={editor.protectWhite} onChange={(e) => setEditor({ ...editor, protectWhite: e.target.checked })} /> Protect whites</label><label className="check"><input type="checkbox" checked={editor.protectBlack} onChange={(e) => setEditor({ ...editor, protectBlack: e.target.checked })} /> Protect blacks</label><label className="check"><input type="checkbox" checked={editor.protectGray} onChange={(e) => setEditor({ ...editor, protectGray: e.target.checked })} /> Protect grays</label><SliderField label="Hue" value={editor.hue} min={-180} max={180} step={1} suffix="°" onChange={(v) => setEditor({ ...editor, hue: v })} /><SliderField label="Saturation" value={editor.saturation} min={-100} max={200} step={1} suffix="%" onChange={(v) => setEditor({ ...editor, saturation: v })} />{editor.model === 'hsl' ? <SliderField label="Lightness" value={editor.lightness} min={-100} max={100} step={1} suffix="%" onChange={(v) => setEditor({ ...editor, lightness: v })} /> : <SliderField label="Value" value={editor.value} min={-100} max={100} step={1} suffix="%" onChange={(v) => setEditor({ ...editor, value: v })} />}<SliderField label="Opacity" value={editor.opacity} min={0} max={1} step={0.01} onChange={(v) => setEditor({ ...editor, opacity: v })} /></section>
          <section className="section"><h2>4. Palette <span>{palette.length}</span></h2><div className="palette-list">{palette.map((p) => <div className="palette-row" key={p.hex}><input type="checkbox" checked={editor.selectedColors[p.hex] !== false} onChange={(e) => setEditor({ ...editor, selectedColors: { ...editor.selectedColors, [p.hex]: e.target.checked } })} /><span className="swatch" style={{ background: p.hex }} /><code>{p.hex}</code><small>{p.count}</small><input type="color" value={editor.replacements[p.hex] ?? p.hex} onChange={(e) => setEditor({ ...editor, replacements: { ...editor.replacements, [p.hex]: e.target.value } })} /></div>)}</div></section>
        </> : <>
          <section className="section"><h2>1. Load bitmap</h2><DropZone title="Drop PNG, JPG, SVG or PDF here" subtitle="SVG/PDF are rasterized first. Output is editable SVG paths." accept=".png,.jpg,.jpeg,.webp,.bmp,.gif,.svg,.pdf,image/*,image/svg+xml,application/pdf" buttonLabel="Choose image" onFiles={onVectorFiles} />{source ? <div className="readout"><strong>{source.fileName}</strong><span>{source.width} × {source.height}px · {source.kind}</span></div> : null}</section>
          <FilterLibrary options={vectorOptions} appliedFilterId={appliedFilter?.id ?? null} appliedFilterModified={appliedFilterModified} onApply={applyFilter} onMessage={log} />
          <section className="section"><h2>3. Method</h2><label className="select-label">Mode<select value={vectorOptions.mode} onChange={(e) => setVectorOptions({ ...vectorOptions, mode: e.target.value as VectorOptions['mode'] })}><option value="layered">Layered color + lineart</option><option value="color">Color quantization</option><option value="binary">Black and white</option></select></label><SliderField label="Max side" value={vectorOptions.maxSide} min={240} max={3200} step={20} suffix=" px" onChange={(v) => setVectorOptions({ ...vectorOptions, maxSide: v })} /><SliderField label="Pre-blur" value={vectorOptions.blur} min={0} max={4} step={0.05} suffix=" px" onChange={setVectorBlur} /><label className="check"><input type="checkbox" checked={vectorOptions.livePreview} onChange={(e) => setVectorOptions({ ...vectorOptions, livePreview: e.target.checked })} /> Live preview</label><label className="check"><input type="checkbox" checked={vectorOptions.output.openInEditor} onChange={(e) => setOut('openInEditor', e.target.checked)} /> Open result in Editing</label></section>
          <section className="section"><h2>4. Background</h2><label className="check"><input type="checkbox" checked={vectorOptions.background.enabled} onChange={(e) => setBg('enabled', e.target.checked)} /> Remove paper/background</label><label className="select-label">Method<select value={vectorOptions.background.method} onChange={(e) => setBg('method', e.target.value as VectorOptions['background']['method'])}><option value="edge-connected">Edge-connected paper mask</option><option value="global-light">Global light mask</option><option value="none">None</option></select></label><SliderField label="Paper tolerance" value={vectorOptions.background.tolerance} min={1} max={35} step={1} suffix="%" onChange={(v) => setBg('tolerance', v)} /><SliderField label="Min paper lightness" value={vectorOptions.background.minLightness} min={40} max={98} step={1} suffix="%" onChange={(v) => setBg('minLightness', v)} /><SliderField label="Sample inset" value={vectorOptions.background.sampleInset} min={2} max={60} step={1} suffix=" px" onChange={(v) => setBg('sampleInset', v)} /><label className="check"><input type="checkbox" checked={vectorOptions.background.showMask} onChange={(e) => setBg('showMask', e.target.checked)} /> Preview foreground mask</label></section>
          {(vectorOptions.mode === 'color' || vectorOptions.mode === 'layered') ? <section className="section"><h2>5. Color</h2><label className="select-label">Quantizer<select value={vectorOptions.color.quantizer} onChange={(e) => setColor('quantizer', e.target.value as VectorOptions['color']['quantizer'])}><option value="oklab-kmeans">OKLab k-means++</option><option value="rgb-median-cut">RGB median cut</option></select></label><SliderField label="Colors" value={vectorOptions.color.colors} min={2} max={96} step={1} onChange={(v) => setColor('colors', v)} /><SliderField label="Iterations" value={vectorOptions.color.iterations} min={2} max={60} step={1} onChange={(v) => setColor('iterations', v)} /><SliderField label="Max samples" value={vectorOptions.color.sampleLimit} min={5000} max={500000} step={5000} format={(v) => v.toLocaleString('en-US')} onChange={(v) => setColor('sampleLimit', v)} /><label className="check"><input type="checkbox" checked={vectorOptions.color.excludeLineart} onChange={(e) => setColor('excludeLineart', e.target.checked)} /> Exclude lineart from color layer</label><SliderField label="Lineart darkness" value={vectorOptions.color.lineartDarkness} min={40} max={230} step={1} onChange={(v) => setColor('lineartDarkness', v)} /></section> : null}
          {(vectorOptions.mode === 'binary' || vectorOptions.mode === 'layered') ? <section className="section"><h2>6. Lineart</h2><label className="select-label">Threshold<select value={vectorOptions.binary.thresholdMode} onChange={(e) => setBinary('thresholdMode', e.target.value as VectorOptions['binary']['thresholdMode'])}><option value="manual">Manual</option><option value="otsu">Otsu automatic</option><option value="sauvola">Sauvola adaptive</option></select></label><SliderField label="Threshold" value={vectorOptions.binary.threshold} min={0} max={255} step={1} onChange={(v) => setBinary('threshold', v)} />{vectorOptions.binary.thresholdMode === 'sauvola' ? <><SliderField label="Sauvola window" value={vectorOptions.binary.sauvolaWindow} min={9} max={101} step={2} suffix=" px" onChange={(v) => setBinary('sauvolaWindow', v)} /><SliderField label="Sauvola k" value={vectorOptions.binary.sauvolaK} min={0.05} max={0.8} step={0.01} onChange={(v) => setBinary('sauvolaK', v)} /></> : null}<SliderField label="Ink chroma guard" value={vectorOptions.binary.maxChroma} min={0} max={255} step={1} onChange={(v) => setBinary('maxChroma', v)} /><label className="check"><input type="checkbox" checked={vectorOptions.binary.invert} onChange={(e) => setBinary('invert', e.target.checked)} /> Invert</label><label className="select-label">Line color<input type="color" value={vectorOptions.binary.fill} onChange={(e) => setBinary('fill', e.target.value)} /></label></section> : null}
          <section className="section"><h2>7. Contours</h2><SliderField label="Minimum area" value={vectorOptions.trace.minArea} min={0} max={500} step={1} suffix=" px²" onChange={(v) => setTrace('minArea', v)} /><SliderField label="RDP simplification" value={vectorOptions.trace.simplify} min={0} max={8} step={0.05} suffix=" px" onChange={(v) => setTrace('simplify', v)} /><SliderField label="Curve smoothing" value={vectorOptions.trace.smooth} min={0} max={100} step={1} suffix="%" onChange={(v) => setTrace('smooth', v)} /><SliderField label="Precision" value={vectorOptions.trace.precision} min={0} max={4} step={1} onChange={(v) => setTrace('precision', v)} /></section>
          <section className="section"><h2>8. Advanced layer controls</h2><div className="layer-control-grid">{(vectorOptions.mode === 'color' || vectorOptions.mode === 'layered') ? <div className="layer-control-group"><h3>Color layer</h3><SliderField label="Color blur" value={vectorOptions.color.blur} min={0} max={4} step={0.05} suffix=" px" onChange={(v) => setColor('blur', v)} /><SliderField label="Underpaint stroke" value={vectorOptions.color.underpaintStrokeWidth} min={0} max={6} step={0.05} suffix=" px" onChange={(v) => setColor('underpaintStrokeWidth', v)} /><SliderField label="Trace min area" value={vectorOptions.color.trace.minArea} min={0} max={500} step={1} suffix=" px²" onChange={(v) => setColorTrace('minArea', v)} /><SliderField label="Trace simplify" value={vectorOptions.color.trace.simplify} min={0} max={8} step={0.05} suffix=" px" onChange={(v) => setColorTrace('simplify', v)} /><SliderField label="Trace smooth" value={vectorOptions.color.trace.smooth} min={0} max={100} step={1} suffix="%" onChange={(v) => setColorTrace('smooth', v)} /></div> : null}{(vectorOptions.mode === 'binary' || vectorOptions.mode === 'layered') ? <div className="layer-control-group"><h3>Lineart layer</h3><SliderField label="Lineart blur" value={vectorOptions.binary.blur} min={0} max={4} step={0.05} suffix=" px" onChange={(v) => setBinary('blur', v)} /><SliderField label="Lineart stroke" value={vectorOptions.binary.strokeWidth} min={0} max={8} step={0.05} suffix=" px" onChange={(v) => setBinary('strokeWidth', v)} /><SliderField label="Trace min area" value={vectorOptions.binary.trace.minArea} min={0} max={500} step={1} suffix=" px²" onChange={(v) => setBinaryTrace('minArea', v)} /><SliderField label="Trace simplify" value={vectorOptions.binary.trace.simplify} min={0} max={8} step={0.05} suffix=" px" onChange={(v) => setBinaryTrace('simplify', v)} /><SliderField label="Trace smooth" value={vectorOptions.binary.trace.smooth} min={0} max={100} step={1} suffix="%" onChange={(v) => setBinaryTrace('smooth', v)} /></div> : null}</div></section>
          <section className="section"><h2>9. Output</h2><label className="check"><input type="checkbox" checked={vectorOptions.output.addBackground} onChange={(e) => setOut('addBackground', e.target.checked)} /> Add real background rectangle</label><label className="select-label">Background color<input type="color" value={vectorOptions.output.backgroundColor} onChange={(e) => setOut('backgroundColor', e.target.value)} /></label><button type="button" className="primary" disabled={!source || busy} onClick={() => void vectorize(vectorOptions, true)}>{busy ? 'Vectorizing…' : 'Vectorize'}</button><div className="button-row"><button type="button" disabled={!result} onClick={() => sendToEditor()}>Send to Editing</button><button type="button" disabled={!currentSvg} onClick={() => exportSvg()}>Export SVG</button><button type="button" disabled={!currentSvg} onClick={() => void exportPng()}>Export PNG</button></div>{result ? <div className="readout"><strong>{result.stats.paths} paths · {result.stats.contours} contours</strong><span>{result.stats.colors} colors · {Math.round(result.stats.elapsedMs)} ms</span>{result.stats.warnings.map((w) => <span className="warning" key={w}>{w}</span>)}</div> : null}</section>
        </>}
        {tab === 'editing' ? <section className="section sticky-actions"><button className="primary" disabled={!editedSvg} onClick={() => exportSvg()}>Export SVG</button><button disabled={!editedSvg} onClick={() => void exportPng()}>Export PNG</button></section> : null}
      </aside>
      <PreviewStage title={tab === 'editing' ? 'Editing preview' : 'Vectorization preview'} subtitle={tab === 'editing' ? `${palette.length} colors detected` : result ? `${result.stats.paths} paths · ${result.stats.contours} contours` : source ? `${source.width} × ${source.height}px source` : 'No image loaded'} svg={previewSvg} imageUrl={previewImage} imageAlt={previewSvg ? 'SVG preview' : 'Source preview'} intrinsicSize={previewSize} />
    </main>
    <footer className="footer">Made with 💙 by arrf</footer>
    <ConsolePanel logs={logs} onClear={() => setLogs([{ id: uuid(), level: 'info', message: 'Console cleared.', time: Date.now() }])} onRunScript={runVectorScript} />
  </div>;
}
