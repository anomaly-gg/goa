// Kill switch for the old service workers at anomaly-gg.github.io/goa and /reserve (the app moved to its own address,
// 2026-11-10). A phone still running an old worker installs this on its next update check; it removes itself + the old
// caches, then reloads the open page, which now comes from the network = the redirect (go.js).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('reserve-v-') || k.startsWith('goa-v-')) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
})()));
