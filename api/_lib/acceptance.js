import { z } from 'zod';
import { statuses } from './event.js';

const uuid = z.string().uuid();
export const acceptanceUpdateSchema = z.discriminatedUnion('action', [
  z.object({ action:z.literal('assign'), rsvp_id:uuid, assigned_to:z.string().trim().min(1).max(100) }).strict(),
  z.object({ action:z.literal('status'), rsvp_id:uuid, status:z.enum(statuses), lost_reason:z.string().trim().max(500).optional().default('') }).strict(),
  z.object({ action:z.literal('meeting'), rsvp_id:uuid, slot_id:uuid }).strict(),
  z.object({ action:z.literal('site_visit'), rsvp_id:uuid, scheduled_at:z.string().datetime({ offset:true }), details:z.string().trim().max(1000).optional().default('') }).strict(),
  z.object({ action:z.literal('activity'), rsvp_id:uuid, activity_type:z.enum(['note','call','whatsapp']), details:z.string().trim().min(1).max(3000) }).strict(),
  z.object({ action:z.literal('archive'), rsvp_id:uuid }).strict()
]);

export const acceptanceQuerySchema = z.object({
  event_id:uuid,
  action:z.enum(['inspect','report','export']).optional().default('inspect')
}).strict();
