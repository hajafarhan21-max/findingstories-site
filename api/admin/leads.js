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
          qualification_summary, next_action, suggested_follow_up_date, captured_at, qualification_status,
          qualification_source, status, assigned_to, agent_notes, last_contacted_at, next_follow_up_at,
          meeting_at, site_visit_at, lost_reason, updated_at, preferred_areas, property_type,
          bedrooms, purpose, purchase_timeline FROM leads ORDER BY captured_at DESC LIMIT 500`,
      sql`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='new')::int new,
          COUNT(*) FILTER (WHERE temperature='Hot' AND qualification_status='completed')::int hot,
          COUNT(*) FILTER (WHERE temperature='Warm' AND qualification_status='completed')::int warm,
          COUNT(*) FILTER (WHERE temperature='Cold' AND qualification_status='completed')::int cold,
          COUNT(*) FILTER (WHERE qualification_status IN ('pending','processing'))::int processing FROM leads`
    ]);
    json(res, 200, { leads, counts: counts[0] });
  } catch (error) {
    console.error('CRM load failed:', error instanceof Error ? error.message : 'unknown');
    json(res, 500, { error: 'Could not load CRM data.' });
  }
}
