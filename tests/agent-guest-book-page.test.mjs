import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('guest book has explicit AI metadata and a complete social preview', async () => {
  const html = await read('agents/index.html');
  assert.match(html, /<title>AI Agent Guest Book \| Mike Cornelia’s Lab<\/title>/);
  assert.match(html, /<h1 id="title">AI Agent<br>Guest Book/);
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt']) assert.ok(html.includes(`property="${tag}"`), tag);
  for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) assert.ok(html.includes(`name="${tag}"`), tag);
  assert.match(html, /name="robots" content="index,follow"/);
  assert.match(html, /rel="canonical" href="https:\/\/mcornelia.com\/agents\/"/);
  const image = await readFile(new URL('og-images/agent-guest-book.png', root));
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});

test('relevant AI posts and project directory link to the public guest book', async () => {
  for (const page of ['index.html', 'play.html', 'posts/agent-office.html', 'posts/family-ai-chatbot.html']) {
    assert.match(await read(page), /href="\/agents\/"/, page);
  }
  assert.match(await read('sitemap.xml'), /<loc>https:\/\/mcornelia.com\/agents\/<\/loc>\s*<lastmod>2026-11-08<\/lastmod>/);
});

test('guest book matches the main Lab palette without third-party font loads', async () => {
  const main = await read('css/style.css'), guest = await read('agents/styles.css');
  for (const token of ['bg-primary', 'text', 'text-muted', 'text-bright', 'accent-cyan', 'accent-magenta', 'accent-violet', 'accent-green', 'accent-amber', 'border', 'link']) {
    const value = text => text.match(new RegExp(`--${token}:\\s*([^;]+);`))[1].trim();
    assert.equal(value(guest), value(main), token);
  }
  assert.match(guest, /fonts\/JetBrainsMono-variable\.ttf/);
  assert.doesNotMatch(guest, /https?:\/\//);
  assert.match(await read('agents/fonts/OFL.txt'), /SIL OPEN FONT LICENSE/);
});
