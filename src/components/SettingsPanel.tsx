"use client";

import type { CompressionMode, Fidelity, OutputFormat, Settings } from "@/lib/types";
import { FIDELITY_INFO } from "@/lib/codecs";

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
  /** Variante embebida en una tarjeta (ajustes por imagen). */
  embedded?: boolean;
};

const MODES: { value: CompressionMode; label: string }[] = [
  { value: "quality", label: "Calidad" },
  { value: "auto", label: "Calidad auto" },
  { value: "target", label: "Peso objetivo" },
];

const FORMATS: { value: OutputFormat; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Prueba WebP, AVIF y JPEG y elige el mejor para cada imagen." },
  { value: "webp", label: "WebP", hint: "Ligero y compatible con todos los navegadores actuales." },
  { value: "avif", label: "AVIF", hint: "El más ligero en fotos; tarda más en codificar." },
  { value: "jpeg", label: "JPEG", hint: "Máxima compatibilidad. No admite transparencia (se rellena en blanco)." },
  { value: "png", label: "PNG", hint: "Sin pérdida, optimizado con OxiPNG. Ideal para logos e íconos." },
];

const QUALITY_PRESETS = [
  { label: "Máxima calidad", quality: 92 },
  { label: "Equilibrado", quality: 80 },
  { label: "Más ligero", quality: 65 },
];

const TARGET_PRESETS = [50, 100, 200, 500, 1000];

const SIZE_PRESETS = [
  { label: "Original", w: 0, h: 0 },
  { label: "2560", w: 2560, h: 0 },
  { label: "1920", w: 1920, h: 0 },
  { label: "1280", w: 1280, h: 0 },
  { label: "800", w: 800, h: 0 },
];

export default function SettingsPanel({ settings, onChange, embedded = false }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });

  const isPng = settings.format === "png";
  const isJpeg = settings.format === "jpeg";
  // Sin pérdida no aplica a JPEG/PNG (PNG siempre lo es) ni a los modos automáticos.
  const losslessAvailable = !isPng && !isJpeg && settings.mode === "quality";
  const lossless = losslessAvailable && settings.lossless;
  const formatHint = FORMATS.find((f) => f.value === settings.format)?.hint;

  return (
    <section className={embedded ? "flex flex-col gap-5" : "flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5"}>
      {/* Formato */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Formato</h2>
        <div className="grid grid-cols-5 gap-1 rounded-xl border border-white/10 bg-black/30 p-1" role="radiogroup" aria-label="Formato de salida">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={settings.format === f.value}
              onClick={() => set("format", f.value)}
              className={`rounded-lg px-1 py-1.5 text-xs font-medium transition ${
                settings.format === f.value ? "bg-emerald-500 text-black" : "text-neutral-300 hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500">{formatHint}</p>
      </div>

      {/* Compresión */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Compresión</h2>
        {!isPng && (
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/30 p-1 text-xs" role="radiogroup" aria-label="Modo de compresión">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={settings.mode === m.value}
                onClick={() => set("mode", m.value)}
                className={`rounded-lg px-1 py-1.5 font-medium transition ${settings.mode === m.value ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {isPng ? (
          <p className="text-xs text-neutral-500">PNG es siempre sin pérdida: se optimiza la compresión sin tocar un solo píxel.</p>
        ) : settings.mode === "quality" ? (
          <>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={settings.quality}
                disabled={lossless}
                onChange={(e) => set("quality", Number(e.target.value))}
                className="w-full accent-emerald-500 disabled:opacity-40"
                aria-label="Calidad"
              />
              <span className="w-24 text-right font-mono text-lg tabular-nums text-white">{lossless ? "Sin pérdida" : settings.quality}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUALITY_PRESETS.map((p) => (
                <Chip key={p.label} active={settings.quality === p.quality && !lossless} disabled={lossless} onClick={() => set("quality", p.quality)}>
                  {p.label} · {p.quality}
                </Chip>
              ))}
            </div>
          </>
        ) : settings.mode === "auto" ? (
          <>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FIDELITY_INFO) as Fidelity[]).map((f) => (
                <Chip key={f} active={settings.fidelity === f} onClick={() => set("fidelity", f)}>
                  {FIDELITY_INFO[f].label}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              {FIDELITY_INFO[settings.fidelity].hint} Busca la calidad más baja que se ve igual al original (medido con SSIM).
            </p>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Peso máximo por imagen
              <div className="flex items-center rounded-lg border border-white/10 bg-black/30 focus-within:border-emerald-500">
                <input
                  type="number"
                  min={1}
                  step={10}
                  value={settings.targetKB || ""}
                  placeholder="200"
                  onChange={(e) => set("targetKB", Math.max(1, Math.floor(Number(e.target.value) || 0)))}
                  className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none"
                  aria-label="Peso objetivo en KB"
                />
                <span className="pr-3 text-neutral-500">KB</span>
              </div>
            </label>
            <div className="flex flex-wrap gap-2">
              {TARGET_PRESETS.map((kb) => (
                <Chip key={kb} active={settings.targetKB === kb} onClick={() => set("targetKB", kb)}>
                  {kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-neutral-500">Busca la calidad más alta que quepa en ese peso. Si no se alcanza ni con calidad mínima, prueba redimensionar.</p>
          </>
        )}

        {losslessAvailable && (
          <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={settings.lossless} onChange={(e) => set("lossless", e.target.checked)} className="accent-emerald-500" />
            Sin pérdida {settings.format === "auto" ? "(compara WebP y PNG)" : "(ideal para logos y capturas)"}
          </label>
        )}
      </div>

      {/* Redimensionar */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Redimensionar</h2>
        <div className="flex flex-wrap gap-2">
          {SIZE_PRESETS.map((p) => (
            <Chip key={p.label} active={settings.maxWidth === p.w && settings.maxHeight === p.h} onClick={() => onChange({ ...settings, maxWidth: p.w, maxHeight: p.h })}>
              {p.w ? `${p.label}px` : p.label}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Ancho máx." unit="px" value={settings.maxWidth} onChange={(v) => set("maxWidth", v)} />
          <NumberField label="Alto máx." unit="px" value={settings.maxHeight} onChange={(v) => set("maxHeight", v)} />
        </div>
        <p className="text-xs text-neutral-500">Mantiene la proporción y nunca agranda la imagen. Deja en 0 para no limitar.</p>
      </div>

      {/* Esfuerzo */}
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

export function Chip({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-40 ${
        active ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-white/10 text-neutral-300 hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}

export function NumberField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
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
        <span className="pr-3 text-neutral-500">{unit}</span>
      </div>
    </label>
  );
}
