import maplibregl from 'maplibre-gl';

// Single config point for the basemap — swap this to change tile provider.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export function createMap(container) {
  const map = new maplibregl.Map({
    container,
    style: STYLE_URL,
    center: [-6.2603, 53.3498],
    zoom: 13,
  });

  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }),
  );

  return map;
}
