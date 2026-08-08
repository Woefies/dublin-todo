// Deep-link URL state: serialize/parse the hash fragment, e.g.
// #cat=pubs,museum&sel=trinity-college&z=15&c=53.3438,-6.2546
// Pure + DOM-free so it's node-testable; see scripts/check-urlstate.mjs.

// hashString -> { cat, sel, z, c }; missing keys are undefined.
export function parseHash(hashString) {
  const raw = (hashString ?? '').replace(/^#/, '');
  const params = new Map(
    raw
      .split('&')
      .filter(Boolean)
      .map((pair) => pair.split('=').map(decodeURIComponent)),
  );
  const result = {};

  const cat = params.get('cat');
  if (cat) result.cat = cat.split(',').filter(Boolean);

  const sel = params.get('sel');
  if (sel) result.sel = sel;

  const z = params.get('z');
  if (z !== undefined && z !== '') result.z = Number(z);

  const c = params.get('c');
  if (c) {
    const [lat, lon] = c.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) result.c = [lat, lon];
  }

  return result;
}

// { activeIds, sel, zoom, center } -> hash string (no leading '#').
// Omits cat when activeIds is empty (empty = "All", everything shown); omits
// sel when falsy.
export function buildHash({ activeIds, sel, zoom, center }) {
  const parts = [];

  const active = [...activeIds];
  if (active.length) parts.push(`cat=${active.map(encodeURIComponent).join(',')}`);

  if (sel) parts.push(`sel=${encodeURIComponent(sel)}`);

  if (zoom !== undefined) parts.push(`z=${Math.round(zoom * 100) / 100}`);

  if (center !== undefined) {
    const [lat, lon] = center;
    parts.push(`c=${Math.round(lat * 1e5) / 1e5},${Math.round(lon * 1e5) / 1e5}`);
  }

  return parts.join('&');
}
