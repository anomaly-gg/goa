// Username check under a username box: "✓ Found" / "Did you mean <tap>?" / "Not found".
// Owner decision 2026-11-05: check only, never autocomplete (see PLAN.md). The server enforces it too.
import { call, esc } from './api.js';

const cache = new Map();          // lowercased input -> result ({ found, username } | { found:false, suggestion })
let enabled = true;               // server says off when no usernames are loaded

async function lookup(u) {
  const k = u.toLowerCase();
  if (cache.has(k)) return cache.get(k);
  const d = await call('/api/check', { method: 'POST', body: { usernames: [u] } });
  enabled = d.enabled;
  const res = d.enabled ? d.results[0] : null;
  if (res) cache.set(k, res);
  return res;
}

export function attachCheck(input, line) {
  let timer, seq = 0;
  const paint = (cls, html) => { line.className = 'ucheck ' + cls; line.innerHTML = html; };
  async function run() {
    clearTimeout(timer);
    const u = input.value.trim(), my = ++seq;
    if (u.length < 3 || !enabled) return paint('', '');
    let r;
    try { r = await lookup(u); } catch { return paint('', ''); }    // offline / rate-limited: the server still checks on submit
    if (my !== seq || !r) return my === seq && paint('', '');
    if (r.found) {
      if (r.username !== u) input.value = r.username;               // fix capitals to the real spelling
      return paint('ok', '✓ Found');
    }
    if (r.suggestion) {
      paint('bad', `Not found. Did you mean <button type="button" class="sug">${esc(r.suggestion)}</button> ?`);
      line.querySelector('.sug').onclick = () => { input.value = r.suggestion; run(); };
      return;
    }
    paint('bad', 'Not found. Check the spelling, or ask at the counter.');
  }
  input.addEventListener('input', () => { clearTimeout(timer); paint('', ''); timer = setTimeout(run, 700); });
  input.addEventListener('blur', run);
  if (input.value.trim()) run();
  return run;
}
