import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { credentials, hashPassword, verifyPassword, publicUser, tokenHash } from '../services/auth.js';
import { COOKIE, cookieOptions, sessionToken, databaseReady, requireUser } from '../middleware/auth.js';
const router = Router();
const attempts = new Map();
// Per-process protection; use a shared limiter before scaling to multiple servers.
function rateLimit(req, res, next) {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const key = req.ip;
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (entry.count >= 20) {
    res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
    return res.status(429).json({ message: 'Too many attempts. Please try again in 15 minutes.' });
  }
  entry.count++;
  attempts.set(key, entry);
  next();
}
async function startSession(req, res, user) {
  const previous = sessionToken(req);
  if (previous) await Session.deleteOne({ tokenHash: tokenHash(previous) });
  const token = randomBytes(32).toString('hex');
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  await Session.create({ tokenHash: tokenHash(token), user: user._id, expiresAt: new Date(Date.now() + maxAge) });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge });
}
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/register', rateLimit, databaseReady, async (req, res) => {
  const { name, email, password } = credentials(req.body, true);
  try {
    await User.create({ name, email, passwordHash: await hashPassword(password), role: 'customer' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This email is already registered. Log in instead.' });
    throw error;
  }
  res.status(201).json({ message: 'Account created. You can now log in.' });
});
let dummyHash;
router.post('/login', rateLimit, databaseReady, async (req, res) => {
  const { email, password } = credentials(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  dummyHash ||= hashPassword(randomBytes(32).toString('hex'));
  const valid = await verifyPassword(password, user?.passwordHash || await dummyHash);
  if (!user || !valid) return res.status(401).json({ message: 'Incorrect email or password.' });
  await startSession(req, res, user);
  res.json({ user: publicUser(user) });
});
router.get('/me', requireUser, (req, res) => res.json({ user: publicUser(req.user) }));
router.post('/logout', databaseReady, async (req, res) => {
  const token = sessionToken(req);
  if (token) await Session.deleteOne({ tokenHash: tokenHash(token) });
  res.clearCookie(COOKIE, cookieOptions());
  res.status(204).end();
});
export default router;

