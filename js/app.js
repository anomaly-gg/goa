// Customer page: register once -> request overnight -> watch the answer.
import { call, $, esc, ic } from './api.js';
import './pwa.js';
import { attachCheck } from './usercheck.js';

const TOKEN_KEY = 'cr_token';
let token = localStorage.getItem(TOKEN_KEY) || '';
let st = null;                       // last /api/me state
let editingProfile = false;
let pollTimer = null;

const auth = () => ({ Authorization: 'Bearer ' + token });
const views = ['#v-register', '#v-form', '#v-status', '#v-profile'];
function show(id) {
  for (const v of views) $(v).classList.toggle('hidden', v !== id);
  $('#who').classList.toggle('hidden', !st || id === '#v-register' || id === '#v-profile');
  $('#rules').classList.toggle('hidden', id === '#v-profile');
}

// ---------------- load / render ----------------
async function refresh() {
  if (!token) return render();
  try {
    st = await call('/api/me', { headers: auth() });
    $('#g-err').textContent = '';
  } catch (e) {
    if (e.status === 401) { token = ''; localStorage.removeItem(TOKEN_KEY); st = null; }
    else $('#g-err').textContent = e.message;
  }
  render();
}

function render() {
  document.dispatchEvent(new CustomEvent('overnight', { detail: st }));   // hub.js mirrors it on the Home card
  if (!st) { show('#v-register'); return; }
  if (editingProfile) return;
  $('#who-text').textContent = `${st.name} · ${st.username}`;

  const r = st.request;
  const active = r && (r.status === 'pending' || r.status === 'approved' || r.status === 'declined');
  if (st.blocked) return status('block', 'Requests are off', 'Message the owner if you think this is a mistake.', null);
  if (active) return status(...statusText(r), r);
  if (!st.open) return status('lock', 'Requests are closed for tonight', `Overnight requests close at ${st.closesAt}. You can request again from ${st.opensAt}.`, null);
  if (!st.canRequest) return status('moon', "You've used tonight's requests", 'Message the owner, or try again tomorrow.', null);
  showForm();
}

function statusText(r) {
  if (r.status === 'pending')  return ['clock', 'Waiting for the owner', 'This page updates by itself. You can close it and check back later.'];
  if (r.status === 'approved') return ['check', "You're on tonight's overnight list", `Approved for ${st.nightLabel}. Log in at the cafe as usual. Leaving during curfew ends your overnight — you can't log back in until curfew is over.`];
  return ['x', 'Not approved tonight', 'You can request again tomorrow.'];
}

function status(icon, title, sub, r) {
  const cls = r ? r.status : '';
  $('#v-status').className = 'card status ' + cls;
  $('#s-icon').innerHTML = ic(icon);
  $('#s-title').textContent = title;
  $('#s-sub').textContent = sub;
  const note = r && r.note;
  $('#s-note').classList.toggle('hidden', !note);
  $('#s-note').textContent = note ? '💬 ' + note : '';
  $('#s-users').innerHTML = r ? r.usernames.map(u => `<span class="chip">${esc(u)}</span>`).join('') : '';
  $('#s-cancel').classList.toggle('hidden', !(r && (r.status === 'pending' || r.status === 'approved')));
  show('#v-status');
}

// ---------------- request form ----------------
function userRow(value = '') {
  const wrap = document.createElement('div');
  wrap.style.marginBottom = '8px';
  wrap.innerHTML = `<div class="row"><input class="u" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="64" placeholder="friend's cafe username">
                   <button type="button" class="x" aria-label="Remove">✕</button></div><div class="ucheck"></div>`;
  wrap.querySelector('input').value = value;
  wrap.querySelector('.x').onclick = () => { wrap.remove(); syncRows(); };
  attachCheck(wrap.querySelector('input'), wrap.querySelector('.ucheck'));
  return wrap;
}
function syncRows() {
  const rows = $('#f-users').children;
  for (const r of rows) r.querySelector('.x').style.visibility = rows.length > 1 ? 'visible' : 'hidden';
  $('#f-add').classList.toggle('hidden', rows.length >= 10);
  $('#f-send').textContent = rows.length > 1 ? `REQUEST OVERNIGHT (${rows.length} PCs)` : 'REQUEST OVERNIGHT';
}
function showForm() {
  $('#f-night').textContent = `For tonight, ${st.nightLabel}. Request before ${st.closesAt} — the owner gets it right away.`;
  if (!$('#f-users').children.length) { $('#f-users').append(userRow(st.username)); }
  syncRows();
  show('#v-form');
}
$('#f-add').onclick = () => {
  const row = userRow();
  $('#f-users').append(row); syncRows(); row.querySelector('input').focus();
};
$('#f-request').onsubmit = async e => {
  e.preventDefault();
  const usernames = [...document.querySelectorAll('#f-users .u')].map(i => i.value.trim()).filter(Boolean);
  if (!usernames.length) { $('#f-err').textContent = 'Add at least one username.'; return; }
  await busy('#f-send', '#f-err', async () => {
    st = await call('/api/request', { method: 'POST', headers: auth(), body: { usernames } });
    $('#f-users').innerHTML = '';
    render();
  });
};

$('#s-cancel').onclick = async () => {
  const approved = st.request && st.request.status === 'approved';
  if (!confirmTwice($('#s-cancel'), approved ? 'Tap again to give up your approved slot' : 'Tap again to cancel')) return;
  await busy('#s-cancel', '#g-err', async () => {
    st = await call('/api/cancel', { method: 'POST', headers: auth(), body: {} });
    render();
  });
};

// In-page "are you sure" (no browser dialogs): first tap arms, second tap within 4 s confirms.
function confirmTwice(btn, label) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; return true; }
  btn.dataset.orig = btn.textContent; btn.dataset.armed = '1'; btn.textContent = label;
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; } }, 4000);
  return false;
}

// ---------------- register / profile ----------------
attachCheck($('#r-user'), $('#r-check'));
const checkProfileUser = attachCheck($('#p-user'), $('#p-check'));
$('#f-register').onsubmit = async e => {
  e.preventDefault();
  await busy('#f-register button', '#r-err', async () => {
    const d = await call('/api/register', { method: 'POST', body: { name: $('#r-name').value, username: $('#r-user').value } });
    token = d.token; localStorage.setItem(TOKEN_KEY, token);
    await refresh();
  });
};
$('#who-edit').onclick = () => {
  editingProfile = true;
  $('#p-name').value = st.name; $('#p-user').value = st.username; $('#p-err').textContent = '';
  checkProfileUser();
  show('#v-profile');
};
$('#p-back').onclick = () => { editingProfile = false; render(); };
$('#f-profile').onsubmit = async e => {
  e.preventDefault();
  await busy('#f-profile button[type=submit]', '#p-err', async () => {
    st = await call('/api/me', { method: 'PUT', headers: auth(), body: { name: $('#p-name').value, username: $('#p-user').value } });
    editingProfile = false; $('#f-users').innerHTML = ''; render();
  });
};

async function busy(btnSel, errSel, fn) {
  const btn = $(btnSel); $(errSel).textContent = '';
  btn.disabled = true;
  try { await fn(); } catch (e) {
    if (e.status === 401) { token = ''; localStorage.removeItem(TOKEN_KEY); st = null; render(); }
    $(errSel).textContent = e.message;
  } finally { btn.disabled = false; }
}

// ---------------- live updates ----------------
// Poll only while the page is visible and something is waiting on the owner; refresh on return.
function schedule() {
  clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && st && st.request && st.request.status === 'pending' && !editingProfile) refresh();
  }, 10000);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !editingProfile) refresh(); });

schedule();
refresh();
