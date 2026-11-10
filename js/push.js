// Alerts on this phone (GOA_PLAN.md G4): "your account logged in on PC07", "overnight approved", "account locked".
// Drives every [data-push-btn] / [data-push-text] / [data-push-card] on the page, so the Account tab card and the
// "Notify me" link on a pending overnight request are the same switch. The push itself carries no text; sw.js
// collects the message from the app server when it arrives.
import { call } from './api.js';

const tok = () => { try { return localStorage.getItem('cr_token') || ''; } catch { return ''; } };
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let state = 'no-token', note = '';

const TEXT = {
  on: '🔔 On. This phone gets an alert when your account logs in on a PC, and when the owner answers your overnight request.',
  off: 'Get an alert on this phone when your account logs in on a PC, and when the owner answers your overnight request.',
  blocked: 'Alerts are blocked for this app. Allow notifications for it in your browser settings, then come back.',
  unsupported: 'This browser can’t show alerts. Open the app in Chrome.',
  'ios-install': 'On iPhone: tap Share, then “Add to Home Screen”, open the app from there, then turn alerts on.',
};

async function currentSub() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
const keyBytes = k => Uint8Array.from(atob(k.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const auth = () => ({ Authorization: 'Bearer ' + tok() });

async function refresh() {
  if (!tok()) state = 'no-token';
  else if (!supported()) state = isIOS && !installed() ? 'ios-install' : 'unsupported';
  else if (Notification.permission === 'denied') state = 'blocked';
  else {
    const sub = await currentSub().catch(() => null);
    state = sub ? 'on' : 'off';
    // keep the app server in step (a new phone token after re-registering, a subscription it dropped)
    if (sub && !refresh.synced) { refresh.synced = true; call('/api/push/subscribe', { method: 'POST', headers: auth(), body: { endpoint: sub.endpoint } }).catch(() => {}); }
  }
  paint();
}

function paint() {
  for (const c of document.querySelectorAll('[data-push-card]')) c.classList.toggle('hidden', state === 'no-token');
  for (const t of document.querySelectorAll('[data-push-text]')) t.textContent = note || TEXT[state] || '';
  for (const b of document.querySelectorAll('[data-push-btn]')) {
    const compact = 'compact' in b.dataset;
    b.classList.toggle('hidden', !(state === 'off' || (state === 'on' && !compact)));
    b.textContent = state === 'on' ? 'Turn off alerts' : compact ? '🔔 Notify me when the owner answers' : 'TURN ON ALERTS';
  }
}

async function turnOn() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  const { key } = await call('/api/push/key');
  if (!key) throw new Error('Alerts aren’t set up yet. Try again later.');
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await call('/api/push/subscribe', { method: 'POST', headers: auth(), body: { endpoint: sub.endpoint } });
}
async function turnOff() {
  const sub = await currentSub();
  if (sub) await sub.unsubscribe();
  await call('/api/push/unsubscribe', { method: 'POST', headers: auth(), body: {} });
}

document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-push-btn]');
  if (!b) return;
  b.disabled = true; note = '';
  try { if (state === 'on') await turnOff(); else await turnOn(); }
  catch (err) { note = err.message || 'Couldn’t change alerts. Try again.'; }
  b.disabled = false;
  await refresh();
});
// a phone gets its token when it registers (overnight) or links (account): look again then
document.addEventListener('overnight', () => refresh());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
refresh();
