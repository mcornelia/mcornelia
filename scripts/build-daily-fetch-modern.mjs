import { readFile, writeFile } from 'node:fs/promises';
import { VARIETY_PUZZLES } from '../play/daily-fetch/puzzles-variety.mjs';
import { PUZZLES } from '../play/daily-fetch/puzzles.mjs';
import { puzzleIndexForDate } from '../play/daily-fetch/game-engine.mjs';
const SIZE=4, MIN_WORD_LENGTH=4, MAX_WORD_LENGTH=12;
const weightedLetters = "eeeeeeeeeeeeaaaaaaaaaiiiiiiiiioooooooonnnnnnrrrrrrttttttllllssssuuuuddddgggccchhmmpbyfvkwxjqz";

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [copy[index], copy[swapWith]] = [copy[swapWith], copy[index]];
  }
  return copy;
}

function neighbors(index) {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const result = [];
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
      if (rowDelta === 0 && columnDelta === 0) continue;
      const nextRow = row + rowDelta;
      const nextColumn = column + columnDelta;
      if (nextRow >= 0 && nextRow < SIZE && nextColumn >= 0 && nextColumn < SIZE) {
        result.push(nextRow * SIZE + nextColumn);
      }
    }
  }
  return result;
}

const neighborMap = Array.from({ length: SIZE * SIZE }, (_, index) => neighbors(index));

function placeSecret(secret, random) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const path = [Math.floor(random() * SIZE * SIZE)];
    while (path.length < secret.length) {
      const available = shuffle(neighborMap[path.at(-1)], random).filter((index) => !path.includes(index));
      if (!available.length) break;
      path.push(available[0]);
    }
    if (path.length === secret.length) return path;
  }
  throw new Error(`Unable to place secret word: ${secret}`);
}

function makeBoard(secret, seed) {
  const random = seededRandom(seed);
  const path = placeSecret(secret, random);
  const board = Array.from({ length: SIZE * SIZE }, () => weightedLetters[Math.floor(random() * weightedLetters.length)]);
  path.forEach((cell, index) => {
    board[cell] = secret[index];
  });
  return board;
}

function buildTrie(words) {
  const root = {};
  for (const word of words) {
    let node = root;
    for (const letter of word) node = node[letter] ??= {};
    node.$ = true;
  }
  return root;
}

function enumerateBoard(board, trie) {
  const found = new Set();

  function visit(index, node, used, word) {
    const letter = board[index];
    const next = node[letter];
    if (!next) return;
    const nextWord = word + letter;
    if (next.$ && nextWord.length >= MIN_WORD_LENGTH) found.add(nextWord);
    if (nextWord.length >= MAX_WORD_LENGTH) return;
    for (const neighbor of neighborMap[index]) {
      if ((used & (1 << neighbor)) === 0) visit(neighbor, next, used | (1 << neighbor), nextWord);
    }
  }

  for (let index = 0; index < board.length; index += 1) visit(index, trie, 1 << index, "");
  return [...found].sort((a, b) => a.length - b.length || a.localeCompare(b));
}


const common = new Set((await readFile(new URL('./wordlists/common-english.txt',import.meta.url),'utf8')).trim().split('\n'));
const excluded = new Set((await readFile(new URL('./wordlists/excluded.txt',import.meta.url),'utf8')).split('\n').filter(w=>w && !w.startsWith('#')));
for (const word of excluded) common.delete(word);
const trie=buildTrie(common);
let repaired=0;
const modern=VARIETY_PUZZLES.map(p=>{
  const secret=common.has(p.secret)?p.secret:'inquire';
  let words=p.words.filter(w=>common.has(w));
  if(words.length>=8 && words.includes(secret))return {...p,words};
  repaired++;
  for(let attempt=0;attempt<2000;attempt++) {
    const letters=makeBoard(secret,hashString(`modern-v1-${secret}-${attempt}`)).join('');
    words=enumerateBoard([...letters],trie);
    if(words.length>=12 && words.includes(secret))return {letters,secret,words};
  }
  throw new Error(`Cannot build ${secret}`);
});
// Only the release day's already-started legacy board can predate these rules.
const releaseDate=new Date(2026,9,4,12);
const old=PUZZLES[puzzleIndexForDate(releaseDate,PUZZLES.length)];
const compatibilityWords=enumerateBoard([...old.letters],trie);
const compatibility={...old,words:compatibilityWords,secret:compatibilityWords.find(w=>w.length>=6)};
if(!compatibility.secret || compatibilityWords.length<8)throw new Error('Release-day legacy board cannot finish');
await writeFile(new URL('../play/daily-fetch/puzzles-modern.mjs',import.meta.url),
 '// Generated from SCOWL common English. See WORDLIST-LICENSE.txt.\n'+
 `export const MODERN_PUZZLES = ${JSON.stringify(modern)};\n`+
 `export const RELEASE_LEGACY_PUZZLE = ${JSON.stringify(compatibility)};\n`);
console.log(JSON.stringify({boards:modern.length,repaired,todayWords:modern[0].words.length}));
