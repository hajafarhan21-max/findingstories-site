import { createHash } from 'node:crypto';
import { Agent, run } from '@openai/agents';
import { z } from 'zod';

export const REVENUE_AGENT_VERSION = 'lead-advisor-v1';
const terminalStatuses = new Set(['booked', 'lost']);
export const recommendationSchema = z.object({
  priority: z.enum(['HOT', 'WARM', 'NURTURE', 'LOW']), score: z.number().int().min(0).max(100),
  score_reason: z.string().min(1).max(800), next_action: z.string().min(1).max(500), follow_up_timing: z.string().min(1).max(200),
  talking_points: z.array(z.string().min(1).max(300)).max(5), whatsapp_draft: z.string().min(1).max(1200),
  call_opening: z.string().min(1).max(600), missing_information: z.array(z.string().min(1).max(200)).max(10),
  warning: z.string().max(500), escalation: z.string().max(500), meeting_ready: z.boolean()
});
const INPUT_FIELDS = ['purpose','budget','property_type','bedrooms','preferred_areas','payment_method','purchase_timeline','source',
  'utm_source','utm_medium','utm_campaign','qualification_summary','requirement_summary','assigned_to','agent_notes','last_contacted_at',
  'next_follow_up_at','meeting_at','site_visit_at','status','updated_at'];

export function recommendationFingerprint(lead) {
  return createHash('sha256').update(`${REVENUE_AGENT_VERSION}:${JSON.stringify(Object.fromEntries(INPUT_FIELDS.map(key => [key, lead[key] ?? null])))}`).digest('hex');
}
export function isEligibleForRevenueAnalysis(lead) { return !lead.is_test && !terminalStatuses.has(lead.status) && Boolean(lead.consent); }
export function needsRevenueAnalysis(lead) { return isEligibleForRevenueAnalysis(lead) && recommendationFingerprint(lead) !== lead.ai_recommendation_fingerprint; }

export function deterministicRecommendation(lead, now = new Date()) {
  const timeline = String(lead.purchase_timeline || '');
  const overdue = Boolean(lead.next_follow_up_at && new Date(lead.next_follow_up_at) < now);
  const qualified = lead.status === 'qualified' || Number(lead.lead_score) >= 45;
  const meetingReady = qualified && Boolean(lead.budget && lead.preferred_areas && lead.property_type) && !lead.meeting_at && !lead.site_visit_at;
  let score = Number(lead.lead_score) || 0;
  if (/immediate|30 day/i.test(timeline)) score += 12;
  if (overdue) score += 8;
  if (!lead.assigned_to) score += 5;
  score = Math.max(0, Math.min(100, score));
  const priority = score >= 75 ? 'HOT' : score >= 50 ? 'WARM' : score >= 25 ? 'NURTURE' : 'LOW';
  const missing = [['budget','budget'],['preferred_areas','preferred location'],['property_type','property type'],['purchase_timeline','purchase timeline'],['purpose','investment or end-use']].filter(([key]) => !lead[key]).map(([, label]) => label);
  const warning = overdue ? 'Follow-up is overdue.' : qualified && lead.last_contacted_at && now - new Date(lead.last_contacted_at) > 7 * 864e5 ? 'Qualified lead appears stalled.' : '';
  return { priority, score, score_reason: `${qualified ? 'Qualified intent' : 'Early-stage intent'} with ${timeline || 'no stated timeline'}${overdue ? '; follow-up is overdue' : ''}.`,
    next_action: meetingReady ? 'Confirm availability and propose a short-list review or site visit.' : missing.length ? `Qualify ${missing.slice(0, 2).join(' and ')}.` : 'Review requirements and agree the next milestone.',
    follow_up_timing: overdue || priority === 'HOT' ? 'Now' : priority === 'WARM' ? 'Within 24 hours' : 'Within 3 days',
    talking_points: [lead.requirement_summary || [lead.purpose, lead.property_type, lead.preferred_areas].filter(Boolean).join(' · ') || 'Confirm the property requirement', `Confirm ${timeline || 'purchase timing'}`],
    whatsapp_draft: `Hello ${lead.name}, this is Finding Stories following up on your UAE property enquiry. Would a brief call help us refine the options around your requirements?`,
    call_opening: `Hello ${lead.name}, this is Finding Stories. Is now a convenient time to briefly review your property requirements and next step?`,
    missing_information: missing, warning, escalation: !lead.assigned_to && priority === 'HOT' ? 'Escalate for prompt advisor assignment.' : '', meeting_ready: meetingReady };
}

let advisorAgent;
function getAgent() {
  advisorAgent ||= new Agent({ name: 'Finding Stories Lead Follow-up Advisor', model: process.env.OPENAI_REVENUE_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions: 'You are an advisory-only UAE property CRM qualification and follow-up agent. Use only supplied facts. Never claim inventory, price, returns, availability, or customer intent not present. Never instruct autonomous contact, deletion, reassignment, or record changes. Recommend actions for a human advisor to review. HOT means immediate credible intent; WARM means promising; NURTURE means longer-term or incomplete; LOW means weak or insufficient intent. Identify overdue, stalled, and meeting/site-visit-ready leads. Draft concise respectful messages without unverified claims.',
    outputType: recommendationSchema });
  return advisorAgent;
}
export async function analyzeLeadWithAgent(lead) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const safeLead = Object.fromEntries(['name', ...INPUT_FIELDS, 'lead_score', 'temperature'].map(key => [key, lead[key] ?? null]));
  const result = await run(getAgent(), JSON.stringify({ current_time: new Date().toISOString(), lead: safeLead }), { maxTurns: 1 });
  if (!result.finalOutput) throw new Error('Revenue agent returned no recommendation');
  return recommendationSchema.parse(result.finalOutput);
}
