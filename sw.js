/* Keeps phones on the newest version. VERSION + FILES are stamped by ../_dev/deploy_web.py; don't edit those two lines by hand.
   Caches are named "goa-v-…": /workout, /pantry and /reserve (the old URL) share this origin and each only deletes its own prefix. */
const VERSION = "goa-v-543761e254ed";
const FILES = ["./", "css/app.css", "icons/apple-touch-icon.png", "icons/favicon-64.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/owner-apple-touch-icon.png", "icons/owner-favicon-64.png", "icons/owner-icon-192.png", "icons/owner-icon-512.png", "icons/owner-maskable-512.png", "icons/sprite.svg", "icons/wordmark.png", "index.html", "js/account.js", "js/api.js", "js/app.js", "js/hub.js", "js/owner.js", "js/push.js", "js/pwa.js", "js/usercheck.js", "manifest.webmanifest", "owner.html", "owner.webmanifest"];

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

// ---- G4 push alerts (GOA_PLAN.md). The push carries NO text: it only wakes this worker, which collects the queued
// message(s) from the app server with this phone's own push endpoint. A push must always show something (browser rule).
const PUSH_API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:8787" : "https://cafe-reserve.xpropics.workers.dev";
self.addEventListener("push", e => e.waitUntil((async () => {
  let msgs = [];
  try {
    const sub = await self.registration.pushManager.getSubscription();
    const r = await fetch(PUSH_API + "/api/push/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub ? sub.endpoint : "" }) });
    msgs = (await r.json()).messages || [];
  } catch { }
  if (!msgs.length) msgs = [{ title: "NETPIX Goa", body: "Something changed. Open the app to see it.", url: "/", tag: "update" }];
  for (const m of msgs)
    await self.registration.showNotification(m.title, { body: m.body, tag: m.tag || undefined, renotify: !!m.tag, icon: "icons/icon-192.png", badge: "icons/favicon-64.png", data: { url: m.url || "/" } });
})()));

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if (new URL(c.url).origin === location.origin && "focus" in c) return c.navigate(url).then(w => (w || c).focus());
    return self.clients.openWindow(url);
  }));
});
