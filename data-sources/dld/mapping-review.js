import {mkdir,writeFile} from 'node:fs/promises';
import {AREAS,PUBLISHED_PROJECTS} from '../../platform/catalog.js';
import {deterministicMappingKey,mapDldArea,mapDldProject,PUBLISHABLE_MAPPING_STATUSES} from './mapping.js';

const countBy=(records,field)=>Map.groupBy(records.filter(record=>record[field]),record=>record[field]);
const rank=(groups,limit)=>[...groups].map(([source,items])=>({source,transaction_count:items.length,total_transaction_value_aed:items.reduce((sum,item)=>sum+(item.amountAed??0),0)})).sort((a,b)=>b.transaction_count-a.transaction_count||b.total_transaction_value_aed-a.total_transaction_value_aed).slice(0,limit);
const tokens=value=>new Set((deterministicMappingKey(value)??'').split(' ').filter(Boolean));
const reviewSuggestions=(sources,targets)=>sources.flatMap(source=>{const left=tokens(source);if(!left.size)return[];return targets.map(target=>{const right=tokens(target.name),shared=[...left].filter(token=>right.has(token)).length,score=shared/Math.max(left.size,right.size);return {source,candidate:target.name,candidate_slug:target.slug,review_score:Number(score.toFixed(3)),status:'REVIEW_ONLY',publishable:false}}).filter(item=>item.review_score>0).sort((a,b)=>b.review_score-a.review_score).slice(0,3)});
const areaRecord=source=>{const mapped=mapDldArea(source);return {source_area:source,canonical_area:mapped.canonicalName,canonical_slug:mapped.canonicalSlug,status:mapped.status,mapping_method:mapped.method,verification_source:mapped.verificationSource}};
const projectRecord=source=>{const mapped=mapDldProject(source);return {source_project:source,canonical_project:mapped.canonicalProject,canonical_slug:mapped.canonicalSlug,developer:mapped.developer,status:mapped.status,mapping_method:mapped.method,verification_source:mapped.verificationSource}};
const conflicts=records=>[...Map.groupBy(records.filter(item=>item.canonical_slug),item=>item.canonical_slug)].filter(([,items])=>new Set(items.map(item=>item.status)).size>1).map(([canonical_slug,items])=>({canonical_slug,sources:items.map(item=>item.source_area??item.source_project),statuses:[...new Set(items.map(item=>item.status))]}));

export function mappingEligibility(record){
  return {area:PUBLISHABLE_MAPPING_STATUSES.includes(record.areaMappingStatus),project:PUBLISHABLE_MAPPING_STATUSES.includes(record.projectMappingStatus),developer:PUBLISHABLE_MAPPING_STATUSES.includes(record.projectMappingStatus)&&Boolean(record.developer)};
}
export function recordsForPage(records,{areaSlug,projectSlug,developer}={}){return records.filter(record=>{const eligible=mappingEligibility(record);if(areaSlug)return eligible.area&&record.canonicalAreaSlug===areaSlug;if(projectSlug)return eligible.project&&record.canonicalProjectSlug===projectSlug;if(developer)return eligible.developer&&record.developer===developer;return true})}

export async function generateDldMappingReview(records,{outputDirectory='generated/mappings'}={}){
  const areaGroups=countBy(records,'sourceAreaName'),projectGroups=countBy(records,'project');
  const areas=[...areaGroups.keys()].sort().map(areaRecord),projects=[...projectGroups.keys()].sort().map(projectRecord);
  const unmappedAreas=areas.filter(item=>item.status==='UNMAPPED'),unmappedProjects=projects.filter(item=>item.status==='UNMAPPED');
  const report={generated_at:new Date().toISOString(),areas_total:areas.length,areas_exact:areas.filter(x=>x.status==='EXACT').length,areas_verified_alias:areas.filter(x=>x.status==='VERIFIED_ALIAS').length,areas_unmapped:unmappedAreas.length,projects_total:projects.length,projects_exact:projects.filter(x=>x.status==='EXACT').length,projects_verified_alias:projects.filter(x=>x.status==='VERIFIED_ALIAS').length,projects_unmapped:unmappedProjects.length,top_unmapped_areas:rank(new Map([...areaGroups].filter(([source])=>mapDldArea(source).status==='UNMAPPED')),50).map(x=>({source_area:x.source,...x})),top_unmapped_projects:rank(new Map([...projectGroups].filter(([source])=>mapDldProject(source).status==='UNMAPPED')),100).map(x=>({source_project:x.source,...x})),area_conflicts:conflicts(areas),project_conflicts:conflicts(projects)};
  await mkdir(outputDirectory,{recursive:true});const write=(name,value)=>writeFile(`${outputDirectory}/${name}`,`${JSON.stringify(value,null,2)}\n`);
  await Promise.all([write('dld-areas.json',areas),write('dld-areas-unmapped.json',unmappedAreas),write('dld-projects.json',projects),write('dld-projects-unmapped.json',unmappedProjects),write('dld-area-suggestions.json',reviewSuggestions(unmappedAreas.map(x=>x.source_area),AREAS)),write('dld-project-suggestions.json',reviewSuggestions(unmappedProjects.map(x=>x.source_project),PUBLISHED_PROJECTS)),write('dld-mapping-report.json',report)]);return report;
}
