// Append a POI to public/data/pois.geojson from the command line, then re-run
// the data check. Run: npm run add-poi -- --name "..." --cat food,pubs --coords "53.3438, -6.2546"
//
// --coords takes the Google-Maps order "lat, lon" (right-click a place → the
// numbers it copies) and flips it to GeoJSON [lon, lat] for you.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { CATEGORY_ICON_IDS } from '../src/icons.js';

const path = fileURLToPath(new URL('../public/data/pois.geojson', import.meta.url));

const { values: v } = parseArgs({
  options: {
    name: { type: 'string' },
    cat: { type: 'string' }, // comma list, e.g. food,pubs
    coords: { type: 'string' }, // "lat, lon" (Google Maps order)
    lonlat: { type: 'string' }, // "lon,lat" if you already have GeoJSON order
    id: { type: 'string' }, // optional; derived from name otherwise
    summary: { type: 'string' },
    address: { type: 'string' },
    fee: { type: 'string' }, // free | paid | unknown
    url: { type: 'string' },
    wikidata: { type: 'string' },
    image: { type: 'string' },
  },
});

const die = (msg) => {
  console.error('✗ ' + msg);
  process.exit(1);
};

if (!v.name) die('--name is required');
if (!v.cat) die('--cat is required (comma list, e.g. --cat food,pubs)');
if (!v.coords && !v.lonlat) die('--coords "lat, lon" (from Google Maps) is required');

const categories = v.cat.split(',').map((s) => s.trim()).filter(Boolean);
const unknown = categories.filter((c) => !CATEGORY_ICON_IDS.includes(c));
if (unknown.length)
  die(`unknown categor(ies): ${unknown.join(', ')}. Valid: ${CATEGORY_ICON_IDS.join(' ')}`);

// coords is "lat, lon" (Google order) → flip. lonlat is already [lon, lat].
const nums = (v.lonlat ?? v.coords).split(',').map((s) => Number(s.trim()));
if (nums.length !== 2 || nums.some(Number.isNaN)) die('coordinates must be two numbers');
const [lon, lat] = v.lonlat ? nums : [nums[1], nums[0]];

// Dublin bbox [minLon, minLat, maxLon, maxLat] — same as check-pois.mjs. Guard
// before writing so a swapped lat/lon can't leave a bad entry in the file.
const BBOX = [-6.45, 53.28, -6.05, 53.42];
if (lon < BBOX[0] || lon > BBOX[2] || lat < BBOX[1] || lat > BBOX[3])
  die(`[${lon}, ${lat}] is outside Dublin — did you swap lat/lon? --coords wants "lat, lon"`);

const id =
  v.id ??
  v.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const fc = JSON.parse(readFileSync(path, 'utf8'));
if (fc.features.some((f) => f.properties.id === id))
  die(`id "${id}" already exists — pass a different --id`);

const properties = { id, name: v.name, categories };
for (const k of ['summary', 'address', 'fee', 'url', 'wikidata']) if (v[k]) properties[k] = v[k];
properties.image = v.image ?? null;

fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties });
writeFileSync(path, JSON.stringify(fc, null, 2) + '\n');
console.log(`+ added "${id}" at [${lon}, ${lat}]`);

// Re-run the sanity check (bbox, dupes, shape). Throws (exit 1) if it fails.
execFileSync('node', ['scripts/check-pois.mjs'], { stdio: 'inherit' });
