import { safeText } from './validation.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const CONVERSION_LABELS = Object.freeze({
  enquiry: 'Enquiry',
  brochure_request: 'Request Brochure',
  availability_request: 'Request Current Availability',
  consultation: 'Book a Consultation',
  site_visit: 'Request a Site Visit'
});

function display(value, fallback = 'Not provided') {
  return safeText(value, 1000) || fallback;
}

export function conversionLabel(value) {
  return CONVERSION_LABELS[value] || 'Enquiry';
}

export function leadNotification({ saved, lead, project }) {
  const projectName = display(project?.project_name || lead.acquisition_project, 'Homepage');
  const developer = display(project?.developer || lead.acquisition_developer);
  const conversion = conversionLabel(lead.conversion_type);
  const name = display(lead.name);
  const residence = [lead.property_type, lead.bedrooms, lead.preferred_areas].filter(Boolean).join(' / ');
  const rows = [
    ['Lead ID', saved.id],
    ['Date/time', saved.captured_at],
    ['Client name', name],
    ['Phone', lead.phone],
    ['Email', lead.email],
    ['Project', projectName],
    ['Developer', developer],
    ['Conversion type', conversion],
    ['Preferred residence / property type', residence],
    ['Budget', lead.budget],
    ['Buying purpose', lead.purpose],
    ['Purchase timeframe', lead.purchase_timeline],
    ['Preferred contact method', lead.preferred_contact_method],
    ['Enquiry message', lead.additional_requirements],
    ['Source / medium', [lead.source, lead.medium].filter(Boolean).join(' / ')],
    ['Landing page', lead.landing_page],
    ['Referrer', lead.referrer],
    ['UTM source', lead.utm_source],
    ['UTM medium', lead.utm_medium],
    ['UTM campaign', lead.utm_campaign],
    ['UTM content', lead.utm_content],
    ['UTM term', lead.utm_term]
  ];
  return {
    subject: `NEW FINDING STORIES LEAD | ${conversion} | ${projectName} | ${name}`,
    text: rows.map(([label, value]) => `${label}: ${display(value)}`).join('\n')
  };
}

export async function sendLeadNotification({ saved, lead, project, env = process.env, fetchImpl = fetch }) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const to = env.LEAD_NOTIFICATION_TO?.trim();
  const from = env.LEAD_NOTIFICATION_FROM?.trim();
  if (!apiKey || !to || !from) {
    throw new Error('Lead notifications are not configured: set RESEND_API_KEY, LEAD_NOTIFICATION_TO, and LEAD_NOTIFICATION_FROM');
  }
  const notification = leadNotification({ saved, lead, project });
  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: notification.subject, text: notification.text }),
    signal: globalThis.AbortSignal.timeout(8_000)
  });
  if (!response.ok) {
    const detail = safeText(await response.text(), 500);
    throw new Error(`Resend rejected lead notification (${response.status})${detail ? `: ${detail}` : ''}`);
  }
}
