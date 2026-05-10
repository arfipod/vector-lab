# Vector Lab Studio Option Reference

This reference mirrors the in-app Help guide. Defaults come from `src/defaults.ts`; option names and valid values come from `src/App.tsx`, `src/components/FilterLibrary.tsx`, and `src/types.ts`.

## Editing

| Option | Default | Valid values | What it does | Recommended values and tradeoffs |
| --- | --- | --- | --- | --- |
| Load vector | No file loaded | SVG/PDF accepted by the Editing drop zone | SVG files stay editable. PDF/raster files are rasterized and wrapped as SVG images. | Use SVG for real editable paths. Use Vectorization first when a raster/PDF needs editable paths. Wrapped images do not expose palette or stroke data. |
| Stroke scale | `1` | `0` to `8` | Multiplies editable SVG stroke widths. | `1` keeps strokes unchanged. `0` removes strokes. Small changes such as `0.8` to `1.4` are safest; large values can cover fills or close holes. |
| Stroke offset | `0px` | `-12px` to `24px` | Adds a fixed pixel amount after stroke scaling. | Use small positive values for stronger lineart and small negative values for lighter strokes. Negative offsets can remove thin strokes. |
| Color model | `HSL` | `HSL`, `HSV` | Chooses whether brightness edits use HSL lightness or HSV value. | HSL is natural for illustration lightening/darkening. HSV behaves more like a color picker. Switching models changes the feel of brightness edits. |
| Protect whites | On | On/off | Skips white and near-white colors during global color edits. | Keep on for paper, highlights, and white art that should stay white. |
| Protect blacks | Off | On/off | Skips black and near-black colors during global color edits. | Turn on when ink or lettering must stay neutral black. Leave off if black lineart should receive color shifts. |
| Protect grays | On | On/off | Skips low-saturation gray colors during global color edits. | Keep on for pencil, neutral shadows, and scanned gray detail. |
| Hue | `0deg` | `-180deg` to `180deg` | Rotates editable colors around the color wheel. | Use `-20deg` to `20deg` for subtle shifts and larger values for palette changes. Protected colors are skipped. |
| Saturation | `0%` | `-100%` to `200%` | Adds or removes color intensity. | `-100%` makes grayscale. Small positive values revive scans. Very high values exaggerate artifacts. |
| Lightness | `0%` | `-100%` to `100%` | HSL-only brightness control. | Small positive values brighten scans; negative values add weight. Extremes flatten detail into white or black. |
| Value | `0%` | `-100%` to `100%` | HSV-only brightness control. | Useful for saturated colors and color-picker-like brightness edits. Extremes clip highlights or shadows. |
| Opacity | `1` | `0` to `1` | Multiplies editable fill/stroke opacity. | `1` is unchanged, `0.5` is half opacity, `0` hides editable colors. Lower opacity can reveal overlaps. |
| Palette enable/disable | Enabled for every detected color | Per-color on/off | Decides whether each detected SVG color can be edited or replaced. | Disable colors that must remain untouched. Palette rows only appear for parsed SVG colors, not wrapped raster images. |
| Palette replacement color | Original detected color | Browser color picker hex | Replaces one exact detected SVG color with another. | Best for precise spot-color swaps. Gradients, images, and unparsed colors may not change. |
| Export SVG | Disabled until SVG exists | Button action | Downloads the current edited SVG. | Use for scalable/editable output. Wrapped raster/PDF sources may still export as embedded images. |
| Export PNG | Disabled until SVG exists | Button action | Rasterizes the edited SVG and downloads a 2x PNG. | Use for previews or bitmap upload targets. PNG is no longer path-editable. |

## Vectorization

### Filter Library

| Option | Default | Valid values | What it does | Recommended values and tradeoffs |
| --- | --- | --- | --- | --- |
| Search filters | Empty search | Any search text | Filters built-in and custom presets by id, name, description, recommended use, mode, categories, and tags. | Search task words such as `watercolor`, `lineart`, `lightweight`, `detail`, or mode names. Search only changes the list, not active settings. |
| Filter category | `All` | All plus filter categories | Narrows the Filter Library list by category. | Category chips combine with search text, so clear one if no filters appear. |
| Apply filter | Available for each visible filter | Button action | Merges a preset or custom filter into the current vectorization controls. | Use as a starting point, then tune controls. Applying overwrites current vectorization settings. |
| Save current settings as filter | Save form closed | Name up to 80 characters; description up to 240 characters | Stores current VectorOptions as a browser-local custom filter. | Save settings for repeated source types. Custom filters stay in localStorage unless exported. |
| Export custom filters | Disabled until custom filters exist | Button action | Downloads custom filters as versioned JSON. | Export before switching browsers or sharing a tuned setup. Built-in filters are not included. |
| Import JSON | No import selected | Valid custom filter JSON | Imports and validates custom filters from JSON. | Use exports from the same app version when possible. Duplicate ids are reassigned. |
| Rename custom filter | Custom filters only | Name up to 80 characters; description up to 240 characters | Updates custom filter name/description without changing saved settings. | Use descriptive names based on project or source type. |
| Delete custom filter | Custom filters only | Button action | Removes a custom filter from localStorage after confirmation. | Export first if you may need it later; deletion cannot be undone without a JSON copy. |

### Load And Method

| Option | Default | Valid values | What it does | Recommended values and tradeoffs |
| --- | --- | --- | --- | --- |
| Load bitmap | No source loaded | PNG, JPG, JPEG, WebP, BMP, GIF, SVG, PDF | Loads or rasterizes source artwork into image data for tracing. | Use the highest-quality source available, then control working size with Max side. SVG/PDF inputs are rasterized first. |
| Mode | `layered` | `layered`, `color`, `binary` | Selects the tracing strategy: color+lineart layers, color paths only, or binary lineart only. | Layered for watercolor with ink, color for flat color SVGs, binary for clean lineart. Layered is usually larger and slower. |
| Max side | `1500px` | `240px` to `3200px` | Resizes the longest source dimension before tracing. | `1100-1500px` for compact SVGs, `1800-2400px` balanced, `2600-3200px` detail. Larger values are slower and heavier. |
| Pre-blur | `0.3px` | `0px` to `4px` | Shared blur before tracing; also synchronizes color and lineart blur values. | `0-0.15px` for crisp lineart, `0.3-0.7px` for watercolor grain. Too much blur erases detail. |
| Live preview | Off | On/off | Debounced automatic vectorization after setting changes. | Good for small images and quick tuning. Turn off for high-resolution or expensive layered settings. |
| Open result in Editing | Off | On/off | Opens a successful manual vectorization result in the Editing tab. | Turn on when the next step is color/stroke editing. Live previews do not switch tabs. |

### Background

| Option | Default | Valid values | What it does | Recommended values and tradeoffs |
| --- | --- | --- | --- | --- |
| Remove paper/background | On | On/off | Excludes detected paper/background pixels from foreground tracing. | Keep on for scanned paper. Turn off for transparent/prepared artwork or when the background should stay. |
| Background method | `edge-connected` | `edge-connected`, `global-light`, `none` | Edge-connected flood-fills paper-like pixels connected to the border. Global-light removes all matching light pixels. None skips masking. | Edge-connected is safest for scans. Global-light can remove intentional white artwork. |
| Paper tolerance | `10%` | `1%` to `35%` | Controls how far a pixel may be from sampled paper color and still count as background. | `6-12%` clean paper, `12-18%` textured paper. High values eat pale washes; low values leave speckles. |
| Min paper lightness | `72%` | `40%` to `98%` | Requires paper candidates to be at least this light. | `72-84%` for most scans. Raise to protect pale color; lower if beige/gray paper remains. |
| Sample inset | `14px` | `2px` to `60px` | Samples paper color this far in from image edges. | `10-25px` for normal scans; larger if scanner edge shadows pollute the border. |
| Preview foreground mask | Off | On/off | Shows the foreground mask for diagnosing paper removal. | Use temporarily while tuning, then turn off before final export. |

### Color Layer

| Option | Default | Valid values | What it does | Recommended values and tradeoffs |
| --- | --- | --- | --- | --- |
| Quantizer | `oklab-kmeans` | `oklab-kmeans`, `rgb-median-cut` | Chooses the color clustering algorithm. OKLab k-means++ clusters perceptually; RGB median cut divides RGB space. | OKLab for artwork/watercolor quality. RGB median cut for faster simple flat-color results. |
| Colors | `24` | `2` to `96` | Maximum palette size for color tracing. | `8-18` lightweight, `20-36` balanced watercolor, `48-96` subtle washes. More colors mean more paths and larger files. |
| Iterations | `20` | `2` to `60` | Maximum k-means palette refinement passes. | `12-24` most work, `30-45` high-detail watercolor. Higher values cost time. |
| Max samples | `140,000` | `5,000` to `500,000` | Limits pixels used to learn the color palette. | `50,000-140,000` speed, `250,000-360,000` large subtle artwork. Very high counts may not help simple images. |
| Exclude lineart from color layer | On | On/off | Removes detected ink from color quantization/tracing in layered mode. | Keep on for clean ink over color. Turn off to underpaint beneath ink and reduce white gaps. |
| Lineart darkness | `150` | `40` to `230` | Defines which dark pixels count as lineart for color separation. | `130-170` typical ink. Lower protects dark paint; higher catches faint ink but can create black blobs. |

### Lineart Layer

| Option | Default | Valid values | What it does | Recommended values and tradeoffs |
| --- | --- | --- | --- | --- |
| Threshold mode | `manual` | `manual`, `otsu`, `sauvola` | Chooses how the lineart mask decides what is ink. | Manual for predictable scans, Otsu for quick automatic tracing, Sauvola for uneven lighting or texture. |
| Threshold | `148` | `0` to `255` | Manual cutoff between ink and non-ink. | `145-190` for black ink scans. Raise to catch lighter marks; lower to reject shadows. |
| Sauvola window | `31px` | `9px` to `101px`, step `2` | Local neighborhood size for Sauvola thresholding. | `25-45px` for most lineart. Small windows amplify texture; large windows can miss local faint marks. |
| Sauvola k | `0.28` | `0.05` to `0.8` | Sensitivity for Sauvola thresholding. | `0.2-0.35` for most scans. Higher can pull paper grain into lineart. |
| Ink chroma guard | `255` | `0` to `255` | Rejects saturated pixels from becoming ink. `255` disables the guard. | `50-90` for watercolor with black ink, `255` for grayscale lineart. Too low can remove warm/colored ink. |
| Invert | Off | On/off | Swaps which side of the threshold becomes lineart. | Off for dark ink on light paper. On for light marks on dark backgrounds. |
| Line color | `#111111` | Browser color picker hex | Sets fill color for generated lineart paths. | Use near-black for ink or a brand/accent color for single-color graphics. |

### Contours

| Option | Default | Valid values | What it does | Recommended values and tradeoffs |
| --- | --- | --- | --- | --- |
| Contour minimum area | `5px2` | `0px2` to `500px2` | Discards tiny traced islands. | `0-5` detail, `8-25` cleanup, higher for lightweight output. High values delete dots, texture, and hatching. |
| RDP simplification | `0.65px` | `0px` to `8px` | Removes unnecessary points with Ramer-Douglas-Peucker simplification. | `0.2-0.7` detailed art, `0.8-1.5` balanced, `2+` compact. High values distort curves and lettering. |
| Curve smoothing | `6%` | `0%` to `100%` | Rounds traced contours toward cubic curves. | `0-15%` lineart, `5-25%` balanced, higher for soft fills. Too much smoothing rounds off deliberate corners. |
| Precision | `2` | `0` to `4` | Rounds SVG path coordinates to this many decimals. | `1-2` most output, `0` compact files, `3-4` high-detail/scaled art. Low precision can shift detail. |

### Advanced Layer Controls

| Option | Default | Valid values | What it does | Recommended values and tradeoffs |
| --- | --- | --- | --- | --- |
| Color blur | `0.3px` | `0px` to `4px` | Blurs only the color layer before tracing. | `0.3-0.7px` for watercolor grain; lower for crisp flat colors. High blur merges colors. |
| Underpaint stroke | `0px` | `0px` to `6px` | Adds a same-color stroke around color fills. | `0.25-0.75px` hides white gaps. Large strokes muddy edges or cover detail. |
| Color trace min area | `5px2` | `0px2` to `500px2` | Overrides contour minimum area for color paths. | `3-8` detailed watercolor, `12+` lighter SVGs. High values remove small accents. |
| Color trace simplify | `0.65px` | `0px` to `8px` | Overrides simplification for color paths. | `0.35-0.8` watercolor detail, `1+` lighter files. High values can misalign with lineart. |
| Color trace smooth | `6%` | `0%` to `100%` | Overrides smoothing for color paths. | `10-60%` soft washes, lower for hard-edged graphics. High smoothing shifts edges. |
| Lineart blur | `0.3px` | `0px` to `4px` | Blurs only the lineart layer before thresholding. | `0-0.15px` crisp ink, `0.2-0.5px` noisy scans. Too much merges strokes. |
| Lineart stroke | `0px` | `0px` to `8px` | Adds a same-color SVG stroke around lineart paths. | `0-0.3px` subtle reinforcement, `0.4-0.8px` bolder ink. Large strokes close holes and thicken lettering. |
| Lineart trace min area | `5px2` | `0px2` to `500px2` | Overrides contour minimum area for lineart paths. | `2-5` detailed ink, `8+` dust cleanup. High values delete dots and line ends. |
| Lineart trace simplify | `0.65px` | `0px` to `8px` | Overrides simplification for lineart paths. | `0.2-0.45` detailed lineart, `0.6-1.2` cleaner/smaller output. High values deform lettering and hatching. |
| Lineart trace smooth | `6%` | `0%` to `100%` | Overrides smoothing for lineart paths. | `6-18%` ink, lower for mechanical art. Too much erases hand-drawn character. |

### Output

| Option | Default | Valid values | What it does | Recommended values and tradeoffs |
| --- | --- | --- | --- | --- |
| Add real background rectangle | Off | On/off | Emits a full-size SVG rectangle behind traced paths. | Turn on for a solid SVG/PNG background. Leave off for transparency. |
| Background color | `#FFFFFF` | Browser color picker hex | Fill color for the optional real background rectangle. | White for paper-like output, brand/accent colors for final assets. Has no effect unless the rectangle is enabled. |
| Vectorize | Disabled until source exists | Button action | Runs vectorization with current settings. | Use when Live preview is off or after changing several settings. High-detail runs can take longer. |
| Send to Editing | Disabled until result exists | Button action | Copies the vector result into the Editing tab. | Use for palette/stroke/color editing. Sending a new result replaces the current Editing SVG. |
| Export SVG | Disabled until SVG exists | Button action | Downloads the current vectorization result as SVG. | Use for scalable/editable output. Many colors, low simplification, and high Max side create larger files. |
| Export PNG | Disabled until SVG exists | Button action | Rasterizes the vector result and downloads a 2x PNG. | Use for previews and raster upload targets. PNG is not path-editable. |

## Best Settings For

### Watercolor With Ink

- Mode: `layered`
- Background method: `edge-connected`
- Quantizer: `OKLab k-means++`
- Colors: `24-64`
- Ink chroma guard: `50-90`
- Color blur: `0.3-0.7px`
- Lineart blur: `0.05-0.2px`

If dark paint becomes ink, lower Lineart darkness or Ink chroma guard. If white gaps appear, add a small Underpaint stroke or turn off Exclude lineart from color layer.

### Clean Black Lineart

- Mode: `binary`
- Max side: `1800-2800px`
- Pre-blur: `0-0.15px`
- Threshold mode: `manual` or `Otsu`
- Threshold: `160-190`
- Lineart trace simplify: `0.2-0.5px`

If paper texture appears, raise Contour minimum area, add a little Lineart blur, or lower the Threshold.

### Lightweight SVG

- Mode: `color` or `binary`
- Max side: `900-1500px`
- Colors: `8-18`
- Contour minimum area: `10-25px2`
- RDP simplification: `1-2px`
- Precision: `0-1`

Small files come from fewer paths and fewer coordinates, so expect some loss of tiny texture and subtle transitions.

### Preserving Detail

- Max side: `2400-3200px`
- Colors: `48-96`
- Iterations: `30-45`
- Max samples: `250,000-500,000`
- Contour minimum area: `0-4px2`
- RDP simplification: `0.2-0.5px`
- Precision: `2-4`

These settings favor fidelity over speed and file size.

### Removing Paper Background

- Remove paper/background: on
- Background method: `edge-connected`
- Paper tolerance: `6-14%`
- Min paper lightness: `72-84%`
- Sample inset: `10-28px`
- Preview foreground mask: on while tuning

If pale art disappears, lower Paper tolerance or raise Min paper lightness. If border shadows remain, increase Sample inset.

### Avoiding White Gaps

- Underpaint stroke: `0.25-0.75px`
- Exclude lineart from color layer: off when needed
- Color trace simplify: below `1px`
- Lineart stroke: `0.1-0.4px`

Increase overlap in small steps and inspect at 100% zoom.

### Avoiding Black Blobs

- Lineart darkness: lower toward `130-150`
- Ink chroma guard: lower toward `50-80`
- Threshold: lower when using manual mode
- Sauvola k: lower when adaptive thresholding grabs texture

If actual ink disappears too, increase the guard or threshold gradually, or use Lineart stroke instead of reclassifying more pixels as ink.
