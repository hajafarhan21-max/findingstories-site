import {z} from 'zod';

export const dldTransactionSchema=z.object({
  transactionId:z.string().min(1),transactionDate:z.string().date(),transactionType:z.enum(['sale','mortgage','gift','other']),
  amountAed:z.number().nonnegative().nullable(),area:z.string().min(1).nullable(),propertyType:z.string().nullable(),
  marketSegment:z.enum(['ready','off-plan','unknown']).default('unknown')
});
export const dldPayloadSchema=z.object({sourceUpdatedAt:z.string().datetime().nullable(),records:z.array(dldTransactionSchema)});
