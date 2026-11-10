// Account tab (GOA_PLAN.md G3): "is my account logged in somewhere?" + "This isn't me".
// A phone sees this ONLY after being linked from a seat the account is logged in on (the seat's "📱 Phone app" QR opens
// this page with #link=CODE; the code can also be typed). Same phone token as the overnight request (cr_token).
import { call, $, esc } from './api.js';

const TOKEN_KEY = 'cr_token', FLASH_KEY = 'cr_link_flash';
const tok = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const auth = () => (tok() ? { Authorization: 'Bearer ' + tok() } : {});
let acc = null;

// ---------------- linking ----------------
async function link(code) {
  const d = await call('/api/link', { method: 'POST', headers: auth(), body: { code } });
  try { sessionStorage.setItem(FLASH_KEY, `✅ This phone is linked to ${d.username}.`); } catch { }
  if (d.token) { localStorage.setItem(TOKEN_KEY, d.token); location.reload(); return; }   // brand-new phone: app.js reads the token at start
  showFlash(); await load();
}

async function linkFromHash() {
  const m = location.hash.match(/^#link=([A-Za-z0-9-]{8,9})$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search + '#account');
  window.dispatchEvent(new HashChangeEvent('hashchange'));   // hub.js switches to the Account tab
  try { await link(m[1]); }
  catch (e) { flash(e.message, true); }
}

function flash(msg, bad = false) {
  $('#a-flash').textContent = msg;
  $('#a-flash').className = 'note' + (bad ? ' bad' : ' good');
}
function showFlash() {
  let m = null; try { m = sessionStorage.getItem(FLASH_KEY); sessionStorage.removeItem(FLASH_KEY); } catch { }
  if (m) flash(m);
}

$('#a-form').onsubmit = async e => {
  e.preventDefault();
  const btn = $('#a-form button'); btn.disabled = true; $('#a-err').textContent = '';
  try { await link($('#a-code').value); $('#a-code').value = ''; }
  catch (err) { $('#a-err').textContent = err.message; }
  btn.disabled = false;
};

// ---------------- status ----------------
async function load() {
  if (!tok()) { acc = { linked: false }; return render(); }
  try { acc = await call('/api/account', { headers: auth() }); $('#a-gerr').textContent = ''; }
  catch (e) { if (e.status === 401) acc = { linked: false }; else $('#a-gerr').textContent = e.message; }
  render();
}

const timeOf = s => { const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const dayTime = ms => new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function ago(ms) { const s = Math.round((Date.now() - ms) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : dayTime(ms); }

const ALERT_TEXT = {
  pending: pc => `🚨 Sent. Within a minute ${pc} gets logged out and your account is locked.`,
  locked: pc => `🔒 ${pc} was logged out and your account is locked. Every phone was unlinked too. Go to the counter to unlock it and set a new password, then link this phone again.`,
  alerted: () => '📨 The owner was alerted and will check it.',
  gone: () => 'That PC was already logged out. Change your password at the counter to be safe.',
  expired: () => "The cafe didn't answer in time. Message the owner.",
};
const alertText = al => (al.status === 'done' ? (ALERT_TEXT[al.result] || ALERT_TEXT.alerted) : (ALERT_TEXT[al.status] || ALERT_TEXT.expired))(al.pc);

// First tap arms the button with a label saying exactly what will happen; a second tap within `ms` returns true.
function armed(btn, label, idle, ms = 5000) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = idle; return true; }
  btn.dataset.armed = '1'; btn.textContent = label;
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = idle; } }, ms);
  return false;
}
const NOTME_IDLE = 'THIS ISN’T ME';

function render() {
  if (!acc) return;
  const linked = !!acc.linked;
  $('#a-setup').classList.toggle('hidden', linked);
  $('#a-linked').classList.toggle('hidden', !linked);
  paintHome();
  if (!linked) {
    // This phone was unlinked by its own "This isn't me" lock (every phone is): still tell it what happened.
    const al = acc.alert;
    if (al) flash(alertText(al), al.result !== 'locked');
    return;
  }

  const st = acc.status, card = $('#a-status');
  card.className = 'card status acct-' + st.state;
  $('#a-user').textContent = acc.username;
  if (st.state === 'online') {
    $('#a-icon').textContent = '🟠';
    $('#a-title').textContent = `Logged in on ${st.pc}`;
    $('#a-sub').textContent = [st.since ? 'since ' + timeOf(st.since) : '', st.sessionState === 'expired' ? 'out of time' : '', st.more ? `+${st.more} more PC` : ''].filter(Boolean).join(' · ');
  } else if (st.state === 'offline') {
    $('#a-icon').textContent = '🟢';
    $('#a-title').textContent = 'Not logged in anywhere';
    $('#a-sub').textContent = 'If that changes and it isn’t you, you’ll see it here.';
  } else {
    $('#a-icon').textContent = '⚪';
    $('#a-title').textContent = 'Can’t check right now';
    $('#a-sub').textContent = 'The cafe’s computer hasn’t checked in for a few minutes. Try again soon.';
  }
  $('#a-checked').textContent = acc.checkedAt ? 'checked ' + ago(acc.checkedAt) : '';

  // A pending tap shows until the server handles it; a finished one for 30 min only (an old result next to a NEW login misleads).
  const al = acc.alert && (acc.alert.status === 'pending' || Date.now() - acc.alert.created < 30 * 60e3) ? acc.alert : null;
  const alertOpen = al && al.status === 'pending';
  $('#a-alert').classList.toggle('hidden', !al);
  if (al) $('#a-alert').textContent = alertText(al);
  const canPress = st.state === 'online' && !alertOpen;
  $('#a-notme').classList.toggle('hidden', !canPress);
  if (canPress && !$('#a-notme').dataset.armed) $('#a-notme').textContent = NOTME_IDLE;

  $('#a-phones').innerHTML = acc.phones.map(p => {
    const fresh = !p.me && Date.now() - p.created < 48 * 3600e3;
    return `<div class="phone${fresh ? ' new' : ''}"><span>📱 ${p.me ? '<b>This phone</b>' : 'Another phone'}</span>
            <span class="dim small">linked ${esc(dayTime(p.created))}${fresh ? ' <span class="pill pending">NEW</span>' : ''}</span></div>`;
  }).join('');
}

// One line on Home, so the status isn't hidden behind a tab.
function paintHome() {
  const box = $('#h-acct');
  if (!acc || !acc.linked) { box.classList.add('hidden'); return; }
  const st = acc.status;
  box.classList.remove('hidden');
  box.classList.toggle('warnline', st.state === 'online');
  $('#h-acct-text').textContent = st.state === 'online' ? `Your account (${acc.username}) is logged in on ${st.pc}`
    : st.state === 'offline' ? `Your account (${acc.username}) isn’t logged in anywhere` : `Your account (${acc.username}): can’t check right now`;
  $('#h-acct-icon').textContent = st.state === 'online' ? '🟠' : st.state === 'offline' ? '🟢' : '⚪';
}

$('#a-notme').onclick = async () => {
  const b = $('#a-notme');
  if (!armed(b, `TAP AGAIN: LOG ${acc.status.pc} OUT + LOCK MY ACCOUNT`, NOTME_IDLE)) return;
  b.disabled = true;
  try { acc = await call('/api/account/notme', { method: 'POST', headers: auth(), body: {} }); render(); }
  catch (e) { $('#a-gerr').textContent = e.message; }
  b.disabled = false;
};

$('#a-unlink').onclick = async () => {
  if (!armed($('#a-unlink'), 'Tap again to unlink', 'Unlink this phone', 4000)) return;
  try { acc = await call('/api/account/unlink', { method: 'POST', headers: auth(), body: {} }); render(); flash('This phone is no longer linked.'); }
  catch (e) { $('#a-gerr').textContent = e.message; }
};

// Live while visible: every 20 s (the cafe server checks in about once a minute).
setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20e3);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
window.addEventListener('hashchange', () => { if (/^#link=/.test(location.hash)) linkFromHash(); });

showFlash();
linkFromHash().then(load);
