"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageItem, Settings } from "@/lib/types";
import { cleanCustomName, formatBytes, savingPercent } from "@/lib/format";
import { CODEC_INFO } from "@/lib/codecs";
import SettingsPanel from "./SettingsPanel";

type Props = {
  item: ImageItem;
  outputName: string;
  /** Ajustes efectivos de esta imagen (globales o propios). */
  settings: Settings;
  globalSettings: Settings;
  onCompare: () => void;
  onDownload: () => void;
  onRemove: () => void;
  onRename: (name: string | null) => void;
  onOverride: (s: Settings | null) => void;
};

export default function ImageCard({ item, outputName, settings, globalSettings, onCompare, onDownload, onRemove, onRename, onOverride }: Props) {
  const { result, status } = item;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Evita que el blur posterior a Escape/Enter vuelva a guardar.
  const closing = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const saving = result ? savingPercent(item.file.size, result.blob.size) : 0;
  const bigger = result ? result.blob.size >= item.file.size : false;
  const busy = status === "processing";
  const missedTarget = result && result.targetMet === false;
  const ext = result ? CODEC_INFO[result.codec].ext : "";
  // Nombre sin carpeta ni extensión, para editar.
  const currentBase = outputName.split("/").pop()!.replace(/\.[^.]+$/, "");

  const startEdit = () => {
    closing.current = false;
    setDraft(item.customName ?? currentBase);
    setEditing(true);
  };
  const cancel = () => {
    closing.current = true;
    setEditing(false);
  };
  const commit = () => {
    if (closing.current) return;
    closing.current = true;
    const clean = cleanCustomName(draft);
    onRename(clean ? clean : null);
    setEditing(false);
  };

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03]" data-testid="image-card" data-status={status}>
      <div className="flex items-center gap-4 p-3">
        <button
          type="button"
          onClick={onCompare}
          disabled={!result}
          className="checker relative h-16 w-16 shrink-0 overflow-hidden rounded-lg disabled:cursor-default"
          aria-label="Comparar antes y después"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result?.url ?? item.originalUrl} alt="" className="h-full w-full object-cover" />
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-medium text-white" title={item.folder ? `${item.folder}/${item.file.name}` : item.file.name}>
            <span className="truncate">
              {item.folder && <span className="text-neutral-500">{item.folder}/</span>}
              {item.file.name}
            </span>
            {item.override && (
              <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300" data-testid="custom-badge">
                Ajustes propios
              </span>
            )}
          </p>

          {result &&
            (editing ? (
              <form
                className="mt-0.5 flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  commit();
                }}
              >
                <span className="text-[11px] text-neutral-500">→</span>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => e.key === "Escape" && cancel()}
                  maxLength={120}
                  aria-label="Nuevo nombre"
                  className="min-w-0 flex-1 rounded border border-emerald-500/60 bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-white outline-none"
                />
                <span className="font-mono text-[11px] text-neutral-500">.{ext}</span>
              </form>
            ) : (
              <div className="group mt-0.5 flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={startEdit}
                  className={`truncate text-left font-mono text-[11px] hover:text-white ${item.customName ? "text-emerald-300" : "text-neutral-500"}`}
                  title="Clic para renombrar"
                  data-testid="output-name"
                >
                  → {outputName}
                </button>
                <button type="button" onClick={startEdit} className="shrink-0 text-neutral-500 opacity-60 hover:text-white group-hover:opacity-100" aria-label="Renombrar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                {item.customName && (
                  <button type="button" onClick={() => onRename(null)} className="shrink-0 text-[10px] text-neutral-500 underline-offset-2 hover:text-white hover:underline">
                    restablecer
                  </button>
                )}
              </div>
            ))}

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
            <span>{formatBytes(item.file.size)}</span>
            {result && (
              <>
                <span aria-hidden>→</span>
                <span className="font-medium text-white" data-testid="optimized-size">
                  {formatBytes(result.blob.size)}
                </span>
                <span className={`rounded px-1.5 py-0.5 font-medium ${bigger ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                  {bigger ? `+${Math.abs(saving)}%` : `−${saving}%`}
                </span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-medium text-neutral-200" data-testid="codec">
                  {CODEC_INFO[result.codec].label}
                  {result.quality !== null ? ` · q${result.quality}` : " · sin pérdida"}
                </span>
                {result.ssim !== undefined && (
                  <span className="text-neutral-500" title="Similitud estructural con el original (1 = idéntico)" data-testid="ssim">
                    SSIM {result.ssim.toFixed(3)}
                  </span>
                )}
                <span className="text-neutral-500">
                  {result.origWidth !== result.width ? `${result.origWidth}×${result.origHeight} → ${result.width}×${result.height}` : `${result.width}×${result.height}`}
                </span>
              </>
            )}
            {busy && <span>Optimizando…</span>}
            {status === "error" && <span className="text-red-400">Error: {item.error}</span>}
          </div>

          {result && result.candidates.length > 1 && (
            <p className="mt-1 text-[11px] text-neutral-500" data-testid="candidates">
              Probados:{" "}
              {result.candidates
                .slice()
                .sort((a, b) => a.size - b.size)
                .map((c) => `${CODEC_INFO[c.codec].label} ${formatBytes(c.size)}${c.quality !== null && settings.mode === "auto" ? ` (q${c.quality})` : ""}${c.targetMet === false ? " (excede)" : ""}`)
                .join(" · ")}
            </p>
          )}
          {missedTarget && (
            <p className="mt-1 text-xs text-amber-300/80">No cabe en {settings.targetKB} KB ni con calidad mínima; prueba redimensionar o subir el objetivo.</p>
          )}
          {result?.flattened && <p className="mt-1 text-xs text-amber-300/80">JPEG no admite transparencia: el fondo se rellenó en blanco.</p>}
          {bigger && !missedTarget && <p className="mt-1 text-xs text-amber-300/80">El resultado pesa más que el original; prueba bajar la calidad u otro formato.</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Ajustes de esta imagen" onClick={() => setShowSettings((v) => !v)} active={showSettings || !!item.override}>
            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="10" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
          </IconButton>
          <IconButton label="Comparar" onClick={onCompare} disabled={!result}>
            <path d="M12 3v18M5 7l-3 5 3 5M19 7l3 5-3 5" />
          </IconButton>
          <IconButton label="Descargar" onClick={onDownload} disabled={!result}>
            <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
          </IconButton>
          <IconButton label="Quitar" onClick={onRemove}>
            <path d="M6 6l12 12M18 6L6 18" />
          </IconButton>
        </div>
      </div>

      {showSettings && (
        <div className="border-t border-white/10 p-4" data-testid="item-settings">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-300">
              {item.override ? "Esta imagen usa ajustes propios." : "Usa los ajustes globales. Cambia cualquier valor para personalizarla."}
            </p>
            {item.override && (
              <button type="button" onClick={() => onOverride(null)} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-neutral-300 hover:border-white/30 hover:text-white">
                Volver a los globales
              </button>
            )}
          </div>
          <SettingsPanel embedded settings={item.override ?? globalSettings} onChange={(s) => onOverride(s)} />
        </div>
      )}
    </li>
  );
}

function IconButton({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-2 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent ${active ? "text-sky-300" : "text-neutral-300"}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
