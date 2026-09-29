import dotenv from 'dotenv';
dotenv.config();
import app from './app.js';
import { pool, query } from './db.js';
import { hashPassword } from './auth.js';

const port = Number(process.env.PORT || 4000);

function validateEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in production.');
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production.');
    if (!process.env.CORS_ORIGIN) throw new Error('CORS_ORIGIN is required in production.');
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required for first admin bootstrap.');
    if (process.env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    if (process.env.RESEND_API_KEY && !process.env.EMAIL_FROM) throw new Error('EMAIL_FROM is required when RESEND_API_KEY is configured.');
  }
}

async function bootstrap(){
  validateEnvironment();
  if(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD){
    const email=process.env.ADMIN_EMAIL.trim().toLowerCase();
    const existing=await query('SELECT id FROM admin_users WHERE LOWER(email)=$1',[email]);
    if(!existing.rows[0]){
      const hash=await hashPassword(process.env.ADMIN_PASSWORD);
      await query('INSERT INTO admin_users (email,password_hash) VALUES ($1,$2)',[email,hash]);
      console.log(`Initial admin created: ${email}`);
    }
  }
  const server=app.listen(port,()=>console.log(`Starling API listening on port ${port}`));
  const shutdown=async()=>{ server.close(async()=>{await pool.end(); process.exit(0);}); };
  process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
}
bootstrap().catch(err=>{ console.error('Startup failed:',err); process.exit(1); });
