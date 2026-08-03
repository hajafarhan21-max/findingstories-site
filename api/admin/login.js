import { createSession, validPassword } from '../_lib/auth.js';
import { clientIp, json, method, parseJson, rateLimit } from '../_lib/http.js';

export default function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!rateLimit(`login:${clientIp(req)}`, 5, 15 * 60_000)) return json(res, 429, { error: 'Too many login attempts.' });
  if (!process.env.SESSION_SECRET || !validPassword(parseJson(req).password)) return json(res, 401, { error: 'Invalid credentials.' });
  res.setHeader('Set-Cookie', `fs_admin=${createSession()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);
  json(res, 200, { ok: true });
}
