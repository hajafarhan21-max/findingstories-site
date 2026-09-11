import { readFile, writeFile } from 'node:fs/promises';
import { runProductionAcceptance } from '../project-launch/production-acceptance.js';

const args=Object.fromEntries(process.argv.slice(2).map((x,i,a)=>x.startsWith('--')?[x.slice(2),a[i+1]&&!a[i+1].startsWith('--')?a[i+1]:true]:null).filter(Boolean));
if(!args.url||!args.path||!args.manifest)throw new Error('Usage: npm run acceptance:project -- --url https://preview.example --path /projects/developer/project --manifest projects/project/manifest.json [--submit]');
const manifest=JSON.parse(await readFile(args.manifest,'utf8'));
const proof=args.proof?JSON.parse(await readFile(args.proof,'utf8')):null;
const report=await runProductionAcceptance({baseUrl:args.url,projectPath:args.path,submit:Boolean(args.submit),expectedResidences:Number(args.residences||5),approvedAssets:manifest.assets,existingLeadProof:proof});
await writeFile(args.report||'qa-reports/production-project.json',`${JSON.stringify({...report,generated_at:new Date().toISOString()},null,2)}\n`);console.log(JSON.stringify(report,null,2));if(!report.revenue_ready)process.exitCode=1;
