// NETPIX Goa shell (GOA_PLAN.md G1): bottom tabs + the Home and Cafe tabs. The Overnight tab is app.js, unchanged.
// Home/Cafe need no registration; only Overnight asks for a name + username.
import { API, call, $, esc, ic } from './api.js';

const TABS = ['home', 'overnight', 'account', 'cafe'];
let home = null;          // last /api/home
let night = null;         // last overnight state from app.js (null = not registered yet)
let nightSeen = false;    // app.js has answered at least once

// ---------------- tabs ----------------
function tabFromHash() { const t = location.hash.slice(1); return TABS.includes(t) ? t : 'home'; }
function showTab() {
  const t = tabFromHash();
  for (const k of TABS) $('#t-' + k).classList.toggle('hidden', k !== t);
  for (const a of document.querySelectorAll('#tabbar a')) a.classList.toggle('on', a.dataset.tab === t);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showTab);
showTab();

// ---------------- data ----------------
async function load() {
  try { home = await call('/api/home'); $('#c-err').textContent = ''; }
  catch (e) { if (!home) $('#c-err').textContent = e.message; }
  paintInfo(); paintNight(); paintLive();
}
document.addEventListener('overnight', e => { night = e.detail; nightSeen = true; paintNight(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
// The free-PC count is live: refresh once a minute while the app is open on screen (the server sends about as often).
setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60e3);

// ---------------- Home: overnight card ----------------
function paintNight() {
  const r = night && night.request;
  const open = night ? night.open : home?.overnight.open;
  const closes = night?.closesAt || home?.overnight.closesAt || '10 PM';
  const opens = night?.opensAt || home?.overnight.opensAt || '6 AM';
  let pill = '', cls = '', sub, btn = 'REQUEST OVERNIGHT';
  if (night && night.blocked) { pill = 'OFF'; cls = 'declined'; sub = 'Overnight requests are off for you. Message the owner.'; btn = 'OPEN'; }
  else if (r && r.status === 'pending') { pill = 'WAITING'; cls = 'pending'; sub = 'The owner has your request. You’ll see the answer here.'; btn = 'SEE REQUEST'; }
  else if (r && r.status === 'approved') { pill = 'APPROVED'; cls = 'approved'; sub = `You're on tonight's overnight list (${night.nightLabel}).`; btn = 'SEE DETAILS'; }
  else if (r && r.status === 'declined') { pill = 'DECLINED'; cls = 'declined'; sub = 'Not approved tonight. You can request again tomorrow.'; btn = 'SEE DETAILS'; }
  else if (open === false) { pill = 'CLOSED'; cls = 'cancelled'; sub = `Requests closed at ${closes}. You can request again from ${opens}.`; btn = 'SEE RULES'; }
  else if (night && !night.canRequest) { pill = ''; sub = "You've used tonight's requests. Try again tomorrow."; btn = 'OPEN'; }
  else sub = `By approval only. Request from home before ${closes}; the owner answers here.`;
  if (!nightSeen && !home) sub = '';
  $('#h-night-pill').className = 'pill ' + cls;
  $('#h-night-pill').textContent = pill;
  $('#h-night-pill').classList.toggle('hidden', !pill);
  $('#h-night-sub').textContent = sub;
  $('#h-night-btn').textContent = btn;
}

// ---------------- Home + Cafe: info ----------------
function ratesHtml(text) {
  return text.split('\n').filter(Boolean).map(line => {
    const m = line.match(/^(.+?)\s*[=:]\s*(.+)$/);
    return m ? `<div class="rate"><span class="amt">${esc(m[1])}</span><span class="dur">${esc(m[2])}</span></div>`
             : `<div class="rate"><span class="dur">${esc(line)}</span></div>`;
  }).join('');
}
const mapUrl = i => i.map || (i.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('NETPIX ' + i.address) : '');
// One button markup for Home's quick row and the Cafe tab's contact row. External links open outside the app.
function linkBtn(icon, label, href) {
  const ext = /^https:/.test(href) ? ' target="_blank" rel="noopener"' : '';
  return `<a class="qbtn" href="${esc(href)}"${ext}>${ic(icon)}${esc(label)}</a>`;
}

function paintInfo() {
  if (!home) return;
  const i = home.info;
  // Home
  $('#h-rates').classList.toggle('hidden', !i.rates);
  $('#h-rates-list').innerHTML = ratesHtml(i.rates);
  $('#h-hours').classList.toggle('hidden', !i.hours);
  $('#h-hours').innerHTML = i.hours ? ic('clock') + esc(i.hours) : '';
  const quick = [];
  if (mapUrl(i)) quick.push(linkBtn('pin', 'Directions', mapUrl(i)));
  if (i.facebook) quick.push(linkBtn('chat', 'Message us', i.facebook));
  $('#h-quick').innerHTML = quick.join('');
  $('#h-quick').classList.toggle('hidden', !quick.length);
  // Cafe tab
  $('#c-rates').classList.toggle('hidden', !i.rates);
  $('#c-rates-list').innerHTML = ratesHtml(i.rates);
  $('#c-hours').classList.toggle('hidden', !i.hours);
  $('#c-hours-text').textContent = i.hours;
  $('#c-where').classList.toggle('hidden', !i.address && !i.map);
  $('#c-address').textContent = i.address;
  $('#c-address').classList.toggle('hidden', !i.address);
  $('#c-map').href = mapUrl(i) || '#';
  const contact = [];
  if (i.facebook) contact.push(linkBtn('chat', 'Facebook page', i.facebook));
  $('#c-contact-list').innerHTML = contact.join('');
  $('#c-contact').classList.toggle('hidden', !contact.length);
  $('#c-empty').classList.toggle('hidden', !!(i.rates || i.hours || i.address || i.map || contact.length || (home.games || []).length));
}

// ---------------- Home + Cafe: live from the cafe server (G2) ----------------
function agoMs(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? 'just now' : m === 1 ? '1 min ago' : m + ' min ago';
}
function shortDate(s) {
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function paintLive() {
  if (!home) return;
  const s = home.seats;
  $('#h-seats').classList.toggle('hidden', !s);
  if (s) {
    $('#h-seats').classList.toggle('full', s.free === 0);
    $('#h-free').textContent = s.free === 0 ? 'Full' : s.free;
    $('#h-meter').style.width = (s.total ? Math.round(100 * s.free / s.total) : 0) + '%';   // the green part = free PCs
    $('#h-of').textContent = s.free === 0 ? ' right now, every PC is in use' : ` of ${s.total} PCs free right now`;
    $('#h-seats-sub').textContent = [s.inUse ? `${s.inUse} in use` : '', s.oos ? `${s.oos} under repair` : '', 'updated ' + agoMs(s.at)].filter(Boolean).join(' · ');
  }
  const news = home.news || [];
  $('#h-news').innerHTML = news.length ? `<h3 class="sec">${ic('news')}News &amp; promos</h3>` + news.map(n => `
    <article class="card post">
      ${n.image ? `<img src="${API}/api/img/${esc(n.image)}" alt="" loading="lazy">` : ''}
      <div class="post-top"><h2>${n.pinned ? '<span class="pin">PINNED</span>' : ''}${esc(n.title)}</h2><span class="dim small">${esc(shortDate(n.createdAt))}</span></div>
      ${n.body ? `<p class="post-body">${esc(n.body)}</p>` : ''}
    </article>`).join('') : '';
  for (const img of document.querySelectorAll('#h-news img')) img.addEventListener('error', () => img.remove());   // no inline handlers (CSP)
  for (const b of document.querySelectorAll('#h-news .post-body')) {
    if (b.scrollHeight > b.clientHeight + 4) { b.classList.add('more'); b.onclick = () => b.classList.replace('more', 'open'); }
  }
  paintGames();
}
function paintGames() {
  const all = home?.games || [];
  $('#c-games').classList.toggle('hidden', !all.length);
  $('#c-games-n').textContent = all.length ? `(${all.length})` : '';
  const q = $('#c-games-q').value.trim().toLowerCase();
  const list = q ? all.filter(g => g.name.toLowerCase().includes(q)) : all;
  const by = {};
  for (const g of list) (by[g.category] = by[g.category] || []).push(g.name);
  $('#c-games-list').innerHTML = list.length
    ? Object.keys(by).sort((a, b) => (/^apps?$/i.test(a) - /^apps?$/i.test(b)) || a.localeCompare(b)).map(c => `<div class="gcat">${esc(c)}</div><div class="gl">${by[c].map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>`).join('')
    : `<div class="empty" style="padding:14px">No game called "${esc(q)}". Ask at the counter.</div>`;
}
$('#c-games-q').addEventListener('input', paintGames);

load();
