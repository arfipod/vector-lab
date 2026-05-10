# Vector Lab Scripting Guide

Vector Lab scripts are small command lists for applying vectorization presets, changing options, running vectorization, sending results to the editor, and exporting files. They are meant for repeatable workflows: tune a scan once, save the commands, then paste them into the console for similar artwork.

## Where To Run Scripts

Open the in-app console, edit the Script panel, and press **Run script**. The script runs against the current Vectorization settings, current Editing settings, and any currently available SVG result.

## Grammar

Scripts are line-based. Each non-empty, non-comment line must be one command:

```txt
preset <preset-name>
set <option-path> = <value>
set <option-path>: <value>
set <option-path> <value>
run <action-name>
```

Commands are matched case-insensitively, but option aliases and direct paths should be written exactly as documented. Blank lines are ignored.

Use `#` for comments:

```txt
# This line is ignored.
set color.colors = 32 # This trailing comment is ignored.
set line.fill = #111111
```

Full-line comments start when the first non-space character is `#`. Inline comments also use `#`, except valid hex color values such as `#111111` are treated as values.

## Commands

### `preset`

Applies a built-in preset to the current vectorization settings:

```txt
preset watercolor-balanced
```

Supported presets:

- `watercolor-balanced`
- `watercolor-maximum`
- `watercolor-detail`
- `svg-light`
- `lineart-clean`
- `lineart-detail`

Presets merge into the current settings; they do not reset the whole app state. Vectorization sections inside the preset replace or merge their matching sections, while unspecified settings keep their current values. Preset-level `trace.*` values are also inherited by `color.trace.*` and `binary.trace.*` unless the preset supplies a layer-specific trace override.

Custom filters from the Filter Library are not script presets. They are managed in the UI and browser `localStorage`.

### `set`

Sets one option path:

```txt
set color.colors = 32
set bg.tolerance: 12
set line.threshold 185
```

Official aliases are listed in the table below. The parser also accepts direct dotted paths, such as `background.enabled`, `binary.invert`, `output.backgroundColor`, or `editor.hue`. Direct paths are useful for settings that do not have aliases, but official aliases are the stable scripting surface.

The parser does not validate value ranges or enum names. Invalid values may lead to odd UI state or later vectorization errors, so prefer the values shown in the app and in the option reference.

### `run`

Queues an action:

```txt
run vectorize
run send-to-editor
run export-svg
```

Supported actions:

| Action | What it does |
| --- | --- |
| `vectorize` | Runs vectorization with the script's resulting VectorOptions. Requires a loaded source image. |
| `send-to-editor` | Sends the latest available SVG to the Editing tab. If it follows `run vectorize`, it uses that new result. |
| `open-editor` | Alias for `send-to-editor`. |
| `export-svg` | Downloads the latest available SVG. |
| `export-png` | Rasterizes and downloads the latest available SVG as PNG. |

Actions run in script order after all settings have been parsed. If no SVG exists for editor/export actions, the app logs a warning.

## Values

| Type | Examples | Notes |
| --- | --- | --- |
| Number | `24`, `0.65`, `-20`, `0,25` | Parsed with JavaScript number rules. A comma can be used as a decimal separator. |
| Boolean | `true`, `false`, `yes`, `no`, `on`, `off` | Case-insensitive. |
| String | `layered`, `edge-connected`, `"rgb-median-cut"` | Quotes are optional for simple strings. Matching outer single or double quotes are removed; escape sequences are not interpreted. |
| Hex color | `#111111`, `#fff`, `"#ffffff"` | Useful for line fill and output background paths. Valid unquoted hex colors are not treated as comments. |

## Error Behavior

Parsing stops on the first error. In the app, the console logs the error and no parsed settings or actions from that failed script are applied.

Line numbers are reported using the original physical line in the script, including blank lines and comments. Common errors:

- Unknown preset: `Unknown preset on line N`
- Unknown action: `Unknown action on line N`
- Invalid command shape: `Cannot parse line N: <original line>`

Unknown option paths are not considered parse errors because direct dotted paths are supported.

## Cascading Settings

`set trace.minArea`, `set trace.simplify`, `set trace.smooth`, and `set trace.precision` update three places at once:

- `trace.*`
- `color.trace.*`
- `binary.trace.*`

Use `color.trace.*` or `line.trace.*` when only one layer should change.

`set vector.blur` updates the shared `blur` value and also cascades to:

- `color.blur`
- `binary.blur`

Use `color.blur` or `line.blur` for layer-only blur changes.

## Editor Settings

Paths beginning with `editor.` update Editing settings instead of VectorOptions:

```txt
set editor.hue = 20
set editor.saturation = 15
set editor.protectBlack = true
run send-to-editor
```

Editor settings can be changed without vectorizing. They affect the current SVG in the Editing tab and any SVG sent there by later script actions.

Common direct editor paths:

- `editor.strokeScale`
- `editor.strokeOffset`
- `editor.model`
- `editor.hue`
- `editor.saturation`
- `editor.lightness`
- `editor.value`
- `editor.opacity`
- `editor.protectWhite`
- `editor.protectBlack`
- `editor.protectGray`

Nested editor paths such as `editor.replacements.blue = #3366ff` are accepted, but palette keys that contain `#` cannot be used in option paths. Use the Editing palette UI for exact detected-color replacement.

## Official Option Aliases

Direct VectorOptions or EditorSettings paths may be used when they match the parser's dotted-path syntax. The aliases below are the official script aliases currently provided by `src/lib/scripting.ts`.

| Alias path | Actual path | Type | Default | Example | Notes |
| --- | --- | --- | --- | --- | --- |
| `vector.mode` | `mode` | string enum | `layered` | `set vector.mode = layered` | `layered`, `color`, or `binary`. |
| `vector.maxSide` | `maxSide` | number | `1500` | `set vector.maxSide = 2200` | Longest working source side in pixels. |
| `vector.blur` | `blur` | number | `0.3` | `set vector.blur = 0.25` | Cascades to `color.blur` and `binary.blur`. |
| `live` | `livePreview` | boolean | `false` | `set live = off` | Alias for live preview. Direct path `livePreview` also works. |
| `bg.method` | `background.method` | string enum | `edge-connected` | `set bg.method = edge-connected` | `edge-connected`, `global-light`, or `none`. |
| `bg.tolerance` | `background.tolerance` | number | `10` | `set bg.tolerance = 12` | Paper/background color tolerance. |
| `bg.minLightness` | `background.minLightness` | number | `72` | `set bg.minLightness = 80` | Minimum lightness for paper candidates. |
| `bg.showMask` | `background.showMask` | boolean | `false` | `set bg.showMask = true` | Shows the foreground mask preview. |
| `color.colors` | `color.colors` | number | `24` | `set color.colors = 36` | Maximum color palette size. |
| `color.quantizer` | `color.quantizer` | string enum | `oklab-kmeans` | `set color.quantizer = oklab-kmeans` | `oklab-kmeans` or `rgb-median-cut`. |
| `color.iterations` | `color.iterations` | number | `20` | `set color.iterations = 32` | K-means refinement limit. |
| `color.samples` | `color.sampleLimit` | number | `140000` | `set color.samples = 250000` | Maximum palette-learning samples. |
| `color.minClusterPixels` | `color.minClusterPixels` | number | `8` | `set color.minClusterPixels = 3` | Small color-cluster cutoff. |
| `color.excludeLineart` | `color.excludeLineart` | boolean | `true` | `set color.excludeLineart = false` | Removes detected ink from color tracing in layered mode. |
| `color.lineartDarkness` | `color.lineartDarkness` | number | `150` | `set color.lineartDarkness = 140` | Dark-pixel cutoff for lineart separation. |
| `color.blur` | `color.blur` | number | `0.3` | `set color.blur = 0.55` | Color-layer-only blur. |
| `color.underpaintStrokeWidth` | `color.underpaintStrokeWidth` | number | `0` | `set color.underpaintStrokeWidth = 0.45` | Adds same-color overlap around color fills. |
| `color.trace.minArea` | `color.trace.minArea` | number | `5` | `set color.trace.minArea = 3` | Color-layer contour island cutoff. |
| `color.trace.simplify` | `color.trace.simplify` | number | `0.65` | `set color.trace.simplify = 0.38` | Color-layer RDP simplification. |
| `color.trace.smooth` | `color.trace.smooth` | number | `6` | `set color.trace.smooth = 48` | Color-layer curve smoothing percent. |
| `color.trace.precision` | `color.trace.precision` | number | `2` | `set color.trace.precision = 2` | Color-layer coordinate decimals. |
| `line.threshold` | `binary.threshold` | number | `148` | `set line.threshold = 185` | Manual lineart threshold. |
| `line.mode` | `binary.thresholdMode` | string enum | `manual` | `set line.mode = otsu` | `manual`, `otsu`, or `sauvola`. |
| `line.fill` | `binary.fill` | hex color string | `#111111` | `set line.fill = #111111` | Fill color for generated line paths. |
| `line.blur` | `binary.blur` | number | `0.3` | `set line.blur = 0.08` | Lineart-layer-only blur. |
| `line.maxChroma` | `binary.maxChroma` | number | `255` | `set line.maxChroma = 80` | Rejects saturated pixels from ink detection. |
| `line.strokeWidth` | `binary.strokeWidth` | number | `0` | `set line.strokeWidth = 0.25` | Adds stroke around generated line paths. |
| `line.trace.minArea` | `binary.trace.minArea` | number | `5` | `set line.trace.minArea = 4` | Lineart contour island cutoff. |
| `line.trace.simplify` | `binary.trace.simplify` | number | `0.65` | `set line.trace.simplify = 0.24` | Lineart RDP simplification. |
| `line.trace.smooth` | `binary.trace.smooth` | number | `6` | `set line.trace.smooth = 12` | Lineart curve smoothing percent. |
| `line.trace.precision` | `binary.trace.precision` | number | `2` | `set line.trace.precision = 2` | Lineart coordinate decimals. |
| `trace.minArea` | `trace.minArea` | number | `5` | `set trace.minArea = 8` | Cascades to color and lineart trace. |
| `trace.simplify` | `trace.simplify` | number | `0.65` | `set trace.simplify = 1.1` | Cascades to color and lineart trace. |
| `trace.smooth` | `trace.smooth` | number | `6` | `set trace.smooth = 10` | Cascades to color and lineart trace. |
| `trace.precision` | `trace.precision` | number | `2` | `set trace.precision = 1` | Cascades to color and lineart trace. |
| `output.openInEditor` | `output.openInEditor` | boolean | `false` | `set output.openInEditor = true` | Opens successful manual vectorization in Editing. |
| `output.background` | `output.addBackground` | boolean | `false` | `set output.background = on` | Adds a real background rectangle. |

Useful direct paths without official aliases include:

```txt
set background.enabled = true
set background.sampleInset = 24
set background.alphaThreshold = 8
set binary.invert = false
set binary.sauvolaWindow = 31
set binary.sauvolaK = 0.28
set output.backgroundColor = #ffffff
```

## Practical Scripts

### Balanced Watercolor

```txt
preset watercolor-balanced
set color.colors = 24
set trace.simplify = 0.65
run vectorize
```

### Maximum-Detail Watercolor

```txt
preset watercolor-detail
set vector.mode = layered
set vector.maxSide = 2800
set color.colors = 64
set color.samples = 360000
set color.minClusterPixels = 3
set color.excludeLineart = false
set color.blur = 0.55
set line.blur = 0.12
set line.maxChroma = 58
set color.underpaintStrokeWidth = 0.55
set line.strokeWidth = 0.55
set color.trace.minArea = 3
set color.trace.simplify = 0.38
set color.trace.smooth = 56
set line.trace.minArea = 3
set line.trace.simplify = 0.24
set line.trace.smooth = 18
run vectorize
```

### Clean Lineart

```txt
preset lineart-clean
set vector.mode = binary
set line.mode = manual
set line.threshold = 185
set line.fill = #111111
set line.blur = 0.08
set line.trace.simplify = 0.28
run vectorize
```

### Lightweight SVG

```txt
preset svg-light
set vector.maxSide = 1100
set color.colors = 14
set trace.minArea = 14
set trace.simplify = 1.1
set trace.precision = 1
run vectorize
```

### Show Foreground Mask

```txt
set bg.showMask = true
run vectorize
```

Turn it off before final output:

```txt
set bg.showMask = false
run vectorize
```

### Export SVG After Vectorizing

```txt
preset watercolor-balanced
run vectorize
run export-svg
```

### Vectorize And Send To Editor

```txt
preset watercolor-balanced
set editor.protectWhite = true
set editor.protectGray = true
run vectorize
run send-to-editor
```

### Editing-Only Hue/Saturation Adjustment

```txt
set editor.model = hsl
set editor.protectWhite = true
set editor.protectBlack = true
set editor.hue = 18
set editor.saturation = 12
set editor.lightness = 4
```

### Troubleshooting Black Blobs

```txt
preset watercolor-balanced
set color.lineartDarkness = 135
set line.threshold = 160
set line.maxChroma = 65
set line.trace.minArea = 8
run vectorize
```

### Troubleshooting Weak Ink

```txt
preset lineart-clean
set line.threshold = 195
set line.maxChroma = 100
set line.blur = 0.04
set line.strokeWidth = 0.35
set line.trace.simplify = 0.22
run vectorize
```

### Troubleshooting White Gaps

```txt
preset watercolor-balanced
set color.excludeLineart = false
set color.underpaintStrokeWidth = 0.55
set line.strokeWidth = 0.2
set color.trace.simplify = 0.45
run vectorize
```
