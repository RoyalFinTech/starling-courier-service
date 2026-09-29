import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production.');

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, secret || 'development-only-secret', { expiresIn: '8h' });
}

export function verifyToken(token) {
  try { return jwt.verify(token, secret || 'development-only-secret'); } catch { return null; }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.auth = jwt.verify(token, secret || 'development-only-secret');
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}
