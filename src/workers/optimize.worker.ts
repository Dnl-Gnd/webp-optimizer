/// <reference lib="webworker" />
import encode from "@jsquash/webp/encode";
import type { OptimizeRequest, OptimizeResponse } from "@/lib/types";

declare const self: DedicatedWorkerGlobalScope;

/** Calcula las dimensiones finales respetando la proporción y sin agrandar. */
function fitDimensions(w: number, h: number, maxW?: number, maxH?: number) {
  let scale = 1;
  if (maxW && w > maxW) scale = Math.min(scale, maxW / w);
  if (maxH && h > maxH) scale = Math.min(scale, maxH / h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/**
 * Redimensiona en pasos de 50% para reducciones grandes: evita el aliasing
 * que produce un único drawImage cuando la imagen se reduce mucho.
 */
function resizeToImageData(bitmap: ImageBitmap, width: number, height: number): ImageData {
  let source: ImageBitmap | OffscreenCanvas = bitmap;
  let curW = bitmap.width;
  let curH = bitmap.height;

  while (curW / 2 >= width && curH / 2 >= height) {
    const nextW = Math.round(curW / 2);
    const nextH = Math.round(curH / 2);
    const step = new OffscreenCanvas(nextW, nextH);
    const sctx = step.getContext("2d")!;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(source, 0, 0, nextW, nextH);
    source = step;
    curW = nextW;
    curH = nextH;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

self.onmessage = async (e: MessageEvent<OptimizeRequest>) => {
  const { id, file, settings } = e.data;
  try {
    const bitmap = await createImageBitmap(file);
    const origWidth = bitmap.width;
    const origHeight = bitmap.height;
    const { width, height } = fitDimensions(
      origWidth,
      origHeight,
      settings.maxWidth || undefined,
      settings.maxHeight || undefined,
    );

    const imageData = resizeToImageData(bitmap, width, height);
    bitmap.close();

    const buffer = await encode(imageData, {
      quality: settings.quality,
      lossless: settings.lossless ? 1 : 0,
      method: settings.effort,
      // Mejora la nitidez de bordes y texto con pérdida.
      use_sharp_yuv: 1,
      // Conserva los colores RGB detrás de píxeles transparentes solo si es lossless.
      exact: settings.lossless ? 1 : 0,
    });

    const res: OptimizeResponse = {
      id,
      ok: true,
      buffer,
      width,
      height,
      origWidth,
      origHeight,
    };
    self.postMessage(res, [buffer]);
  } catch (err) {
    const res: OptimizeResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(res);
  }
};
