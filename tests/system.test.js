import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { validPassword } from '../api/_lib/auth.js';
import { healthReport } from '../api/_lib/health.js';
import { configuredDatabaseUrl } from '../api/_lib/config.js';

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

test('health report exposes availability states without values', async () => {
  const configured = await healthReport({ databaseConfigured: true, openaiConfigured: true, checkDatabase: async () => {} });
  assert.deepEqual(configured.checks, { api: 'ok', database: 'ok', openai: 'configured' });
  const unavailable = await healthReport({ databaseConfigured: false, openaiConfigured: false, checkDatabase: async () => {} });
  assert.deepEqual(unavailable.checks, { api: 'ok', database: 'not_configured', openai: 'not_configured' });
});

test('database URL supports production alias and standard URL precedence', () => {
  const previous = { database: process.env.DATABASE_URL, production: process.env.PRODUCTION_DATABASE_URL };
  try {
    delete process.env.DATABASE_URL;
    process.env.PRODUCTION_DATABASE_URL = 'production-alias-test';
    assert.equal(configuredDatabaseUrl(), 'production-alias-test');
    process.env.DATABASE_URL = 'standard-url-test';
    assert.equal(configuredDatabaseUrl(), 'standard-url-test');
  } finally {
    if (previous.database === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous.database;
    if (previous.production === undefined) delete process.env.PRODUCTION_DATABASE_URL; else process.env.PRODUCTION_DATABASE_URL = previous.production;
  }
});

test('health database check can use the production database alias', async () => {
  const previous = { database: process.env.DATABASE_URL, production: process.env.PRODUCTION_DATABASE_URL };
  try {
    delete process.env.DATABASE_URL;
    process.env.PRODUCTION_DATABASE_URL = 'production-health-test';
    const report = await healthReport({
      databaseConfigured: Boolean(configuredDatabaseUrl()), openaiConfigured: true,
      checkDatabase: async () => assert.equal(configuredDatabaseUrl(), 'production-health-test')
    });
    assert.equal(report.status, 'ok');
    assert.equal(report.checks.database, 'ok');
  } finally {
    if (previous.database === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous.database;
    if (previous.production === undefined) delete process.env.PRODUCTION_DATABASE_URL; else process.env.PRODUCTION_DATABASE_URL = previous.production;
  }
});

test('production build includes required routes/assets and no secret canaries', async () => {
  const canaries = ['db-secret-canary', 'production-db-secret-canary', 'openai-secret-canary', 'admin-secret-canary', 'session-secret-canary'];
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8', env: {
    ...process.env, DATABASE_URL: canaries[0], PRODUCTION_DATABASE_URL: canaries[1], OPENAI_API_KEY: canaries[2], ADMIN_PASSWORD: canaries[3], SESSION_SECRET: canaries[4]
  }});
  assert.equal(result.status, 0, result.stderr);
  const files = ['dist/index.html','dist/admin.html','dist/public/advisor.js','dist/public/advisor.css'];
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
