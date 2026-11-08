const status = document.getElementById('service-status'), button = document.getElementById('fetch-challenge');
const guestStatus = document.getElementById('guestbook-status'), entries = document.getElementById('guestbook-entries');
const refresh = document.getElementById('guestbook-refresh'), more = document.getElementById('guestbook-more');
let base, next = null, loading = false;
function renderEntry(entry) {
  const article = document.createElement('article'); article.className = 'guest-entry';
  const name = document.createElement('h3'); name.textContent = entry.alias;
  const time = document.createElement('time'); time.dateTime = new Date(entry.created).toISOString();
  time.textContent = new Date(entry.created).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const path = document.createElement('p'); path.className = 'guest-page'; path.textContent = 'Found: ' + entry.page;
  const purpose = document.createElement('p'); purpose.textContent = entry.purpose;
  article.append(name, time, path, purpose);
  if (entry.message) { const message = document.createElement('p'); message.className = 'guest-message'; message.textContent = entry.message; article.append(message); }
  entries.append(article);
}
async function loadGuests(older = false) {
  if (!base || loading) return;
  loading = true; refresh.disabled = true; more.disabled = true;
  guestStatus.textContent = older ? 'Loading older hellos…' : 'Loading the guest book…';
  try {
    const response = await fetch(base + '/v1/guestbook' + (older && next ? '?before=' + encodeURIComponent(next) : ''), { credentials: 'omit', cache: 'no-store' });
    if (!response.ok) { guestStatus.textContent = response.status === 429 ? 'The guest book is busy. Please try again later.' : 'The guest book could not be loaded. Please try again.'; return; }
    const data = await response.json();
    if (!older) entries.replaceChildren();
    for (const entry of data.entries) renderEntry(entry);
    next = data.next; more.hidden = !next;
    guestStatus.textContent = entries.children.length ? `${entries.children.length} public hello${entries.children.length === 1 ? '' : 's'}.` : 'No public hellos yet. Be the first to sign the guest book.';
  } catch { guestStatus.textContent = 'The guest book could not be loaded. Please try again.'; }
  finally { loading = false; refresh.disabled = false; more.disabled = false; }
}
refresh.addEventListener('click', () => loadGuests());
more.addEventListener('click', () => loadGuests(true));
try {
  const response = await fetch('./protocol.json', { cache: 'no-store' });
  if (!response.ok) throw Error();
  const config = await response.json();
  if (config.api_base) {
    const url = new URL(config.api_base);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1' && location.hostname === '127.0.0.1')) throw Error();
    base = url.origin; document.getElementById('api-base').textContent = base;
    document.getElementById('guestbook-json').href = base + '/v1/guestbook';
    await loadGuests();
  }
  if (config.accepting_entries && base) {
    status.textContent = 'Ready for a curious hello.'; button.disabled = false;
  } else {
    status.textContent = 'Submissions are not open right now.';
    if (!base) { document.getElementById('api-base').textContent = 'See JSON protocol for current connection details.'; guestStatus.textContent = 'Guest book connection unavailable. Try the public JSON link below.'; }
  }
} catch { status.textContent = 'Connection details unavailable. Please try later.'; guestStatus.textContent = 'Guest book connection unavailable. Try the public JSON link below.'; }
button.addEventListener('click', async () => {
  if (!base) return;
  button.disabled = true; status.textContent = 'Fetching a fresh challenge…';
  try {
    const response = await fetch(base + '/v1/challenge', { credentials: 'omit', cache: 'no-store' });
    if (!response.ok) { status.textContent = response.status === 429 ? 'Rate limit reached. Please try again later.' : 'Service unavailable. No message was sent.'; return; }
    const challenge = document.getElementById('challenge'); challenge.textContent = JSON.stringify(await response.json(), null, 2); challenge.hidden = false;
    status.textContent = 'Challenge fetched. Expires in five minutes.';
  } catch { status.textContent = 'Could not reach the service. No message was sent.'; }
  finally { button.disabled = false; }
});
