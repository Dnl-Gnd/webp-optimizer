import type { ImageItem, Naming } from "./types";
import { CODEC_INFO } from "./codecs";

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function savingPercent(original: number, optimized: number) {
  if (!original) return 0;
  return Math.round((1 - optimized / original) * 100);
}

/** "Foto Héroe (Final)!" → "foto-heroe-final" */
export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Limpia caracteres no válidos en nombres de archivo de Windows/macOS. */
function safe(text: string) {
  return text.replace(/[\\/:*?"<>|]+/g, "-");
}

export const DEFAULT_NAMING: Naming = {
  slug: false,
  prefix: "",
  suffix: "",
  addWidth: false,
  keepFolders: true,
};

/**
 * Construye el nombre de salida. Con `withFolder` incluye la carpeta de origen
 * (para el ZIP cuando se arrastró una carpeta).
 */
export function buildOutputName(
  original: string,
  ext: string,
  naming: Naming,
  opts: { width?: number; folder?: string; withFolder?: boolean } = {},
) {
  let base = original.replace(/\.[^.]+$/, "");
  if (naming.slug) base = slugify(base) || "imagen";
  let name = `${naming.prefix}${base}${naming.suffix}`;
  if (naming.addWidth && opts.width) name += `-${opts.width}w`;
  if (naming.slug) name = slugify(name) || "imagen";
  name = `${safe(name)}.${ext}`;

  if (opts.withFolder && naming.keepFolders && opts.folder) {
    const folder = opts.folder
      .split("/")
      .filter(Boolean)
      .map((p) => (naming.slug ? slugify(p) || "carpeta" : safe(p)))
      .join("/");
    return `${folder}/${name}`;
  }
  return name;
}

export function outputNameFor(item: ImageItem, naming: Naming, withFolder = false) {
  const ext = item.result ? CODEC_INFO[item.result.codec].ext : "webp";
  return buildOutputName(item.file.name, ext, naming, {
    width: item.result?.width,
    folder: item.folder,
    withFolder,
  });
}
