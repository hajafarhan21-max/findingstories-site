export const ROLES = Object.freeze(['SUPER_ADMIN','ADMIN','BUSINESS_HEAD','MANAGER','TEAM_LEADER','PROPERTY_ADVISOR','MARKETING','OPERATIONS']);
export const RESOURCES = Object.freeze(['leads','opportunities','inventory','tasks','meetings','site_visits','eois','bookings','reports','users','settings','imports','exports','assignments','audit_logs']);

export async function hasPermission(sql, identity, resource, action) {
  if (!identity?.id || !ROLES.includes(identity.role) || !RESOURCES.includes(resource)) return false;
  const rows = await sql`SELECT EXISTS(SELECT 1 FROM crm_role_permissions WHERE role=${identity.role} AND resource=${resource} AND action=${action}) allowed`;
  return rows[0]?.allowed === true;
}

// Recursive reporting traversal makes the access rule stable when intermediate
// management levels are introduced. The user themself is always in their scope.
export async function visibleUserIds(sql, identity) {
  if (identity.role === 'SUPER_ADMIN') return null;
  const rows = await sql`WITH RECURSIVE reports AS (
    SELECT id FROM crm_users WHERE id=${identity.id}
    UNION ALL SELECT u.id FROM crm_users u JOIN reports r ON u.reports_to=r.id WHERE u.active=TRUE
  ) SELECT id FROM reports`;
  return rows.map(row => row.id);
}

export function canAccessOwner(identity, visibleIds, ownerId) {
  if (identity?.role === 'SUPER_ADMIN') return true;
  return ownerId != null && visibleIds.includes(ownerId);
}
