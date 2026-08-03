import { access, cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of ['index.html', 'admin.html', 'open-house.html', 'event-admin.html', 'public']) {
  await access(file);
  await cp(file, `dist/${file}`, { recursive: true });
}
console.log('Static production assets validated and copied to dist/.');
