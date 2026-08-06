export function databaseFailureCategory(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (code === '28P01' || code === '28000') return 'authentication';
  if (code === '3D000') return 'database_not_found';
  if (code === '42501') return 'permission';
  if (code === '42P01' || code === '42703' || code === '42883') return 'schema';
  if (code.startsWith('08')) return 'connectivity';

  const name = typeof error?.name === 'string' ? error.name.toLowerCase() : '';
  if (name.includes('typeerror') || name.includes('fetch')) return 'connectivity';
  return 'unknown';
}

export async function healthReport({ databaseConfigured, openaiConfigured, checkDatabase, log = console.error }) {
  const checks = { api: 'ok', database: databaseConfigured ? 'checking' : 'not_configured', openai: openaiConfigured ? 'configured' : 'not_configured' };
  try { if (databaseConfigured) { await checkDatabase(); checks.database = 'ok'; } }
  catch (error) {
    checks.database = 'error';
    log('Database health check failed', {
      category: databaseFailureCategory(error),
      code: typeof error?.code === 'string' ? error.code : 'unavailable',
      runtime: process.env.VERCEL_ENV || 'local'
    });
  }
  return { status: checks.database === 'error' ? 'degraded' : 'ok', checks, timestamp: new Date().toISOString() };
}
