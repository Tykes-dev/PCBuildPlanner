import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { badRequest } from './errors.js';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return salt + ':' + key.toString('hex');
}
export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(hash, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const publicUser = user => ({ id: String(user._id), name: user.name, email: user.email, role: user.role });
export function credentials(body, register = false) {
  const { name, email, password } = body || {};
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw badRequest('Enter a valid email address.');
  if (typeof password !== 'string' || password.length > 128 || password.length < (register ? 12 : 1)) throw badRequest(register ? 'Use a password between 12 and 128 characters.' : 'Enter your password (up to 128 characters).');
  if (register && (typeof name !== 'string' || !name.trim() || name.trim().length > 80)) throw badRequest('Enter your name (up to 80 characters).');
  return { name: register ? name.trim() : undefined, email: email.trim().toLowerCase(), password };
}
