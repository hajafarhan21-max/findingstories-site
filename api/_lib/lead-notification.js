import nodemailer from 'nodemailer';
import { safeText } from './validation.js';

const DEFAULT_NOTIFICATION_TO = 'hajafarhan21@gmail.com';
const EMPTY_VALUES = new Set(['', 'not provided', 'null', 'undefined', 'n/a', 'na']);
const CONVERSION_LABELS = Object.freeze({
  enquiry: 'Enquiry', brochure_request: 'Brochure', availability_request: 'Availability',
  consultation: 'Consultation', site_visit: 'Site Visit', whatsapp: 'WhatsApp'
});

function clean(value, max = 1000) {
  const result = safeText(Array.isArray(value) ? value.join(', ') : value, max);
  return EMPTY_VALUES.has(result.toLowerCase()) ? '' : result;
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function formatUaeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()} UAE Time`;
}

function budgetNumber(value) {
  const normalized = clean(value).replace(/,/g, '');
  const match = normalized.match(/(?:AED\s*)?([0-9]+(?:\.[0-9]+)?)\s*([mk])?\b/i);
  if (!match) return null;
  const multiplier = match[2]?.toLowerCase() === 'm' ? 1_000_000 : match[2]?.toLowerCase() === 'k' ? 1_000 : 1;
  return Number(match[1]) * multiplier;
}

export function formatAedBudget(value, compact = false) {
  const amount = budgetNumber(value);
  if (!Number.isFinite(amount)) return clean(value);
  if (compact && amount >= 1_000_000) return `AED ${(amount / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (compact && amount >= 1_000) return `AED ${(amount / 1_000).toFixed(0)}K`;
  return `AED ${Math.round(amount).toLocaleString('en-US')}`;
}

export function conversionLabel(value) { return CONVERSION_LABELS[value] || 'Enquiry'; }

function residence(lead) {
  if (lead.bedrooms && lead.property_type) return `${clean(lead.bedrooms).replace(/\s*(bed(room)?|br)$/i, '')}BR ${clean(lead.property_type)}`;
  return clean(lead.property_type || lead.bedroom_intent || lead.bedrooms);
}

function meaningfulAttribution(value) {
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value).filter(([, item]) => clean(item)).map(([key, item]) => `${key.replaceAll('_', ' ')}: ${clean(item)}`).join('; ');
}

function section(title, rows) {
  const populated = rows.map(([label, value]) => [label, clean(value)]).filter(([, value]) => value);
  return populated.length ? { title, rows: populated } : null;
}

export function leadNotification({ saved, lead, project }) {
  const projectName = clean(project?.project_name || lead.acquisition_project);
  const pageName = projectName || 'Finding Stories';
  const conversion = conversionLabel(lead.conversion_type);
  const preferredResidence = residence(lead);
  const subjectParts = ['🔥 New Lead', pageName, preferredResidence, formatAedBudget(lead.budget, true) || (!preferredResidence ? conversion : '')].filter(Boolean);
  const subject = subjectParts.join(' | ').slice(0, 140).replace(/\s+$/g, '');
  const received = formatUaeTime(saved.captured_at);
  const leadNumber = clean(saved.lead_number);
  const sections = [
    section('CLIENT DETAILS', [['Name', lead.name], ['Mobile', lead.phone], ['Email', lead.email]]),
    section('REQUIREMENT', [['Project', projectName], ['Preferred Residence', preferredResidence], ['Budget', formatAedBudget(lead.budget)], ['Buying For', lead.purpose], ['Purchase Timeframe', lead.purchase_timeline], ['Preferred Contact', lead.preferred_contact_method], ['Area / Residence', lead.preferred_areas || lead.acquisition_area], ['Payment Method', lead.payment_method]]),
    section('CLIENT MESSAGE', [['Message', lead.additional_requirements]]),
    section('SOURCE', [['Page', pageName], ['Lead Type', conversion], ['Source', lead.source], ['Medium', lead.medium], ['Landing Page', lead.landing_page]]),
    section('MARKETING ATTRIBUTION', [['UTM Source', lead.utm_source], ['UTM Medium', lead.utm_medium], ['UTM Campaign', lead.utm_campaign], ['UTM Content', lead.utm_content], ['UTM Term', lead.utm_term], ['Referrer', lead.referrer], ['First Touch', meaningfulAttribution(lead.first_touch_attribution)], ['Latest Touch', meaningfulAttribution(lead.latest_touch_attribution)]])
  ].filter(Boolean);

  const heading = `NEW FINDING STORIES LEAD\n\n${leadNumber ? `Lead #${leadNumber}\n` : ''}${received ? `Received: ${received}\n` : ''}`;
  const text = `${heading}\n${sections.map(item => `${item.title}\n${item.rows.map(([label, value]) => `${label}: ${value}`).join('\n')}`).join('\n\n')}\n\nFinding Stories${saved.id ? `\nInternal reference: ${clean(saved.id)}` : ''}`;
  const htmlSections = sections.map(item => `<div style="margin-top:24px"><div style="color:#9b762f;font-size:12px;font-weight:700;letter-spacing:1.2px">${item.title}</div><table role="presentation" style="border-collapse:collapse;width:100%;margin-top:8px">${item.rows.map(([label, value]) => `<tr><td style="color:#6b7280;padding:5px 12px 5px 0;vertical-align:top;width:38%">${escapeHtml(label)}</td><td style="color:#172033;font-weight:600;padding:5px 0;vertical-align:top">${escapeHtml(value)}</td></tr>`).join('')}</table></div>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#172033"><div style="max-width:600px;margin:0 auto;padding:20px"><div style="background:#fff;border-top:4px solid #9b762f;border-radius:6px;padding:28px"><div style="font-size:13px;font-weight:700;letter-spacing:1.4px">NEW FINDING STORIES LEAD</div>${leadNumber ? `<h1 style="font-size:26px;margin:10px 0 4px">Lead #${escapeHtml(leadNumber)}</h1>` : ''}${received ? `<div style="color:#6b7280;font-size:14px">Received: ${escapeHtml(received)}</div>` : ''}${htmlSections}<div style="border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;margin-top:28px;padding-top:14px">Finding Stories${saved.id ? ` · Internal reference: ${escapeHtml(clean(saved.id))}` : ''}</div></div></div></body></html>`;
  return { subject, text, html };
}

export async function sendLeadNotification({ saved, lead, project, env = process.env, createTransport = nodemailer.createTransport }) {
  const user = env.GMAIL_SMTP_USER?.trim();
  const pass = env.GMAIL_SMTP_APP_PASSWORD?.trim();
  const to = env.LEAD_NOTIFICATION_TO?.trim() || DEFAULT_NOTIFICATION_TO;
  if (!user || !pass) throw new Error('Lead notifications are not configured: set GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD');
  const transporter = createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass }, connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 8_000 });
  const notification = leadNotification({ saved, lead, project });
  await transporter.sendMail({ from: user, to, ...notification });
}
