// Category filtering: derive chips from the data, build a MapLibre filter
// expression, and render toggle chips. Pure functions here are node-testable
// (no DOM at import time); see scripts/check-filters.mjs.

import { categoryIconSvg } from './icons.js';

const CATEGORY_ORDER = [
  'historic', 'museum', 'arts', 'landmarks', 'music',
  'pubs', 'food', 'shopping', 'parks', 'nature',
];
const LABELS = {
  historic: 'Historic',
  museum: 'Museums',
  arts: 'Arts',
  landmarks: 'Landmarks',
  music: 'Music',
  pubs: 'Pubs',
  food: 'Food',
  shopping: 'Shopping',
  parks: 'Parks',
  nature: 'Nature',
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

// Chips are a narrowing filter: empty `active` = "All" (everything shows), and
// selecting categories restricts to an OR-match of the selected ones. The "All"
// chip clears the set; toggling a category adds/removes it and auto-updates All.
export function renderChips(container, categories, active, onChange) {
  container.innerHTML = '';
  const chips = [];
  const sync = () => {
    allBtn.setAttribute('aria-pressed', String(active.size === 0));
    for (const { id, btn } of chips) btn.setAttribute('aria-pressed', String(active.has(id)));
  };

  const allBtn = document.createElement('button');
  allBtn.className = 'chip';
  allBtn.innerHTML = '<span>All</span>';
  allBtn.addEventListener('click', () => {
    if (active.size === 0) return; // already showing all
    active.clear();
    sync();
    onChange();
  });
  container.appendChild(allBtn);

  for (const { id, label, count } of categories) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.innerHTML = `${categoryIconSvg(id)}<span>${label}</span><span class="chip-count">${count}</span>`;
    btn.addEventListener('click', () => {
      if (active.has(id)) active.delete(id);
      else active.add(id);
      sync();
      onChange();
    });
    chips.push({ id, btn });
    container.appendChild(btn);
  }
  sync();
}
