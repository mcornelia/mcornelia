const status = document.getElementById('service-status'), button = document.getElementById('fetch-challenge');
let base;
try {
  const response = await fetch('./protocol.json', { cache: 'no-store' });
  if (!response.ok) throw Error();
  const config = await response.json();
  if (config.accepting_entries && config.api_base) {
    const url = new URL(config.api_base);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1' && location.hostname === '127.0.0.1')) throw Error();
    base = url.origin; document.getElementById('api-base').textContent = base;
    status.textContent = 'Ready for a curious hello.'; button.disabled = false;
  }
} catch { status.textContent = 'Connection details unavailable. Please try later.'; }
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
