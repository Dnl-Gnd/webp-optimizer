"use client";

import type { Settings } from "@/lib/types";

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
};

const PRESETS = [
  { label: "Máxima calidad", quality: 92 },
  { label: "Equilibrado", quality: 80 },
  { label: "Más ligero", quality: 65 },
];

const SIZE_PRESETS = [
  { label: "Original", w: 0, h: 0 },
  { label: "2560", w: 2560, h: 0 },
  { label: "1920", w: 1920, h: 0 },
  { label: "1280", w: 1280, h: 0 },
  { label: "800", w: 800, h: 0 },
];

export default function SettingsPanel({ settings, onChange }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Calidad</h2>
          <span className="font-mono text-lg tabular-nums text-white">{settings.lossless ? "Sin pérdida" : settings.quality}</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={settings.quality}
          disabled={settings.lossless}
          onChange={(e) => set("quality", Number(e.target.value))}
          className="w-full accent-emerald-500 disabled:opacity-40"
          aria-label="Calidad"
        />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={settings.lossless}
              onClick={() => set("quality", p.quality)}
              className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-40 ${
                settings.quality === p.quality && !settings.lossless
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 text-neutral-300 hover:border-white/30"
              }`}
            >
              {p.label} · {p.quality}
            </button>
          ))}
        </div>
        <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={settings.lossless} onChange={(e) => set("lossless", e.target.checked)} className="accent-emerald-500" />
          Sin pérdida (ideal para logos, capturas e íconos)
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Redimensionar</h2>
        <div className="flex flex-wrap gap-2">
          {SIZE_PRESETS.map((p) => {
            const active = settings.maxWidth === p.w && settings.maxHeight === p.h;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange({ ...settings, maxWidth: p.w, maxHeight: p.h })}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  active ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-white/10 text-neutral-300 hover:border-white/30"
                }`}
              >
                {p.w ? `${p.label}px` : p.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Ancho máx." value={settings.maxWidth} onChange={(v) => set("maxWidth", v)} />
          <NumberField label="Alto máx." value={settings.maxHeight} onChange={(v) => set("maxHeight", v)} />
        </div>
        <p className="text-xs text-neutral-500">Mantiene la proporción y nunca agranda la imagen. Deja en 0 para no limitar.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Esfuerzo</h2>
          <span className="font-mono text-sm tabular-nums text-neutral-300">{settings.effort}/6</span>
        </div>
        <input
          type="range"
          min={0}
          max={6}
          value={settings.effort}
          onChange={(e) => set("effort", Number(e.target.value))}
          className="w-full accent-emerald-500"
          aria-label="Esfuerzo de compresión"
        />
        <p className="text-xs text-neutral-500">Más esfuerzo = archivo un poco más pequeño, pero tarda más.</p>
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-400">
      {label}
      <div className="flex items-center rounded-lg border border-white/10 bg-black/30 focus-within:border-emerald-500">
        <input
          type="number"
          min={0}
          step={1}
          value={value || ""}
          placeholder="0"
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none"
        />
        <span className="pr-3 text-neutral-500">px</span>
      </div>
    </label>
  );
}
