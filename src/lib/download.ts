import type { ProgressCallback } from '../types';
import { yieldToBrowser } from './progress';

export function downloadText(filename: string, text: string, type = 'image/svg+xml;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadSvgPng(filename: string, svg: string, scale = 2, progress?: ProgressCallback): Promise<void> {
  progress?.({ label: 'Exporting PNG', detail: 'Preparing SVG', value: 0.1 });
  await yieldToBrowser();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    progress?.({ label: 'Exporting PNG', detail: 'Decoding SVG', value: 0.25 });
    await img.decode();
    progress?.({ label: 'Exporting PNG', detail: 'Rasterizing canvas', value: 0.5 });
    await yieldToBrowser();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    progress?.({ label: 'Exporting PNG', detail: 'Encoding PNG', indeterminate: true });
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('PNG encoding failed')), 'image/png'));
    progress?.({ label: 'Exporting PNG', detail: 'Saving PNG', value: 0.92 });
    const pngUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(pngUrl);
    progress?.({ label: 'Exporting PNG', detail: 'PNG exported', value: 1 });
  } finally {
    URL.revokeObjectURL(url);
  }
}
