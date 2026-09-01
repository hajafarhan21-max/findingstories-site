import { isAdmin, isSameOrigin } from './auth.js';
import { activateBinghattiInventory, binghattiActivationStatus } from './binghatti-import.js';
import { database } from './db.js';
import { json, method } from './http.js';
import { randomUUID } from 'node:crypto';
import { inventoryFailureCategory, safeSqlstate } from './activation-diagnostics.js';

const safeResult = result => ({ activated: result.activated, verified: result.verified, permanently_disabled: result.activated,
  records: result.records.map(({ unit, status, data_quality, is_test }) => ({ unit, status, data_quality, is_test })) });

export default async function inventoryActivationHandler(req, res) {
  const requestId = randomUUID();
  if (!method(req, res, ['GET', 'POST'])) return;
  if (!isAdmin(req)) return json(res, 401, { error: 'Authentication required.' });
  if (req.method === 'POST' && !isSameOrigin(req)) return json(res, 403, { error: 'Same-origin request required.' });
  try {
    // The authenticated CRM has already initialized the schema while loading its
    // lead/revenue data. Re-running the complete migration sequence here can
    // exhaust a serverless request before the two idempotent upserts begin.
    const sql = database();
    const current = await binghattiActivationStatus(sql);
    if (req.method === 'GET') return json(res, 200, safeResult(current));
    if (current.activated) return json(res, 410, { ...safeResult(current), error: 'This one-time activation is permanently disabled.' });
    return json(res, 200, safeResult(await activateBinghattiInventory(sql)));
  } catch (error) {
    const category = inventoryFailureCategory(error);
    const sqlstate = safeSqlstate(error);
    console.error('Safe operation failure', { operation:'binghatti_inventory_activation', category, sqlstate, request_id:requestId });
    return json(res, 500, { error:'Inventory activation failed safely.', operation:'binghatti_inventory_activation', category, ...(sqlstate && { sqlstate }), request_id:requestId });
  }
}
