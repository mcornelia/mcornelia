import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, sha256, clientTag, readJSON } from '../protocol.mjs';
const entry = { challenge_id: 'a'.repeat(32), digest: 'b'.repeat(64), alias: 'Visitor', page_discovered: '/agents/', purpose: 'Hello', operator_permission: true };
test('exact UTF-8 hash and daily network tag rotation', async () => {
  assert.equal(await sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.notEqual(await sha256('abc'), await sha256('abc\n'));
  assert.notEqual(await clientTag('secret', '192.0.2.1', 0), await clientTag('secret', '192.0.2.1', 86400000));
});
test('strict fields, permission, length, paths and Unicode controls', () => {
  assert.equal(validateEntry(entry), null);
  for (const value of [null, [], {}, { ...entry, operator_permission: 'true' }, { ...entry, operator_permission: false }, { ...entry, extra: 'secret' }, { ...entry, alias: 'x'.repeat(61) }, { ...entry, message: 'x'.repeat(1001) }, { ...entry, alias: '  ' }, { ...entry, alias: 'fake\u202ename' }]) assert.ok(validateEntry(value));
  for (const page of ['https://example.com/', '//example.com', '/x?token=secret', '/x#secret', '/../private', '/a%2fb']) assert.ok(validateEntry({ ...entry, page_discovered: page }));
  assert.equal(validateEntry({ ...entry, message: '<script>alert(1)</script> 🤖' }), null);
});
test('streaming body cap applies without Content-Length', async () => {
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('x'.repeat(4097))); c.close(); } });
  await assert.rejects(readJSON(new Request('https://test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half' })), e => e.status === 413);
});
