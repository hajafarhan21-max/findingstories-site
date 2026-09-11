import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectManifestSchema } from './schema.js';
import { hamming, inspectImage } from './assets.js';

export async function auditManifest(file,{root=process.cwd(),baseUrl}={}){
  const report={manifest:file,passed:false,errors:[],warnings:[],checks:[]}; let manifest;
  try{manifest=projectManifestSchema.parse(JSON.parse(await readFile(file,'utf8')));}catch(error){report.errors.push({code:'MANIFEST_INVALID',detail:error.message});return report;}
  const location=manifest.assets.find(x=>['location_map','masterplan'].includes(x.slot));
  if(!location||!['location_map','masterplan'].includes(location.visual_review.classification)||location.visual_review.confidence<0.9)report.errors.push({code:'LOCATION_MAP_MISSING_OR_UNVERIFIED',detail:'A visually reviewed map/masterplan with confidence >= 0.90 is mandatory. No fallback is allowed.'});
  const seenSlots=new Map();
  for(const asset of manifest.assets){
    const full=resolve(root,asset.path); try{await access(full);const actual=await inspectImage(full);for(const field of ['sha256','perceptual_hash','mime','width','height'])if(actual[field]!==asset[field])report.errors.push({code:'ASSET_METADATA_MISMATCH',asset:asset.path,field,expected:asset[field],actual:actual[field]});}catch(error){report.errors.push({code:'ASSET_INVALID',asset:asset.path,detail:error.message});}
    if(asset.visual_review.classification!==asset.slot && !(asset.slot==='gallery'&&['overview','hero','unit_type','lifestyle'].includes(asset.visual_review.classification)))report.errors.push({code:'SEMANTIC_SLOT_MISMATCH',asset:asset.path,slot:asset.slot,classification:asset.visual_review.classification});
    if(seenSlots.has(asset.sha256))report.errors.push({code:'DUPLICATE_ASSET_ASSIGNMENT',assets:[seenSlots.get(asset.sha256),asset.path]});else seenSlots.set(asset.sha256,asset.path);
  }
  for(let i=0;i<manifest.assets.length;i++)for(let j=i+1;j<manifest.assets.length;j++)if(hamming(manifest.assets[i].perceptual_hash,manifest.assets[j].perceptual_hash)<=4)report.errors.push({code:'PERCEPTUAL_DUPLICATE_ASSIGNMENT',assets:[manifest.assets[i].path,manifest.assets[j].path]});
  if(baseUrl)for(const asset of manifest.assets){try{const response=await fetch(new URL(asset.path.replace(/^public\//,''),`${baseUrl.replace(/\/$/,'')}/`),{redirect:'follow'});if(response.status!==200||response.headers.get('content-type')?.split(';')[0]!==asset.mime)report.errors.push({code:'DEPLOYED_ASSET_INVALID',asset:asset.path,status:response.status,mime:response.headers.get('content-type')});}catch(error){report.errors.push({code:'DEPLOYED_ASSET_UNREACHABLE',asset:asset.path,detail:error.message});}}
  report.checks.push({name:'lead_endpoint',value:manifest.lead.endpoint},{name:'attribution',value:Boolean(manifest.lead.campaign_id&&manifest.lead.project_id)},{name:'production_mutation',value:false}); report.passed=!report.errors.length; return report;
}
