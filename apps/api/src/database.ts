import { Pool, QueryResult, QueryResultRow } from 'pg';

export const databaseUrl = process.env.DATABASE_URL;

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
    })
  : null;

export type DatabaseQuery = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<QueryResult<T>>;

export async function queryDatabase<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  if (!pool) {
    throw new Error('DATABASE_URL is not set');
  }

  return pool.query<T>(text, values);
}

export async function withDatabaseTransaction<T>(callback: (query: DatabaseQuery) => Promise<T>) {
  if (!pool) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = await pool.connect();
  const transactionQuery: DatabaseQuery = (text, values = []) => client.query(text, values);

  try {
    await client.query('BEGIN');
    const result = await callback(transactionQuery);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

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
