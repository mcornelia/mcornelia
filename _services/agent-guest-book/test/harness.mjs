import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), repo = resolve(root, '../..');
export const hash = text => createHash('sha256').update(text).digest('hex');
export const key = randomBytes(32).toString('base64url'); // Ephemeral test fixture, never provisioned.
const secret = randomBytes(32).toString('hex');
export async function start({ directory, origin = 'https://mcornelia.com', configured = true } = {}) {
  const own = !directory; directory ||= await mkdtemp(join(tmpdir(), 'guestbook-test-'));
  const bundle = await build({ entryPoints: [join(root, 'worker.mjs')], bundle: true, write: false, format: 'esm', platform: 'browser', external: ['cloudflare:workers'] });
  const mf = new Miniflare(convertV4MiniflareOptions({ name: 'guestbook-test', modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-01', host: '127.0.0.1', port: 0, cf: false, log: new Log(LogLevel.ERROR), telemetry: { enabled: false }, logRequests: false, unsafeInspectDurableObjects: true, resourcePersistencePath: directory, durableObjects: { BOOK: { className: 'GuestBook', useSQLite: true } }, bindings: { ALLOWED_ORIGIN: origin, ...(configured ? { OWNER_KEY_HASH: hash(key), RATE_SECRET: secret } : {}) } }));
  const base = (await mf.ready).origin;
  return { mf, base, directory,
    async sql(query, ...args) { const storage = await mf.unsafeGetDurableObjectStorage('guestbook-test', 'GuestBook', { name: 'agent-guest-book-v1' }); return storage.exec(query, ...args); },
    async stop() { await mf.dispose(); if (own) await rm(directory, { recursive: true, force: true }); },
    async call(path, { body, ip = '192.0.2.1', owner = false, headers = {}, ...options } = {}) {
      const response = await mf.dispatchFetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'CF-Connecting-IP': ip, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(owner ? { Authorization: `Bearer ${key}` } : {}), ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }), ...options });
      return { status: response.status, headers: response.headers, data: await response.json() };
    },
  };
}
export async function submission(server, ip = '192.0.2.1', overrides = {}) {
  const c = await server.call('/v1/challenge', { ip }); if (c.status !== 200) throw Error(JSON.stringify(c.data));
  return { challenge_id: c.data.challenge_id, digest: hash(c.data.payload), alias: 'Synthetic Visitor', page_discovered: '/agents/', purpose: 'Testing with synthetic data.', message: 'Hello from the test suite.', operator_permission: true, ...overrides };
}
