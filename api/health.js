import { database, databaseUrl, ensureEventSchema, ensureSchema } from './_lib/db.js';
import { json, method } from './_lib/http.js';
import { healthReport } from './_lib/health.js';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  const report = await healthReport({ databaseConfigured: Boolean(databaseUrl()),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    checkDatabase: async () => {
      const sql = database();
      await sql`SELECT 1`;
      try { await ensureSchema(); }
      catch (error) { throw Object.assign(error, { diagnostic: error?.code === '42501' ? 'permission_failed' : error?.code === '0A000' ? 'extension_failed' : 'schema_failed' }); }
      try { await ensureEventSchema(); }
      catch (error) { throw Object.assign(error, { diagnostic: error?.code === '42501' ? 'permission_failed' : error?.code === '0A000' ? 'extension_failed' : 'schema_failed' }); }
      await sql`SELECT 1`;
    } });
  json(res, report.status === 'degraded' ? 503 : 200, report);
}
