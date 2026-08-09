import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMap } from './map.js';
import { orderedCategories, renderChips } from './filters.js';
import { searchPOIs } from './search.js';
import { parseHash, buildHash } from './urlstate.js';
import { enrich } from './enrich.js';
import { addCategoryIcons, primaryCategory, pinImageId } from './icons.js';
import { palette, setTheme, nextTheme } from './theme.js';

// Layers that represent clickable POIs — filter + interaction apply to these.
const POI_LAYERS = ['pois'];

const FEE_LABELS = { free: 'Free', paid: 'Paid', unknown: 'Fee unknown' };

// Material Symbol arrow_right_alt, currentColor so it inherits the CTA text ink.
const ARROW_ICON =
  '<svg class="cta-arrow" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">' +
  '<path d="m560-242-43-42 168-168H160v-60h525L516-681l43-42 241 241-240 240Z"/></svg>';

// Material Symbol directions (viewBox 0 -960 960 960), currentColor.
const DIRECTIONS_ICON =
  '<svg class="cta-arrow" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">' +
  '<path d="M320-360h60v-130h184v85l116-115-116-116v86H350q-12.75 0-21.37 8.62Q320-532.75 320-520v160ZM479.95-77Q468-77 456.5-81T437-93L93-437q-8-8-12-19.55t-4-23.5q0-11.95 4-23.45T93-523l344-344q8-8 19.55-12t23.5-4q11.95 0 23.45 4t19.5 12l344 344q8 8 12 19.55t4 23.5q0 11.95-4 23.45T867-437L523-93q-8 8-19.55 12t-23.5 4ZM308-308l172 172 344-344-344-344-344 344 172 172Zm172-172Z"/></svg>';

// Google Maps directions URL to the POI's own coords (geometry is [lon, lat]).
// Universal api=1 form: opens the native app on mobile, web on desktop.
function directionsUrl(feature) {
  const [lon, lat] = feature.geometry.coordinates;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

const map = createMap('map');

const detail = document.getElementById('detail');
const detailBody = document.getElementById('detail-body');
const detailClose = document.getElementById('detail-close');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const themeToggle = document.getElementById('theme-toggle');

const THEME_LABELS = { cyanotype: 'Cyanotype', historic: 'Historic' };

function refreshToggle() {
  const target = nextTheme();
  themeToggle.textContent = `⇄ ${THEME_LABELS[target]}`;
  themeToggle.setAttribute('aria-label', `Switch to ${THEME_LABELS[target]} theme`);
}

// Repaint everything MapLibre owns for the active theme. No-op until the POI
// layers exist — the load handler builds them with the already-active theme.
async function applyMapTheme() {
  if (!map.getLayer('pois')) return;
  retuneBasemap(map);
  await addCategoryIcons(map); // updates pin images in place
  const { marker } = palette();
  map.setPaintProperty('poi-selected', 'circle-color', marker.selected);
  map.setPaintProperty('clusters', 'circle-color', marker.disc);
  map.setPaintProperty('clusters', 'circle-stroke-color', marker.glyph);
  map.setPaintProperty('cluster-count', 'text-color', marker.glyph);
}

themeToggle.addEventListener('click', async () => {
  setTheme(nextTheme());
  refreshToggle();
  await applyMapTheme();
});
refreshToggle();

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
    <div class="detail-actions">
      ${p.url ? `<a class="detail-cta" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Visit website${ARROW_ICON}</a>` : ''}
      <a class="detail-cta detail-cta-directions" href="${escapeHtml(directionsUrl(feature))}" target="_blank" rel="noopener">Directions${DIRECTIONS_ICON}</a>
    </div>
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

// Recolor the OpenFreeMap Liberty basemap to sit in the active theme's palette. Skips
// our own POI layers. Best-effort per layer — a style-schema change upstream
// shouldn't break the whole map.
function retuneBasemap(map) {
  const { map: c } = palette();
  const ownLayers = new Set(['pois', 'poi-selected']);
  // Basemap POI layers to keep (kept visible, icons intact, text recolored) —
  // public-transport stops (bus/rail/tram/Luas) stay useful alongside our pins.
  const keepPoi = new Set(['poi_transit']);
  for (const layer of map.getStyle().layers) {
    if (ownLayers.has(layer.id)) continue;
    try {
      // Hide the basemap's own POI layers entirely (brown Maki icons + white
      // badges + their labels) — our pins are the only POIs shown, except the
      // kept transit layer which falls through to the symbol-styling branch.
      if (layer.id.includes('poi') && !keepPoi.has(layer.id)) {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
        continue;
      }
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', c.bg);
      } else if (layer.id.includes('water')) {
        map.setPaintProperty(
          layer.id,
          layer.type === 'fill' ? 'fill-color' : 'line-color',
          c.water,
        );
      } else if (layer.type === 'fill') {
        map.setPaintProperty(layer.id, 'fill-color', c.fill);
      } else if (layer.type === 'line') {
        map.setPaintProperty(layer.id, 'line-color', c.line);
      } else if (layer.type === 'symbol') {
        map.setPaintProperty(layer.id, 'text-color', c.text);
        map.setPaintProperty(layer.id, 'text-halo-color', c.halo);
        // Hide the basemap's own POI sprite icons (brown Maki glyphs with white
        // halos) so only our pins carry iconography — except kept layers like
        // transit stops, whose icons we want to show.
        if (!keepPoi.has(layer.id)) map.setPaintProperty(layer.id, 'icon-opacity', 0);
      }
    } catch {
      // Some layers don't support the property being set (e.g. no fill-color
      // on a pattern fill) — skip and move on.
    }
  }
}

map.on('load', async () => {
  data = await fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then((r) => r.json());

  await addCategoryIcons(map);
  // Tag each POI with one category for its pin glyph (chips still use the full array).
  for (const f of data.features)
    f.properties.icon = pinImageId(primaryCategory(f.properties.categories));

  // cluster:true pre-aggregates the WHOLE source, so the category filter can't
  // be a layer setFilter (it wouldn't drop pins from clusters — counts would
  // lie). Instead apply() feeds the source only the active features via setData,
  // and MapLibre re-clusters what's left. clusterMaxZoom < selectPOI's fly zoom
  // (15) so a flown-to pin is always unclustered.
  map.addSource('pois', {
    type: 'geojson',
    data,
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 13,
  });
  const { marker } = palette();

  // Selected-marker halo: a lime disc drawn UNDER the pins, so a lime rim shows
  // around the selected pin. Filtered to the selected id (no top-level feature
  // id in this source, so filter on the id property, not feature-state).
  map.addLayer({
    id: 'poi-selected',
    type: 'circle',
    source: 'pois',
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 21, 16, 24],
      'circle-color': marker.selected,
    },
  });

  // Cluster bubbles: one disc per cluster, sized by how many POIs it holds, with
  // the count centred on it. Both filter on point_count (present only on cluster
  // features). Colors track the theme's pin palette (disc + ink), updated in
  // applyMapTheme on theme switch.
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'pois',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': marker.disc,
      'circle-stroke-color': marker.glyph,
      'circle-stroke-width': 3,
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 25, 26],
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'pois',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 13,
    },
    paint: { 'text-color': marker.glyph },
  });

  // Pins: one composited image each (pink disc + ink Material glyph), so pins
  // stay whole when they overlap and the basemap never bleeds through the glyph.
  // Filtered to unclustered features so a pin and its cluster never both draw.
  map.addLayer({
    id: 'pois',
    type: 'symbol',
    source: 'pois',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': 1,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  retuneBasemap(map);

  const categories = orderedCategories(data.features);
  categoryLabels = new Map(categories.map((c) => [c.id, c.label]));
  allCategoryIds = categories.map((c) => c.id);

  const initialHash = parseHash(location.hash);
  // Empty active = "All" (everything shows); a cat in the hash narrows to it.
  active = new Set(
    (initialHash.cat ?? []).filter((id) => allCategoryIds.includes(id)),
  );

  if (initialHash.c || initialHash.z !== undefined) {
    map.jumpTo({
      ...(initialHash.c ? { center: [initialHash.c[1], initialHash.c[0]] } : {}),
      ...(initialHash.z !== undefined ? { zoom: initialHash.z } : {}),
    });
  }

  // Category filter drives the source data (not a layer setFilter) so clustering
  // re-aggregates only the shown POIs. Empty active = "All"; otherwise a POI
  // shows if it has ANY active category.
  const apply = () => {
    const features =
      active.size === 0
        ? data.features
        : data.features.filter((f) =>
            f.properties.categories.some((c) => active.has(c)),
          );
    map.getSource('pois').setData({ type: 'FeatureCollection', features });
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

  // Click a cluster → zoom to the level where it breaks apart.
  map.on('click', 'clusters', async (e) => {
    const [f] = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    if (!f) return;
    const zoom = await map.getSource('pois').getClusterExpansionZoom(f.properties.cluster_id);
    map.easeTo({ center: f.geometry.coordinates, zoom });
  });
  map.on('mouseenter', 'clusters', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = '';
  });

  map.on('moveend', writeHash);

  searchInput.addEventListener('input', () => {
    renderSearchResults(searchPOIs(data.features, searchInput.value), searchInput.value);
  });

  if (initialHash.sel) selectPOI(initialHash.sel);
});
