import test from 'node:test';
import assert from 'node:assert/strict';
import { leadNotification, sendLeadNotification } from '../api/_lib/lead-notification.js';
import { leadSchema } from '../api/_lib/validation.js';
import { persistAndSchedule } from '../api/_lib/workflow.js';

const saved = { id: '91d5698d-b109-4c4f-a2e8-752b61387a0f', captured_at: '2026-09-12T10:00:00.000Z' };
const attribution = { source: 'google', medium: 'cpc', landing_page: '/projects/azizi-developments/azizi-florence', referrer: 'https://google.com/', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'florence-launch', utm_content: 'hero', utm_term: 'sharjah villas' };
const lead = { name: 'Real Buyer', phone: '+971501234567', email: 'buyer@example.com', property_type: 'Villa', budget: 'AED 3m', purpose: 'Investment', purchase_timeline: 'Within 3 months', preferred_contact_method: 'WhatsApp', additional_requirements: 'Please call', consent: true, ...attribution };

function provider() {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => { calls.push({ url, ...options, body: JSON.parse(options.body) }); return { ok: true }; } };
}

const env = { RESEND_API_KEY: 'test-key', LEAD_NOTIFICATION_TO: 'hajafarhan21@gmail.com', LEAD_NOTIFICATION_FROM: 'Finding Stories <leads@example.com>' };

test('homepage and Florence notifications include the requested subject context', () => {
  assert.equal(leadNotification({ saved, lead }).subject, 'NEW FINDING STORIES LEAD | Enquiry | Homepage | Real Buyer');
  assert.equal(leadNotification({ saved, lead: { ...lead, conversion_type: 'site_visit' }, project: { project_name: 'Azizi Florence', developer: 'Azizi Developments' } }).subject,
    'NEW FINDING STORIES LEAD | Request a Site Visit | Azizi Florence | Real Buyer');
});

test('every supported lead conversion includes complete Florence attribution', () => {
  for (const conversion_type of ['enquiry', 'brochure_request', 'availability_request', 'consultation', 'site_visit']) {
    const notification = leadNotification({ saved, lead: { ...lead, conversion_type }, project: { project_name: 'Azizi Florence', developer: 'Azizi Developments' } });
    for (const value of Object.values(attribution)) assert.match(notification.text, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const label of ['Lead ID', 'Date/time', 'Client name', 'Phone', 'Email', 'Project', 'Developer', 'Conversion type', 'Preferred residence / property type', 'Budget', 'Buying purpose', 'Purchase timeframe', 'Preferred contact method', 'Enquiry message', 'Source / medium', 'Landing page', 'Referrer', 'UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'UTM term']) assert.match(notification.text, new RegExp(`${label}:`));
  }
});

test('new lead responds promptly and schedules notification only after durable persistence', async () => {
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

test('duplicate retries do not schedule a second notification', async () => {
  let notifications = 0;
  await persistAndSchedule({ lead, persist: async () => ({ ...saved, duplicate: true }), background: async () => { notifications += 1; }, schedule: () => {} });
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

test('homepage lead is delivered through Resend after persistence', async () => {
  const mock = provider();
  await sendLeadNotification({ saved, lead: { ...lead, conversion_type: 'consultation' }, env, fetchImpl: mock.fetchImpl });
  assert.equal(mock.calls.length, 1);
  assert.deepEqual(mock.calls[0].body.to, ['hajafarhan21@gmail.com']);
  assert.match(mock.calls[0].body.subject, /Book a Consultation \| Homepage/);
});

test('notification provider failure is isolated from successful lead capture', async () => {
  let scheduled;
  const result = await persistAndSchedule({ lead, persist: async () => saved,
    background: () => sendLeadNotification({ saved, lead, env, fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'unavailable' }) }).catch(() => undefined),
    schedule: promise => { scheduled = promise; } });
  assert.equal(result.id, saved.id);
  await scheduled;
});
