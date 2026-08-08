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
