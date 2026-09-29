import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30000 });
export function query(text, params){ return pool.query(text, params); }
export async function withTransaction(fn){ const client=await pool.connect(); try { await client.query('BEGIN'); const result=await fn(client); await client.query('COMMIT'); return result; } catch(e){ await client.query('ROLLBACK'); throw e; } finally { client.release(); } }
