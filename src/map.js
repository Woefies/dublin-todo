import maplibregl from 'maplibre-gl';

// Single config point for the basemap — swap this to change tile provider.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export function createMap(container) {
  return new maplibregl.Map({
    container,
    style: STYLE_URL,
    center: [-6.2603, 53.3498],
    zoom: 13,
  });
}
