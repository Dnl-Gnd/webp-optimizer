# Optimizador de imágenes

Aplicación web para convertir imágenes (PNG, JPG, GIF, BMP, AVIF, WebP) a **WebP, AVIF, JPEG o PNG optimizado** y reducir su peso sin perder calidad visible. Todo el procesamiento ocurre **en el navegador**: las imágenes nunca se suben a un servidor.

## Funciones

- **Formatos de salida:** WebP, AVIF, JPEG (MozJPEG) y PNG (OxiPNG, sin pérdida).
- **Auto:** prueba WebP, AVIF y JPEG (o WebP y PNG en modo sin pérdida) y se queda con el mejor para cada imagen.
- **Calidad** (1–100) con presets, o **peso objetivo** en KB: busca la calidad más alta que cabe en ese peso (búsqueda binaria). En Auto + peso objetivo gana el formato más fiel al original (PSNR) entre los que cumplen.
- **Modo sin pérdida** para WebP (ideal para logos, íconos y capturas).
- **Redimensionar** por ancho/alto máximo (mantiene proporción, nunca agranda).
- **Esfuerzo de compresión** (0–6).
- **Entrada flexible:** arrastrar archivos o carpetas completas, elegir una carpeta, o pegar con Ctrl+V.
- **Nombres de salida:** prefijo, sufijo, formato slug, ancho final (`-1280w`) y estructura de carpetas dentro del ZIP.
- **Descarga individual o en ZIP**, y **comparador antes/después** con deslizador y vista 1:1.
- Cambiar ajustes cancela el trabajo en curso y reprocesa todo.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- [jSquash](https://github.com/jamsinclair/jSquash) (`@jsquash/webp`, `avif`, `jpeg`, `oxipng`): los códecs de Squoosh compilados a WebAssembly. Resultados consistentes en todos los navegadores, incluido Safari. Las variantes multihilo se reemplazan por las de un hilo en `next.config.ts` (requieren cross-origin isolation y rompían el build).
- [`fflate`](https://github.com/101arrowz/fflate) para generar el ZIP.

## Cómo funciona

1. `createImageBitmap` decodifica la imagen dentro de un Web Worker.
2. Si hay redimensión, se reduce en pasos de 50% sobre `OffscreenCanvas` (evita el aliasing de una reducción grande en un solo paso).
3. Se codifica con el/los códecs elegidos. En peso objetivo se hace búsqueda binaria de calidad (AVIF busca a mayor velocidad y recodifica una vez al final).
4. En Auto se elige el más ligero (modo calidad) o el de mayor PSNR que cumple el peso (modo objetivo).
5. Al cambiar ajustes, las imágenes se reprocesan (con debounce) y se descartan resultados obsoletos.

```
src/
├── app/                 # layout, página y estilos globales
├── components/
│   ├── Optimizer.tsx     # estado principal, cola, ZIP, modal de comparación
│   ├── SettingsPanel.tsx  # formato, compresión, tamaño, esfuerzo
│   ├── NamingPanel.tsx    # prefijo, sufijo, slug, carpetas
│   ├── ImageCard.tsx
│   ├── CompareSlider.tsx
│   └── Dropzone.tsx
├── lib/
│   ├── pool.ts           # pool de Web Workers con cancelación
│   ├── files.ts          # carpetas, portapapeles
│   ├── codecs.ts
│   ├── format.ts
│   └── types.ts
└── workers/
    └── optimize.worker.ts
```

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de producción
```

Se despliega en Vercel sin configuración adicional (es un sitio estático).
