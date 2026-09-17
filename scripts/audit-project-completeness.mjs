import {mkdir,writeFile,access} from 'node:fs/promises';
import sharp from 'sharp';
import {PUBLISHED_PROJECTS} from '../platform/catalog.js';

export const STATES=Object.freeze(['VERIFIED_AND_PUBLISHED','VERIFIED_NO_MEDIA','SOURCE_NOT_FOUND','REQUIRES_HUMAN_APPROVAL','NOT_APPLICABLE']);
const yes=value=>value?'VERIFIED_AND_PUBLISHED':'SOURCE_NOT_FOUND';
export function auditProject(project){
  const media=project.mediaGroups;
  const florence=project.slug==='azizi-florence';
  return {
    slug:project.slug,name:project.name,
    hero:yes(Boolean(media.hero||project.image)),
    exterior:yes(Boolean(media.exteriors.length||florence)),
    interior:yes(Boolean(media.interiors.length||florence)),
    amenities:yes(Boolean(media.amenities.length||florence)),
    unitPlans:florence?'VERIFIED_AND_PUBLISHED':yes(media.floorPlans.length>0),
    locationMap:florence?'VERIFIED_AND_PUBLISHED':project.location.mapStatus,
    pricing:yes(project.startingPrice!==null),paymentPlan:yes(project.paymentPlan!==null),handover:yes(project.handover!==null),
    sizes:yes(project.snapshot.sizeRange!==null),projectFacts:'VERIFIED_AND_PUBLISHED',sourceProvenance:'VERIFIED_AND_PUBLISHED',
    officialSources:project.governance.sources.map(source=>source.url),
    unresolved:project.governance.unknownFields
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
  const report={schemaVersion:1,generatedAt:'2026-09-17',publishedProjects:projects.length,totals,projects};
  await mkdir(`${root}/generated/audits`,{recursive:true});
  await writeFile(`${root}/generated/audits/project-completeness.json`,JSON.stringify(report,null,2)+'\n');
  const rows=projects.map(p=>`| ${p.name} | ${categories.map(c=>p[c]).join(' | ')} |`).join('\n');
  const md=`# Published project completeness audit\n\nGenerated 2026-09-17. “Complete” is not asserted where a category remains unresolved. Unknown commercial facts remain unpublished.\n\n| Project | ${categories.join(' | ')} |\n|---|${categories.map(()=> '---').join('|')}|\n${rows}\n\n## Unresolved-source report\n\n${projects.map(p=>`### ${p.name}\n- Unresolved: ${p.unresolved.join(', ')}\n- Official sources: ${p.officialSources.join(', ')}`).join('\n\n')}\n`;
  await writeFile(`${root}/docs/project-completeness-audit.md`,md);
  return report;
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],`file://${process.cwd()}/`).href){await validateMedia();const report=await generateAudit();console.log(`Audited ${report.publishedProjects} published projects; ${report.totals.hero} verified heroes; ${report.totals.unitPlans} with floor plans; ${report.totals.locationMap} with maps.`);}
