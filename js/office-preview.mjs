// Progressive enhancement: without JavaScript, the native player still works.
export function setupOfficePreview(root, env = globalThis) {
  const video = root.querySelector('video');
  const button = root.querySelector('button');
  const still = root.querySelector('img');
  const status = root.querySelector('[role="status"]');
  const doc = root.ownerDocument;
  const motion = env.matchMedia?.('(prefers-reduced-motion: reduce)');
  const connection = env.navigator?.connection;
  let inView = false;
  let pageHidden = false;
  let userPaused = false;
  let manualPlay = false;
  let blocked = false;
  let failed = false;
  let pending = false;
  let attempt = 0;

  video.muted = true;
  video.controls = false;
  button.hidden = false;

  function label() {
    button.textContent = pending || !video.paused ? 'Pause preview' : 'Play preview';
  }

  function stop() {
    attempt += 1;
    pending = false;
    video.pause();
    label();
  }

  function permitted() {
    return inView && !doc.hidden && !pageHidden && !userPaused && !failed
      && (manualPlay || (!motion?.matches && !connection?.saveData && !blocked));
  }

  function reconcile() {
    if (!permitted()) { stop(); return; }
    if (pending || !video.paused) return;
    const ticket = ++attempt;
    pending = true;
    label();
    // play() can reject under iOS power-saving or browser autoplay policies.
    Promise.resolve().then(() => {
      if (ticket !== attempt || !permitted()) return;
      return video.play();
    }).then(() => {
      if (ticket !== attempt) return;
      pending = false;
      if (!permitted()) stop();
      label();
    }).catch(() => {
      if (ticket !== attempt) return;
      pending = false;
      blocked = true;
      manualPlay = false;
      status.textContent = 'Preview paused. Press Play to try it.';
      status.hidden = false;
      label();
    });
  }

  button.addEventListener('click', () => {
    if (pending || !video.paused) {
      userPaused = true;
      stop();
    } else {
      userPaused = false;
      manualPlay = true;
      status.hidden = true;
      // A visible button press also works in browsers without IntersectionObserver.
      if (!env.IntersectionObserver) inView = true;
      reconcile();
    }
  });
  video.addEventListener('play', () => {
    // A late play event must not restart an offscreen or explicitly paused preview.
    if (!permitted()) stop();
    else { status.hidden = true; label(); }
  });
  video.addEventListener('pause', label);
  function mediaError() {
    failed = true;
    stop();
    video.hidden = true;
    still.hidden = false;
    button.hidden = true;
    status.textContent = 'The preview is unavailable. The build notes are still open for business.';
    status.hidden = false;
  }
  video.addEventListener('error', mediaError);
  video.querySelector('source')?.addEventListener('error', mediaError);
  doc.addEventListener('visibilitychange', reconcile);
  env.addEventListener('pagehide', () => { pageHidden = true; stop(); });
  env.addEventListener('pageshow', () => { pageHidden = false; reconcile(); });
  const preferenceChanged = () => { manualPlay = false; reconcile(); };
  motion?.addEventListener?.('change', preferenceChanged);
  connection?.addEventListener?.('change', preferenceChanged);

  if (env.IntersectionObserver) {
    const observer = new env.IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .25);
      reconcile();
    }, { threshold: [0, .25] });
    observer.observe(video);
  }
  label();
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-office-preview]').forEach(root => setupOfficePreview(root));
}
