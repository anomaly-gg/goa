// Never run inside someone else's page (clickjacking: an invisible frame over "This isn't me" or Approve).
if (window.top !== window.self) { document.documentElement.innerHTML = ''; throw new Error('framed'); }

// Shared API helper. Local dev (python -m http.server 8791) talks to `wrangler dev` on 8787.
export const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? 'http://localhost:8787' : 'https://cafe-reserve.xpropics.workers.dev';

export async function call(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw Object.assign(new Error('No connection. Check your internet and try again.'), { status: 0 }); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
  return data;
}

export const $ = s => document.querySelector(s);
// One icon from icons/sprite.svg, as markup (colour and size follow the text around it; see .ic in app.css).
export const ic = name => `<svg class="ic" aria-hidden="true"><use href="icons/sprite.svg#${name}"/></svg>`;
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
