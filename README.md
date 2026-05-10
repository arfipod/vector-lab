# Vector Lab Studio

A React + TypeScript + Vite application for SVG editing and bitmap vectorization. The UI, code, presets, console, and scripting language are in English.

## What it does

- Edits existing SVG files with live HSL/HSV color transforms.
- Scales and offsets real SVG stroke widths.
- Detects SVG palettes and lets you enable, disable, or replace individual colors.
- Vectorizes PNG/JPG/WebP/BMP/GIF/SVG/PDF sources into editable SVG paths.
- Removes scanned paper/backgrounds with edge-connected masking.
- Builds layered color + lineart SVGs for watercolor and ink artwork.
- Provides separate color and lineart blur, trace, stroke, and underpaint controls.
- Guards lineart extraction by chroma so dark saturated watercolor is not mistaken for ink.
- Supports live vectorization preview with a debounce.
- Includes a Node quality script that rasterizes SVG outputs and compares them against source scans.
- Includes preview zoom, fit, 100%, reset, keyboard, wheel, and pan navigation.
- Includes a persistent console, copyable logs/scripts, syntax-highlighted scripts, and progress feedback.
- Exports SVG and PNG.

## Vectorization Algorithms

The vectorization engine is implemented in `src/lib/vectorize.ts` and is designed for scanned illustrations, watercolor artwork, line drawings, and mixed lineart + color artwork.

### Background Removal

The default background remover is `edge-connected` paper masking:

1. Estimate the paper color from image borders and corners.
2. Compare pixels in OKLab color space using perceptual distance.
3. Build a candidate paper mask using lightness and color similarity.
4. Flood-fill only the candidate mask connected to the image edges.
5. Keep light internal artwork, such as white petals, if it is not connected to the outer paper region.

Available background modes:

- `edge-connected`: recommended for scanned paper and watercolor images.
- `global-light`: removes all sufficiently light paper-like pixels globally.
- `none`: disables background removal except transparent pixels.

### Modes And Layers

- `color`: quantizes the retained foreground into flat color paths.
- `binary`: traces a thresholded lineart mask.
- `layered`: creates a `color-layer` group under a `lineart-layer` group.

Layered mode is usually better for watercolor plus ink because soft washes and dark outlines need different preprocessing. The color layer uses `color.*` settings for quantization and filled shapes. The lineart layer uses `line.*` aliases for thresholded ink paths.

### Layer-Specific Watercolor Controls

Use `vector.blur` as a shared starting blur, then override with `color.blur` and `line.blur` when needed. A higher color blur can merge paper texture and wash grain before color tracing. A lower line blur preserves fine ink.

Use `color.trace.*` and `line.trace.*` independently:

- `minArea` removes tiny traced islands.
- `simplify` controls how aggressively paths are straightened.
- `smooth` rounds traced contours into cubic curves.
- `precision` controls SVG path coordinate decimals.

`color.lineartDarkness` controls which dark pixels are treated as lineart when building the layered masks. Raising it can catch more ink, but too much can turn shadows or saturated paint into black blobs. If the ink looks weak, prefer increasing `line.strokeWidth`; it thickens the rendered lineart without reclassifying more pixels as ink.

`line.maxChroma` is an ink guard. Lower values keep neutral black/gray ink while rejecting saturated watercolor pixels, which is especially important in red and brown leaves or flowers. Use `255` to disable the guard.

`color.underpaintStrokeWidth` adds a same-color stroke around color fills. Small values help neighboring color shapes overlap slightly, which can hide white gaps from traced seams. Keeping `color.excludeLineart = false` can also let color sit underneath ink instead of leaving cutouts.

### Contour Extraction

The tracer builds SVG paths from binary masks using connected mask boundaries, polygon extraction, Ramer-Douglas-Peucker simplification, optional cubic smoothing, and SVG `fill-rule="evenodd"` groups.

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
- `watercolor-detail`
- `svg-light`
- `lineart-clean`
- `lineart-detail`

### Watercolor Pattern Maximum-Detail Script

```txt
preset watercolor-detail

set vector.mode = layered
set vector.maxSide = 2800
set vector.blur = 0.25

set bg.method = edge-connected
set bg.tolerance = 14
set bg.minLightness = 76

set color.quantizer = oklab-kmeans
set color.colors = 64
set color.iterations = 44
set color.samples = 360000
set color.minClusterPixels = 3
set color.excludeLineart = false
set color.lineartDarkness = 145

set color.blur = 0.55
set line.blur = 0.12
set line.maxChroma = 58

set color.underpaintStrokeWidth = 0.55
set line.strokeWidth = 0.55

set color.trace.minArea = 3
set color.trace.simplify = 0.38
set color.trace.smooth = 56
set color.trace.precision = 2

set line.trace.minArea = 3
set line.trace.simplify = 0.24
set line.trace.smooth = 18
set line.trace.precision = 2

set output.openInEditor = false
run vectorize
```

### Line-Art Maximum-Detail Script

```txt
preset lineart-detail

set vector.mode = binary
set vector.maxSide = 2800

set bg.method = edge-connected
set bg.tolerance = 8
set bg.minLightness = 84

set line.mode = manual
set line.threshold = 190
set line.maxChroma = 80
set line.blur = 0.05
set line.strokeWidth = 0.25

set line.trace.minArea = 4
set line.trace.simplify = 0.24
set line.trace.smooth = 12
set line.trace.precision = 2

set output.openInEditor = false
run vectorize
```

Useful aliases include:

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
set color.minClusterPixels = 8
set color.excludeLineart = true
set color.lineartDarkness = 150
set color.blur = 0.3
set color.underpaintStrokeWidth = 0
set line.mode = manual
set line.threshold = 148
set line.blur = 0.3
set line.maxChroma = 255
set line.strokeWidth = 0
set trace.simplify = 0.65
set color.trace.simplify = 0.65
set line.trace.simplify = 0.45
set output.openInEditor = false
set editor.hue = 20
set editor.saturation = 15
run vectorize
run send-to-editor
run export-svg
run export-png
```

## Preview Navigation

- Use `-` and `+` to zoom out or in.
- Use `Fit` to fit the current image or SVG in the preview viewport.
- Use `100%` to view at actual SVG/image pixel size.
- Use `Reset` to return to fit zoom and recenter the preview.
- Focus the preview viewport, then use `+`/`=` and `-` for zoom, `0` for fit, `1` for 100%, and arrow keys to pan.
- Use Ctrl+wheel or Cmd+wheel to zoom around the pointer. Normal wheel or trackpad scrolling pans the viewport.
- Hold Space while the preview is hovered or focused, then drag with the primary pointer button to pan.

## Console And Scripts

- `Copy log` copies the current console log text.
- `Copy script` copies the script editor contents.
- `Clear console` clears the visible log stream and records a fresh cleared message.
- Logs and the script editor scroll independently.
- The script editor highlights commands, paths, values, booleans, comments, and invalid line shapes.
- Auto-scroll can keep the log stream pinned to new messages while leaving the script editor untouched.

## Progress Bar

A fixed top progress bar appears during image loading, vectorization, live preview updates, and PNG export. Determinate operations show a percent and current step detail. Steps that cannot estimate exact completion use an indeterminate sweep. The bar clears when the operation finishes or fails.

## Troubleshooting Watercolor

- Black blobs: lower `color.lineartDarkness` or lower `line.maxChroma`.
- Weak ink: increase `line.strokeWidth`, raise `color.lineartDarkness`, or raise `line.maxChroma` if colored washes are clipping ink.
- White gaps: increase `color.underpaintStrokeWidth` and keep `color.excludeLineart = false`.
- Jagged or straight color areas: lower `color.trace.simplify`, raise `color.trace.smooth`, or increase `color.blur`.
- Lost fine ink detail: lower `line.blur` and lower `line.trace.simplify`.

## Slider Manual Input

Every slider value pill is clickable. Click the value, type the exact numeric value, and press Enter or leave the field to commit.

## Local Development

```bash
npm install
npm run dev
```

## Type-Check And Production Build

```bash
npm run typecheck
npm run build
```

The generated production output is in `dist/`.

## Vectorization Quality Script

Use the quality script to compare presets against local source scans. It writes SVGs, transparent PNGs, white-background preview PNGs, and `metrics.json`.

```bash
npm run quality -- --watercolor path/to/watercolor.png --lineart path/to/lineart.bmp --out .vector-quality
```

The script runs `watercolor-maximum`, `watercolor-detail`, `lineart-clean`, and `lineart-detail`, then reports retained foreground, background leak, color error, dark-line recall, and dark-line precision.

## Deploy To Vercel

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
