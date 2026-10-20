"use client";

import type { ImageItem } from "@/lib/types";
import { formatBytes, savingPercent } from "@/lib/format";
import { CODEC_INFO } from "@/lib/codecs";

type Props = {
  item: ImageItem;
  outputName: string;
  targetKB?: number;
  onCompare: () => void;
  onDownload: () => void;
  onRemove: () => void;
};

export default function ImageCard({ item, outputName, targetKB, onCompare, onDownload, onRemove }: Props) {
  const { result, status } = item;
  const saving = result ? savingPercent(item.file.size, result.blob.size) : 0;
  const bigger = result ? result.blob.size >= item.file.size : false;
  const busy = status === "processing";
  const missedTarget = result && result.targetMet === false;

  return (
    <li className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3" data-testid="image-card" data-status={status}>
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
        <p className="truncate text-sm font-medium text-white" title={item.folder ? `${item.folder}/${item.file.name}` : item.file.name}>
          {item.folder && <span className="text-neutral-500">{item.folder}/</span>}
          {item.file.name}
        </p>
        {result && (
          <p className="truncate font-mono text-[11px] text-neutral-500" title={outputName} data-testid="output-name">
            → {outputName}
          </p>
        )}
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
              .map((c) => `${CODEC_INFO[c.codec].label} ${formatBytes(c.size)}${c.targetMet === false ? " (excede)" : ""}`)
              .join(" · ")}
          </p>
        )}
        {missedTarget && (
          <p className="mt-1 text-xs text-amber-300/80">
            No cabe en {targetKB} KB ni con calidad mínima; prueba redimensionar o subir el objetivo.
          </p>
        )}
        {result?.flattened && <p className="mt-1 text-xs text-amber-300/80">JPEG no admite transparencia: el fondo se rellenó en blanco.</p>}
        {bigger && !missedTarget && (
          <p className="mt-1 text-xs text-amber-300/80">El resultado pesa más que el original; prueba bajar la calidad u otro formato.</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
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
    </li>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
