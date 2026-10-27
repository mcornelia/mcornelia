// Quiet, synthesized effects: no audio downloads, music, microphone, or network access.
const NOTES = {
  fetch: [
    [392, 0, 0.11, 523],
    [523, 0.12, 0.16, 659],
  ],
  walk: [
    [196, 0, 0.1, 174],
    [220, 0.16, 0.1, 196],
    [247, 0.32, 0.12, 220],
  ],
  treat: [
    [659, 0, 0.12, 784],
    [880, 0.13, 0.19, 880],
  ],
  cuddle: [
    [262, 0, 0.36, 262],
    [330, 0.07, 0.34, 330],
  ],
  couch: [
    [330, 0, 0.27, 262],
    [262, 0.18, 0.32, 220],
  ],
  care: [
    [392, 0, 0.16, 392],
    [494, 0.12, 0.2, 494],
  ],
  ball: [
    [610, 0, 0.08, 940],
    [740, 0.09, 0.13, 430],
  ],
  sleep: [
    [392, 0, 0.28, 330],
    [294, 0.2, 0.48, 196],
  ],
  win: [
    [262, 0, 0.35, 262],
    [330, 0.16, 0.35, 330],
    [392, 0.32, 0.35, 392],
    [523, 0.5, 0.65, 523],
  ],
};

export function createSound({
  enabled = true,
  contextFactory = () => {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Context ? new Context() : null;
  },
  visible = () => !document.hidden,
} = {}) {
  let context = null,
    master = null,
    generation = 0;
  const voices = new Set();
  function stop() {
    generation++;
    for (const voice of voices) {
      try {
        voice.stop();
        voice.disconnect();
      } catch {}
    }
    voices.clear();
  }
  function setEnabled(value) {
    enabled = !!value;
    if (!enabled) stop();
  }
  // Called synchronously inside a user gesture, including on iOS. Never called by polling.
  function unlock() {
    if (!enabled || !visible()) return;
    try {
      if (!context) {
        context = contextFactory();
        if (!context) return;
        master = context.createGain();
        master.gain.value = 0.09;
        master.connect(context.destination);
      }
      if (context.state !== "running") {
        const resumed = context.resume();
        if (resumed?.catch) resumed.catch(() => {});
      }
    } catch {
      context = null;
      master = null;
    }
  }
  function play(name) {
    if (
      !enabled ||
      !visible() ||
      !master ||
      context?.state !== "running" ||
      !Object.hasOwn(NOTES, name)
    )
      return;
    // Replace overlapping cues rather than stacking louder tones during rapid ball taps.
    stop();
    const ticket = generation;
    try {
      for (const [frequency, delay, duration, endFrequency] of NOTES[name]) {
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        const start = context.currentTime + 0.01 + delay,
          end = start + duration;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.45, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, end);
        gain.gain.setValueAtTime(0, end + 0.015);
        oscillator.connect(gain);
        gain.connect(master);
        voices.add(oscillator);
        oscillator.onended = () => {
          voices.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };
        if (ticket !== generation) return;
        oscillator.start(start);
        oscillator.stop(end + 0.02);
      }
    } catch {
      stop();
    } // Audio availability must never affect a game move.
  }
  return {
    unlock,
    play,
    stop,
    setEnabled,
    get enabled() {
      return enabled;
    },
  };
}
