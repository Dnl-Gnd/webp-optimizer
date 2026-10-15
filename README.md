# Optimizador WebP

Aplicación web para convertir imágenes (PNG, JPG, GIF, BMP, AVIF, WebP) a **WebP** y reducir su peso sin perder calidad visible. Todo el procesamiento ocurre **en el navegador**: las imágenes nunca se suben a un servidor.

## Funciones

- **Slider de calidad** (1–100) con presets: Máxima calidad (92), Equilibrado (80), Más ligero (65).
- **Modo sin pérdida**, ideal para logos, íconos y capturas de pantalla.
- **Redimensionar** por ancho/alto máximo (mantiene proporción, nunca agranda), con presets 2560/1920/1280/800 px.
- **Esfuerzo de compresión** (0–6) de libwebp.
- **Varias imágenes a la vez**, procesadas en paralelo con un pool de Web Workers.
- **Descarga individual o en ZIP**.
- **Comparador antes/después** con deslizador y vista 1:1.
- Aviso cuando el WebP resultante pesa más que el original.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- [`@jsquash/webp`](https://github.com/jamsinclair/jSquash): libwebp compilado a WebAssembly (mismo codificador que Squoosh). Da resultados consistentes en todos los navegadores, incluido Safari, que no soporta exportar WebP desde `<canvas>`.
- [`fflate`](https://github.com/101arrowz/fflate) para generar el ZIP.

## Cómo funciona

1. `createImageBitmap` decodifica la imagen dentro de un Web Worker.
2. Si hay redimensión, se reduce en pasos de 50% sobre `OffscreenCanvas` (evita el aliasing de una reducción grande en un solo paso).
3. `@jsquash/webp` codifica el `ImageData` a WebP con `use_sharp_yuv` para mantener bordes y texto nítidos.
4. Al cambiar ajustes, las imágenes se reprocesan (con debounce) y se descartan resultados obsoletos.

```
src/
├── app/                 # layout, página y estilos globales
├── components/
│   ├── Optimizer.tsx     # estado principal, cola, ZIP, modal de comparación
│   ├── SettingsPanel.tsx
│   ├── ImageCard.tsx
│   ├── CompareSlider.tsx
│   └── Dropzone.tsx
├── lib/
│   ├── pool.ts           # pool de Web Workers
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
