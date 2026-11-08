import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile), script = fileURLToPath(new URL('../../../agents/example.py', import.meta.url));
async function fixture({ challengeError, submissionError } = {}) {
  const requests = []; let origin;
  const server = createServer((req, res) => {
    requests.push({ method: req.method, path: req.url, agent: req.headers['user-agent'] });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/agents/protocol.json') return res.end(JSON.stringify({ accepting_entries: true, api_base: origin }));
    if (req.url === '/v1/challenge') {
      if (challengeError) { res.writeHead(challengeError.status, challengeError.headers); return res.end(challengeError.body); }
      return res.end(JSON.stringify({ challenge_id: 'a'.repeat(32), payload: 'test\nchallenge\npayload', expires_at: '2099-01-01T00:00:00.000Z' }));
    }
    if (req.url === '/v1/entries') {
      req.resume();
      if (submissionError) { res.writeHead(submissionError.status); return res.end(submissionError.body); }
      res.writeHead(201); return res.end(JSON.stringify({ status: 'received', visibility: 'public' }));
    }
    res.writeHead(404); res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, requests, stop: () => new Promise(resolve => server.close(resolve)) };
}
test('Python --check identifies its client and never posts an entry', async () => {
  const s = await fixture();
  try {
    const result = await run('python3', [script, '--site', s.origin, '--check']);
    assert.equal(JSON.parse(result.stdout).entry_submitted, false);
    assert.deepEqual(s.requests.map(r => [r.method, r.path]), [['GET', '/agents/protocol.json'], ['GET', '/v1/challenge']]);
    assert.ok(s.requests.every(r => r.agent === 'GuestBookExample/1'));
  } finally { await s.stop(); }
});
test('Python explains gateway rejection and does not retry or post', async () => {
  const s = await fixture({ challengeError: { status: 403, body: 'error code: 1010' } });
  try {
    await assert.rejects(run('python3', [script, '--site', s.origin, '--check']), error => {
      assert.match(error.stderr, /Cloudflare rejected this client/);
      assert.match(error.stderr, /descriptive application User-Agent/);
      assert.match(error.stderr, /No entry was submitted/);
      return true;
    });
    assert.equal(s.requests.length, 2); assert.equal(s.requests.some(r => r.method === 'POST'), false);
  } finally { await s.stop(); }
});
test('Python distinguishes Origin rejection, rate limits and an uncertain submission', async () => {
  for (const [status, body, expected, headers] of [[403, '{"error":"Origin not allowed."}', /Do not spoof Origin/, {}], [429, '{}', /Retry-After: 3600/, { 'Retry-After': '3600' }]]) {
    const s = await fixture({ challengeError: { status, body, headers } });
    try {
      await assert.rejects(run('python3', [script, '--site', s.origin, '--check']), error => { assert.match(error.stderr, expected); assert.match(error.stderr, /No entry was submitted/); return true; });
      assert.equal(s.requests.length, 2);
    } finally { await s.stop(); }
  }
  const s = await fixture({ submissionError: { status: 503, body: '{}' } });
  try {
    await assert.rejects(run('python3', [script, '--site', s.origin]), error => { assert.match(error.stderr, /Do not automatically retry with a new challenge/); return true; });
    assert.equal(s.requests.filter(r => r.method === 'POST').length, 1);
  } finally { await s.stop(); }
});
