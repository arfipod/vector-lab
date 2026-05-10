# Vector Lab Studio

A React + TypeScript + Vite application for SVG editing and bitmap vectorization. The UI, code, presets, console, and scripting language are in English.

## What it does

- Edits existing SVG files with live HSL/HSV color transforms.
- Scales and offsets real SVG stroke widths.
- Detects SVG palettes and lets you enable, disable, or replace individual colors.
- Vectorizes PNG/JPG/WebP/BMP/GIF/SVG/PDF sources into editable SVG paths.
- Lets vectorization stay in the Vectorization tab instead of automatically opening the Editing tab.
- Supports live vectorization preview with a debounce.
- Includes a persistent console for debug/info/warning/error logs.
- Includes a small scripting language for reproducible parameter changes and actions.
- Exports SVG and PNG.

## Vectorization algorithms

The vectorization engine is implemented in `src/lib/vectorize.ts` and is designed for scanned illustrations, watercolor artwork, line drawings, and mixed lineart + color artwork.

### Background removal

The default background remover is **edge-connected paper masking**:

1. Estimate the paper color from image borders and corners.
2. Compare pixels in OKLab color space using perceptual distance.
3. Build a candidate paper mask using lightness and color similarity.
4. Flood-fill only the candidate mask connected to the image edges.
5. Keep light internal artwork, such as white petals, if it is not connected to the outer paper region.

This is much safer for scanned drawings than a simple global white threshold.

Available background modes:

- `edge-connected`: recommended for scanned paper and watercolor images.
- `global-light`: removes all sufficiently light paper-like pixels globally.
- `none`: disables background removal except transparent pixels.

### Binary / lineart tracing

Available thresholding methods:

- `manual`: explicit grayscale threshold.
- `otsu`: automatic global Otsu threshold.
- `sauvola`: adaptive local threshold for uneven lighting or paper shadows.

### Color vectorization

Available quantizers:

- `oklab-kmeans`: perceptual k-means++ clustering in OKLab.
- `rgb-median-cut`: faster median-cut color quantization.

### Layered vectorization

The default mode is `layered`, which creates:

```xml
<g id="color-layer">...</g>
<g id="lineart-layer">...</g>
```

This is usually better for hand-drawn watercolor/ink images than a single flat color pass, because lineart and soft color washes behave differently.

### Contour extraction

The tracer builds SVG paths from binary masks using:

- connected mask boundaries,
- polygon extraction,
- Ramer-Douglas-Peucker simplification,
- optional cubic smoothing,
- SVG `fill-rule="evenodd"` groups.

## Scripting

Open the console and run commands such as:

```txt
preset watercolor-balanced
set vector.mode = layered
set bg.method = edge-connected
set bg.tolerance = 10
set color.colors = 24
set trace.simplify = 0.65
set output.openInEditor = false
run vectorize
```

Built-in presets:

- `watercolor-balanced`
- `watercolor-maximum`
- `svg-light`
- `lineart-clean`

Useful aliases:

```txt
set vector.mode = layered
set vector.maxSide = 1500
set vector.blur = 0.3
set bg.method = edge-connected
set bg.tolerance = 10
set bg.minLightness = 72
set color.quantizer = oklab-kmeans
set color.colors = 24
set color.iterations = 20
set color.samples = 140000
set color.excludeLineart = true
set line.mode = manual
set line.threshold = 148
set trace.minArea = 5
set trace.simplify = 0.65
set trace.smooth = 6
set output.openInEditor = false
set editor.hue = 20
set editor.saturation = 15
run vectorize
run send-to-editor
run export-svg
run export-png
```

## Slider manual input

Every slider value pill is clickable. Click the value, type the exact numeric value, and press Enter or leave the field to commit.

## Local development

```bash
npm install
npm run dev
```

## Type-check and production build

```bash
npm run typecheck
npm run build
```

The generated production output is in `dist/`.

## Deploy to Vercel

Push this project to GitHub and import it into Vercel as a Vite project. The included `vercel.json` contains an SPA rewrite to `/index.html`.

Recommended Vercel settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

## Notes

- PDF import uses `pdfjs-dist` and rasterizes pages before vectorization.
- Large images and high color counts can produce large SVG files. Use the `svg-light` preset when file size matters.
- The app runs client-side; no server API is required.
