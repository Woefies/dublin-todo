// Category filtering: derive chips from the data, build a MapLibre filter
// expression, and render toggle chips. Pure functions here are node-testable
// (no DOM at import time); see scripts/check-filters.mjs.

const CATEGORY_ORDER = ['historic', 'museum', 'parks', 'food', 'pubs', 'shopping'];
const LABELS = {
  historic: 'Historic',
  museum: 'Museums',
  parks: 'Parks',
  food: 'Food',
  pubs: 'Pubs',
  shopping: 'Shopping',
};

// [{ id, label, count }] in canonical order; unknown categories appended sorted.
export function orderedCategories(features) {
  const counts = new Map();
  for (const f of features)
    for (const c of f.properties.categories) counts.set(c, (counts.get(c) ?? 0) + 1);

  const known = CATEGORY_ORDER.filter((c) => counts.has(c));
  const extra = [...counts.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
  return [...known, ...extra].map((id) => ({ id, label: LABELS[id] ?? id, count: counts.get(id) }));
}

// OR-match: a POI shows if it has ANY active category. Empty set hides all.
export function categoryFilter(active) {
  if (active.size === 0) return ['boolean', false];
  return ['any', ...[...active].map((c) => ['in', c, ['get', 'categories']])];
}

export function renderChips(container, categories, active, onChange) {
  container.innerHTML = '';
  for (const { id, label, count } of categories) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = `${label} (${count})`;
    btn.setAttribute('aria-pressed', String(active.has(id)));
    btn.addEventListener('click', () => {
      if (active.has(id)) active.delete(id);
      else active.add(id);
      btn.setAttribute('aria-pressed', String(active.has(id)));
      onChange();
    });
    container.appendChild(btn);
  }
}
