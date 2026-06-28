import { Pool } from 'pg';

export const databaseUrl = process.env.DATABASE_URL;

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
    })
  : null;

export async function checkDatabase() {
  if (!pool) {
    return {
      ok: false,
      error: 'DATABASE_URL is not set',
    };
  }

  const result = await pool.query<{
    now: string;
    database_name: string;
  }>('select now()::text as now, current_database() as database_name');

  return {
    ok: true,
    database: result.rows[0].database_name,
    now: result.rows[0].now,
  };
}
