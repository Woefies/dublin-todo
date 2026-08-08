// Self-check for the pure URL-state logic in src/urlstate.js. Run via npm run check.
import assert from 'node:assert/strict';
import { parseHash, buildHash } from '../src/urlstate.js';

const allIds = ['historic', 'museum', 'pubs'];

// round-trip preserves values
const hash = buildHash({
  activeIds: new Set(['pubs', 'museum']),
  allIds,
  sel: 'trinity-college',
  zoom: 15.456,
  center: [53.34378, -6.25461],
});
assert.deepEqual(parseHash(hash), {
  cat: ['pubs', 'museum'],
  sel: 'trinity-college',
  z: 15.46,
  c: [53.34378, -6.25461],
});

// cat omitted when all active; absent cat parses as undefined (= all active)
const allActiveHash = buildHash({ activeIds: new Set(allIds), allIds });
assert.ok(!allActiveHash.includes('cat='));
assert.equal(parseHash(allActiveHash).cat, undefined);
assert.equal(parseHash('').cat, undefined);

// sel omitted when falsy
const noSelHash = buildHash({ activeIds: new Set(allIds), allIds, sel: '' });
assert.ok(!noSelHash.includes('sel='));
assert.equal(parseHash(noSelHash).sel, undefined);

// numeric rounding
assert.equal(
  buildHash({ activeIds: new Set(allIds), allIds, zoom: 13.4567 }),
  'z=13.46',
);
assert.equal(
  buildHash({ activeIds: new Set(allIds), allIds, center: [53.343789, -6.254612] }),
  'c=53.34379,-6.25461',
);

// leading '#' is tolerated
assert.deepEqual(parseHash('#z=12'), { z: 12 });

console.log('✓ urlstate ok');
