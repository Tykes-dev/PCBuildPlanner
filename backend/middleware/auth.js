import mongoose from 'mongoose';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { tokenHash } from '../services/auth.js';
export const COOKIE = 'pcbp_session';
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api' });
export function sessionToken(req) {
  const token = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function databaseReady(req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'Database unavailable. Configure MongoDB Atlas and run the seed command.' });
  next();
}
export async function requireUser(req, res, next) {
  const token = sessionToken(req);
  if (!token) return res.status(401).json({ message: 'Log in to continue.' });
  if (mongoose.connection.readyState !== 1) return databaseReady(req, res, next);
  const session = await Session.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } }).lean();
  const user = session && await User.findById(session.user).lean();
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  req.user = user;
  next();
}
export function requireRole(role) {
  return (req, res, next) => requireUser(req, res, error => {
    if (error) return next(error);
    if (req.user.role !== role) return res.status(403).json({ message: 'You do not have access to this page.' });
    next();
  });
}
export const requireCustomer = requireRole('customer');
