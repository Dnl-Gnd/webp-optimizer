export type Codec = "webp" | "avif" | "jpeg" | "png";
export type OutputFormat = Codec | "auto";
export type CompressionMode = "quality" | "target" | "auto";
export type Fidelity = "imperceptible" | "high" | "balanced";

/** Ajustes que afectan la codificación (cambiarlos reprocesa las imágenes). */
export type Settings = {
  format: OutputFormat;
  mode: CompressionMode;
  /** 1-100. Escala unificada; cada códec la traduce a la suya. */
  quality: number;
  /** Peso objetivo en KB (modo "target"). */
  targetKB: number;
  /** Nivel de fidelidad para la calidad automática (modo "auto"). */
  fidelity: Fidelity;
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
  /** Similitud estructural frente al original (0-1), en calidad automática. */
  ssim?: number;
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
      /** SSIM del resultado (solo en calidad automática). */
      ssim?: number;
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
  /** Clave de los ajustes con que se generó (o se está generando) el resultado. */
  settingsKey: string;
  /** Ajustes propios de esta imagen; null = usa los globales. */
  override: Settings | null;
  /** Nombre final escrito a mano (sin extensión); reemplaza las reglas globales. */
  customName: string | null;
  result?: {
    blob: Blob;
    url: string;
    codec: Codec;
    quality: number | null;
    targetMet?: boolean;
    ssim?: number;
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
