import { database, ensureSchema } from './_lib/db.js';
import { json, method } from './_lib/http.js';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  const checks = { api: 'ok', database: 'not_configured', openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured' };
  try {
    if (process.env.DATABASE_URL) { await ensureSchema(); await database()`SELECT 1`; checks.database = 'ok'; }
  } catch { checks.database = 'error'; }
  json(res, checks.database === 'error' ? 503 : 200, { status: checks.database === 'error' ? 'degraded' : 'ok', checks, timestamp: new Date().toISOString() });
}
