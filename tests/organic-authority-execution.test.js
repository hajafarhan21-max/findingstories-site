import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { loadPublicProjects } from '../project-launch/registry.js';

const required = ['revenue-execution-board.json', 'tier-a-actions.json', 'social-revenue-pack.json', 'editorial-pitches.json', 'partner-outreach-pack.json', 'profile-execution.json', 'google-business-profile-readiness.json', 'human-action-queue.json', 'today.json', 'execution-dashboard-metrics.json', 'authority-execution-audit.json'];
const forbiddenUrl = /(?:localhost|vercel\.app|https?:\/\/[^"?]*preview)/i;
const unsafeClaim = /\b(?:guaranteed\s+(?:roi|returns?|appreciation)|last chance|act now|limited units? left)\b/i;
const internalId = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

test('execution generator supports every approved project manifest', async () => {
  for (const project of await loadPublicProjects()) {
    const files = await readdir(`generated/authority/${project.slug}`);
    for (const name of required) assert.ok(files.includes(name), `${project.slug}: ${name}`);
    const board = JSON.parse(await readFile(`generated/authority/${project.slug}/revenue-execution-board.json`, 'utf8'));
    assert.equal(board.campaign, `${project.slug}-project-launch`);
    assert.equal(board.canonical_url, `https://www.finding-stories.com${project.path}`);
  }
});

test('execution board is practical, unique, prioritized and human-gated', async () => {
  const board = JSON.parse(await readFile('generated/authority/azizi-florence/revenue-execution-board.json', 'utf8'));
  const ids = board.actions.map(action => action.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(board.actions.map(action => action.priority), [...board.actions.map(action => action.priority)].sort((a, b) => a - b));
  const classifications = new Set(['AUTO_SAFE', 'HUMAN_APPROVAL_REQUIRED', 'HUMAN_LOGIN_REQUIRED', 'RELATIONSHIP_REQUIRED', 'EVIDENCE_REQUIRED', 'BLOCKED']);
  for (const action of board.actions) {
    for (const field of ['action', 'target_name', 'objective', 'buyer_intent', 'destination_url', 'tracked_url', 'content_asset', 'approval_requirement', 'evidence_required', 'status', 'priority', 'next_action', 'success_definition']) assert.ok(action[field] !== undefined, `${action.id}: ${field}`);
    assert.ok(classifications.has(action.action_type), action.id);
    assert.equal(action.destination_url, 'https://www.finding-stories.com/azizi-florence');
  }
});

test('all execution URLs are production canonical, deterministic and privacy safe', async () => {
  for (const name of required.concat(['citation-log.json', 'weekly-execution.json'])) {
    const value = JSON.parse(await readFile(`generated/authority/azizi-florence/${name}`, 'utf8'));
    const text = JSON.stringify(value);
    assert.doesNotMatch(text, forbiddenUrl, name);
    assert.doesNotMatch(text, internalId, name);
    assert.doesNotMatch(text, unsafeClaim, name);
    for (const match of text.matchAll(/https:\/\/www\.finding-stories\.com\/azizi-florence\?[^"\\]+/g)) {
      const url = new URL(match[0].replaceAll('\\u0026', '&'));
      assert.equal(url.pathname, '/azizi-florence');
      assert.equal(url.searchParams.get('utm_campaign'), 'azizi-florence-project-launch');
      for (const field of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) assert.ok(url.searchParams.get(field), `${name}: ${field}`);
    }
  }
});

test('Tier A stays selective, measurable and free of unverified external claims', async () => {
  const tierA = JSON.parse(await readFile('generated/authority/azizi-florence/tier-a-actions.json', 'utf8'));
  assert.ok(tierA.actions.length > 0 && tierA.actions.length <= 3);
  for (const action of tierA.actions) {
    assert.ok(['linkedin', 'whatsapp', 'instagram'].includes(action.channel));
    assert.notEqual(action.status, 'live');
    assert.match(action.success_metric, /session|click|lead/i);
  }
});

test('social ownership, publication, outreach and citations are never fabricated', async () => {
  const social = JSON.parse(await readFile('generated/authority/azizi-florence/social-revenue-pack.json', 'utf8'));
  assert.equal(social.account_ownership_verified, false);
  assert.equal(social.publication_performed, false);
  assert.equal(social.linkedin_posts.length, 5);
  for (const post of social.linkedin_posts) {
    assert.equal(post.approval_type, 'HUMAN_LOGIN_REQUIRED');
    assert.match(post.exact_post_copy, new RegExp(post.tracked_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const pitches = JSON.parse(await readFile('generated/authority/azizi-florence/editorial-pitches.json', 'utf8'));
  assert.equal(pitches.pitches.length, 5);
  assert.ok(pitches.pitches.every(pitch => pitch.sent === false && pitch.status === 'needs_relationship'));
  const citations = JSON.parse(await readFile('generated/authority/azizi-florence/citation-log.json', 'utf8'));
  assert.deepEqual(citations.records, []);
  assert.ok(citations.live_gate.required_fields.includes('evidence_reference'));
});

test('profile, metrics and daily operation preserve evidence gaps', async () => {
  const profile = JSON.parse(await readFile('generated/authority/azizi-florence/profile-execution.json', 'utf8'));
  assert.ok(profile.opportunities.every(item => item.human_verification_required && item.submitted === false));
  const metrics = JSON.parse(await readFile('generated/authority/azizi-florence/execution-dashboard-metrics.json', 'utf8'));
  for (const field of ['referral_sessions', 'organic_sessions', 'whatsapp_clicks', 'lead_form_start', 'lead_success', 'qualified_leads', 'meetings']) assert.equal(metrics[field], null);
  const today = JSON.parse(await readFile('generated/authority/azizi-florence/today.json', 'utf8'));
  assert.ok(today.actions.length <= 5);
  const human = JSON.parse(await readFile('generated/authority/azizi-florence/human-action-queue.json', 'utf8'));
  assert.ok(human.actions.every(action => action.reason_human_required && action.exact_evidence_to_capture && action.completion_checklist.length));
});
