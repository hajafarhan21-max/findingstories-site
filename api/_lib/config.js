export function configuredDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
}
