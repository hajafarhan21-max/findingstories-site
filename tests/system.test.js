import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { validPassword } from '../api/_lib/auth.js';
import { databaseUrl } from '../api/_lib/db.js';
import { healthReport } from '../api/_lib/health.js';

test('admin authentication rejects wrong and accepts configured password', () => {
  const previous = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'test-only-password-32-characters';
  try {
    assert.equal(validPassword('incorrect-password-32-characters'), false);
    assert.equal(validPassword('test-only-password-32-characters'), true);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previous;
  }
});

test('health report marks a successful database connection as ok without exposing values', async () => {
  const configured = await healthReport({ databaseConfigured: true, openaiConfigured: true, checkDatabase: async () => {} });
  assert.deepEqual(configured.checks, { api: 'ok', database: 'ok', openai: 'configured' });
  const unavailable = await healthReport({ databaseConfigured: false, openaiConfigured: false, checkDatabase: async () => {} });
  assert.deepEqual(unavailable.checks, { api: 'ok', database: 'not_configured', openai: 'not_configured' });
});

test('database URL resolution prefers DATABASE_URL', () => {
  assert.equal(databaseUrl({ DATABASE_URL: 'preview', PRODUCTION_DATABASE_URL: 'production' }), 'preview');
});

test('database URL resolution falls back to PRODUCTION_DATABASE_URL', () => {
  assert.equal(databaseUrl({ PRODUCTION_DATABASE_URL: 'production' }), 'production');
});

test('database URL resolution returns undefined when configuration is missing', () => {
  assert.equal(databaseUrl({}), undefined);
});

test('production build includes required routes/assets and no secret canaries', async () => {
  const canaries = ['db-secret-canary', 'production-db-secret-canary', 'openai-secret-canary', 'admin-secret-canary', 'session-secret-canary'];
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8', env: {
    ...process.env, DATABASE_URL: canaries[0], PRODUCTION_DATABASE_URL: canaries[1], OPENAI_API_KEY: canaries[2],
    ADMIN_PASSWORD: canaries[3], SESSION_SECRET: canaries[4]
  }});
  assert.equal(result.status, 0, result.stderr);
  const files = ['dist/index.html','dist/admin.html','dist/open-house.html','dist/event-admin.html',
    'dist/public/advisor.js','dist/public/advisor.css','dist/public/open-house.js','dist/public/open-house.css',
    'dist/public/event-admin.js','dist/public/event-admin.css'];
  for (const file of files) await access(file);
  const output = (await Promise.all(files.map(file => readFile(file, 'utf8')))).join('\n');
  for (const canary of canaries) assert.equal(output.includes(canary), false);
});

test('frontend contains in-flight guards and stable submission IDs', async () => {
  const source = await readFile('public/advisor.js', 'utf8');
  assert.match(source, /button\.disabled/);
  assert.match(source, /dataset\.submitting/);
  assert.match(source, /submission_id/);
  assert.match(source, /crypto\.randomUUID/);
});
