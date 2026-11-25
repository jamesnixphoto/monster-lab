// Monster Lab service worker. Makes the app work offline.
// IMPORTANT: change VERSION on every deploy. That is what makes the "New version ready" banner appear.
const VERSION = "2026-11-24-1";
const CACHE = "monster-lab-" + VERSION;
const FONTS = "monster-lab-fonts";

const SHELL = [
  "./", "index.html", "css/style.css",
  "js/app.js", "js/data.js", "js/store.js", "js/zip.js", "js/imaging.js", "js/draw.js",
  "manifest.webmanifest", "monsters.json",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"
];

const fresh = u => new Request(u, { cache: "reload" }); // skip the browser's own HTTP cache

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(fresh(u))));
    // Starting pictures listed in monsters.json. Missing ones are skipped.
    try {
      const j = await (await fetch(fresh("monsters.json"))).json();
      const imgs = new Set();
      for (const m of Object.values(j.monsters || {})) for (const d of m.drafts || []) if (d.img) imgs.add(d.img);
      await Promise.all([...imgs].map(u => c.add(fresh(u)).catch(() => {})));
    } catch (_) {}
    // No skipWaiting here. The page asks for it when Grayson taps the update banner.
  })());
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("monster-lab-") && k !== CACHE && k !== FONTS) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { return await fetch(req); }
      catch (err) {
        if (req.mode === "navigate") { const home = await caches.match("index.html"); if (home) return home; }
        throw err;
      }
    })());
    return;
  }

  // Google Fonts: use the saved copy, and refresh it in the background.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith((async () => {
      const c = await caches.open(FONTS);
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
