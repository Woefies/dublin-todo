// Category marker icons: simple ink line-glyphs rasterized from inline SVG and
// registered with MapLibre so a symbol layer can pick one per POI via
// icon-image. A POI can be in several categories, so primaryCategory() picks one
// by priority for the pin glyph (chips still filter on the full category array).

// Line-icon interiors (24x24 viewBox). Kept minimal so they read at ~15px.
const ICONS = {
  historic: '<path d="M9 21V8l3-4 3 4v13"/><path d="M9 21h6"/><circle cx="12" cy="11.5" r="1"/>',
  museum:
    '<path d="M4 9l8-5 8 5"/><path d="M6 9v8M10 9v8M14 9v8M18 9v8"/><path d="M4 20h16M5 17h14"/>',
  parks: '<circle cx="12" cy="8" r="5"/><path d="M12 13v8"/>',
  food: '<path d="M8 3v18"/><path d="M6 3v5a2 2 0 0 0 4 0V3"/><path d="M16 3c2 3 2 7 0 9v9"/>',
  pubs: '<path d="M7 8h8v12H7z"/><path d="M15 10h3v5h-3"/><path d="M7 11h8"/>',
  shopping: '<path d="M6 8h12l-1 13H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
};

// Priority order when a POI has multiple categories (most distinctive first).
const PRIORITY = ['historic', 'museum', 'parks', 'pubs', 'food', 'shopping'];

export const CATEGORY_ICON_IDS = Object.keys(ICONS);

export function primaryCategory(categories) {
  return PRIORITY.find((c) => categories.includes(c)) ?? categories[0];
}

function svgDoc(inner) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"' +
    ' fill="none" stroke="#0e1611" stroke-width="2.2" stroke-linecap="round"' +
    ` stroke-linejoin="round">${inner}</svg>`
  );
}

// Register every category icon as a map image. Resolves once all are added.
export function addCategoryIcons(map) {
  return Promise.all(
    Object.entries(ICONS).map(
      ([id, inner]) =>
        new Promise((resolve, reject) => {
          const img = new Image(40, 40);
          img.onload = () => {
            if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
            resolve();
          };
          img.onerror = reject;
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgDoc(inner));
        }),
    ),
  );
}
