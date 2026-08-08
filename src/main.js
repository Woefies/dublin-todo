import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMap } from './map.js';
import { orderedCategories, categoryFilter, renderChips } from './filters.js';
import { searchPOIs } from './search.js';
import { parseHash, buildHash } from './urlstate.js';
import { enrich } from './enrich.js';
import { addCategoryIcons, primaryCategory } from './icons.js';

// Layers that represent POIs — filter + interaction apply to both.
const POI_LAYERS = ['pois', 'poi-icons'];

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
  box.textContent = 'Reading the record…';
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

// Features have no top-level id (only properties.id), so the selected-marker
// highlight is a property filter on the dedicated poi-selected layer rather
// than feature-state/promoteId. No-ops before the layer exists.
function setSelectedMarker(id) {
  if (!map.getLayer('poi-selected')) return;
  map.setFilter('poi-selected', ['==', ['get', 'id'], id ?? '']);
}

function closeDetail() {
  detail.hidden = true;
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
  selectedId = null;
  setSelectedMarker(null);
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
  setSelectedMarker(id);
  writeHash();
}

function renderSearchResults(results, query) {
  searchResults.innerHTML = '';
  if (results.length === 0 && query.trim()) {
    const li = document.createElement('li');
    li.className = 'search-empty';
    li.textContent = 'No place by that name. Try a street or a landmark.';
    searchResults.appendChild(li);
    return;
  }
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

// Recolor the OpenFreeMap Liberty basemap to sit in the Romance palette. Skips
// our own POI layers. Best-effort per layer — a style-schema change upstream
// shouldn't break the whole map.
function retuneBasemap(map) {
  const ownLayers = new Set(['pois', 'poi-icons', 'poi-selected']);
  for (const layer of map.getStyle().layers) {
    if (ownLayers.has(layer.id)) continue;
    try {
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#E7F1F7');
      } else if (layer.id.includes('water')) {
        map.setPaintProperty(
          layer.id,
          layer.type === 'fill' ? 'fill-color' : 'line-color',
          '#8FC2DD',
        );
      } else if (layer.type === 'fill') {
        map.setPaintProperty(layer.id, 'fill-color', '#E7F1F7');
      } else if (layer.type === 'line') {
        map.setPaintProperty(layer.id, 'line-color', '#FFFFFF');
      } else if (layer.type === 'symbol') {
        map.setPaintProperty(layer.id, 'text-color', '#33474F');
        map.setPaintProperty(layer.id, 'text-halo-color', '#F4FAFD');
      }
    } catch {
      // Some layers don't support the property being set (e.g. no fill-color
      // on a pattern fill) — skip and move on.
    }
  }
}

// ponytail: no clustering — 45 POIs isn't dense, and clustering pre-aggregates
// the whole source so it fights the per-category filter. Add cluster:true on the
// source only if the dataset grows dense enough to need it.
map.on('load', async () => {
  data = await fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then((r) => r.json());

  await addCategoryIcons(map);
  // Tag each POI with one category for its pin glyph (chips still use the full array).
  for (const f of data.features) f.properties.icon = primaryCategory(f.properties.categories);

  map.addSource('pois', { type: 'geojson', data });
  map.addLayer({
    id: 'pois',
    type: 'circle',
    source: 'pois',
    paint: {
      // Chrome-pink disc with an ink outline; grows gently with zoom.
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 9, 16, 12],
      'circle-color': '#F0589F',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#17252E',
    },
  });
  map.addLayer({
    id: 'poi-icons',
    type: 'symbol',
    source: 'pois',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': 0.78,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  // Selected-marker highlight: a lime-ringed, larger duplicate of the poi disc,
  // filtered to the selected id via selectPOI()/closeDetail(). No top-level
  // feature id in this source, so filter on the id property (not feature-state).
  map.addLayer({
    id: 'poi-selected',
    type: 'circle',
    source: 'pois',
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 13, 16, 17],
      'circle-color': '#F0589F',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#B4DD3A',
    },
  });

  retuneBasemap(map);

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
    const f = categoryFilter(active);
    for (const layer of POI_LAYERS) map.setFilter(layer, f);
    writeHash();
  };

  renderChips(document.getElementById('filters'), categories, active, apply);
  apply();

  for (const layer of POI_LAYERS) {
    map.on('click', layer, (e) => {
      const feature = e.features[0];
      if (feature) selectPOI(feature.properties.id);
    });
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = '';
    });
  }
  map.on('moveend', writeHash);

  searchInput.addEventListener('input', () => {
    renderSearchResults(searchPOIs(data.features, searchInput.value), searchInput.value);
  });

  if (initialHash.sel) selectPOI(initialHash.sel);
});
