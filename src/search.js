// Client-side POI search: case-insensitive substring match on name only.
// Pure + node-testable; see scripts/check-search.mjs.

// Empty/whitespace query returns [] (no results) rather than the full list —
// keeps an empty search box from showing a results dropdown.
export function searchPOIs(features, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return features.filter((f) => f.properties.name.toLowerCase().includes(q));
}
