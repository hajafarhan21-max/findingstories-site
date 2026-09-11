import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const MATERIALIZED_ASSETS=Object.freeze([
  {
    source:'assets-source/azizi-florence/amenities-background.webp.base64',
    output:'public/assets/azizi-florence/amenities-background.webp'
  },
  {
    source:'assets-source/azizi-florence/location-map.webp.base64',
    output:'public/assets/azizi-florence/location-map.webp'
  }
]);

export function decodeWebpBase64(text,source='base64 source'){
  const compact=String(text).replace(/\s/g,'');
  if(!compact||compact.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(compact))throw new Error(`${source} is not valid base64.`);
  const image=Buffer.from(compact,'base64');
  if(image.length<30||image.subarray(0,4).toString('ascii')!=='RIFF'||image.subarray(8,12).toString('ascii')!=='WEBP')throw new Error(`${source} is not a WebP image.`);
  return image;
}

export async function materializeFlorenceAssets(root=process.cwd()){
  for(const asset of MATERIALIZED_ASSETS){
    const source=new URL(asset.source,`file://${root.replace(/\/$/,'')}/`);
    const output=new URL(asset.output,`file://${root.replace(/\/$/,'')}/`);
    const image=decodeWebpBase64(await readFile(source,'utf8'),asset.source);
    await mkdir(dirname(output.pathname),{recursive:true});
    await writeFile(output,image);
  }
}

if(process.argv[1]&&import.meta.url===new URL(process.argv[1],`file://${process.cwd()}/`).href){
  await materializeFlorenceAssets();
  console.log(`Materialized ${MATERIALIZED_ASSETS.length} Florence WebP assets.`);
}
