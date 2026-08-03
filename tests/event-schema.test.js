import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventSchemaInitializer, eventSchemaQueries } from '../api/_lib/event-schema.js';

function fakeSql() {
  const tag = (parts, ...values) => parts.reduce((text, part, index) => text + part + (index < values.length ? String(values[index]) : ''), '');
  return tag;
}

test('clean event database initialization contains every table, index and function', () => {
  const statements = eventSchemaQueries(fakeSql()).join('\n');
  for (const table of ['events','event_slots','event_rsvps','event_rsvp_activity','event_analytics']) {
    assert.match(statements, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(statements, /CREATE UNIQUE INDEX IF NOT EXISTS event_rsvps_phone_unique/);
  assert.match(statements, /CREATE OR REPLACE FUNCTION confirm_event_slot/);
});

test('repeated initialization reuses the completed bootstrap', async () => {
  let runs = 0;
  const initialize = createEventSchemaInitializer(async () => { runs += 1; });
  await initialize();
  await initialize();
  assert.equal(runs, 1);
});

test('concurrent initialization shares one in-process transaction', async () => {
  let runs = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const initialize = createEventSchemaInitializer(async () => { runs += 1; await gate; });
  const requests = [initialize(), initialize(), initialize()];
  release();
  await Promise.all(requests);
  assert.equal(runs, 1);
});

test('cross-instance initialization is serialized with a transaction advisory lock', () => {
  const statements = eventSchemaQueries(fakeSql());
  assert.match(statements[0], /pg_advisory_xact_lock/);
});

test('slot seeding is repeatable and cannot duplicate event start times', () => {
  const statements = eventSchemaQueries(fakeSql()).join('\n');
  assert.match(statements, /UNIQUE\(event_id, starts_at\)/);
  assert.match(statements, /ON CONFLICT\(event_id,starts_at\) DO NOTHING/);
  assert.match(statements, /2026-08-08/);
  assert.match(statements, /2026-08-09/);
});

test('bootstrap preserves existing lead and event records', () => {
  const statements = eventSchemaQueries(fakeSql()).join('\n');
  assert.doesNotMatch(statements, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
  assert.match(statements, /INSERT INTO events[\s\S]*ON CONFLICT\(slug\) DO NOTHING/);
});

test('every event API awaits schema initialization before database access', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const file of ['api/events/slots.js','api/events/rsvp.js','api/events/visit.js','api/admin/events.js']) {
    const source = await readFile(file, 'utf8');
    assert.match(source, /await ensureEventSchema\(\)/, file);
    assert.ok(source.indexOf('await ensureEventSchema()') < source.indexOf('database()'), file);
  }
});
