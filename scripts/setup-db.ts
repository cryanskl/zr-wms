import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';

const rootDir = process.cwd();

const orderedSqlFiles = [
  'docs/wms_schema_v1.7.sql',
  'docs/wms_procedures_v1.7.sql',
  'docs/wms_logic_v1.7.sql',
  'scripts/sql/app-auth.sql',
  'scripts/sql/seed-foundation.sql',
];

async function readSql(relativePath: string) {
  return readFile(path.join(rootDir, relativePath), 'utf8');
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required. Copy .env.example to .env or export DATABASE_URL.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (process.argv.includes('--reset-public-schema')) {
      console.warn('Resetting public schema before setup.');
      await client.query('drop schema if exists public cascade; create schema public;');
    }

    for (const relativePath of orderedSqlFiles) {
      console.log(`Running ${relativePath}`);
      const sql = await readSql(relativePath);
      await client.query(sql);
    }

    const verification = await client.query<{
      products: string;
      path_aliases: string;
      movements: string;
    }>(`
      select
        (select count(*) from product)::text as products,
        (select count(*) from bom_path_alias)::text as path_aliases,
        (select count(*) from stock_movement)::text as movements
    `);

    console.log('Database setup complete:', verification.rows[0]);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
