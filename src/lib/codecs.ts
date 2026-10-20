import type { Codec, Fidelity } from "./types";

export const CODEC_INFO: Record<Codec, { label: string; ext: string; mime: string }> = {
  webp: { label: "WebP", ext: "webp", mime: "image/webp" },
  avif: { label: "AVIF", ext: "avif", mime: "image/avif" },
  jpeg: { label: "JPEG", ext: "jpg", mime: "image/jpeg" },
  png: { label: "PNG", ext: "png", mime: "image/png" },
};

/** Umbral de SSIM (luminancia, ventanas 8×8) para cada nivel de calidad automática. */
export const FIDELITY_SSIM: Record<Fidelity, number> = {
  imperceptible: 0.995,
  high: 0.985,
  balanced: 0.97,
};

export const FIDELITY_INFO: Record<Fidelity, { label: string; hint: string }> = {
  imperceptible: { label: "Imperceptible", hint: "Diferencias casi imposibles de ver, incluso con lupa." },
  high: { label: "Alta", hint: "Sin diferencias visibles a tamaño normal. Recomendado para web." },
  balanced: { label: "Equilibrada", hint: "Archivos más ligeros; pequeñas diferencias al hacer zoom." },
};
