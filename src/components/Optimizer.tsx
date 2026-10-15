"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zipSync } from "fflate";
import Dropzone from "./Dropzone";
import SettingsPanel from "./SettingsPanel";
import ImageCard from "./ImageCard";
import CompareSlider from "./CompareSlider";
import { OptimizerPool } from "@/lib/pool";
import { formatBytes, savingPercent, toWebpName } from "@/lib/format";
import type { ImageItem, Settings } from "@/lib/types";

const DEFAULT_SETTINGS: Settings = {
  quality: 80,
  maxWidth: 0,
  maxHeight: 0,
  lossless: false,
  effort: 4,
};

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Optimizer() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  const poolRef = useRef<OptimizerPool | null>(null);
  const settingsRef = useRef(settings);
  const versionRef = useRef(0);
  const itemsRef = useRef<ImageItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    poolRef.current = new OptimizerPool();
    return () => {
      poolRef.current?.terminate();
      itemsRef.current.forEach((i) => {
        URL.revokeObjectURL(i.originalUrl);
        if (i.result) URL.revokeObjectURL(i.result.url);
      });
    };
  }, []);

  const processItem = useCallback(async (item: ImageItem, version: number) => {
    const pool = poolRef.current;
    if (!pool) return;
    const res = await pool.run(item.id, item.file, settingsRef.current);
    // Si los ajustes cambiaron mientras se procesaba, descartar este resultado.
    if (version !== versionRef.current) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== item.id) return it;
        if (!res.ok) return { ...it, status: "error", error: res.error, version };
        if (it.result) URL.revokeObjectURL(it.result.url);
        const blob = new Blob([res.buffer], { type: "image/webp" });
        return {
          ...it,
          status: "done",
          version,
          error: undefined,
          result: {
            blob,
            url: URL.createObjectURL(blob),
            width: res.width,
            height: res.height,
            origWidth: res.origWidth,
            origHeight: res.origHeight,
          },
        };
      }),
    );
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const version = versionRef.current;
      const newItems: ImageItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        originalUrl: URL.createObjectURL(file),
        status: "processing",
        version,
      }));
      setItems((prev) => [...prev, ...newItems]);
      newItems.forEach((it) => processItem(it, version));
    },
    [processItem],
  );

  // Reprocesar todo cuando cambian los ajustes (con debounce para no saturar al mover el slider).
  useEffect(() => {
    settingsRef.current = settings;
    const t = setTimeout(() => {
      const current = itemsRef.current;
      if (!current.length) return;
      const version = ++versionRef.current;
      poolRef.current?.clearQueue();
      setItems((prev) => prev.map((it) => ({ ...it, status: "processing" })));
      current.forEach((it) => processItem(it, version));
    }, 350);
    return () => clearTimeout(t);
  }, [settings, processItem]);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) {
        URL.revokeObjectURL(it.originalUrl);
        if (it.result) URL.revokeObjectURL(it.result.url);
      }
      return prev.filter((i) => i.id !== id);
    });
    if (compareId === id) setCompareId(null);
  };

  const clearAll = () => {
    items.forEach((i) => {
      URL.revokeObjectURL(i.originalUrl);
      if (i.result) URL.revokeObjectURL(i.result.url);
    });
    poolRef.current?.clearQueue();
    versionRef.current++;
    setItems([]);
    setCompareId(null);
  };

  const done = items.filter((i) => i.status === "done" && i.result);
  const busy = items.some((i) => i.status === "processing" || i.status === "queued");

  const totals = useMemo(() => {
    const original = done.reduce((s, i) => s + i.file.size, 0);
    const optimized = done.reduce((s, i) => s + (i.result?.blob.size ?? 0), 0);
    return { original, optimized, saving: savingPercent(original, optimized) };
  }, [done]);

  const downloadZip = async () => {
    setZipping(true);
    try {
      const files: Record<string, Uint8Array> = {};
      const used = new Map<string, number>();
      for (const it of done) {
        let name = toWebpName(it.file.name);
        const n = used.get(name) ?? 0;
        used.set(name, n + 1);
        if (n > 0) name = name.replace(/\.webp$/, ` (${n}).webp`);
        files[name] = new Uint8Array(await it.result!.blob.arrayBuffer());
      }
      // WebP ya está comprimido: level 0 evita trabajo inútil.
      const zipped = zipSync(files, { level: 0 });
      downloadBlob(new Blob([zipped as BlobPart], { type: "application/zip" }), "imagenes-webp.zip");
    } finally {
      setZipping(false);
    }
  };

  const comparing = items.find((i) => i.id === compareId && i.result);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        {items.length === 0 ? (
          <Dropzone onFiles={addFiles} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-sm text-neutral-300" data-testid="totals">
                <span className="font-medium text-white">{items.length}</span> {items.length === 1 ? "imagen" : "imágenes"}
                {done.length > 0 && (
                  <>
                    {" · "}
                    {formatBytes(totals.original)} → <span className="font-medium text-white">{formatBytes(totals.optimized)}</span>{" "}
                    <span className={totals.saving >= 0 ? "text-emerald-300" : "text-amber-300"}>
                      ({totals.saving >= 0 ? `−${totals.saving}` : `+${-totals.saving}`}%)
                    </span>
                  </>
                )}
                {busy && <span className="ml-2 text-neutral-500">procesando…</span>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={clearAll} className="rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/10">
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => (done.length === 1 ? downloadBlob(done[0].result!.blob, toWebpName(done[0].file.name)) : downloadZip())}
                  disabled={!done.length || busy || zipping}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-40"
                >
                  {done.length > 1 ? (zipping ? "Generando ZIP…" : "Descargar todo (.zip)") : "Descargar"}
                </button>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {items.map((it) => (
                <ImageCard
                  key={it.id}
                  item={it}
                  onCompare={() => setCompareId(it.id)}
                  onDownload={() => it.result && downloadBlob(it.result.blob, toWebpName(it.file.name))}
                  onRemove={() => removeItem(it.id)}
                />
              ))}
            </ul>
            <Dropzone onFiles={addFiles} compact />
          </>
        )}
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <SettingsPanel settings={settings} onChange={setSettings} />
        <p className="mt-3 px-1 text-xs leading-relaxed text-neutral-500">
          Todo se procesa en tu navegador con libwebp (WebAssembly). Tus imágenes nunca se suben a ningún servidor.
        </p>
      </aside>

      {comparing?.result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setCompareId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-neutral-950 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate font-medium text-white">{comparing.file.name}</h3>
                <p className="text-sm text-neutral-400">
                  {formatBytes(comparing.file.size)} → {formatBytes(comparing.result.blob.size)} · calidad{" "}
                  {settings.lossless ? "sin pérdida" : settings.quality}
                </p>
              </div>
              <button type="button" onClick={() => setCompareId(null)} className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <CompareSlider before={comparing.originalUrl} after={comparing.result.url} />
          </div>
        </div>
      )}
    </div>
  );
}
