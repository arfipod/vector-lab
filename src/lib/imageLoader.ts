import type { ProgressCallback, SourceImage } from '../types';
import { yieldToBrowser } from './progress';

export function fitSize(width: number, height: number, maxSide: number): { width: number; height: number; scale: number } {
  const side = Math.max(width, height);
  if (side <= maxSide) return { width, height, scale: 1 };
  const scale = maxSide / side;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

async function urlToImageData(url: string, maxSide: number, progress?: ProgressCallback): Promise<{ width: number; height: number; imageData: ImageData; previewUrl: string }> {
  const img = new Image();
  img.decoding = 'async';
  img.crossOrigin = 'anonymous';
  img.src = url;
  progress?.({ label: 'Loading source image', detail: 'Decoding image', indeterminate: true });
  await img.decode();
  const target = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxSide);
  progress?.({ label: 'Loading source image', detail: `Rasterizing ${target.width} x ${target.height}px`, indeterminate: true });
  await yieldToBrowser();
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, target.width, target.height);
  progress?.({ label: 'Loading source image', detail: 'Preparing preview', indeterminate: true });
  return { width: target.width, height: target.height, imageData: ctx.getImageData(0, 0, target.width, target.height), previewUrl: canvas.toDataURL('image/png') };
}

export async function loadSourceImage(file: File, maxSide: number, progress?: ProgressCallback): Promise<SourceImage> {
  const name = file.name.toLowerCase();
  progress?.({ label: 'Loading source image', detail: file.name, indeterminate: true });
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return loadPdf(file, maxSide, progress);
  if (file.type === 'image/svg+xml' || name.endsWith('.svg')) {
    progress?.({ label: 'Loading source image', detail: 'Reading SVG', indeterminate: true });
    const text = await file.text();
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    try { return { ...(await urlToImageData(url, maxSide, progress)), fileName: file.name, fileType: file.type || 'image/svg+xml', kind: 'svg' }; }
    finally { URL.revokeObjectURL(url); }
  }
  const url = URL.createObjectURL(file);
  try { return { ...(await urlToImageData(url, maxSide, progress)), fileName: file.name, fileType: file.type || 'image/*', kind: 'raster' }; }
  finally { URL.revokeObjectURL(url); }
}

async function loadPdf(file: File, maxSide: number, progress?: ProgressCallback): Promise<SourceImage> {
  progress?.({ label: 'Loading source image', detail: 'Loading PDF renderer', indeterminate: true });
  const pdfjs = await import('pdfjs-dist');
  (pdfjs as any).GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
  progress?.({ label: 'Loading source image', detail: 'Reading PDF', indeterminate: true });
  const pdf = await (pdfjs as any).getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  progress?.({ label: 'Loading source image', detail: 'Preparing first page', indeterminate: true });
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const target = fitSize(viewport.width, viewport.height, maxSide);
  const scaled = page.getViewport({ scale: target.width / viewport.width });
  progress?.({ label: 'Loading source image', detail: `Rasterizing PDF page ${Math.round(scaled.width)} x ${Math.round(scaled.height)}px`, indeterminate: true });
  await yieldToBrowser();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(scaled.width);
  canvas.height = Math.round(scaled.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');
  await page.render({ canvasContext: ctx, viewport: scaled }).promise;
  progress?.({ label: 'Loading source image', detail: 'Preparing preview', indeterminate: true });
  return { fileName: file.name, fileType: file.type || 'application/pdf', kind: 'pdf', width: canvas.width, height: canvas.height, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), previewUrl: canvas.toDataURL('image/png') };
}

export function blurImageData(imageData: ImageData, radius: number): ImageData {
  if (radius <= 0) return imageData;
  const a = document.createElement('canvas');
  a.width = imageData.width; a.height = imageData.height;
  const ac = a.getContext('2d');
  if (!ac) return imageData;
  ac.putImageData(imageData, 0, 0);
  const b = document.createElement('canvas');
  b.width = imageData.width; b.height = imageData.height;
  const bc = b.getContext('2d', { willReadFrequently: true });
  if (!bc) return imageData;
  bc.filter = `blur(${radius}px)`;
  bc.drawImage(a, 0, 0);
  return bc.getImageData(0, 0, b.width, b.height);
}

export function imageDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width; canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function rasterSvgWrapper(imageData: ImageData): string {
  const url = imageDataUrl(imageData);
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${imageData.width}" height="${imageData.height}" viewBox="0 0 ${imageData.width} ${imageData.height}"><image href="${url}" width="${imageData.width}" height="${imageData.height}"/></svg>`;
}
