// Self-check for the pure search logic in src/search.js. Run via npm run check.
import assert from 'node:assert/strict';
import { searchPOIs } from '../src/search.js';

const feats = [
  { properties: { id: 'trinity-college', name: 'Trinity College & Book of Kells' } },
  { properties: { id: 'guinness-storehouse', name: 'Guinness Storehouse' } },
];

// substring match
assert.deepEqual(searchPOIs(feats, 'Trinity'), [feats[0]]);
// case-insensitive
assert.deepEqual(searchPOIs(feats, 'GUINNESS'), [feats[1]]);
assert.deepEqual(searchPOIs(feats, 'sto'), [feats[1]]);
// no match
assert.deepEqual(searchPOIs(feats, 'nonexistent'), []);
// empty/whitespace query → no results
assert.deepEqual(searchPOIs(feats, ''), []);
assert.deepEqual(searchPOIs(feats, '   '), []);

console.log('✓ search ok');
