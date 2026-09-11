import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const signatures=[['image/png',Buffer.from('89504e470d0a1a0a','hex')],['image/jpeg',Buffer.from('ffd8ff','hex')],['image/webp',Buffer.from('52494646','hex')]];
export async function inspectImage(path){
  const bytes=await readFile(path); const mime=signatures.find(([,sig])=>bytes.subarray(0,sig.length).equals(sig))?.[0];
  if(!mime || (mime==='image/webp'&&bytes.subarray(8,12).toString()!=='WEBP'))throw new Error(`INVALID_IMAGE_MIME: ${path}`);
  const image=sharp(bytes,{failOn:'error'}); const meta=await image.metadata();
  if(!meta.width||!meta.height||!['jpeg','png','webp'].includes(meta.format))throw new Error(`CORRUPT_OR_MALFORMED_IMAGE: ${path}`);
  const pixels=await image.resize(9,8,{fit:'fill'}).greyscale().raw().toBuffer(); let bits='';
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)bits+=pixels[y*9+x]>pixels[y*9+x+1]?'1':'0';
  return {sha256:createHash('sha256').update(bytes).digest('hex'),perceptual_hash:BigInt(`0b${bits}`).toString(16).padStart(16,'0'),mime,width:meta.width,height:meta.height};
}
export const hamming=(a,b)=>{let n=BigInt(`0x${a}`)^BigInt(`0x${b}`),count=0;while(n){count++;n&=n-1n;}return count;};
