import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const MATERIALIZED_ASSETS=Object.freeze([
  {
    source:'assets-source/azizi-florence/amenities-background.webp.base64',
    output:'public/assets/azizi-florence/amenities-background.webp'
  },
  {
    source:'assets-source/azizi-florence/location-map.png.base64',
    output:'public/assets/azizi-florence/location-map.png',
    format:'png'
  }
]);

export function decodeImageBase64(text,source='base64 source',format='webp'){
  const compact=String(text).replace(/\s/g,'');
  if(!compact||compact.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(compact))throw new Error(`${source} is not valid base64.`);
  const image=Buffer.from(compact,'base64');
  const valid=format==='png'
    ? image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : image.subarray(0,4).toString('ascii')==='RIFF'&&image.subarray(8,12).toString('ascii')==='WEBP';
  if(image.length<30||!valid)throw new Error(`${source} is not a ${format.toUpperCase()} image.`);
  return image;
}

export async function materializeFlorenceAssets(root=process.cwd()){
  for(const asset of MATERIALIZED_ASSETS){
    const source=new URL(asset.source,`file://${root.replace(/\/$/,'')}/`);
    const output=new URL(asset.output,`file://${root.replace(/\/$/,'')}/`);
    const image=decodeImageBase64(await readFile(source,'utf8'),asset.source,asset.format);
    await mkdir(dirname(output.pathname),{recursive:true});
    await writeFile(output,image);
  }
}

if(process.argv[1]&&import.meta.url===new URL(process.argv[1],`file://${process.cwd()}/`).href){
  await materializeFlorenceAssets();
  console.log(`Materialized ${MATERIALIZED_ASSETS.length} Florence image assets.`);
}
