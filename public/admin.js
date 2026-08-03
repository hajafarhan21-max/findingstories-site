import { filterAndSortLeads, formatDubaiDate, formatDubaiDateTime, isOverdue } from './crm-utils.js';

const login = document.querySelector('#login');
const crm = document.querySelector('#crm');
const errorBox = document.querySelector('#login-error');
const list = document.querySelector('#leads');
let leads = [];
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
