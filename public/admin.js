import { filterAndSortLeads, formatDubaiDate, formatDubaiDateTime, isOverdue } from './crm-utils.js';

const login = document.querySelector('#login');
const crm = document.querySelector('#crm');
const errorBox = document.querySelector('#login-error');
const list = document.querySelector('#leads');
let leads = [];
let actionQueue = [];
let propertyOpportunities = [];
let refreshTimer;

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const dateInput = value => value ? new Date(value).toISOString().slice(0, 16) : '';
const isoOrNull = value => value ? new Date(value).toISOString() : null;
const statusLabel = value => String(value).replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
const whatsappUrl = phone => `https://wa.me/${String(phone || '').replace(/\D/g, '')}`;

function controls(lead) {
  const statuses = ['new','contacted','qualified','meeting_scheduled','site_visit_scheduled','booked','lost'];
  return `<div class="edit-grid">
    <label>Status<select data-field="status">${statuses.map(value => `<option value="${value}" ${lead.status === value ? 'selected' : ''}>${statusLabel(value)}</option>`).join('')}</select></label>
    <label>Assigned agent<input data-field="assigned_to" maxlength="100" value="${escapeHtml(lead.assigned_to)}" placeholder="Agent name"></label>
    <label>Next follow-up<input data-field="next_follow_up_at" type="datetime-local" value="${dateInput(lead.next_follow_up_at)}"></label>
    <label>Meeting<input data-field="meeting_at" type="datetime-local" value="${dateInput(lead.meeting_at)}"></label>
    <label>Site visit<input data-field="site_visit_at" type="datetime-local" value="${dateInput(lead.site_visit_at)}"></label>
    <label class="wide">Agent notes<textarea data-field="agent_notes" maxlength="5000">${escapeHtml(lead.agent_notes)}</textarea></label>
    <label class="wide">Lost reason<input data-field="lost_reason" maxlength="500" value="${escapeHtml(lead.lost_reason)}" placeholder="Required when marking lost"></label>
  </div><div class="actions"><button data-action="save">Save changes</button><button data-action="contacted" class="secondary">Mark contacted</button><button data-action="booked" class="secondary">Mark booked</button><button data-action="lost" class="danger">Mark lost</button><span class="save-message" role="status"></span></div>`;
}

function render() {
  const options = { query: document.querySelector('#search').value, temperature: document.querySelector('#temperature').value,
    status: document.querySelector('#status-filter').value, agent: document.querySelector('#agent').value, sort: document.querySelector('#sort').value };
  const shown = filterAndSortLeads([...leads], options);
  list.innerHTML = shown.map(lead => `<article class="lead ${isOverdue(lead.next_follow_up_at) ? 'overdue' : ''}" data-id="${lead.id}">
    <div class="lead-row"><div><span class="date">${escapeHtml(formatDubaiDateTime(lead.captured_at))} Dubai</span><h2>${escapeHtml(lead.name)}</h2><span>${escapeHtml(lead.phone)} · ${escapeHtml(lead.email || 'No email')}</span></div>
    <div><b class="score">${Number(lead.lead_score)}</b><span class="temp ${escapeHtml(lead.temperature)}">${escapeHtml(lead.temperature)}</span></div>
    <div><span class="pill">${escapeHtml(statusLabel(lead.status))}</span><small>${escapeHtml(lead.assigned_to || 'Unassigned')}</small></div>
    <div class="follow-up ${isOverdue(lead.next_follow_up_at) ? 'due' : ''}"><b>${escapeHtml(formatDubaiDate(lead.next_follow_up_at))}</b><small>${isOverdue(lead.next_follow_up_at) ? 'Overdue follow-up' : 'Follow-up'}</small></div>
    <div class="row-actions"><a class="whatsapp" href="${whatsappUrl(lead.phone)}" target="_blank" rel="noopener noreferrer">WhatsApp</a><button data-action="expand" aria-expanded="false">Details</button></div></div>
    <div class="detail hidden"><div class="detail-copy"><p><b>Requirement</b>${escapeHtml(lead.requirement_summary || 'Qualification in progress')}</p><p><b>Qualification</b>${escapeHtml(lead.qualification_summary || 'Qualification in progress')}</p><p><b>Next action</b>${escapeHtml(lead.next_action || 'Not set')}</p><p><b>Property</b>${escapeHtml([lead.property_type, lead.bedrooms, lead.preferred_areas].filter(Boolean).join(' · ') || 'Not specified')}</p><p><b>Last contacted</b>${escapeHtml(formatDubaiDateTime(lead.last_contacted_at))}</p><p><b>Meeting / site visit</b>${escapeHtml(formatDubaiDateTime(lead.meeting_at))} / ${escapeHtml(formatDubaiDateTime(lead.site_visit_at))}</p></div>${controls(lead)}</div>
  </article>`).join('') || '<p class="empty">No leads match these filters.</p>';
}

function renderActionQueue(refreshing = 0) {
  const target = document.querySelector('#ai-queue');
  target.innerHTML = actionQueue.map(item => { const ai = item.ai_recommendation; const email = `Subject: Your Finding Stories property enquiry\n\nHello ${item.name},\n\n${ai.next_action}\n\nWould you be available for a brief conversation?\n\nFinding Stories`; return `<article class="ai-card ${item.ai_reviewed_at ? 'reviewed' : ''}" data-id="${item.id}">
    <span class="ai-badge">AI-GENERATED</span><span class="ai-priority">${escapeHtml(ai.priority)} · ${Number(ai.score)}/100</span>
    <h3>${escapeHtml(item.name)} <small>· ${escapeHtml(item.assigned_to || 'Unassigned')}</small></h3>
    <p><b>Why:</b> ${escapeHtml(ai.score_reason)}</p><p><b>Next:</b> ${escapeHtml(ai.next_action)} · ${escapeHtml(ai.follow_up_timing)}</p>
    ${item.escalations?.length ? `<p class="escalations">Escalation: ${escapeHtml(item.escalations.map(statusLabel).join(' · '))}</p>` : ''}
    <label>WhatsApp draft — edit before approval<textarea class="draft" data-draft="whatsapp">${escapeHtml(ai.whatsapp_draft)}</textarea></label>
    <button data-ai-action="approve" data-type="whatsapp">Approve WhatsApp</button>
    <label>Email draft — edit before approval<textarea class="draft" data-draft="email">${escapeHtml(email)}</textarea></label>
    <button data-ai-action="approve" data-type="email">Approve Email</button>
    <label>Call script<textarea class="draft" data-draft="call">${escapeHtml(ai.call_opening)}</textarea></label>
    <div class="row-actions"><button data-ai-action="approve-copy" data-type="call">Approve & Copy Call Script</button><button class="secondary" data-ai-action="schedule" data-type="follow_up">Schedule Follow-up</button><button class="secondary" data-ai-action="schedule" data-type="meeting">Schedule Meeting</button><button class="secondary" data-ai-action="schedule" data-type="site_visit">Schedule Site Visit</button><button class="secondary" data-ai-action="snooze">Snooze</button><button class="danger" data-ai-action="dismiss">Dismiss with Reason</button></div>
    ${(item.executions || []).filter(x => x.approval_status === 'approved' && x.execution_status !== 'completed').map(x => `<div class="execution"><b>Approved ${escapeHtml(statusLabel(x.action_type))}</b> · awaiting completion <button data-ai-action="complete" data-execution="${x.id}">Mark Completed</button>${['whatsapp','email'].includes(x.action_type) ? `<button class="secondary" data-copy-approved="${escapeHtml(x.advisor_edited_draft)}">Copy Approved Draft</button>` : ''}</div>`).join('')}
  </article>`; }).join('') || `<p class="empty">${refreshing ? `AI is preparing ${refreshing} recommendation(s). Refresh shortly.` : 'No advisor actions currently require review.'}</p>`;
}

function renderCommandCenter(data) {
  const labels = { hot_now:'Hot leads requiring action now',due_today:'Follow-ups due today',overdue:'Overdue follow-ups',opportunities:'Meeting / site-visit opportunities',approved_awaiting:'Approved actions awaiting completion',completed_today:'Completed actions today',stalled:'Stalled qualified opportunities' };
  document.querySelector('#command-center').innerHTML = Object.entries(labels).map(([key,label]) => `<div class="command-card"><b>${Number(data.command_center[key])}</b><span>${label}</span></div>`).join('');
  document.querySelector('#productivity').innerHTML = Object.entries(data.metrics).map(([key,value]) => `<div class="command-card"><b>${Number(value)}</b><span>${statusLabel(key)}</span></div>`).join('');
}

function metricsTable(title, rows, columns) {
  if (!rows?.length) return `<h3>${escapeHtml(title)}</h3><p class="empty">No attributable ${escapeHtml(title.toLowerCase())} data exists.</p>`;
  return `<h3>${escapeHtml(title)}</h3><table class="performance-table"><thead><tr>${columns.map(([,label])=>`<th>${escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(([key])=>`<td>${escapeHtml(row[key] ?? 0)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function renderAcquisition(acquisition) {
  document.querySelector('#acquisition-totals').innerHTML=`<div class="command-card"><b>${Number(acquisition.totals.enquiries)}</b><span>Organic enquiries</span></div><div class="command-card"><b>${Number(acquisition.traffic_without_enquiries.reduce((sum,x)=>sum+x.traffic,0))}</b><span>Visits without enquiries</span></div>`;
  const columns=[['name','Landing page'],['enquiries','Enquiries'],['qualified_rate','Qualified %'],['meeting_rate','Meeting %'],['site_visit_rate','Site visit %'],['booking_rate','Booking %']];
  document.querySelector('#acquisition-performance').innerHTML=metricsTable('Landing-page performance',acquisition.by_page,columns)+metricsTable('Area performance',acquisition.by_area,columns)+metricsTable('Project performance',acquisition.by_project,columns)+metricsTable('Developer performance',acquisition.by_developer,columns)+metricsTable('Traffic with no enquiries',acquisition.traffic_without_enquiries,[['name','Landing page'],['traffic','Visits']]);
}

function renderRecovery(recovery) {
  const labels={total_recoverable_leads:'Recoverable leads',immediate_recovery_leads:'Immediate recovery',overdue_hot_warm:'Overdue HOT/WARM',meeting_recovery:'Meeting recovery',site_visit_recovery:'Site-visit recovery',stale_property_matches:'Stale property matches',unassigned_opportunities:'Unassigned opportunities',estimated_recoverable_pipeline:'Recoverable pipeline',recovery_attempts_approved:'Attempts approved',recovered_contacts:'Recovered contacts',meetings_recovered:'Meetings recovered',site_visits_recovered:'Site visits recovered',conversions_after_recovery:'Conversions after recovery'};
  document.querySelector('#recovery-metrics').innerHTML=Object.entries(labels).map(([key,label])=>`<div class="command-card"><b>${escapeHtml(recovery.metrics[key])}</b><span>${label}</span></div>`).join('');
  document.querySelector('#recovery-queue').innerHTML=recovery.queue.map(item=>`<article class="ai-card priority-card" data-recovery-id="${item.id}"><span class="ai-badge">${escapeHtml(item.recovery_band)}</span><span class="ai-priority">${item.recovery_priority_score}/100 · ${escapeHtml(item.temperature)}</span><h3>${escapeHtml(item.name)} <small>· ${escapeHtml(item.owner)}</small></h3><p><b>Risk:</b> ${escapeHtml(item.why)} · ${escapeHtml(item.days_inactive)} days inactive</p><p><b>History:</b> ${escapeHtml(item.previous_engagement)} · <b>Property:</b> ${escapeHtml(item.property_match_status)} · <b>Pipeline:</b> ${item.pipeline_probability}%</p><p><b>Factors:</b> ${escapeHtml(item.score_factors.join(' · ')||'No positive factors')}</p><p><b>Recommendation:</b> ${escapeHtml(item.recommended_action)} ${escapeHtml(item.recommended_timing)}<br>${escapeHtml(item.suggested_angle)}</p><p><b>Objective:</b> ${escapeHtml(item.follow_up_objective)}</p><div class="row-actions"><button data-recovery-action="lead">Review Lead / History</button><button data-recovery-action="property">Review Property Match</button><button data-recovery-action="whatsapp">Copy WhatsApp Win-Back</button><button data-recovery-action="call">Copy Call Script</button><button data-recovery-action="follow_up">Schedule Follow-up</button><button data-recovery-action="meeting">Schedule Meeting</button><button data-recovery-action="site_visit">Schedule Site Visit</button><button class="secondary" data-recovery-action="snooze">Snooze</button><button class="danger" data-recovery-action="dismiss">Mark Not Recoverable</button><button class="danger" data-recovery-action="lost">Mark Lost</button></div></article>`).join('')||'<p class="empty">No recoverable leakage candidates outside the duplicate-contact cooldown.</p>';
}

function renderPipeline(pipeline) {
  const overviewLabels={total_active_leads:'Active leads',qualified_leads:'Qualified',property_matched_leads:'Property matched',meetings_scheduled:'Meetings scheduled',meetings_completed:'Meetings done',site_visits_scheduled:'Site visits scheduled',site_visits_completed:'Site visits done',active_booking_opportunities:'Booking opportunities',converted_leads:'Converted',lost_leads:'Lost',weighted_pipeline:'Weighted pipeline',conversion_rate:'Conversion rate %'};
  document.querySelector('#pipeline-overview').innerHTML=Object.entries(overviewLabels).map(([key,label])=>`<div class="command-card"><b>${escapeHtml(pipeline.overview[key])}</b><span>${label}</span></div>`).join('');
  document.querySelector('#pipeline-funnel').innerHTML=Object.entries(pipeline.overview.funnel).map(([stage,count])=>`<div class="funnel-step"><b>${Number(count)}</b><span>${escapeHtml(stage)}</span></div>`).join('');
  const forecast={...pipeline.forecasts,likely_meetings:pipeline.likely_meetings,likely_site_visits:pipeline.likely_site_visits,likely_bookings:pipeline.likely_bookings,immediate_intervention:pipeline.immediate_intervention};
  document.querySelector('#pipeline-forecasts').innerHTML=Object.entries(forecast).map(([key,value])=>`<div class="command-card"><b>${Number(value)}</b><span>${escapeHtml(statusLabel(key))}</span></div>`).join('');
  document.querySelector('#revenue-priority').innerHTML=pipeline.priority_queue.map(item=>`<article class="ai-card priority-card" data-priority-id="${item.id}"><span class="ai-badge">${escapeHtml(item.probability_band)}</span><span class="ai-priority">${item.expected_conversion_probability}% · ${escapeHtml(item.temperature)}</span><h3>${escapeHtml(item.name)} <small>· ${escapeHtml(item.stage)}</small></h3><p><b>Property:</b> ${escapeHtml(item.property_match_state)} · <b>Close:</b> ${escapeHtml(item.projected_close_window)}${item.overdue?' · <span class="escalations">OVERDUE</span>':''}</p><p><b>Next:</b> ${escapeHtml(item.next_action)}</p><p><b>Value:</b> ${escapeHtml(item.expected_gross_transaction_value)} · weighted ${escapeHtml(item.weighted_pipeline_value)}</p><div class="row-actions"><button data-priority-action="lead">Review Lead</button><button data-priority-action="property">Review Property Match</button><button data-priority-action="ai">Review AI Recommendation</button><button data-priority-action="whatsapp">Copy WhatsApp Draft</button><button data-priority-action="call">Copy Call Script</button><button data-priority-action="follow_up">Schedule Follow-up</button><button data-priority-action="meeting">Schedule Meeting</button><button data-priority-action="site_visit">Schedule Site Visit</button><button data-priority-action="interested">Mark Interested</button><button class="danger" data-priority-action="lost">Mark Lost</button></div></article>`).join('')||'<p class="empty">No active revenue opportunities.</p>';
  const advisorColumns=[['advisor','Advisor'],['leads_assigned','Assigned'],['contacted','Contacted'],['qualified','Qualified'],['meetings','Meetings'],['site_visits','Site visits'],['bookings','Bookings'],['conversions','Conversions'],['overdue_follow_ups','Overdue'],['conversion_rate','Conversion %'],['active_pipeline_count','Active']];
  document.querySelector('#advisor-performance').innerHTML=metricsTable('Advisor performance',pipeline.advisor_metrics,advisorColumns);
  const projectColumns=[['name','Name'],['recommendations','Recommendations'],['interested_leads','Interested'],['meetings_generated','Meetings'],['site_visits_generated','Site visits'],['conversions','Conversions']];
  document.querySelector('#project-performance').innerHTML=['project','developer','area'].map(key=>metricsTable(`${statusLabel(key)} performance`,pipeline.project_metrics[key],projectColumns)).join('');
}

function propertyCopy(item, kind) {
  const top=item.matches.slice(0,3); const intro=`${item.name}: ${top.length} advisor-reviewed option(s) based only on stated requirements.`;
  const options=top.map((x,index)=>`${index+1}. ${x.project} (${x.tier}, ${x.score}/100) — ${x.why.join(', ')}. Trade-offs: ${x.does_not_match.join(', ')||'none known'}. ${x.data_quality==='VERIFIED INVENTORY'?'Inventory record is verified, but current pricing and unit availability still require confirmation.':'Advisory project data only; pricing and availability must be verified.'}`).join('\n');
  return kind==='compare' ? `Top ${top.length} comparison for ${item.name}\n${options}\nAdvisor must validate missing requirements before presentation.` : kind==='call' ? `${intro}\nDiscuss: ${options}` : kind==='meeting' ? `${intro}\nMeeting pitch: compare trade-offs and validate missing requirements.\n${options}` : `${intro}\n${options}\nWould you like an advisor to verify availability and discuss these options?`;
}
function renderPropertyOpportunities(inventoryCount=0) {
  const target=document.querySelector('#property-opportunities');
  target.innerHTML=propertyOpportunities.map(item=>{const top=item.strongest_match; return `<article class="ai-card" data-property-id="${item.id}">
    <span class="ai-badge">ADVISOR INTELLIGENCE</span><span class="ai-priority">${escapeHtml(item.temperature)} · ${item.match_count} match(es)</span><h3>${escapeHtml(item.name)}</h3>
    <p><b>Requirement:</b> ${escapeHtml([item.requirement_profile.property_type,item.requirement_profile.bedrooms,item.requirement_profile.emirate,item.requirement_profile.preferred_areas.join(', ')].filter(Boolean).join(' · ')||'Incomplete')}</p>
    ${item.missing_requirements.length?`<p class="escalations">Missing: ${escapeHtml(item.missing_requirements.join(' · '))}</p>`:''}
    ${top?`<p><b>Strongest:</b> ${escapeHtml(top.project)} · ${top.score}/100 · ${top.tier}<br><span class="quality">${escapeHtml(top.data_quality)}</span></p>
      ${item.matches.slice(0,3).map(x=>`<div class="property-match"><b>${escapeHtml(x.project)} · ${x.score}/100 · ${x.tier}</b><p>Why: ${escapeHtml(x.why.join(', '))}<br>Does not match: ${escapeHtml(x.does_not_match.join(', ')||'None known')}<br>Next: ${escapeHtml(x.recommended_next_action)}</p></div>`).join('')}`:'<p>No suitable match. Do not force-fit an option.</p>'}
    <p><b>Readiness:</b> Meeting ${item.meeting_ready?'ready':'not ready'} · Site visit ${item.site_visit_ready?'ready':'not ready'}</p>
    <div class="row-actions"><button data-property-action="reviewed">Review Match</button><button class="secondary" data-property-copy="compare">Compare Top 3</button><button class="secondary" data-property-copy="whatsapp">Copy WhatsApp Recommendation</button><button class="secondary" data-property-copy="call">Copy Call Pitch</button><button class="secondary" data-property-copy="meeting">Copy Meeting Pitch</button><button data-property-action="interested">Mark Interested</button><button class="danger" data-property-action="not_suitable">Mark Not Suitable</button><button class="secondary" data-property-schedule="follow_up">Schedule Follow-up</button><button class="secondary" data-property-schedule="meeting">Schedule Meeting</button><button class="secondary" data-property-schedule="site_visit">Schedule Site Visit</button></div></article>`}).join('')||`<p class="empty">${inventoryCount?'No qualified property opportunities.':'No inventory has been loaded. The system will not invent live inventory.'}</p>`;
}

async function revenueAction(payload) {
  const response = await fetch('/api/admin/leads/update?view=revenue', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Action failed'); await loadActionQueue();
}

async function loadActionQueue() {
  const response = await fetch('/api/admin/leads?view=revenue'); if (!response.ok) return;
  const data = await response.json(); window.__recovery=data.recovery?.queue||[]; actionQueue = data.queue; propertyOpportunities=data.property_opportunities||[]; renderActionQueue(data.refreshing); renderPropertyOpportunities(data.inventory_count); renderCommandCenter(data); renderAcquisition(data.acquisition); renderPipeline(data.pipeline); renderRecovery(data.recovery);
}

document.querySelector('#recovery-queue').addEventListener('click',async event=>{
  const button=event.target.closest('button'); if(!button)return; const card=button.closest('[data-recovery-id]'); const id=card.dataset.recoveryId; const item=window.__recovery?.find(x=>x.id===id); const action=button.dataset.recoveryAction;
  try { if(action==='lead'){const lead=document.querySelector(`.lead[data-id="${id}"]`);lead?.scrollIntoView({behavior:'smooth'});lead?.querySelector('[data-action="expand"]')?.click();}
    else if(action==='property')document.querySelector(`[data-property-id="${id}"]`)?.scrollIntoView({behavior:'smooth'});
    else if(action==='whatsapp'||action==='call'){await window.navigator.clipboard.writeText(action==='whatsapp'?item.whatsapp_draft:item.call_opening);button.textContent='Copied — advisor review required';}
    else if(['follow_up','meeting','site_visit'].includes(action)){const value=window.prompt('Schedule date/time (ISO 8601, including timezone):',new Date(Date.now()+864e5).toISOString());if(value)await revenueAction({id,action:'schedule',action_type:action,scheduled_for:new Date(value).toISOString(),recovery:true});}
    else if(action==='snooze'){const value=window.prompt('Snooze until:',new Date(Date.now()+7*864e5).toISOString());if(value)await revenueAction({id,action:'snooze',snoozed_until:new Date(value).toISOString(),recovery:true});}
    else if(action==='dismiss'){const reason=window.prompt('Why is this lead not recoverable?');if(reason?.trim())await revenueAction({id,action:'dismiss',reason:reason.trim(),recovery:true});}
    else if(action==='lost'){const reason=window.prompt('Lost reason (required):');if(reason?.trim()){await update({id,action:'lost',lost_reason:reason.trim()});await load();}}
  } catch(error){window.alert(error.message);}
});

document.querySelector('#revenue-priority').addEventListener('click',async event=>{
  const button=event.target.closest('button'); if(!button)return; const id=button.closest('[data-priority-id]').dataset.priorityId; const action=button.dataset.priorityAction;
  try {
    if(action==='lead'){const card=document.querySelector(`.lead[data-id="${id}"]`); card?.scrollIntoView({behavior:'smooth'}); card?.querySelector('[data-action="expand"]')?.click();}
    else if(action==='property') document.querySelector(`[data-property-id="${id}"]`)?.scrollIntoView({behavior:'smooth'});
    else if(action==='ai') document.querySelector(`.ai-card[data-id="${id}"]`)?.scrollIntoView({behavior:'smooth'});
    else if(['whatsapp','call'].includes(action)){const item=actionQueue.find(x=>x.id===id); const draft=action==='whatsapp'?item?.ai_recommendation?.whatsapp_draft:item?.ai_recommendation?.call_opening;if(!draft)throw new Error('No AI draft exists. Nothing was fabricated.');await window.navigator.clipboard.writeText(draft);button.textContent='Copied — review before use';}
    else if(['follow_up','meeting','site_visit'].includes(action)){const value=window.prompt('Schedule date/time (ISO 8601, including timezone):',new Date(Date.now()+864e5).toISOString());if(value)await revenueAction({id,action:'schedule',action_type:action,scheduled_for:new Date(value).toISOString()});}
    else if(action==='interested') await revenueAction({id,action:'property_status',status:'interested'});
    else if(action==='lost'){const reason=window.prompt('Lost reason (required):');if(reason?.trim()){await update({id,action:'lost',lost_reason:reason.trim()});await load();}}
  } catch(error){window.alert(error.message);}
});

document.querySelector('#property-opportunities').addEventListener('click',async event=>{
  const button=event.target.closest('button'); if(!button)return; const card=button.closest('[data-property-id]'); const id=card.dataset.propertyId; const item=propertyOpportunities.find(x=>x.id===id);
  try { if(button.dataset.propertyCopy){await window.navigator.clipboard.writeText(propertyCopy(item,button.dataset.propertyCopy));button.textContent='Copied — human review required';}
    else if(button.dataset.propertyAction) await revenueAction({id,action:'property_status',status:button.dataset.propertyAction});
    else if(button.dataset.propertySchedule){const value=window.prompt('Schedule date/time (ISO 8601, including timezone):',new Date(Date.now()+864e5).toISOString());if(value)await revenueAction({id,action:'schedule',action_type:button.dataset.propertySchedule,scheduled_for:new Date(value).toISOString()});}
  } catch(error){window.alert(error.message);} });

document.querySelector('#ai-queue').addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.copyApproved) { await window.navigator.clipboard.writeText(button.dataset.copyApproved); button.textContent='Copied — paste manually'; return; }
  const card=button.closest('.ai-card'); const id=card.dataset.id; const action=button.dataset.aiAction;
  try {
    if (action === 'approve' || action === 'approve-copy') { const type=button.dataset.type; const draft=card.querySelector(`[data-draft="${type}"]`).value.trim(); await revenueAction({id,action:'approve',action_type:type,draft}); if(action==='approve-copy') await window.navigator.clipboard.writeText(draft); }
    else if (action === 'schedule') { const scheduled_for=window.prompt('Schedule date/time (ISO 8601, including timezone):', new Date(Date.now()+864e5).toISOString()); if(scheduled_for) await revenueAction({id,action:'schedule',action_type:button.dataset.type,scheduled_for:new Date(scheduled_for).toISOString()}); }
    else if (action === 'snooze') { const value=window.prompt('Snooze until (ISO 8601, including timezone):',new Date(Date.now()+864e5).toISOString()); if(value) await revenueAction({id,action:'snooze',snoozed_until:new Date(value).toISOString()}); }
    else if (action === 'dismiss') { const reason=window.prompt('Reason for dismissal:'); if(reason?.trim()) await revenueAction({id,action:'dismiss',reason:reason.trim()}); }
    else if (action === 'complete') { const outcome=window.prompt('Outcome (required):'); if(outcome?.trim()) await revenueAction({id,action:'complete',execution_id:button.dataset.execution,outcome:outcome.trim()}); }
  } catch(error) { window.alert(error.message); }
});

async function update(payload) {
  const response = await fetch('/api/admin/leads/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Update failed');
  const index = leads.findIndex(lead => lead.id === data.lead.id);
  if (index >= 0) leads[index] = data.lead;
}

async function saveCard(card, shortcut) {
  const id = card.dataset.id;
  const message = card.querySelector('.save-message');
  message.textContent = 'Saving…';
  try {
    if (shortcut === 'contacted' || shortcut === 'booked') await update({ action: shortcut, id });
    else if (shortcut === 'lost') {
      const lost_reason = card.querySelector('[data-field="lost_reason"]').value.trim();
      await update({ action: 'lost', id, lost_reason });
    } else {
      const fields = [['status','status'],['assign','assigned_to'],['notes','agent_notes'],['follow_up','next_follow_up_at'],['meeting','meeting_at'],['site_visit','site_visit_at']];
      for (const [action, field] of fields) {
        const raw = card.querySelector(`[data-field="${field}"]`).value;
        await update({ action, id, [field]: field.endsWith('_at') ? isoOrNull(raw) : raw });
      }
      if (card.querySelector('[data-field="status"]').value === 'lost') await update({ action: 'lost', id, lost_reason: card.querySelector('[data-field="lost_reason"]').value.trim() });
    }
    render();
  } catch (error) { message.textContent = error.message; }
}

list.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const card = button.closest('.lead');
  if (button.dataset.action === 'expand') {
    const detail = card.querySelector('.detail'); detail.classList.toggle('hidden'); button.setAttribute('aria-expanded', String(!detail.classList.contains('hidden')));
  } else saveCard(card, button.dataset.action);
});

for (const control of document.querySelectorAll('.filters input, .filters select')) control.addEventListener('input', render);

async function load() {
  clearTimeout(refreshTimer);
  const response = await fetch('/api/admin/leads');
  if (response.status === 401) { login.classList.remove('hidden'); crm.classList.add('hidden'); return; }
  const data = await response.json();
  if (!response.ok) { errorBox.textContent = data.error; return; }
  leads = data.leads; login.classList.add('hidden'); crm.classList.remove('hidden');
  const labels = [['total','Total leads'],['new','New leads'],['hot','Hot leads'],['warm','Warm leads'],['cold','Cold leads'],['processing','Processing']];
  document.querySelector('#stats').innerHTML = labels.map(([key,label]) => `<div class="stat"><b>${Number(data.counts[key])}</b><span>${label}</span></div>`).join('');
  const agent = document.querySelector('#agent'); const selected = agent.value;
  agent.innerHTML = '<option value="">All agents</option>' + [...new Set(leads.map(lead => lead.assigned_to).filter(Boolean))].sort().map(value => `<option>${escapeHtml(value)}</option>`).join(''); agent.value = selected;
  render();
  loadActionQueue();
  if (data.counts.processing > 0) refreshTimer = setTimeout(load, 3000);
}

document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); errorBox.textContent = '';
  const password = new FormData(event.currentTarget).get('password');
  const response = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password}) });
  const data = await response.json();
  if (!response.ok) { errorBox.textContent = data.error; return; }
  event.currentTarget.reset(); load();
});
document.querySelector('#logout').onclick = async () => { clearTimeout(refreshTimer); await fetch('/api/admin/logout',{method:'POST'}); location.reload(); };
load();
