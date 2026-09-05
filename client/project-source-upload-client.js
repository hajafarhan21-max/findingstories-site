import { upload } from '@vercel/blob/client';

export async function uploadProjectSource(file,mediaType,onProgress){
  const storageKey=`project-sources/${crypto.randomUUID()}`;
  const blob=await upload(storageKey,file,{access:'private',contentType:mediaType,multipart:true,handleUploadUrl:'/api/admin/leads/update?view=project-source-upload',clientPayload:JSON.stringify({media_type:mediaType}),onUploadProgress:onProgress});
  return {storage_path:blob.pathname,byte_size:file.size};
}
