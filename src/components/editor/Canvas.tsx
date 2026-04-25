'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { renderHalftone } from '@/lib/halftone-engine';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });

  const {
    settings, viewMode, sourceImage, setRenderTime,
    zoom, setZoom, panX, panY, setPan,
  } = useEditorStore();

  // Render halftone whenever source/settings/viewMode changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;

    const ctx = canvas.getContext('2d')!;
    canvas.width = sourceImage.width;
    canvas.height = sourceImage.height;

    if (viewMode === 'original') {
      ctx.drawImage(sourceImage, 0, 0);
      return;
    }

    if (viewMode === 'grayscale') {
      ctx.drawImage(sourceImage, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = g;
      }
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    const ms = renderHalftone(sourceImage, canvas, settings);
    setRenderTime(ms);
  }, [settings, viewMode, sourceImage, setRenderTime]);

  // Wheel zoom
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(useEditorStore.getState().zoom * delta);
  }, [setZoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // Pan with Alt + drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (!e.altKey) return;
    isPanning.current = true;
    lastPan.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPan.current.x;
    const dy = e.clientY - lastPan.current.y;
    lastPan.current = { x: e.clientX, y: e.clientY };
    const { panX: px, panY: py } = useEditorStore.getState();
    setPan(px + dx, py + dy);
  };

  const onMouseUp = () => { isPanning.current = false; };

  const pixelated = zoom > 2;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden bg-zinc-950 flex items-center justify-center relative"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ cursor: 'default' }}
    >
      {!sourceImage ? (
        <DropZone />
      ) : (
        <div
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.05s ease-out',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              imageRendering: pixelated ? 'pixelated' : 'auto',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      )}
    </div>
  );
}

function DropZone() {
  const { setSourceImage } = useEditorStore();

  const loadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        setSourceImage(canvas);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) loadImage(file);
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  };

  return (
    <label
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center gap-4 w-80 h-56 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-zinc-900/50 transition-colors"
    >
      <div className="text-4xl text-zinc-600">⊕</div>
      <div className="text-center">
        <p className="text-sm text-zinc-300 font-medium">Drop an image here</p>
        <p className="text-xs text-zinc-500 mt-1">or click to browse</p>
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={onInput} />
    </label>
  );
}
