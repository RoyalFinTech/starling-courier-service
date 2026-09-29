import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../migrations');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const files = (await fs.readdir(migrationsDir)).filter(name => name.endsWith('.sql')).sort();
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map(row => row.version));

    // The first releases applied 001/002 directly. Baseline those known objects
    // when upgrading an already-initialized database so migrations remain idempotent.
    if (applied.size === 0) {
      const { rows: existing } = await client.query(`SELECT
        to_regclass('public.shipments') IS NOT NULL AS shipments_exist,
        to_regclass('public.admin_users') IS NOT NULL AS admins_exist
      `);
      if (existing[0]?.shipments_exist) {
        await client.query("INSERT INTO schema_migrations(version) VALUES ('001_initial.sql') ON CONFLICT DO NOTHING");
      }
      if (existing[0]?.admins_exist) {
        await client.query("INSERT INTO schema_migrations(version) VALUES ('002_admin_and_operations.sql') ON CONFLICT DO NOTHING");
      }
      const { rows: baselined } = await client.query('SELECT version FROM schema_migrations');
      baselined.forEach(row => applied.add(row.version));
    }
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => { console.error('Migration failed:', error); process.exit(1); });
