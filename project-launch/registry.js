import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectManifestSchema } from './schema.js';

export async function loadPublicProjects(root='projects'){
  const entries=await readdir(root,{withFileTypes:true});
  const projects=[];
  for(const entry of entries.filter(item=>item.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
    const manifest=projectManifestSchema.parse(JSON.parse(await readFile(join(root,entry.name,'manifest.json'),'utf8')));
    if(manifest.status==='approved'&&!manifest.seo)throw new Error(`Approved project ${manifest.project.slug} is missing SEO metadata`);
    if(manifest.status==='approved'&&manifest.seo.indexable&&!manifest.seo.organic_search)throw new Error(`Approved project ${manifest.project.slug} is missing quality-gated organic search inputs`);
    if(manifest.seo?.organic_search?.supporting_pages?.length)throw new Error(`Supporting pages for ${manifest.project.slug} require a separate reviewed publishing implementation`);
    if(manifest.status==='approved'&&manifest.seo.indexable)projects.push(Object.freeze({...manifest.project,...manifest.seo}));
  }
  return projects;
}
