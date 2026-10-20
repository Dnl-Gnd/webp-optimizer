/// <reference lib="webworker" />
import encodeWebp from "@jsquash/webp/encode";
import encodeAvif from "@jsquash/avif/encode";
import encodeJpeg from "@jsquash/jpeg/encode";
import optimisePng from "@jsquash/oxipng/optimise";
import type { Candidate, Codec, OptimizeRequest, OptimizeResponse, Settings } from "@/lib/types";
import { CODEC_INFO, FIDELITY_SSIM } from "@/lib/codecs";

declare const self: DedicatedWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Utilidades de imagen
// ---------------------------------------------------------------------------

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

function hasAlpha(img: ImageData) {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
  return false;
}

/** JPEG no soporta transparencia: compone la imagen sobre fondo blanco. */
function flattenOnWhite(img: ImageData): ImageData {
  const out = new ImageData(img.width, img.height);
  const s = img.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3] / 255;
    d[i] = Math.round(s[i] * a + 255 * (1 - a));
    d[i + 1] = Math.round(s[i + 1] * a + 255 * (1 - a));
    d[i + 2] = Math.round(s[i + 2] * a + 255 * (1 - a));
    d[i + 3] = 255;
  }
  return out;
}

/** Decodifica un archivo codificado a ImageData usando el decodificador del navegador. */
async function decode(buffer: ArrayBuffer, mime: string, width: number, height: number): Promise<ImageData | undefined> {
  try {
    const bmp = await createImageBitmap(new Blob([buffer], { type: mime }));
    const c = new OffscreenCanvas(width, height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    return ctx.getImageData(0, 0, width, height);
  } catch {
    // El navegador no sabe decodificar este formato (p. ej. AVIF en navegadores viejos).
    return undefined;
  }
}

/** PSNR (dB) con colores premultiplicados por alfa: los píxeles invisibles no cuentan. */
function psnr(a: ImageData, b: ImageData): number {
  const x = a.data;
  const y = b.data;
  let sum = 0;
  for (let i = 0; i < x.length; i += 4) {
    const xa = x[i + 3] / 255;
    const ya = y[i + 3] / 255;
    for (let k = 0; k < 3; k++) {
      const diff = x[i + k] * xa - y[i + k] * ya;
      sum += diff * diff;
    }
    const da = x[i + 3] - y[i + 3];
    sum += da * da;
  }
  const mse = sum / x.length;
  return mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse);
}

/** Luminancia (BT.601) compuesta sobre blanco, para que la transparencia no confunda la métrica. */
function luma(img: ImageData): Float32Array {
  const d = img.data;
  const out = new Float32Array(img.width * img.height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = d[i + 3] / 255;
    const r = d[i] * a + 255 * (1 - a);
    const g = d[i + 1] * a + 255 * (1 - a);
    const b = d[i + 2] * a + 255 * (1 - a);
    out[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return out;
}

/**
 * SSIM medio sobre ventanas de 8×8 (paso 4) en luminancia.
 * 1 = idéntico. ~0.99 suele ser indistinguible a simple vista.
 */
function ssim(refY: Float32Array, img: ImageData): number {
  const { width: w, height: h } = img;
  const Y = luma(img);
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  const N = 8;
  const STEP = 4;
  let total = 0;
  let count = 0;
  for (let y0 = 0; y0 + N <= h; y0 += STEP) {
    for (let x0 = 0; x0 + N <= w; x0 += STEP) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (let y = y0; y < y0 + N; y++) {
        let p = y * w + x0;
        for (let x = 0; x < N; x++, p++) {
          const a = refY[p];
          const b = Y[p];
          sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
        }
      }
      const n = N * N;
      const ma = sa / n;
      const mb = sb / n;
      const va = saa / n - ma * ma;
      const vb = sbb / n - mb * mb;
      const cov = sab / n - ma * mb;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      count++;
    }
  }
  return count ? total / count : 1;
}

// ---------------------------------------------------------------------------
// Códecs
// ---------------------------------------------------------------------------

/**
 * Codifica con un códec concreto. `quality` está en la escala unificada 1-100
 * de la app; aquí se traduce a la escala de cada códec.
 */
async function encodeWith(codec: Codec, img: ImageData, quality: number, s: Settings): Promise<ArrayBuffer> {
  switch (codec) {
    case "webp":
      return encodeWebp(img, {
        quality,
        lossless: s.lossless ? 1 : 0,
        method: s.effort,
        // Mejora la nitidez de bordes y texto con pérdida.
        use_sharp_yuv: 1,
        // Conserva los colores RGB detrás de píxeles transparentes solo si es lossless.
        exact: s.lossless ? 1 : 0,
      });
    case "avif":
      return encodeAvif(img, {
        // AVIF rinde mucho más por punto de calidad: 80 en la app ≈ 60 en AVIF,
        // lo que da una fidelidad parecida a WebP 80 con bastante menos peso.
        quality: Math.round(quality * 0.75),
        lossless: s.lossless,
        // esfuerzo 0-6 → speed 10-4 (más bajo = más lento y más pequeño)
        speed: 10 - s.effort,
        enableSharpYUV: true,
      });
    case "jpeg":
      return encodeJpeg(img, { quality, progressive: true, optimize_coding: true });
    case "png":
      // oxipng: niveles 0-6; por encima de 3 es muy lento para poca ganancia.
      return optimisePng(img, { level: Math.min(3, Math.ceil(s.effort / 2)), interlace: false });
  }
}

const isLossyCodec = (codec: Codec, s: Settings) => codec === "jpeg" || ((codec === "webp" || codec === "avif") && !s.lossless);

type Encoded = { buffer: ArrayBuffer; quality: number | null; targetMet?: boolean; ssim?: number };

/**
 * AVIF es lento: las búsquedas usan una velocidad mayor y menos iteraciones;
 * al final se recodifica una sola vez con el esfuerzo elegido.
 */
function searchConfig(codec: Codec, s: Settings) {
  return {
    searchSettings: codec === "avif" ? { ...s, effort: Math.max(0, s.effort - 3) } : s,
    maxIter: codec === "avif" ? 5 : 7,
  };
}

/**
 * Peso objetivo: búsqueda binaria de la calidad más alta que cabe en `limitBytes`.
 * `limitBytes` es el menor entre el objetivo del usuario y el peso original:
 * no tiene sentido devolver un archivo más pesado que el que entró.
 * `targetMet` siempre se evalúa contra el objetivo del usuario.
 */
async function encodeToTarget(codec: Codec, img: ImageData, s: Settings, targetBytes: number, limitBytes: number): Promise<Encoded> {
  const { searchSettings, maxIter } = searchConfig(codec, s);
  let lo = 5;
  let hi = 95;
  let best: Encoded | null = null;
  let smallest: Encoded | null = null;

  for (let i = 0; i < maxIter && lo <= hi; i++) {
    const q = Math.round((lo + hi) / 2);
    const buffer = await encodeWith(codec, img, q, searchSettings);
    if (!smallest || buffer.byteLength < smallest.buffer.byteLength) smallest = { buffer, quality: q };
    if (buffer.byteLength <= limitBytes) {
      if (!best || q > (best.quality ?? 0)) best = { buffer, quality: q };
      lo = q + 1;
    } else {
      hi = q - 1;
    }
  }

  if (!best) {
    // Ningún intento cupo: probar la calidad mínima como último recurso.
    const buffer = await encodeWith(codec, img, 5, searchSettings);
    best = smallest && smallest.buffer.byteLength <= buffer.byteLength ? smallest : { buffer, quality: 5 };
  }

  if (searchSettings !== s && best.quality !== null) {
    const final = await encodeWith(codec, img, best.quality, s);
    // Con más esfuerzo casi siempre pesa menos; si no, se queda el de la búsqueda.
    if (final.byteLength <= Math.max(limitBytes, best.buffer.byteLength)) best = { buffer: final, quality: best.quality };
  }

  return { ...best, targetMet: best.buffer.byteLength <= targetBytes };
}

/**
 * Calidad automática: búsqueda binaria de la calidad MÁS BAJA cuyo resultado
 * mantiene un SSIM igual o mayor al umbral de fidelidad elegido.
 */
async function encodeToFidelity(codec: Codec, img: ImageData, s: Settings, refY: Float32Array): Promise<Encoded> {
  const threshold = FIDELITY_SSIM[s.fidelity];
  const { searchSettings, maxIter } = searchConfig(codec, s);
  const { mime } = CODEC_INFO[codec];
  let lo = 5;
  let hi = 100;
  let best: Encoded | null = null;
  let highest: Encoded | null = null;

  for (let i = 0; i < maxIter && lo <= hi; i++) {
    const q = Math.round((lo + hi) / 2);
    const buffer = await encodeWith(codec, img, q, searchSettings);
    const decoded = await decode(buffer, mime, img.width, img.height);
    if (!decoded) {
      // Sin decodificador no se puede medir: usar la calidad manual.
      const fallback = await encodeWith(codec, img, s.quality, s);
      return { buffer: fallback, quality: s.quality };
    }
    const score = ssim(refY, decoded);
    if (!highest || q > (highest.quality ?? 0)) highest = { buffer, quality: q, ssim: score };
    if (score >= threshold) {
      if (!best || q < (best.quality ?? 101)) best = { buffer, quality: q, ssim: score };
      hi = q - 1;
    } else {
      lo = q + 1;
    }
  }

  // Si nunca alcanzó el umbral, la mejor opción es la calidad más alta probada.
  best ??= highest!;

  if (searchSettings !== s && best.quality !== null) {
    const final = await encodeWith(codec, img, best.quality, s);
    const decoded = await decode(final, mime, img.width, img.height);
    const score = decoded ? ssim(refY, decoded) : undefined;
    if (score !== undefined && score >= Math.min(threshold, best.ssim ?? 0)) best = { buffer: final, quality: best.quality, ssim: score };
  }
  return best;
}

async function encodeOne(codec: Codec, img: ImageData, s: Settings, originalBytes: number, refY: () => Float32Array): Promise<Encoded> {
  const targetBytes = s.targetKB * 1024;
  if (isLossyCodec(codec, s)) {
    if (s.mode === "target") return encodeToTarget(codec, img, s, targetBytes, Math.min(targetBytes, originalBytes));
    if (s.mode === "auto") return encodeToFidelity(codec, img, s, refY());
  }
  const buffer = await encodeWith(codec, img, s.quality, s);
  const quality = isLossyCodec(codec, s) ? s.quality : null;
  const targetMet = s.mode === "target" ? buffer.byteLength <= targetBytes : undefined;
  return { buffer, quality, targetMet };
}

// ---------------------------------------------------------------------------
// Entrada del worker
// ---------------------------------------------------------------------------

self.onmessage = async (e: MessageEvent<OptimizeRequest>) => {
  const { id, file, settings } = e.data;
  try {
    const bitmap = await createImageBitmap(file);
    const origWidth = bitmap.width;
    const origHeight = bitmap.height;
    const { width, height } = fitDimensions(origWidth, origHeight, settings.maxWidth || undefined, settings.maxHeight || undefined);

    const imageData = resizeToImageData(bitmap, width, height);
    bitmap.close();
    const alpha = hasAlpha(imageData);

    // Luminancia de referencia, calculada una sola vez y solo si se necesita.
    let refYCache: Float32Array | undefined;
    const refY = () => (refYCache ??= luma(imageData));

    // Qué códecs probar.
    let codecs: Codec[];
    if (settings.format === "auto") {
      codecs = settings.lossless ? ["webp", "png"] : ["webp", "avif", ...(alpha ? [] : (["jpeg"] as Codec[]))];
    } else {
      codecs = [settings.format];
    }

    const results: (Encoded & { codec: Codec; psnr?: number; flattened: boolean })[] = [];
    for (const codec of codecs) {
      const flattened = codec === "jpeg" && alpha;
      const input = flattened ? flattenOnWhite(imageData) : imageData;
      const r = await encodeOne(codec, input, settings, file.size, refY);
      results.push({ ...r, codec, flattened });
    }

    // Elegir el ganador.
    let winner = results[0];
    if (results.length > 1) {
      if (settings.mode === "target") {
        // Entre los que cumplen el peso, el más fiel al original (mayor PSNR).
        for (const r of results) {
          const decoded = await decode(r.buffer, CODEC_INFO[r.codec].mime, width, height);
          r.psnr = decoded ? psnr(imageData, decoded) : undefined;
        }
        const met = results.filter((r) => r.targetMet);
        winner = met.length
          ? met.reduce((a, b) => ((b.psnr ?? -1) > (a.psnr ?? -1) ? b : a))
          : results.reduce((a, b) => (b.buffer.byteLength < a.buffer.byteLength ? b : a));
      } else {
        // Calidad manual o automática: todos tienen la fidelidad pedida, gana el más ligero.
        winner = results.reduce((a, b) => (b.buffer.byteLength < a.buffer.byteLength ? b : a));
      }
    }

    const candidates: Candidate[] = results.map((r) => ({
      codec: r.codec,
      size: r.buffer.byteLength,
      quality: r.quality,
      psnr: r.psnr,
      ssim: r.ssim,
      targetMet: r.targetMet,
    }));

    const res: OptimizeResponse = {
      id,
      ok: true,
      buffer: winner.buffer,
      codec: winner.codec,
      quality: winner.quality,
      targetMet: winner.targetMet,
      ssim: winner.ssim,
      candidates,
      flattened: winner.flattened,
      width,
      height,
      origWidth,
      origHeight,
    };
    self.postMessage(res, [winner.buffer]);
  } catch (err) {
    const res: OptimizeResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(res);
  }
};
