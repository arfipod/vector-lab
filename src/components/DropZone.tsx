import { useRef, useState } from 'react';
interface Props { title: string; subtitle: string; accept: string; buttonLabel: string; onFiles: (files: FileList) => void; }
export function DropZone({ title, subtitle, accept, buttonLabel, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null); const [drag, setDrag] = useState(false);
  return <div className={`dropzone ${drag ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}>
    <strong>{title}</strong><small>{subtitle}</small><button type="button" className="primary" onClick={() => input.current?.click()}>{buttonLabel}</button>
    <input ref={input} hidden type="file" accept={accept} onChange={(e) => { if (e.currentTarget.files?.length) onFiles(e.currentTarget.files); e.currentTarget.value = ''; }} />
  </div>;
}
