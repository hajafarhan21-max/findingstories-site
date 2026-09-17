import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';
import {PROJECT_MEDIA} from '../platform/project-media.js';

export const RESPONSIVE_WIDTHS=Object.freeze([480,960,1280,1600]);

const execFileAsync=promisify(execFile);
async function download(url){
  const {stdout}=await execFileAsync('curl',['--fail','--silent','--show-error','--location','--max-time','45','--user-agent','Mozilla/5.0',url],{encoding:'buffer',maxBuffer:12*1024*1024});
  return stdout;
}

export async function materializeProjectMedia(root=process.cwd(),fetcher=download){
  for(const assets of Object.values(PROJECT_MEDIA))for(const asset of assets){
    const source=asset.localSource
      ? Buffer.from((await readFile(`${root}/${asset.localSource}`,'utf8')).replace(/\s/g,''),'base64')
      : Buffer.from(await fetcher(asset.sourceUrl));
    const digest=createHash('sha256').update(source).digest('hex');
    if(digest!==asset.sha256)throw new Error(`Integrity mismatch for ${asset.id}; refusing changed upstream media.`);
    const widths=[...new Set([...RESPONSIVE_WIDTHS.filter(width=>width<=asset.width),asset.width])].sort((a,b)=>a-b);
    for(const width of widths){
      const output=`${root}/public${asset.path}-${width}.webp`;
      await mkdir(dirname(output),{recursive:true});
      await writeFile(output,await sharp(source).rotate().resize({width,withoutEnlargement:true}).webp({quality:82,effort:5}).toBuffer());
    }
  }
}

if(process.argv[1]&&import.meta.url===new URL(process.argv[1],`file://${process.cwd()}/`).href){
  await materializeProjectMedia();
  console.log(`Materialized governed media for ${Object.keys(PROJECT_MEDIA).length} projects.`);
}
