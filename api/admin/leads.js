import { isAdmin } from '../_lib/auth.js';
import { database, ensureSchema } from '../_lib/db.js';
import { json, method } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  if (!isAdmin(req)) return json(res, 401, { error: 'Authentication required.' });
  try {
    await ensureSchema();
    const sql = database();
    const [leads, counts] = await Promise.all([
      sql`SELECT id, name, phone, email, source, budget, requirement_summary, lead_score, temperature,
          qualification_summary, next_action, suggested_follow_up_date, created_at, status
          FROM leads ORDER BY created_at DESC LIMIT 500`,
      sql`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='new')::int new,
          COUNT(*) FILTER (WHERE temperature='Hot')::int hot, COUNT(*) FILTER (WHERE temperature='Warm')::int warm,
          COUNT(*) FILTER (WHERE temperature='Cold')::int cold FROM leads`
    ]);
    json(res, 200, { leads, counts: counts[0] });
  } catch (error) {
    console.error('CRM load failed:', error instanceof Error ? error.message : 'unknown');
    json(res, 500, { error: 'Could not load CRM data.' });
  }
}
