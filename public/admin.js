const login = document.querySelector('#login');
const crm = document.querySelector('#crm');
const errorBox = document.querySelector('#login-error');
let refreshTimer;

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function qualificationCell(lead) {
  if (lead.qualification_status === 'pending' || lead.qualification_status === 'processing') {
    return '<span class="processing">Processing…</span>';
  }
  const source = lead.qualification_source === 'deterministic_fallback' ? 'Fallback' : 'AI';
  return `${escapeHtml(lead.qualification_summary)}<small>${source}</small>`;
}

async function load() {
  clearTimeout(refreshTimer);
  const response = await fetch('/api/admin/leads');
  if (response.status === 401) {
    login.classList.remove('hidden'); crm.classList.add('hidden');
    return;
  }
  const data = await response.json();
  if (!response.ok) { errorBox.textContent = data.error; return; }
  login.classList.add('hidden'); crm.classList.remove('hidden');
  const labels = [['total','Total leads'],['new','New leads'],['hot','Hot leads'],['warm','Warm leads'],['cold','Cold leads'],['processing','Processing']];
  document.querySelector('#stats').innerHTML = labels.map(([key,label]) => `<div class="stat"><b>${Number(data.counts[key])}</b><span>${label}</span></div>`).join('');
  document.querySelector('#leads').innerHTML = data.leads.map(lead => `<tr>
    <td>${escapeHtml(new Date(lead.captured_at).toLocaleString())}</td><td><b>${escapeHtml(lead.name)}</b></td>
    <td>${escapeHtml(lead.phone)}<br>${escapeHtml(lead.email)}</td><td>${escapeHtml(lead.source)}</td>
    <td>${escapeHtml(lead.budget)}</td><td class="summary">${escapeHtml(lead.requirement_summary || 'Processing…')}</td>
    <td>${lead.qualification_status === 'completed' ? `<b>${Number(lead.lead_score)}</b>` : '—'}</td>
    <td class="temp ${escapeHtml(lead.temperature)}">${lead.qualification_status === 'completed' ? escapeHtml(lead.temperature) : 'Processing'}</td>
    <td class="summary">${qualificationCell(lead)}</td><td class="summary">${escapeHtml(lead.next_action || 'Processing…')}</td>
    <td>${escapeHtml(lead.suggested_follow_up_date || 'Processing…')}</td></tr>`).join('');
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
