import test from 'node:test';
import assert from 'node:assert/strict';
import { fallback } from '../api/_lib/qualify.js';
import { leadSchema, safeText } from '../api/_lib/validation.js';

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
