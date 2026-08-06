import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';

const baseUrl = String(process.env.PRODUCTION_URL || '').replace(/\/$/, '');
const summary = process.env.GITHUB_STEP_SUMMARY;
const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow', ...options });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response;
}

async function waitForHealthyDeployment() {
  let lastError = 'deployment did not respond';
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: 'no-store' });
      const body = await response.json();
      if (response.ok && body?.checks?.api === 'ok' && body?.checks?.database === 'ok') return body;
      lastError = `HTTP ${response.status}; api=${body?.checks?.api}; database=${body?.checks?.database}`;
    } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    await new Promise(resolve => setTimeout(resolve, 10_000));
  }
  throw new Error(`deployment was not healthy after 5 minutes (${lastError})`);
}

try {
  if (!baseUrl.startsWith('https://')) throw new Error('PRODUCTION_URL must be an HTTPS URL');
  const health = await waitForHealthyDeployment();
  record('/api/health', true, `api=${health.checks.api}, database=${health.checks.database}`);

  for (const path of ['/open-house', '/event-admin.html']) {
    const text = await (await request(path)).text();
    if (!text.toLowerCase().includes('<!doctype html')) throw new Error(`${path} did not return HTML`);
    record(path, true, 'HTTP 200 HTML');
  }

  const slots = await (await request('/api/events/slots')).json();
  const slot = slots.slots?.find(item => Number(item.remaining) > 0);
  if (!slot?.id) throw new Error('No available event slot was returned for RSVP smoke testing');
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const rsvp = await (await request('/api/events/rsvp', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      full_name: 'Production Smoke Test', phone: `+9715${stamp.slice(-8)}`, email: `smoke-${stamp}@example.invalid`,
      preferred_event_date: String(slot.starts_at).startsWith('2026-08-09') ? '2026-08-09' : '2026-08-08',
      preferred_slot: slot.id, consent: true, idempotency_key: randomUUID(), source: 'production-deployment-smoke'
    })
  })).json();
  if (!rsvp.ok || !rsvp.id) throw new Error('RSVP API did not confirm persistence');
  record('RSVP submission', true, `created test RSVP ${rsvp.id}`);

  const login = await request('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Admin login did not issue a session cookie');
  const crm = await (await request('/api/admin/events', { headers: { cookie } })).json();
  if (!crm.rsvps?.some(item => item.id === rsvp.id)) throw new Error('Event CRM API did not return the smoke-test RSVP');
  record('Event CRM API', true, 'authenticated API returned the submitted RSVP');
} catch (error) {
  record('Production smoke suite', false, error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  const lines = ['### Production smoke tests', '', '| Check | Result | Detail |', '|---|---|---|',
    ...results.map(({ name, ok, detail }) => `| ${name} | ${ok ? '✅ pass' : '❌ fail'} | ${String(detail).replaceAll('|', '\\|')} |`), ''];
  if (summary) await appendFile(summary, `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}
