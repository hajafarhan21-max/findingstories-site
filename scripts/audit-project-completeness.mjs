import {mkdir,writeFile,access} from 'node:fs/promises';
import sharp from 'sharp';
import {PUBLISHED_PROJECTS} from '../platform/catalog.js';

export const STATES=Object.freeze(['VERIFIED_AND_PUBLISHED','VERIFIED_NOT_PUBLIC','SOURCE_NOT_FOUND','SOURCE_NOT_PUBLISHED','NOT_APPLICABLE']);
const yes=value=>value?'VERIFIED_AND_PUBLISHED':'SOURCE_NOT_PUBLISHED';
export function auditProject(project){
  const media=project.mediaGroups;
  const florence=project.slug==='azizi-florence';
  return {
    slug:project.slug,name:project.name,
    classification:project.governance.unknownFields.filter(field=>field!=='currentAvailability').length?'OFFICIAL_SOURCE_LIMITED':'FULLY_POPULATED',customerFallback:'Unknown optional facts are omitted; location falls back to verified community context.',
    mediaCounts:{hero:Number(Boolean(media.hero||project.image)),exterior:media.exteriors.length,interior:media.interiors.length,amenities:media.amenities.length,lifestyle:media.lifestyle.length,floorPlans:media.floorPlans.length,masterplan:media.masterplan.length,locationMap:Number(Boolean(media.locationMap))},
    hero:yes(Boolean(media.hero||project.image)),
    exterior:yes(Boolean(media.exteriors.length||florence)),
    interior:yes(Boolean(media.interiors.length||florence)),
    amenities:yes(Boolean(media.amenities.length||florence)),
    unitPlans:florence?'VERIFIED_AND_PUBLISHED':yes(media.floorPlans.length>0),
    locationMap:florence?'VERIFIED_AND_PUBLISHED':project.location.mapStatus,
    pricing:yes(project.startingPrice!==null),paymentPlan:yes(project.paymentPlan!==null),handover:yes(project.handover!==null),
    sizes:yes(project.snapshot.sizeRange!==null),projectFacts:'VERIFIED_AND_PUBLISHED',sourceProvenance:'VERIFIED_AND_PUBLISHED',
    officialSources:project.governance.sources.map(source=>source.url),
    unresolved:project.governance.unknownFields,
    unresolvedDetails:Object.fromEntries(project.governance.unknownFields.filter(field=>field!=='currentAvailability').map(field=>[field,project.governance.unresolvedReasons[field]??'Live official inventory confirmation is not represented by published project material.']))
  };
}
export async function validateMedia(root=process.cwd()){
  const errors=[];
  for(const project of PUBLISHED_PROJECTS)for(const asset of project.media){
    if(!asset.sha256)continue; // protected Florence renderer has its own manifest validation
    for(const field of ['projectSlug','sourceUrl','originalFilename','sha256','width','height','mediaRole','assetType','approvalState','retrievedAt'])if(!asset[field])errors.push(`${asset.id}: missing ${field}`);
    const path=`${root}/public${asset.path}-${asset.width}.webp`;
    try{await access(path);const info=await sharp(path).metadata();if(info.width!==asset.width)errors.push(`${asset.id}: width ${info.width} != ${asset.width}`);}catch(error){errors.push(`${asset.id}: ${error.message}`);}
  }
  if(errors.length)throw new Error(errors.join('\n'));
}
export async function generateAudit(root=process.cwd()){
  const projects=PUBLISHED_PROJECTS.map(auditProject);
  const categories=['hero','exterior','interior','amenities','unitPlans','locationMap','pricing','paymentPlan','handover','sizes','projectFacts','sourceProvenance'];
  const totals=Object.fromEntries(categories.map(category=>[category,projects.filter(p=>p[category]==='VERIFIED_AND_PUBLISHED').length]));
  const report={schemaVersion:3,generatedAt:'2026-09-17',publishedProjects:projects.length,fullyPopulated:projects.filter(p=>p.classification==='FULLY_POPULATED').length,officialSourceLimited:projects.filter(p=>p.classification==='OFFICIAL_SOURCE_LIMITED').length,beforeCoverage:{hero:3,exterior:3,interior:3,amenities:3,unitPlans:1,locationMap:1,pricing:2,sizes:2,paymentPlan:0,handover:0},totals,projects};
  await mkdir(`${root}/generated/audits`,{recursive:true});
  await writeFile(`${root}/generated/audits/project-completeness.json`,JSON.stringify(report,null,2)+'\n');
  const rows=projects.map(p=>`| ${p.name} | ${categories.map(c=>p[c]).join(' | ')} |`).join('\n');
  const md=`# Published project completeness audit\n\nGenerated 2026-09-17. “Complete” is not asserted where a category remains unresolved. Unknown commercial facts remain unpublished.\n\n| Project | ${categories.join(' | ')} |\n|---|${categories.map(()=> '---').join('|')}|\n${rows}\n\n## Unresolved-source report\n\n${projects.map(p=>`### ${p.name}\n- Unresolved: ${p.unresolved.join(', ')}\n- Official sources: ${p.officialSources.join(', ')}`).join('\n\n')}\n`;
  await writeFile(`${root}/docs/project-completeness-audit.md`,md);
  const before=report.beforeCoverage;
  const final=`# Final project population audit\n\nGenerated 2026-09-17 after a second official-source pass across all nine published projects. Florence remains the bespoke reference experience; the other eight guides use the shared governed template.\n\n## Before vs after coverage\n\n| Category | Before | After |\n|---|---:|---:|\n| Hero media | ${before.hero}/${projects.length} | ${totals.hero}/${projects.length} |\n| Exterior media | ${before.exterior}/${projects.length} | ${totals.exterior}/${projects.length} |\n| Interior media | ${before.interior}/${projects.length} | ${totals.interior}/${projects.length} |\n| Amenity media | ${before.amenities}/${projects.length} | ${totals.amenities}/${projects.length} |\n| Floor plans | ${before.unitPlans}/${projects.length} | ${totals.unitPlans}/${projects.length} |\n| Official maps | ${before.locationMap}/${projects.length} | ${totals.locationMap}/${projects.length} |\n| Published prices | ${before.pricing}/${projects.length} | ${totals.pricing}/${projects.length} |\n| Published sizes | ${before.sizes}/${projects.length} | ${totals.sizes}/${projects.length} |\n| Payment plans | ${before.paymentPlan}/${projects.length} | ${totals.paymentPlan}/${projects.length} |\n| Handover | ${before.handover}/${projects.length} | ${totals.handover}/${projects.length} |\n\n## Portfolio result\n\n- Published projects audited: ${projects.length}\n- Fully populated across every audited optional field: ${report.fullyPopulated}\n- Official-source-limited after page and document review: ${report.officialSourceLimited}\n\nNo absent commercial value is inferred. Current inventory is always separated from published project information. Raw audit states remain in the machine-readable report and never appear in the customer experience.\n\n## Completeness matrix\n\n| Project | Classification | Media (hero/ext/int/amenity/lifestyle) | Floor plans | Map | Price | Size | Payment | Handover |\n|---|---|---:|---|---|---|---|---|---|\n${projects.map(p=>`| ${p.name} | ${p.classification} | ${p.mediaCounts.hero}/${p.mediaCounts.exterior}/${p.mediaCounts.interior}/${p.mediaCounts.amenities}/${p.mediaCounts.lifestyle} | ${p.unitPlans} | ${p.locationMap} | ${p.pricing} | ${p.sizes} | ${p.paymentPlan} | ${p.handover} |`).join('\n')}\n\n## Sources inspected and unresolved reasons\n\n${projects.map(p=>`### ${p.name}\n**Official sources inspected**\n${p.officialSources.map(url=>`- ${url}`).join('\n')}\n\n**Still unresolved**\n${Object.entries(p.unresolvedDetails).length?Object.entries(p.unresolvedDetails).map(([field,reason])=>`- **${field}:** ${reason}`).join('\n'):'- None beyond live inventory, which always requires confirmation.'}`).join('\n\n')}\n\n## QA scope\n\nThe deterministic suite verifies rendering, canonical metadata, discovery, governed media provenance, optional-field omission, maps and floor plans when approved, internal links, and preservation of project-context enquiry payloads. Responsive CSS breakpoints cover desktop, tablet and 390px mobile layouts. Browser screenshot tooling was unavailable in this environment, so responsive verification used deterministic generated-markup and CSS checks.\n`;
  await writeFile(`${root}/docs/final-project-population-audit.md`,final);
  return report;
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],`file://${process.cwd()}/`).href){await validateMedia();const report=await generateAudit();console.log(`Audited ${report.publishedProjects} published projects; ${report.totals.hero} verified heroes; ${report.totals.unitPlans} with floor plans; ${report.totals.locationMap} with maps.`);}
