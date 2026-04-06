import { Pool } from 'pg';
import { appConfig } from './config';

if (!appConfig.databaseUrl) {
  // We allow boot without DB in dev, but warn so it is clear.
  console.warn('DATABASE_URL is not set. Database calls will fail until configured.');
}

export const pool = new Pool({
  connectionString: appConfig.databaseUrl || undefined,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected Postgres error', err);
});

export async function pingDatabase() {
  if (!appConfig.databaseUrl) return { ok: false, error: 'DATABASE_URL not set' };
  try {
    await pool.query('select 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
