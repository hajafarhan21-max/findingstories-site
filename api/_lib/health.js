export async function healthReport({ databaseConfigured, openaiConfigured, checkDatabase }) {
  const checks = { api: 'ok', database: databaseConfigured ? 'checking' : 'not_configured', openai: openaiConfigured ? 'configured' : 'not_configured' };
  try { if (databaseConfigured) { await checkDatabase(); checks.database = 'ok'; } }
  catch { checks.database = 'error'; }
  return { status: checks.database === 'error' ? 'degraded' : 'ok', checks, timestamp: new Date().toISOString() };
}
