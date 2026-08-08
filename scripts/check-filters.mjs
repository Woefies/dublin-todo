// Self-check for the pure filter logic in src/filters.js. Run via npm run check.
import assert from 'node:assert/strict';
import { orderedCategories, categoryFilter } from '../src/filters.js';

const feats = [
  { properties: { categories: ['pubs', 'historic'] } },
  { properties: { categories: ['food'] } },
  { properties: { categories: ['historic'] } },
];

const cats = orderedCategories(feats);
// canonical order, unknowns aside; counts correct
assert.deepEqual(cats.map((c) => c.id), ['historic', 'pubs', 'food']);
assert.equal(cats.find((c) => c.id === 'historic').count, 2);

// empty set hides everything
assert.deepEqual(categoryFilter(new Set()), ['boolean', false]);
// single category → one OR clause matching the array property
assert.deepEqual(categoryFilter(new Set(['pubs'])), [
  'any',
  ['in', 'pubs', ['get', 'categories']],
]);

console.log('✓ filters ok');
