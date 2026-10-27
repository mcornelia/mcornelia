export const PLAYERS = ['Mike', 'Aimee'];
export const ACTIONS = {
  fetch: { title: 'A little fetch', icon: '◉', description: 'Spend wiggles, share joy. The other pup gets a little excited.' },
  walk: { title: 'A sniff walk', icon: '❧', description: 'Both pups stretch their legs and read the neighborhood news.' },
  treat: { title: 'A tiny treat', icon: '✧', description: 'A happy little boost. Delicious, but a bit exciting.' },
  cuddle: { title: 'Cuddle time', icon: '♡', description: 'Fill the love tank and soften the wiggles.' },
  couch: { title: 'Tuck in', icon: '☾', description: 'Ready pups fall asleep. Otherwise, a cozy practice snuggle.' },
};
export const ready = dog => dog.wiggles <= 25 && dog.sniffs <= 20 && dog.love >= 75;
export const finished = state => Object.values(state.dogs).every(dog => dog.asleep);
export function initialState(round = 1, version = 0) {
  return { version, round, turn: (round - 1) % 2, moves: 0, votes: [],
    dogs: { Olive: { wiggles: 75, sniffs: 65, love: 35, asleep: false }, Huck: { wiggles: 60, sniffs: 80, love: 40, asleep: false } },
    journal: [{ text: 'The evening is yours. Two good dogs. One very inviting couch.' }] };
}
const clamp = n => Math.max(0, Math.min(100, n));
function change(dog, wiggles, sniffs, love) {
  if (dog.asleep) return;
  dog.wiggles = clamp(dog.wiggles + wiggles);
  dog.sniffs = clamp(dog.sniffs + sniffs);
  dog.love = clamp(dog.love + love);
}
export function applyAction(state, action, dogName) {
  if (!Object.hasOwn(ACTIONS, action) || !Object.hasOwn(state.dogs, dogName)) throw new Error('Choose a pup and an activity.');
  if (finished(state)) throw new Error('Both pups are already dreaming.');
  if (action !== 'walk' && state.dogs[dogName].asleep) throw new Error(`${dogName} is sleeping peacefully.`);
  const next = structuredClone(state);
  const dog = next.dogs[dogName];
  const other = next.dogs[dogName === 'Olive' ? 'Huck' : 'Olive'];
  let story;
  switch (action) {
    case 'fetch':
      change(dog, dogName === 'Olive' ? -28 : -22, -8, 8); change(other, 5, 0, 0);
      story = dogName === 'Olive' ? 'Olive returns the ball. Her expression says: excellent work, humans.' : 'Huck takes the scenic route back. With the ball. Eventually.'; break;
    case 'walk':
      Object.values(next.dogs).forEach(d => change(d, -16, -28, 4));
      story = 'A slow sniff walk. Every leaf has a story; Huck reads the footnotes.'; break;
    case 'treat': change(dog, 8, -15, 22); story = `${dogName} accepts a tiny treat with enormous gratitude.`; break;
    case 'cuddle': change(dog, -10, 0, 26); story = dogName === 'Olive' ? 'Olive leans into a cuddle. The ball remains within reach.' : 'Huck folds his enormous self into a surprisingly small cuddle.'; break;
    case 'couch':
      if (ready(dog)) { dog.asleep = true; story = `${dogName} gives one long sigh… and drifts off. Goodnight, sweet pup.`; }
      else { change(dog, -8, 0, 10); story = `${dogName} tries the couch. A little more care before dreamland.`; }
  }
  next.moves++; next.version++; next.turn = 1 - state.turn;
  next.journal = [{ text: story, player: PLAYERS[state.turn], move: next.moves }, ...state.journal].slice(0, 12);
  return next;
}
export function nextEvening(state, player) {
  if (!finished(state)) throw new Error('Let both pups fall asleep first.');
  if (state.votes.includes(player)) throw new Error('You are already ready for another evening.');
  if (state.votes.length) return initialState(state.round + 1, state.version + 1);
  return { ...state, version: state.version + 1, votes: [player] };
}
