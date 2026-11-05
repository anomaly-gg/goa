// Picks up new versions: registers sw.js (hosted https only, never on the local dev server), switches to a new
// version as soon as it's downloaded, and reloads the page - unless someone is typing, then once they switch away.
const IS_HOSTED = location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

if (IS_HOSTED && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const take = w => w && w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage('skipWaiting');
    });
    if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage('skipWaiting');
    reg.addEventListener('updatefound', () => take(reg.installing));
    // Pages left open (owner phone) check again whenever they come back to the screen.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});

  let pending = false;
  const typing = () => document.activeElement?.matches('input, textarea, select');
  const reload = () => { pending = false; location.reload(); };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (typing()) pending = true; else reload(); });
  // Never reload mid-tap (a submit could be in flight); a switched-away tab is safe.
  document.addEventListener('visibilitychange', () => { if (pending && document.visibilityState === 'hidden') reload(); });
}

// "Add to home screen" button (#install on the page): shown only when the browser offers it (Android Chrome/Edge),
// hidden once installed. iPhones never fire this - they use Share -> Add to Home Screen.
let installPrompt = null;
const installBtn = document.getElementById('install');
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installPrompt = e;
  if (installBtn && !installed()) installBtn.classList.remove('hidden');
});
window.addEventListener('appinstalled', () => { installPrompt = null; installBtn?.classList.add('hidden'); });
if (installBtn) installBtn.onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null; installBtn.classList.add('hidden');
};
