import {dldPayloadSchema} from './schema.js';
import {withDldProvenance} from './provenance.js';
import {readLastKnownGood,writeLastKnownGood} from './cache.js';

export async function fetchDldSnapshot({endpoint=process.env.DLD_OPEN_DATA_URL,fetchImpl=fetch,cachePath='generated/intelligence/latest-market-snapshot.json',timeoutMs=8000,now=()=>new Date()}={}){
  const retrievedAt=now().toISOString();
  if(endpoint){
    const controller=new globalThis.AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{const response=await fetchImpl(endpoint,{signal:controller.signal,headers:{accept:'application/json'}});if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=dldPayloadSchema.parse(await response.json());
      const snapshot={status:'verified',stale:false,preliminary:true,records:payload.records.map(record=>withDldProvenance(record,{retrievedAt,sourceUpdatedAt:payload.sourceUpdatedAt})),retrievedAt,sourceUpdatedAt:payload.sourceUpdatedAt};
      await writeLastKnownGood(cachePath,snapshot);return snapshot;
    }catch{const cached=await readLastKnownGood(cachePath);if(cached?.status==='verified')return {...cached,status:'stale',stale:true,error:'Source refresh unavailable'};return {status:'unavailable',stale:false,records:[],retrievedAt,error:'Official data is currently unavailable; no metrics are displayed.'}}
    finally{clearTimeout(timer)}
  }
  const cached=await readLastKnownGood(cachePath);if(cached?.status==='verified')return {...cached,status:'stale',stale:true};
  return {status:'unavailable',stale:false,records:[],retrievedAt,error:'Official data connection is not configured; no metrics are displayed.'};
}
