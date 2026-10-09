import mongoose from 'mongoose';
import User from '../models/User.js';
import { requestSessionToken, verifySessionToken } from '../services/auth.js';
import { forbidden, unauthorized } from '../services/errors.js';

async function findActiveUser(userId) {
  if (!mongoose.isObjectIdOrHexString(userId)) return null;
  return User.findOne({ _id: userId, active: true });
}

export function createRequireAuth({ verifyToken = verifySessionToken, loadUser = findActiveUser } = {}) {
  return async function authenticate(req, res, next) {
    const token = requestSessionToken(req);
    if (!token) return next(unauthorized());

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return next(unauthorized('Your session is invalid or has expired.'));
    }

    try {
      const user = await loadUser(payload.sub);
      if (!user) return next(unauthorized('Your session is invalid or has expired.'));
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAuth = createRequireAuth();

export function requireAdmin(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden());
  next();
}
