// NETPIX Goa shell (GOA_PLAN.md G1): bottom tabs + the Home and Cafe tabs. The Overnight tab is app.js, unchanged.
// Home/Cafe need no registration; only Overnight asks for a name + username.
import { call, $, esc } from './api.js';

const TABS = ['home', 'overnight', 'cafe'];
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
  paintInfo(); paintNight();
}
document.addEventListener('overnight', e => { night = e.detail; nightSeen = true; paintNight(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });

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
function telHref(p) { return 'tel:' + p.replace(/[^\d+]/g, ''); }

function paintInfo() {
  if (!home) return;
  const i = home.info;
  // Home
  $('#h-rates').classList.toggle('hidden', !i.rates);
  $('#h-rates-list').innerHTML = ratesHtml(i.rates);
  $('#h-hours').classList.toggle('hidden', !i.hours);
  $('#h-hours').textContent = i.hours ? '🕐 ' + i.hours : '';
  const quick = [];
  if (mapUrl(i)) quick.push(`<a class="qbtn" href="${esc(mapUrl(i))}" target="_blank" rel="noopener"><span>📍</span>Directions</a>`);
  if (i.facebook) quick.push(`<a class="qbtn" href="${esc(i.facebook)}" target="_blank" rel="noopener"><span>💬</span>Message us</a>`);
  if (i.phone) quick.push(`<a class="qbtn" href="${esc(telHref(i.phone))}"><span>📞</span>Call</a>`);
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
  if (i.facebook) contact.push(`<a class="qbtn" href="${esc(i.facebook)}" target="_blank" rel="noopener"><span>💬</span>Facebook page</a>`);
  if (i.phone) contact.push(`<a class="qbtn" href="${esc(telHref(i.phone))}"><span>📞</span>${esc(i.phone)}</a>`);
  $('#c-contact-list').innerHTML = contact.join('');
  $('#c-contact').classList.toggle('hidden', !contact.length);
  $('#c-empty').classList.toggle('hidden', !!(i.rates || i.hours || i.address || i.map || contact.length));
}

load();
