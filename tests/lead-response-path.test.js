import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('lead API critical path excludes schema bootstrap and eagerly loaded SMTP/AI modules', async () => {
  const source = await readFile('api/leads.js', 'utf8');
  assert.doesNotMatch(source, /await ensureSchema\(\)/);
  assert.doesNotMatch(source, /import \{ sendLeadNotification \} from/);
  assert.doesNotMatch(source, /import \{ qualifyLead, fallback \} from/);
  assert.match(source, /import\('\.\/_lib\/lead-notification\.js'\)/);
  assert.match(source, /import\('\.\/_lib\/qualify\.js'\)/);
});

test('Florence and homepage forms each make one lead request and do not await conversion analytics', async () => {
  const [florence, homepage] = await Promise.all([
    readFile('public/azizi-florence.js', 'utf8'),
    readFile('public/advisor.js', 'utf8')
  ]);
  assert.equal((florence.match(/fetch\('\/api\/leads'/g) || []).length, 1);
  assert.doesNotMatch(florence, /await analytics\(conversion,conversion\)/);
  assert.match(homepage, /fetch\('\/api\/leads'/);
});
