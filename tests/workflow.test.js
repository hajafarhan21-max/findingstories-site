import test from 'node:test';
import assert from 'node:assert/strict';
import { followUpDate, persistAndSchedule, qualifySavedLead } from '../api/_lib/workflow.js';

const fallback = lead => ({ lead_score: 20, temperature: 'Cold', qualification_summary: 'Fallback',
  requirement_summary: 'Initial enquiry', missing_information: [], next_action: 'Review',
  whatsapp_follow_up_draft: `Hello ${lead.name}`, call_opener: `Hello ${lead.name}` });

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

test('capture returns without waiting for slow qualification', async () => {
  let finishQualification;
  const slowQualification = new Promise(resolve => { finishQualification = resolve; });
  let scheduled;
  const result = await Promise.race([
    persistAndSchedule({ lead: {}, persist: async () => ({ id: 'fast-lead', captured_at: new Date() }),
      background: async () => slowQualification, schedule: promise => { scheduled = promise; } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('capture waited for qualification')), 50))
  ]);
  assert.equal(result.id, 'fast-lead');
  finishQualification();
  await scheduled;
});

test('a duplicate submission is returned without scheduling qualification again', async () => {
  let scheduled = false;
  const saved = await persistAndSchedule({ lead: {}, persist: async () => ({ id: 'lead-1', duplicate: true }),
    background: async () => {}, schedule: () => { scheduled = true; } });
  assert.equal(saved.id, 'lead-1');
  assert.equal(scheduled, false);
});

test('OpenAI failure uses fallback without losing the saved lead', async () => {
  let updated;
  const result = await qualifySavedLead({ id: 'saved-lead', lead: { name: 'Haja' },
    capturedAt: '2026-07-30T10:00:00Z', qualify: async () => { throw new Error('OpenAI unavailable'); }, fallback,
    update: async (id, value) => { updated = { id, value }; } });
  assert.equal(updated.id, 'saved-lead');
  assert.equal(updated.value.qualification_status, 'completed');
  assert.equal(updated.value.qualification_source, 'deterministic_fallback');
  assert.ok(result.suggested_follow_up_date >= '2026-07-30');
});

test('OpenAI success updates the saved lead and marks its source', async () => {
  let updated;
  await qualifySavedLead({ id: 'saved-lead', lead: {}, capturedAt: '2026-07-30T10:00:00Z',
    qualify: async () => ({ ...fallback({ name: 'Test' }), lead_score: 80 }), fallback,
    update: async (id, value) => { updated = { id, value }; } });
  assert.equal(updated.id, 'saved-lead');
  assert.equal(updated.value.lead_score, 80);
  assert.equal(updated.value.temperature, 'Hot');
  assert.equal(updated.value.qualification_status, 'completed');
  assert.equal(updated.value.qualification_source, 'openai');
});

test('follow-up date cannot be in the past and is ISO YYYY-MM-DD', () => {
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
