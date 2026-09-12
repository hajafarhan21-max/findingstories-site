import test from 'node:test';
import assert from 'node:assert/strict';
import { leadNotification, sendLeadNotification } from '../api/_lib/lead-notification.js';
import { leadSchema } from '../api/_lib/validation.js';
import { persistAndSchedule } from '../api/_lib/workflow.js';

const saved = { id: '91d5698d-b109-4c4f-a2e8-752b61387a0f', captured_at: '2026-09-12T10:00:00.000Z' };
const attribution = { source: 'google', medium: 'cpc', landing_page: '/projects/azizi-developments/azizi-florence', referrer: 'https://google.com/', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'florence-launch', utm_content: 'hero', utm_term: 'sharjah villas' };
const lead = { name: 'Real Buyer', phone: '+971501234567', email: 'buyer@example.com', country_of_residence: 'UAE', property_type: 'Villa', bedrooms: '4', preferred_areas: 'Al Furjan', budget: 'AED 3m', budget_intent: '2m-3m', bedroom_intent: '4', purpose: 'Investment', payment_method: 'Mortgage', purchase_timeline: 'Within 3 months', owns_uae_property: 'Yes', preferred_contact_method: 'WhatsApp', additional_requirements: 'Please call', acquisition_signals: ['project_page_enquiry'], consent: true, ...attribution, first_touch_attribution: attribution, latest_touch_attribution: attribution };
const env = { GMAIL_SMTP_USER: 'findingstories@gmail.com', GMAIL_SMTP_APP_PASSWORD: 'test-app-password', LEAD_NOTIFICATION_TO: 'hajafarhan21@gmail.com' };

function smtp({ error } = {}) {
  const transports = [];
  const messages = [];
  return { transports, messages, createTransport: options => { transports.push(options); return { sendMail: async message => { messages.push(message); if (error) throw error; return { messageId: 'test' }; } }; } };
}

test('homepage and Florence notifications include clear project/source subject context', () => {
  assert.equal(leadNotification({ saved, lead }).subject, 'New Finding Stories Lead — google — Real Buyer');
  assert.equal(leadNotification({ saved, lead: { ...lead, conversion_type: 'site_visit' }, project: { project_name: 'Azizi Florence', developer: 'Azizi Developments' } }).subject,
    'New Finding Stories Lead — Azizi Florence — Real Buyer');
});

test('notification preserves Florence, UTM, qualification and conversion metadata', () => {
  const florenceLead = { ...lead, conversion_type: 'site_visit', project_id: saved.id, campaign_id: saved.id, page_type: 'project', acquisition_area: 'Dubai South', content_source: 'Florence landing page' };
  const notification = leadNotification({ saved, lead: florenceLead, project: { project_name: 'Azizi Florence', developer: 'Azizi Developments' } });
  for (const value of [...Object.values(attribution), 'Azizi Florence', 'Azizi Developments', 'Request a Site Visit', 'UAE', 'Mortgage', '4', 'Al Furjan', 'project_page_enquiry', 'Dubai South', 'Florence landing page']) assert.ok(notification.text.includes(value), `missing ${value}`);
  for (const label of ['Lead ID', 'Date/time', 'Client name', 'Phone', 'Email', 'Project', 'Developer', 'Conversion type', 'Preferred residence / property type', 'Budget', 'Buying purpose', 'Purchase timeframe', 'Preferred contact method', 'Enquiry message', 'Source / medium', 'Landing page', 'Referrer', 'UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'UTM term', 'First-touch attribution', 'Latest-touch attribution']) assert.match(notification.text, new RegExp(`${label}:`));
});

test('new lead persists and responds promptly before scheduling SMTP notification', async () => {
  const events = [];
  let scheduled;
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const result = await Promise.race([
    persistAndSchedule({ lead, persist: async () => { events.push('persisted'); return saved; }, background: async () => { events.push('notification'); await waiting; }, schedule: promise => { events.push('scheduled'); scheduled = promise; } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('response waited for notification')), 50))
  ]);
  assert.equal(result.id, saved.id);
  assert.deepEqual(events.slice(0, 2), ['persisted', 'scheduled']);
  release();
  await scheduled;
  assert.deepEqual(events, ['persisted', 'scheduled', 'notification']);
});

test('duplicate persisted retries do not schedule duplicate operational email', async () => {
  let notifications = 0;
  const result = await persistAndSchedule({ lead, persist: async () => ({ ...saved, duplicate: true }), background: async () => { notifications += 1; }, schedule: () => {} });
  assert.equal(result.duplicate, true);
  assert.equal(notifications, 0);
});

test('validation and honeypot failures cannot reach notification scheduling', () => {
  let notifications = 0;
  const invalid = leadSchema.safeParse({ ...lead, phone: 'invalid' });
  const spam = leadSchema.safeParse({ ...lead, website: 'https://spam.example' });
  if (invalid.success || (spam.success && !spam.data.website)) notifications += 1;
  assert.equal(invalid.success, false);
  assert.equal(spam.success, true);
  assert.equal(notifications, 0);
});

test('lead is delivered using secure Gmail SMTP and the default recipient', async () => {
  const mock = smtp();
  await sendLeadNotification({ saved, lead: { ...lead, conversion_type: 'consultation' }, env: { GMAIL_SMTP_USER: env.GMAIL_SMTP_USER, GMAIL_SMTP_APP_PASSWORD: env.GMAIL_SMTP_APP_PASSWORD }, createTransport: mock.createTransport });
  assert.deepEqual(mock.transports[0], { host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: env.GMAIL_SMTP_USER, pass: env.GMAIL_SMTP_APP_PASSWORD }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000 });
  assert.equal(mock.messages[0].from, env.GMAIL_SMTP_USER);
  assert.equal(mock.messages[0].to, 'hajafarhan21@gmail.com');
});

test('missing SMTP credentials fails notification without creating a transport', async () => {
  const mock = smtp();
  await assert.rejects(sendLeadNotification({ saved, lead, env: {}, createTransport: mock.createTransport }), /GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD/);
  assert.equal(mock.transports.length, 0);
});

test('SMTP failure is isolated from successful persisted lead capture', async () => {
  const mock = smtp({ error: new Error('SMTP unavailable') });
  let scheduled;
  const result = await persistAndSchedule({ lead, persist: async () => saved,
    background: value => sendLeadNotification({ saved: value, lead, env, createTransport: mock.createTransport }).catch(() => undefined),
    schedule: promise => { scheduled = promise; } });
  assert.equal(result.id, saved.id);
  await scheduled;
  assert.equal(mock.messages.length, 1);
});
