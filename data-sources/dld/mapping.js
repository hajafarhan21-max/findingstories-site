import {readFileSync} from 'node:fs';
const areaAliases=JSON.parse(readFileSync(new URL('./area-aliases.json',import.meta.url),'utf8'));
const projectAliases=JSON.parse(readFileSync(new URL('./project-aliases.json',import.meta.url),'utf8'));

const key=value=>value?.trim().replace(/\s+/g,' ').toLocaleUpperCase('en-US')??null;
const areas=new Map(areaAliases.map(item=>[key(item.source_area),item]));
const projects=new Map(projectAliases.filter(item=>['EXACT','ALIAS_VERIFIED'].includes(item.status)).map(item=>[key(item.source_project),item]));

export function mapDldArea(sourceAreaName){
  const match=areas.get(key(sourceAreaName));
  return match?{status:match.status,canonicalName:match.canonical_name,canonicalSlug:match.canonical_slug,method:match.status}:{status:'UNMAPPED',canonicalName:null,canonicalSlug:null,method:null};
}
export function mapDldProject(sourceProject){
  const match=projects.get(key(sourceProject));
  return match?{status:match.status,canonicalProject:match.canonical_project,canonicalSlug:match.canonical_slug,developer:match.developer}:{status:'UNMAPPED',canonicalProject:null,canonicalSlug:null,developer:null};
}
