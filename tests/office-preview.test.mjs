import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupOfficePreview } from '../js/office-preview.mjs';

function events(properties = {}) {
  const handlers = new Map();
  return Object.assign({
    addEventListener(name, handler) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(handler);
    },
    emit(name) { for (const handler of handlers.get(name) || []) handler(); }
  }, properties);
}

function fixture({ reduce = false, saveData = false, observer = true } = {}) {
  const doc = events({ hidden: false });
  const button = events({ hidden: true });
  const still = { hidden: true };
  const status = { hidden: true };
  const motion = events({ matches: reduce });
  const connection = events({ saveData });
  const source = events();
  let calls = 0;
  let play = () => { video.paused = false; video.emit('play'); return Promise.resolve(); };
  const video = events({
    paused: true,
    controls: true,
    querySelector: selector => selector === 'source' ? source : null,
    play() { calls += 1; return play(); },
    pause() { this.paused = true; this.emit('pause'); }
  });
  let visibility;
  const env = events({ matchMedia: () => motion, navigator: { connection } });
  if (observer) env.IntersectionObserver = class {
    constructor(callback) { visibility = callback; }
    observe(target) { assert.equal(target, video); }
  };
  const root = { ownerDocument: doc, querySelector: selector => ({
    video, button, img: still, '[role="status"]': status
  })[selector] };
  setupOfficePreview(root, env);
  return {
    doc, video, button, motion, connection, env, still, status, source,
    get calls() { return calls; },
    setPlay: fn => { play = fn; },
    visible: (value, ratio = value ? 1 : 0) => visibility?.([{ isIntersecting: value, intersectionRatio: ratio }])
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('autoplay is silent and waits until at least 25 percent is in view', async () => {
  const f = fixture();
  await settle();
  assert.equal(f.calls, 0);
  assert.equal(f.video.muted, true);
  assert.equal(f.button.hidden, false);
  assert.equal(f.video.controls, false);
  f.visible(true, .1);
  await settle();
  assert.equal(f.calls, 0);
  f.visible(true);
  await settle();
  assert.equal(f.video.paused, false);
  assert.equal(f.button.textContent, 'Pause preview');
  f.visible(false);
  assert.equal(f.video.paused, true);
  f.visible(true);
  await settle();
  assert.equal(f.calls, 2);
});

test('manual pause persists through scrolling and a hidden tab', async () => {
  const f = fixture();
  f.visible(true);
  await settle();
  f.button.emit('click');
  f.visible(false);
  f.visible(true);
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  f.doc.hidden = false;
  f.doc.emit('visibilitychange');
  await settle();
  assert.equal(f.video.paused, true);
  assert.equal(f.calls, 1);
  f.button.emit('click');
  await settle();
  assert.equal(f.video.paused, false);
});

test('tab visibility and page restoration stop and resume the preview', async () => {
  const f = fixture();
  f.visible(true);
  await settle();
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  assert.equal(f.video.paused, true);
  f.doc.hidden = false;
  f.doc.emit('visibilitychange');
  await settle();
  assert.equal(f.video.paused, false);
  f.env.emit('pagehide');
  assert.equal(f.video.paused, true);
  f.env.emit('pageshow');
  await settle();
  assert.equal(f.video.paused, false);
});

for (const preference of ['reduce', 'saveData']) {
  test(`${preference} blocks automatic motion but allows explicit Play`, async () => {
    const f = fixture({ [preference]: true });
    f.visible(true);
    await settle();
    assert.equal(f.calls, 0);
    f.button.emit('click');
    await settle();
    assert.equal(f.video.paused, false);
    assert.equal(f.calls, 1);
  });
}

test('changing a motion or data preference pauses current autoplay', async () => {
  const f = fixture();
  f.visible(true);
  await settle();
  f.motion.matches = true;
  f.motion.emit('change');
  assert.equal(f.video.paused, true);
  f.motion.matches = false;
  f.motion.emit('change');
  await settle();
  f.connection.saveData = true;
  f.connection.emit('change');
  assert.equal(f.video.paused, true);
});

test('rejected autoplay offers Play without a retry loop', async () => {
  const f = fixture();
  f.setPlay(() => Promise.reject(new Error('NotAllowedError')));
  f.visible(true);
  await settle();
  assert.equal(f.button.textContent, 'Play preview');
  assert.equal(f.status.hidden, false);
  f.visible(false);
  f.visible(true);
  f.doc.emit('visibilitychange');
  await settle();
  assert.equal(f.calls, 1);
  f.setPlay(() => { f.video.paused = false; f.video.emit('play'); return Promise.resolve(); });
  f.button.emit('click');
  await settle();
  assert.equal(f.video.paused, false);
  assert.equal(f.status.hidden, true);
});

test('without IntersectionObserver, playback is manual only', async () => {
  const f = fixture({ observer: false });
  f.doc.emit('visibilitychange');
  await settle();
  assert.equal(f.calls, 0);
  f.button.emit('click');
  await settle();
  assert.equal(f.video.paused, false);
});

test('a queued play is cancelled by leaving view before it starts', async () => {
  const f = fixture();
  f.visible(true);
  f.visible(false);
  await settle();
  assert.equal(f.calls, 0);
  assert.equal(f.video.paused, true);
});

test('a late play event cannot restart an offscreen preview', async () => {
  const f = fixture();
  let resolvePlay;
  f.setPlay(() => new Promise(resolve => { resolvePlay = resolve; }));
  f.visible(true);
  await settle();
  f.visible(false);
  f.video.paused = false;
  f.video.emit('play');
  resolvePlay();
  await settle();
  assert.equal(f.video.paused, true);
  assert.equal(f.button.textContent, 'Play preview');
});

test('a late rejection cannot overwrite a newer successful play', async () => {
  const f = fixture();
  let rejectOld;
  f.setPlay(() => new Promise((resolve, reject) => { rejectOld = reject; }));
  f.visible(true);
  await settle();
  f.visible(false);
  f.setPlay(() => { f.video.paused = false; f.video.emit('play'); return Promise.resolve(); });
  f.visible(true);
  await settle();
  rejectOld(new Error('interrupted'));
  await settle();
  assert.equal(f.video.paused, false);
  assert.equal(f.button.textContent, 'Pause preview');
  assert.equal(f.status.hidden, true);
});

test('a media error leaves the poster and explanation, without retries', async () => {
  const f = fixture();
  f.visible(true);
  await settle();
  f.video.emit('error');
  assert.equal(f.video.hidden, true);
  assert.equal(f.still.hidden, false);
  assert.equal(f.button.hidden, true);
  assert.equal(f.status.hidden, false);
  f.visible(true);
  await settle();
  assert.equal(f.calls, 1);
});

test('HTML retains native controls for no-JS and keeps the article click-to-play', () => {
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const article = readFileSync(new URL('../posts/agent-office.html', import.meta.url), 'utf8');
  assert.match(home, /<video[^>]*controls muted playsinline loop preload="none"/);
  assert.match(home, /<\/a>\s*<div class="mc-office-preview"/);
  assert.match(article, /<video controls playsinline preload="metadata"/);
  assert.doesNotMatch(article, /<video[^>]*\bautoplay\b/);
});

test('a source download error also leaves the poster available', async () => {
  const f = fixture();
  f.source.emit('error');
  f.visible(true);
  await settle();
  assert.equal(f.video.hidden, true);
  assert.equal(f.still.hidden, false);
  assert.equal(f.calls, 0);
});
