// Owner page: approve / decline overnight requests, copy usernames into the kiosk Overnight tab.
import { call, $, esc } from './api.js';

const KEY = 'cr_owner_key';
const NOTE_PRESETS = ['See you tonight 👍', 'PC ready', 'Full tonight, sorry'];

// A key can arrive once via owner.html#k=... (setup link); store it and wipe it from the address bar.
const hashKey = new URLSearchParams(location.hash.slice(1)).get('k');
if (hashKey) { localStorage.setItem(KEY, hashKey); history.replaceState(null, '', location.pathname + location.search); }
let key = localStorage.getItem(KEY) || '';

const focusId = Number(new URLSearchParams(location.search).get('r')) || 0;
let focusDone = false;
let night = '';          // '' = tonight
let today = '';
let data = null;
let tab = 'pending';
const notes = {};        // per-request note draft

const hdr = () => ({ 'X-Owner-Key': key });

async function load() {
  if (!key) return showKey();
  try {
    data = await call('/api/owner/requests' + (night ? '?night=' + night : ''), { headers: hdr() });
    today = data.today; $('#g-err').textContent = '';
    if (focusId && !focusDone) {
      const r = data.requests.find(x => x.id === focusId);
      if (r) tab = tabOf(r.status);
    }
    render();
  } catch (e) {
    if (e.status === 401) { localStorage.removeItem(KEY); key = ''; showKey('That key is wrong.'); }
    else $('#g-err').textContent = e.message;
  }
}

function showKey(msg = '') {
  $('#v-key').classList.remove('hidden'); $('#v-list').classList.add('hidden');
  $('#k-err').textContent = msg;
}
$('#f-key').onsubmit = e => {
  e.preventDefault();
  key = $('#k-in').value.trim(); localStorage.setItem(KEY, key); load();
};

const tabOf = s => s === 'pending' ? 'pending' : s === 'approved' ? 'approved' : 'other';

function render() {
  $('#v-key').classList.add('hidden'); $('#v-list').classList.remove('hidden');
  const isToday = data.night === today;
  $('#n-label').textContent = (isToday ? 'Tonight · ' : '') + data.nightLabel;
  $('#n-sub').textContent = isToday ? 'resets 6 AM' : 'past night';
  $('#n-next').disabled = isToday;
  $('#add-card').classList.toggle('hidden', !isToday);

  const by = { pending: [], approved: [], other: [] };
  for (const r of data.requests) by[tabOf(r.status)].push(r);
  for (const k of Object.keys(by)) $('#c-' + k).textContent = by[k].length ? `(${by[k].length})` : '';
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === tab);

  const list = by[tab];
  $('#list').innerHTML = list.length ? list.map(card).join('') :
    `<div class="empty">${tab === 'pending' ? 'No one waiting.' : tab === 'approved' ? 'No one approved yet.' : 'Nothing here.'}</div>`;
  wire();

  if (focusId && !focusDone) {
    const el = document.getElementById('req-' + focusId);
    if (el) { el.scrollIntoView({ block: 'center' }); focusDone = true; }
  }
}

function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function card(r) {
  const isToday = data.night === today;
  const users = r.usernames.map(u =>
    `<div class="user"><span>${esc(u)}</span><button data-copy="${esc(u)}">Copy</button></div>`).join('');
  const draft = notes[r.id] ?? r.note ?? '';
  let acts = '';
  if (isToday && r.status === 'pending') {
    acts = `
      <div class="notes">${NOTE_PRESETS.map(n => `<button data-note="${r.id}" data-text="${esc(n)}" class="${draft === n ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>
      <input class="small" data-notein="${r.id}" maxlength="120" placeholder="note to them (optional)" value="${esc(draft)}" style="margin-top:8px;padding:10px 12px;font-size:15px">
      <div class="acts">
        <button class="btn-bad" data-decide="${r.id}" data-s="declined">Decline</button>
        <button class="btn-ok" data-decide="${r.id}" data-s="approved">Approve</button>
      </div>`;
  } else if (isToday && (r.status === 'approved' || r.status === 'declined')) {
    const flip = r.status === 'approved' ? 'declined' : 'approved';
    acts = `<div class="acts"><button class="btn-ghost small" data-decide="${r.id}" data-s="${flip}" data-two="1">
              ${flip === 'declined' ? 'Change to declined' : 'Change to approved'}</button></div>`;
  }
  const block = r.device ? `<button class="link small" data-block="${r.id}" data-b="${r.blocked ? 0 : 1}">${r.blocked ? 'Unblock this phone' : 'Block this phone'}</button>` : '';
  return `
  <div class="card req ${r.id === focusId ? 'hl' : ''}" id="req-${r.id}">
    <div class="top">
      <div><span class="name">${esc(r.name)}</span> ${r.byOwner ? '<span class="dim small">(added by you)</span>' : ''}</div>
      <span class="pill ${r.status}">${r.status.toUpperCase()}</span>
    </div>
    <div class="time">${ago(r.created)} · ${r.usernames.length} PC${r.usernames.length > 1 ? 's' : ''}${r.blocked ? ' · <span style="color:var(--bad)">phone blocked</span>' : ''}</div>
    ${r.note && r.status !== 'pending' ? `<div class="note small">💬 ${esc(r.note)}</div>` : ''}
    <div class="users">${users}</div>
    ${acts}
    <div style="text-align:right">${block}</div>
  </div>`;
}

function wire() {
  for (const b of document.querySelectorAll('[data-copy]')) b.onclick = () => copy(b.dataset.copy, b);
  for (const b of document.querySelectorAll('[data-note]')) b.onclick = () => {
    const id = b.dataset.note; notes[id] = notes[id] === b.dataset.text ? '' : b.dataset.text; render();
  };
  for (const i of document.querySelectorAll('[data-notein]')) i.oninput = () => { notes[i.dataset.notein] = i.value; };
  for (const b of document.querySelectorAll('[data-decide]')) b.onclick = async () => {
    if (b.dataset.two && !confirmTwice(b, 'Tap again to confirm')) return;
    const id = Number(b.dataset.decide);
    await act(b, () => call('/api/owner/decide', { method: 'POST', headers: hdr(), body: { id, status: b.dataset.s, note: notes[id] ?? '' } }));
    delete notes[id];
    toast(b.dataset.s === 'approved' ? '✅ Approved — now add them in the Overnight tab' : 'Declined');
  };
  for (const b of document.querySelectorAll('[data-block]')) b.onclick = async () => {
    if (!confirmTwice(b, b.dataset.b === '1' ? 'Tap again to block' : 'Tap again to unblock')) return;
    await act(b, () => call('/api/owner/block', { method: 'POST', headers: hdr(), body: { id: Number(b.dataset.block), blocked: b.dataset.b === '1' } }));
  };
}

async function act(btn, fn) {
  btn.disabled = true;
  try { await fn(); await load(); } catch (e) { $('#g-err').textContent = e.message; btn.disabled = false; }
}

function confirmTwice(btn, label) {
  if (btn.dataset.armed) { delete btn.dataset.armed; return true; }
  btn.dataset.armed = '1'; const orig = btn.textContent; btn.textContent = label;
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = orig; } }, 4000);
  return false;
}

async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select();
    document.execCommand('copy'); t.remove();
  }
  btn.textContent = 'Copied ✓'; btn.classList.add('done');
  setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1500);
}

let toastTimer;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2600);
}

for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => { tab = b.dataset.tab; render(); };

function shiftNight(days) {
  const base = new Date((night || today) + 'T12:00:00Z');
  base.setUTCDate(base.getUTCDate() + days);
  const k = base.toISOString().slice(0, 10);
  night = k >= today ? '' : k; load();
}
$('#n-prev').onclick = () => shiftNight(-1);
$('#n-next').onclick = () => shiftNight(1);

$('#f-add').onsubmit = async e => {
  e.preventDefault();
  const usernames = $('#a-users').value.split(/[\s,]+/).filter(Boolean);
  const btn = $('#f-add button'); btn.disabled = true; $('#a-err').textContent = '';
  try {
    await call('/api/owner/add', { method: 'POST', headers: hdr(), body: { name: $('#a-name').value, usernames } });
    $('#a-name').value = ''; $('#a-users').value = ''; $('#add-card').open = false;
    tab = 'approved'; await load(); toast('Added to Approved');
  } catch (err) { $('#a-err').textContent = err.message; }
  btn.disabled = false;
};

// Live: refresh every 15 s while visible (skipped while typing a note), and on return to the page.
setInterval(() => {
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  if (document.visibilityState === 'visible' && key && !typing) load();
}, 15000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
load();
