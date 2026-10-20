"use client";

import type { Naming, OutputFormat } from "@/lib/types";
import { buildOutputName } from "@/lib/format";
import { CODEC_INFO } from "@/lib/codecs";

type Props = {
  naming: Naming;
  format: OutputFormat;
  /** Primer archivo cargado, para la vista previa. */
  sample?: { name: string; folder: string; width?: number };
  onChange: (n: Naming) => void;
};

export default function NamingPanel({ naming, format, sample, onChange }: Props) {
  const set = <K extends keyof Naming>(k: K, v: Naming[K]) => onChange({ ...naming, [k]: v });
  const ext = format === "auto" ? "webp" : CODEC_INFO[format].ext;
  const s = sample ?? { name: "Foto Héroe (Final).png", folder: "", width: 1280 };
  const preview = buildOutputName(s.name, ext, naming, { width: s.width ?? 1280, folder: s.folder, withFolder: true });

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Nombres de archivo</h2>

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Prefijo" placeholder="ej. web-" value={naming.prefix} onChange={(v) => set("prefix", v)} />
        <TextField label="Sufijo" placeholder="ej. -opt" value={naming.suffix} onChange={(v) => set("suffix", v)} />
      </div>

      <div className="flex flex-col gap-2 text-sm text-neutral-300">
        <Toggle checked={naming.slug} onChange={(v) => set("slug", v)}>
          Formato slug <span className="text-neutral-500">(minúsculas, sin acentos ni espacios)</span>
        </Toggle>
        <Toggle checked={naming.addWidth} onChange={(v) => set("addWidth", v)}>
          Añadir ancho final <span className="text-neutral-500">(-1280w)</span>
        </Toggle>
        <Toggle checked={naming.keepFolders} onChange={(v) => set("keepFolders", v)}>
          Conservar carpetas en el ZIP
        </Toggle>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-neutral-500">Vista previa</p>
        <p className="break-all font-mono text-xs text-emerald-300" data-testid="name-preview">
          {preview}
        </p>
      </div>
    </section>
  );
}

function TextField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-400">
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={40}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-500"
      />
    </label>
  );
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-emerald-500" />
      <span>{children}</span>
    </label>
  );
}
