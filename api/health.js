import { database, ensureSchema } from './_lib/db.js';
import { json, method } from './_lib/http.js';
import { healthReport } from './_lib/health.js';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  const report = await healthReport({ databaseConfigured: Boolean(process.env.DATABASE_URL),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    checkDatabase: async () => { await ensureSchema(); await database()`SELECT 1`; } });
  json(res, report.status === 'degraded' ? 503 : 200, report);
}
