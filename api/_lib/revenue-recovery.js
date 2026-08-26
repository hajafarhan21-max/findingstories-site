import { buildOpportunity } from './conversion-forecasting.js';

const DAY = 86_400_000;
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : null;
const text = value => String(value || '').trim().toLowerCase();
const daysSince = (value, now) => { const parsed=date(value); return parsed ? Math.max(0,Math.floor((now-parsed)/DAY)) : null; };
const completed = (items,type) => items.some(x=>x.action_type===type&&x.execution_status==='completed');
const RECOVERABLE_LOST = ['timing','budget changed','no suitable inventory','delayed','waiting for handover','no response','no-response','later'];
const BLOCKED_LOST = ['do not contact','do-not-contact','invalid','duplicate','spam','legal','compliance','converted elsewhere'];

export function recoveryEligibility(lead) {
  const reason=text(lead.lost_reason); const status=text(lead.status);
  const blocked = lead.do_not_contact || lead.invalid_contact || lead.duplicate_of || lead.compliance_exclusion || !lead.consent ||
    BLOCKED_LOST.some(value=>reason.includes(value));
  if (blocked) return {eligible:false,band:'DO NOT RE-ENGAGE',reason:'Explicit contact, data-quality, duplicate, or compliance suppression'};
  if (['booked','converted','reservation'].includes(status)) return {eligible:false,band:'DO NOT RE-ENGAGE',reason:'Converted or booking-stage lead'};
  if (status==='lost' && !RECOVERABLE_LOST.some(value=>reason.includes(value))) return {eligible:false,band:'DO NOT RE-ENGAGE',reason:'Lost reason is not eligible for win-back'};
  return {eligible:true,reason:status==='lost'?'Advisor-reviewable lost reason':'Active genuine CRM lead'};
}

export function recoveryFingerprint(lead) {
  return ['recovery-v1',lead.id,lead.status,lead.last_contacted_at||'',lead.next_follow_up_at||'',lead.meeting_at||'',lead.site_visit_at||'',lead.lost_reason||''].join(':');
}

export function analyzeRecoveryLead(lead, recommendation=null, executions=[], now=new Date()) {
  const eligibility=recoveryEligibility(lead); const activity=lead.last_contacted_at||lead.updated_at||lead.captured_at||lead.created_at;
  const inactive=daysSince(activity,now); const overdue=Boolean(date(lead.next_follow_up_at)&&date(lead.next_follow_up_at)<now);
  const meetingPast=Boolean(date(lead.meeting_at)&&date(lead.meeting_at)<now&&!lead.meeting_completed_at&&!completed(executions,'meeting'));
  const visitPast=Boolean(date(lead.site_visit_at)&&date(lead.site_visit_at)<now&&!lead.site_visit_completed_at&&!completed(executions,'site_visit'));
  const meetingDone=Boolean(lead.meeting_completed_at||completed(executions,'meeting'));
  const visitDone=Boolean(lead.site_visit_completed_at||completed(executions,'site_visit'));
  const match=recommendation?.ranked_matches?.[0] || null; const qualified=lead.qualification_status==='completed'||lead.status==='qualified';
  const opportunity=buildOpportunity(lead,recommendation,executions,now); const factors=[]; let score=0;
  const add=(label,points)=>{score+=points;factors.push(`${label} ${points>=0?'+':''}${points}`);};
  if (lead.temperature==='Hot') add('HOT lead',24); else if (lead.temperature==='Warm') add('WARM lead',15);
  if (qualified) add('Qualified',12); if (qualified&&!(lead.missing_information||[]).length) add('Qualification complete',8);
  if (match) add(`${match.tier==='STRONG'?'Strong ':''}property match`,match.tier==='STRONG'?16:9);
  if (lead.meeting_at||meetingDone) add('Previous meeting',8); if (lead.site_visit_at||visitDone) add('Previous site visit',12);
  if (lead.interested_at||recommendation?.advisor_status==='interested'||lead.status==='interested') add('Prior interest',12);
  if (['Immediately','Within 30 days'].includes(lead.purchase_timeline)) add('Upcoming purchase timeline',10);
  if (opportunity.expected_conversion_probability>=60) add('Strong pipeline probability',10);
  if (inactive!==null&&inactive<=14&&lead.last_contacted_at) add('Recent prior engagement',6);
  if (overdue) add('Overdue follow-up',14); if (!lead.assigned_to&&qualified) add('Unassigned qualified lead',14);
  if (inactive!==null&&inactive>90) add('Extremely stale',-22); else if (inactive!==null&&inactive>14) add('Stale',-8);
  if ((lead.no_response_count||0)>=2) add('Repeated no-response',-12);
  if (lead.status==='lost') add('Previously lost',-10);
  score=Math.max(0,Math.min(100,score));
  let band='NURTURE';
  if (!eligibility.eligible) band='DO NOT RE-ENGAGE'; else if (visitPast||visitDone&&!lead.next_follow_up_at) band='SITE VISIT RECOVERY';
  else if (meetingPast||meetingDone&&!lead.next_follow_up_at) band='MEETING RECOVERY'; else if (match&&!executions.some(x=>x.action_type==='follow_up'&&x.approval_status==='approved')) band='PROPERTY MATCH RECOVERY';
  else if (overdue) band=score>=65?'IMMEDIATE RECOVERY':'FOLLOW-UP OVERDUE'; else if (lead.status==='lost'||score>=65) band='HIGH VALUE WIN-BACK';
  const leaking=eligibility.eligible&&(overdue||meetingPast||visitPast||!lead.assigned_to&&qualified||match&&inactive>=7||qualified&&!lead.next_follow_up_at||inactive>=14||meetingDone&&!lead.next_follow_up_at||visitDone&&!lead.next_follow_up_at);
  const project=match?.data_quality==='VERIFIED INVENTORY'?match.project:null;
  const angle=project?`Reconnect around verified inventory for ${project}; confirm current availability and pricing before presenting.`:'Reconnect around the lead’s recorded requirements; validate what has changed before recommending inventory.';
  return {id:lead.id,name:lead.name,owner:lead.assigned_to||'Unassigned',temperature:lead.temperature,stage:opportunity.stage,recovery_band:band,
    recoverable:leaking,days_inactive:inactive??'UNKNOWN',previous_engagement:visitDone?'Site visit completed':meetingDone?'Meeting completed':lead.last_contacted_at?'Previously contacted':'No recorded contact',
    property_match_status:match?`${match.tier||'MATCHED'}${project?` · ${project}`:''}`:'NO MATCH',pipeline_probability:opportunity.expected_conversion_probability,
    recovery_priority_score:eligibility.eligible?score:0,score_factors:factors,suppression_reason:eligibility.eligible?null:eligibility.reason,
    why:visitPast?'Scheduled site visit has no completion record.':meetingPast?'Scheduled meeting has no completion record.':overdue?'Recorded follow-up is overdue.':!lead.assigned_to&&qualified?'Qualified opportunity is unassigned.':match?'Property match has no recent advisor progression.':'Qualified or engaged lead has no recorded next step.',
    recommended_action:visitPast?'Advisor should review the visit and offer to reschedule.':meetingPast?'Advisor should review the meeting and offer to reschedule.':!lead.next_follow_up_at?'Advisor should review history and schedule a follow-up.':'Advisor should complete the overdue follow-up.',
    recommended_timing:score>=65||overdue?'Today':'Within 2 business days',suggested_angle:angle,property_context:project||'No verified inventory context',
    whatsapp_draft:`SUGGESTED — ADVISOR APPROVAL REQUIRED\nHi ${lead.name}, it’s ${lead.assigned_to||'an advisor'} from Finding Stories. I’m following up on your recorded property enquiry. ${project?`We have a recorded match for ${project}, subject to reconfirming availability and pricing. `:''}Would it be helpful to review your current requirements?`,
    call_opening:`SUGGESTED — ADVISOR APPROVAL REQUIRED: Hi ${lead.name}, this is ${lead.assigned_to||'an advisor'} from Finding Stories. I’m calling about your earlier property enquiry. Is now a suitable time to confirm whether your plans or requirements have changed?`,
    follow_up_objective:'Confirm current intent and requirements, agree one explicit next step, and record the outcome.',approval_required:true,autonomous_contact:false,fingerprint:recoveryFingerprint(lead)};
}

export function recoveryAnalytics(leads,recommendations=[],executions=[],now=new Date(),cooldownDays=7) {
  const all=[...leads,...recommendations,...executions];
  if (all.some(x=>x.is_test)&&all.some(x=>x.is_test===false)) throw new Error('TEST and genuine customer recovery records cannot be mixed');
  const latest=new Map(); for(const item of [...recommendations].sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0))) latest.set(item.lead_id,item);
  const recent=leadId=>executions.some(x=>x.lead_id===leadId&&date(x.created_at)&&now-date(x.created_at)<cooldownDays*DAY&&!['dismissed','completed'].includes(x.execution_status));
  const analyzed=leads.map(lead=>analyzeRecoveryLead(lead,latest.get(lead.id),executions.filter(x=>x.lead_id===lead.id),now));
  const queue=analyzed.filter(x=>x.recoverable&&!recent(x.id)).sort((a,b)=>b.recovery_priority_score-a.recovery_priority_score||String(a.name).localeCompare(String(b.name)));
  const known=queue.map(x=>{const l=leads.find(y=>y.id===x.id);const v=Number(l.expected_gross_transaction_value??l.transaction_value);return Number.isFinite(v)?v*x.pipeline_probability/100:null;}).filter(x=>x!==null);
  return {advisory_only:true,autonomous_contact:false,cooldown_days:cooldownDays,queue,metrics:{total_recoverable_leads:queue.length,immediate_recovery_leads:queue.filter(x=>x.recovery_band==='IMMEDIATE RECOVERY').length,
    overdue_hot_warm:queue.filter(x=>['Hot','Warm'].includes(x.temperature)&&x.score_factors.some(f=>f.startsWith('Overdue'))).length,meeting_recovery:queue.filter(x=>x.recovery_band==='MEETING RECOVERY').length,
    site_visit_recovery:queue.filter(x=>x.recovery_band==='SITE VISIT RECOVERY').length,stale_property_matches:queue.filter(x=>x.recovery_band==='PROPERTY MATCH RECOVERY').length,
    unassigned_opportunities:queue.filter(x=>x.owner==='Unassigned').length,estimated_recoverable_pipeline:known.length?Math.round(known.reduce((a,b)=>a+b,0)*100)/100:'VALUE UNKNOWN',
    recovery_attempts_approved:executions.filter(x=>x.approval_status==='approved'&&String(x.recommendation_id).startsWith('recovery-')).length,recovered_contacts:executions.filter(x=>x.execution_status==='completed'&&String(x.recommendation_id).startsWith('recovery-')).length,
    meetings_recovered:executions.filter(x=>x.action_type==='meeting'&&x.execution_status==='completed'&&String(x.recommendation_id).startsWith('recovery-')).length,site_visits_recovered:executions.filter(x=>x.action_type==='site_visit'&&x.execution_status==='completed'&&String(x.recommendation_id).startsWith('recovery-')).length,
    conversions_after_recovery:leads.filter(l=>['booked','converted'].includes(l.status)&&executions.some(x=>x.lead_id===l.id&&x.execution_status==='completed'&&String(x.recommendation_id).startsWith('recovery-'))).length}};
}
