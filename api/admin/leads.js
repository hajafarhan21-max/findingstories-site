import revenueHandler from '../_lib/revenue-route.js';
import { isAdmin } from '../_lib/auth.js';
import { database } from '../_lib/db.js';
import { json, method } from '../_lib/http.js';
import crmMe from '../_lib/crm/me.js';
import crmLeads from '../_lib/crm/leads.js';
import crmTasks from '../_lib/crm/tasks.js';
import crmOpportunities from '../_lib/crm/opportunities.js';
import crmLaunch from '../_lib/crm/launch.js';

export default async function handler(req, res) {
  const crmRoutes={me:crmMe,leads:crmLeads,tasks:crmTasks,opportunities:crmOpportunities,launch:crmLaunch};
  if(req.query?.crm&&crmRoutes[req.query.crm])return crmRoutes[req.query.crm](req,res);
  if (req.query?.view === 'revenue') return revenueHandler(req, res);
  if (!method(req, res, ['GET'])) return;
  if (!isAdmin(req)) return json(res, 401, { error: 'Authentication required.' });
  try {
    const sql = database();
    const [leads, counts] = await Promise.all([
      sql`SELECT id, name, phone, email, source, budget, requirement_summary, lead_score, temperature,
          qualification_summary, next_action, suggested_follow_up_date, captured_at, qualification_status,
          qualification_source, status, assigned_to, agent_notes, last_contacted_at, next_follow_up_at,
          meeting_at, site_visit_at, lost_reason, updated_at, preferred_areas, property_type,
          bedrooms, purpose, purchase_timeline, attributed_revenue, revenue_currency
          FROM leads WHERE is_test=FALSE ORDER BY captured_at DESC LIMIT 500`,
      sql`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='new')::int new,
          COUNT(*) FILTER (WHERE temperature='Hot' AND qualification_status='completed')::int hot,
          COUNT(*) FILTER (WHERE temperature='Warm' AND qualification_status='completed')::int warm,
          COUNT(*) FILTER (WHERE temperature='Cold' AND qualification_status='completed')::int cold,
          COUNT(*) FILTER (WHERE qualification_status IN ('pending','processing'))::int processing
          FROM leads WHERE is_test=FALSE`
    ]);
    json(res, 200, { leads, counts: counts[0] });
  } catch (error) {
    console.error('CRM load failed:', error instanceof Error ? error.message : 'unknown');
    json(res, 500, { error: 'Could not load CRM data.' });
  }
}
