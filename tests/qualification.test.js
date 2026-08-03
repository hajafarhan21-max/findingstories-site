import test from 'node:test';
import assert from 'node:assert/strict';
import { fallback } from '../api/_lib/qualify.js';
import { leadSchema, safeText } from '../api/_lib/validation.js';
import { followUpDate, persistAndSchedule, qualifySavedLead } from '../api/_lib/workflow.js';

test('fallback temperature follows score bands', () => {
  const result = fallback({ name: 'Haja', purchase_timeline: 'Immediately', country_of_residence: 'UAE', purpose: 'Investment', budget: 'AED 2m', property_type: 'Apartment', bedrooms: '2', preferred_areas: 'Dubai Hills', payment_method: 'Cash', owns_uae_property: 'No' });
  assert.equal(result.lead_score, 70);
  assert.equal(result.temperature, 'Warm');
});

test('lead validation requires consent and valid phone', () => {
  assert.equal(leadSchema.safeParse({ name: 'Test Person', phone: 'not-a-phone', consent: true }).success, false);
  assert.equal(leadSchema.safeParse({ name: 'Test Person', phone: '+971 50 123 4567', consent: true }).success, true);
});

test('safeText strips markup and control characters', () => {
  assert.equal(safeText('<b>Hello</b>\u0000'), 'bHello/b');
});

test('lead is persisted before background qualification is scheduled', async () => {
  const events = [];
  let scheduled;
  const saved = await persistAndSchedule({
    lead: { name: 'Test' },
    persist: async () => { events.push('persisted'); return { id: 'lead-1', created_at: '2026-07-30T10:00:00Z' }; },
    background: async () => { events.push('qualification'); },
    schedule: promise => { events.push('scheduled'); scheduled = promise; }
  });
  assert.equal(saved.id, 'lead-1');
  assert.equal(events[0], 'persisted');
  assert.equal(events[2], 'scheduled');
  await scheduled;
});

test('OpenAI failure uses fallback without losing the saved lead', async () => {
  let updated;
  const result = await qualifySavedLead({
    id: 'saved-lead', lead: { name: 'Haja' }, capturedAt: '2026-07-30T10:00:00Z',
    qualify: async () => { throw new Error('OpenAI unavailable'); }, fallback,
    update: async (id, value) => { updated = { id, value }; }
  });
  assert.equal(updated.id, 'saved-lead');
  assert.equal(updated.value.qualification_status, 'completed');
  assert.equal(updated.value.qualification_source, 'deterministic_fallback');
  assert.equal(result.suggested_follow_up_date >= '2026-07-30', true);
});

test('follow-up dates are ISO dates and never precede capture date', () => {
  for (const temperature of ['Hot', 'Warm', 'Cold']) {
    const date = followUpDate(temperature, '2026-07-30T23:59:59Z');
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(date >= '2026-07-30');
  }
});

test('Hot, Warm and Cold follow-up rules use 0, 1 and 3 days', () => {
  assert.equal(followUpDate('Hot', '2026-07-30T10:00:00Z'), '2026-07-30');
  assert.equal(followUpDate('Warm', '2026-07-30T10:00:00Z'), '2026-07-31');
  assert.equal(followUpDate('Cold', '2026-07-30T10:00:00Z'), '2026-08-02');
});
