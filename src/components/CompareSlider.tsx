"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
};

/** Comparador antes/después con deslizador (mouse, touch y teclado). */
export default function CompareSlider({ before, after, beforeLabel = "Original", afterLabel = "WebP" }: Props) {
  const [pos, setPos] = useState(50);
  const [zoom, setZoom] = useState(false);
  // Ancho del resultado: en 1:1 el original se escala a ese ancho para que ambos coincidan.
  const [natural, setNatural] = useState<{ w: number } | null>(null);
  const imgClass = zoom ? "block h-auto max-w-none" : "block h-auto max-h-[70vh] w-full object-contain";
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => dragging.current && update(e.clientX);
    const up = () => (dragging.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [update]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-neutral-400">
        <span>Arrastra el divisor para comparar</span>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} className="accent-emerald-500" />
          Tamaño real (1:1)
        </label>
      </div>
      <div className={zoom ? "max-h-[70vh] overflow-auto rounded-lg" : ""}>
        <div
          ref={ref}
          className="checker relative select-none overflow-hidden rounded-lg touch-none"
          style={zoom ? { width: "max-content" } : undefined}
          onPointerDown={(e) => {
            dragging.current = true;
            update(e.clientX);
          }}
        >
          {/* Ambas imágenes ocupan la misma celda del grid, así quedan alineadas píxel a píxel. */}
          <div className="grid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={after} alt={afterLabel} draggable={false} className={`[grid-area:1/1] ${imgClass}`} style={zoom ? { width: natural?.w } : undefined} onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth })} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={before}
              alt={beforeLabel}
              draggable={false}
              className={`[grid-area:1/1] ${imgClass}`}
              style={{ clipPath: `inset(0 ${100 - pos}% 0 0)`, ...(zoom ? { width: natural?.w } : {}) }}
            />
          </div>
          <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">{beforeLabel}</span>
          <span className="pointer-events-none absolute right-3 top-3 rounded bg-emerald-600/90 px-2 py-1 text-xs font-medium text-white">{afterLabel}</span>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Posición del comparador"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 2));
              if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 2));
            }}
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 cursor-ew-resize bg-white shadow-[0_0_0_1px_rgba(0,0,0,.4)] outline-none"
            style={{ left: `${pos}%` }}
          >
            <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/20 bg-white text-neutral-800 shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
