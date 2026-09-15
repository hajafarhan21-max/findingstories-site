import { z } from 'zod';
import { statuses } from './event.js';

const uuid = z.string().uuid();
export const acceptanceUpdateSchema = z.discriminatedUnion('action', [
  z.object({ action:z.literal('prepare') }).strict(),
  z.object({ action:z.literal('assign'), rsvp_id:uuid, assigned_to:z.string().trim().min(1).max(100) }).strict(),
  z.object({ action:z.literal('status'), rsvp_id:uuid, status:z.enum(statuses), lost_reason:z.string().trim().max(500).optional().default('') }).strict(),
  z.object({ action:z.literal('meeting'), rsvp_id:uuid, slot_id:uuid }).strict(),
  z.object({ action:z.literal('site_visit'), rsvp_id:uuid, scheduled_at:z.string().datetime({ offset:true }), details:z.string().trim().max(1000).optional().default('') }).strict(),
  z.object({ action:z.literal('activity'), rsvp_id:uuid, activity_type:z.enum(['note','call','whatsapp']), details:z.string().trim().min(1).max(3000) }).strict(),
  z.object({ action:z.literal('archive'), rsvp_id:uuid }).strict()
]);

// booked_count is a materialized occupancy counter. Its authoritative value is
// the number of non-archived RSVPs whose confirmed_slot points at the slot.
// PostgreSQL data-modifying CTEs share a snapshot, so rows archived by the same
// statement must be explicitly excluded from the recount.
export async function prepareTestFixture(sql) {
  return sql`WITH stale AS (
      UPDATE event_rsvps r SET archived_at=NOW(),updated_at=NOW() FROM events e
      WHERE e.id=r.event_id AND e.is_test=TRUE AND r.is_test=TRUE AND r.archived_at IS NULL
      RETURNING r.id
    ), repaired_leads AS (
      UPDATE leads l SET is_test=TRUE,updated_at=NOW() FROM event_rsvps r,events e
      WHERE l.submission_id=r.id AND e.id=r.event_id AND e.is_test=TRUE AND r.is_test=TRUE AND l.is_test=FALSE
      RETURNING l.id
    ), occupancy AS (
      UPDATE event_slots s SET booked_count=(SELECT COUNT(*)::int FROM event_rsvps active
        WHERE active.confirmed_slot=s.id AND active.archived_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM stale WHERE stale.id=active.id))
      FROM events e WHERE e.id=s.event_id AND e.is_test=TRUE
      RETURNING s.id
    ) SELECT (SELECT COUNT(*)::int FROM stale) archived_rsvps,
      (SELECT COUNT(*)::int FROM repaired_leads) repaired_leads,
      (SELECT COUNT(*)::int FROM occupancy) reconciled_slots`;
}

export async function archiveTestRsvp(sql, rsvpId) {
  return sql`WITH archived AS (
      UPDATE event_rsvps r SET archived_at=NOW(),updated_at=NOW() FROM events e
      WHERE r.id=${rsvpId}::uuid AND r.is_test=TRUE AND r.archived_at IS NULL AND e.id=r.event_id AND e.is_test=TRUE
      RETURNING r.id,r.event_id,r.is_test,r.archived_at
    ), occupancy AS (
      UPDATE event_slots s SET booked_count=(SELECT COUNT(*)::int FROM event_rsvps active
        WHERE active.confirmed_slot=s.id AND active.archived_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM archived WHERE archived.id=active.id))
      FROM archived a WHERE s.event_id=a.event_id RETURNING s.id
    ) SELECT id,is_test,archived_at,(SELECT COUNT(*)::int FROM occupancy) recalculated_slots FROM archived`;
}

export const acceptanceQuerySchema = z.object({
  event_id:uuid,
  action:z.enum(['inspect','report','export']).optional().default('inspect')
}).strict();
