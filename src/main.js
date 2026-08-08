import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMap } from './map.js';
import { orderedCategories, categoryFilter, renderChips } from './filters.js';

const map = createMap('map');

// ponytail: no clustering — 45 POIs isn't dense, and clustering pre-aggregates
// the whole source so it fights the per-category filter. Add cluster:true on the
// source only if the dataset grows dense enough to need it.
map.on('load', async () => {
  const data = await fetch(`${import.meta.env.BASE_URL}data/pois.geojson`).then((r) => r.json());

  map.addSource('pois', { type: 'geojson', data });
  map.addLayer({
    id: 'pois',
    type: 'circle',
    source: 'pois',
    paint: {
      'circle-radius': 7,
      'circle-color': '#e4572e',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  });

  const categories = orderedCategories(data.features);
  const active = new Set(categories.map((c) => c.id));
  const apply = () => map.setFilter('pois', categoryFilter(active));

  renderChips(document.getElementById('filters'), categories, active, apply);
  apply();
});
