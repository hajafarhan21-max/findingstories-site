import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { loadPublicProjects } from '../project-launch/registry.js';

const required = ['today.json', 'weekly.json', 'performance.json', 'next-best-action.json', 'human-action-queue.json', 'search-console.json', 'query-opportunity-loop.json', 'content-refresh-decision.json', 'social-queue.json', 'whatsapp-queue.json', 'authority-status.json', 'outreach-queue.json', 'referral-partner-queue.json', 'lead-operations-review.json', 'conversion-review.json', 'operations-audit.json', 'prioritization-model.json'];
const forbiddenUrl = /(?:localhost|vercel\.app|https?:\/\/[^"?]*preview)/i;
const unsafe = /\b(?:guaranteed\s+(?:roi|returns?|appreciation)|last (?:few )?units|act now|limited units? left)\b/i;
const actionFields = ['id', 'priority', 'category', 'action', 'channel', 'buyer_intent', 'reason', 'destination_url', 'tracked_url', 'asset', 'approval_type', 'status', 'dependency', 'success_metric', 'revenue_connection', 'evidence_required', 'next_review_at'];

const values = value => typeof value === 'object' && value !== null
  ? Object.values(value).flatMap(values)
  : [value];

test('operations generator supports every approved project without a Florence-only registry', async () => {
  for (const project of await loadPublicProjects()) {
    const files = await readdir(`generated/operations/${project.slug}`);
    for (const name of required) assert.ok(files.includes(name), `${project.slug}: ${name}`);
    const today = JSON.parse(await readFile(`generated/operations/${project.slug}/today.json`, 'utf8'));
    assert.equal(today.canonical_url, `https://www.finding-stories.com${project.path}`);
    assert.equal(today.campaign, `${project.slug}-project-launch`);
  }
});

test('daily queue is selective, complete, prioritized and unique', async () => {
  const today = JSON.parse(await readFile('generated/operations/azizi-florence/today.json', 'utf8'));
  assert.ok(today.actions.length > 0 && today.actions.length <= 5);
  assert.equal(new Set(today.actions.map(action => action.id)).size, today.actions.length);
  assert.deepEqual(today.actions.map(action => action.priority), [1, 2, 3, 4, 5]);
  for (const action of today.actions) {
    for (const field of actionFields) assert.ok(action[field] !== undefined, `${action.id}: ${field}`);
    assert.match(action.approval_type, /HUMAN|RELATIONSHIP|EVIDENCE/);
    assert.equal(action.destination_url, 'https://www.finding-stories.com/azizi-florence');
  }
});

test('next-best-action contains exactly one actionable recommendation', async () => {
  const next = JSON.parse(await readFile('generated/operations/azizi-florence/next-best-action.json', 'utf8'));
  for (const field of ['action', 'why', 'buyer_intent', 'expected_business_value', 'dependency', 'human_required', 'asset', 'tracked_url', 'success_metric', 'review_condition']) assert.ok(next[field] !== undefined, field);
  assert.equal(Array.isArray(next.action), false);
  assert.equal(typeof next.action, 'string');
  assert.equal(next.human_required, true);
});

test('operations outputs use canonical production URLs and valid stable UTMs', async () => {
  for (const name of required) {
    const output = JSON.parse(await readFile(`generated/operations/azizi-florence/${name}`, 'utf8'));
    const text = JSON.stringify(output);
    assert.doesNotMatch(text, forbiddenUrl, name);
    assert.doesNotMatch(text, unsafe, name);
    for (const raw of values(output).filter(value => typeof value === 'string' && value.startsWith('https://www.finding-stories.com/azizi-florence?'))) {
      const url = new URL(raw);
      assert.equal(url.origin + url.pathname, 'https://www.finding-stories.com/azizi-florence');
      assert.equal(url.searchParams.get('utm_campaign'), 'azizi-florence-project-launch');
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) assert.ok(url.searchParams.get(key), `${name}: ${key}`);
    }
  }
});

test('unavailable analytics stay null and no external state is fabricated', async () => {
  const performance = JSON.parse(await readFile('generated/operations/azizi-florence/performance.json', 'utf8'));
  assert.equal(performance.data_status, 'unavailable');
  for (const section of ['search_console', 'referral', 'conversion', 'revenue']) {
    for (const metric of Object.values(performance[section])) assert.equal(metric, null, `${section} metric`);
  }
  const social = JSON.parse(await readFile('generated/operations/azizi-florence/social-queue.json', 'utf8'));
  assert.ok(social.queue.every(item => item.publish_status !== 'PUBLISHED' && item.evidence_url === null));
  const authority = JSON.parse(await readFile('generated/operations/azizi-florence/authority-status.json', 'utf8'));
  assert.ok(authority.targets.every(target => target.live_status === 'not_live' && target.evidence_url === null));
  const outreach = JSON.parse(await readFile('generated/operations/azizi-florence/outreach-queue.json', 'utf8'));
  assert.ok(outreach.queue.every(item => item.target === null && item.send_status === 'not_sent' && item.result === null));
});

test('human queue has exact completion instructions and safe automation gates', async () => {
  const queue = JSON.parse(await readFile('generated/operations/azizi-florence/human-action-queue.json', 'utf8'));
  assert.ok(queue.actions.length > 0);
  for (const item of queue.actions) for (const field of ['WHAT', 'WHY', 'WHERE', 'EXACT ASSET', 'TRACKED URL', 'WHAT TO CAPTURE', 'HOW TO MARK COMPLETE']) assert.ok(item[field], `${item.id}: ${field}`);
  assert.equal(queue.external_action_performed, false);
});

test('content decisions require evidence and supporting pages remain quality gated', async () => {
  const refresh = JSON.parse(await readFile('generated/operations/azizi-florence/content-refresh-decision.json', 'utf8'));
  assert.equal(refresh.decision, 'NO_CHANGE');
  assert.equal(refresh.evidence_available, false);
  const queries = JSON.parse(await readFile('generated/operations/azizi-florence/query-opportunity-loop.json', 'utf8'));
  assert.deepEqual(queries.queries, []);
  assert.match(queries.supporting_page_gate, /materially distinct intent/i);
});
