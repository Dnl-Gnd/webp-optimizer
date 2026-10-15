export type Settings = {
  /** 0-100. Ignorado (pero usado como esfuerzo de compresión) en modo sin pérdida. */
  quality: number;
  /** 0 = sin límite */
  maxWidth: number;
  /** 0 = sin límite */
  maxHeight: number;
  lossless: boolean;
  /** 0 (rápido) - 6 (más lento, archivo más pequeño) */
  effort: number;
};

export type OptimizeRequest = {
  id: string;
  file: Blob;
  settings: Settings;
};

export type OptimizeResponse =
  | {
      id: string;
      ok: true;
      buffer: ArrayBuffer;
      width: number;
      height: number;
      origWidth: number;
      origHeight: number;
    }
  | { id: string; ok: false; error: string };

export type ItemStatus = "queued" | "processing" | "done" | "error";

export type ImageItem = {
  id: string;
  file: File;
  originalUrl: string;
  status: ItemStatus;
  /** Versión de ajustes con la que se generó el resultado actual. */
  version: number;
  result?: {
    blob: Blob;
    url: string;
    width: number;
    height: number;
    origWidth: number;
    origHeight: number;
  };
  error?: string;
};
