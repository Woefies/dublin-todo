// Category marker icons: simple ink line-glyphs rasterized from inline SVG and
// registered with MapLibre so a symbol layer can pick one per POI via
// icon-image. A POI can be in several categories, so primaryCategory() picks one
// by priority for the pin glyph (chips still filter on the full category array).

// Material Symbols (Outlined) glyph paths, viewBox "0 -960 960 960", filled.
// Source: fonts.gstatic.com material symbols. historic=castle, museum=museum,
// parks=park, food=restaurant, pubs=sports_bar, shopping=shopping_bag.
const VIEWBOX = '0 -960 960 960';
const ICONS = {
  historic:
    'M40-120v-480h80v80h80v-320h80v80h80v-80h80v80h80v-80h80v80h80v-80h80v320h80v-80h80v480H560v-120q0-33-23.5-56.5T480-320q-33 0-56.5 23.5T400-240v120H40Zm80-80h200v-40q0-66 47-113t113-47q66 0 113 47t47 113v40h200v-240H680v-240H280v240H120v240Zm240-280h80v-120h-80v120Zm160 0h80v-120h-80v120Zm-40 40Z',
  museum:
    'M80-80v-80h80v-360H80v-80l400-280 400 280v80h-80v360h80v80H80Zm160-80h480-480Zm80-80h80v-160l80 120 80-120v160h80v-280h-80l-80 120-80-120h-80v280Zm400 80v-454L480-782 240-614v454h480Z',
  parks:
    'M558-80H402v-160H120l160-240h-80l280-400 280 400h-80l160 240H558v160ZM270-320h160-76 252-76 160-420Zm0 0h420L530-560h76L480-740 354-560h76L270-320Z',
  food: 'M280-80v-366q-51-14-85.5-56T160-600v-280h80v280h40v-280h80v280h40v-280h80v280q0 56-34.5 98T360-446v366h-80Zm400 0v-320H560v-280q0-83 58.5-141.5T760-880v800h-80Z',
  pubs: 'M320-200h280v-400h-80q-28 0-46 14t-43 41q-20 22-46.5 45.5T320-465v265Zm-80 80v-346q-52-14-86-56t-34-98q0-53 30.5-94t78.5-57q23-48 68.5-78T400-879q35 0 65.5 12t55.5 32q10-2 19-3.5t20-1.5q66 0 113 47t47 113q0 22-5.5 42T698-600h62q33 0 56.5 23.5T840-520v240q0 33-23.5 56.5T760-200h-80v80H240Zm-40-500q0 33 23.5 56.5T280-540q32 0 54.5-21t46.5-47q25-27 56.5-49.5T520-680h120q0-33-23.5-56.5T560-760q-25 0-42 6.5l-17 6.5-31-26q-11-9-28.5-17.5T400-799q-32 0-58.5 17T301-736l-14 30-32 11q-25 8-40 28.5T200-620Zm480 340h80v-240h-80v240Zm-360 80h280-280Z',
  shopping:
    'M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720ZM240-160v-480 480Z',
};

// Priority when a POI has multiple categories. 'historic' is last, so it only
// wins when a POI has no other category (most Dublin POIs are historic anyway —
// the more specific category is the useful glyph).
const PRIORITY = ['museum', 'parks', 'pubs', 'food', 'shopping', 'historic'];

export const CATEGORY_ICON_IDS = Object.keys(ICONS);

// Map-image id for a category's pin. Prefixed so it can't collide with the
// basemap sprite's own image ids (e.g. OpenFreeMap ships a 'museum' sprite —
// an unprefixed 'museum' would make map.hasImage() true and skip our pin).
const PIN_PREFIX = 'pin-';
export const pinImageId = (category) => PIN_PREFIX + category;

export function primaryCategory(categories) {
  return PRIORITY.find((c) => categories.includes(c)) ?? categories[0];
}

// Inline SVG markup for a chip glyph. fill=currentColor so it inherits the
// chip's text color (ink on active lime, muted otherwise). '' for unknown ids.
export function categoryIconSvg(id, size = 15) {
  const d = ICONS[id];
  if (!d) return '';
  return (
    `<svg width="${size}" height="${size}" viewBox="${VIEWBOX}"` +
    ` fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`
  );
}

// A complete pin image: chrome-pink disc + ink glyph, composited so it renders
// as one unit (pins stay whole when overlapping; basemap can't bleed through the
// glyph's open areas). Glyph is placed by mapping the Material viewBox centre
// (480, -480) onto the pin centre (30, 30).
function svgDoc(d) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
    '<circle cx="32" cy="32" r="29" fill="#b4dd3a" stroke="#17252E" stroke-width="3"/>' +
    `<g transform="translate(32,32) scale(0.042) translate(-480,480)" fill="#17252E">` +
    `<path d="${d}"/></g></svg>`
  );
}

// Register every category icon as a map image. Resolves once all are added.
export function addCategoryIcons(map) {
  return Promise.all(
    Object.entries(ICONS).map(
      ([id, inner]) =>
        new Promise((resolve, reject) => {
          // 80px raster at pixelRatio 2 → 40px logical pins (crisp, no clamp).
          const img = new Image(80, 80);
          img.onload = () => {
            const imgId = pinImageId(id);
            if (!map.hasImage(imgId)) map.addImage(imgId, img, { pixelRatio: 2 });
            resolve();
          };
          img.onerror = reject;
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgDoc(inner));
        }),
    ),
  );
}
