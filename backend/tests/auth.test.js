import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Component from '../models/Component.js';
import AllocationProfile from '../models/AllocationProfile.js';
import { hashPassword, verifyPassword, credentials, tokenHash } from '../services/auth.js';

test('passwords use unique salts, verify correctly, and credentials reject invalid values', async () => {
  const first = await hashPassword('a long test passphrase');
  const second = await hashPassword('a long test passphrase');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('a long test passphrase', first), true);
  assert.equal(await verifyPassword('wrong passphrase', first), false);
  assert.throws(() => credentials({ name: ' ', email: 'a@b.com', password: 'long enough password' }, true));
  assert.throws(() => credentials({ name: 'Alice', email: 'bad', password: 'long enough password' }, true));
  assert.throws(() => credentials({ name: 'Alice', email: 'a@b.com', password: 'short' }, true));
  assert.equal(credentials({ email: ' A@B.COM ', password: 'valid' }).email, 'a@b.com');
});

test('registration, session lifecycle, customer enforcement, origins, and rate limits', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
  t.after(() => {
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor);
    else delete mongoose.connection.readyState;
  });
  const users = new Map();
  const sessions = new Map();
  t.mock.method(User, 'create', async input => {
    if (users.has(input.email)) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const user = { ...input, _id: new mongoose.Types.ObjectId() };
    users.set(input.email, user);
    return user;
  });
  t.mock.method(User, 'findOne', filter => ({ select: async () => users.get(filter.email) || null }));
  t.mock.method(User, 'findById', id => ({ lean: async () => [...users.values()].find(user => String(user._id) === String(id)) || null }));
  t.mock.method(Session, 'create', async input => { sessions.set(input.tokenHash, input); return input; });
  t.mock.method(Session, 'deleteOne', async filter => { sessions.delete(filter.tokenHash); });
  t.mock.method(Session, 'findOne', filter => ({ lean: async () => {
    const session = sessions.get(filter.tokenHash);
    return session && session.expiresAt > filter.expiresAt.$gt ? session : null;
  } }));
  t.mock.method(Component, 'find', () => ({ sort: () => ({ lean: async () => [] }) }));
  t.mock.method(AllocationProfile, 'find', () => ({ lean: async () => [] }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const request = (path, body, cookie, origin) => fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  try {
    assert.equal((await request('/components')).status, 200);
    for (const path of ['/profiles', '/profiles/gaming']) assert.equal((await request(path)).status, 401);
    for (const path of ['/allocations', '/recommendations', '/validations', '/power-calculations', '/balance-assessments', '/component-options']) assert.equal((await request(path, {})).status, 401);
    assert.equal((await request('/auth/me')).status, 401);
    const input = { name: 'Alice', email: ' ALICE@example.com ', password: 'A long secure test phrase', role: 'admin' };
    const registered = await request('/auth/register', input);
    assert.equal(registered.status, 201);
    assert.equal(users.get('alice@example.com').role, 'customer');
    assert.notEqual(users.get('alice@example.com').passwordHash, input.password);
    assert.equal((await request('/auth/register', input)).status, 409);
    assert.equal((await request('/auth/register', { ...input, password: 'short' })).status, 400);
    const wrong = await request('/auth/login', { email: input.email, password: 'wrong' });
    assert.equal(wrong.status, 401);
    const unknown = await request('/auth/login', { email: 'unknown@example.com', password: 'wrong' });
    assert.deepEqual(await wrong.json(), await unknown.json());
    const login = await request('/auth/login', input, undefined, 'http://localhost:5173');
    assert.equal(login.status, 200);
    assert.equal(login.headers.get('access-control-allow-credentials'), 'true');
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    assert.match(login.headers.get('set-cookie'), /SameSite=Lax/);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const userBody = await login.json();
    assert.equal(userBody.user.passwordHash, undefined);
    assert.equal((await request('/auth/me', undefined, cookie)).status, 200);
    assert.equal((await request('/profiles', undefined, cookie)).status, 200);
    assert.equal((await request('/auth/logout', {}, cookie, 'https://unrelated.example')).status, 403);
    users.get('alice@example.com').role = 'admin';
    // Administrators plan builds when answering an inquiry, so the planning
    // engine is open to any signed-in account. Ownership-scoped routes are not.
    assert.equal((await request('/profiles', undefined, cookie)).status, 200);
    users.get('alice@example.com').role = 'customer';
    const record = sessions.get(tokenHash(cookie.split('=')[1]));
    record.expiresAt = new Date(0);
    assert.equal((await request('/auth/me', undefined, cookie)).status, 401);
    record.expiresAt = new Date(Date.now() + 60000);
    const rotated = await request('/auth/login', input, cookie);
    const nextCookie = rotated.headers.get('set-cookie').split(';')[0];
    assert.notEqual(nextCookie, cookie);
    assert.equal((await request('/auth/me', undefined, cookie)).status, 401);
    assert.equal((await request('/auth/logout', {}, nextCookie)).status, 204);
    assert.equal((await request('/auth/me', undefined, nextCookie)).status, 401);
    assert.equal((await request('/auth/me', undefined, 'pcbp_session=forged')).status, 401);
    let limited;
    for (let i = 0; i < 21; i++) {
      limited = await request('/auth/login', {});
      if (limited.status === 429) break;
    }
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});