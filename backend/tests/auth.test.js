import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import User from '../models/User.js';
import { createRequireAuth, requireAdmin } from '../middleware/auth.js';
import {
  assertRoleChangeAllowed,
  clearSessionCookie,
  createSessionCookie,
  hashPassword,
  passwordMatches,
  requestSessionToken,
  signSessionToken,
  toPublicUser,
  validateAuthConfig,
  validateRegistrationInput,
  verifySessionToken
} from '../services/auth.js';

const authEnv = { JWT_SECRET: 'test-only-secret-value-that-is-longer-than-32-bytes', JWT_TTL_HOURS: '1', NODE_ENV: 'test' };

test('user model normalizes identity, defaults to customer, and hides password hashes', () => {
  const user = new User({ name: '  Alice Builder  ', email: '  ALICE@Example.COM ', passwordHash: 'private-hash' });
  assert.equal(user.validateSync(), undefined);
  assert.equal(user.name, 'Alice Builder');
  assert.equal(user.email, 'alice@example.com');
  assert.equal(user.role, 'customer');
  assert.equal(user.active, true);
  assert.equal(User.schema.path('passwordHash').options.select, false);
  assert.equal(user.toJSON().passwordHash, undefined);
  assert.ok(User.schema.indexes().some(([fields, options]) => fields.email === 1 && options.unique));

  const invalid = new User({ name: 'A', email: 'not-email', passwordHash: 'hash', role: 'owner' }).validateSync();
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.role);
});

test('registration is normalized and cannot assign an administrator role', () => {
  assert.deepEqual(validateRegistrationInput({ name: '  Jamie Doe ', email: ' JAMIE@EXAMPLE.COM ', password: 'correct horse' }), {
    name: 'Jamie Doe', email: 'jamie@example.com', password: 'correct horse'
  });
  assert.throws(
    () => validateRegistrationInput({ name: 'Jamie Doe', email: 'jamie@example.com', password: 'correct horse', role: 'admin' }),
    error => error.status === 400 && error.fields.role === 'New accounts are always customers.'
  );
});

test('bcrypt helpers salt hashes and verify only the correct password', async () => {
  const first = await hashPassword('correct horse', 4);
  const second = await hashPassword('correct horse', 4);
  assert.notEqual(first, 'correct horse');
  assert.notEqual(first, second);
  assert.equal(await passwordMatches('correct horse', first), true);
  assert.equal(await passwordMatches('wrong password', first), false);
});

test('JWT configuration, claims, verification, and cookie attributes are constrained', () => {
  assert.throws(() => validateAuthConfig({}), /JWT_SECRET/);
  assert.throws(() => validateAuthConfig({ JWT_SECRET: 'too-short' }), /32 bytes/);
  assert.throws(() => validateAuthConfig({ JWT_SECRET: 'REPLACE_WITH_A_SECRET_VALUE_THAT_IS_LONG_ENOUGH' }), /placeholder/);
  assert.throws(() => validateAuthConfig({ ...authEnv, JWT_TTL_HOURS: '0' }), /1 to 720/);

  const token = signSessionToken('507f1f77bcf86cd799439011', authEnv);
  const payload = verifySessionToken(token, authEnv);
  assert.equal(payload.sub, '507f1f77bcf86cd799439011');
  assert.equal(payload.role, undefined);
  assert.throws(() => verifySessionToken(token, { ...authEnv, JWT_SECRET: 'another-test-secret-that-is-at-least-32-bytes-long' }));
  assert.throws(() => verifySessionToken('not-a-token', authEnv));

  const cookie = createSessionCookie(token, authEnv);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\/api/);
  assert.doesNotMatch(cookie, /; Secure/);
  assert.match(createSessionCookie(token, { ...authEnv, NODE_ENV: 'production' }), /; Secure/);
  assert.match(clearSessionCookie(authEnv), /Max-Age=0/);
});

test('request token extraction prefers the session cookie and supports bearer fallback', () => {
  assert.equal(requestSessionToken({ headers: { cookie: 'other=x; pcbuild_session=cookie-token', authorization: 'Bearer bearer-token' } }), 'cookie-token');
  assert.equal(requestSessionToken({ headers: { authorization: 'Bearer bearer-token' } }), 'bearer-token');
  assert.equal(requestSessionToken({ headers: { authorization: 'Basic credentials' } }), null);
});

test('authentication middleware loads the active user on every request and uses safe status codes', async () => {
  let loadCount = 0;
  const user = { _id: 'user-1', role: 'customer', active: true };
  const middleware = createRequireAuth({
    verifyToken: token => {
      if (token !== 'valid-token') throw new Error('invalid');
      return { sub: 'user-1' };
    },
    loadUser: async id => {
      loadCount += 1;
      assert.equal(id, 'user-1');
      return user;
    }
  });

  const validRequest = { headers: { authorization: 'Bearer valid-token' } };
  let validError = 'not-called';
  await middleware(validRequest, {}, error => { validError = error; });
  assert.equal(validError, undefined);
  assert.equal(validRequest.user, user);
  assert.equal(loadCount, 1);

  let missingError;
  await middleware({ headers: {} }, {}, error => { missingError = error; });
  assert.equal(missingError.status, 401);
  assert.equal(loadCount, 1);

  let invalidError;
  await middleware({ headers: { authorization: 'Bearer invalid-token' } }, {}, error => { invalidError = error; });
  assert.equal(invalidError.status, 401);
  assert.equal(loadCount, 1);
});

test('administrator middleware distinguishes unauthenticated and forbidden requests', () => {
  let error;
  requireAdmin({}, {}, value => { error = value; });
  assert.equal(error.status, 401);
  requireAdmin({ user: { role: 'customer' } }, {}, value => { error = value; });
  assert.equal(error.status, 403);
  requireAdmin({ user: { role: 'admin' } }, {}, value => { error = value; });
  assert.equal(error, undefined);
});

test('role changes cannot self-demote or remove the final active administrator', () => {
  const admin = { _id: 'admin-1', role: 'admin', active: true };
  assert.throws(
    () => assertRoleChangeAllowed({ actorId: 'admin-1', user: admin, nextRole: 'customer', activeAdminCount: 2 }),
    error => error.status === 400 && /own administrator role/.test(error.message)
  );
  assert.throws(
    () => assertRoleChangeAllowed({ actorId: 'admin-2', user: admin, nextRole: 'customer', activeAdminCount: 1 }),
    error => error.status === 409 && /final active administrator/.test(error.message)
  );
  assert.doesNotThrow(() => assertRoleChangeAllowed({ actorId: 'admin-2', user: admin, nextRole: 'customer', activeAdminCount: 2 }));
});

test('public user serializer exposes only account-safe fields', () => {
  const result = toPublicUser({
    _id: 'user-1', name: 'Jamie', email: 'jamie@example.com', role: 'customer', active: true,
    lastLoginAt: null, passwordHash: 'never-return-this', __v: 0
  });
  assert.deepEqual(result, {
    _id: 'user-1', name: 'Jamie', email: 'jamie@example.com', role: 'customer', active: true, lastLoginAt: null
  });
});

test('auth routes share the prompt database-unavailable response and credentialed CORS', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/me`, {
      headers: { Origin: 'http://localhost:5173' }
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).message, 'Database unavailable. Configure MongoDB Atlas and run the seed command.');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');

    const logout = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/logout`, { method: 'POST' });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await logout.json()).message, 'Signed out.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
