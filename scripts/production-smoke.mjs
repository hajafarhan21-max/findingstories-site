import { appendFile } from 'node:fs/promises';

const baseUrl = String(process.env.PRODUCTION_URL || '').replace(/\/$/, '');
const summary = process.env.GITHUB_STEP_SUMMARY;
const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchWithTimeout(path) {
  return fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    redirect: 'follow',
    signal: globalThis.AbortSignal.timeout(15_000),
    headers: { 'cache-control': 'no-cache', 'user-agent': 'finding-stories-production-verifier' }
  });
}

async function waitForHealthyDeployment() {
  const maxAttempts = Number(process.env.SMOKE_MAX_ATTEMPTS || 60);
  const interval = Number(process.env.SMOKE_INTERVAL_MS || 10_000);
  const initialWait = Number(process.env.SMOKE_INITIAL_WAIT_MS || 0);
  let lastError = 'deployment did not respond';

  if (initialWait > 0) {
    console.log(`Waiting ${Math.ceil(initialWait / 1000)} seconds for the Vercel Git deployment before polling.`);
    await sleep(initialWait);
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout('/api/health');
      const contentType = response.headers.get('content-type') || 'unknown';
      const text = await response.text();
      let body;
      try { body = JSON.parse(text); }
      catch { throw new Error(`HTTP ${response.status}; expected JSON but received ${contentType}`); }

      const api = body?.checks?.api ?? 'missing';
      const database = body?.checks?.database ?? 'missing';
      lastError = `HTTP ${response.status}; api=${api}; database=${database}`;
      console.log(`[${attempt}/${maxAttempts}] /api/health: ${lastError}`);
      if (response.ok && api === 'ok' && database === 'ok') return body;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.log(`[${attempt}/${maxAttempts}] /api/health request failed: ${lastError}`);
    }
    if (attempt < maxAttempts) await sleep(interval);
  }
  throw new Error(`Vercel production was not healthy after ${maxAttempts} attempts (${lastError})`);
}

async function verifyHtml(path, expectedText) {
  const response = await fetchWithTimeout(path);
  const contentType = response.headers.get('content-type') || 'unknown';
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  if (!contentType.includes('text/html') || !text.toLowerCase().includes('<!doctype html')) {
    throw new Error(`${path} returned unexpected content-type ${contentType}`);
  }
  if (!text.includes(expectedText)) throw new Error(`${path} did not contain its expected page marker`);
  record(path, true, `HTTP ${response.status} ${contentType}`);
}

try {
  if (!baseUrl.startsWith('https://')) throw new Error('PRODUCTION_URL must be an HTTPS URL');
  const health = await waitForHealthyDeployment();
  record('/api/health', true, `api=${health.checks.api}, database=${health.checks.database}`);
  await verifyHtml('/open-house', 'Request your preferred time');
  await verifyHtml('/event-admin.html', 'CRM Access');
} catch (error) {
  record('Production verification', false, error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  const lines = ['### Production verification', '',
    '> Read-only checks only: no client records were submitted, changed, or deleted.', '',
    '| Check | Result | Detail |', '|---|---|---|',
    ...results.map(({ name, ok, detail }) => `| ${name} | ${ok ? '✅ pass' : '❌ fail'} | ${String(detail).replaceAll('|', '\\|')} |`), ''];
  if (summary) await appendFile(summary, `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}
