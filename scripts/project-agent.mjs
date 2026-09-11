import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditManifest } from '../project-launch/qa.js';

const args=Object.fromEntries(process.argv.slice(2).map((x,i,a)=>x.startsWith('--')?[x.slice(2),a[i+1]??true]:null).filter(Boolean));
if(!args.manifest)throw new Error('Usage: npm run project:agent -- --manifest projects/<slug>/manifest.json [--preview URL]');
const report=await auditManifest(resolve(args.manifest),{baseUrl:args.preview});await mkdir('qa-reports',{recursive:true});const name=args.manifest.split('/').at(-2)||'project';
await writeFile(`qa-reports/${name}.json`,`${JSON.stringify({...report,generated_at:new Date().toISOString()},null,2)}\n`);
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
