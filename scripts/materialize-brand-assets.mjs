import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {decodeImageBase64} from './materialize-florence-assets.mjs';

export const MATERIALIZED_BRAND_ASSETS=Object.freeze([
  {source:'assets-source/brand/finding-stories-master-logo.png.base64',output:'public/assets/brand/finding-stories-master-logo.png',format:'png'},
  {source:'assets-source/brand/finding-stories-monogram.png.base64',output:'public/assets/brand/finding-stories-monogram.png',format:'png'},
  {source:'assets-source/brand/finding-stories-approved-monogram.webp.base64',output:'public/assets/brand/finding-stories-approved-monogram.webp',format:'webp'},
  {source:'assets-source/brand/premium-finding-stories-banner.png.base64',output:'public/assets/brand/premium-finding-stories-banner.png',format:'png'}
]);

export async function materializeBrandAssets(root=process.cwd()){
  for(const asset of MATERIALIZED_BRAND_ASSETS){
    const source=new URL(asset.source,`file://${root.replace(/\/$/,'')}/`);
    const output=new URL(asset.output,`file://${root.replace(/\/$/,'')}/`);
    const image=decodeImageBase64(await readFile(source,'utf8'),asset.source,asset.format);
    await mkdir(dirname(output.pathname),{recursive:true});
    await writeFile(output,image);
  }
}

if(process.argv[1]&&import.meta.url===new URL(process.argv[1],`file://${process.cwd()}/`).href){
  await materializeBrandAssets();
  console.log(`Materialized ${MATERIALIZED_BRAND_ASSETS.length} Finding Stories brand assets.`);
}
