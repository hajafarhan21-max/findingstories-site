// Pure, non-destructive revenue operations derived from persisted CRM records.
const dateValue = value => { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : null; };
const priority = { Hot: 0, Warm: 1, Cold: 2 };
export function revenueQueue(leads, now = new Date()) {
  const today = now.getTime();
  return leads.filter(lead => lead && !lead.is_test && lead.consent === true && (lead.phone || lead.email))
    .map(lead => {
      const due = dateValue(lead.next_follow_up_at || lead.suggested_follow_up_date);
      const temperature = ['Hot','Warm','Cold'].includes(lead.temperature) ? lead.temperature : 'Cold';
      const status = String(lead.status || 'new').toLowerCase();
      return { id: lead.id, temperature, score: Math.max(0, Math.min(100, Number(lead.lead_score)||0)), status,
        contact_method: lead.preferred_contact_method || (lead.phone ? 'phone' : 'email'),
        due_at: due === null ? null : new Date(due).toISOString(), overdue: due !== null && due <= today,
        next_action: lead.next_action || 'Review and contact the prospect with consent.' };
    }).filter(item => !['won','lost','closed','converted'].includes(item.status))
    .sort((a,b) => Number(b.overdue)-Number(a.overdue) || priority[a.temperature]-priority[b.temperature] || b.score-a.score || (dateValue(a.due_at)??Infinity)-(dateValue(b.due_at)??Infinity));
}
export function revenueFunnel(leads) {
  const valid = leads.filter(l => l && !l.is_test);
  const statuses = valid.map(l => String(l.status || 'new').toLowerCase());
  const count = (...names) => statuses.filter(s => names.includes(s)).length;
  return { captured: valid.length, hot: valid.filter(l=>l.temperature==='Hot').length,
    warm: valid.filter(l=>l.temperature==='Warm').length, cold: valid.filter(l=>l.temperature==='Cold').length,
    meetings: count('meeting_scheduled','meeting_done','site_visit_scheduled','site_visit_done'),
    won: count('won'), lost: count('lost'),
    attributed_revenue: valid.filter(l=>String(l.status).toLowerCase()==='won').reduce((n,l)=>n+(Number(l.attributed_revenue)||0),0),
    revenue_currency: [...new Set(valid.filter(l=>l.attributed_revenue).map(l=>l.revenue_currency).filter(Boolean))] };
}
