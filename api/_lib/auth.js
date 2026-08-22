import { createHmac, timingSafeEqual } from 'node:crypto';

const encode = (value) => Buffer.from(value).toString('base64url');
function signature(payload) { return createHmac('sha256', process.env.SESSION_SECRET || '').update(payload).digest('base64url'); }

export function validPassword(input) {
  const expected = Buffer.from(process.env.ADMIN_PASSWORD || '');
  const actual = Buffer.from(String(input || ''));
  return expected.length > 15 && expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isAcceptance(req, env = process.env) {
  const expected = Buffer.from(String(env.ACCEPTANCE_TEST_SECRET || ''));
  const authorization = String(req.headers.authorization || '');
  const actual = Buffer.from(authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
  return expected.length >= 32 && expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function createSession() {
  const payload = encode(JSON.stringify({ role: 'admin', exp: Date.now() + 8 * 60 * 60 * 1000 }));
  return `${payload}.${signature(payload)}`;
}
export function isAdmin(req) {
  if ((process.env.SESSION_SECRET || '').length < 32) return false;
  const token = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('fs_admin='))?.slice(9);
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || signature(payload).length !== sig.length) return false;
  if (!timingSafeEqual(Buffer.from(signature(payload)), Buffer.from(sig))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

export function isSameOrigin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  const origin = String(req.headers.origin || '');
  if (!host || !origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.host.toLowerCase() === host &&
      (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin');
  } catch { return false; }
}
