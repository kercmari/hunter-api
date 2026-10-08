import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function migrate(): Promise<void> {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: (process.env.DB_SSL ?? 'false').toLowerCase() === 'true'
      ? { rejectUnauthorized: (process.env.DB_SSL_REJECT_UNAUTHORIZED ?? 'true') !== 'false' }
      : undefined,
    max: 1,
  });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name        VARCHAR(255) PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = readdirSync(__dirname).filter((file) => file.endsWith('.sql')).sort();
    const { rows } = await client.query<{ name: string }>('SELECT name FROM migrations');
    const applied = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`- ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(__dirname, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`+ ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`${file}: ${(error as Error).message}`);
      }
    }
    console.log('Migrations up to date.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(`Migration failed: ${(error as Error).message}`);
  process.exit(1);
});
