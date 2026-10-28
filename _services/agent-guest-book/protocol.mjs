export const LIMITS = Object.freeze({ body: 4096, ttl: 300000, retention: 30 * 86400000, inbox: 1000 });
export const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
} });
export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export async function clientTag(secret, ip, now) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${Math.floor(now / 86400000)}:${ip}`));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function readJSON(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw { status: 415, error: 'Use application/json.' };
  if (Number(request.headers.get('Content-Length')) > LIMITS.body) throw { status: 413, error: 'Body exceeds 4096 bytes.' };
  const reader = request.body?.getReader(); const chunks = []; let size = 0;
  if (reader) while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > LIMITS.body) { await reader.cancel(); throw { status: 413, error: 'Body exceeds 4096 bytes.' }; }
    chunks.push(value);
  }
  try { return JSON.parse(await new Blob(chunks).text()); }
  catch { throw { status: 400, error: 'Malformed JSON.' }; }
}
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateEntry(body) {
  const fields = ['challenge_id', 'digest', 'alias', 'page_discovered', 'purpose', 'message'];
  if (!plain(body) || Object.keys(body).some(key => !fields.includes(key))) return 'Unknown fields or invalid object.';
  if (typeof body.challenge_id !== 'string' || typeof body.digest !== 'string' || !/^[a-f0-9]{32}$/.test(body.challenge_id || '') || !/^[a-f0-9]{64}$/.test(body.digest || '')) return 'Invalid challenge_id or digest.';
  for (const [key, min, max] of [['alias', 1, 60], ['page_discovered', 1, 200], ['purpose', 1, 240], ['message', 0, 1000]]) {
    const text = key === 'message' && body[key] === undefined ? '' : body[key];
    if (typeof text !== 'string' || text.trim().length < min || text.length > max || /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text)) return `Invalid ${key}; maximum ${max} characters.`;
  }
  // Collect only a public path on this site, never a URL with query data or identifiers.
  if (!/^\/[A-Za-z0-9/_.~-]*$/.test(body.page_discovered) || body.page_discovered.startsWith('//') || body.page_discovered.includes('..')) return 'page_discovered must be a public site path without query or fragment.';
  return null;
}
