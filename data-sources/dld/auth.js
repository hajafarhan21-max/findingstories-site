import {oauthTokenSchema} from './schema.js';

let cachedToken=null;
export function clearDldTokenCache(){cachedToken=null}

export async function acquireDldToken({tokenUrl,apiKey,apiSecret,scope,fetchImpl=fetch,timeoutMs=8000,now=Date.now}={}){
  if(!tokenUrl||!apiKey||!apiSecret)throw new Error('DLD credentials or token URL are not configured');
  if(cachedToken&&cachedToken.expiresAt-now()>30_000)return cachedToken.value;
  const controller=new globalThis.AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const body=new URLSearchParams({grant_type:'client_credentials'});if(scope)body.set('scope',scope);
    const response=await fetchImpl(tokenUrl,{method:'POST',signal:controller.signal,headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded',authorization:`Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`},body});
    if(!response.ok)throw new Error(`DLD authentication failed (HTTP ${response.status})`);
    const token=oauthTokenSchema.parse(await response.json());
    cachedToken={value:`${token.token_type} ${token.access_token}`,expiresAt:now()+token.expires_in*1000};
    return cachedToken.value;
  }finally{clearTimeout(timer)}
}
