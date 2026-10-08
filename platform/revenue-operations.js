// Consent-aware, non-destructive next-action planning for persisted CRM leads.
// No external messaging, financial transactions, or database writes occur here.
const CLOSED = new Set(['won', 'lost', 'closed', 'converted']);
const VALID_CHANNELS = new Set(['phone', 'email', 'whatsapp']);
const ms = value => { const time = Date.parse(value || ''); return Number.isFinite(time) ? time : null; };
const norm = value => String(value || '').trim().toLowerCase();

export function planRevenueFollowUps(leads, now = new Date()) {
  if (!Array.isArray(leads)) throw new TypeError('leads must be an array');
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new TypeError('now must be a valid date');
  const seen = new Set();
  return leads.flatMap(lead => {
    if (!lead || lead.is_test || lead.consent !== true || CLOSED.has(norm(lead.status))) return [];
    const id = String(lead.id || '').trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const phone = typeof lead.phone === 'string' && lead.phone.trim();
    const email = typeof lead.email === 'string' && lead.email.trim();
    if (!phone && !email) return [];
    const requested = norm(lead.preferred_contact_method);
    const channel = VALID_CHANNELS.has(requested) && (requested === 'email' ? email : phone)
      ? requested : phone ? 'phone' : 'email';
    const dueMs = ms(lead.next_follow_up_at || lead.suggested_follow_up_date);
    const temperature = ['Hot', 'Warm', 'Cold'].includes(lead.temperature) ? lead.temperature : 'Cold';
    const score = Math.max(0, Math.min(100, Number(lead.lead_score) || 0));
    return [{ lead_id: id, channel, temperature, score, overdue: dueMs !== null && dueMs <= nowMs,
      due_at: dueMs === null ? null : new Date(dueMs).toISOString(),
      action: 'Review consent and contact preferences before arranging a consultation.',
      requires_human_approval: true }];
  }).sort((a,b) => Number(b.overdue)-Number(a.overdue) ||
    ({Hot:0,Warm:1,Cold:2}[a.temperature] - {Hot:0,Warm:1,Cold:2}[b.temperature]) ||
    b.score-a.score || String(a.lead_id).localeCompare(String(b.lead_id)));
}

export function summarizeRevenueOperations(leads, now = new Date()) {
  const queue = planRevenueFollowUps(leads, now);
  const unique = [...new Map(leads.filter(l => l && !l.is_test && l.id).map(l => [String(l.id), l])).values()];
  return { actionable: queue.length, overdue: queue.filter(l => l.overdue).length,
    hot: queue.filter(l => l.temperature === 'Hot').length,
    meetings_scheduled: unique.filter(l => ['meeting_scheduled','site_visit_scheduled'].includes(norm(l.status))).length,
    meetings_done: unique.filter(l => ['meeting_done','site_visit_done'].includes(norm(l.status))).length,
    won: unique.filter(l => norm(l.status) === 'won').length,
    // Revenue is reported by currency, never summed across currencies.
    revenue_by_currency: unique.filter(l => norm(l.status) === 'won' && Number.isFinite(Number(l.attributed_revenue)) &&
      Number(l.attributed_revenue) > 0 && /^[A-Z]{3}$/.test(String(l.revenue_currency || '')))
      .reduce((acc,l) => { const currency = l.revenue_currency; acc[currency] = (acc[currency] || 0) + Number(l.attributed_revenue); return acc; }, {}) };
}
