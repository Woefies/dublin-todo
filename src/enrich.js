// Lazy Wikipedia enrichment for the detail panel. One search-generator API call
// returns the intro extract + thumbnail + resolved title, tolerant of the messy
// POI display names (e.g. "Trinity College & Book of Kells"). Results (incl.
// misses, cached as null) are memoised by POI id. Wikipedia text is CC BY-SA —
// callers must show the returned `url` as a link back to the article.

const API = 'https://en.wikipedia.org/w/api.php';
const cache = new Map();

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
// Extract/thumbnail props shared by the title and search queries.
const EXTRACT_PROPS = {
  prop: 'extracts|pageimages',
  exintro: '1',
  explaintext: '1',
  piprop: 'thumbnail',
  pithumbsize: '320',
};

// Pure: build the API URL. origin=* enables CORS; " Dublin" disambiguates.
export function buildQueryUrl(name) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${name} Dublin`,
    gsrlimit: '1',
    ...EXTRACT_PROPS,
  });
  return `${API}?${params}`;
}

// Pure: extract by exact article title (used once a Wikidata QID resolves to one).
export function buildTitleUrl(title) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    titles: title,
    redirects: '1',
    ...EXTRACT_PROPS,
  });
  return `${API}?${params}`;
}

// Pure: Wikidata call to resolve a QID to its English Wikipedia article title.
export function buildWikidataUrl(qid) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    origin: '*',
    ids: qid,
    props: 'sitelinks',
    sitefilter: 'enwiki',
  });
  return `${WIKIDATA_API}?${params}`;
}

// Pure: pull the enwiki article title out of a wbgetentities response, or null.
export function parseSitelinkTitle(json, qid) {
  return json?.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
}

// Pure: pull the single page out of a query response, or null if none/no text.
export function parseWikiResponse(json) {
  const pages = json?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page || !page.extract) return null;
  return {
    title: page.title,
    extract: page.extract,
    thumbnail: page.thumbnail?.source ?? null,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
  };
}

// Fetch + cache. Never throws — a network/parse failure resolves to null so the
// panel simply shows its base info.
export async function enrich(feature) {
  const id = feature.properties.id;
  if (cache.has(id)) return cache.get(id);

  const p = feature.properties;
  let result = null;
  try {
    // Verified QID → fetch that exact article (no guessing). Otherwise fall back
    // to a name search, but reject a hit whose intro isn't about a Dublin/Ireland
    // place — that's what pulled up "Blackbird" the film for the pub.
    let title = null;
    if (p.wikidata) {
      const wd = await fetch(buildWikidataUrl(p.wikidata));
      if (wd.ok) title = parseSitelinkTitle(await wd.json(), p.wikidata);
    }
    if (title) {
      const res = await fetch(buildTitleUrl(title));
      if (res.ok) result = parseWikiResponse(await res.json());
    } else {
      const res = await fetch(buildQueryUrl(p.wikipedia ?? p.name));
      if (res.ok) {
        const hit = parseWikiResponse(await res.json());
        result = hit && /dublin|ireland/i.test(hit.extract) ? hit : null;
      }
    }
  } catch {
    result = null;
  }
  cache.set(id, result);
  return result;
}
