import { useState } from 'react';
import { clamp } from '../lib/color';

interface Props { label: string; value: number; min: number; max: number; step: number; suffix?: string; format?: (v: number) => string; onChange: (v: number) => void; }
export function SliderField({ label, value, min, max, step, suffix = '', format, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const commit = (): void => { const n = Number(draft.replace(',', '.')); if (Number.isFinite(n)) onChange(clamp(n, min, max)); setEditing(false); };
  return <div className="control-line">
    <div className="control-top"><label>{label}</label>{editing ? <input className="value-input" type="number" min={min} max={max} step={step} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} /> : <button type="button" className="value-pill" title="Click to type a value" onClick={() => { setDraft(String(value)); setEditing(true); }}>{format ? format(value) : value}{suffix}</button>}</div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </div>;
}
