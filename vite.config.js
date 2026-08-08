export default {
  base: '/dublin-todo/',
  // ponytail: literal '~' in project path (C:/~sites/) breaks Vite's fs-allow
  // matching; disable strict fs for local dev. Not needed for build/deploy.
  server: { fs: { strict: false } },
};
