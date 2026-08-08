// Data sanity check for public/data/pois.geojson. Run: npm run check
// Fails loudly (exit 1) on a malformed hand-edit before it reaches the map.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../public/data/pois.geojson', import.meta.url));

// Greater/County Dublin bbox: [minLon, minLat, maxLon, maxLat] — covers Fingal
// north (Balbriggan/Malahide) to south county (Killiney/Dún Laoghaire) and Howth.
const BBOX = [-6.55, 53.15, -6.0, 53.65];
const FEES = new Set(['free', 'paid', 'unknown']);

const fc = JSON.parse(readFileSync(path, 'utf8'));
const errors = [];
const ids = new Set();

if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
  errors.push('root is not a FeatureCollection with a features array');
}

for (const [i, f] of (fc.features ?? []).entries()) {
  const where = `feature[${i}] (${f?.properties?.id ?? '?'})`;
  const p = f?.properties ?? {};

  if (!p.id) errors.push(`${where}: missing id`);
  else if (ids.has(p.id)) errors.push(`${where}: duplicate id "${p.id}"`);
  else ids.add(p.id);

  if (!p.name) errors.push(`${where}: missing name`);
  if (!Array.isArray(p.categories) || p.categories.length === 0)
    errors.push(`${where}: categories must be a non-empty array`);
  if (p.fee != null && !FEES.has(p.fee))
    errors.push(`${where}: fee "${p.fee}" not one of free|paid|unknown`);

  const c = f?.geometry?.coordinates;
  if (f?.geometry?.type !== 'Point' || !Array.isArray(c) || c.length !== 2) {
    errors.push(`${where}: geometry must be a Point [lon, lat]`);
  } else {
    const [lon, lat] = c;
    if (lon < BBOX[0] || lon > BBOX[2] || lat < BBOX[1] || lat > BBOX[3])
      errors.push(`${where}: [${lon}, ${lat}] outside Dublin bbox`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in pois.geojson:`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ ${fc.features.length} POIs valid`);
