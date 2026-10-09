import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { badRequest, conflict } from './errors.js';
import { USER_ROLES } from '../models/User.js';

export const AUTH_COOKIE_NAME = 'pcbuild_session';
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
const TOKEN_ISSUER = 'pc-build-planner-api';
const TOKEN_AUDIENCE = 'pc-build-planner-web';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function configurationError(message) {
  const error = new Error(message);
  error.code = 'AUTH_CONFIGURATION';
  return error;
}

export function validateAuthConfig(env = process.env) {
  const secret = env.JWT_SECRET;
  if (typeof secret !== 'string' || !secret.trim()) {
    throw configurationError('Set JWT_SECRET in backend/.env before starting the API.');
  }
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw configurationError('JWT_SECRET must contain at least 32 bytes. Generate a long random value for backend/.env.');
  }
  if (/(?:replace[_ -]?with|change[_ -]?me|placeholder|your[_ -]?(?:jwt|secret)|example)/i.test(secret)) {
    throw configurationError('JWT_SECRET still contains a placeholder. Replace it with a long random value in backend/.env.');
  }
  const ttlHours = Number(env.JWT_TTL_HOURS ?? 8);
  if (!Number.isSafeInteger(ttlHours) || ttlHours < 1 || ttlHours > 720) {
    throw configurationError('JWT_TTL_HOURS must be a whole number from 1 to 720.');
  }
  return { secret, ttlHours };
}

export function signSessionToken(userId, env = process.env) {
  const { secret, ttlHours } = validateAuthConfig(env);
  return jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: String(userId),
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresIn: `${ttlHours}h`
  });
}

export function verifySessionToken(token, env = process.env) {
  const { secret } = validateAuthConfig(env);
  const payload = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE
  });
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Token subject is missing.');
  }
  return payload;
}

export function createSessionCookie(token, env = process.env) {
  const { ttlHours } = validateAuthConfig(env);
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${ttlHours * 60 * 60}; Path=/api; HttpOnly; SameSite=Lax${secure}`;
}

export function clearSessionCookie(env = process.env) {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${AUTH_COOKIE_NAME}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/api; HttpOnly; SameSite=Lax${secure}`;
}

function header(req, name) {
  if (typeof req.get === 'function') return req.get(name);
  return req.headers?.[name.toLowerCase()];
}

function cookieValue(cookieHeader, name) {
  if (typeof cookieHeader !== 'string') return null;
  for (const segment of cookieHeader.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 0 || segment.slice(0, separator).trim() !== name) continue;
    const raw = segment.slice(separator + 1).trim();
    try { return decodeURIComponent(raw); } catch { return null; }
  }
  return null;
}

export function requestSessionToken(req) {
  const cookieToken = cookieValue(header(req, 'cookie'), AUTH_COOKIE_NAME);
  if (cookieToken) return cookieToken;
  const authorization = header(req, 'authorization');
  const match = typeof authorization === 'string' ? authorization.match(/^Bearer\s+([^\s]+)$/i) : null;
  return match?.[1] ?? null;
}

function inputObject(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : null;
}

export function validateRegistrationInput(input) {
  const body = inputObject(input);
  if (!body) throw badRequest('Provide registration details.');
  if (Object.prototype.hasOwnProperty.call(body, 'role')) {
    throw badRequest('Role cannot be selected during registration.', { role: 'New accounts are always customers.' });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fields = {};
  if (name.length < 2 || name.length > 80) fields.name = 'Use 2 to 80 characters.';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) fields.email = 'Enter a valid email address up to 254 characters.';
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH || Buffer.byteLength(password, 'utf8') > 72) {
    fields.password = 'Use 8 to 72 characters and keep the password within 72 UTF-8 bytes.';
  }
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);
  return { name, email, password };
}

export function validateLoginInput(input) {
  const body = inputObject(input);
  if (!body) throw badRequest('Provide an email and password.');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fields = {};
  if (!EMAIL_PATTERN.test(email) || email.length > 254) fields.email = 'Enter a valid email address.';
  if (!password || password.length > PASSWORD_MAX_LENGTH || Buffer.byteLength(password, 'utf8') > 72) fields.password = 'Enter your password.';
  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);
  return { email, password };
}

export function validateRoleInput(input) {
  const body = inputObject(input);
  const extraKeys = body ? Object.keys(body).filter(key => key !== 'role') : [];
  if (!body || extraKeys.length || !USER_ROLES.includes(body.role)) {
    throw badRequest('Choose a valid role.', { role: 'Role must be customer or admin.' });
  }
  return body.role;
}

export function assertRoleChangeAllowed({ actorId, user, nextRole, activeAdminCount }) {
  if (user.role !== 'admin' || nextRole === 'admin') return;
  if (String(user._id) === String(actorId)) {
    throw badRequest('You cannot remove your own administrator role.');
  }
  if (user.active && activeAdminCount <= 1) {
    throw conflict('The final active administrator cannot be demoted.');
  }
}

export async function hashPassword(password, rounds = 12) {
  return bcrypt.hash(password, rounds);
}

export async function passwordMatches(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function toPublicUser(user) {
  const source = typeof user?.toObject === 'function' ? user.toObject({ transform: false }) : user;
  if (!source) return null;
  const result = {
    _id: String(source._id),
    name: source.name,
    email: source.email,
    role: source.role,
    active: source.active,
    lastLoginAt: source.lastLoginAt ?? null
  };
  if (source.createdAt) result.createdAt = source.createdAt;
  if (source.updatedAt) result.updatedAt = source.updatedAt;
  return result;
}
