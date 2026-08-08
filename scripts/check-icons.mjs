// Self-check for the pure primaryCategory picker in src/icons.js. Run via npm run check.
import assert from 'node:assert/strict';
import { primaryCategory, CATEGORY_ICON_IDS, categoryIconSvg } from '../src/icons.js';

// Priority: historic beats pubs when a POI is both (e.g. Temple Bar).
assert.equal(primaryCategory(['pubs', 'historic']), 'historic');
// Single category returns itself.
assert.equal(primaryCategory(['food']), 'food');
// Unknown category falls back to the first listed.
assert.equal(primaryCategory(['mystery']), 'mystery');
// An icon exists for every known category.
for (const c of ['historic', 'museum', 'parks', 'food', 'pubs', 'shopping'])
  assert.ok(CATEGORY_ICON_IDS.includes(c), `missing icon for ${c}`);

// Chip glyph inherits color and is empty for unknown categories.
assert.match(categoryIconSvg('pubs'), /stroke="currentColor"/);
assert.equal(categoryIconSvg('mystery'), '');

console.log('✓ icons ok');
