export type Codec = "webp" | "avif" | "jpeg" | "png";
export type OutputFormat = Codec | "auto";
export type CompressionMode = "quality" | "target";

/** Ajustes que afectan la codificación (cambiarlos reprocesa las imágenes). */
export type Settings = {
  format: OutputFormat;
  mode: CompressionMode;
  /** 1-100. Escala unificada; cada códec la traduce a la suya. */
  quality: number;
  /** Peso objetivo en KB (modo "target"). */
  targetKB: number;
  /** 0 = sin límite */
  maxWidth: number;
  /** 0 = sin límite */
  maxHeight: number;
  lossless: boolean;
  /** 0 (rápido) - 6 (más lento, archivo más pequeño) */
  effort: number;
};

/** Ajustes de nombres de archivo (no reprocesan, solo cambian la descarga). */
export type Naming = {
  slug: boolean;
  prefix: string;
  suffix: string;
  /** Añade el ancho final, p. ej. "-1280w". */
  addWidth: boolean;
  /** Conserva la estructura de carpetas dentro del ZIP. */
  keepFolders: boolean;
};

export type OptimizeRequest = {
  id: string;
  file: Blob;
  settings: Settings;
};

export type Candidate = {
  codec: Codec;
  size: number;
  quality: number | null;
  /** Relación señal/ruido frente al original (dB). Más alto = más fiel. */
  psnr?: number;
  targetMet?: boolean;
};

export type OptimizeResponse =
  | {
      id: string;
      ok: true;
      buffer: ArrayBuffer;
      codec: Codec;
      /** Calidad usada (null en formatos sin pérdida). */
      quality: number | null;
      /** Solo en modo tamaño objetivo. */
      targetMet?: boolean;
      /** Todos los formatos probados (modo auto). */
      candidates: Candidate[];
      /** La imagen tenía transparencia y se aplanó sobre blanco (JPEG). */
      flattened: boolean;
      width: number;
      height: number;
      origWidth: number;
      origHeight: number;
    }
  | { id: string; ok: false; error: string; cancelled?: boolean };

export type ItemStatus = "processing" | "done" | "error";

export type ImageItem = {
  id: string;
  file: File;
  /** Carpeta de origen relativa (al arrastrar carpetas), sin barra final. "" si no aplica. */
  folder: string;
  originalUrl: string;
  status: ItemStatus;
  /** Versión de ajustes con la que se generó el resultado actual. */
  version: number;
  result?: {
    blob: Blob;
    url: string;
    codec: Codec;
    quality: number | null;
    targetMet?: boolean;
    candidates: Candidate[];
    flattened: boolean;
    width: number;
    height: number;
    origWidth: number;
    origHeight: number;
  };
  error?: string;
};

export type IncomingFile = { file: File; folder: string };
