import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start, submission, key } from './harness.mjs';
test('real Worker: challenge, validation, replay/concurrency, private inbox, retention and restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'guestbook-durable-')); let s = await start({ directory });
  try {
    assert.equal((await s.call('/v1/inbox')).status, 401);
    assert.equal((await s.call('/v1/inbox', { headers: { Authorization: 'Bearer ' + 'a'.repeat(43) } })).status, 401);
    assert.equal((await s.call('/v1/challenge', { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await s.call('/v1/challenge', { method: 'POST' })).status, 405);
    const c = await s.call('/v1/challenge', { headers: { Origin: 'https://mcornelia.com' } });
    assert.equal(c.headers.get('access-control-allow-origin'), 'https://mcornelia.com'); assert.equal(c.headers.get('cache-control'), 'no-store'); assert.equal(c.data.payload.split('\n').length, 3);
    const body = await submission(s, '192.0.2.2', { message: '<img src=x onerror=alert(1)> https://127.0.0.1/private', alias: "Robert'); DROP TABLE entries;--" });
    assert.equal((await s.call('/v1/entries', { ip: '192.0.2.3', body })).status, 400);
    assert.equal((await s.call('/v1/entries', { ip: '192.0.2.2', body: { ...body, digest: '0'.repeat(64) } })).status, 400);
    assert.equal((await s.call('/v1/entries', { ip: '192.0.2.2', body: { ...body, extra: true } })).status, 400);
    const race = await Promise.all(Array.from({ length: 8 }, () => s.call('/v1/entries', { ip: '192.0.2.2', body })));
    assert.equal(race.filter(r => r.status === 201).length, 1); assert.equal(race.filter(r => r.status === 409).length, 7);
    const inbox = await s.call('/v1/inbox', { owner: true }); assert.equal(inbox.data.entries.length, 1); assert.equal(inbox.data.entries[0].message, body.message);
    assert.deepEqual(Object.keys(inbox.data.entries[0]).sort(), ['alias', 'created', 'id', 'message', 'page', 'purpose', 'receipt']);
    const saved = inbox.data.entries; await s.stop(); s = await start({ directory });
    assert.deepEqual((await s.call('/v1/inbox', { owner: true })).data.entries, saved);
    assert.equal((await s.call('/v1/entries', { ip: '192.0.2.2', body })).status, 409);
    const exp = await submission(s, '192.0.2.4'); await s.sql('UPDATE challenges SET expires=? WHERE id=?', Date.now() - 1, exp.challenge_id);
    assert.equal((await s.call('/v1/entries', { ip: '192.0.2.4', body: exp })).status, 410);
    assert.equal((await s.call('/v1/entries', { ip: '192.0.2.4', body: { ...exp, challenge_id: '0'.repeat(32) } })).status, 410);
    assert.equal((await s.call('/v1/entries', { body: '{' })).status, 400);
    assert.equal((await s.call('/v1/entries', { body: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await s.call('/v1/entries', { body: ' '.repeat(4097) })).status, 413);
    assert.equal((await s.call('/v1/inbox?before=oops', { owner: true })).status, 400);
    assert.equal((await s.call('/v1/inbox/delete', { body: { id: saved[0].id } })).status, 401);
    assert.equal((await s.call('/v1/inbox/delete', { owner: true, body: { id: saved[0].id } })).status, 200);
    assert.equal((await s.call('/v1/inbox', { owner: true })).data.entries.length, 0);
    await s.sql('INSERT INTO entries (receipt,created,alias,page,purpose,message) VALUES (?,?,?,?,?,?)', 'old', Date.now() - 31 * 86400000, 'Old', '/', 'Test', 'Retained too long');
    assert.equal((await s.call('/v1/inbox', { owner: true })).data.entries.length, 0);
    assert.equal((await s.sql('SELECT count(*) AS n FROM entries'))[0].n, 0);
    const shell = await s.mf.dispatchFetch(s.base + '/inbox'); assert.equal(shell.status, 200); assert.ok(shell.headers.get('content-security-policy').includes("frame-ancestors 'none'")); assert.equal((await shell.text()).includes(key), false);
    for (let i = 0; i < 52; i++) await s.sql('INSERT INTO entries (receipt,created,alias,page,purpose,message) VALUES (?,?,?,?,?,?)', `fixture-${i}`, Date.now(), 'Pagination test', '/', 'Fixture', 'Synthetic');
    const page = await s.call('/v1/inbox', { owner: true }); assert.equal(page.data.entries.length, 50); assert.ok(page.data.next);
    const older = await s.call('/v1/inbox?before=' + page.data.next, { owner: true }); assert.equal(older.data.entries.length, 2); assert.equal(older.data.next, null);
  } finally { await s.stop(); await rm(directory, { recursive: true, force: true }); }
});
test('per-network request/submission limits, global caps, full inbox, fail-closed provisioning', async () => {
  const s = await start();
  try {
    for (let i = 0; i < 4; i++) { const body = await submission(s); const r = await s.call('/v1/entries', { body }); assert.equal(r.status, i === 3 ? 429 : 201); if (i === 3) assert.equal(r.headers.get('retry-after'), '3600'); }
    for (let i = 0; i < 11; i++) assert.equal((await s.call('/v1/challenge', { ip: '192.0.2.100' })).status, i === 10 ? 429 : 200);
    for (let i = 0; i < 31; i++) assert.equal((await s.call('/v1/entries', { ip: '192.0.2.101', body: '{}' })).status, i === 30 ? 429 : 400);
    const body = await submission(s, '192.0.2.102');
    await s.sql('INSERT OR REPLACE INTO rates VALUES (?, ?, ?)', 'accepted:' + Math.floor(Date.now() / 86400000), 100, Date.now() + 86400000);
    assert.equal((await s.call('/v1/entries', { ip: '192.0.2.102', body })).status, 429);
    await s.sql('UPDATE rates SET count=0');
    await s.sql("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1000) INSERT INTO entries(receipt,created,alias,page,purpose,message) SELECT 'capacity',?,'Synthetic','/','Test','' FROM n", Date.now());
    assert.equal((await s.call('/v1/entries', { ip: '192.0.2.102', body })).status, 503);
    assert.equal((await s.sql('SELECT used FROM challenges WHERE id=?', body.challenge_id))[0].used, 0);
    await s.sql('UPDATE rates SET count=1200 WHERE key LIKE ?', 'all:%');
    assert.equal((await s.call('/v1/challenge', { ip: '192.0.2.103' })).status, 429);
  } finally { await s.stop(); }
  const unconfigured = await start({ configured: false });
  try { for (const path of ['/v1/challenge', '/v1/inbox']) assert.equal((await unconfigured.call(path, { owner: true })).status, 503); } finally { await unconfigured.stop(); }
});
