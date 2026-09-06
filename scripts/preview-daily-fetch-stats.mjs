// Generates isolated QA fixtures. No production save is read or written.
// Run from the repository: node scripts/preview-daily-fetch-stats.mjs
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUZZLES } from '../play/daily-fetch/puzzles.mjs';
import { dateKey, puzzleIndexForDate } from '../play/daily-fetch/game-engine.mjs';
const root = join(tmpdir(), 'daily-fetch-stats-preview');
const source = fileURLToPath(new URL('../play/daily-fetch/', import.meta.url));
const today = new Date();
const key = dateKey(today);
const puzzle = PUZZLES[puzzleIndexForDate(today,PUZZLES.length)];
const words = [puzzle.secret, ...puzzle.words.filter(w=>w!==puzzle.secret)].slice(0,8);
const fixture = {tutorialSeen:true, soundEnabled:false, soundPreferenceSet:true, days:{}};
for(let offset=1;offset<=4;offset++) {
  const date=new Date(today); date.setDate(date.getDate()-offset);
  fixture.days[dateKey(date)] = {foundWords:offset===4?['playtime','backyard','sunshine']:['cat'],hintRevealed:offset===2};
}
fixture.days[key] = {puzzleId:puzzle.letters,foundWords:words,completedAt:today.toISOString(),celebrationSeenAt:today.toISOString(),hintRevealed:false};
await mkdir(root,{recursive:true});
await cp(source,join(root,'game'),{recursive:true});
for (const name of ['legacy','blocked']) {
  const target=join(root,name); await cp(source,target,{recursive:true});
  const app=await readFile(join(target,'app.mjs'),'utf8');
  const fake = name==='legacy'
    ? `let fixtureRaw = ${JSON.stringify(JSON.stringify(fixture))};\nconst fixtureStorage = {getItem:()=>fixtureRaw,setItem:(_key,value)=>{fixtureRaw=value;}};\n`
    : `const fixtureStorage = {getItem:()=>{throw new Error('QA blocked storage');},setItem:()=>{throw new Error('QA blocked storage');}};\n`;
  await writeFile(join(target,'app.mjs'),app.replace('const persistence = openStore(() => localStorage, today);',fake+'const persistence = openStore(() => fixtureStorage, today);'));
}
await writeFile(join(root,'index.html'),'<h1>Daily Fetch stats QA</h1><p>Isolated local fixtures; no live game saves.</p><ul><li><a href="game/">Fresh playable preview</a></li><li><a href="legacy/">Legacy history and completed catch (memory-only fixture)</a></li><li><a href="blocked/">Unavailable storage fixture</a></li></ul>');
console.log(root);
console.log('Serve this directory on a new loopback port with python3 -m http.server 4331 --bind 127.0.0.1 --directory '+root);
console.log(JSON.stringify({key,words,extra:puzzle.words.find(w=>!words.includes(w)),letters:puzzle.letters}));
