import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(SCRIPT_DIR, "../play/daily-fetch/puzzles-variety.mjs");
const WORDS_PATH = "/usr/share/dict/words";
const WORD_LIST = path.resolve(SCRIPT_DIR, "daily-fetch-words.txt");
const SIZE = 4;
const MIN_WORD_LENGTH = 3;
const MAX_WORD_LENGTH = 12;
const MIN_ACCEPTED_WORDS = 25;

const secrets = (await readFile(WORD_LIST, "utf8"))
  .split(/\r?\n/).filter(line => !line.startsWith("#")).join(" ").trim().split(/\s+/);
if (secrets.length < 1_200 || new Set(secrets).size !== secrets.length ||
    secrets.some(word => !/^[a-z]{6,12}$/.test(word))) {
  throw new Error("Expected at least 1,200 distinct hidden words of 6–12 letters");
}

const customWords = [
  "aimee", "backyard", "bounce", "chuckit", "favorite", "fetch", "hidden", "huck",
  "olive", "orange", "outside", "playtime", "raven", "ravenwood", "retrieve", "rolling",
  "squeaky", "tennis", "toller", "tossed", "treasure", "watchdog", "zoomies",
];

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

const rawDictionary = await readFile(WORDS_PATH, "utf8");
const dictionary = new Set(
  rawDictionary
    .split(/\r?\n/)
    .filter((word) => /^[a-z]+$/.test(word))
    .filter((word) => word.length >= MIN_WORD_LENGTH && word.length <= MAX_WORD_LENGTH),
);
[...customWords, ...secrets].forEach((word) => dictionary.add(word));
const trie = buildTrie(dictionary);

const puzzles = [];
const usedBoards = new Set();
const scheduledSecrets = shuffle(secrets, seededRandom(hashString("daily-fetch-variety-v1")));
for (let index = 0; index < scheduledSecrets.length; index += 1) {
  const secret = scheduledSecrets[index];
  let puzzle;
  for (let attempt = 0; attempt < 2_000; attempt += 1) {
    const seed = hashString(`daily-fetch-variety-v1-${secret}-${attempt}`);
    const board = makeBoard(secret, seed);
    const words = enumerateBoard(board, trie);
    if (!words.includes(secret) || usedBoards.has(board.join(""))) continue;
    if (words.length < MIN_ACCEPTED_WORDS) continue;
    if (!words.some((word) => word.length >= 6)) continue;
    puzzle = { letters: board.join(""), secret, words };
    break;
  }
  if (!puzzle) throw new Error(`Unable to generate puzzle ${index}`);
  puzzles.push(puzzle);
  usedBoards.add(puzzle.letters);
}

const banner = `// Generated by scripts/build-daily-fetch-puzzles.mjs from the macOS word list plus curated everyday words.\n`;
await writeFile(OUTPUT, `${banner}export const VARIETY_PUZZLES = ${JSON.stringify(puzzles)};\n`);
console.log(`Wrote ${puzzles.length} puzzles to ${OUTPUT}`);
