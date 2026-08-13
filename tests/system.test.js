import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { validPassword } from '../api/_lib/auth.js';
import { databaseUrl, neonConnectionUrl } from '../api/_lib/db.js';
import { databaseFailureCategory, healthReport } from '../api/_lib/health.js';

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

test('health report logs only safe database failure diagnostics', async () => {
  const entries = [];
  const error = Object.assign(new Error('secret connection details'), { code: '28P01' });
  const report = await healthReport({
    databaseConfigured: true,
    openaiConfigured: true,
    checkDatabase: async () => { throw error; },
    log: (...entry) => entries.push(entry)
  });
  assert.equal(report.checks.database, 'error');
  assert.equal(databaseFailureCategory(error), 'authentication_failed');
  assert.deepEqual(entries[0][1].category, 'authentication_failed');
  assert.equal(report.checks.databaseDiagnostic, 'authentication_failed');
  assert.equal(JSON.stringify(entries).includes(error.message), false);
});

test('database URL resolution prefers DATABASE_URL', () => {
  assert.equal(databaseUrl({ DATABASE_URL: 'preview', PRODUCTION_DATABASE_URL: 'production' }), 'preview');
});

test('database URL resolution falls back to PRODUCTION_DATABASE_URL', () => {
  assert.equal(databaseUrl({ PRODUCTION_DATABASE_URL: 'production' }), 'production');
});

test('production runtime prefers its explicitly scoped database URL and trims copy whitespace', () => {
  assert.equal(databaseUrl({ VERCEL_ENV: 'production', DATABASE_URL: 'stale', PRODUCTION_DATABASE_URL: '  production\n' }), 'production');
});

test('Neon connection setup requires TLS without changing endpoint type', () => {
  const direct = new URL(neonConnectionUrl({ DATABASE_URL: 'postgresql://user:pass@ep-example.us-east-2.aws.neon.tech/db' }));
  const pooled = new URL(neonConnectionUrl({ DATABASE_URL: 'postgresql://user:pass@ep-example-pooler.us-east-2.aws.neon.tech/db?sslmode=disable' }));
  assert.equal(direct.searchParams.get('sslmode'), 'require');
  assert.equal(pooled.searchParams.get('sslmode'), 'require');
  assert.match(pooled.hostname, /-pooler\./);
});

test('malformed database configuration has a safe connection diagnostic', () => {
  assert.throws(() => neonConnectionUrl({ DATABASE_URL: 'not a connection string' }), error => {
    assert.equal(databaseFailureCategory(error), 'connection_failed');
    assert.equal(error.message.includes('not a connection string'), false);
    return true;
  });
});

test('legacy duplicate event contacts do not make additive schema initialization fail', async () => {
  const runtime = await readFile('api/_lib/db.js', 'utf8');
  const migration = await readFile('database/migrations/003_event_rsvp.sql', 'utf8');
  for (const source of [runtime, migration]) {
    assert.doesNotMatch(source, /CREATE UNIQUE INDEX IF NOT EXISTS event_rsvps_(?:phone|email)_unique/);
    assert.match(source, /CREATE INDEX IF NOT EXISTS event_rsvps_phone_lookup_idx/);
  }
});

test('runtime schema initialization uses the PostgreSQL 17 core UUID generator without extensions', async () => {
  const source = await readFile('api/_lib/db.js', 'utf8');
  assert.match(source, /DEFAULT pg_catalog\.gen_random_uuid\(\)/);
  assert.doesNotMatch(source, /CREATE EXTENSION|to_regprocedure/);
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

test('Vercel deployment stays within the Hobby serverless function limit', async () => {
  const files = await readdir('api', { recursive: true });
  const handlers = files.filter(file => file.endsWith('.js') && !file.startsWith('_lib/'));
  assert.equal(handlers.length, 10);
  assert.ok(handlers.length <= 12);
});

test('production verification is read-only and delegates deployment to Vercel Git integration', async () => {
  const workflow = await readFile('.github/workflows/production.yml', 'utf8');
  const smoke = await readFile('scripts/production-smoke.mjs', 'utf8');
  for (const forbidden of ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID', 'PRODUCTION_DATABASE_URL', 'ADMIN_PASSWORD']) {
    assert.equal(workflow.includes(forbidden), false);
  }
  assert.doesNotMatch(workflow, /vercel(?:@latest)?\s+(?:deploy|pull|build)/i);
  assert.doesNotMatch(smoke, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.match(smoke, /\/api\/health/);
  assert.match(smoke, /\/open-house/);
  assert.match(smoke, /\/event-admin\.html/);
});

function schemaSql({ uuidAvailable = true, fail } = {}) {
  const statements = [];
  const sql = async (strings, ...values) => {
    const statement = String.raw({ raw: strings }, ...values).replace(/\s+/g, ' ').trim();
    statements.push(statement);
    const error = fail?.(statement, statements.length);
    if (error) throw error;
    if (statement.startsWith("SELECT to_regprocedure")) return [{ available: uuidAvailable }];
    return [];
  };
  return { sql, statements };
}

test('empty Neon-compatible schema runs every additive initialization phase', async () => {
  const { initializeSchema, initializeEventSchema } = await import('../api/_lib/db.js');
  const fake = schemaSql();
  await initializeSchema(fake.sql);
  await initializeEventSchema(fake.sql);
  assert.ok(fake.statements.some(value => value.startsWith('CREATE TABLE IF NOT EXISTS leads')));
  assert.ok(fake.statements.some(value => value.startsWith('CREATE TABLE IF NOT EXISTS event_rsvps')));
  assert.ok(fake.statements.some(value => value.startsWith('CREATE OR REPLACE FUNCTION confirm_event_slot')));
});

test('legacy and partially completed event tables receive referenced columns before indexes', async () => {
  const { initializeEventSchema } = await import('../api/_lib/db.js');
  const fake = schemaSql();
  await initializeEventSchema(fake.sql);
  const column = fake.statements.findIndex(value => value.includes('event_rsvps ADD COLUMN IF NOT EXISTS event_id'));
  const index = fake.statements.findIndex(value => value.includes('event_rsvps_phone_lookup_idx'));
  assert.ok(column >= 0 && index > column);
});

test('duplicate phone and email records are supported by non-unique lookup indexes', async () => {
  const { initializeEventSchema } = await import('../api/_lib/db.js');
  const fake = schemaSql();
  await initializeEventSchema(fake.sql);
  const contacts = fake.statements.filter(value => /event_rsvps_(phone|email)_lookup_idx/.test(value));
  assert.equal(contacts.length, 2);
  assert.ok(contacts.every(value => !value.startsWith('CREATE UNIQUE INDEX')));
});

test('schema initialization is repeatable after a completed migration', async () => {
  const { initializeSchema, initializeEventSchema } = await import('../api/_lib/db.js');
  const fake = schemaSql();
  await initializeSchema(fake.sql); await initializeEventSchema(fake.sql);
  await initializeSchema(fake.sql); await initializeEventSchema(fake.sql);
  assert.ok(fake.statements.length > 100);
});

test('simultaneous initialization tolerates duplicate-object DDL races', async () => {
  const { initializeEventSchema } = await import('../api/_lib/db.js');
  let raced = false;
  const fake = schemaSql({ fail: statement => {
    if (!raced && statement.includes('event_rsvps_phone_lookup_idx')) {
      raced = true;
      return Object.assign(new Error('unsafe raw database detail'), { code: '42P07' });
    }
  }});
  await Promise.all([initializeEventSchema(fake.sql), initializeEventSchema(fake.sql)]);
  assert.equal(raced, true);
});

test('missing pgcrypto permission is irrelevant because initialization never creates extensions', async () => {
  const { initializeSchema } = await import('../api/_lib/db.js');
  const fake = schemaSql({ fail: statement => {
    if (statement.startsWith('CREATE EXTENSION')) return Object.assign(new Error('denied'), { code: '42501' });
  }});
  await initializeSchema(fake.sql);
  assert.equal(fake.statements.some(value => value.startsWith('CREATE EXTENSION')), false);
});

test('event seed avoids PostgreSQL 42883 from the unsupported time generate_series overload', async () => {
  const undefinedFunction = statement => /generate_series\(TIME [^)]*INTERVAL/.test(statement)
    ? Object.assign(new Error('function generate_series(time without time zone, time without time zone, interval) does not exist'), { code: '42883' })
    : undefined;
  const legacy = schemaSql({ fail: undefinedFunction });
  await assert.rejects(
    legacy.sql`SELECT * FROM generate_series(TIME '10:00', TIME '18:30', INTERVAL '30 minutes')`,
    error => error.code === '42883'
  );

  const { initializeEventSchema } = await import('../api/_lib/db.js');
  const fixed = schemaSql({ fail: undefinedFunction });
  await initializeEventSchema(fixed.sql);
  const seed = fixed.statements.find(value => value.startsWith('INSERT INTO event_slots'));
  assert.match(seed, /generate_series\(0,GREATEST/);
  assert.doesNotMatch(seed, /generate_series\(TIME/);
});

test('event SQL has no extension-only or unresolved function references', async () => {
  const runtime = await readFile('api/_lib/db.js', 'utf8');
  const migration = await readFile('database/migrations/003_event_rsvp.sql', 'utf8');
  for (const source of [runtime, migration]) {
    assert.doesNotMatch(source, /CREATE EXTENSION|(?<!pg_catalog\.)gen_random_uuid\(/);
    assert.doesNotMatch(source, /generate_series\(TIME/);
    assert.match(source, /CREATE OR REPLACE FUNCTION confirm_event_slot/);
  }
});

test('schema failures report safe SQLSTATE, phase and stable statement without raw errors', async () => {
  const { initializeEventSchema } = await import('../api/_lib/db.js');
  const fake = schemaSql({ fail: statement => statement.includes('event_rsvps_pipeline_idx')
    ? Object.assign(new Error('hostname password customer@example.com SELECT secret'), { code: '42703' }) : undefined });
  let failure;
  try { await initializeEventSchema(fake.sql); } catch (error) { failure = error; }
  const report = await healthReport({ databaseConfigured: true, openaiConfigured: true,
    checkDatabase: async () => { throw failure; }, log: () => {} });
  assert.equal(report.checks.databaseSqlState, '42703');
  assert.equal(report.checks.databasePhase, 'events');
  assert.equal(report.checks.databaseStatement, 'create_event_indexes');
  assert.doesNotMatch(JSON.stringify(report), /hostname|password|customer|SELECT secret/);
});
