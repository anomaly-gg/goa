/* Keeps phones on the newest version. VERSION + FILES are stamped by ../_dev/deploy_web.py; don't edit those two lines by hand.
   Caches are named "goa-v-…": /workout, /pantry and /reserve (the old URL) share this origin and each only deletes its own prefix. */
const VERSION = "goa-v-df7141d4e162";
const FILES = ["./", "css/app.css", "icons/apple-touch-icon.png", "icons/favicon-64.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/owner-apple-touch-icon.png", "icons/owner-favicon-64.png", "icons/owner-icon-192.png", "icons/owner-icon-512.png", "icons/owner-maskable-512.png", "icons/wordmark.png", "index.html", "js/api.js", "js/app.js", "js/hub.js", "js/owner.js", "js/pwa.js", "js/usercheck.js", "manifest.webmanifest", "owner.html", "owner.webmanifest"];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache (Pages sends max-age=600) so a new version never mixes in old files
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("goa-v-") && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;   // the Worker API always goes to the network
  e.respondWith(
    caches.open(VERSION)
      .then(c => c.match(e.request, { ignoreSearch: true }))
      .then(hit => hit || fetch(e.request))
  );
});
