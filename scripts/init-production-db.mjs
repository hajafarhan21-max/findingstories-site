import { database, ensureEventSchema, ensureSchema } from '../api/_lib/db.js';

const summary = process.env.GITHUB_STEP_SUMMARY;
const report = async message => {
  if (summary) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(summary, `${message}\n`);
  }
};

try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const sql = database();
  await sql`SELECT 1 AS connected`;
  await ensureSchema();
  await ensureEventSchema();
  const rows = await sql`SELECT current_database() IS NOT NULL AS ok`;
  if (rows[0]?.ok !== true) throw new Error('Neon connection verification returned an unexpected result');
  await report('### ✅ Neon database\nConnection verified and additive, idempotent schema initialization completed.');
  console.log('Neon connection and schema initialization succeeded.');
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown database error';
  await report(`### ❌ Neon database\n${message}`);
  console.error(`Database initialization failed: ${message}`);
  process.exitCode = 1;
}
