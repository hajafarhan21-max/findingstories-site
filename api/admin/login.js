import { createSession, isAdmin, validPassword } from '../_lib/auth.js';
import { clientIp, json, method, parseJson, rateLimit } from '../_lib/http.js';

export default function handler(req, res) {
  const started = Date.now();
  if (!method(req, res, ['GET', 'POST'])) return;
  if (req.method === 'GET') {
    const authenticated = isAdmin(req);
    return json(res, authenticated ? 200 : 401, { authenticated });
  }
  if (!rateLimit(`login:${clientIp(req)}`, 5, 15 * 60_000)) return json(res, 429, { error: 'Too many login attempts.' });
  if (!process.env.SESSION_SECRET || !validPassword(parseJson(req).password)) return json(res, 401, { error: 'Invalid credentials.' });
  res.setHeader('Set-Cookie', `fs_admin=${createSession()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);
  res.setHeader('Server-Timing', `auth;dur=${Date.now() - started}`);
  json(res, 200, { ok: true });
}
