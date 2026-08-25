import { waitUntil } from '@vercel/functions';
import { isAdmin, isSameOrigin } from './auth.js';
import { database, ensureSchema } from './db.js';
import { json, method, parseJson } from './http.js';
import { analyzeLeadWithAgent, needsRevenueAnalysis, recommendationFingerprint } from './revenue-agent.js';
import { ACTION_TYPES, commandCenter, defaultEmailDraft, productivityMetrics, recommendationEscalations } from './revenue-execution.js';
import { z } from 'zod';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ id:z.string().uuid(), action:z.literal('reviewed') }),
  z.object({ id:z.string().uuid(), action:z.literal('approve'), action_type:z.enum(ACTION_TYPES), draft:z.string().max(4000).optional() }),
  z.object({ id:z.string().uuid(), action:z.literal('complete'), execution_id:z.string().uuid(), outcome:z.string().min(1).max(1000), next_follow_up:z.string().datetime().nullable().optional() }),
  z.object({ id:z.string().uuid(), action:z.literal('schedule'), action_type:z.enum(['follow_up','meeting','site_visit']), scheduled_for:z.string().datetime() }),
  z.object({ id:z.string().uuid(), action:z.literal('snooze'), snoozed_until:z.string().datetime() }),
  z.object({ id:z.string().uuid(), action:z.literal('dismiss'), reason:z.string().min(2).max(500) })
]);

async function refreshRecommendations(sql, candidates) {
  for (const lead of candidates.filter(needsRevenueAnalysis).slice(0, 5)) {
    try {
      const recommendation = await analyzeLeadWithAgent(lead); const fingerprint = recommendationFingerprint(lead);
      await sql`UPDATE leads SET ai_recommendation=${JSON.stringify(recommendation)}, ai_recommendation_fingerprint=${fingerprint},
        ai_recommended_at=NOW(), ai_reviewed_at=NULL, ai_dismissed_at=NULL
        WHERE id=${lead.id} AND updated_at=${lead.updated_at} AND is_test=FALSE AND status NOT IN ('booked','lost')`;
    } catch { /* Retry stale recommendations later without logging customer data. */ }
  }
}

function originalDraft(lead, type) {
  if (type === 'whatsapp') return lead.ai_recommendation.whatsapp_draft;
  if (type === 'email') return defaultEmailDraft(lead, lead.ai_recommendation);
  if (type === 'call') return lead.ai_recommendation.call_opening;
  return lead.ai_recommendation.next_action;
}

async function mutate(sql, input) {
  const rows = await sql`SELECT * FROM leads WHERE id=${input.id} AND is_test=FALSE AND consent=TRUE AND status NOT IN ('booked','lost') AND ai_recommendation IS NOT NULL`;
  const lead = rows[0]; if (!lead) return { status:404, body:{ error:'Active recommendation not found.' } };
  const recommendationId = lead.ai_recommendation_fingerprint || recommendationFingerprint(lead);
  if (input.action === 'reviewed') {
    await sql`UPDATE leads SET ai_reviewed_at=COALESCE(ai_reviewed_at,NOW()) WHERE id=${lead.id}`;
  } else if (input.action === 'approve' || input.action === 'schedule') {
    const type = input.action_type; const original = originalDraft(lead, type); const edited = input.draft?.trim() || original;
    const scheduled = input.action === 'schedule' ? input.scheduled_for : null;
    const result = await sql`INSERT INTO follow_up_executions (lead_id,recommendation_id,advisor,action_type,original_ai_draft,advisor_edited_draft,approval_status,approved_at,execution_status,next_follow_up,is_test)
      VALUES (${lead.id},${recommendationId},${lead.assigned_to || 'Unassigned'},${type},${original},${edited},'approved',NOW(),'approved',${scheduled},FALSE)
      ON CONFLICT (lead_id,recommendation_id,action_type) WHERE execution_status NOT IN ('dismissed','completed') DO NOTHING RETURNING *`;
    if (!result[0]) return { status:409, body:{ error:'An active approved action already exists.' } };
    await sql`UPDATE leads SET ai_reviewed_at=COALESCE(ai_reviewed_at,NOW()), next_follow_up_at=COALESCE(${scheduled},next_follow_up_at),
      meeting_at=CASE WHEN ${type}='meeting' THEN ${scheduled} ELSE meeting_at END,
      site_visit_at=CASE WHEN ${type}='site_visit' THEN ${scheduled} ELSE site_visit_at END WHERE id=${lead.id}`;
  } else if (input.action === 'complete') {
    const done = await sql`UPDATE follow_up_executions SET execution_status='completed',completed_at=NOW(),outcome=${input.outcome},next_follow_up=${input.next_follow_up || null},updated_at=NOW()
      WHERE id=${input.execution_id} AND lead_id=${lead.id} AND is_test=FALSE AND approval_status='approved' AND execution_status<>'completed' RETURNING *`;
    if (!done[0]) return { status:409, body:{ error:'Follow-up is already completed or unavailable.' } };
    await sql`UPDATE leads SET last_contacted_at=NOW(),next_follow_up_at=${input.next_follow_up || null},updated_at=NOW() WHERE id=${lead.id}`;
  } else if (input.action === 'snooze') {
    await sql`INSERT INTO follow_up_executions (lead_id,recommendation_id,advisor,action_type,approval_status,execution_status,snoozed_until,next_follow_up,is_test)
      VALUES (${lead.id},${recommendationId},${lead.assigned_to || 'Unassigned'},'follow_up','not_required','snoozed',${input.snoozed_until},${input.snoozed_until},FALSE)
      ON CONFLICT (lead_id,recommendation_id,action_type) WHERE execution_status NOT IN ('dismissed','completed') DO UPDATE SET execution_status='snoozed',snoozed_until=${input.snoozed_until},next_follow_up=${input.snoozed_until},updated_at=NOW()`;
    await sql`UPDATE leads SET next_follow_up_at=${input.snoozed_until},ai_reviewed_at=COALESCE(ai_reviewed_at,NOW()) WHERE id=${lead.id}`;
  } else if (input.action === 'dismiss') {
    await sql`INSERT INTO follow_up_executions (lead_id,recommendation_id,advisor,action_type,approval_status,execution_status,dismissal_reason,is_test)
      VALUES (${lead.id},${recommendationId},${lead.assigned_to || 'Unassigned'},'follow_up','rejected','dismissed',${input.reason},FALSE)`;
    await sql`UPDATE leads SET ai_dismissed_at=NOW(),ai_reviewed_at=COALESCE(ai_reviewed_at,NOW()) WHERE id=${lead.id}`;
  }
  return { status:200, body:{ ok:true } };
}

export default async function handler(req, res) {
  if (!method(req, res, ['GET','PATCH'])) return;
  if (!isAdmin(req)) return json(res,401,{ error:'Authentication required.' });
  if (req.method === 'PATCH' && !isSameOrigin(req)) return json(res,403,{ error:'Same-origin request required.' });
  try {
    await ensureSchema(); const sql=database();
    if (req.method === 'PATCH') { const parsed=actionSchema.safeParse(parseJson(req)); if (!parsed.success) return json(res,400,{ error:'Invalid action update.' }); const result=await mutate(sql,parsed.data); return json(res,result.status,result.body); }
    const candidates=await sql`SELECT * FROM leads WHERE is_test=FALSE AND consent=TRUE ORDER BY updated_at DESC LIMIT 250`;
    const stale=candidates.filter(needsRevenueAnalysis); if (stale.length) waitUntil(refreshRecommendations(sql,stale));
    const executions=await sql`SELECT * FROM follow_up_executions WHERE is_test=FALSE ORDER BY updated_at DESC LIMIT 500`;
    const queue=candidates.filter(lead=>!['booked','lost'].includes(lead.status)&&lead.ai_recommendation&&!lead.ai_dismissed_at)
      .map(lead=>({ id:lead.id,name:lead.name,phone:lead.phone,email:lead.email,status:lead.status,assigned_to:lead.assigned_to,next_follow_up_at:lead.next_follow_up_at,last_contacted_at:lead.last_contacted_at,meeting_at:lead.meeting_at,site_visit_at:lead.site_visit_at,ai_recommendation:lead.ai_recommendation,ai_recommended_at:lead.ai_recommended_at,ai_reviewed_at:lead.ai_reviewed_at,recommendation_id:lead.ai_recommendation_fingerprint,escalations:recommendationEscalations(lead),executions:executions.filter(item=>item.lead_id===lead.id)}))
      .sort((a,b)=>b.ai_recommendation.score-a.ai_recommendation.score);
    return json(res,200,{ queue,refreshing:Math.min(stale.length,5),advisory_only:true,command_center:commandCenter(candidates,executions),metrics:productivityMetrics(candidates,executions) });
  } catch { return json(res,500,{ error:'Could not load the Revenue Command Center.' }); }
}
