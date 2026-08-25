import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicRecommendation, isEligibleForRevenueAnalysis, needsRevenueAnalysis, recommendationFingerprint } from '../api/_lib/revenue-agent.js';

const now = new Date('2026-08-25T12:00:00Z');
const synthetic = overrides => ({ id: '00000000-0000-4000-8000-000000000001', name: 'TEST Lead', consent: true, is_test: false,
  status: 'new', lead_score: 20, budget: '', preferred_areas: '', property_type: '', purchase_timeline: '', assigned_to: 'TEST Advisor', updated_at: now.toISOString(), ...overrides });

test('synthetic immediate high-intent lead is HOT', () => {
  const result = deterministicRecommendation(synthetic({ lead_score: 76, purchase_timeline: 'Immediately' }), now);
  assert.equal(result.priority, 'HOT'); assert.equal(result.follow_up_timing, 'Now');
});

test('synthetic promising lead is WARM', () => {
  assert.equal(deterministicRecommendation(synthetic({ lead_score: 55, purchase_timeline: '1–3 months' }), now).priority, 'WARM');
});

test('synthetic overdue lead receives an overdue warning', () => {
  const result = deterministicRecommendation(synthetic({ next_follow_up_at: '2026-08-24T12:00:00Z' }), now);
  assert.match(result.warning, /overdue/i); assert.equal(result.follow_up_timing, 'Now');
});

test('synthetic unassigned HOT lead is escalated without reassignment', () => {
  const result = deterministicRecommendation(synthetic({ lead_score: 80, assigned_to: '' }), now);
  assert.match(result.escalation, /assignment/i); assert.equal(result.priority, 'HOT');
});

test('synthetic qualified and complete lead is meeting-ready', () => {
  const result = deterministicRecommendation(synthetic({ status: 'qualified', lead_score: 60, budget: 'AED 2m', preferred_areas: 'Dubai Marina', property_type: 'Apartment' }), now);
  assert.equal(result.meeting_ready, true); assert.match(result.next_action, /site visit/i);
});

test('already-converted and TEST leads are excluded from genuine analysis', () => {
  assert.equal(isEligibleForRevenueAnalysis(synthetic({ status: 'booked' })), false);
  assert.equal(isEligibleForRevenueAnalysis(synthetic({ is_test: true })), false);
});

test('fingerprint cache prevents repeat model calls until relevant data changes', () => {
  const lead = synthetic({ ai_recommendation_fingerprint: '' });
  assert.equal(needsRevenueAnalysis(lead), true);
  lead.ai_recommendation_fingerprint = recommendationFingerprint(lead);
  assert.equal(needsRevenueAnalysis(lead), false);
  lead.agent_notes = 'TEST: client requested a call';
  assert.equal(needsRevenueAnalysis(lead), true);
});
