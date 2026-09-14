import {readFileSync} from 'node:fs';
import {AREAS,PUBLISHED_PROJECTS} from '../../platform/catalog.js';

const areaAliases=JSON.parse(readFileSync(new URL('./area-aliases.json',import.meta.url),'utf8'));
const projectAliases=JSON.parse(readFileSync(new URL('./project-aliases.json',import.meta.url),'utf8'));
export const PUBLISHABLE_MAPPING_STATUSES=Object.freeze(['EXACT','VERIFIED_ALIAS']);

/** Conservative comparison key: case, whitespace, punctuation and hyphens only. */
export function deterministicMappingKey(value){
  return value==null?null:String(value).normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/[‐‑‒–—-]+/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ')||null;
}
const index=(records,field)=>new Map(records.map(record=>[deterministicMappingKey(record[field]),record]));
const exactAreas=index(AREAS,'name'),exactProjects=index(PUBLISHED_PROJECTS,'name');
const governedAreas=index(areaAliases,'source_area'),governedProjects=index(projectAliases,'source_project');
const publishable=status=>PUBLISHABLE_MAPPING_STATUSES.includes(status);

for(const alias of areaAliases){if(publishable(alias.status)&&!AREAS.some(area=>area.slug===alias.canonical_slug))throw new Error(`DLD area alias targets an unknown canonical area: ${alias.source_area}`)}
for(const alias of projectAliases){const project=PUBLISHED_PROJECTS.find(item=>item.slug===alias.canonical_slug);if(publishable(alias.status)&&(!project||project.name!==alias.canonical_project||project.developer!==alias.developer))throw new Error(`DLD project alias is not verified by the published project registry: ${alias.source_project}`)}

function unmappedArea(){return {status:'UNMAPPED',canonicalName:null,canonicalSlug:null,method:null,verificationSource:null}}
function unmappedProject(){return {status:'UNMAPPED',canonicalProject:null,canonicalSlug:null,developer:null,method:null,verificationSource:null}}

export function mapDldArea(sourceAreaName){
  const key=deterministicMappingKey(sourceAreaName);if(!key)return unmappedArea();
  const governed=governedAreas.get(key);
  if(governed&&publishable(governed.status))return {status:governed.status,canonicalName:governed.canonical_area,canonicalSlug:governed.canonical_slug,method:governed.mapping_method,verificationSource:governed.verification_source};
  const exact=exactAreas.get(key);return exact?{status:'EXACT',canonicalName:exact.name,canonicalSlug:exact.slug,method:'DETERMINISTIC_EXACT',verificationSource:'platform/catalog.js#AREAS'}:unmappedArea();
}

export function mapDldProject(sourceProject){
  const key=deterministicMappingKey(sourceProject);if(!key)return unmappedProject();
  const governed=governedProjects.get(key);
  if(governed&&publishable(governed.status))return {status:governed.status,canonicalProject:governed.canonical_project,canonicalSlug:governed.canonical_slug,developer:governed.developer,method:governed.mapping_method,verificationSource:governed.verification_source};
  const exact=exactProjects.get(key);return exact?{status:'EXACT',canonicalProject:exact.name,canonicalSlug:exact.slug,developer:exact.developer,method:'DETERMINISTIC_EXACT',verificationSource:'platform/catalog.js#PUBLISHED_PROJECTS'}:unmappedProject();
}

export function assertNoAliasConflicts(aliases,{sourceField,canonicalField}){
  const sources=new Map();for(const item of aliases){const key=deterministicMappingKey(item[sourceField]);const prior=sources.get(key);if(prior&&prior!==item[canonicalField])throw new Error(`Conflicting DLD alias: ${item[sourceField]}`);sources.set(key,item[canonicalField])}return true;
}
assertNoAliasConflicts(areaAliases,{sourceField:'source_area',canonicalField:'canonical_slug'});
assertNoAliasConflicts(projectAliases,{sourceField:'source_project',canonicalField:'canonical_slug'});
