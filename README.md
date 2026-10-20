# Optimizador de imágenes

Aplicación web para convertir imágenes (PNG, JPG, GIF, BMP, AVIF, WebP) a **WebP, AVIF, JPEG o PNG optimizado** y reducir su peso sin perder calidad visible. Todo el procesamiento ocurre **en el navegador**: las imágenes nunca se suben a un servidor.

## Funciones

- **Formatos de salida:** WebP, AVIF, JPEG (MozJPEG) y PNG (OxiPNG, sin pérdida).
- **Auto:** prueba WebP, AVIF y JPEG (o WebP y PNG en modo sin pérdida) y se queda con el mejor para cada imagen.
- **Calidad** (1–100) con presets, o **peso objetivo** en KB: busca la calidad más alta que cabe en ese peso (búsqueda binaria). En Auto + peso objetivo gana el formato más fiel al original (PSNR) entre los que cumplen.
- **Calidad automática:** busca la calidad más baja que se sigue viendo igual al original, medido con SSIM. Tres niveles: Imperceptible (≥0.995), Alta (≥0.985) y Equilibrada (≥0.97).
- **Ajustes por imagen:** cualquier imagen puede tener su propio formato, modo, calidad, redimensión y esfuerzo; las demás siguen los globales.
- **Modo sin pérdida** para WebP (ideal para logos, íconos y capturas).
- **Redimensionar** por ancho/alto máximo (mantiene proporción, nunca agranda).
- **Esfuerzo de compresión** (0–6).
- **Entrada flexible:** arrastrar archivos o carpetas completas, elegir una carpeta, o pegar con Ctrl+V.
- **Nombres de salida:** prefijo, sufijo, formato slug, ancho final (`-1280w`) y estructura de carpetas dentro del ZIP. Cada imagen se puede renombrar a mano (ese nombre es final y no recibe las reglas globales).
- **Descarga individual o en ZIP.**
- **Comparador:** deslizador antes/después, lupa de 2×/4×/8× que muestra la misma zona en ambas imágenes, mapa de diferencias (mapa de calor) con porcentaje de píxeles afectados, y vista 1:1.
- Cambiar ajustes cancela el trabajo en curso y reprocesa solo las imágenes afectadas.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- [jSquash](https://github.com/jamsinclair/jSquash) (`@jsquash/webp`, `avif`, `jpeg`, `oxipng`): los códecs de Squoosh compilados a WebAssembly. Resultados consistentes en todos los navegadores, incluido Safari. Las variantes multihilo se reemplazan por las de un hilo en `next.config.ts` (requieren cross-origin isolation y rompían el build).
- [`fflate`](https://github.com/101arrowz/fflate) para generar el ZIP.

## Cómo funciona

1. `createImageBitmap` decodifica la imagen dentro de un Web Worker.
2. Si hay redimensión, se reduce en pasos de 50% sobre `OffscreenCanvas` (evita el aliasing de una reducción grande en un solo paso).
3. Se codifica con el/los códecs elegidos. En peso objetivo se hace búsqueda binaria de calidad (AVIF busca a mayor velocidad y recodifica una vez al final).
4. En calidad automática se decodifica cada intento y se calcula el SSIM de luminancia (ventanas 8×8) contra el original; la búsqueda binaria encuentra la calidad más baja que supera el umbral.
5. En Auto se elige el más ligero (modo calidad) o el de mayor PSNR que cumple el peso (modo objetivo).
6. Cada imagen guarda la clave de los ajustes con que se procesó; al cambiar ajustes (globales o propios) solo se reprocesan las que no coinciden, y se descartan resultados obsoletos.

```
src/
├── app/                 # layout, página y estilos globales
├── components/
│   ├── Optimizer.tsx     # estado principal, cola, ZIP, modal de comparación
│   ├── SettingsPanel.tsx  # formato, compresión, tamaño, esfuerzo
│   ├── NamingPanel.tsx    # prefijo, sufijo, slug, carpetas
│   ├── ImageCard.tsx
│   ├── CompareSlider.tsx  # deslizador, lupa y mapa de diferencias
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
