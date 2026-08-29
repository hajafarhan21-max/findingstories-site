import revenueHandler from '../../_lib/revenue-route.js';
import inventoryActivationHandler from '../../_lib/inventory-activation-route.js';
import { isAdmin, isSameOrigin } from '../../_lib/auth.js';
import { database, ensureSchema } from '../../_lib/db.js';
import { json, method, parseJson } from '../../_lib/http.js';
import { leadUpdateSchema } from '../../_lib/validation.js';

export default async function handler(req, res) {
  if (req.query?.view === 'revenue') return revenueHandler(req, res);
  if (req.query?.view === 'inventory-activation') return inventoryActivationHandler(req, res);
  if (!method(req, res, ['PATCH'])) return;
  if (!isAdmin(req)) return json(res, 401, { error: 'Authentication required.' });
  if (!isSameOrigin(req)) return json(res, 403, { error: 'Same-origin request required.' });
  const parsed = leadUpdateSchema.safeParse(parseJson(req));
  if (!parsed.success) return json(res, 400, { error: 'Invalid lead update.', details: parsed.error.flatten().fieldErrors });
  try {
    await ensureSchema();
    const sql = database();
    const value = parsed.data;
    let rows;
    if (value.action === 'status') rows = await sql`UPDATE leads SET status=${value.status}, lost_reason=CASE WHEN ${value.status} <> 'lost' THEN '' ELSE lost_reason END, updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    if (value.action === 'assign') rows = await sql`UPDATE leads SET assigned_to=${value.assigned_to}, updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    if (value.action === 'notes') rows = await sql`UPDATE leads SET agent_notes=${value.agent_notes}, updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    if (value.action === 'follow_up') rows = await sql`UPDATE leads SET next_follow_up_at=${value.next_follow_up_at}, updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    if (value.action === 'meeting') rows = await sql`UPDATE leads SET meeting_at=${value.meeting_at}, status=CASE WHEN ${value.meeting_at} IS NULL THEN status ELSE 'meeting_scheduled' END, updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    if (value.action === 'site_visit') rows = await sql`UPDATE leads SET site_visit_at=${value.site_visit_at}, status=CASE WHEN ${value.site_visit_at} IS NULL THEN status ELSE 'site_visit_scheduled' END, updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    if (value.action === 'contacted') rows = await sql`UPDATE leads SET last_contacted_at=NOW(), status='contacted', updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    if (value.action === 'booked') rows = await sql`UPDATE leads SET status='booked', lost_reason='', updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    if (value.action === 'revenue') rows = await sql`UPDATE leads SET attributed_revenue=${value.attributed_revenue},revenue_currency=${value.revenue_currency},updated_at=NOW() WHERE id=${value.id} AND status IN ('booked','converted') RETURNING *`;
    if (value.action === 'lost') rows = await sql`UPDATE leads SET status='lost', lost_reason=${value.lost_reason}, updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    if (!rows?.length) return json(res, 404, { error: 'Lead not found.' });
    return json(res, 200, { lead: rows[0] });
  } catch (error) {
    console.error('CRM update failed:', error instanceof Error ? error.message : 'unknown');
    return json(res, 500, { error: 'Could not update lead.' });
  }
}
