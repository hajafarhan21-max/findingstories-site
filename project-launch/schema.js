import { z } from 'zod';

export const ASSET_SLOTS = ['hero','overview','gallery','amenities','location_map','masterplan','floor_plan','unit_type','payment_plan'];
const fact = z.object({ value: z.union([z.string(),z.number(),z.boolean()]), source: z.string().min(1), verified: z.literal(true) }).strict();
const asset = z.object({
  path: z.string().min(1), slot: z.enum(ASSET_SLOTS), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  perceptual_hash: z.string().regex(/^[a-f0-9]{16}$/), mime: z.enum(['image/jpeg','image/png','image/webp']),
  width: z.number().int().positive(), height: z.number().int().positive(),
  visual_review: z.object({ classification: z.enum([...ASSET_SLOTS,'lifestyle','logo','document','unsuitable']), confidence: z.number().min(0).max(1), evidence: z.string().min(10), reviewer: z.string().min(1) }).strict()
}).strict();

export const projectManifestSchema = z.object({
  schema_version: z.literal(1), status: z.enum(['draft','ready_for_preview','approved']),
  project: z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1), developer: z.string().min(1), path: z.string().startsWith('/') }).strict(),
  facts: z.record(z.string(), fact), assets: z.array(asset), rejected_assets: z.array(z.object({ path:z.string(), observed_content:z.string(), reason:z.string() }).strict()).default([]),
  lead: z.object({ endpoint:z.literal('/api/leads'), campaign_id:z.string().min(1), project_id:z.string().min(1), whatsapp_number:z.string().regex(/^\d{8,15}$/).optional() }).strict()
}).strict();
