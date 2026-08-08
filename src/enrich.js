// Lazy Wikipedia enrichment for the detail panel. One search-generator API call
// returns the intro extract + thumbnail + resolved title, tolerant of the messy
// POI display names (e.g. "Trinity College & Book of Kells"). Results (incl.
// misses, cached as null) are memoised by POI id. Wikipedia text is CC BY-SA —
// callers must show the returned `url` as a link back to the article.

const API = 'https://en.wikipedia.org/w/api.php';
const cache = new Map();

// Pure: build the API URL. origin=* enables CORS; " Dublin" disambiguates.
export function buildQueryUrl(name) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${name} Dublin`,
    gsrlimit: '1',
    prop: 'extracts|pageimages',
    exintro: '1',
    explaintext: '1',
    piprop: 'thumbnail',
    pithumbsize: '320',
  });
  return `${API}?${params}`;
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

  let result = null;
  try {
    const name = feature.properties.wikipedia ?? feature.properties.name;
    const res = await fetch(buildQueryUrl(name));
    if (res.ok) result = parseWikiResponse(await res.json());
  } catch {
    result = null;
  }
  cache.set(id, result);
  return result;
}
