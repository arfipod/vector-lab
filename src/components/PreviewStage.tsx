import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, SyntheticEvent } from 'react';

interface PreviewSize {
  width: number;
  height: number;
}

interface PreviewStageProps {
  title: string;
  subtitle: string;
  svg?: string;
  imageUrl?: string;
  imageAlt?: string;
  intrinsicSize?: PreviewSize | null;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.2;
const PAN_STEP = 72;
const FALLBACK_SIZE: PreviewSize = { width: 900, height: 640 };

const clamp = (value: number, min = MIN_ZOOM, max = MAX_ZOOM): number => Math.min(max, Math.max(min, value));
const dataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const safeSize = (size: PreviewSize | null | undefined): PreviewSize => {
  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) return FALLBACK_SIZE;
  return size;
};

function parseSvgSize(svg: string | undefined): PreviewSize | null {
  if (!svg) return null;
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'svg') return null;
    const width = Number.parseFloat(root.getAttribute('width') ?? '');
    const height = Number.parseFloat(root.getAttribute('height') ?? '');
    if (width > 0 && height > 0) return { width, height };

    const viewBox = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
    if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) return { width: viewBox[2], height: viewBox[3] };
  } catch {
    return null;
  }
  return null;
}

function viewportPadding(element: HTMLElement): { x: number; y: number } {
  const styles = window.getComputedStyle(element);
  return {
    x: Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight),
    y: Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom),
  };
}

export function PreviewStage({ title, subtitle, svg, imageUrl, imageAlt = 'Preview', intrinsicSize }: PreviewStageProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const fitModeRef = useRef(true);
  const hoveredRef = useRef(false);

  const parsedSvgSize = useMemo(() => parseSvgSize(svg), [svg]);
  const hasPreview = Boolean(svg || imageUrl);
  const previewSrc = svg ? dataUrl(svg) : imageUrl;
  const baseSize = useMemo(
    () => safeSize(intrinsicSize ?? parsedSvgSize),
    [intrinsicSize?.width, intrinsicSize?.height, parsedSvgSize?.width, parsedSvgSize?.height],
  );
  const contentKey = svg ? `svg:${baseSize.width}x${baseSize.height}` : imageUrl ?? 'empty';

  const [size, setSize] = useState<PreviewSize>(baseSize);
  const [zoom, setZoom] = useState(1);
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const calculateFitZoom = useCallback((nextSize: PreviewSize): number => {
    const viewport = viewportRef.current;
    if (!viewport) return 1;
    const padding = viewportPadding(viewport);
    const availableWidth = Math.max(1, viewport.clientWidth - padding.x);
    const availableHeight = Math.max(1, viewport.clientHeight - padding.y);
    return clamp(Math.min(availableWidth / nextSize.width, availableHeight / nextSize.height));
  }, []);

  const centerPreview = useCallback((): void => {
    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    });
  }, []);

  const fitPreview = useCallback((nextSize = size): void => {
    if (!hasPreview) return;
    fitModeRef.current = true;
    setZoom(calculateFitZoom(nextSize));
    centerPreview();
  }, [calculateFitZoom, centerPreview, hasPreview, size]);

  const zoomTo = useCallback((nextZoom: number, anchor?: { clientX: number; clientY: number }): void => {
    if (!hasPreview) return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    const oldZoom = zoom;
    const clampedZoom = clamp(nextZoom);

    fitModeRef.current = false;
    if (!viewport || !content || !anchor) {
      setZoom(clampedZoom);
      return;
    }

    const beforeRect = content.getBoundingClientRect();
    const localX = (anchor.clientX - beforeRect.left) / oldZoom;
    const localY = (anchor.clientY - beforeRect.top) / oldZoom;

    setZoom(clampedZoom);
    window.requestAnimationFrame(() => {
      const afterContent = contentRef.current;
      const afterViewport = viewportRef.current;
      if (!afterContent || !afterViewport) return;
      const afterRect = afterContent.getBoundingClientRect();
      afterViewport.scrollLeft += afterRect.left + localX * clampedZoom - anchor.clientX;
      afterViewport.scrollTop += afterRect.top + localY * clampedZoom - anchor.clientY;
    });
  }, [hasPreview, zoom]);

  const zoomAroundCenter = useCallback((nextZoom: number): void => {
    const viewport = viewportRef.current;
    if (!viewport) {
      zoomTo(nextZoom);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    zoomTo(nextZoom, { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
  }, [zoomTo]);

  const resetPreview = useCallback((): void => {
    fitPreview();
  }, [fitPreview]);

  const setActualSize = useCallback((): void => {
    zoomAroundCenter(1);
  }, [zoomAroundCenter]);

  useEffect(() => {
    const nextSize = baseSize;
    setSize(nextSize);
    fitModeRef.current = true;
    window.requestAnimationFrame(() => {
      if (!hasPreview) return;
      setZoom(calculateFitZoom(nextSize));
      centerPreview();
    });
  }, [baseSize, calculateFitZoom, centerPreview, contentKey, hasPreview]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !hasPreview) return;
    const observer = new ResizeObserver(() => {
      if (fitModeRef.current) fitPreview(size);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitPreview, hasPreview, size]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== ' ' || !hoveredRef.current) return;
      setSpacePressed(true);
      event.preventDefault();
    };
    const onKeyUp = (event: globalThis.KeyboardEvent): void => {
      if (event.key === ' ') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !hasPreview) return;
    const onWheel = (event: globalThis.WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomTo(zoom * direction, { clientX: event.clientX, clientY: event.clientY });
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [hasPreview, zoom, zoomTo]);

  const onImageLoad = (event: SyntheticEvent<HTMLImageElement>): void => {
    if (intrinsicSize || parsedSvgSize) return;
    const img = event.currentTarget;
    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
    const nextSize = { width: img.naturalWidth, height: img.naturalHeight };
    setSize(nextSize);
    if (fitModeRef.current) fitPreview(nextSize);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!hasPreview) return;
    if (event.key === ' ') {
      setSpacePressed(true);
      event.preventDefault();
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomAroundCenter(zoom * ZOOM_STEP);
      return;
    }
    if (event.key === '-') {
      event.preventDefault();
      zoomAroundCenter(zoom / ZOOM_STEP);
      return;
    }
    if (event.key === '0') {
      event.preventDefault();
      fitPreview();
      return;
    }
    if (event.key === '1') {
      event.preventDefault();
      setActualSize();
      return;
    }
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (event.key === 'ArrowLeft') viewport.scrollBy({ left: -PAN_STEP });
      if (event.key === 'ArrowRight') viewport.scrollBy({ left: PAN_STEP });
      if (event.key === 'ArrowUp') viewport.scrollBy({ top: -PAN_STEP });
      if (event.key === 'ArrowDown') viewport.scrollBy({ top: PAN_STEP });
    }
  };

  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === ' ') setSpacePressed(false);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!hasPreview || !spacePressed || event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport) return;
    event.preventDefault();
    viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
    viewport.scrollTop = drag.scrollTop - (event.clientY - drag.y);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  };

  const width = Math.max(1, Math.round(size.width * zoom));
  const height = Math.max(1, Math.round(size.height * zoom));
  const zoomPercent = `${Math.round(zoom * 100)}%`;

  return <section className="preview-panel">
    <div className="preview-toolbar">
      <div className="preview-heading">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
      <div className="preview-controls" aria-label="Preview controls">
        <button type="button" onClick={() => zoomAroundCenter(zoom / ZOOM_STEP)} disabled={!hasPreview} aria-label="Zoom out" title="Zoom out (-)">-</button>
        <button type="button" onClick={() => zoomAroundCenter(zoom * ZOOM_STEP)} disabled={!hasPreview} aria-label="Zoom in" title="Zoom in (+)">+</button>
        <button type="button" onClick={() => fitPreview()} disabled={!hasPreview} aria-label="Fit preview to screen" title="Fit preview (0)">Fit</button>
        <button type="button" onClick={setActualSize} disabled={!hasPreview} aria-label="Show preview at 100 percent" title="100% (1)">100%</button>
        <button type="button" onClick={resetPreview} disabled={!hasPreview} aria-label="Reset preview pan and zoom" title="Reset pan and zoom">Reset</button>
        <output className="zoom-readout" aria-label="Current zoom">{zoomPercent}</output>
      </div>
    </div>
    <div
      ref={viewportRef}
      className={`stage-wrap ${!hasPreview ? 'empty' : dragging ? 'dragging' : spacePressed ? 'space-pan' : ''}`}
      tabIndex={0}
      role="region"
      aria-label="Preview viewport"
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => { hoveredRef.current = true; }}
      onPointerLeave={() => { hoveredRef.current = false; if (!dragRef.current) setSpacePressed(false); }}
      onBlur={() => setSpacePressed(false)}
    >
      {previewSrc ? <div ref={contentRef} className="stage-content" style={{ width, height }}>
        <img src={previewSrc} alt={imageAlt} onLoad={onImageLoad} draggable={false} />
      </div> : <div className="empty-state"><h2>Vector workspace</h2><p>Load a bitmap for vectorization or an SVG for editing.</p></div>}
    </div>
  </section>;
}
