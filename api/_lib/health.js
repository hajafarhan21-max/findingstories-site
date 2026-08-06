export function databaseFailureCategory(error) {
  if (typeof error?.diagnostic === 'string') return error.diagnostic;
  const code = typeof error?.code === 'string' ? error.code : '';
  if (code === '28P01' || code === '28000') return 'authentication_failed';
  if (code === '42501') return 'permission_failed';
  if (code === '0A000' || code === '58P01') return 'extension_failed';
  if (['42P01', '42703', '42883', '42P07', '23505'].includes(code)) return 'schema_failed';
  if (code.startsWith('08') || code === '3D000') return 'connection_failed';

  const name = typeof error?.name === 'string' ? error.name.toLowerCase() : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  if (message.includes('ssl') || message.includes('tls') || message.includes('certificate')) return 'ssl_failed';
  if (name.includes('typeerror') || name.includes('fetch')) return 'connection_failed';
  return 'query_failed';
}

export async function healthReport({ databaseConfigured, openaiConfigured, checkDatabase, log = console.error }) {
  const checks = { api: 'ok', database: databaseConfigured ? 'checking' : 'not_configured', openai: openaiConfigured ? 'configured' : 'not_configured' };
  try { if (databaseConfigured) { await checkDatabase(); checks.database = 'ok'; } }
  catch (error) {
    checks.database = 'error';
    checks.databaseDiagnostic = databaseFailureCategory(error);
    log('Database health check failed', {
      category: checks.databaseDiagnostic,
      runtime: process.env.VERCEL_ENV || 'local'
    });
  }
  return { status: checks.database === 'error' ? 'degraded' : 'ok', checks, timestamp: new Date().toISOString() };
}
