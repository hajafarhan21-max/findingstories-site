import {acquireDldToken} from './auth.js';
import {dldPageSchema} from './schema.js';
import {normalizeDldRecords} from './normalize.js';
import {withDldProvenance} from './provenance.js';
import {readLastKnownGood,writeLastKnownGood} from './cache.js';
import {mapDldArea,mapDldProject} from './mapping.js';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const safeReason=error=>error?.name==='AbortError'?'request_timeout':error?.message?.replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').slice(0,200)||'request_failed';
export function dldConfiguration(env=process.env){
  const endpoint=env.DUBAI_PULSE_DLD_API_URL||env.DLD_OPEN_DATA_URL||null,tokenUrl=env.DUBAI_PULSE_TOKEN_URL||null,apiKey=env.DUBAI_PULSE_API_KEY||null,apiSecret=env.DUBAI_PULSE_API_SECRET||null;
  return {endpoint,tokenUrl,apiKey,apiSecret,scope:env.DUBAI_PULSE_SCOPE||null,configured:Boolean(endpoint&&tokenUrl&&apiKey&&apiSecret)};
}
function parsePage(payload){
  const records=Array.isArray(payload)?payload:payload.records??payload.data??payload.result?.records??payload.result?.data;
  const nextPage=payload.nextPage??payload.next_page??payload.meta?.next_page??null,totalPages=payload.totalPages??payload.total_pages??payload.meta?.total_pages??null;
  return dldPageSchema.parse({records,nextPage,totalPages,sourceUpdatedAt:payload.sourceUpdatedAt??payload.source_updated_at??null});
}
async function requestPage(url,{authorization,fetchImpl,timeoutMs,retries,page}){
  for(let attempt=0;;attempt++){
    const controller=new globalThis.AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const target=new URL(url);if(!target.searchParams.has('page'))target.searchParams.set('page',String(page));
      const response=await fetchImpl(target,{signal:controller.signal,headers:{accept:'application/json',authorization}});
      if(response.status===429||response.status>=500){if(attempt<retries){const seconds=Math.min(Number(response.headers?.get?.('retry-after'))||2**attempt,5);await sleep(seconds*1000);continue}}
      if(!response.ok)throw new Error(`DLD API failed (HTTP ${response.status})`);
      return parsePage(await response.json());
    }finally{clearTimeout(timer)}
  }
}
export async function fetchDldSnapshot({env=process.env,endpoint,fetchImpl=fetch,cachePath='generated/intelligence/latest-market-snapshot.json',timeoutMs=8000,retries=2,maxPages=100,now=()=>new Date()}={}){
  const attemptedAt=now().toISOString(),config=dldConfiguration(env);if(endpoint)config.endpoint=endpoint;
  const health={configured:config.configured||Boolean(endpoint),source_available:false,retrieval_status:'NOT_ATTEMPTED',authenticated:false,reachable:false,last_attempt:attemptedAt,last_success:null,source_freshness:null,generation_timestamp:attemptedAt,records_retrieved:0,valid_records:0,rejected_records:0,duplicate_records:0,mapped_area_records:0,unmapped_area_records:0,confidently_mapped_project_records:0,unresolved_project_records:0,last_known_good_status:'UNAVAILABLE',last_known_good_available:false,status:'READY_FOR_CREDENTIALS',failure_reason:null};
  if(!config.endpoint||!config.tokenUrl||!config.apiKey||!config.apiSecret)return fallback(cachePath,health,'credentials_not_configured');
  try{
    const authorization=await acquireDldToken({...config,fetchImpl,timeoutMs,now:()=>now().getTime()});health.authenticated=true;
    let page=1,raw=[],sourceUpdatedAt=null;
    while(page<=maxPages){const result=await requestPage(config.endpoint,{authorization,fetchImpl,timeoutMs,retries,page});health.reachable=true;raw.push(...result.records);sourceUpdatedAt=result.sourceUpdatedAt??sourceUpdatedAt;if(result.nextPage)page=Number(result.nextPage);else if(result.totalPages&&page<result.totalPages)page++;else break}
    if(page>maxPages)throw new Error('DLD pagination exceeded safety limit');
    health.records_retrieved=raw.length;const normalized=normalizeDldRecords(raw,{mapArea:mapDldArea,mapProject:mapDldProject});health.valid_records=normalized.accepted;health.rejected_records=normalized.rejected;health.source_available=true;health.retrieval_status='SUCCESS';
    const records=normalized.records.map(record=>withDldProvenance(record,{retrievedAt:attemptedAt,sourceUpdatedAt}));
    health.mapped_area_records=records.filter(record=>record.areaMappingStatus!=='UNMAPPED').length;health.unmapped_area_records=records.length-health.mapped_area_records;health.confidently_mapped_project_records=records.filter(record=>record.projectMappingStatus!=='UNMAPPED').length;health.unresolved_project_records=records.length-health.confidently_mapped_project_records;
    const snapshot={status:'verified',stale:false,preliminary:true,records,retrievedAt:attemptedAt,sourceUpdatedAt:sourceUpdatedAt??null};
    await writeLastKnownGood(cachePath,snapshot);Object.assign(health,{last_success:attemptedAt,source_freshness:sourceUpdatedAt??attemptedAt,last_known_good_available:true,last_known_good_status:'WRITTEN',status:'HEALTHY'});return {...snapshot,health};
  }catch(error){return fallback(cachePath,health,safeReason(error))}
}
async function fallback(cachePath,health,reason){
  const cached=await readLastKnownGood(cachePath);health.failure_reason=reason;health.last_known_good_available=cached?.status==='verified';
  if(health.last_known_good_available){Object.assign(health,{status:'DEGRADED',retrieval_status:'FAILED_USING_LAST_KNOWN_GOOD',last_success:cached.retrievedAt??null,source_freshness:cached.sourceUpdatedAt??cached.retrievedAt??null,last_known_good_status:'PRESERVED'});return {...cached,status:'stale',stale:true,error:'Source refresh unavailable',health}}
  health.status=reason==='credentials_not_configured'?'READY_FOR_CREDENTIALS':'UNAVAILABLE';
  health.retrieval_status=reason==='credentials_not_configured'?'BLOCKED_CREDENTIALS':'FAILED';
  return {status:'unavailable',stale:false,records:[],retrievedAt:health.last_attempt,error:reason==='credentials_not_configured'?'Official data connection is ready for credentials; no metrics are displayed.':'Official data is currently unavailable; no metrics are displayed.',health};
}
