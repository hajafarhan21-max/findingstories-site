const DAY = 86_400_000;
export const TERMINAL_STAGES = new Set(['CONVERTED', 'LOST']);

const STATUS_STAGE = {
  new:'NEW LEAD', contacted:'CONTACTED', qualified:'QUALIFIED', property_matched:'PROPERTY MATCHED',
  follow_up:'FOLLOW-UP', meeting_scheduled:'MEETING SCHEDULED', meeting_done:'MEETING DONE',
  site_visit_scheduled:'SITE VISIT SCHEDULED', site_visit_done:'SITE VISIT DONE', interested:'INTERESTED',
  booked:'CONVERTED', reservation:'BOOKING / RESERVATION', converted:'CONVERTED', lost:'LOST'
};
const BASE_PROBABILITY = {
  'NEW LEAD':8, CONTACTED:15, QUALIFIED:28, 'PROPERTY MATCHED':38, 'FOLLOW-UP':34,
  'MEETING SCHEDULED':48, 'MEETING DONE':58, 'SITE VISIT SCHEDULED':65,
  'SITE VISIT DONE':76, INTERESTED:82, 'BOOKING / RESERVATION':92, CONVERTED:100, LOST:0
};

const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : null;
const known = value => value === 0 || Boolean(String(value ?? '').trim());
const unknown = value => known(value) ? value : 'UNKNOWN';
const completed = (executions, type) => executions.some(item => item.action_type === type && item.execution_status === 'completed');

export function determineFunnelStage(lead, recommendation, executions = []) {
  const canonical = STATUS_STAGE[String(lead.status || '').toLowerCase()];
  if (canonical === 'CONVERTED' || canonical === 'LOST' || canonical === 'BOOKING / RESERVATION') return canonical;
  if (canonical && !['NEW LEAD','CONTACTED','QUALIFIED'].includes(canonical)) return canonical;
  if (lead.booking_at || lead.reservation_at || lead.booking_intent) return 'BOOKING / RESERVATION';
  if (lead.interested_at || recommendation?.advisor_status === 'interested') return 'INTERESTED';
  if (lead.site_visit_completed_at || completed(executions, 'site_visit')) return 'SITE VISIT DONE';
  if (lead.site_visit_at) return 'SITE VISIT SCHEDULED';
  if (lead.meeting_completed_at || completed(executions, 'meeting')) return 'MEETING DONE';
  if (lead.meeting_at) return 'MEETING SCHEDULED';
  if (executions.some(item => item.action_type === 'follow_up' && ['approved','completed'].includes(item.execution_status))) return 'FOLLOW-UP';
  if (recommendation?.ranked_matches?.length) return 'PROPERTY MATCHED';
  if (canonical === 'QUALIFIED' || lead.qualification_status === 'completed') return 'QUALIFIED';
  if (canonical === 'CONTACTED' || lead.last_contacted_at) return 'CONTACTED';
  return 'NEW LEAD';
}

export function attributionForLead(lead, recommendation, executions = []) {
  const touch = {
    source:unknown(lead.source), campaign:unknown(lead.campaign || lead.utm_campaign),
    landing_page:unknown(lead.landing_page), referrer:unknown(lead.referrer),
    utm_source:unknown(lead.utm_source), utm_medium:unknown(lead.utm_medium),
    utm_campaign:unknown(lead.utm_campaign), utm_content:unknown(lead.utm_content || lead.content_source),
    form_source_identifier:unknown(lead.form_source_identifier || lead.submission_id)
  };
  const approved = executions.filter(item => item.approval_status === 'approved').sort((a,b) => new Date(a.approved_at || a.created_at) - new Date(b.approved_at || b.created_at));
  const match = recommendation?.ranked_matches?.[0];
  return {
    first_touch:{ ...touch }, latest_touch:{ ...touch },
    advisor_assisted:{ advisor:unknown(lead.assigned_to), first_meaningful_action:approved[0] ? `${approved[0].action_type}:${approved[0].execution_status}` : 'UNKNOWN', approved_at:unknown(approved[0]?.approved_at) },
    property_recommendation:{ project:unknown(match?.project), developer:unknown(match?.developer), area:unknown(match?.area), recommendation_id:unknown(recommendation?.id) }
  };
}

export function conversionProbability(lead, stage, recommendation, executions = [], now = new Date()) {
  if (stage === 'CONVERTED') return { probability:100, band:'CONVERTED', signals:['Canonical converted status'] };
  if (stage === 'LOST') return { probability:0, band:'LOST', signals:['Canonical lost status'] };
  let probability = BASE_PROBABILITY[stage] ?? 8; const signals = [`${stage} stage baseline`];
  if (lead.temperature === 'Hot') { probability += 8; signals.push('HOT temperature +8'); }
  else if (lead.temperature === 'Warm') { probability += 4; signals.push('WARM temperature +4'); }
  if (lead.qualification_status === 'completed' && !(lead.missing_information || []).length) { probability += 5; signals.push('Complete qualification +5'); }
  if (recommendation?.ranked_matches?.length) { const strong = recommendation.ranked_matches[0]?.tier === 'STRONG'; probability += strong ? 9 : 5; signals.push(`${strong ? 'Strong ' : ''}property match +${strong ? 9 : 5}`); }
  if (lead.meeting_at || completed(executions,'meeting')) { probability += 8; signals.push('Meeting signal +8'); }
  if (lead.site_visit_at || completed(executions,'site_visit')) { probability += 10; signals.push('Site-visit signal +10'); }
  if (executions.filter(item => item.execution_status === 'completed').length > 1) { probability += 4; signals.push('Repeated engagement +4'); }
  if (executions.some(item => item.approval_status === 'approved')) { probability += 3; signals.push('Advisor-approved action +3'); }
  if (lead.next_follow_up_at && date(lead.next_follow_up_at) < now) { probability -= 10; signals.push('Overdue follow-up -10'); }
  const last = date(lead.last_contacted_at || lead.captured_at || lead.created_at);
  if (last && now - last > 14 * DAY) { probability -= 12; signals.push('Stale lead -12'); }
  if ((lead.missing_information || []).length) { probability -= 5; signals.push('Missing qualification -5'); }
  probability = Math.max(1, Math.min(99, probability));
  return { probability, band:probability >= 75 ? 'VERY HIGH' : probability >= 50 ? 'HIGH' : probability >= 25 ? 'MEDIUM' : 'LOW', signals };
}

export function forecastWindow(lead, probability, now = new Date()) {
  const explicit = date(lead.projected_close_at || lead.expected_close_at);
  if (explicit) { const days=Math.ceil((explicit-now)/DAY); return days <= 0 ? 'TODAY' : days <= 7 ? 'NEXT 7 DAYS' : explicit.getUTCMonth() === now.getUTCMonth() && explicit.getUTCFullYear() === now.getUTCFullYear() ? 'THIS MONTH' : days <= 30 ? 'NEXT 30 DAYS' : 'LONGER TERM'; }
  if (lead.purchase_timeline === 'Immediately' && probability >= 50) return 'NEXT 7 DAYS';
  if (lead.purchase_timeline === 'Within 30 days') return 'NEXT 30 DAYS';
  if (String(lead.purchase_timeline || '').includes('1–3')) return 'LONGER TERM';
  return probability >= 80 ? 'THIS MONTH' : 'LONGER TERM';
}

export function buildOpportunity(lead, recommendation, executions = [], now = new Date()) {
  const stage=determineFunnelStage(lead,recommendation,executions,now); const conversion=conversionProbability(lead,stage,recommendation,executions,now);
  const rawValue = lead.expected_gross_transaction_value ?? lead.transaction_value ?? null;
  const value = Number(rawValue); const hasValue = known(rawValue) && Number.isFinite(value) && value >= 0;
  const terminal=TERMINAL_STAGES.has(stage); const overdue=Boolean(lead.next_follow_up_at && date(lead.next_follow_up_at) < now);
  return { id:lead.id,name:lead.name,temperature:lead.temperature,assigned_to:lead.assigned_to || 'Unassigned',stage,
    probability_band:conversion.band,expected_conversion_probability:conversion.probability,confidence_explanation:conversion.signals,
    expected_gross_transaction_value:hasValue ? value : 'VALUE UNKNOWN', weighted_pipeline_value:!terminal && hasValue ? Math.round(value * conversion.probability) / 100 : terminal ? 0 : 'VALUE UNKNOWN',
    urgency:overdue || (lead.temperature === 'Hot' && !lead.last_contacted_at) ? 'IMMEDIATE' : conversion.probability >= 60 ? 'HIGH' : 'NORMAL',
    next_action:lead.next_action || lead.ai_recommendation?.next_action || 'Advisor review required',next_follow_up:lead.next_follow_up_at || null,overdue,
    projected_close_window:forecastWindow(lead,conversion.probability,now),property_match_state:recommendation?.ranked_matches?.length ? recommendation.ranked_matches[0]?.tier || 'MATCHED' : 'NO MATCH',
    attribution:attributionForLead(lead,recommendation,executions) };
}

export function advisorMetrics(leads, opportunities) {
  const result={}; for (const lead of leads.filter(x=>x.assigned_to)) { const r=result[lead.assigned_to] ||= { advisor:lead.assigned_to,leads_assigned:0,contacted:0,qualified:0,meetings:0,site_visits:0,bookings:0,conversions:0,overdue_follow_ups:0,active_pipeline_count:0 };
    const o=opportunities.find(x=>x.id===lead.id); r.leads_assigned++; if (lead.last_contacted_at || lead.status==='contacted') r.contacted++; if (lead.qualification_status==='completed' || lead.status==='qualified') r.qualified++; if (lead.meeting_at) r.meetings++; if (lead.site_visit_at) r.site_visits++; if (['booked','reservation'].includes(lead.status)) r.bookings++; if (['booked','converted'].includes(lead.status)) r.conversions++; if (o?.overdue) r.overdue_follow_ups++; if (o && !TERMINAL_STAGES.has(o.stage)) r.active_pipeline_count++; }
  return Object.values(result).map(r=>({...r,conversion_rate:r.leads_assigned ? Math.round(r.conversions/r.leads_assigned*1000)/10 : 0}));
}

export function projectMetrics(leads, recommendations, opportunities) {
  const dimensions=['project','developer','area']; const result={project:[],developer:[],area:[]};
  for (const dimension of dimensions) { const map=new Map(); for (const rec of recommendations) for (const match of rec.ranked_matches || []) { const name=match[dimension]; if (!known(name)) continue; const key=String(name); const metric=map.get(key)||{name:key,recommendations:0,interested_leads:0,meetings_generated:0,site_visits_generated:0,conversions:0}; const lead=leads.find(x=>x.id===rec.lead_id); const opportunity=opportunities.find(x=>x.id===rec.lead_id); metric.recommendations++; if (rec.advisor_status==='interested'||opportunity?.stage==='INTERESTED') metric.interested_leads++; if (lead?.meeting_at) metric.meetings_generated++; if (lead?.site_visit_at) metric.site_visits_generated++; if (['booked','converted'].includes(lead?.status)) metric.conversions++; map.set(key,metric); } result[dimension]=[...map.values()]; }
  return result;
}

export function pipelineAnalytics(leads, recommendations = [], executions = [], now = new Date()) {
  if ([...leads,...recommendations,...executions].some(x=>x.is_test) && [...leads,...recommendations,...executions].some(x=>x.is_test===false)) throw new Error('TEST and genuine customer analytics cannot be mixed');
  const latest=new Map(); for (const item of [...recommendations].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))) latest.set(item.lead_id,item);
  const opportunities=leads.map(lead=>buildOpportunity(lead,latest.get(lead.id),executions.filter(x=>x.lead_id===lead.id),now));
  const active=opportunities.filter(x=>!TERMINAL_STAGES.has(x.stage)); const knownWeighted=active.filter(x=>typeof x.weighted_pipeline_value==='number');
  const count=stage=>opportunities.filter(x=>x.stage===stage).length;
  const overview={total_active_leads:active.length,qualified_leads:active.filter(x=>BASE_PROBABILITY[x.stage]>=BASE_PROBABILITY.QUALIFIED).length,property_matched_leads:active.filter(x=>BASE_PROBABILITY[x.stage]>=BASE_PROBABILITY['PROPERTY MATCHED']).length,
    meetings_scheduled:count('MEETING SCHEDULED'),meetings_completed:count('MEETING DONE'),site_visits_scheduled:count('SITE VISIT SCHEDULED'),site_visits_completed:count('SITE VISIT DONE'),active_booking_opportunities:count('BOOKING / RESERVATION'),converted_leads:count('CONVERTED'),lost_leads:count('LOST'),
    weighted_pipeline:knownWeighted.length ? knownWeighted.reduce((sum,x)=>sum+x.weighted_pipeline_value,0) : 'VALUE UNKNOWN',conversion_rate:leads.length ? Math.round(count('CONVERTED')/leads.length*1000)/10 : 0,
    funnel:Object.fromEntries(Object.keys(BASE_PROBABILITY).map(stage=>[stage,count(stage)]))};
  const forecasts=Object.fromEntries(['TODAY','NEXT 7 DAYS','THIS MONTH','NEXT 30 DAYS','LONGER TERM'].map(window=>[window,active.filter(x=>x.projected_close_window===window).length]));
  return {overview,forecasts,likely_meetings:active.filter(x=>['MEETING SCHEDULED','PROPERTY MATCHED'].includes(x.stage)&&x.expected_conversion_probability>=45).length,likely_site_visits:active.filter(x=>['MEETING DONE','SITE VISIT SCHEDULED'].includes(x.stage)&&x.expected_conversion_probability>=55).length,likely_bookings:active.filter(x=>x.expected_conversion_probability>=75).length,immediate_intervention:active.filter(x=>x.urgency==='IMMEDIATE').length,
    priority_queue:active.sort((a,b)=>b.expected_conversion_probability-a.expected_conversion_probability || Number(b.overdue)-Number(a.overdue)),advisor_metrics:advisorMetrics(leads,opportunities),project_metrics:projectMetrics(leads,recommendations,opportunities)};
}
