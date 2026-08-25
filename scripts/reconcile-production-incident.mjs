import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const title = '[Production Guardian] Production acceptance incident';
const marker = '<!-- finding-stories-production-guardian -->';
const passed = process.env.SMOKE_OUTCOME === 'success' && process.env.ACCEPTANCE_OUTCOME === 'success';
const stage = process.env.SMOKE_OUTCOME !== 'success' ? 'health/public routes' : 'authenticated TEST acceptance and cleanup';
const runUrl = process.env.RUN_URL;
const repository = process.env.REPOSITORY;
const gh = (...args) => execFileSync('gh', args, { encoding:'utf8', env:process.env }).trim();

const candidates = JSON.parse(gh('issue','list','--repo',repository,'--state','all','--limit','100','--json','number,title,body,state'));
const incident = candidates.find(issue => issue.title === title && issue.body?.includes(marker));

if (passed) {
  if (incident?.state === 'OPEN') {
    const comment = `✅ Production verification recovered. Health, authenticated TEST acceptance, and TEST archival all passed.\n\nRun: ${runUrl}`;
    gh('issue','comment',String(incident.number),'--repo',repository,'--body',comment);
    gh('issue','close',String(incident.number),'--repo',repository,'--reason','completed');
  }
  console.log('Production Guardian passed; no open incident remains.');
  process.exit(0);
}

const logNames = ['guardian-smoke.log','guardian-acceptance.log'];
const sections = [];
for (const name of logNames) {
  let content = 'log was not produced';
  try { content = await readFile(name,'utf8'); }
  catch { content = `${name} was not produced`; }
  sections.push(`### ${name}\n\n\`\`\`text\n${content.split('\n').slice(-120).join('\n')}\n\`\`\``);
}
const body = `${marker}\n## Production acceptance failed\n\n**Failing stage:** ${stage}\n\n**Workflow run:** ${runUrl}\n\nThe guardian only uses the dedicated acceptance credential. Server-side predicates constrain mutations to records where both the event and RSVP have \`is_test=true\`. Review the attached workflow artifact for the complete logs.\n\n${sections.join('\n\n')}`;
await writeFile('guardian-incident.md',body);

if (incident) {
  gh('issue','edit',String(incident.number),'--repo',repository,'--body-file','guardian-incident.md');
  if (incident.state !== 'OPEN') gh('issue','reopen',String(incident.number),'--repo',repository);
  gh('issue','comment',String(incident.number),'--repo',repository,'--body',`❌ Production verification failed again at **${stage}**. Run: ${runUrl}`);
  console.log(`Updated production incident #${incident.number}.`);
} else {
  const url = gh('issue','create','--repo',repository,'--title',title,'--body-file','guardian-incident.md');
  console.log(`Created production incident: ${url}`);
}
