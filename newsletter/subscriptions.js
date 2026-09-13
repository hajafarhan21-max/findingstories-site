import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
export const subscriptionSchema=z.object({email:z.preprocess(value=>typeof value==='string'?value.trim().toLowerCase():value,z.email()),name:z.string().trim().max(120).optional().default(''),interest:z.string().trim().max(100).optional().default(''),preferredArea:z.string().trim().max(100).optional().default(''),audience:z.enum(['buyer','investor','end-user','']).optional().default(''),consent:z.literal(true),source:z.string().trim().max(100).default('website'),landingPage:z.string().trim().max(500).default('/'),utm:z.record(z.string(),z.string().max(300)).default({})});
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
export const newToken=()=>randomBytes(32).toString('base64url');
export async function subscribe(store,input,now=new Date()){
  const data=subscriptionSchema.parse(input),token=newToken(),tokenHash=hashToken(token);
  const result=await store.upsert({...data,subscribedAt:now.toISOString(),status:'CONFIRMED',tokenHash});
  return {...result,token,duplicate:Boolean(result.duplicate)};
}
export async function unsubscribe(store,token,now=new Date()){
  if(typeof token!=='string'||token.length<20)return {ok:false};
  return {ok:await store.suppress(hashToken(token),now.toISOString())};
}
