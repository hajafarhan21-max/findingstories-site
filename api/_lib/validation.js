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
  website: clean(200)
}).strict();

export function safeText(value, max = 1500) {
  return String(value || '').replace(/[<>\u0000-\u001F]/g, '').trim().slice(0, max);
}
