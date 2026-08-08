import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMap } from './map.js';
import { orderedCategories, categoryFilter, renderChips } from './filters.js';
import { searchPOIs } from './search.js';
import { parseHash, buildHash } from './urlstate.js';
import { enrich } from './enrich.js';

const FEE_LABELS = { free: 'Free', paid: 'Paid', unknown: 'Fee unknown' };

const map = createMap('map');

const detail = document.getElementById('detail');
const detailBody = document.getElementById('detail-body');
const detailClose = document.getElementById('detail-close');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

let data = null; // set once the GeoJSON loads; selectPOI no-ops until then
let categoryLabels = new Map();
let lastFocused = null;

// URL hash state, kept live for writeHash(); populated once the layer loads.
let active = new Set();
let allCategoryIds = [];
let selectedId = null;

function writeHash() {
  const center = map.getCenter();
  const hash = buildHash({
    activeIds: active,
    allIds: allCategoryIds,
    sel: selectedId,
    zoom: map.getZoom(),
    center: [center.lat, center.lng],
  });
  history.replaceState(null, '', `#${hash}`);
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function openDetail(feature) {
  const p = feature.properties;
  const labels = p.categories.map((c) => categoryLabels.get(c) ?? c).join(', ');
  const fee = FEE_LABELS[p.fee] ?? FEE_LABELS.unknown;

  detailBody.innerHTML = `
    <h2>${escapeHtml(p.name)}</h2>
    <p class="detail-categories">${escapeHtml(labels)}</p>
    ${p.summary ? `<p>${escapeHtml(p.summary)}</p>` : ''}
    ${p.address ? `<p class="detail-address">${escapeHtml(p.address)}</p>` : ''}
    <p class="fee-badge fee-${p.fee ?? 'unknown'}">${fee}</p>
    ${p.url ? `<p><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Visit website</a></p>` : ''}
    <div class="detail-enrich" aria-live="polite"></div>
  `;

  lastFocused = document.activeElement;
  detail.hidden = false;
  detailClose.focus();

  fillEnrichment(feature);
}

// Lazily add a Wikipedia extract + image to the open panel. Race-guarded: if the
// user selects another POI (or closes) before the fetch resolves, discard it.
async function fillEnrichment(feature) {
  const box = detailBody.querySelector('.detail-enrich');
  box.textContent = 'Loading…';
  const info = await enrich(feature);

  if (selectedId !== feature.properties.id || detail.hidden) return;
  if (!info) {
    box.textContent = '';
    return;
  }
  box.innerHTML = `
    ${info.thumbnail ? `<img src="${escapeHtml(info.thumbnail)}" alt="" />` : ''}
    <p>${escapeHtml(info.extract)}</p>
    <p class="detail-credit"><a href="${escapeHtml(info.url)}" target="_blank" rel="noopener">Read more on Wikipedia</a> · CC BY-SA</p>
  `;
}

function closeDetail() {
  detail.hidden = true;
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
  selectedId = null;
  writeHash();
}

detailClose.addEventListener('click', closeDetail);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !detail.hidden) closeDetail();
});

// Reusable: fly to a POI by id and open its detail panel. Safe no-op if the
// data hasn't loaded yet or the id is unknown (Phase 3b calls this from URL state).
export function selectPOI(id) {
  if (!data) return;
  const feature = data.features.find((f) => f.properties.id === id);
  if (!feature) return;
  const [lon, lat] = feature.geometry.coordinates;
  map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 15) });
  openDetail(feature);
  selectedId = id;
  writeHash();
}

function renderSearchResults(results) {
  searchResults.innerHTML = '';
  for (const f of results) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-result';
    btn.textContent = f.properties.name;
    btn.addEventListener('click', () => {
      selectPOI(f.properties.id);
      searchResults.innerHTML = '';
      searchInput.value = '';
    });
    li.appendChild(btn);
    searchResults.appendChild(li);
  }
}

// ponytail: no clustering — 45 POIs isn't dense, and clustering pre-aggregates
// the whole source so it fights the per-category filter. Add cluster:true on the
// source only if the dataset grows dense enough to need it.
map.on('load', async () => {
  data = await fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then((r) => r.json());

  map.addSource('pois', { type: 'geojson', data });
  map.addLayer({
    id: 'pois',
    type: 'circle',
    source: 'pois',
    paint: {
      // Book-of-Kells gold pins with an ink outline; grow gently with zoom.
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 8],
      'circle-color': '#c8a24a',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#0e1611',
    },
  });

  const categories = orderedCategories(data.features);
  categoryLabels = new Map(categories.map((c) => [c.id, c.label]));
  allCategoryIds = categories.map((c) => c.id);

  const initialHash = parseHash(location.hash);
  active = initialHash.cat
    ? new Set(initialHash.cat.filter((id) => allCategoryIds.includes(id)))
    : new Set(allCategoryIds);

  if (initialHash.c || initialHash.z !== undefined) {
    map.jumpTo({
      ...(initialHash.c ? { center: [initialHash.c[1], initialHash.c[0]] } : {}),
      ...(initialHash.z !== undefined ? { zoom: initialHash.z } : {}),
    });
  }

  const apply = () => {
    map.setFilter('pois', categoryFilter(active));
    writeHash();
  };

  renderChips(document.getElementById('filters'), categories, active, apply);
  apply();

  map.on('click', 'pois', (e) => {
    const feature = e.features[0];
    if (feature) selectPOI(feature.properties.id);
  });
  map.on('mouseenter', 'pois', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'pois', () => {
    map.getCanvas().style.cursor = '';
  });
  map.on('moveend', writeHash);

  searchInput.addEventListener('input', () => {
    renderSearchResults(searchPOIs(data.features, searchInput.value));
  });

  if (initialHash.sel) selectPOI(initialHash.sel);
});
