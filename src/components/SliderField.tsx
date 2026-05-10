import { useId, useState } from 'react';
import { clamp } from '../lib/color';
import { HelpButton } from './Help';

interface Props { label: string; value: number; min: number; max: number; step: number; suffix?: string; format?: (v: number) => string; helpId?: string; onChange: (v: number) => void; }
export function SliderField({ label, value, min, max, step, suffix = '', format, helpId, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const labelId = useId();
  const commit = (): void => { const n = Number(draft.replace(',', '.')); if (Number.isFinite(n)) onChange(clamp(n, min, max)); setEditing(false); };
  return <div className="control-line">
    <div className="control-top"><span className="control-label">{helpId ? <span className="label-with-help"><span id={labelId}>{label}</span><HelpButton optionId={helpId} /></span> : <span id={labelId}>{label}</span>}</span>{editing ? <input className="value-input" aria-labelledby={labelId} type="number" min={min} max={max} step={step} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} /> : <button type="button" className="value-pill" title="Click to type a value" onClick={() => { setDraft(String(value)); setEditing(true); }}>{format ? format(value) : value}{suffix}</button>}</div>
    <input type="range" aria-labelledby={labelId} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </div>;
}
