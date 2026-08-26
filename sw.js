/**
 * SERVICE WORKER
 * --------------
 * Exists for exactly one thing: after the game has been opened once while
 * online, it keeps working when the network drops (mobile phase 4,
 * "feels-installed") -- installing to a home screen and then failing to
 * load the moment a phone loses signal would be worse than not installing
 * at all.
 *
 * STRATEGY: NETWORK-FIRST, EVERYWHERE, ALWAYS -- including the app shell.
 *
 * The obvious PWA pattern is cache-first for the shell (HTML/CSS/JS) and
 * runtime caching for everything else. That is the wrong choice for a
 * project with no build step under active development: this repo has no
 * bundler and no cache-busting filenames, so a cache-first shell would keep
 * serving yesterday's js/main.js after every single edit until a player (or
 * a developer testing in a browser) manually hard-refreshed. Network-first
 * means a normal load always gets the current files whenever the network is
 * up -- which is effectively "no service worker" for anyone with a
 * connection -- and the cache only becomes visible at the one moment it's
 * supposed to: no network at all.
 *
 * Precaching the shell at install time exists ONLY so the very FIRST
 * offline visit (before the player has ever gotten a chance to play online
 * even once) still has something to fall back to. Every later successful
 * online load refreshes that cache anyway, so it can never go stale by more
 * than "however long since you last had a connection."
 *
 * Deliberately NOT precached: terrain/unit sprites, music, sound effects.
 * Those number in the hundreds, some paths are known-missing right now (see
 * main.js's asset loading screen, which already tolerates gaps), and
 * `cache.addAll` aborts entirely if even one request 404s. They're cached
 * opportunistically instead, the same as every other runtime request --
 * whatever a played game actually touched is available offline; nothing
 * else needs to be.
 */

// Bump this string on every deploy that changes a shell file. It's the only
// thing that invalidates the precache -- unrelated to the game's own
// GameConfig.build stamp, which exists for a human to read, not for cache
// invalidation.
const VERSION = "2026-08-26-1";
const SHELL_CACHE = `km-shell-${VERSION}`;

// Exactly the <script src> list index.html loads, plus the handful of
// non-JS files needed to boot to the title screen. Deliberately NOT
// auto-derived from index.html at install time (that would need a fetch and
// a parse before the cache even starts filling) -- kept as a flat list here
// instead, accepting that it needs a manual update if a script is ever
// added or removed from index.html.
const SHELL_FILES = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/style.css",
  "/css/mobile.css",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png",
  "/js/data/config.js",
  "/js/data/sprite-manifests.js",
  "/js/data/races.js",
  "/js/data/race-names.js",
  "/js/data/terrain.js",
  "/js/data/units.js",
  "/js/data/sfx-actions.js",
  "/js/data/sfx-manifest.js",
  "/js/data/unit-names.js",
  "/js/data/quips.js",
  "/js/data/riddles.js",
  "/js/data/techs.js",
  "/js/data/buildings.js",
  "/js/engine/worldgen.js",
  "/js/engine/influence.js",
  "/js/engine/pathfinding.js",
  "/js/engine/cities.js",
  "/js/engine/combat.js",
  "/js/engine/quips.js",
  "/js/engine/floatingtext.js",
  "/js/engine/deathfx.js",
  "/js/engine/tech.js",
  "/js/engine/strategy.js",
  "/js/engine/ai.js",
  "/js/engine/turns.js",
  "/js/engine/orders.js",
  "/js/engine/savegame.js",
  "/js/audio/music.js",
  "/js/audio/sfx.js",
  "/js/ui/motion.js",
  "/js/ui/sprites.js",
  "/js/ui/overlays.js",
  "/js/ui/render.js",
  "/js/ui/clouds.js",
  "/js/ui/villagers.js",
  "/js/ui/render3d.js",
  "/js/ui/sidebar.js",
  "/js/ui/techtree.js",
  "/js/ui/reports.js",
  "/js/ui/knowledgebase.js",
  "/js/ui/dialog.js",
  "/js/ui/fireworks.js",
  "/js/ui/credits.js",
  "/js/ui/buildlist.js",
  "/js/ui/ringmenu.js",
  "/js/ui/input.js",
  "/js/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Individually, not cache.addAll(SHELL_FILES) -- addAll rejects the
      // WHOLE install the instant any single request 404s, and this list is
      // hand-maintained (see its own comment above) so a future drift
      // between it and index.html's real script tags should degrade to "one
      // file missing from the offline fallback," not "the service worker
      // never installs at all."
      Promise.all(SHELL_FILES.map((url) =>
        cache.add(url).catch((err) =>
          console.warn(`sw: failed to precache ${url}`, err))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only same-origin GETs -- POSTs aren't cacheable, and a cross-origin
  // request (there are none in this game today, but never say never) is the
  // requesting page's business, not this worker's.
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    fetch(req).then((res) => {
      // Cache only genuine successes. An error response cached here would
      // mean a later OFFLINE load replays that same failure forever instead
      // of a normal "asset missing" the game already tolerates -- see this
      // file's header on why terrain/audio 404s must never get baked in.
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
