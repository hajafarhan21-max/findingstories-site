export const ACTION_TYPES = ['whatsapp', 'email', 'call', 'follow_up', 'meeting', 'site_visit'];
export const TERMINAL_LEAD_STATUSES = new Set(['booked', 'lost']);
const day = 864e5;

export function defaultEmailDraft(lead, recommendation) {
  return `Subject: Your Finding Stories property enquiry\n\nHello ${lead.name},\n\n${recommendation.next_action}\n\nWould you be available for a brief conversation?\n\nFinding Stories`;
}

export function recommendationEscalations(lead, now = new Date()) {
  if (lead.is_test || TERMINAL_LEAD_STATUSES.has(lead.status)) return [];
  const ai = lead.ai_recommendation || {};
  const result = [];
  const age = now - new Date(lead.ai_recommended_at || lead.updated_at || now);
  if (ai.priority === 'HOT' && !lead.last_contacted_at && age > 4 * 60 * 60 * 1000) result.push('HOT_NOT_CONTACTED');
  if (lead.status === 'qualified' && !lead.next_follow_up_at) result.push('QUALIFIED_NO_FOLLOW_UP');
  if (ai.meeting_ready && !lead.meeting_at) result.push('MEETING_READY_NO_MEETING');
  if ((ai.site_visit_ready || /site visit/i.test(ai.next_action || '')) && !lead.site_visit_at) result.push('SITE_VISIT_READY_NOT_SCHEDULED');
  if (lead.next_follow_up_at && new Date(lead.next_follow_up_at) < now) result.push('OVERDUE_ADVISOR_ACTION');
  return result;
}

export function commandCenter(leads, executions, now = new Date()) {
  const eligible = leads.filter(lead => !lead.is_test && !TERMINAL_LEAD_STATUSES.has(lead.status));
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0); const end = new Date(start.getTime() + day);
  const active = executions.filter(item => !item.is_test);
  return {
    hot_now: eligible.filter(lead => lead.ai_recommendation?.priority === 'HOT' && recommendationEscalations(lead, now).includes('HOT_NOT_CONTACTED')).length,
    due_today: eligible.filter(lead => lead.next_follow_up_at && new Date(lead.next_follow_up_at) >= start && new Date(lead.next_follow_up_at) < end).length,
    overdue: eligible.filter(lead => lead.next_follow_up_at && new Date(lead.next_follow_up_at) < now).length,
    opportunities: eligible.filter(lead => lead.ai_recommendation?.meeting_ready || /site visit/i.test(lead.ai_recommendation?.next_action || '')).length,
    approved_awaiting: active.filter(item => item.approval_status === 'approved' && item.execution_status !== 'completed').length,
    completed_today: active.filter(item => item.completed_at && new Date(item.completed_at) >= start && new Date(item.completed_at) < end).length,
    stalled: eligible.filter(lead => lead.status === 'qualified' && (!lead.last_contacted_at || now - new Date(lead.last_contacted_at) > 7 * day)).length
  };
}

export function canCreateAction(existing, recommendationId, actionType) {
  return !existing.some(item => item.recommendation_id === recommendationId && item.action_type === actionType && !['dismissed', 'completed'].includes(item.execution_status));
}

export function productivityMetrics(leads, executions) {
  const safeLeads = leads.filter(lead => !lead.is_test); const safe = executions.filter(item => !item.is_test);
  return { recommendations_generated: safeLeads.filter(lead => lead.ai_recommended_at).length,
    recommendations_reviewed: safeLeads.filter(lead => lead.ai_reviewed_at).length,
    actions_approved: safe.filter(item => item.approval_status === 'approved').length,
    follow_ups_completed: safe.filter(item => item.execution_status === 'completed').length,
    meetings_scheduled: safe.filter(item => item.action_type === 'meeting' && item.execution_status === 'completed').length,
    site_visits_scheduled: safe.filter(item => item.action_type === 'site_visit' && item.execution_status === 'completed').length,
    conversions_recorded: safeLeads.filter(lead => lead.status === 'booked').length };
}

export function applyExecutionAction(record, action, now = new Date()) {
  if (record.is_test !== true) throw new Error('Synthetic execution tests require is_test isolation');
  if (action.type === 'approve') return { ...record, advisor_edited_draft: action.draft || record.original_ai_draft, approval_status:'approved', approved_at:now.toISOString(), execution_status:'approved' };
  if (action.type === 'snooze') return { ...record, execution_status:'snoozed', snoozed_until:action.until, next_follow_up:action.until };
  if (action.type === 'dismiss') return { ...record, approval_status:'rejected', execution_status:'dismissed', dismissal_reason:action.reason };
  if (action.type === 'complete') {
    if (record.execution_status === 'completed') throw new Error('Follow-up already completed');
    if (record.approval_status !== 'approved') throw new Error('Human approval required');
    return { ...record, execution_status:'completed', completed_at:now.toISOString(), outcome:action.outcome, next_follow_up:action.next_follow_up || null };
  }
  throw new Error('Unsupported action');
}
