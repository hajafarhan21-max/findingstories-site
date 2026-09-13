import {z} from 'zod';

const nullableText=z.string().trim().min(1).nullable();
const nullableNumber=z.number().finite().nonnegative().nullable();

export const dldTransactionSchema=z.object({
  sourceId:z.string().min(1),
  transactionDate:z.string().date(),
  transactionType:nullableText,
  transactionSubtype:nullableText,
  registrationType:nullableText,
  freehold:nullableText,
  usage:nullableText,
  area:nullableText,
  propertyType:nullableText,
  propertySubtype:nullableText,
  amountAed:nullableNumber,
  transactionSizeSqm:nullableNumber,
  propertySizeSqm:nullableNumber,
  rooms:nullableText,
  parking:nullableText,
  masterProject:nullableText,
  project:nullableText,
  buyerCount:z.number().int().nonnegative().nullable(),
  sellerCount:z.number().int().nonnegative().nullable()
  ,nearestMetro:nullableText,nearestMall:nullableText,nearestLandmark:nullableText
  ,transactionSizeSqft:nullableNumber,propertySizeSqft:nullableNumber,aedPerSqft:nullableNumber
  ,sourceAreaName:nullableText,canonicalAreaName:nullableText,canonicalAreaSlug:nullableText
  ,areaMappingStatus:z.enum(['EXACT','ALIAS_VERIFIED','UNMAPPED']),areaMappingMethod:nullableText
  ,projectMappingStatus:z.enum(['EXACT','ALIAS_VERIFIED','UNMAPPED']),canonicalProject:nullableText,canonicalProjectSlug:nullableText,developer:nullableText
}).strict();

export const dldPageSchema=z.object({
  records:z.array(z.record(z.string(),z.unknown())),
  nextPage:z.union([z.string().min(1),z.number().int().positive()]).nullable().optional(),
  totalPages:z.number().int().positive().nullable().optional(),
  sourceUpdatedAt:z.string().datetime().nullable().optional()
}).strict();

export const oauthTokenSchema=z.object({
  access_token:z.string().min(1),token_type:z.string().default('Bearer'),expires_in:z.coerce.number().positive().default(300)
}).passthrough();
