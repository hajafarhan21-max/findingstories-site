import { authorize } from './crm-access.js';
import { json, method } from './http.js';
import { planRevenueFollowUps, summarizeRevenueOperations } from '../../platform/revenue-operations.js';

// Read-only authenticated dashboard data. Never dispatch messages or modify leads.
export default async function revenueOperationsSnapshot(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    const access = await authorize(req, res, 'leads', 'view');
    if (!access) return;
    const sql = access.sql;
    const rows = await sql`SELECT id,owner_id,phone,email,consent,is_test,status,temperature,lead_score,
      preferred_contact_method,next_follow_up_at,suggested_follow_up_date,
      attributed_revenue,revenue_currency
      FROM leads WHERE is_test=FALSE ORDER BY updated_at DESC LIMIT 500`;
    const visible = rows.filter(row => row.owner_id === null || access.visibleIds === null || (row.owner_id && access.visibleIds.includes(row.owner_id)));
    const queue = planRevenueFollowUps(visible);
    const metrics = summarizeRevenueOperations(visible);
    return json(res, 200, { ok:true, advisory_only:true, requires_human_approval:true,
      coverage_limit:500, queue, metrics });
  } catch (error) {
    console.error('Revenue operations snapshot failed:', error instanceof Error ? error.message : 'unknown');
    return json(res, 500, { error:'Could not load revenue operations snapshot.' });
  }
}
