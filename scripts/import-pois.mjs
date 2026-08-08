// Batch-import POIs from a JSON file you exported yourself (e.g. a browser-console
// scrape on a site you're allowed to browse) into public/data/pois.geojson, then
// re-run the data check.
//
//   npm run import-pois -- path/to/dublin-spots.json
//
// Input: a JSON array. Each item needs a name and at least one category. Coords
// are optional — if absent, the name is geocoded via OpenStreetMap Nominatim
// (best-effort; verify the misses by hand). Shape:
//   { "name": "...", "cats": ["Bars","Music"],   // or "cat": "Bars"
//     "lat": 53.34, "lon": -6.26,                 // optional
//     "url": "...", "summary": "...", "address": "..." }  // optional
//
// Only facts are imported. Do NOT paste a source's copyrighted descriptions into
// `summary` — write your own, or leave it blank.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CATEGORY_ICON_IDS } from '../src/icons.js';

const geojsonPath = fileURLToPath(new URL('../public/data/pois.geojson', import.meta.url));
const BBOX = [-6.55, 53.15, -6.0, 53.65]; // [minLon, minLat, maxLon, maxLat] — greater/County Dublin

// Map source category labels → our 6 ids (lowercased match). Extend to cover
// every label the export uses; an item whose categories ALL fail to map is
// reported so you can add them here.
const CAT_MAP = {
  'art & culture': 'museum',
  'art and culture': 'museum',
  culture: 'museum',
  museums: 'museum',
  museum: 'museum',
  galleries: 'museum',
  theaters: 'museum',
  cinema: 'museum',
  bars: 'pubs',
  bar: 'pubs',
  pubs: 'pubs',
  music: 'pubs',
  nightlife: 'pubs',
  restaurants: 'food',
  restaurant: 'food',
  'cafés': 'food',
  cafes: 'food',
  coffee: 'food',
  'coffee & tea': 'food',
  snacks: 'food',
  food: 'food',
  breakfast: 'food',
  shopping: 'shopping',
  shops: 'shopping',
  markets: 'shopping',
  'parks & nature': 'parks',
  parks: 'parks',
  nature: 'parks',
  outdoors: 'parks',
  relaxing: 'parks',
  sights: 'historic',
  sight: 'historic',
  historic: 'historic',
  monuments: 'historic',
};

const die = (msg) => {
  console.error('✗ ' + msg);
  process.exit(1);
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Nominatim: bounded to Dublin, 1 result. Usage policy = max 1 req/s + a real
// User-Agent. Returns [lon, lat] or null.
async function geocode(name) {
  const q = encodeURIComponent(`${name}, Dublin, Ireland`);
  const vb = `${BBOX[0]},${BBOX[3]},${BBOX[2]},${BBOX[1]}`; // left,top,right,bottom
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ie&viewbox=${vb}&bounded=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'dublin-todo POI importer (personal project)' } });
  if (!res.ok) return null;
  const j = await res.json();
  if (!j.length) return null;
  return [Number(j[0].lon), Number(j[0].lat)];
}

const inFile = process.argv[2];
if (!inFile) die('usage: npm run import-pois -- path/to/spots.json');

const items = JSON.parse(readFileSync(inFile, 'utf8'));
if (!Array.isArray(items)) die('input JSON must be an array of spots');

const fc = JSON.parse(readFileSync(geojsonPath, 'utf8'));
const seen = new Set(fc.features.map((f) => f.properties.id));

const unmapped = new Set();
const skipped = [];
const added = [];

for (const [i, s] of items.entries()) {
  const where = `item[${i}] (${s.name ?? '?'})`;
  if (!s.name) { skipped.push(`${where}: no name`); continue; }

  // Categories: accept `cats` array or single `cat`. Keep the ones that map.
  const rawCats = Array.isArray(s.cats) ? s.cats : s.cat ? [s.cat] : [];
  const mapped = [...new Set(rawCats.map((c) => CAT_MAP[String(c).toLowerCase().trim()]).filter(Boolean))];
  if (!mapped.length) {
    for (const c of rawCats) if (!CAT_MAP[String(c).toLowerCase().trim()]) unmapped.add(String(c).toLowerCase().trim() || '(empty)');
    skipped.push(`${where}: no mappable category (${rawCats.join(', ') || 'none'})`);
    continue;
  }

  let id = slug(s.id || s.name);
  if (seen.has(id)) { skipped.push(`${where}: duplicate id "${id}"`); continue; }

  // Coords: use given, else geocode (rate-limited).
  let lon = Number(s.lon), lat = Number(s.lat);
  if (Number.isNaN(lon) || Number.isNaN(lat)) {
    const hit = await geocode(s.name);
    await sleep(1100); // Nominatim: ≤1 req/s
    if (!hit) { skipped.push(`${where}: geocode failed — add coords by hand`); continue; }
    [lon, lat] = hit;
    console.log(`  geocoded "${s.name}" → [${lon}, ${lat}]`);
  }
  if (lon < BBOX[0] || lon > BBOX[2] || lat < BBOX[1] || lat > BBOX[3]) {
    skipped.push(`${where}: [${lon}, ${lat}] outside Dublin`);
    continue;
  }

  seen.add(id);
  const properties = { id, name: s.name, categories: mapped };
  if (s.summary) properties.summary = s.summary;
  if (s.address) properties.address = s.address;
  if (s.fee) properties.fee = s.fee;
  if (s.url) properties.url = s.url;
  properties.image = s.image ?? null;

  fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties });
  added.push(id);
}

if (unmapped.size)
  console.warn(`! unmapped categories (add to CAT_MAP to include these spots): ${[...unmapped].join(', ')}`);

if (!added.length) die('nothing imported (all items skipped)');

writeFileSync(geojsonPath, JSON.stringify(fc, null, 2) + '\n');
console.log(`+ imported ${added.length} spot(s)`);
if (skipped.length) {
  console.log(`- skipped ${skipped.length}:`);
  for (const s of skipped) console.log('  · ' + s);
}
execFileSync('node', ['scripts/check-pois.mjs'], { stdio: 'inherit' });
