import nodemailer from 'nodemailer';
import { safeText } from './validation.js';

const DEFAULT_NOTIFICATION_TO = 'hajafarhan21@gmail.com';
const CONVERSION_LABELS = Object.freeze({
  enquiry: 'Enquiry',
  brochure_request: 'Request Brochure',
  availability_request: 'Request Current Availability',
  consultation: 'Book a Consultation',
  site_visit: 'Request a Site Visit'
});

function display(value, fallback = 'Not provided') {
  return safeText(Array.isArray(value) ? value.join(', ') : value, 1000) || fallback;
}

function attribution(value) {
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value).map(([key, item]) => `${key}: ${display(item)}`).join('; ');
}

export function conversionLabel(value) {
  return CONVERSION_LABELS[value] || 'Enquiry';
}

export function leadNotification({ saved, lead, project }) {
  const projectName = display(project?.project_name || lead.acquisition_project, 'Homepage');
  const subjectSource = projectName === 'Homepage' ? display(lead.source, 'Website') : projectName;
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
    ['Country of residence', lead.country_of_residence],
    ['Project', projectName],
    ['Project ID', lead.project_id],
    ['Developer', developer],
    ['Campaign ID', lead.campaign_id],
    ['Conversion type', conversion],
    ['Page type', lead.page_type],
    ['Acquisition area', lead.acquisition_area],
    ['Preferred residence / property type', residence],
    ['Budget', lead.budget],
    ['Budget intent', lead.budget_intent],
    ['Bedroom intent', lead.bedroom_intent],
    ['Buying purpose', lead.purpose],
    ['Payment method', lead.payment_method],
    ['Purchase timeframe', lead.purchase_timeline],
    ['Owns UAE property', lead.owns_uae_property],
    ['Preferred contact method', lead.preferred_contact_method],
    ['Enquiry message', lead.additional_requirements],
    ['Acquisition signals', lead.acquisition_signals],
    ['Source / medium', [lead.source, lead.medium].filter(Boolean).join(' / ')],
    ['Content source', lead.content_source],
    ['Landing page', lead.landing_page],
    ['Referrer', lead.referrer],
    ['UTM source', lead.utm_source],
    ['UTM medium', lead.utm_medium],
    ['UTM campaign', lead.utm_campaign],
    ['UTM content', lead.utm_content],
    ['UTM term', lead.utm_term],
    ['First-touch attribution', attribution(lead.first_touch_attribution)],
    ['Latest-touch attribution', attribution(lead.latest_touch_attribution)]
  ];
  return {
    subject: `New Finding Stories Lead — ${subjectSource} — ${name}`,
    text: rows.map(([label, value]) => `${label}: ${display(value)}`).join('\n')
  };
}

export async function sendLeadNotification({ saved, lead, project, env = process.env, createTransport = nodemailer.createTransport }) {
  const user = env.GMAIL_SMTP_USER?.trim();
  const pass = env.GMAIL_SMTP_APP_PASSWORD?.trim();
  const to = env.LEAD_NOTIFICATION_TO?.trim() || DEFAULT_NOTIFICATION_TO;
  if (!user || !pass) {
    throw new Error('Lead notifications are not configured: set GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD');
  }

  const transporter = createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 8_000
  });
  const notification = leadNotification({ saved, lead, project });
  await transporter.sendMail({ from: user, to, subject: notification.subject, text: notification.text });
}
