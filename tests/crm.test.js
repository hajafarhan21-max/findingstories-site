import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSession, isAdmin, isSameOrigin } from '../api/_lib/auth.js';
import { leadUpdateSchema } from '../api/_lib/validation.js';
import { filterAndSortLeads, formatDubaiDate, formatDubaiDateTime, isOverdue } from '../public/crm-utils.js';

const uuid = '32d0f9ba-1a0c-4eef-8d48-9fae274541ef';

test('workflow update validation accepts supported actions and rejects unknown fields', () => {
  assert.equal(leadUpdateSchema.safeParse({ action: 'contacted', id: uuid }).success, true);
  assert.equal(leadUpdateSchema.safeParse({ action: 'lost', id: uuid, lost_reason: 'Budget changed' }).success, true);
  assert.equal(leadUpdateSchema.safeParse({ action: 'lost', id: uuid, lost_reason: '' }).success, false);
  assert.equal(leadUpdateSchema.safeParse({ action:'revenue',id:uuid,attributed_revenue:50000,revenue_currency:'AED' }).success,true);
  assert.equal(leadUpdateSchema.safeParse({ action:'revenue',id:uuid,attributed_revenue:-1,revenue_currency:'AED' }).success,false);
  assert.equal(leadUpdateSchema.safeParse({ action: 'status', id: uuid, status: 'deleted' }).success, false);
  assert.equal(leadUpdateSchema.safeParse({ action: 'notes', id: uuid, agent_notes: 'ok', admin_password: 'no' }).success, false);
});

test('admin session authentication and mutation origin checks are enforced', () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters';
  try {
    const cookie = `fs_admin=${createSession()}`;
    assert.equal(isAdmin({ headers: { cookie } }), true);
    assert.equal(isAdmin({ headers: { cookie: `${cookie}tampered` } }), false);
    assert.equal(isSameOrigin({ headers: { host: 'crm.example', origin: 'https://crm.example', 'sec-fetch-site': 'same-origin' } }), true);
    assert.equal(isSameOrigin({ headers: { host: 'crm.example', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } }), false);
  } finally { if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous; }
});

test('Dubai dates use relative and human-readable labels without ISO output', () => {
  const now = new Date('2026-08-02T20:30:00.000Z'); // 03 Aug in Dubai
  assert.equal(formatDubaiDate('2026-08-03T10:00:00.000Z', now), 'Today');
  assert.equal(formatDubaiDate('2026-08-04T10:00:00.000Z', now), 'Tomorrow');
  assert.equal(formatDubaiDate('2026-08-08T10:00:00.000Z', now), '08 Aug 2026');
  assert.match(formatDubaiDateTime('2026-08-03T10:00:00.000Z', now), /^Today, /);
  assert.equal(isOverdue('2026-08-01T00:00:00Z', now), true);
});

test('lead search, filters and sorts operate together', () => {
  const leads = [
    { name: 'Sara Ali', phone: '+97150000', email: 'sara@example.com', temperature: 'Hot', status: 'new', assigned_to: 'Omar', lead_score: 88, captured_at: '2026-08-01', next_follow_up_at: '2026-08-05' },
    { name: 'John Lee', phone: '+44123', email: 'john@example.com', temperature: 'Cold', status: 'contacted', assigned_to: 'Maya', lead_score: 20, captured_at: '2026-08-02', next_follow_up_at: '2026-08-04' }
  ];
  assert.equal(filterAndSortLeads(leads, { query: '971', temperature: 'Hot', agent: 'Omar' })[0].name, 'Sara Ali');
  assert.equal(filterAndSortLeads(leads, { status: 'contacted' }).length, 1);
  assert.equal(filterAndSortLeads(leads, { sort: 'score' })[0].lead_score, 88);
  assert.equal(filterAndSortLeads(leads, { sort: 'follow_up' })[0].name, 'John Lee');
});

test('migration is additive, idempotent and includes every workflow field', async () => {
  const sql = await readFile('database/migrations/002_lead_workflow.sql', 'utf8');
  for (const field of ['assigned_to','agent_notes','last_contacted_at','next_follow_up_at','meeting_at','site_visit_at','lost_reason','updated_at']) assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${field}`));
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE)\b/i);
});

test('update API requires auth and same-origin checks before parameterized updates', async () => {
  const source = await readFile('api/admin/leads/update.js', 'utf8');
  assert.ok(source.indexOf('isAdmin(req)') < source.indexOf('ensureSchema()'));
  assert.ok(source.indexOf('isSameOrigin(req)') < source.indexOf('ensureSchema()'));
  assert.match(source, /leadUpdateSchema\.safeParse/);
  assert.doesNotMatch(source, /\$\{[^}]+\}.*(?:SELECT|UPDATE)|(?:SELECT|UPDATE).*\+\s*value/);
});

test('one-time inventory activation is admin-only, same-origin, and permanently disabled', async () => {
  const [route, importer, update, client] = await Promise.all([
    readFile('api/_lib/inventory-activation-route.js', 'utf8'), readFile('api/_lib/binghatti-import.js', 'utf8'),
    readFile('api/admin/leads/update.js', 'utf8'), readFile('public/admin.js', 'utf8')
  ]);
  assert.ok(route.indexOf('isAdmin(req)') < route.indexOf('database()'));
  assert.ok(route.indexOf('isSameOrigin(req)') < route.indexOf('activateBinghattiInventory(sql)'));
  assert.doesNotMatch(route, /ensureSchema/);
  assert.match(client, /window\.AbortSignal\.timeout\(30000\)/);
  assert.match(route, /return json\(res, 410/);
  assert.doesNotMatch(route, /process\.env|connection|string/i);
  assert.match(importer, /ON CONFLICT \(unit\) DO UPDATE/);
  assert.match(importer, /production_activations/);
  assert.match(importer, /is_test=FALSE/);
  assert.match(update, /view === 'inventory-activation'/);
  assert.match(client, /window\.confirm/);
});
