import { access, cp, mkdir, rm } from 'node:fs/promises';

const staticEntries = ['index.html', 'admin.html', 'open-house.html', 'event-admin.html', 'public'];
const requiredFunctions = [
  'api/health.js',
  'api/leads.js',
  'api/admin/login.js',
  'api/admin/logout.js',
  'api/admin/leads.js',
  'api/admin/leads/update.js',
  'api/events/slots.js',
  'api/events/rsvp.js',
  'api/events/visit.js',
  'api/admin/events.js',
  'api/acceptance/events.js'
  ,'api/acquisition.js'
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of staticEntries) {
  await access(file);
  await cp(file, `dist/${file}`, { recursive: true });
}
// Crawlers request this file at the origin root, not below /public.
await cp('public/robots.txt', 'dist/robots.txt');
// Vercel bundles root api/ files as Functions rather than copying them into outputDirectory.
// Failing here gives a useful build error if a route is accidentally renamed or omitted.
for (const file of requiredFunctions) await access(file);

console.log(`Production output ready: ${staticEntries.length} static entries and ${requiredFunctions.length} Vercel Functions validated.`);
