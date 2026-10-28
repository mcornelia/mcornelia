import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { start, repo } from './harness.mjs';
export async function preview() {
  let worker;
  const web = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://local').pathname;
    if (pathname === '/agents') { res.writeHead(301, { Location: '/agents/' }).end(); return; }
    if (pathname === '/agents/protocol.json' && worker) {
      const config = JSON.parse(await readFile(join(repo, 'agents/protocol.json')));
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ...config, accepting_entries: true, api_base: worker.base })); return;
    }
    // Deliberate public-file allowlist. Never serve source, credentials, fixtures or database files.
    const file = pathname === '/' ? 'index.html' : pathname === '/agents/' ? 'agents/index.html' : pathname.slice(1);
    if (!/^(index\.html|agents\/(index\.html|styles\.css|app\.mjs|example\.py|protocol\.json)|css\/[a-zA-Z0-9._-]+\.css|js\/[a-zA-Z0-9._-]+\.(m?js)|favicon[^/]*|apple-touch-icon\.png|sitemap\.xml|llms\.txt)$/.test(file)) { res.writeHead(404).end(); return; }
    try {
      let data = await readFile(join(repo, file));
      if (file === 'agents/index.html' && worker) data = Buffer.from(data.toString().replace('connect-src \'self\' https://mcornelia-agent-guest-book.mike-cornelia.workers.dev', `connect-src 'self' ${worker.base}`));
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.py': 'text/plain' })[extname(file)] || 'text/plain');
      res.setHeader('Cache-Control', 'no-store'); res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { web.on('error', reject); web.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${web.address().port}`;
  try { worker = await start({ origin }); } catch (e) { web.close(); throw e; }
  return { origin, worker, stop: async () => { await new Promise(r => web.close(r)); await worker.stop(); } };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const p = await preview(); console.log('Local preview: ' + p.origin + '/agents/');
  console.log('Local private inbox shell: ' + p.worker.base + '/inbox');
  console.log('Synthetic, temporary local runtime. No production credentials or persistence.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await p.stop(); process.exit(); });
}
