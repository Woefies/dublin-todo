import maplibregl from 'maplibre-gl';

// ponytail: coords approximate (~building-level), refine when POIs move to
// public/data/pois.geojson in Phase 1.
const POIS = {
  type: 'FeatureCollection',
  features: [
    ['trinity-college', 'Trinity College & Book of Kells', -6.2546, 53.3438],
    ['guinness-storehouse', 'Guinness Storehouse', -6.2867, 53.3419],
    ['st-stephens-green', "St Stephen's Green", -6.259, 53.3382],
    ['kilmainham-gaol', 'Kilmainham Gaol', -6.3097, 53.3419],
    ['temple-bar', 'Temple Bar', -6.2647, 53.345],
  ].map(([id, name, lon, lat]) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { id, name },
  })),
};

export function initMap(container) {
  const map = new maplibregl.Map({
    container,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [-6.2603, 53.3498],
    zoom: 13,
  });

  map.on('load', () => {
    map.addSource('pois', { type: 'geojson', data: POIS });
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
  });

  return map;
}
