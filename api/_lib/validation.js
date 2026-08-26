import { z } from 'zod';

const clean = (max) => z.string().trim().max(max).optional().default('');
export const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30).regex(/^[+()\-\s\d]+$/),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional().default(''),
  country_of_residence: clean(100), purpose: clean(80), budget: clean(100),
  property_type: clean(100), bedrooms: clean(50), preferred_areas: clean(300),
  payment_method: clean(50), purchase_timeline: clean(100), owns_uae_property: clean(30),
  additional_requirements: clean(1500),
  consent: z.union([z.boolean(), z.literal('true'), z.literal('on')]).transform(Boolean),
  source: clean(120), landing_page: clean(1000), referrer: clean(1000),
  utm_source: clean(200), utm_medium: clean(200), utm_campaign: clean(200), content_source: clean(300),
  page_type: clean(80), acquisition_area: clean(150), acquisition_project: clean(200), acquisition_developer: clean(200),
  budget_intent: clean(100), bedroom_intent: clean(50), acquisition_signals: z.array(z.enum(['project_page_enquiry','price_page_enquiry','repeated_visit','property_comparison','payment_plan_interest','whatsapp_click','meeting_request','site_visit_request'])).max(8).optional().default([]),
  submission_id: z.string().uuid().optional(),
  website: clean(200)
}).strict();

export function safeText(value, max = 1500) {
  // eslint-disable-next-line no-control-regex -- intentionally strips unprintable input
  return String(value || '').replace(/[<>\u0000-\u001F]/g, '').trim().slice(0, max);
}

const nullableDateTime = z.union([z.string().datetime({ offset: true }), z.null()]);
const leadId = z.string().uuid();
export const leadUpdateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status'), id: leadId, status: z.enum(['new', 'contacted', 'qualified', 'meeting_scheduled', 'site_visit_scheduled', 'booked', 'lost']) }).strict(),
  z.object({ action: z.literal('assign'), id: leadId, assigned_to: z.string().trim().max(100) }).strict(),
  z.object({ action: z.literal('notes'), id: leadId, agent_notes: z.string().trim().max(5000) }).strict(),
  z.object({ action: z.literal('follow_up'), id: leadId, next_follow_up_at: nullableDateTime }).strict(),
  z.object({ action: z.literal('meeting'), id: leadId, meeting_at: nullableDateTime }).strict(),
  z.object({ action: z.literal('site_visit'), id: leadId, site_visit_at: nullableDateTime }).strict(),
  z.object({ action: z.literal('contacted'), id: leadId }).strict(),
  z.object({ action: z.literal('booked'), id: leadId }).strict(),
  z.object({ action: z.literal('lost'), id: leadId, lost_reason: z.string().trim().min(2).max(500) }).strict()
]);
