import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mutation = /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i;

test('Revenue dashboard GET reads persisted production data without mutations', async () => {
  const source = await readFile('api/_lib/revenue-route.js', 'utf8');
  const getPath = source.slice(source.indexOf("const candidates=await sql`"));
  assert.doesNotMatch(getPath, /ensureSchema|waitUntil|refreshRecommendations|analyzeLeadWithAgent/);
  assert.doesNotMatch(getPath, mutation);
  assert.match(getPath, /is_test=FALSE/);
  assert.match(getPath, /matchProperties\(lead,inventory\)/);
});

test('Search Console GET returns before schema initialization and writes', async () => {
  const source = await readFile('api/_lib/search-console-route.js', 'utf8');
  assert.ok(source.indexOf("if(req.method==='GET')return") < source.indexOf('await ensureSchema()'));
  const dashboard = source.slice(source.indexOf('async function dashboard'), source.indexOf('export default'));
  assert.doesNotMatch(dashboard, mutation);
  assert.match(dashboard, /is_test=FALSE/g);
});

test('Launch command center GET contains production SELECTs only', async () => {
  const source = await readFile('api/_lib/crm/launch.js', 'utf8');
  assert.doesNotMatch(source, mutation);
  assert.match(source, /is_test=FALSE/g);
});

test('Event CRM dashboard and export GET paths return before schema initialization', async () => {
  const source = await readFile('api/admin/events.js', 'utf8');
  assert.ok(source.indexOf("if(req.method==='GET'&&req.query?.action==='export')") < source.indexOf('await ensureEventSchema()'));
  assert.ok(source.indexOf("if(req.method==='GET')return listEvent") < source.indexOf('await ensureEventSchema()'));
  for (const name of ['selectedEvent', 'listEvent', 'exportEvent']) {
    const start = source.indexOf(`async function ${name}`);
    const end = source.indexOf('\nasync function ', start + 1);
    assert.doesNotMatch(source.slice(start, end), mutation);
  }
});

test('Public event-slot GET performs SELECTs only and never seeds TEST events', async () => {
  const source = await readFile('api/events/slots.js', 'utf8');
  assert.doesNotMatch(source, /ensureEventSchema|ensureTestEvent/);
  assert.doesNotMatch(source, mutation);
  assert.equal((source.match(/sql`SELECT/g) || []).length, 2);
});

test('Schema initialization remains on authenticated same-origin write paths', async () => {
  const [revenue, search, events] = await Promise.all([
    readFile('api/_lib/revenue-route.js', 'utf8'),
    readFile('api/_lib/search-console-route.js', 'utf8'),
    readFile('api/admin/events.js', 'utf8')
  ]);
  assert.match(revenue, /req\.method === 'PATCH'.*isSameOrigin[\s\S]*req\.method === 'PATCH'.*await ensureSchema/);
  assert.match(search, /req\.method!==['"]GET['"].*isSameOrigin[\s\S]*await ensureSchema/);
  assert.match(events, /req\.method!==['"]GET['"].*isSameOrigin[\s\S]*await ensureEventSchema/);
});
