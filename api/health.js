import { database, databaseUrl } from './_lib/db.js';
import { json, method } from './_lib/http.js';
import { healthReport } from './_lib/health.js';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  const report = await healthReport({ databaseConfigured: Boolean(databaseUrl()),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    checkDatabase: async () => {
      const sql = database();
      const rows=await sql`SELECT to_regclass('public.leads') leads, to_regclass('public.property_inventory') inventory`;
      if(!rows[0]?.leads||!rows[0]?.inventory)throw Object.assign(new Error('Required production tables are missing'),{diagnostic:'schema_failed'});
    } });
  json(res, report.status === 'degraded' ? 503 : 200, report);
}
