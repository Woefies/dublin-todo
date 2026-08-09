// Per-theme palette for anything MapLibre paints, plus theme resolution and
// persistence. MapLibre paint properties can't read CSS custom properties, so
// the map + marker colors have to live in JS. This module is the single source
// for them; keep each theme's values in sync with that theme's semantic tokens
// in style.css.

export const THEMES = {
  cyanotype: {
    // The map IS the cyanotype print: Prussian land, cyan pool water, pale
    // "exposed" road lines, pale labels. Basemap recolor (retuneBasemap).
    map: {
      bg: '#08304d', // --surface (cyan-900)
      water: '#2e6f97', // --surface-map-water (cyan-600)
      fill: '#08304d', // --surface
      line: '#8fc7e0', // ghost highlight — exposed lines on the plate
      text: '#cfe6f4', // pale paper labels
      halo: '#04192b', // --surface-sunken (cyan-950) plate
    },
    // Pins are luminous photogram marks: pale paper disc, prussian-ink glyph,
    // bright-cyan selected halo.
    marker: {
      disc: '#d6ebf7', // exposed paper white
      glyph: '#062033', // prussian ink
      selected: '#7fc4e6', // --accent-strong-ish (luminous cyan ring)
    },
  },
  // PARKED — Romance (former default). Kept in sync but never selected; the
  // toggle cycles cyanotype ↔ historic. Revive by re-adding to nextTheme +
  // THEME_LABELS and restoring its :root block in style.css.
  romance: {
    // Basemap recolor (retuneBasemap in main.js).
    map: {
      bg: '#e7f1f7', // --surface
      water: '#8fc2dd', // --surface-map-water
      fill: '#e7f1f7', // --surface
      line: '#ffffff', // white lines
      text: '#33474f', // --text-muted
      halo: '#f4fafd', // --surface-raised
    },
    // Composited pins + selected-marker halo.
    marker: {
      disc: '#b4dd3a', // --accent-2 (lime)
      glyph: '#17252e', // --text-on-accent (ink)
      selected: '#f0589f', // --accent (pink)
    },
  },
  historic: {
    // Georgian Dublin: stone land, faded plate-map water, ink labels.
    map: {
      bg: '#e6dcc6', // --surface (stone-200)
      water: '#a7b7bc', // --surface-map-water (slateblue-300)
      fill: '#e6dcc6', // --surface
      line: '#d8cbaf', // stone-300 road engraving
      text: '#514937', // --text-muted (ink-700)
      halo: '#efe7d5', // --surface-raised (stone-100)
    },
    // Pins are brass door-plaques: brass disc, iron glyph, oxblood select halo.
    marker: {
      disc: '#a6813f', // brass-500
      glyph: '#21201b', // iron-900
      selected: '#963c2c', // --accent (oxblood-600)
    },
  },
};

const STORAGE_KEY = 'dublin-todo-theme';
export const DEFAULT_THEME = 'cyanotype';
const THEME_IDS = Object.keys(THEMES);

// Active theme = the data-theme on <html> (the head script sets it before paint),
// falling back to the default.
export function activeTheme() {
  const t = document.documentElement.dataset.theme;
  return THEME_IDS.includes(t) ? t : DEFAULT_THEME;
}

export function palette(theme = activeTheme()) {
  return THEMES[theme] ?? THEMES[DEFAULT_THEME];
}

export function nextTheme(theme = activeTheme()) {
  return theme === 'historic' ? 'cyanotype' : 'historic';
}

// Persist and apply a theme to <html>. Painting the map is the caller's job
// (main.js) since only it holds the map instance.
export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    /* private mode / storage disabled — attribute alone still applies the theme */
  }
}
