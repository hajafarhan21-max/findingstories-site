import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isProjectsRoute, PROJECTS_HASH } from '../public/crm-routing.js';

test('Projects has a dedicated route that can never alias project performance', async () => {
  const html = await readFile('admin.html', 'utf8');
  assert.equal(PROJECTS_HASH, '#projects');
  assert.equal(isProjectsRoute('#projects'), true);
  assert.equal(isProjectsRoute('#project-performance'), false);
  assert.match(html, />Projects<\/a>/);
  assert.match(html, /href="#projects"[^>]*>Projects<\/a>/);
  assert.doesNotMatch(html, /href="#project-performance"[^>]*>Projects<\/a>/);
  assert.match(html, /href="#project-performance"[^>]*>Project Performance<\/a>/);
});

test('Projects workspace exposes guarded upload and review controls', async () => {
  const [html, script] = await Promise.all([
    readFile('admin.html', 'utf8'),
    readFile('public/admin.js', 'utf8')
  ]);
  assert.match(html, /id="project-ingestion"/);
  assert.match(html, /accept="\.pdf,\.csv,\.xls,\.xlsx/);
  assert.match(html, /Upload for review/);
  assert.match(script, /currentRole!==['"]SUPER_ADMIN['"]/);
  assert.match(script, /data-ingestion-decision="approve"/);
  assert.match(script, /data-ingestion-decision="reject"/);
});
