import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { sessionIdentity, isSameOrigin } from './auth.js';
import { json, method, parseJson } from './http.js';
import { PROJECT_SOURCE_LIMITS, PROJECT_SOURCE_PREFIX, sourceUploadConfig } from './project-source-files.js';

export default async function projectSourceUploadHandler(req,res){
  if(!method(req,res,['GET','POST','DELETE']))return;
  const identity=sessionIdentity(req);
  if(!identity)return json(res,401,{error:'Authentication required.'});
  if(identity.role!=='SUPER_ADMIN')return json(res,403,{error:'SUPER_ADMIN permission required.'});
  if(req.method==='GET')return json(res,200,sourceUploadConfig());
  if(req.method==='DELETE'){
    if(!isSameOrigin(req))return json(res,403,{error:'Same-origin request required.'});
    const {storage_path:pathname}=parseJson(req)||{};
    if(typeof pathname!=='string'||!new RegExp(`^${PROJECT_SOURCE_PREFIX}[0-9a-f-]{36}(?:-[0-9A-Za-z]+)?$`).test(pathname))return json(res,400,{error:'Invalid storage reference.'});
    await del(pathname);return json(res,200,{deleted:true});
  }
  const body=parseJson(req);
  if(body?.type==='blob.generate-client-token'&&!isSameOrigin(req))return json(res,403,{error:'Same-origin request required.'});
  try{
    const result=await handleUpload({request:req,body,onBeforeGenerateToken:async(pathname,clientPayload,multipart)=>{
      if(!multipart)throw new Error('Large project sources must use multipart upload.');
      if(!new RegExp(`^${PROJECT_SOURCE_PREFIX}[0-9a-f-]{36}$`).test(pathname))throw new Error('Invalid generated storage key.');
      let requested;try{requested=JSON.parse(clientPayload||'{}');}catch{throw new Error('Invalid upload metadata.');}
      const maximumSizeInBytes=PROJECT_SOURCE_LIMITS[requested.media_type];
      if(!maximumSizeInBytes)throw new Error('Unsupported project source type.');
      return {allowedContentTypes:[requested.media_type],maximumSizeInBytes,addRandomSuffix:true,allowOverwrite:false,tokenPayload:JSON.stringify({subject:identity.sub,media_type:requested.media_type})};
    }});
    return json(res,200,result);
  }catch(error){return json(res,400,{error:error instanceof Error?error.message:'Upload could not be authorized.'});}
}
