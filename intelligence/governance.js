export const SOURCE_TIERS=Object.freeze({OFFICIAL:1,COMPANY:2,MEDIA:3,THIRD_PARTY:4});
export const PUBLICATION_STATES=Object.freeze(['DISCOVERED','REVIEW_REQUIRED','APPROVED','PUBLISHED','REJECTED','STALE']);
export const EDITORIAL_MODE='CONSTRUCTIVE_INVESTMENT_INTELLIGENCE';

export function mayAutomate(source){return source.tier===SOURCE_TIERS.OFFICIAL&&source.automationApproved===true}
export function mayPublish(item){return item.verificationState==='APPROVED'&&item.publicationState==='PUBLISHED'}
export function validateProvenance(record){
  const required=['source','sourceUrl','sourceType','retrievedAt','transformedAt','confidence','official'];
  const missing=required.filter(key=>record[key]===undefined||record[key]===null||record[key]==='');
  if(missing.length)throw new Error(`Missing provenance: ${missing.join(', ')}`);
  if(!/^https:\/\//.test(record.sourceUrl))throw new Error('Source URL must use HTTPS');
  return record;
}
