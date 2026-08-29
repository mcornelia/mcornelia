import { PUZZLES } from "./puzzles.mjs";
import {
  WORD_GOAL,
  calculateStats,
  canAddToPath,
  createShareText,
  dateKey,
  evaluateWord,
  getObjectives,
  pointsForWord,
  puzzleIndexForDate,
  scoreWords,
  wordFromPath,
} from "./game-engine.mjs";

const STORAGE_KEY = "ravenwood.dailyFetch.v1";
const DEFAULT_CATCH_DELAY_MS = 2350;
const CELEBRATION_MESSAGES = [
  { lead: "Olive knew you could do it.", tag: "Huck would like the record to show that he supervised." },
  { lead: "Ball acquired. Olive is ecstatic.", tag: "Huck reports that the perimeter remained secure." },
  { lead: "Manager Olive approves this performance.", tag: "Watchdog Huck says everything unfolded exactly as planned." },
  { lead: "Olive rates that fetch an A+.", tag: "Huck has filed an excellent supervision report." },
  { lead: "The ball is back where it belongs.", tag: "Olive thanks her word-finding team; Huck accepts partial credit." },
  { lead: "Excellent work. Olive will handle the celebration.", tag: "Huck will handle the paperwork." },
  { lead: "Olive has officially declared this the best day ever.", tag: "Huck remains professionally composed." },
  { lead: "Orange, blue, and finally found.", tag: "Olive is delighted; Huck says the operation was never in doubt." },
  { lead: "That was championship-level fetching.", tag: "Olive requests an immediate rematch after snack time." },
  { lead: "Search complete. Tail wagging confirmed.", tag: "Huck notes that calm leadership made the difference." },
  { lead: "Olive’s favorite treasure has been recovered.", tag: "Huck monitored from a strategically comfortable position." },
  { lead: "Words found. Ball found. Mission accomplished.", tag: "Olive celebrates while Huck closes the official case file." },
];
const today = new Date();
const todayKey = dateKey(today);
const puzzle = PUZZLES[puzzleIndexForDate(today, PUZZLES.length)];
const letters = puzzle.letters.split("");
const firstPuzzleDate = new Date(2026, 0, 1);
const puzzleNumber = Math.max(1, Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(firstPuzzleDate.getFullYear(), firstPuzzleDate.getMonth(), firstPuzzleDate.getDate())) / 86_400_000) + 1);

const elements = {
  board: document.querySelector("#letter-board"),
  boardWrap: document.querySelector("#board-wrap"),
  pathLines: document.querySelector("#path-lines"),
  currentWord: document.querySelector("#current-word"),
  wordMessage: document.querySelector("#word-message"),
  ribbon: document.querySelector(".word-ribbon"),
  score: document.querySelector("#score"),
  dateLabel: document.querySelector("#date-label"),
  puzzleLabel: document.querySelector("#puzzle-label"),
  wordCount: document.querySelector("#word-count"),
  wordGoal: document.querySelector("#word-goal"),
  longGoal: document.querySelector("#long-goal"),
  secretGoal: document.querySelector("#secret-goal"),
  secretHint: document.querySelector("#secret-hint"),
  hintButton: document.querySelector("#hint-button"),
  foundWords: document.querySelector("#found-words"),
  foundSummary: document.querySelector("#found-summary"),
  clearButton: document.querySelector("#clear-button"),
  submitButton: document.querySelector("#submit-button"),
  soundButton: document.querySelector("#sound-button"),
  helpButton: document.querySelector("#help-button"),
  statsButton: document.querySelector("#stats-button"),
  helpDialog: document.querySelector("#help-dialog"),
  statsDialog: document.querySelector("#stats-dialog"),
  celebrationDialog: document.querySelector("#celebration-dialog"),
  celebrationScene: document.querySelector(".celebration-scene"),
  celebrationLead: document.querySelector("#celebration-lead"),
  celebrationTag: document.querySelector("#celebration-tag"),
  celebrationScore: document.querySelector("#celebration-score"),
  celebrationWords: document.querySelector("#celebration-words"),
  celebrationStreak: document.querySelector("#celebration-streak"),
  statsShare: document.querySelector("#stats-share"),
  celebrationShare: document.querySelector("#celebration-share"),
  celebrationReplay: document.querySelector("#celebration-replay"),
  resetButton: document.querySelector("#reset-button"),
  toast: document.querySelector("#toast"),
  confetti: document.querySelector("#confetti"),
};

function freshStore() {
  return { tutorialSeen: false, soundEnabled: true, soundPreferenceSet: false, days: {} };
}

function loadStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== "object") return freshStore();
    const soundPreferenceSet = stored.soundPreferenceSet === true;
    return {
      tutorialSeen: Boolean(stored.tutorialSeen),
      soundEnabled: soundPreferenceSet ? Boolean(stored.soundEnabled) : true,
      soundPreferenceSet,
      days: stored.days && typeof stored.days === "object" ? stored.days : {},
    };
  } catch {
    return freshStore();
  }
}

let store = loadStore();
const savedDayState = store.days[todayKey];
let dayState = savedDayState?.puzzleId === puzzle.letters
  ? savedDayState
  : { puzzleId: puzzle.letters, foundWords: [], startedAt: new Date().toISOString(), completedAt: null };
dayState.foundWords = [...new Set((dayState.foundWords ?? []).filter((word) => puzzle.words.includes(word)))];
dayState.puzzleId = puzzle.letters;
store.days[todayKey] = dayState;
let selectedPath = [];
let dragState = null;
let messageTimer = null;
let toastTimer = null;
let confettiTimer = null;
let audioContext = null;
let activeSound = null;
let celebrationMessageOffset = 0;

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    audioContext = new AudioContextClass();
  } catch {
    return null;
  }
  return audioContext;
}

function resumeAudio() {
  const context = getAudioContext();
  if (!context) return Promise.resolve(null);
  if (context.state === "suspended") return context.resume().then(() => context).catch(() => null);
  return Promise.resolve(context);
}

function renderSoundPreference() {
  const enabled = Boolean(store.soundEnabled);
  elements.soundButton.setAttribute("aria-pressed", String(enabled));
  elements.soundButton.setAttribute("aria-label", `Turn celebration sound ${enabled ? "off" : "on"}`);
  elements.soundButton.title = `Celebration sound: ${enabled ? "on" : "off"}`;
}

function scheduleTone(context, destination, { frequency, frequencyEnd, start, duration, volume, type = "sine" }) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (frequencyEnd) oscillator.frequency.exponentialRampToValueAtTime(frequencyEnd, start + duration);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(.025, duration / 3));
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .02);
  return oscillator;
}

function createNoiseBuffer(context, duration) {
  const frameCount = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) channel[index] = Math.random() * 2 - 1;
  return buffer;
}

function playReadyChime(context) {
  const master = context.createGain();
  master.gain.value = .16;
  master.connect(context.destination);
  const start = context.currentTime + .025;
  scheduleTone(context, master, { frequency: 660, frequencyEnd: 720, start, duration: .13, volume: .14 });
  scheduleTone(context, master, { frequency: 880, frequencyEnd: 990, start: start + .1, duration: .2, volume: .11 });
  setTimeout(() => master.disconnect(), 450);
}

function catchDelayMs() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const value = getComputedStyle(elements.celebrationScene).getPropertyValue("--catch-delay").trim();
  if (value.endsWith("ms")) return Number.parseFloat(value) || DEFAULT_CATCH_DELAY_MS;
  if (value.endsWith("s")) return (Number.parseFloat(value) || DEFAULT_CATCH_DELAY_MS / 1000) * 1000;
  return DEFAULT_CATCH_DELAY_MS;
}

function stopCelebrationSound() {
  if (!activeSound) return;
  activeSound();
  activeSound = null;
}

function playCelebrationSound(context, delayMs) {
  stopCelebrationSound();
  const master = context.createGain();
  master.gain.value = .19;
  master.connect(context.destination);
  const sources = [];
  const start = context.currentTime + .04;
  const catchTime = start + delayMs / 1000;

  if (delayMs > 200) {
    const whooshDuration = Math.max(.25, delayMs / 1000 - .38);
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const whooshGain = context.createGain();
    noise.buffer = createNoiseBuffer(context, whooshDuration);
    filter.type = "bandpass";
    filter.Q.value = .8;
    filter.frequency.setValueAtTime(420, start + .16);
    filter.frequency.exponentialRampToValueAtTime(1850, start + whooshDuration);
    whooshGain.gain.setValueAtTime(.0001, start + .16);
    whooshGain.gain.exponentialRampToValueAtTime(.07, start + whooshDuration * .58);
    whooshGain.gain.exponentialRampToValueAtTime(.0001, start + whooshDuration);
    noise.connect(filter).connect(whooshGain).connect(master);
    noise.start(start + .16);
    noise.stop(start + whooshDuration + .02);
    sources.push(noise);
  }

  sources.push(scheduleTone(context, master, { frequency: 155, frequencyEnd: 95, start: catchTime, duration: .13, volume: .3, type: "triangle" }));
  sources.push(scheduleTone(context, master, { frequency: 660, frequencyEnd: 990, start: catchTime + .015, duration: .38, volume: .18 }));
  sources.push(scheduleTone(context, master, { frequency: 990, frequencyEnd: 1320, start: catchTime + .11, duration: .48, volume: .11 }));
  sources.push(scheduleTone(context, master, { frequency: 1760, frequencyEnd: 1480, start: catchTime + .29, duration: .16, volume: .055, type: "triangle" }));
  sources.push(scheduleTone(context, master, { frequency: 2210, frequencyEnd: 1840, start: catchTime + .4, duration: .14, volume: .04, type: "triangle" }));

  const stopThisSound = () => {
    sources.forEach((source) => {
      try { source.stop(); } catch { /* The source has already finished. */ }
    });
    master.disconnect();
  };
  activeSound = stopThisSound;
  setTimeout(() => {
    if (activeSound !== stopThisSound) return;
    master.disconnect();
    activeSound = null;
  }, delayMs + 1100);
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    showToast("Progress could not be saved in this browser.");
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function setTrailMessage(message, style = "") {
  clearTimeout(messageTimer);
  elements.wordMessage.textContent = message;
  elements.ribbon.classList.remove("good", "alert", "ball");
  if (style) elements.ribbon.classList.add(style);
  if (style) {
    messageTimer = setTimeout(() => {
      elements.wordMessage.textContent = dayState.completedAt ? "Ball found! Olive is delighted." : "Olive is leading the search.";
      elements.ribbon.classList.remove("good", "alert", "ball");
    }, 2600);
  }
}

function renderBoard() {
  elements.board.innerHTML = "";
  letters.forEach((letter, index) => {
    const tile = document.createElement("button");
    tile.className = "letter-tile";
    tile.type = "button";
    tile.dataset.index = String(index);
    tile.style.setProperty("--tile-index", String(index));
    tile.setAttribute("aria-label", `${letter.toUpperCase()}, row ${Math.floor(index / 4) + 1}, column ${(index % 4) + 1}`);
    tile.innerHTML = `<span>${letter}</span><small class="step" aria-hidden="true"></small>`;
    elements.board.append(tile);
  });
  renderSelection();
}

function renderSelection() {
  const tiles = [...elements.board.querySelectorAll(".letter-tile")];
  tiles.forEach((tile, index) => {
    const step = selectedPath.indexOf(index);
    tile.classList.toggle("selected", step >= 0);
    tile.querySelector(".step").textContent = step >= 0 ? String(step + 1) : "";
    tile.setAttribute("aria-pressed", String(step >= 0));
  });
  const word = wordFromPath(selectedPath, letters);
  elements.currentWord.textContent = word || "Pick a letter";
  requestAnimationFrame(renderPathLines);
}

function renderPathLines() {
  const wrapRect = elements.boardWrap.getBoundingClientRect();
  elements.pathLines.setAttribute("viewBox", `0 0 ${wrapRect.width} ${wrapRect.height}`);
  elements.pathLines.innerHTML = "";
  for (let index = 1; index < selectedPath.length; index += 1) {
    const from = elements.board.querySelector(`[data-index="${selectedPath[index - 1]}"]`).getBoundingClientRect();
    const to = elements.board.querySelector(`[data-index="${selectedPath[index]}"]`).getBoundingClientRect();
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(from.left - wrapRect.left + from.width / 2));
    line.setAttribute("y1", String(from.top - wrapRect.top + from.height / 2));
    line.setAttribute("x2", String(to.left - wrapRect.left + to.width / 2));
    line.setAttribute("y2", String(to.top - wrapRect.top + to.height / 2));
    elements.pathLines.append(line);
  }
}

function clearPath() {
  selectedPath = [];
  renderSelection();
}

function handleTap(index) {
  if (selectedPath.length === 0) {
    selectedPath = [index];
  } else if (selectedPath.at(-1) === index) {
    submitPath();
    return;
  } else if (selectedPath.length > 1 && selectedPath.at(-2) === index) {
    selectedPath.pop();
  } else if (canAddToPath(selectedPath, index)) {
    selectedPath.push(index);
  } else {
    selectedPath = [index];
    setTrailMessage("That starts a new search path.");
  }
  renderSelection();
}

function submitPath() {
  const word = wordFromPath(selectedPath, letters);
  if (!word) {
    setTrailMessage("Pick a letter to start searching.", "alert");
    return;
  }
  const result = evaluateWord({ word, foundWords: dayState.foundWords, acceptedWords: puzzle.words });
  if (!result.accepted) {
    const messages = {
      short: "Olive needs at least 3 letters to follow that scent.",
      duplicate: "Olive already searched that spot.",
      invalid: "Huck sniffed it out. Not in today’s word guide.",
    };
    setTrailMessage(messages[result.reason], "alert");
    clearPath();
    return;
  }

  const previousObjectives = getObjectives(dayState.foundWords, puzzle.secret);
  dayState.foundWords.push(result.word);
  const objectives = getObjectives(dayState.foundWords, puzzle.secret);
  if (result.word === puzzle.secret) {
    setTrailMessage("You found Olive’s ball!", "ball");
  } else if (!previousObjectives.longGoal && objectives.longGoal) {
    setTrailMessage("Long throw achieved. Olive approves.", "good");
  } else {
    const approvals = ["Good find. Olive is getting warmer.", "Huck approves this word.", "Another clue fetched."];
    setTrailMessage(approvals[dayState.foundWords.length % approvals.length], "good");
  }

  let newlyCompleted = false;
  if (objectives.complete && !dayState.completedAt) {
    dayState.completedAt = new Date().toISOString();
    newlyCompleted = true;
  }
  saveStore();
  clearPath();
  renderProgress();
  if (newlyCompleted) stageFirstCelebration();
}

function renderProgress() {
  const objectives = getObjectives(dayState.foundWords, puzzle.secret);
  elements.score.textContent = String(scoreWords(dayState.foundWords));
  elements.wordCount.textContent = String(Math.min(objectives.wordCount, WORD_GOAL));
  elements.wordGoal.classList.toggle("done", objectives.wordGoal);
  elements.longGoal.classList.toggle("done", objectives.longGoal);
  elements.secretGoal.classList.toggle("done", objectives.secretGoal);
  const hintRevealed = Boolean(dayState.hintRevealed);
  elements.secretHint.textContent = objectives.secretGoal
    ? puzzle.secret.toUpperCase()
    : hintRevealed
      ? `Starts with ${puzzle.secret[0].toUpperCase()} · ${puzzle.secret.length} letters`
      : "Ball-word hint hidden";
  elements.hintButton.hidden = objectives.secretGoal;
  elements.hintButton.textContent = hintRevealed ? "Hide hint" : "Show hint";
  elements.hintButton.setAttribute("aria-expanded", String(hintRevealed));
  document.body.classList.toggle("fetch-complete", objectives.complete);

  elements.foundWords.innerHTML = "";
  if (!dayState.foundWords.length) {
    elements.foundWords.innerHTML = '<p class="empty-state">Your good finds will land here.</p>';
    elements.foundSummary.textContent = "None yet";
  } else {
    [...dayState.foundWords].reverse().forEach((word) => {
      const chip = document.createElement("span");
      chip.className = `word-chip${word === puzzle.secret ? " secret" : ""}`;
      chip.innerHTML = `${word}<small>+${pointsForWord(word)}</small>`;
      elements.foundWords.append(chip);
    });
    elements.foundSummary.textContent = `${dayState.foundWords.length} word${dayState.foundWords.length === 1 ? "" : "s"}`;
  }
  renderStats();
}

function renderStats() {
  const stats = calculateStats(store.days, today);
  document.querySelector("#stat-played").textContent = String(stats.played);
  document.querySelector("#stat-completed").textContent = String(stats.completed);
  document.querySelector("#stat-streak").textContent = String(stats.currentStreak);
  document.querySelector("#stat-best").textContent = String(stats.longestStreak);
  elements.celebrationScore.textContent = String(scoreWords(dayState.foundWords));
  elements.celebrationWords.textContent = String(dayState.foundWords.length);
  elements.celebrationStreak.textContent = String(stats.currentStreak);
}

function rotateCelebrationMessage() {
  const messageIndex = (puzzleNumber + celebrationMessageOffset) % CELEBRATION_MESSAGES.length;
  const message = CELEBRATION_MESSAGES[messageIndex];
  elements.celebrationLead.textContent = message.lead;
  elements.celebrationTag.textContent = message.tag;
  celebrationMessageOffset += 1;
}

function makeConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  elements.confetti.innerHTML = "";
  const colors = ["#e7b75a", "#df7547", "#8ba780", "#eee6cb"];
  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty("--color", colors[index % colors.length]);
    piece.style.setProperty("--duration", `${2.5 + Math.random() * 2.2}s`);
    piece.style.setProperty("--delay", `${Math.random() * .8}s`);
    piece.style.setProperty("--start", `${-20 + Math.random() * 40}px`);
    piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    piece.style.setProperty("--rotation", `${Math.random() * 180}deg`);
    elements.confetti.append(piece);
  }
  setTimeout(() => { elements.confetti.innerHTML = ""; }, 5400);
}

function restartSceneAnimation() {
  elements.celebrationScene.classList.remove("playing");
  void elements.celebrationScene.offsetWidth;
  elements.celebrationScene.classList.add("playing");
}

function scheduleCatchFeedback() {
  clearTimeout(confettiTimer);
  elements.confetti.innerHTML = "";
  const delayMs = catchDelayMs();
  confettiTimer = setTimeout(() => {
    if (!elements.celebrationDialog.open) return;
    makeConfetti();
    if (store.soundEnabled && navigator.vibrate) navigator.vibrate([18, 28, 38]);
  }, delayMs);
  if (!store.soundEnabled) return;
  const requestedAt = performance.now();
  void resumeAudio().then((context) => {
    if (!context || !elements.celebrationDialog.open || !store.soundEnabled) return;
    const remainingDelay = Math.max(0, delayMs - (performance.now() - requestedAt));
    playCelebrationSound(context, remainingDelay);
  });
}

function celebrate({ markSeen = false } = {}) {
  renderStats();
  rotateCelebrationMessage();
  if (!elements.celebrationDialog.open) elements.celebrationDialog.showModal();
  elements.celebrationDialog.scrollTop = 0;
  restartSceneAnimation();
  scheduleCatchFeedback();
  if (markSeen && !dayState.celebrationSeenAt) {
    dayState.celebrationSeenAt = new Date().toISOString();
    saveStore();
  }
}

function stageFirstCelebration() {
  document.body.classList.remove("finish-flash");
  void document.body.offsetWidth;
  document.body.classList.add("finish-flash");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => {
    document.body.classList.remove("finish-flash");
    celebrate({ markSeen: true });
  }, reducedMotion ? 50 : 1050);
}

async function shareToday() {
  const stats = calculateStats(store.days, today);
  const text = createShareText({
    dayNumber: puzzleNumber,
    foundWords: dayState.foundWords,
    secret: puzzle.secret,
    completed: Boolean(dayState.completedAt),
    streak: stats.currentStreak,
  });
  try {
    if (navigator.share) {
      await navigator.share({ title: "The Daily Fetch", text });
      return;
    }
    await navigator.clipboard.writeText(text);
    showToast("Today’s fetch copied.");
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Sharing didn’t work this time.");
  }
}

elements.board.addEventListener("pointerdown", (event) => {
  const tile = event.target.closest(".letter-tile");
  if (!tile) return;
  event.preventDefault();
  const index = Number(tile.dataset.index);
  dragState = { pointerId: event.pointerId, startIndex: index, previousPath: [...selectedPath], moved: false };
  selectedPath = [index];
  elements.board.setPointerCapture?.(event.pointerId);
  renderSelection();
});

elements.board.addEventListener("pointermove", (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest(".letter-tile");
  if (!tile || !elements.board.contains(tile)) return;
  const index = Number(tile.dataset.index);
  if (index === selectedPath.at(-1)) return;
  if (selectedPath.length > 1 && index === selectedPath.at(-2)) {
    selectedPath.pop();
    dragState.moved = true;
    renderSelection();
  } else if (canAddToPath(selectedPath, index)) {
    selectedPath.push(index);
    dragState.moved = true;
    renderSelection();
  }
});

function endPointer(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const finishedDrag = dragState;
  dragState = null;
  elements.board.releasePointerCapture?.(event.pointerId);
  if (finishedDrag.moved) {
    submitPath();
  } else {
    selectedPath = finishedDrag.previousPath;
    handleTap(finishedDrag.startIndex);
  }
}

elements.board.addEventListener("pointerup", endPointer);
elements.board.addEventListener("pointercancel", (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  selectedPath = dragState.previousPath;
  dragState = null;
  renderSelection();
});

elements.board.addEventListener("click", (event) => {
  if (event.detail !== 0) return;
  const tile = event.target.closest(".letter-tile");
  if (tile) handleTap(Number(tile.dataset.index));
});

elements.clearButton.addEventListener("click", clearPath);
elements.submitButton.addEventListener("click", submitPath);
elements.hintButton.addEventListener("click", () => {
  dayState.hintRevealed = !dayState.hintRevealed;
  saveStore();
  renderProgress();
});
elements.soundButton.addEventListener("click", () => {
  store.soundEnabled = !store.soundEnabled;
  store.soundPreferenceSet = true;
  saveStore();
  renderSoundPreference();
  if (store.soundEnabled) {
    void resumeAudio().then((context) => {
      if (context && store.soundEnabled) playReadyChime(context);
    });
    showToast("Celebration sound is on.");
  } else {
    stopCelebrationSound();
    if (navigator.vibrate) navigator.vibrate(0);
    showToast("Celebration sound is off.");
  }
});
elements.helpButton.addEventListener("click", () => elements.helpDialog.showModal());
elements.statsButton.addEventListener("click", () => { renderStats(); elements.statsDialog.showModal(); });
elements.statsShare.addEventListener("click", shareToday);
elements.celebrationShare.addEventListener("click", shareToday);
elements.celebrationReplay.addEventListener("click", () => {
  if (store.soundEnabled) void resumeAudio();
  celebrate();
});
elements.resetButton.addEventListener("click", () => {
  if (!confirm("Start today’s fetch over? This removes today’s words and completion.")) return;
  store.days[todayKey] = { puzzleId: puzzle.letters, foundWords: [], startedAt: new Date().toISOString(), completedAt: null };
  dayState = store.days[todayKey];
  saveStore();
  elements.statsDialog.close();
  clearPath();
  renderProgress();
  setTrailMessage("Fresh search. Olive is ready.");
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
  dialog.addEventListener("close", () => {
    if (dialog === elements.celebrationDialog) {
      clearTimeout(confettiTimer);
      stopCelebrationSound();
      if (navigator.vibrate) navigator.vibrate(0);
      elements.celebrationScene.classList.remove("playing");
    }
  });
});

window.addEventListener("resize", renderPathLines);
document.addEventListener("pointerdown", () => {
  if (store.soundEnabled) void resumeAudio();
}, { passive: true });
document.addEventListener("keydown", () => {
  if (store.soundEnabled) void resumeAudio();
});

elements.dateLabel.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(today);
elements.puzzleLabel.textContent = `Today’s search · Fetch #${puzzleNumber}`;
renderSoundPreference();
renderBoard();
renderProgress();
saveStore();
if (dayState.completedAt) {
  setTrailMessage("Ball found! Olive is delighted.");
  if (!dayState.celebrationSeenAt) setTimeout(stageFirstCelebration, 500);
}

if (!store.tutorialSeen) {
  store.tutorialSeen = true;
  saveStore();
  setTimeout(() => elements.helpDialog.showModal(), 450);
}
