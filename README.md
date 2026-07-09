# PaletteSmith

PaletteSmith is a Figma plugin that turns a single base color into a design-system starter kit with palette ramps, semantic roles, Figma Variables, paint styles, and code exports.

Official Figma plugin:
[PaletteSmith on Figma Community](https://www.figma.com/community/plugin/1656891050552747365)

## Branding

- SVG logo: [`assets/logo.svg`](C:/Users/matth/OneDrive/Desktop/company/PaletteSmith/assets/logo.svg)
- PNG logo: [`assets/logo.png`](C:/Users/matth/OneDrive/Desktop/company/PaletteSmith/assets/logo.png)

## Features

- Generate a base palette and mirrored dark palette
- Build semantic color groups for `accent`, `success`, `warning`, and `danger`
- Create Figma paint styles
- Create Figma Variables collections for colors, typography, spacing, radius, and shadows
- Export CSS variables, Tailwind-ready config scaffolding, and JSON tokens
- Preview theme direction, semantic roles, exports, and accessibility stats in the plugin UI

## Screenshots

Screenshots live in [`assets/screenshots`](C:/Users/matth/OneDrive/Desktop/company/PaletteSmith/assets/screenshots).

### Overview

<img src="./assets/screenshots/ui-overview.png" alt="PaletteSmith overview" width="240" />

### Tailwind Export

<img src="./assets/screenshots/ui-export-tailwind.png" alt="PaletteSmith Tailwind export" width="240" />

### CSS Export

<img src="./assets/screenshots/ui-export-css.png" alt="PaletteSmith CSS export" width="240" />

## Project Files

- [`manifest.json`](C:/Users/matth/OneDrive/Desktop/company/PaletteSmith/manifest.json): Figma plugin manifest
- [`ui.html`](C:/Users/matth/OneDrive/Desktop/company/PaletteSmith/ui.html): plugin interface
- [`src/code.ts`](C:/Users/matth/OneDrive/Desktop/company/PaletteSmith/src/code.ts): plugin runtime and Figma sync logic
- [`dist/code.js`](C:/Users/matth/OneDrive/Desktop/company/PaletteSmith/dist/code.js): compiled plugin entry

## Local Setup

```bash
npm install
npm run build
```


## Using The Plugin

1. Enter a system name and base HEX color.
2. Click `Generate System`.
3. Review the palette preview, token previews, exports, and accessibility summary.
4. Click `Sync to Figma`.

PaletteSmith currently creates:

- `Brand/...` paint styles
- `Semantic/...` paint styles
- color variables
- semantic alias variables
- typography variables
- spacing variables
- radius variables
- shadow variables


## Current Scope

Implemented now:

- palette generation
- semantic token modeling
- light/dark variable modes
- CSS/Tailwind/JSON export
- Figma Variables sync

Still planned:

- OKLCH-native palette generation
- text styles and effect styles
- SwiftUI / Flutter / Android exports
- richer accessibility fixes
- more component previews

## Publishing Checklist

- Add support contact
- Add Community listing copy
- Review the plugin metadata in Figma
- Complete the data/security form
- Publish from `Plugins -> Manage plugins` in the Figma desktop app
