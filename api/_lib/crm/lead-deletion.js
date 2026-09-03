const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseLeadDeletion(body) {
  if (body?.confirm !== true || !Array.isArray(body.ids)) return null;
  const ids = [...new Set(body.ids.map(value => String(value).trim().toLowerCase()))];
  if (!ids.length || ids.length > 500 || ids.some(id => !UUID.test(id))) return null;
  return ids;
}

export const hasStrictDeleteRole = identity => identity?.role === 'SUPER_ADMIN';

export function deletionResult(rows, requestedIds) {
  const byId = new Map(rows.map(row => [String(row.lead_id), row]));
  const deletedIds = requestedIds.filter(id => byId.get(id)?.deleted === true);
  const notDeleted = requestedIds.filter(id => !deletedIds.includes(id)).map(id => ({
    id,
    reason: String(byId.get(id)?.reason || 'Lead was not found or could not be deleted.')
  }));
  return { deletedCount: deletedIds.length, deletedIds, notDeleted };
}
