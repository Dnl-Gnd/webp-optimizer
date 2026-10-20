"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
};

type View = "slider" | "diff";
type Dims = { w: number; h: number };

const LOUPE = 150; // tamaño de cada panel de la lupa (px)
const ZOOMS = [2, 4, 8] as const;
const DIFF_AMPLIFY = 4;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Mapa de diferencias: compara el original (escalado a las dimensiones del resultado)
 * con el resultado, píxel a píxel, y pinta la diferencia como mapa de calor.
 */
async function buildDiff(before: string, after: string) {
  const [a, b] = await Promise.all([loadImage(before), loadImage(after)]);
  const w = b.naturalWidth;
  const h = b.naturalHeight;
  const ctx = (img: HTMLImageElement) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    // Fondo blanco: la transparencia se compara igual que se vería sobre una página clara.
    x.fillStyle = "#fff";
    x.fillRect(0, 0, w, h);
    x.imageSmoothingQuality = "high";
    x.drawImage(img, 0, 0, w, h);
    return x.getImageData(0, 0, w, h);
  };
  const da = ctx(a).data;
  const db = ctx(b).data;
  const out = new ImageData(w, h);
  const o = out.data;
  let noticeable = 0;
  let sum = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    sum += d;
    if (d > 12) noticeable++;
    const v = Math.min(1, (d * DIFF_AMPLIFY) / 255);
    // negro → rojo → amarillo → blanco
    o[i] = Math.round(255 * Math.min(1, v * 2));
    o[i + 1] = Math.round(255 * Math.max(0, Math.min(1, v * 2 - 0.6)));
    o[i + 2] = Math.round(255 * Math.max(0, v * 3 - 2));
    o[i + 3] = 255;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(out, 0, 0);
  const blob = await new Promise<Blob>((r) => c.toBlob((bb) => r(bb!), "image/png"));
  const px = w * h;
  return { url: URL.createObjectURL(blob), noticeable: (noticeable / px) * 100, mean: sum / px };
}

/** Comparador antes/después con deslizador, lupa y mapa de diferencias. */
export default function CompareSlider({ before, after, beforeLabel = "Original", afterLabel = "WebP" }: Props) {
  const [view, setView] = useState<View>("slider");
  const [pos, setPos] = useState(50);
  const [actual, setActual] = useState(false);
  const [loupeOn, setLoupeOn] = useState(false);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(4);
  const [natural, setNatural] = useState<Dims | null>(null);
  const [display, setDisplay] = useState<Dims | null>(null);
  const [pointer, setPointer] = useState<{ fx: number; fy: number; cx: number; cy: number } | null>(null);
  const [diff, setDiff] = useState<{ url: string; noticeable: number; mean: number } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Dimensiones naturales del resultado: definen la caja de ambas imágenes.
  useEffect(() => {
    let alive = true;
    loadImage(after).then((img) => alive && setNatural({ w: img.naturalWidth, h: img.naturalHeight }));
    return () => {
      alive = false;
    };
  }, [after]);

  // Tamaño mostrado: encaja en el ancho disponible y 70% del alto de la ventana (o 1:1).
  useLayoutEffect(() => {
    if (!natural) return;
    const fit = () => {
      if (actual) return setDisplay(natural);
      const maxW = wrapRef.current?.clientWidth ?? natural.w;
      const maxH = window.innerHeight * 0.7;
      // No agranda imágenes pequeñas: se ven a su tamaño real como máximo.
      const s = Math.min(1, maxW / natural.w, maxH / natural.h);
      setDisplay({ w: Math.round(natural.w * s), h: Math.round(natural.h * s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [natural, actual]);

  // El mapa de diferencias se calcula solo la primera vez que se pide.
  useEffect(() => {
    if (view !== "diff" || diff || diffLoading) return;
    setDiffLoading(true);
    buildDiff(before, after)
      .then(setDiff)
      .finally(() => setDiffLoading(false));
  }, [view, diff, diffLoading, before, after]);

  useEffect(() => () => {
    if (diff) URL.revokeObjectURL(diff.url);
  }, [diff]);

  const updateSlider = useCallback((clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => dragging.current && updateSlider(e.clientX);
    const up = () => (dragging.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [updateSlider]);

  const onHover = (e: React.PointerEvent) => {
    if (!loupeOn) return;
    const rect = boxRef.current!.getBoundingClientRect();
    setPointer({
      fx: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      fy: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      cx: e.clientX,
      cy: e.clientY,
    });
  };

  const box = display ?? { w: 0, h: 0 };
  const sized = { width: box.w, height: box.h };

  // Lupa: muestra la misma zona en cada imagen, a `zoom`× los píxeles reales del resultado.
  const loupePanes =
    view === "diff"
      ? [{ src: diff?.url, label: "Diferencias" }]
      : [
          { src: before, label: beforeLabel },
          { src: after, label: afterLabel },
        ];
  const loupeWidth = loupePanes.length * LOUPE + (loupePanes.length - 1) * 4;
  const paneStyle = (src?: string): React.CSSProperties => {
    if (!pointer || !natural || !src) return {};
    const bw = natural.w * zoom;
    const bh = natural.h * zoom;
    return {
      backgroundImage: `url(${src})`,
      backgroundSize: `${bw}px ${bh}px`,
      backgroundPosition: `${LOUPE / 2 - pointer.fx * bw}px ${LOUPE / 2 - pointer.fy * bh}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated",
    };
  };
  const loupeLeft = pointer ? (pointer.cx + 24 + loupeWidth > window.innerWidth ? pointer.cx - 24 - loupeWidth : pointer.cx + 24) : 0;
  const loupeTop = pointer ? Math.max(8, Math.min(window.innerHeight - LOUPE - 32, pointer.cy - LOUPE / 2)) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-400">
        <div className="flex rounded-lg border border-white/10 p-0.5 text-xs" role="tablist" aria-label="Vista de comparación">
          {(
            [
              ["slider", "Deslizador"],
              ["diff", "Diferencias"],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 transition ${view === v ? "bg-white/15 text-white" : "hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={loupeOn} onChange={(e) => setLoupeOn(e.target.checked)} className="accent-emerald-500" />
            Lupa
          </label>
          {loupeOn && (
            <div className="flex rounded-lg border border-white/10 p-0.5 text-xs" aria-label="Aumento de la lupa">
              {ZOOMS.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={`rounded-md px-2 py-0.5 ${zoom === z ? "bg-white/15 text-white" : "hover:text-white"}`}
                >
                  {z}×
                </button>
              ))}
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={actual} onChange={(e) => setActual(e.target.checked)} className="accent-emerald-500" />
            Tamaño real (1:1)
          </label>
        </div>
      </div>

      <div ref={wrapRef} className={actual ? "max-h-[70vh] overflow-auto rounded-lg" : "flex justify-center"}>
        <div
          ref={boxRef}
          data-testid="compare-box"
          className={`checker relative select-none overflow-hidden rounded-lg touch-none ${loupeOn ? "cursor-crosshair" : ""}`}
          style={sized}
          onPointerDown={(e) => {
            if (view !== "slider") return;
            dragging.current = true;
            updateSlider(e.clientX);
          }}
          onPointerMove={onHover}
          onPointerLeave={() => setPointer(null)}
        >
          {view === "slider" ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={after} alt={afterLabel} draggable={false} className="absolute inset-0 block max-w-none" style={sized} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={before}
                alt={beforeLabel}
                draggable={false}
                className="absolute inset-0 block max-w-none"
                style={{ ...sized, clipPath: `inset(0 ${100 - pos}% 0 0)` }}
              />
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
            </>
          ) : diff ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={diff.url} alt="Mapa de diferencias" draggable={false} className="absolute inset-0 block max-w-none" style={sized} data-testid="diff-image" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-neutral-300">
              {diffLoading ? "Calculando diferencias…" : "No se pudo calcular el mapa"}
            </div>
          )}
        </div>
      </div>

      {view === "diff" && diff && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-400" data-testid="diff-stats">
          <div className="flex items-center gap-2">
            <span>Igual</span>
            <span className="h-2 w-28 rounded-full" style={{ background: "linear-gradient(90deg,#000,#f00 45%,#ff0 75%,#fff)" }} />
            <span>Muy distinto</span>
          </div>
          <span>
            <span className="font-medium text-white">{diff.noticeable < 0.1 ? "<0.1" : diff.noticeable.toFixed(1)}%</span> de píxeles con diferencia notable
          </span>
          <span>Diferencia media: {diff.mean.toFixed(1)}/255</span>
          <span className="text-neutral-500">Diferencias amplificadas {DIFF_AMPLIFY}× para que se vean. Si redimensionaste, parte viene del cambio de tamaño.</span>
        </div>
      )}

      {loupeOn && pointer && (
        <div
          className="pointer-events-none fixed z-[60] flex gap-1 rounded-xl border border-white/20 bg-neutral-950 p-1 shadow-2xl"
          style={{ left: loupeLeft, top: loupeTop }}
          data-testid="loupe"
        >
          {loupePanes.map((p) => (
            <div key={p.label} className="checker relative overflow-hidden rounded-lg" style={{ width: LOUPE, height: LOUPE }}>
              <div className="absolute inset-0" style={paneStyle(p.src)} />
              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{p.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
