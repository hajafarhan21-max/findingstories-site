import { isAdmin, isSameOrigin } from './auth.js';
import { activateBinghattiInventory, binghattiActivationStatus } from './binghatti-import.js';
import { database, ensureSchema } from './db.js';
import { json, method } from './http.js';

const safeResult = result => ({ activated: result.activated, verified: result.verified, permanently_disabled: result.activated,
  records: result.records.map(({ unit, status, data_quality, is_test }) => ({ unit, status, data_quality, is_test })) });

export default async function inventoryActivationHandler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  if (!isAdmin(req)) return json(res, 401, { error: 'Authentication required.' });
  if (req.method === 'POST' && !isSameOrigin(req)) return json(res, 403, { error: 'Same-origin request required.' });
  try {
    await ensureSchema();
    const sql = database();
    const current = await binghattiActivationStatus(sql);
    if (req.method === 'GET') return json(res, 200, safeResult(current));
    if (current.activated) return json(res, 410, { ...safeResult(current), error: 'This one-time activation is permanently disabled.' });
    return json(res, 200, safeResult(await activateBinghattiInventory(sql)));
  } catch {
    console.error('Inventory activation failed safely.');
    return json(res, 500, { error: 'Inventory activation failed safely.' });
  }
}
