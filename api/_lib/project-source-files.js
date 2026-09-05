import { createHash } from 'node:crypto';
import { get, head } from '@vercel/blob';

const MB=1024*1024;
const envLimit=(name,fallback)=>{const value=Number(process.env[name]);return Number.isFinite(value)&&value>0?Math.floor(value*MB):fallback*MB;};

export const PROJECT_SOURCE_LIMITS=Object.freeze({
  'application/pdf':envLimit('PROJECT_SOURCE_DOCUMENT_MAX_MB',100),
  'text/csv':envLimit('PROJECT_SOURCE_SPREADSHEET_MAX_MB',100),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':envLimit('PROJECT_SOURCE_SPREADSHEET_MAX_MB',100),
  'application/vnd.ms-excel':envLimit('PROJECT_SOURCE_SPREADSHEET_MAX_MB',100),
  'image/jpeg':envLimit('PROJECT_SOURCE_IMAGE_MAX_MB',50),
  'image/png':envLimit('PROJECT_SOURCE_IMAGE_MAX_MB',50)
});
export const PROJECT_SOURCE_MAX_FILES=Number(process.env.PROJECT_SOURCE_MAX_FILES)||20;
export const PROJECT_SOURCE_PREFIX='project-sources/';

export function sourceUploadConfig(){return {limits:Object.fromEntries(Object.entries(PROJECT_SOURCE_LIMITS).map(([type,bytes])=>[type,{bytes,mb:bytes/MB}])),max_files:PROJECT_SOURCE_MAX_FILES};}
export function validateSourceMetadata(source){
  const limit=PROJECT_SOURCE_LIMITS[source?.media_type];
  if(!limit)return `Unsupported file type: ${source?.filename||'unnamed file'}`;
  if(!Number.isSafeInteger(source.byte_size)||source.byte_size<1)return `Invalid source size: ${source.filename}`;
  if(source.byte_size>limit)return `${source.filename} exceeds the ${limit/MB} MB limit.`;
  return null;
}

export function detectedMediaType(prefix){
  if(prefix.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
  if(prefix[0]===0x89&&prefix.subarray(1,4).toString()==='PNG')return 'image/png';
  if(prefix[0]===0xff&&prefix[1]===0xd8&&prefix[2]===0xff)return 'image/jpeg';
  if(prefix[0]===0x50&&prefix[1]===0x4b)return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if(prefix.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])))return 'application/vnd.ms-excel';
  const sample=prefix.toString('utf8');
  if(!prefix.includes(0)&&/[,;\t]/.test(sample)&&/[\r\n]/.test(sample))return 'text/csv';
  return null;
}

export function validateSourceContent(source,content){
  const metadataError=validateSourceMetadata({...source,byte_size:content.length});
  if(metadataError)throw new Error(metadataError);
  const detected=detectedMediaType(content.subarray(0,8192));
  if(detected!==source.media_type)throw new Error(`File content does not match the declared type: ${source.filename}`);
}

const streamToBuffer=async(stream,limit)=>{const chunks=[];let size=0;for await(const chunk of stream){size+=chunk.length;if(size>limit)throw new Error('Stored source exceeds its configured limit.');chunks.push(chunk);}return Buffer.concat(chunks);};

export async function resolveStoredSource(source){
  if(!source.storage_path?.startsWith(PROJECT_SOURCE_PREFIX)||!/^project-sources\/[0-9a-f-]{36}(?:-[0-9A-Za-z]+)?$/.test(source.storage_path))throw new Error(`Invalid storage reference: ${source.filename}`);
  const metadata=await head(source.storage_path);
  if(metadata.pathname!==source.storage_path||metadata.size!==source.byte_size)throw new Error(`Stored file metadata changed: ${source.filename}`);
  const metadataError=validateSourceMetadata(source);if(metadataError)throw new Error(metadataError);
  const result=await get(source.storage_path,{access:'private',useCache:false});
  if(!result||result.statusCode!==200)throw new Error(`Stored source is unavailable: ${source.filename}`);
  const content=await streamToBuffer(result.stream,PROJECT_SOURCE_LIMITS[source.media_type]);
  validateSourceContent(source,content);
  return {...source,content,storage_url:metadata.url,storage_etag:metadata.etag,sha256:createHash('sha256').update(content).digest('hex')};
}
