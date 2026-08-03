import { json, method } from '../_lib/http.js';
export default function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  res.setHeader('Set-Cookie', 'fs_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  json(res, 200, { ok: true });
}
