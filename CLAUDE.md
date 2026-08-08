# dublin-todo

Static, interactive map of things to do in Dublin city centre. Filterable POI
categories, hosted free on GitHub Pages. No backend, no keys, no recurring cost.

Live: https://woefies.github.io/dublin-todo/ (project site — served under
`/dublin-todo/`, deployed via GitHub Actions on push to `main`).

## Stack

- **Vanilla JS + Vite** — single-page imperative map, no framework.
- **MapLibre GL JS** (npm, self-hosted) — map + native clustering + vector tiles.
- **OpenFreeMap** (keyless public tiles) — basemap. Style URL is the one config
  value to swap if the provider is ever replaced (see `src/map.js`).
- **Hand-curated GeoJSON** — POIs live in `public/data/pois.geojson`, not auto-extracted.

## Layout

```
index.html                 Vite entry, #map container
src/main.js                imports CSS + calls initMap
src/map.js                 MapLibre setup, OpenFreeMap style, POI fetch + layer
src/style.css              full-viewport map
public/data/pois.geojson   hand-curated POI dataset (static asset)
scripts/check-pois.mjs     data sanity check (runs in build)
vite.config.js             base: '/dublin-todo/'  ← project-site base path
.github/workflows/deploy.yml  build + deploy to Pages
```

## Theming (two themes: Romance + Historic)

The site ships two themes. **Romance** (default) — light pastel, chrome-pink +
acid-lime on sky blue. **Historic** — Georgian Dublin: Portland-stone grounds,
fanlight-iron ink, oxblood door-red primary, brunswick door-green secondary,
brass door-plaque pins. Switch via `data-theme` on `<html>` (toggle in the
brand header); default follows `prefers-color-scheme` (dark→Historic,
light→Romance) then persists to `localStorage`. An inline script in
`index.html` `<head>` stamps the attribute before first paint (no flash on this
static host). Map basemap is retuned per theme (same OpenFreeMap Liberty tiles,
recolored).

**Token architecture — three layers in `src/style.css`:**
1. **Shared non-color primitives** on bare `:root` — radius, motion, type scale.
2. **Color primitives** — raw palette per theme, hue-scale names (`--rose-500`,
   `--stone-200`). Romance on `:root`; each other theme in a `[data-theme='…']`
   block. **The only place literal colors may appear.**
3. **Semantic tokens** — role names bound to this theme's primitives
   (`--surface`, `--surface-raised/-sunken`, `--surface-map-water`, `--border`,
   `--border-strong`, `--text`, `--text-muted/-faint`, `--text-on-accent`,
   `--accent`, `--accent-strong/-ink`, `--accent-2` + variants, `--focus-ring`,
   `--info/--success/--error/--warning` + `-bg`, `--bloom-*`/`--spec`,
   `--shadow-1/2`, `--grain-opacity/-blend`, and per-theme `--font-*`).

**Rules (enforce these):**
- **Components reference ONLY semantic tokens** — never a primitive, never a
  literal, never a per-component color override. A component must not know which
  theme is active.
- **No literal color outside layer 2** (CSS primitive blocks) **or `theme.js`**
  (the JS palette MapLibre paint needs — it can't read CSS vars).
- **Adding a token = add it to EVERY theme block.** No theme may inherit
  another's values; each `[data-theme]` block defines the complete semantic set.
- If a value fails contrast in one theme, fix **that theme's primitive** — never
  loosen the shared semantic role.

Map/marker colors (basemap recolor + pins + selected halo) live in `src/theme.js`
per theme, kept in sync with each theme's semantic tokens by hand.

## Design system ("Romance")

Light pastel chrome on a sky-blue map: chrome-pink primary, acid-lime
secondary, blue-tinted white surfaces. All colors and fonts are CSS custom
properties in `src/style.css` — use the semantic tokens, never raw hex
(MapLibre paint via `theme.js` is the one exception, below). Surfaces: `--surface-0/1/2`,
`--surface-sky`, `--border-soft`, `--border-ui`. Text: `--text-strong`,
`--text-muted`, `--text-faint`, `--text-on-accent`. Accents: `--primary`
`#f0589f`, `--secondary` (lime) `#b4dd3a`, plus `-strong`/`-ink` variants and a
`--bloom-core`/`--bloom-edge`/`--spec` trio for the one glossy-blob signature
element. Semantic `--info`/`--success`/`--error`/`--warning` are always paired
with an icon or label, never hue alone.

**Hard rule: no white text on `--primary` pink** — it fails 4.5:1 contrast.
Text on any fill is always `--text-on-accent` (`#17252e`). Active chips use
`--secondary` fill + ink text (10:1); pink-as-text uses `--primary-ink`;
lime-as-text uses `--secondary-ink`. Focus rings are 2px `--primary-strong`
outline + 2px offset on every focusable control.

Fonts: `--font-display` Hanken Grotesk (wght 700/800, wordmark + `#detail h2`),
`--font-ui` Inter (wght 400/500/600, body/UI), `--font-mono` Space Mono (wght
400/700, counts/credits/category labels). All OFL, loaded from Google Fonts CDN
via `index.html` (external request; swap to `@fontsource` if fully self-hosted
assets are ever required).

Map markers (`src/main.js`, `src/icons.js`) are hard-coded hex in the layer
paint since MapLibre paint can't read CSS vars — keep in sync with the tokens:
Pins are single composited images (pink `#f0589f` disc + ink `#17252e` glyph
baked together in `src/icons.js` `svgDoc`), drawn by one symbol layer `pois` —
composited so overlapping pins stay whole and the basemap can't bleed through
the glyph. Category glyphs are Material Symbols (Outlined) paths; chips reuse
the glyph alone via `categoryIconSvg` (`currentColor`). A `poi-selected` lime circle layer drawn UNDER `pois` (same source) shows a lime
halo rim around the active pin; its filter is set/cleared by
`selectPOI()`/`closeDetail()` via the `id` property (the source has no
top-level feature id, so this is a property filter, not feature-state). On
load, `retuneBasemap()` walks `map.getStyle().layers` and recolors the
OpenFreeMap Liberty basemap into the palette (background → `--surface-0`,
water → `--surface-sky`, other fills flattened to `--surface-0`, lines →
white, symbol text → `--text-muted`/`--surface-1` halo), skipping our own POI
layers.

The `.bloom` radial-gradient glossy blob (signature element) is used in
exactly two places: behind the `#brand` wordmark (CSS) and the selected-marker
highlight on the map (the lime-ringed `poi-selected` layer, described above) —
do not add it anywhere else.

## Critical conventions

- **Base path**: this is a project site. Never hard-code `/data/...` or absolute
  asset paths — they 404 in production. Fetch runtime data via
  `` `${import.meta.env.BASE_URL}data/pois.geojson` ``. Vite rewrites bundled
  asset URLs automatically.
- **POI data model** (per feature `properties`): required `id` (kebab, unique —
  used for deep-links later), `name`, `categories` (non-empty array — a POI can
  be in several). Optional: `summary`, `address`, `fee` (`free|paid|unknown`),
  `url`, `wikidata`, `image`. Geometry is always a `Point [lon, lat]`.
- **Edit `pois.geojson` by hand**, then `npm run check` — it validates every
  feature and fails loudly on a bad edit. `build` runs it automatically.
- **Attribution**: keep MapLibre's default attribution control on (OSM
  attribution is mandatory for the OpenFreeMap basemap).
- **Deploy**: push to `main` → Actions builds `dist/` and deploys. Pages Source
  must stay set to "GitHub Actions" (not "Deploy from a branch"). `dist/` is not
  committed.

## Roadmap (see plan file for detail)

Phase 0 ✅ pipeline slice · Phase 1 ✅ externalised data + model + check ·
Phase 2 ✅ category filter chips + OR-match filter (clustering deferred until
dense) · Phase 3 ✅ detail panel + search + deep-link hash state (cat/sel/z/c) +
geolocation (MapLibre GeolocateControl) + a11y · Phase 4 ✅ lazy Wikipedia
enrichment on select (intro + thumbnail, memoised, CC BY-SA link-back).

---

# Agent project seam

Fields below are what the user-level agents (builder, test-writer, reviewer,
debugger, researcher) read at runtime. Blank = skip, do not guess.

## Commands

```
test:       npm run check   (data sanity only — no unit-test framework yet)
test-one:   node scripts/check-pois.mjs
lint:       (none configured)
typecheck:  (none — vanilla JS, no TS)
build:      npm run build   (runs check, then vite build)
run:        npm run dev     (http://localhost:5173/dublin-todo/)
```

Note: dev server needs `server.fs.strict: false` in `vite.config.js` because the
project path contains a literal `~` (`C:\~sites\`) that breaks Vite's fs-allow.
Do not remove it.

## Tests

```
framework:  none (only scripts/check-pois.mjs, a plain node assert script)
location:   scripts/
naming:     n/a
```
- No test framework installed. Adding real behavior tests = introduce one (ask
  first). For data changes, `check-pois.mjs` is the guard; extend it rather than
  add a framework for data validation.

## Code style

```
style:      no formatter/linter configured; match existing 2-space indent,
            single quotes, ES modules, trailing commas.
conventions: keep map logic in src/map.js; POI content only in the GeoJSON, never
            hard-coded in JS. Build data URLs from import.meta.env.BASE_URL.
```

## Off-limits

```
do-not-touch: dist/ (build output, not committed), node_modules/,
              vite.config.js server.fs.strict flag (tilde-path workaround).
```
