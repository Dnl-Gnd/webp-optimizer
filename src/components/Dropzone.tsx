"use client";

import { useRef, useState } from "react";
import { filesFromDataTransfer, filesFromInput } from "@/lib/files";
import type { IncomingFile } from "@/lib/types";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif";

export default function Dropzone({ onFiles, compact = false }: { onFiles: (files: IncomingFile[]) => void; compact?: boolean }) {
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const emit = (files: IncomingFile[]) => files.length && onFiles(files);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        setReading(true);
        try {
          emit(await filesFromDataTransfer(e.dataTransfer));
        } finally {
          setReading(false);
        }
      }}
      className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition ${
        compact ? "px-4 py-6" : "px-6 py-16"
      } ${over ? "border-emerald-400 bg-emerald-500/10" : "border-white/15 hover:border-white/30 hover:bg-white/[0.03]"}`}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        data-testid="file-input"
        onChange={(e) => {
          if (e.target.files) emit(filesFromInput(e.target.files));
          e.target.value = "";
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        data-testid="folder-input"
        // @ts-expect-error: atributo no estándar soportado por todos los navegadores modernos
        webkitdirectory=""
        onChange={(e) => {
          if (e.target.files) emit(filesFromInput(e.target.files));
          e.target.value = "";
        }}
      />
      <svg width={compact ? 28 : 44} height={compact ? 28 : 44} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
        <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <p className={`${compact ? "text-sm" : "text-lg"} font-medium text-white`}>
          {reading ? "Leyendo carpeta…" : compact ? "Agregar más imágenes" : "Arrastra imágenes o carpetas aquí"}
        </p>
        {!compact && <p className="mt-1 text-sm text-neutral-400">o haz clic para elegir · PNG, JPG, GIF, BMP, AVIF, WebP</p>}
        <p className={`${compact ? "mt-1" : "mt-3"} flex flex-wrap items-center justify-center gap-x-2 text-xs text-neutral-500`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              folderInput.current?.click();
            }}
            className="text-emerald-400 underline-offset-2 hover:underline"
          >
            Elegir una carpeta
          </button>
          <span aria-hidden>·</span>
          <span>
            o pega con <kbd className="rounded border border-white/15 px-1 font-mono">Ctrl</kbd>+<kbd className="rounded border border-white/15 px-1 font-mono">V</kbd>
          </span>
        </p>
      </div>
    </div>
  );
}
