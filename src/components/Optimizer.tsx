"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zipSync } from "fflate";
import Dropzone from "./Dropzone";
import SettingsPanel from "./SettingsPanel";
import NamingPanel from "./NamingPanel";
import ImageCard from "./ImageCard";
import CompareSlider from "./CompareSlider";
import { OptimizerPool } from "@/lib/pool";
import { DEFAULT_NAMING, formatBytes, outputNameFor, savingPercent } from "@/lib/format";
import { filesFromClipboard } from "@/lib/files";
import { CODEC_INFO } from "@/lib/codecs";
import type { ImageItem, IncomingFile, Naming, Settings } from "@/lib/types";

const DEFAULT_SETTINGS: Settings = {
  format: "webp",
  mode: "quality",
  quality: 80,
  targetKB: 200,
  fidelity: "high",
  maxWidth: 0,
  maxHeight: 0,
  lossless: false,
  effort: 4,
};

/** Normaliza combinaciones que no aplican (p. ej. JPEG sin pérdida). */
function effectiveSettings(s: Settings): Settings {
  const mode = s.format === "png" ? "quality" : s.mode;
  const lossless = s.format !== "jpeg" && s.format !== "png" && mode === "quality" && s.lossless;
  return { ...s, mode, lossless, targetKB: Math.max(1, s.targetKB || 1) };
}

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
  const [naming, setNaming] = useState<Naming>(DEFAULT_NAMING);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const effective = useMemo(() => effectiveSettings(settings), [settings]);

  const poolRef = useRef<OptimizerPool | null>(null);
  /** Último trabajo lanzado por imagen: los resultados de trabajos anteriores se descartan. */
  const tokensRef = useRef(new Map<string, number>());
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

  /** Ajustes efectivos de una imagen: los propios si los tiene, si no los globales. */
  const settingsFor = useCallback((it: ImageItem) => (it.override ? effectiveSettings(it.override) : effective), [effective]);

  const schedule = useCallback(async (item: ImageItem, s: Settings, key: string) => {
    const pool = poolRef.current;
    if (!pool) return;
    const token = (tokensRef.current.get(item.id) ?? 0) + 1;
    tokensRef.current.set(item.id, token);
    pool.cancel(item.id);
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "processing", settingsKey: key } : it)));

    const res = await pool.run(item.id, item.file, s);
    if (tokensRef.current.get(item.id) !== token) return; // hay un trabajo más nuevo
    if (!res.ok && res.cancelled) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== item.id) return it;
        if (!res.ok) return { ...it, status: "error", error: res.error };
        if (it.result) URL.revokeObjectURL(it.result.url);
        const blob = new Blob([res.buffer], { type: CODEC_INFO[res.codec].mime });
        return {
          ...it,
          status: "done",
          error: undefined,
          result: {
            blob,
            url: URL.createObjectURL(blob),
            codec: res.codec,
            quality: res.quality,
            targetMet: res.targetMet,
            ssim: res.ssim,
            candidates: res.candidates,
            flattened: res.flattened,
            width: res.width,
            height: res.height,
            origWidth: res.origWidth,
            origHeight: res.origHeight,
          },
        };
      }),
    );
  }, []);

  const addFiles = useCallback((files: IncomingFile[]) => {
    const newItems: ImageItem[] = files.map(({ file, folder }) => ({
      id: crypto.randomUUID(),
      file,
      folder,
      originalUrl: URL.createObjectURL(file),
      status: "processing",
      settingsKey: "",
      override: null,
      customName: null,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  // Pegar imágenes con Ctrl+V en cualquier parte de la página.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files = filesFromClipboard(e.clipboardData);
      if (!files.length) return; // texto normal: dejar que el input lo reciba
      e.preventDefault();
      addFiles(files);
      setToast(files.length === 1 ? "Imagen pegada" : `${files.length} imágenes pegadas`);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Qué ajustes debería tener cada imagen. Solo cambia al tocar ajustes o agregar/quitar imágenes,
  // no cuando llegan resultados.
  const desired = items.map((it) => `${it.id}=${JSON.stringify(settingsFor(it))}`).join("|");

  // Procesa las imágenes cuyos ajustes deseados no coinciden con los del resultado actual.
  useEffect(() => {
    const pending = itemsRef.current
      .map((it) => {
        const s = settingsFor(it);
        return { it, s, key: JSON.stringify(s) };
      })
      .filter(({ it, key }) => it.settingsKey !== key);
    if (!pending.length) return;
    // Imágenes nuevas: de inmediato. Cambios de ajustes: con debounce para no saturar al mover sliders.
    const delay = pending.every(({ it }) => it.settingsKey === "") ? 0 : 350;
    const t = setTimeout(() => pending.forEach(({ it, s, key }) => schedule(it, s, key)), delay);
    return () => clearTimeout(t);
  }, [desired, settingsFor, schedule]);

  const updateItem = (id: string, patch: Partial<ImageItem>) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const removeItem = (id: string) => {
    poolRef.current?.cancel(id);
    tokensRef.current.delete(id);
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
    poolRef.current?.cancelAll();
    tokensRef.current.clear();
    setItems([]);
    setCompareId(null);
  };

  const done = items.filter((i) => i.status === "done" && i.result);
  const busy = items.some((i) => i.status === "processing");

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
        let name = outputNameFor(it, naming, true);
        const n = used.get(name) ?? 0;
        used.set(name, n + 1);
        if (n > 0) name = name.replace(/(\.[^.]+)$/, `-${n + 1}$1`);
        files[name] = new Uint8Array(await it.result!.blob.arrayBuffer());
      }
      // Los formatos de imagen ya están comprimidos: level 0 evita trabajo inútil.
      const zipped = zipSync(files, { level: 0 });
      downloadBlob(new Blob([zipped as BlobPart], { type: "application/zip" }), "imagenes-optimizadas.zip");
    } finally {
      setZipping(false);
    }
  };

  const comparing = items.find((i) => i.id === compareId && i.result);
  const first = items[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
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
                  onClick={() => (done.length === 1 ? downloadBlob(done[0].result!.blob, outputNameFor(done[0], naming)) : downloadZip())}
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
                  outputName={outputNameFor(it, naming, true)}
                  settings={settingsFor(it)}
                  globalSettings={settings}
                  onRename={(name) => updateItem(it.id, { customName: name })}
                  onOverride={(s) => updateItem(it.id, { override: s })}
                  onCompare={() => setCompareId(it.id)}
                  onDownload={() => it.result && downloadBlob(it.result.blob, outputNameFor(it, naming))}
                  onRemove={() => removeItem(it.id)}
                />
              ))}
            </ul>
            <Dropzone onFiles={addFiles} compact />
          </>
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
        <SettingsPanel settings={settings} onChange={setSettings} />
        <NamingPanel
          naming={naming}
          format={settings.format}
          sample={first ? { name: first.file.name, folder: first.folder, width: first.result?.width } : undefined}
          onChange={setNaming}
        />
        <p className="px-1 text-xs leading-relaxed text-neutral-500">
          Todo se procesa en tu navegador con WebAssembly (libwebp, libavif, MozJPEG y OxiPNG). Tus imágenes nunca se suben a ningún servidor.
        </p>
      </aside>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow-lg" role="status">
          {toast}
        </div>
      )}

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
                  {formatBytes(comparing.file.size)} → {formatBytes(comparing.result.blob.size)} · {CODEC_INFO[comparing.result.codec].label}{" "}
                  {comparing.result.quality !== null ? `calidad ${comparing.result.quality}` : "sin pérdida"}
                </p>
              </div>
              <button type="button" onClick={() => setCompareId(null)} className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <CompareSlider before={comparing.originalUrl} after={comparing.result.url} afterLabel={CODEC_INFO[comparing.result.codec].label} />
          </div>
        </div>
      )}
    </div>
  );
}
