import {validateProvenance} from '../../intelligence/governance.js';
export const DLD_SOURCE=Object.freeze({name:'Dubai Land Department / Dubai Pulse open data',url:'https://www.dubaipulse.gov.ae/data/dld-transactions/dld_transactions-open-api',publisherUrl:'https://dubailand.gov.ae/en/open-data/real-estate-data/',type:'official_open_data',tier:1,official:true});
export function withDldProvenance(record,{retrievedAt,sourceUpdatedAt=null,transformedAt=new Date().toISOString()}={}){
  return validateProvenance({...record,source:DLD_SOURCE.name,sourceUrl:DLD_SOURCE.url,sourceType:DLD_SOURCE.type,retrievedAt,sourceUpdatedAt,transformedAt,confidence:'official-source-validated',official:true,provenance:{sourceId:record.sourceId,datasetUrl:DLD_SOURCE.url,publisherUrl:DLD_SOURCE.publisherUrl}});
}
