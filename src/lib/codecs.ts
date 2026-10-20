import type { Codec } from "./types";

export const CODEC_INFO: Record<Codec, { label: string; ext: string; mime: string }> = {
  webp: { label: "WebP", ext: "webp", mime: "image/webp" },
  avif: { label: "AVIF", ext: "avif", mime: "image/avif" },
  jpeg: { label: "JPEG", ext: "jpg", mime: "image/jpeg" },
  png: { label: "PNG", ext: "png", mime: "image/png" },
};
