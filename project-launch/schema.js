import { z } from 'zod';

export const ASSET_SLOTS = ['hero','overview','gallery','amenities','location_map','masterplan','floor_plan','unit_type','payment_plan'];
const fact = z.object({ value: z.union([z.string(),z.number(),z.boolean()]), source: z.string().min(1), verified: z.literal(true) }).strict();
const asset = z.object({
  path: z.string().min(1), slot: z.enum(ASSET_SLOTS), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  perceptual_hash: z.string().regex(/^[a-f0-9]{16}$/), mime: z.enum(['image/jpeg','image/png','image/webp']),
  width: z.number().int().positive(), height: z.number().int().positive(),
  visual_review: z.object({ classification: z.enum([...ASSET_SLOTS,'lifestyle','logo','document','unsuitable']), confidence: z.number().min(0).max(1), evidence: z.string().min(10), reviewer: z.string().min(1) }).strict()
}).strict();
const organicSearch = z.object({
  property_types:z.array(z.string().min(2)).min(1).max(12),
  unit_configurations:z.array(z.string().min(2)).min(1).max(20),
  verified_pricing:z.boolean(), payment_plan:z.boolean(), completion_handover:z.boolean(),
  location_facts:z.boolean(), investment_considerations:z.array(z.string().min(10)).max(12),
  internal_link_context:z.array(z.string().min(3)).max(12),
  cta_mappings:z.record(z.string().min(2),z.string().min(2)),
  supporting_pages:z.array(z.object({
    path:z.string().startsWith('/insights/'), title:z.string().min(10).max(70),
    description:z.string().min(50).max(170), quality_rationale:z.string().min(80), approved:z.literal(true)
  }).strict()).max(3).default([])
}).strict();
const distribution = z.object({
  share_title:z.string().min(10).max(70), share_description:z.string().min(50).max(200), share_image:z.string().startsWith('/'),
  short_project_summary:z.string().min(40), long_project_summary:z.string().min(100),
  verified_developer_name:z.string().min(2), verified_location_name:z.string().min(2), property_types:z.array(z.string().min(2)).min(1),
  starting_price_summary:z.string().min(10).optional(), payment_plan_summary:z.string().min(10).optional(), completion_summary:z.string().min(10).optional(),
  availability_disclaimer:z.string().min(30), brochure_available:z.boolean(), floor_plan_available:z.boolean(),
  whatsapp_share_copy:z.string().min(30), social_copy_short:z.string().min(30), social_copy_medium:z.string().min(60), social_copy_long:z.string().min(100),
  linkedin_copy:z.string().min(100), instagram_caption:z.string().min(60), facebook_copy:z.string().min(60), x_copy:z.string().min(30).max(280),
  directory_summary:z.string().min(50), citation_summary:z.string().min(50), outreach_summary:z.string().min(50), press_summary:z.string().min(50),
  approved_external_links:z.array(z.string().url()).default([]), source_of_truth_notes:z.string().min(30)
}).strict();

export const projectManifestSchema = z.object({
  schema_version: z.literal(1), status: z.enum(['draft','ready_for_preview','approved']),
  project: z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1), developer: z.string().min(1), path: z.string().startsWith('/') }).strict(),
  seo: z.object({
    indexable:z.boolean(), title:z.string().min(10).max(70), description:z.string().min(50).max(170),
    primary_intent:z.string().min(3).optional(), secondary_intents:z.array(z.string().min(3)).max(12).optional(),
    location:z.string().min(2).optional(), unit_types:z.array(z.string().min(2)).max(12).optional(),
    launch_status:z.string().min(2).optional(), hero_image:z.string().startsWith('/').optional(), hero_alt:z.string().min(8).optional(),
    faq:z.array(z.object({ question:z.string().min(10), answer:z.string().min(20) }).strict()).max(10).optional(),
    organic_search:organicSearch.optional()
  }).strict().optional(),
  distribution:distribution.optional(),
  facts: z.record(z.string(), fact), assets: z.array(asset), rejected_assets: z.array(z.object({ path:z.string(), observed_content:z.string(), reason:z.string() }).strict()).default([]),
  lead: z.object({ endpoint:z.literal('/api/leads'), campaign_id:z.string().min(1), project_id:z.string().min(1), whatsapp_number:z.string().regex(/^\d{8,15}$/).optional() }).strict()
}).strict();
