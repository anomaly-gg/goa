/* Keeps phones on the newest version. VERSION + FILES are stamped by ../_dev/deploy_web.py; don't edit those two lines by hand.
   Caches are named "reserve-v-…": /workout and /pantry share this origin and each only deletes its own prefix. */
const VERSION = "reserve-v-2d7b5a69885c";
const FILES = ["./", "css/app.css", "index.html", "js/api.js", "js/app.js", "js/owner.js", "js/pwa.js", "js/usercheck.js", "owner.html"];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache (Pages sends max-age=600) so a new version never mixes in old files
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("reserve-v-") && k !== VERSION).map(k => caches.delete(k))))
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
