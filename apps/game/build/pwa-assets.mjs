// Exact files, not extension globs: a new game asset must never enter the offline cache implicitly.
export const PWA_PRECACHE_FILES = [
  "offline.html",
  "images/game-pwa-192x192.png",
  "images/game-pwa-512x512.png",
  "images/game-maskable-icon-512x512.png",
  // The dev environment's install icons (the hatched corner); the manifest names one set per environment.
  "images/game-dev-pwa-192x192.png",
  "images/game-dev-pwa-512x512.png",
  "images/game-dev-maskable-icon-512x512.png",
  "manifest.webmanifest",
];

export const PWA_PRECACHE_BUDGET_BYTES = 12_000_000;
