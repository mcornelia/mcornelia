import { API_ORIGIN } from './config.mjs';
import { ACTIONS, PLAYERS, initialState, applyAction, ready, finished } from './engine.mjs';
const $ = id => document.getElementById(id);
const namespace = 'tired-dogs:v1:';
const storage = {
  get(store, key) { try { return store.getItem(namespace + key); } catch { return null; } },
  set(store, key, value) { try { value === null ? store.removeItem(namespace + key) : store.setItem(namespace + key, value); } catch { /* In-memory play remains available. */ } },
};
let token = storage.get(sessionStorage, 'key') || storage.get(localStorage, 'key') || '';
let state = null, player = null, selectedDog = 'Olive', selectedAction = 'walk', busy = false, online = false, pending = null;
let pollTimer, ballTimer, failures = 0, requestEpoch = 0;
const configured = (() => { try { const u = new URL(API_ORIGIN); return u.origin === API_ORIGIN && (u.protocol === 'https:' || u.origin === 'http://127.0.0.1:8787'); } catch { return false; } })();
function notify(message) { $('notice').textContent = message; }
function savePending() { storage.set(sessionStorage, 'pending', pending ? JSON.stringify(pending) : null); }
function accept(data) {
  if (Number.isInteger(data.player)) player = data.player;
  if (data.state && (!state || data.state.version >= state.version)) {
    const changed = state && data.state.version > state.version;
    state = data.state;
    if (state.dogs[selectedDog].asleep) selectedDog = Object.keys(state.dogs).find(name => !state.dogs[name].asleep) || selectedDog;
    if (changed) {
      $('scene').classList.remove('celebrate'); void $('scene').offsetWidth; $('scene').classList.add('celebrate');
      notify(state.journal[0].text);
    }
  }
}
async function request(path, body) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(API_ORIGIN + path, { method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    let data;
    try { data = await response.json(); } catch { throw new Error('The room could not be reached. Please reconnect.'); }
    return { response, data };
  } finally { clearTimeout(timeout); }
}
function renderDogs() {
  const view = state || initialState();
  $('dogs').replaceChildren(...Object.entries(view.dogs).map(([name, dog]) => {
    const card = document.createElement('article'); card.className = 'dog-card';
    const title = document.createElement('div'); title.className = 'dog-title';
    const h = document.createElement('h3'); h.textContent = name;
    const tag = document.createElement('span'); tag.textContent = !state ? 'MEET YOUR PUP' : dog.asleep ? 'DREAMING ☾' : ready(dog) ? 'READY FOR BED' : 'A LITTLE CARE';
    title.append(h, tag); card.append(title);
    if (state) for (const [key, label, target] of [['wiggles','Wiggles',25],['sniffs','Sniffs to do',20],['love','Love',75]]) {
      const met = key === 'love' ? dog[key] >= target : dog[key] <= target;
      const metric = document.createElement('div'); metric.className = 'metric' + (met ? ' met' : '');
      const line = document.createElement('div'); const labelEl = document.createElement('span'); labelEl.textContent = label;
      const value = document.createElement('strong'); value.textContent = `${dog[key]} / 100 ${met ? '✓' : ''}`;
      const meter = document.createElement('meter'); meter.min = 0; meter.max = 100; meter.value = dog[key]; meter.setAttribute('aria-label', `${name}: ${label}, ${dog[key]} of 100. Goal ${key === 'love' ? 'at least' : 'at most'} ${target}.`);
      line.append(labelEl, value); metric.append(line, meter); card.append(metric);
    }
    const hint = document.createElement('p'); hint.className = 'dog-hint';
    hint.textContent = !state ? name === 'Olive' ? 'Small, focused, and very serious about her ball.' : 'A big soft soul with delightfully goofy ideas.' : dog.asleep ? 'Nothing to do. Sweet dreams are underway.' : ready(dog) ? 'All set. A tuck-in is all that’s left.' : 'Bedtime: wiggles ≤25 · sniffs ≤20 · love ≥75';
    card.append(hint); $(name.toLowerCase() + '-art').classList.toggle('asleep', !!state && dog.asleep); return card;
  }));
}
function render() {
  renderDogs(); $('join-panel').hidden = !!state; $('play-panel').hidden = !state; $('journal').hidden = !state; $('jump-actions').hidden = !state;
  $('join').disabled = busy || !configured; $('player-key').disabled = busy || !configured;
  if (!state) return;
  const won = finished(state), myTurn = player === state.turn;
  $('connection').textContent = busy ? 'Checking our evening…' : online ? `Evening synced · You’re ${PLAYERS[player]}` : 'Connection paused · progress saved';
  $('connection').classList.toggle('offline', !online); $('retry').hidden = online && !pending;
  $('move-label').textContent = `EVENING ${state.round} · ${state.moves} LITTLE ACTS OF LOVE`;
  $('evening-label').textContent = won ? 'MISSION VERY COZILY ACCOMPLISHED' : `${PLAYERS[state.turn].toUpperCase()}’S TURN · EVENING ${state.round}`;
  $('jump-actions').textContent = won ? 'Our cozy finish ↓' : myTurn ? 'Your turn · Choose an activity ↓' : `${PLAYERS[state.turn]}’s turn · See our evening ↓`;
  $('turn-title').textContent = won ? 'Mission accomplished.' : myTurn ? 'Your turn, ' + PLAYERS[player] + '.' : `${PLAYERS[state.turn]}’s turn.`;
  $('turn-description').textContent = won ? 'Two contented sighs. Two sleeping pups. You did this together.' : myTurn ? 'What would make this evening a little sweeter?' : 'Take your time. We’ll bring their next little act of love right here.';
  $('scene-caption').textContent = won ? 'The best kind of quiet.' : 'The couch has room for everyone.';
  $('pup-picker').hidden = won; $('activities').hidden = won; $('preview').hidden = won; $('commit').hidden = won; $('next-evening').hidden = !won;
  $('next-evening').disabled = busy || !online || !!pending || state.votes.includes(player);
  $('next-evening').textContent = state.votes.includes(player) ? 'Waiting for your partner’s ready…' : state.votes.length ? 'Join your partner for another evening' : 'Ready for another evening';
  document.querySelectorAll('.pup-choice').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.dog === selectedDog)); button.disabled = busy || state.dogs[button.dataset.dog].asleep; });
  document.querySelectorAll('.activity').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.action === selectedAction)); button.disabled = busy; });
  $('commit').disabled = busy || !online || !myTurn || !!pending;
  $('commit').textContent = pending ? 'Checking your last move…' : busy ? 'Sharing a little love…' : !myTurn ? `Waiting for ${PLAYERS[state.turn]}` : selectedAction === 'walk' ? 'Take a sniff walk together' : `${ACTIONS[selectedAction].title} with ${selectedDog}`;
  if (!won) {
    $('preview').replaceChildren(); const p = document.createElement('p'); p.textContent = ACTIONS[selectedAction].description; $('preview').append(p);
    const next = applyAction(state, selectedAction, selectedDog); const ul = document.createElement('ul');
    for (const name of Object.keys(state.dogs)) {
      const changes = ['wiggles', 'sniffs', 'love'].map(key => [key, next.dogs[name][key] - state.dogs[name][key]]).filter(([,n]) => n).map(([key,n]) => `${n > 0 ? '+' : '−'}${Math.abs(n)} ${key}`);
      if (next.dogs[name].asleep && !state.dogs[name].asleep) changes.push('sweet dreams ☾');
      if (changes.length) { const li = document.createElement('li'); li.textContent = `${name}: ${changes.join(' · ')}`; ul.append(li); }
    }
    $('preview').append(ul);
  }
  $('journal-count').textContent = `${state.moves} turns`;
  $('journal-items').replaceChildren(...state.journal.map(entry => { const li = document.createElement('li'); if (entry.player) { const label = document.createElement('strong'); label.textContent = `${entry.player} · turn ${entry.move}`; li.append(label); } li.append(document.createTextNode(entry.text)); return li; }));
}
function schedule() { clearTimeout(pollTimer); if (token && !document.hidden) pollTimer = setTimeout(sync, Math.min(30000, 2500 * 2 ** failures)); }
async function sync() {
  if (busy || !token || !configured || document.hidden) return;
  const epoch = requestEpoch; busy = true; render();
  try {
    const { response, data } = await request(pending ? '/move' : '/state', pending?.move);
    if (epoch !== requestEpoch) return;
    if (response.status === 401) { leave(); notify('That player key did not open the room. Please try your private key again.'); return; }
    if (response.status >= 500) throw new Error(data.error || 'The room is temporarily unavailable.');
    if (pending) { pending = null; savePending(); }
    accept(data); online = true; failures = 0;
    if (!response.ok) notify(data.error || 'Please reconnect.');
  } catch (error) {
    if (epoch !== requestEpoch) return;
    online = false; failures = Math.min(failures + 1, 4);
    notify(pending ? 'Connection paused. Your move is kept safely for retry; we’ll check it before sending anything new.' : error.name === 'AbortError' ? 'The connection is taking a moment. Your evening is safe.' : error.message);
  } finally { if (epoch === requestEpoch) { busy = false; render(); schedule(); } }
}
function submit(kind) {
  if (busy || pending || !online || !state) return;
  if (kind === 'action' && player !== state.turn) return;
  pending = { move: { id: crypto.randomUUID(), version: state.version, kind, ...(kind === 'action' ? { action: selectedAction, dog: selectedDog } : {}) } };
  savePending(); sync();
}
function leave() {
  requestEpoch++; clearTimeout(pollTimer); token = ''; state = null; player = null; pending = null; busy = false; online = false;
  storage.set(sessionStorage, 'key', null); storage.set(localStorage, 'key', null); savePending(); $('player-key').value = ''; render();
}
$('join-form').addEventListener('submit', event => { event.preventDefault(); token = $('player-key').value.trim(); if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { notify('Please enter the complete private player key.'); return; } storage.set(sessionStorage, 'key', token); storage.set(localStorage, 'key', $('remember').checked ? token : null); $('player-key').value = ''; pending = null; savePending(); sync(); });
for (const [key, action] of Object.entries(ACTIONS)) { const button = document.createElement('button'); button.className = 'activity'; button.dataset.action = key; button.setAttribute('aria-pressed', String(key === selectedAction)); const icon = document.createElement('span'); icon.textContent = action.icon; icon.setAttribute('aria-hidden','true'); button.append(icon,document.createTextNode(action.title)); button.addEventListener('click',() => { selectedAction = key; render(); }); $('activities').append(button); }
document.querySelectorAll('.pup-choice').forEach(button => button.addEventListener('click', () => { selectedDog = button.dataset.dog; render(); }));
$('commit').addEventListener('click', () => submit('action')); $('next-evening').addEventListener('click', () => submit('ready')); $('retry').addEventListener('click', sync); $('leave').addEventListener('click', leave);
$('help').addEventListener('click', () => $('help-dialog').showModal()); $('close-help').addEventListener('click', () => $('help-dialog').close());
let boops = 0;
$('ball').addEventListener('click', () => { clearTimeout(ballTimer); const messages = ['Olive: yes, that is my ball. Thank you for checking.', 'Huck has volunteered to supervise the ball.', 'One priority. Still round.', 'A tiny boop. An enormous amount of joy.']; $('ball-message').textContent = messages[boops++ % messages.length]; $('ball').classList.remove('booped'); void $('ball').offsetWidth; $('ball').classList.add('booped'); ballTimer = setTimeout(() => { $('ball-message').textContent = ''; $('ball').classList.remove('booped'); }, 3500); });
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(pollTimer); else sync(); }); window.addEventListener('online', sync);
if (!configured) { $('setup-message').textContent = 'Your private room is being prepared. Live shared play will open here once hosting is connected.'; token = ''; }
else { $('setup-message').textContent = 'Your key chooses your player automatically. Keep it between you and your partner.'; try { pending = JSON.parse(storage.get(sessionStorage, 'pending')); if (!pending?.move) pending = null; } catch { pending = null; } }
render(); if (token) sync();
