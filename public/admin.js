import { filterAndSortLeads, formatDubaiDate, formatDubaiDateTime, isOverdue } from './crm-utils.js';
import { createAdminLogin } from './admin-login.js';
import { canDeleteLeads, canUseLeadSelection, selectedListedIds, selectionForRoute, toggleAllListed } from './crm-lead-selection.js';
import { applyCrmRoute } from './crm-routing.js';
import { parseUnitTypesTextarea } from './project-ingestion-form.js';
import { uploadProjectSource } from './project-source-upload-client.js';

const login = document.querySelector('#login');
const crm = document.querySelector('#crm');
const errorBox = document.querySelector('#login-error');
const list = document.querySelector('#leads');
let leads = [];
let actionQueue = [];
let propertyOpportunities = [];
let refreshTimer;
let currentRole = null;
let selectedLeadIds = new Set();
let listedLeadIds = [];

const sourceTypes={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',csv:'text/csv',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const sourceKind=name=>/master.?plan/i.test(name)?'master_plan':/floor.?plan/i.test(name)?'floor_plan':/brochure/i.test(name)?'brochure':/price/i.test(name)?'price_list':/payment/i.test(name)?'payment_plan':/inventory/i.test(name)?'inventory':'other';
let projectSourceConfig=null,projectSourceUploads=[];
const formatBytes=bytes=>bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.ceil(bytes/1024)} KB`;
async function getProjectSourceConfig(){if(projectSourceConfig)return projectSourceConfig;const response=await fetch('/api/admin/leads/update?view=project-source-upload');if(!response.ok)throw new Error('Could not load upload limits.');return projectSourceConfig=await response.json();}
function renderProjectSources(){const target=document.querySelector('#project-source-list');target.innerHTML=projectSourceUploads.map(item=>`<div class="source-upload-item" data-source-upload="${item.id}"><span><b>${escapeHtml(item.file.name)}</b><br><small>${escapeHtml(item.media_type||item.file.type||'Unknown')} · ${formatBytes(item.file.size)}</small></span><progress max="100" value="${item.progress}">${item.progress}%</progress><span class="source-upload-${item.status}">${escapeHtml(item.status==='failed'?`Failed: ${item.error}`:item.status==='success'?'Uploaded successfully':`Uploading · ${item.progress}%`)}</span><span><button type="button" class="secondary" data-source-retry ${item.status==='failed'?'':'hidden'}>Retry</button> <button type="button" class="danger" data-source-remove>Remove</button></span></div>`).join('');}
async function uploadSourceItem(item){item.status='uploading';item.error='';renderProjectSources();try{const config=await getProjectSourceConfig(),limit=config.limits[item.media_type]?.bytes;if(!limit)throw new Error('Unsupported file type. Only PDF, CSV, XLS, XLSX, PNG, and JPEG are allowed.');if(item.file.size>limit)throw new Error(`Exceeds the ${config.limits[item.media_type].mb} MB limit.`);const stored=await uploadProjectSource(item.file,item.media_type,event=>{item.progress=Math.round(event.percentage);renderProjectSources();});Object.assign(item,stored,{status:'success',progress:100});}catch(error){item.status='failed';item.error=error.message||'Upload failed.';}renderProjectSources();}
async function removeSourceItem(item){projectSourceUploads=projectSourceUploads.filter(x=>x!==item);renderProjectSources();if(item.storage_path)await fetch('/api/admin/leads/update?view=project-source-upload',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({storage_path:item.storage_path})});}
async function loadProjectIngestions(){
  if(currentRole!=='SUPER_ADMIN')return; const response=await fetch('/api/admin/leads/update?view=project-ingestion'); if(!response.ok)return;
  const {ingestions}=await response.json(),target=document.querySelector('#project-ingestion-list');
  target.innerHTML=ingestions.map(x=>`<article class="ai-card" data-ingestion-id="${escapeHtml(x.id)}"><span class="ai-badge">${escapeHtml(statusLabel(x.status))}</span><span class="ai-priority">${escapeHtml(x.import_kind==='create'?'New project':'Project update')}${x.is_test?' · TEST environment':' · PRODUCTION environment'}</span><h3>${escapeHtml(x.developer)} · ${escapeHtml(x.project)}</h3><p><b>${x.availability_mode==='PRE_LAUNCH'?'PRE-LAUNCH — UNIT INVENTORY NOT RELEASED':'Project details'}:</b> ${escapeHtml([x.emirate,x.area,x.construction_status,x.handover].filter(Boolean).join(' · ')||'Awaiting verification')}</p><p><b>Sources:</b> ${(x.sources||[]).map(s=>`${escapeHtml(s.filename)} (${escapeHtml(s.media_type)})`).join(' · ')||'No source files'}</p><p><b>Extracted unit types:</b> ${Number(x.unit_type_count)} · <b>Physical inventory:</b> ${Number(x.inventory_count)} row(s)</p>${x.unit_types?.length?`<div class="inventory-review"><table class="performance-table"><thead><tr><th>Unit type</th><th>Property</th><th>Size range</th><th>Starting price</th><th>Source</th></tr></thead><tbody>${x.unit_types.map(u=>`<tr><td>${escapeHtml(u.unit_type)}</td><td>${escapeHtml(u.property_type)}</td><td>${escapeHtml([u.minimum_area,u.maximum_area].filter(v=>v!=null).join('–')||'—')}</td><td>${escapeHtml(u.starting_price==null?'—':`${u.price_currency} ${u.starting_price}`)}</td><td>${escapeHtml(u.source_reference||'Needs review')}</td></tr>`).join('')}</tbody></table></div>`:''}${x.inventory?.length?`<div class="inventory-review"><table class="performance-table"><thead><tr><th>Unit</th><th>Type</th><th>Beds</th><th>Price</th><th>Status</th></tr></thead><tbody>${x.inventory.map(item=>`<tr><td>${escapeHtml(item.unit)}</td><td>${escapeHtml(item.property_type)}</td><td>${escapeHtml(item.bedrooms)}</td><td>${escapeHtml(item.minimum_price??'—')}</td><td>${escapeHtml(statusLabel(item.review_status))}</td></tr>`).join('')}</tbody></table></div>`:''}<p><b>Validation results:</b> ${x.issues?.length?`<span class="error">${escapeHtml(x.issues.map(i=>`${i.path?.join('.')}: ${i.message}`).join(' · '))}</span>`:'No validation issues · ready for SUPER_ADMIN decision'}</p>${x.status==='needs_review'?'<div class="row-actions"><button data-ingestion-decision="approve">Approve &amp; publish</button><button class="danger" data-ingestion-decision="reject">Reject</button></div>':`<p><b>Review outcome:</b> ${escapeHtml(statusLabel(x.status))}${x.active?' · active and published':' · inactive and unpublished'}</p>`}</article>`).join('')||'<p class="empty">No project imports yet. Use Add / Upload Project to begin a reviewed import.</p>';
}
async function reviewProjectIngestion(id,decision){const response=await fetch('/api/admin/leads/update?view=project-ingestion',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,decision})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Review failed.');await loadProjectIngestions();}

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
    <label>Attributed revenue (AED)<input data-field="attributed_revenue" type="number" min="0" step="0.01" value="${escapeHtml(lead.attributed_revenue ?? '')}" placeholder="Only after booking"></label>
    <label class="wide">Agent notes<textarea data-field="agent_notes" maxlength="5000">${escapeHtml(lead.agent_notes)}</textarea></label>
    <label class="wide">Lost reason<input data-field="lost_reason" maxlength="500" value="${escapeHtml(lead.lost_reason)}" placeholder="Required when marking lost"></label>
  </div><div class="actions"><button data-action="save">Save changes</button><button data-action="contacted" class="secondary">Mark contacted</button><button data-action="booked" class="secondary">Mark booked</button><button data-action="lost" class="danger">Mark lost</button>${canDeleteLeads(currentRole) ? '<button data-action="delete" class="danger">Delete lead</button>' : ''}<span class="save-message" role="status"></span></div>`;
}

function renderSelection() {
  const allowed=canUseLeadSelection(currentRole,crm.dataset.activeRoute),bar=document.querySelector('#lead-bulk-actions'),all=document.querySelector('#select-all-leads');
  selectedLeadIds=selectedListedIds(selectedLeadIds,listedLeadIds);
  const count=selectedLeadIds.size,selectedListed=listedLeadIds.filter(id=>selectedLeadIds.has(id)).length;
  bar.classList.toggle('hidden',!allowed);
  document.querySelector('#selected-lead-count').textContent=`${count} lead${count===1?'':'s'} selected`;
  all.checked=listedLeadIds.length>0&&selectedListed===listedLeadIds.length;
  all.indeterminate=selectedListed>0&&selectedListed<listedLeadIds.length;
}

function resetLeadSelectionForRoute(route) {
  selectedLeadIds=selectionForRoute(selectedLeadIds,route);
  if(route==='leads')return;
  const dialog=document.querySelector('#delete-leads-dialog');
  if(dialog.open)dialog.close();
}

function handleCrmRouteChange() {
  const route=applyCrmRoute(crm,location.hash,currentRole);
  resetLeadSelectionForRoute(route);
  render();
}

function render() {
  const options = { query: document.querySelector('#search').value, temperature: document.querySelector('#temperature').value,
    status: document.querySelector('#status-filter').value, agent: document.querySelector('#agent').value, sort: document.querySelector('#sort').value };
  const shown = filterAndSortLeads([...leads], options);
  listedLeadIds=shown.map(lead=>lead.id); selectedLeadIds=selectedListedIds(selectedLeadIds,listedLeadIds);
  const selectionEnabled=canUseLeadSelection(currentRole,crm.dataset.activeRoute);
  list.innerHTML = shown.map(lead => `<article class="lead ${isOverdue(lead.next_follow_up_at) ? 'overdue' : ''}" data-id="${lead.id}">
    <div class="lead-row ${selectionEnabled?'super-admin-row':''}">${selectionEnabled?`<input class="lead-select" data-select-lead type="checkbox" aria-label="Select ${escapeHtml(lead.name)}" ${selectedLeadIds.has(lead.id)?'checked':''}>`:''}<div><span class="date">${escapeHtml(formatDubaiDateTime(lead.captured_at))} Dubai</span><h2>${escapeHtml(lead.name)}</h2><span>${escapeHtml(lead.phone)} · ${escapeHtml(lead.email || 'No email')}</span></div>
    <div><b class="score">${Number(lead.lead_score)}</b><span class="temp ${escapeHtml(lead.temperature)}">${escapeHtml(lead.temperature)}</span></div>
    <div><span class="pill">${escapeHtml(statusLabel(lead.status))}</span><small>${escapeHtml(lead.assigned_to || 'Unassigned')}</small></div>
    <div class="follow-up ${isOverdue(lead.next_follow_up_at) ? 'due' : ''}"><b>${escapeHtml(formatDubaiDate(lead.next_follow_up_at))}</b><small>${isOverdue(lead.next_follow_up_at) ? 'Overdue follow-up' : 'Follow-up'}</small></div>
    <div class="row-actions"><a class="whatsapp" href="${whatsappUrl(lead.phone)}" target="_blank" rel="noopener noreferrer">WhatsApp</a><button data-action="expand" aria-expanded="false">Details</button></div></div>
    <div class="detail hidden"><div class="detail-copy"><p><b>Requirement</b>${escapeHtml(lead.requirement_summary || 'Qualification in progress')}</p><p><b>Qualification</b>${escapeHtml(lead.qualification_summary || 'Qualification in progress')}</p><p><b>Next action</b>${escapeHtml(lead.next_action || 'Not set')}</p><p><b>Property</b>${escapeHtml([lead.property_type, lead.bedrooms, lead.preferred_areas].filter(Boolean).join(' · ') || 'Not specified')}</p><p><b>Last contacted</b>${escapeHtml(formatDubaiDateTime(lead.last_contacted_at))}</p><p><b>Meeting / site visit</b>${escapeHtml(formatDubaiDateTime(lead.meeting_at))} / ${escapeHtml(formatDubaiDateTime(lead.site_visit_at))}</p></div>${controls(lead)}</div>
  </article>`).join('') || '<p class="empty">No leads match these filters.</p>';
  renderSelection();
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

function renderBinghattiAttribution(data) {
  const labels={inventory_coverage:'Verified inventory',leads:'Binghatti / JVC leads',qualified:'Qualified',matched_leads:'Matched leads',meetings:'Meetings',site_visits:'Site visits',bookings:'Bookings',attributed_revenue:'Attributed revenue (AED)'};
  document.querySelector('#binghatti-attribution').innerHTML=Object.entries(labels).map(([key,label])=>`<div class="command-card"><b>${escapeHtml(data?.[key] ?? 0)}</b><span>${label}</span></div>`).join('');
}

function renderBinghattiActivation(data) {
  const target=document.querySelector('#binghatti-activation');
  if(data.activated){target.innerHTML=data.verified?'<p class="ai-notice">Amberhall production inventory activated and verified. The one-time activation control is permanently disabled. Verify: <a href="/projects/binghatti-developers/binghatti-amberhall" target="_blank">Amberhall</a> · <a href="/dubai/property-for-sale/jumeirah-village-circle-jvc" target="_blank">JVC</a> · <a href="/dubai/1-bedroom-apartments/jumeirah-village-circle-jvc" target="_blank">JVC 1-bedroom</a> · <a href="/sitemap.xml" target="_blank">sitemap</a>. Property matching, Revenue Command Center, and attribution have been refreshed below.</p>':'<p class="error">Activation is permanently disabled, but inventory verification is not healthy. Do not reactivate; investigate the production records.</p>';return;}
  const records=(data.records||[]).map(item=>`${escapeHtml(item.unit)}: ${escapeHtml(item.status)} / ${escapeHtml(item.data_quality)} / is_test=${escapeHtml(item.is_test)}`).join('<br>');
  target.innerHTML=`<article class="ai-card"><span class="ai-badge">ONE-TIME PRODUCTION ACTIVATION</span><p>Imports only the two repository-verified Amberhall records inside the authenticated production runtime. It creates no leads, revenue, customers, conversions, or analytics.</p>${records?`<p>${records}</p>`:''}<button id="activate-binghatti">Activate and verify inventory</button><span id="activation-message" role="status"></span></article>`;
  document.querySelector('#activate-binghatti').onclick=activateBinghatti;
}

async function loadBinghattiActivation(){const response=await fetch('/api/admin/leads/update?view=inventory-activation');if(response.ok)renderBinghattiActivation(await response.json());}
async function activateBinghatti(){
  if(!window.confirm('Activate exactly BAMH-1545 and BAMH-634 in production? This can run successfully only once.'))return;
  const button=document.querySelector('#activate-binghatti'),message=document.querySelector('#activation-message');button.disabled=true;message.textContent=' Activating and verifying…';
  try {
    const response=await fetch('/api/admin/leads/update?view=inventory-activation',{method:'POST',signal:window.AbortSignal.timeout(30000)});const data=await response.json();
    if(!response.ok){message.textContent=` ${data.error||'Activation failed safely.'}`;button.disabled=false;return;}
    renderBinghattiActivation(data);await loadActionQueue();
  } catch {
    message.textContent=' Activation did not complete within 30 seconds. Refresh to verify status before trying again.';button.disabled=false;
  }
}

function renderAcquisition(acquisition, coverage) {
  document.querySelector('#acquisition-totals').innerHTML=`<div class="command-card"><b>${Number(acquisition.totals.enquiries)}</b><span>Organic enquiries</span></div><div class="command-card"><b>${Number(acquisition.totals.qualified)}</b><span>Qualified leads</span></div><div class="command-card"><b>${Number(acquisition.totals.meetings)}</b><span>Meetings</span></div><div class="command-card"><b>${Number(acquisition.totals.site_visits)}</b><span>Site visits</span></div><div class="command-card"><b>${Number(acquisition.traffic_without_enquiries.reduce((sum,x)=>sum+x.traffic,0))}</b><span>Visits without enquiries</span></div>`;
  const summary={verified_inventory_coverage_percentage:coverage.verified_inventory_coverage_percentage,...coverage.pages,area_coverage:coverage.coverage.area.percentage,developer_coverage:coverage.coverage.developer.percentage,project_coverage:coverage.coverage.project.percentage,bedroom_coverage:coverage.coverage.bedroom.percentage,budget_bands:`${coverage.coverage.budget_band.covered}/${coverage.coverage.budget_band.total}`};
  document.querySelector('#acquisition-coverage').innerHTML=Object.entries(summary).map(([key,value])=>`<div class="command-card"><b>${escapeHtml(value)}</b><span>${escapeHtml(statusLabel(key))}${key.includes('coverage')?' %':''}</span></div>`).join('');
  document.querySelector('#acquisition-refresh').innerHTML=metricsTable('SEO refresh and expansion queue',coverage.queue.slice(0,30),[['intent','Intent'],['state','State'],['verified_count','Verified inventory'],['path','Canonical path'],['reasons','Remediation']]);
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

let seoOpportunities=[];
function renderSearchConsole(data){
 const readiness=document.querySelector('#search-console-readiness');readiness.innerHTML=`<article class="ai-card"><span class="ai-badge">SEARCH CONSOLE: ${escapeHtml(data.connection.status)}</span><p>${escapeHtml(data.connection.message)}</p>${data.connection.missing.length?`<p><b>Required configuration:</b> ${escapeHtml(data.connection.missing.join(' · '))}</p>`:''}${data.data_notice?`<p class="escalations">${escapeHtml(data.data_notice)}</p>`:''}${data.connection.connected?'<button id="import-search-console">Import latest genuine report</button>':''}</article>`;
 const m=data.metrics;document.querySelector('#organic-growth-metrics').innerHTML=m?Object.entries({total_organic_clicks:m.clicks,total_impressions:m.impressions,ctr:`${(m.ctr*100).toFixed(2)}%`,average_position:m.average_position.toFixed(1),pending_actions:data.opportunities.length,approved_actions:data.actions.filter(x=>x.status==='approved').length}).map(([k,v])=>`<div class="command-card"><b>${escapeHtml(v)}</b><span>${escapeHtml(statusLabel(k))}</span></div>`).join(''):'';
 seoOpportunities=data.opportunities;document.querySelector('#seo-growth-queue').innerHTML=seoOpportunities.map(x=>`<article class="ai-card" data-seo-id="${x.id}"><span class="ai-badge">${escapeHtml(statusLabel(x.type))}</span><span class="ai-priority">Priority ${x.priority} · ${escapeHtml(x.commercial_intent)}</span><h3>${escapeHtml(x.query)}</h3><p><b>Target:</b> ${escapeHtml(x.target_page)}<br><b>Search:</b> ${x.impressions} impressions · ${x.clicks} clicks · ${(x.ctr*100).toFixed(2)}% CTR · position ${x.average_position.toFixed(1)}<br><b>Revenue:</b> ${x.metrics.enquiries} enquiries → ${x.metrics.qualified_leads} qualified → ${x.metrics.meetings} meetings → ${x.metrics.site_visits} visits → ${x.metrics.bookings} bookings<br><b>Verified inventory:</b> ${x.verified_inventory_coverage} · <b>Fresh through:</b> ${escapeHtml(x.data_freshness)}</p><p><b>Recommendation:</b> ${escapeHtml(statusLabel(x.recommendation))}<br>${escapeHtml(x.reason)}</p><div class="row-actions"><button data-seo-status="approved">Approve</button><button data-seo-status="reviewed" class="secondary">Mark reviewed</button><button data-seo-status="snoozed" class="secondary">Snooze</button><button data-seo-status="dismissed" class="danger">Dismiss</button></div></article>`).join('')||'<p class="empty">No production recommendations. Connect Search Console and ingest persisted data; synthetic metrics will never appear here.</p>';
}
document.querySelector('#search-console-readiness').addEventListener('click',async event=>{if(event.target.id!=='import-search-console')return;const end=new Date(Date.now()-3*864e5),start=new Date(end-27*864e5),date=x=>x.toISOString().slice(0,10);event.target.disabled=true;event.target.textContent='Importing…';const response=await fetch('/api/acquisition?route=search-console',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'import_google_search_console',report_start:date(start),report_end:date(end)})});const data=await response.json();window.alert(response.ok?(data.message||(data.inserted?`Imported ${data.inserted} genuine Search Console rows.`:'Google authenticated successfully — no new rows to import.')):data.error);await loadSearchConsole();});
async function loadSearchConsole(){const response=await fetch('/api/acquisition?route=search-console');if(response.ok)renderSearchConsole(await response.json());}
async function loadLaunchCommandCenter(){
  const response=await fetch('/api/admin/leads?crm=launch');
  if(!response.ok)return;
  const data=await response.json(),notice=document.querySelector('#launch-command-notice'),target=document.querySelector('#launch-command-center');
  if(!data.metrics){notice.innerHTML=`<p class="empty">${escapeHtml(data.notice)}</p>`;target.innerHTML='';return;}
  notice.innerHTML=`<p class="ai-notice"><b>${escapeHtml(data.selected.name)}</b>${data.selected.project_name?` · ${escapeHtml(data.selected.project_name)}`:''} · ${escapeHtml(data.selected.status)}</p>`;
  const labels={target_eois:'Target EOIs',eois_completed:'EOIs completed',eois_pending_payment:'EOIs pending payment',payment_links_sent:'Payment links sent',qualified_hot_leads:'Qualified HOT leads',call_ready_leads:'Call-ready leads',advisor_follow_ups_due:'Advisor follow-ups due',organic_enquiries:'Organic enquiries',organic_to_qualified_conversion:'Organic → qualified',qualified_to_call_conversion:'Qualified → call',call_to_eoi_conversion:'Call → EOI',daily_pace_required:'Daily pace required',remaining_eois:'Remaining EOIs',hours_to_launch:'Hours to launch',lead_response_minutes:'Lead response minutes',unassigned_hot_leads:'Unassigned HOT leads'};
  const percent=new Set(['organic_to_qualified_conversion','qualified_to_call_conversion','call_to_eoi_conversion']);
  target.innerHTML=Object.entries(labels).map(([key,label])=>{const raw=data.metrics[key],value=raw==null?'Unavailable':percent.has(key)?`${(raw*100).toFixed(1)}%`:Number.isInteger(raw)?raw:Number(raw).toFixed(1);return `<div class="command-card"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`}).join('');
  const columns=[['name','Name'],['enquiries','Enquiries'],['qualified','Qualified'],['eois','EOIs']];
  document.querySelector('#launch-source-performance').innerHTML=metricsTable('Source performance',data.source_performance,columns);
  document.querySelector('#launch-landing-performance').innerHTML=metricsTable('Landing-page performance',data.landing_page_performance,columns);
}
async function loadActionQueue() {
  const response = await fetch('/api/admin/leads?view=revenue'); if (!response.ok) return;
  const data = await response.json(); window.__recovery=data.recovery?.queue||[]; actionQueue = data.queue; propertyOpportunities=data.property_opportunities||[]; renderActionQueue(data.refreshing); renderPropertyOpportunities(data.inventory_count); renderCommandCenter(data); renderAcquisition(data.acquisition,data.acquisition_coverage); renderBinghattiAttribution(data.binghatti_attribution); renderPipeline(data.pipeline); renderRecovery(data.recovery); loadSearchConsole(); loadBinghattiActivation(); loadLaunchCommandCenter();
}

document.querySelector('#seo-growth-queue').addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;const item=seoOpportunities.find(x=>x.id===button.closest('[data-seo-id]').dataset.seoId);let snoozed_until=null;if(button.dataset.seoStatus==='snoozed'){snoozed_until=window.prompt('Snooze until (ISO 8601):',new Date(Date.now()+7*864e5).toISOString());if(!snoozed_until)return;}const response=await fetch('/api/acquisition?route=search-console',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({recommendation_id:item.id,status:button.dataset.seoStatus,action_type:item.recommendation,snoozed_until})});const data=await response.json();if(!response.ok)return window.alert(data.error);await loadSearchConsole();});

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
      const revenue=card.querySelector('[data-field="attributed_revenue"]').value;
      if (card.querySelector('[data-field="status"]').value==='booked') await update({action:'revenue',id,attributed_revenue:revenue===''?null:Number(revenue),revenue_currency:'AED'});
      if (card.querySelector('[data-field="status"]').value === 'lost') await update({ action: 'lost', id, lost_reason: card.querySelector('[data-field="lost_reason"]').value.trim() });
    }
    render();
  } catch (error) { message.textContent = error.message; }
}

function confirmDeletion(ids) {
  if(!canDeleteLeads(currentRole)||!ids.length)return;
  const dialog=document.querySelector('#delete-leads-dialog');
  dialog.dataset.ids=JSON.stringify(ids); document.querySelector('#delete-leads-error').textContent='';
  document.querySelector('#delete-leads-result').classList.add('hidden');
  document.querySelector('#delete-failure-details').classList.add('hidden');
  document.querySelector('#delete-failure-list').replaceChildren();
  document.querySelector('#confirm-delete-leads').classList.remove('hidden');
  document.querySelector('#cancel-delete-leads').textContent='Cancel';
  document.querySelector('#delete-leads-message').textContent=`You are about to permanently delete ${ids.length} lead(s). This action cannot be undone.`;
  dialog.showModal();
}

async function deleteConfirmedLeads() {
  const dialog=document.querySelector('#delete-leads-dialog'),button=document.querySelector('#confirm-delete-leads');
  const ids=JSON.parse(dialog.dataset.ids||'[]'); button.disabled=true; button.textContent='Deleting…';
  try {
    const response=await fetch('/api/admin/leads?crm=leads',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,confirm:true})});
    const data=await response.json(); if(!response.ok)throw new Error(data.error||'Deletion failed safely.');
    for(const id of data.deletedIds)selectedLeadIds.delete(id);
    document.querySelector('#deleted-lead-total').textContent=String(data.deletedCount);
    document.querySelector('#failed-lead-total').textContent=String(data.notDeleted.length);
    const failures=document.querySelector('#delete-failure-details'),failureList=document.querySelector('#delete-failure-list');
    for(const item of data.notDeleted){const row=document.createElement('li');row.textContent=`${item.id}: ${item.reason}`;failureList.append(row);}
    failures.classList.toggle('hidden',data.notDeleted.length===0);
    document.querySelector('#delete-leads-result').classList.remove('hidden');
    document.querySelector('#confirm-delete-leads').classList.add('hidden');
    document.querySelector('#cancel-delete-leads').textContent='Close';
    await load();
  } catch(error){document.querySelector('#delete-leads-error').textContent=error.message;}
  finally{button.disabled=false;button.textContent='Permanently delete';}
}

list.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const card = button.closest('.lead');
  if (button.dataset.action === 'expand') {
    const detail = card.querySelector('.detail'); detail.classList.toggle('hidden'); button.setAttribute('aria-expanded', String(!detail.classList.contains('hidden')));
  } else if(button.dataset.action==='delete')confirmDeletion([card.dataset.id]);
  else saveCard(card, button.dataset.action);
});

list.addEventListener('change',event=>{if(!event.target.matches('[data-select-lead]'))return;const id=event.target.closest('.lead').dataset.id;event.target.checked?selectedLeadIds.add(id):selectedLeadIds.delete(id);renderSelection();});
document.querySelector('#select-all-leads').addEventListener('change',event=>{selectedLeadIds=toggleAllListed(selectedLeadIds,listedLeadIds,event.target.checked);render();});
document.querySelector('#bulk-delete-leads').onclick=()=>confirmDeletion([...selectedLeadIds]);
document.querySelector('#cancel-delete-leads').onclick=()=>document.querySelector('#delete-leads-dialog').close();
document.querySelector('#confirm-delete-leads').onclick=deleteConfirmedLeads;

for (const control of document.querySelectorAll('.filters input, .filters select')) control.addEventListener('input', render);

async function load() {
  clearTimeout(refreshTimer);
  const response = await fetch('/api/admin/leads');
  if (response.status === 401) { login.classList.remove('hidden'); crm.classList.add('hidden'); return; }
  const data = await response.json();
  if (!response.ok) { errorBox.textContent = data.error; return; }
  const identityResponse=await fetch('/api/admin/leads?crm=me');
  currentRole=identityResponse.ok?(await identityResponse.json()).user.role:null;
  const route=applyCrmRoute(crm,location.hash,currentRole);
  resetLeadSelectionForRoute(route);
  leads = data.leads; login.classList.add('hidden'); crm.classList.remove('hidden');
  const labels = [['total','Total leads'],['new','New leads'],['hot','Hot leads'],['warm','Warm leads'],['cold','Cold leads'],['processing','Processing']];
  document.querySelector('#stats').innerHTML = labels.map(([key,label]) => `<div class="stat"><b>${Number(data.counts[key])}</b><span>${label}</span></div>`).join('');
  const agent = document.querySelector('#agent'); const selected = agent.value;
  agent.innerHTML = '<option value="">All agents</option>' + [...new Set(leads.map(lead => lead.assigned_to).filter(Boolean))].sort().map(value => `<option>${escapeHtml(value)}</option>`).join(''); agent.value = selected;
  render();
  void loadActionQueue().catch(() => {});
  void loadProjectIngestions().catch(() => {});
  if (data.counts.processing > 0) refreshTimer = setTimeout(load, 3000);
}

function authenticatedShell() {
  login.classList.add('hidden'); crm.classList.remove('hidden');
  document.querySelector('#stats').innerHTML = '<p class="empty">Loading CRM data…</p>';
  void load().catch(() => { errorBox.textContent = 'Signed in, but CRM data is still unavailable. Refresh to try loading it again.'; });
}
const loginForm = document.querySelector('#login-form');
loginForm.addEventListener('submit', createAdminLogin({ form:loginForm, errorBox, onAuthenticated:authenticatedShell }));
document.querySelector('#logout').onclick = async () => { clearTimeout(refreshTimer); await fetch('/api/admin/logout',{method:'POST'}); location.reload(); };
window.addEventListener('hashchange',handleCrmRouteChange);
document.querySelector('#project-ingestion-form [name="sources"]').addEventListener('change',async event=>{const config=await getProjectSourceConfig();const files=[...event.target.files];event.target.value='';if(projectSourceUploads.length+files.length>config.max_files){document.querySelector('#project-ingestion-message').textContent=`A maximum of ${config.max_files} source files can be attached.`;return;}const items=files.map(file=>({id:crypto.randomUUID(),file,media_type:sourceTypes[file.name.split('.').pop().toLowerCase()],status:'uploading',progress:0,error:''}));projectSourceUploads.push(...items);renderProjectSources();await Promise.allSettled(items.map(uploadSourceItem));});
document.querySelector('#project-source-list').addEventListener('click',event=>{const row=event.target.closest('[data-source-upload]');if(!row)return;const item=projectSourceUploads.find(x=>x.id===row.dataset.sourceUpload);if(event.target.closest('[data-source-remove]'))void removeSourceItem(item);if(event.target.closest('[data-source-retry]'))void uploadSourceItem(item);});
document.querySelector('#project-ingestion-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,message=document.querySelector('#project-ingestion-message');message.textContent='Validating stored sources…';try{if(projectSourceUploads.some(x=>x.status==='uploading'))throw new Error('Wait for all source uploads to finish.');const failed=projectSourceUploads.filter(x=>x.status==='failed');const sources=projectSourceUploads.filter(x=>x.status==='success').map(x=>({filename:x.file.name,media_type:x.media_type,source_kind:sourceKind(x.file.name),storage_path:x.storage_path,byte_size:x.byte_size}));const data=new FormData(form),value=name=>String(data.get(name)||'').trim()||undefined;const unit_types=parseUnitTypesTextarea(value('unit_types'));const response=await fetch('/api/admin/leads/update?view=project-ingestion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:{developer:value('developer'),name:value('name'),availability_mode:value('availability_mode'),emirate:value('emirate'),area:value('area'),construction_status:value('construction_status'),launch_date:value('launch_date'),handover:value('handover'),payment_plan_summary:value('payment_plan_summary'),eoi_amount:value('eoi_amount'),eoi_type:value('eoi_type'),booking_amount:value('booking_amount'),campaign_status:value('campaign_status'),description:value('description'),attributes:{}},inventory:[],unit_types,sources,is_test:data.get('is_test')==='on'})});const result=await response.json();if(!response.ok){const issues=result.issues?.map(x=>`${x.path?.join('.')||'payload'}: ${x.message}`).join(' · ');throw new Error([issues||result.error,result.category&&`Category: ${result.category}`,result.request_id&&`Request ID: ${result.request_id}`,result.action].filter(Boolean).join(' · '));}message.textContent=`Imported ${result.ingestion.inventory_count} physical row(s) and ${result.ingestion.unit_type_count} unit type(s).${failed.length?` ${failed.length} failed source(s) were not attached and can be retried separately.`:''} Review is required before publication.`;form.reset();projectSourceUploads=[];renderProjectSources();await loadProjectIngestions();}catch(error){message.textContent=error.message;}});
document.querySelector('#project-ingestion-list').addEventListener('click',event=>{const button=event.target.closest('[data-ingestion-decision]');if(!button)return;button.disabled=true;reviewProjectIngestion(button.closest('[data-ingestion-id]').dataset.ingestionId,button.dataset.ingestionDecision).catch(error=>{document.querySelector('#project-ingestion-message').textContent=error.message;button.disabled=false;});});
fetch('/api/admin/login').then(response => { if (response.ok) authenticatedShell(); }).catch(() => {});

getProjectSourceConfig().then(config=>{document.querySelector('#project-source-limits').textContent=` Up to ${config.max_files} files per import.`;}).catch(()=>{});
