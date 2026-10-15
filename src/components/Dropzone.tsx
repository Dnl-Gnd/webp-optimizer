"use client";

import { useRef, useState } from "react";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif";

export default function Dropzone({ onFiles, compact = false }: { onFiles: (files: File[]) => void; compact?: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const handle = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (files.length) onFiles(files);
  };

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
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
      className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition ${
        compact ? "px-4 py-6" : "px-6 py-16"
      } ${over ? "border-emerald-400 bg-emerald-500/10" : "border-white/15 hover:border-white/30 hover:bg-white/[0.03]"}`}
    >
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { handle(e.target.files); e.target.value = ""; }} data-testid="file-input" />
      <svg width={compact ? 28 : 44} height={compact ? 28 : 44} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
        <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <p className={`${compact ? "text-sm" : "text-lg"} font-medium text-white`}>
          {compact ? "Agregar más imágenes" : "Arrastra tus imágenes aquí"}
        </p>
        {!compact && <p className="mt-1 text-sm text-neutral-400">o haz clic para elegir · PNG, JPG, GIF, BMP, AVIF, WebP</p>}
      </div>
    </div>
  );
}
