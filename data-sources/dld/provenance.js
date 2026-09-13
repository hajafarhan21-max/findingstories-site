import {validateProvenance} from '../../intelligence/governance.js';
export const DLD_SOURCE=Object.freeze({name:'Dubai Land Department / Dubai Pulse open data',url:'https://www.dubaipulse.gov.ae/',type:'official_open_data',tier:1,official:true});
export function withDldProvenance(record,{retrievedAt,sourceUpdatedAt=null,transformedAt=new Date().toISOString()}={}){
  return validateProvenance({...record,source:DLD_SOURCE.name,sourceUrl:DLD_SOURCE.url,sourceType:DLD_SOURCE.type,retrievedAt,sourceUpdatedAt,transformedAt,confidence:'official-source-unverified-transform',official:true});
}
