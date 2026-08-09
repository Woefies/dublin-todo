// Self-check for the pure enrichment helpers in src/enrich.js. Run via npm run check.
import assert from 'node:assert/strict';
import {
  buildQueryUrl,
  buildTitleUrl,
  buildWikidataUrl,
  parseSitelinkTitle,
  parseWikidataImage,
  parseWikiResponse,
} from '../src/enrich.js';

// URL: CORS origin, single result, disambiguating " Dublin", plaintext intro.
const url = buildQueryUrl('Trinity College');
assert.match(url, /^https:\/\/en\.wikipedia\.org\/w\/api\.php\?/);
assert.match(url, /origin=\*/);
assert.match(url, /gsrsearch=Trinity\+College\+Dublin/);
assert.match(url, /explaintext=1/);

// Parse: pick the single page, build a spaces→underscores article URL.
const ok = parseWikiResponse({
  query: {
    pages: {
      '123': {
        title: 'Trinity College Dublin',
        extract: 'A university in Dublin.',
        thumbnail: { source: 'https://example.org/tcd.jpg' },
      },
    },
  },
});
assert.equal(ok.title, 'Trinity College Dublin');
assert.equal(ok.extract, 'A university in Dublin.');
assert.equal(ok.thumbnail, 'https://example.org/tcd.jpg');
assert.equal(ok.url, 'https://en.wikipedia.org/wiki/Trinity_College_Dublin');

// Misses → null (no pages, and a page with no extract).
assert.equal(parseWikiResponse({}), null);
assert.equal(parseWikiResponse({ query: { pages: { '1': { title: 'x' } } } }), null);

// Title + Wikidata URLs, and sitelink extraction (exact-article path via QID).
assert.match(buildTitleUrl('The Cobblestone'), /titles=The\+Cobblestone/);
assert.match(buildTitleUrl('x'), /redirects=1/);
assert.match(buildWikidataUrl('Q42'), /^https:\/\/www\.wikidata\.org\/w\/api\.php\?/);
assert.match(buildWikidataUrl('Q42'), /ids=Q42/);
assert.match(buildWikidataUrl('Q42'), /props=sitelinks%7Cclaims/); // one call, both
assert.equal(
  parseSitelinkTitle({ entities: { Q42: { sitelinks: { enwiki: { title: 'Foo' } } } } }, 'Q42'),
  'Foo',
);
assert.equal(parseSitelinkTitle({ entities: { Q42: { sitelinks: {} } } }, 'Q42'), null);

// P18 image claim → width-scaled Commons FilePath URL; absent claim → null.
const p18 = { entities: { Q42: { claims: { P18: [{ mainsnak: { datavalue: { value: 'Foo Bar.jpg' } } }] } } } };
assert.equal(
  parseWikidataImage(p18, 'Q42'),
  'https://commons.wikimedia.org/wiki/Special:FilePath/Foo%20Bar.jpg?width=480',
);
assert.equal(parseWikidataImage({ entities: { Q42: { claims: {} } } }, 'Q42'), null);
assert.equal(parseWikidataImage({}, 'Q42'), null);

console.log('✓ enrich ok');
