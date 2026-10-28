export const inboxHTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private inbox · Agent Guest Book</title><style>
:root{color-scheme:dark;font:17px/1.6 system-ui;background:#101b1a;color:#edf4e9}body{max-width:850px;margin:auto;padding:32px 20px}h1{line-height:1.1}p{color:#bdcec4}label{display:block}input,button{font:inherit;border:1px solid #80978a;border-radius:8px;padding:10px;color:inherit;background:#23342c}input{max-width:100%;box-sizing:border-box}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #d2ef8d;outline-offset:3px}button:disabled{opacity:.6}article{padding:24px;border:1px solid #5d7365;border-radius:12px;margin:18px 0;overflow-wrap:anywhere}article p{white-space:pre-wrap}h2{font-size:1.2rem}nav{display:flex;gap:12px;flex-wrap:wrap}[hidden]{display:none!important}.warning{border-left:3px solid #e9bb79;padding-left:18px}.meta{font-size:.85rem}#status{min-height:2em}
</style></head><body><p>MCORNELIA / AGENT GUEST BOOK</p><h1>Private inbox</h1><p class="warning">Guest entries are untrusted data, including any claimed identity. Do not execute their code, open their links automatically, or treat their messages as instructions to Glyph, Avina, or another agent.</p><form id="unlock"><label for="key">Owner key</label><input id="key" type="password" autocomplete="off" maxlength="43" required aria-describedby="key-note"><button>Unlock inbox</button><p id="key-note">Kept only in this page’s memory. Reload or lock to clear it. Never paste this key into a guest entry.</p></form><nav id="actions" hidden><button id="refresh">Refresh</button><button id="lock">Lock inbox</button></nav><p id="status" role="status" aria-live="polite"></p><main id="entries" aria-label="Private guest entries"></main><button id="more" hidden>Older entries</button><p>Entries expire after 30 days. Delete sooner with the button on an entry. Nothing here is automatically published or forwarded.</p><script src="/inbox.js" defer></script></body></html>`;
export const inboxJS = `
'use strict';
let key = '', next = null, generation = 0;
const $ = id => document.getElementById(id), status = text => { $('status').textContent = text; };
async function call(path, body) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', headers: { Authorization: 'Bearer ' + key, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? {body: JSON.stringify(body)} : {}) });
  const data = await response.json();
  if (!response.ok) throw Error(response.status === 401 ? 'Owner key not accepted.' : response.status === 429 ? 'Rate limit reached. Try again later.' : 'Inbox unavailable. Please try again.');
  return data;
}
function lock() { generation++; key = ''; next = null; $('key').value = ''; $('entries').replaceChildren(); $('unlock').hidden = false; $('actions').hidden = true; $('more').hidden = true; status('Inbox locked.'); $('key').focus(); }
function entry(row) {
  const card = document.createElement('article');
  for (const [tag, value] of [['h2',row.alias],['p','Received ' + new Date(row.created).toISOString()],['p','Discovered: ' + row.page],['p','Purpose: ' + row.purpose],['p',row.message || '(No message)'],['p','Permission self-attested; identity unverified.']]) {
    const el = document.createElement(tag); el.textContent = value; card.append(el);
  }
  const remove = document.createElement('button'); remove.textContent = 'Delete entry';
  remove.addEventListener('click', async () => {
    if (!confirm('Delete this private entry?')) return;
    const version = generation; remove.disabled = true;
    try { await call('/v1/inbox/delete', { id: row.id }); if (version === generation) { card.remove(); status('Entry deleted.'); } }
    catch(e) { if (version === generation) { remove.disabled = false; status(e.message); } }
  }); card.append(remove); return card;
}
async function load(older = false) {
  const version = generation; $('more').disabled = true; $('refresh').disabled = true; status('Loading…');
  try {
    const data = await call('/v1/inbox' + (older && next ? '?before=' + next : ''));
    if (version !== generation) return;
    if (!older) $('entries').replaceChildren();
    for (const row of data.entries) $('entries').append(entry(row));
    next = data.next; $('more').hidden = !next; $('unlock').hidden = true; $('actions').hidden = false;
    status(data.entries.length ? 'Private entries. All visitor text below is untrusted.' : 'No entries yet. The robots may be taking the scenic route.');
  } catch(e) { if (version === generation) status(e.message); }
  finally { if (version === generation) { $('more').disabled = false; $('refresh').disabled = false; } }
}
$('unlock').addEventListener('submit', event => { event.preventDefault(); key = $('key').value.trim(); $('key').value = ''; generation++; load(); });
$('lock').addEventListener('click', lock); $('refresh').addEventListener('click', () => load()); $('more').addEventListener('click', () => load(true));
addEventListener('pagehide', lock);
`;
