import maplibregl from 'maplibre-gl';

export function initMap(container) {
  const map = new maplibregl.Map({
    container,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [-6.2603, 53.3498],
    zoom: 13,
  });

  map.on('load', async () => {
    // BASE_URL keeps the fetch correct on the /dublin-todo/ project-site path.
    // Never hard-code /data/... — it 404s on a project site.
    const res = await fetch(`${import.meta.env.BASE_URL}data/pois.geojson`);
    const data = await res.json();

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
  });

  return map;
}
