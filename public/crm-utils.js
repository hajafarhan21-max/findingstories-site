export const DUBAI_TIME_ZONE = 'Asia/Dubai';

function dateParts(value) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DUBAI_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(value)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
}

const dayNumber = value => {
  const part = dateParts(value);
  return Date.UTC(Number(part.year), Number(part.month) - 1, Number(part.day)) / 86400000;
};

export function formatDubaiDate(value, now = new Date()) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not scheduled';
  const difference = dayNumber(value) - dayNumber(now);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-GB', { timeZone: DUBAI_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function formatDubaiDateTime(value, now = new Date()) {
  const day = formatDubaiDate(value, now);
  if (day === 'Not scheduled') return day;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: DUBAI_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value));
  return `${day}, ${time}`;
}

export function isOverdue(value, now = new Date()) { return Boolean(value) && new Date(value).getTime() < now.getTime(); }

export function filterAndSortLeads(leads, options = {}) {
  const query = String(options.query || '').trim().toLowerCase();
  const filtered = leads.filter(lead => (!query || [lead.name, lead.phone, lead.email].some(value => String(value || '').toLowerCase().includes(query))) &&
    (!options.temperature || lead.temperature === options.temperature) && (!options.status || lead.status === options.status) &&
    (!options.agent || lead.assigned_to === options.agent));
  return filtered.sort((a, b) => {
    if (options.sort === 'score') return Number(b.lead_score) - Number(a.lead_score);
    if (options.sort === 'follow_up') return new Date(a.next_follow_up_at || '9999-12-31') - new Date(b.next_follow_up_at || '9999-12-31');
    return new Date(b.captured_at) - new Date(a.captured_at);
  });
}
