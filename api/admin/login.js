import { createSession, sessionIdentity } from '../_lib/auth.js';
import { database } from '../_lib/db.js';
import { verifyPassword } from '../_lib/password.js';
import { clientIp, json, method, parseJson, rateLimit } from '../_lib/http.js';

export default async function handler(req, res) {
  const started = Date.now();
  if (!method(req, res, ['GET', 'POST'])) return;
  if (req.method === 'GET') {
    const authenticated = Boolean(sessionIdentity(req));
    return json(res, authenticated ? 200 : 401, { authenticated });
  }
  if (!rateLimit(`login:${clientIp(req)}`, 5, 15 * 60_000)) return json(res, 429, { error: 'Too many login attempts.' });
  const body=parseJson(req); const email=String(body.email||'').trim().toLowerCase();
  if (!process.env.SESSION_SECRET || email.length>254) return json(res, 401, { error: 'Invalid credentials.' });
  const sql=database();
  const users=await sql`SELECT id,email,display_name,role,password_hash,active FROM crm_users WHERE lower(email)=${email} LIMIT 1`;
  const user=users[0]; const valid=Boolean(user?.active) && await verifyPassword(body.password,user?.password_hash);
  await sql`INSERT INTO crm_login_audit(user_id,email,succeeded,ip_address,user_agent) VALUES(${user?.id||null},${email},${valid},${clientIp(req)},${String(req.headers['user-agent']||'').slice(0,500)})`;
  if (!valid) return json(res, 401, { error: 'Invalid credentials.' });
  await sql`UPDATE crm_users SET last_login_at=NOW() WHERE id=${user.id}`;
  res.setHeader('Set-Cookie', `fs_admin=${createSession(user)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);
  res.setHeader('Server-Timing', `auth;dur=${Date.now() - started}`);
  json(res, 200, { ok: true, user:{id:user.id,display_name:user.display_name,role:user.role} });
}
