import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import Build from '../models/Build.js';
import Component from '../models/Component.js';
import AllocationProfile from '../models/AllocationProfile.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import buildsRoutes from '../routes/builds.js';
import { errorHandler } from '../middleware/errors.js';
import { tokenHash } from '../services/auth.js';
import { buildInput, snapshotComponent, resolveCurrentBuild } from '../services/builds.js';

const identifier = () => new mongoose.Types.ObjectId();
const base = { name: 'My draft', budget: 30000, profileSlug: 'gaming', items: [] };

test('saved build input rejects ownership and price spoofing, coercion, invalid IDs and quantities', () => {
  assert.deepEqual(buildInput({ ...base, name: ' My draft ' }), base);
  for (const value of [null, [], true, 'draft']) assert.throws(() => buildInput(value), error => error.status === 400);
  for (const key of ['owner', 'total', 'createdAt', 'profile', '$set', '__proto__']) {
    const body = JSON.parse(JSON.stringify(base));
    Object.defineProperty(body, key, { enumerable: true, value: 'spoofed' });
    assert.throws(() => buildInput(body), error => error.status === 400 && Boolean(error.fields[key]));
  }
  for (const budget of [0, -1, '30000', 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => buildInput({ ...base, budget }), error => error.status === 400);
  }
  for (const name of ['', ' ', 'x'.repeat(101), {}]) assert.throws(() => buildInput({ ...base, name }), error => error.status === 400);
  for (const profileSlug of ['', '__proto__', {}, 'Gaming', 'a'.repeat(101)]) assert.throws(() => buildInput({ ...base, profileSlug }), error => error.status === 400);
  for (const quantity of [0, -1, 33, 1.5, '2', null, NaN]) assert.throws(() => buildInput({ ...base, items: [{ componentId: String(identifier()), quantity }] }), error => error.status === 400);
  for (const componentId of ['bad', {}, 1]) assert.throws(() => buildInput({ ...base, items: [{ componentId, quantity: 1 }] }), error => error.status === 400);
  const componentId = String(identifier());
  assert.throws(() => buildInput({ ...base, items: [{ componentId, quantity: 1, snapshot: { price: 1 } }] }), error => error.status === 400);
  assert.throws(() => buildInput({ ...base, items: [{ componentId, quantity: 1 }, { componentId, quantity: 2 }] }), error => error.status === 400);
  assert.throws(() => buildInput({ ...base, items: Array.from({ length: 8 }, () => ({ componentId: String(identifier()), quantity: 1 })) }), error => error.status === 400);
});

test('component snapshots expose catalog fields and clone array specs only', () => {
  const component = { _id: identifier(), name: 'A case', category: 'case', price: 500, supportedFormFactors: ['ATX'], __v: 4, internalField: 'private', createdAt: new Date() };
  const snapshot = snapshotComponent(component);
  assert.equal(snapshot._id, String(component._id));
  assert.equal(snapshot.powerDraw, 0);
  assert.equal(snapshot.__v, undefined);
  assert.equal(snapshot.internalField, undefined);
  assert.equal(snapshot.createdAt, undefined);
  snapshot.supportedFormFactors.push('ITX');
  assert.deepEqual(component.supportedFormFactors, ['ATX']);
});

test('saved build routes enforce customer ownership and preserve historical snapshots through rename and duplicate', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
  t.after(() => {
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor);
    else delete mongoose.connection.readyState;
  });
  const token = 'a'.repeat(64);
  const owner = identifier();
  const otherOwner = identifier();
  const identity = { _id: owner, role: 'customer', name: 'Customer' };
  const profile = { _id: identifier(), slug: 'gaming', label: 'Gaming', active: true, isDefault: true };
  const parts = [
    { _id: identifier(), name: 'Processor', brand: 'Example', category: 'cpu', price: 5000, performanceScore: 50, powerDraw: 65, socket: 'AM4', archived: false, availability: 'not tracked' },
    { _id: identifier(), name: 'Graphics card', brand: 'Example', category: 'gpu', price: 10000, performanceScore: 50, powerDraw: 100, archived: false, availability: 'in stock', stock: 10 },
    { _id: identifier(), name: 'Another graphics card', brand: 'Example', category: 'gpu', price: 11000, performanceScore: 55, powerDraw: 110, archived: false, availability: 'not tracked' }
  ];
  const records = new Map();
  let mutationCount = 0;
  const owned = filter => {
    const record = records.get(String(filter._id));
    return record && String(record.owner) === String(filter.owner) ? record : null;
  };
  t.mock.method(Session, 'findOne', filter => ({ lean: async () => filter.tokenHash === tokenHash(token) ? { user: identity._id } : null }));
  t.mock.method(User, 'findById', () => ({ lean: async () => ({ ...identity }) }));
  t.mock.method(AllocationProfile, 'findOne', filter => ({ lean: async () => {
    if (filter.active && !profile.active) return null;
    if (filter.slug && filter.slug !== profile.slug) return null;
    if (filter._id && String(filter._id) !== String(profile._id)) return null;
    return profile;
  } }));
  t.mock.method(Component, 'find', filter => ({ lean: async () => parts.filter(part => filter._id.$in.some(id => String(id) === String(part._id)) && (filter.archived === undefined || filter.archived === part.archived)) }));
  t.mock.method(Build, 'find', filter => ({ sort: () => ({ lean: async () => [...records.values()].filter(record => String(record.owner) === String(filter.owner)).sort((a, b) => b.updatedAt - a.updatedAt) }) }));
  t.mock.method(Build, 'findOne', filter => ({ lean: async () => owned(filter) }));
  t.mock.method(Build, 'create', async body => {
    const document = new Build(body);
    await document.validate();
    document.createdAt = new Date();
    document.updatedAt = new Date();
    const record = document.toObject();
    records.set(String(record._id), record);
    mutationCount++;
    return document;
  });
  t.mock.method(Build, 'findOneAndUpdate', (filter, update) => ({ lean: async () => {
    const record = owned(filter);
    if (!record) return null;
    Object.assign(record, update.$set, { updatedAt: new Date() });
    mutationCount++;
    return record;
  } }));
  const app = express();
  app.use(express.json());
  app.use('/api/builds', buildsRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const api = 'http://127.0.0.1:' + server.address().port + '/api/builds';
  const request = (path = '', method = 'GET', body, authenticated = true) => fetch(api + path, {
    method, headers: { ...(authenticated ? { Cookie: 'pcbp_session=' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const input = { ...base, items: parts.slice(0, 2).map(part => ({ componentId: String(part._id), quantity: 1 })) };
  try {
    assert.equal((await request('', 'GET', undefined, false)).status, 401);
    identity.role = 'admin';
    assert.equal((await request()).status, 403);
    identity.role = 'customer';
    const invalid = await request('', 'POST', { ...input, owner: otherOwner, total: 1 });
    assert.equal(invalid.status, 400);
    assert.equal(records.size, 0);
    const empty = await request('', 'POST', base);
    assert.equal(empty.status, 201);
    assert.equal((await empty.json()).total, 0);
    const created = await request('', 'POST', { ...input, budget: 1 });
    assert.equal(created.status, 201, 'Incomplete and over-budget drafts are allowed.');
    const saved = await created.json();
    const id = saved.id;
    assert.equal(saved.owner, undefined);
    assert.equal(saved.total, 15000);
    assert.equal(saved.items[0].component.price, 5000);
    assert.equal(saved.items[0].component._id, String(parts[0]._id));
    assert.equal((await request()).status, 200);
    assert.equal((await (await request()).json()).length, 2);
    const countBeforeForeign = mutationCount;
    identity._id = otherOwner;
    assert.deepEqual(await (await request()).json(), []);
    for (const [method, path, body] of [
      ['GET', '/' + id, undefined], ['PUT', '/' + id, input],
      ['PATCH', '/' + id, { name: 'Hijacked' }],
      ['POST', '/' + id + '/duplicate', {}], ['POST', '/' + id + '/reopen', {}]
    ]) assert.equal((await request(path, method, body)).status, 404, method + ' must reject foreign ownership.');
    assert.equal(mutationCount, countBeforeForeign);
    identity._id = owner;
    assert.equal((await request('/bad')).status, 400);
    const sameCategory = await request('', 'POST', { ...base, items: parts.slice(1).map(part => ({ componentId: String(part._id), quantity: 1 })) });
    assert.equal(sameCategory.status, 400);
    const wrongQuantity = await request('', 'POST', { ...base, items: [{ componentId: String(parts[0]._id), quantity: 2 }] });
    assert.equal(wrongQuantity.status, 400);
    const rename = await request('/' + id, 'PATCH', { name: 'Renamed' });
    assert.equal(rename.status, 200);
    assert.equal((await rename.json()).name, 'Renamed');
    assert.equal((await request('/' + id, 'PATCH', { name: 'Fake', owner: otherOwner })).status, 400);
    parts[0].price = 6000;
    parts[0].socket = 'AM5';
    parts[1].archived = true;
    const detail = await (await request('/' + id)).json();
    assert.equal(detail.total, 15000);
    assert.equal(detail.items[0].component.socket, 'AM4');
    const duplicated = await request('/' + id + '/duplicate', 'POST', {});
    assert.equal(duplicated.status, 201);
    const copy = await duplicated.json();
    assert.notEqual(copy.id, id);
    assert.equal(copy.name, 'Renamed (copy)');
    assert.equal(copy.total, 15000);
    assert.equal(copy.items[0].component.price, 5000);
    const reopened = await request('/' + id + '/reopen', 'POST', {});
    assert.equal(reopened.status, 200);
    const reopening = await reopened.json();
    assert.equal(reopening.plan.savedBuildId, id);
    assert.equal(reopening.plan.items.length, 1);
    assert.equal(reopening.plan.items[0].component.price, 6000);
    assert.equal(reopening.plan.items[0].component.socket, 'AM5');
    assert.ok(reopening.notices.some(notice => /current price/.test(notice)));
    assert.ok(reopening.notices.some(notice => /specifications/.test(notice)));
    assert.ok(reopening.notices.some(notice => /archived/.test(notice)));
    assert.equal((await request('/' + id, 'PUT', input)).status, 409, 'Cannot resave an archived catalog part.');
    parts[1].archived = false;
    const updated = await request('/' + id, 'PUT', { ...input, name: 'Updated', budget: 30000 });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).total, 16000);
    assert.equal(records.get(id).owner.toString(), owner.toString());
    assert.equal(records.get(copy.id).total, 15000, 'Updating original leaves duplicate history intact.');
    const snapshot = records.get(id);
    parts[1].stock = 0;
    await assert.rejects(() => resolveCurrentBuild(snapshot, { requireAvailable: true }), error => error.status === 409 && /insufficient stock/.test(error.message));
    const unavailable = await resolveCurrentBuild(snapshot);
    assert.equal(unavailable.items.length, 2);
    assert.ok(unavailable.notices.some(notice => /current stock/.test(notice)));
    parts[1].stock = 10;
    parts[1].availability = 'out of stock';
    await assert.rejects(() => resolveCurrentBuild(snapshot, { requireAvailable: true }), error => error.status === 409 && /out of stock/.test(error.message));
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 0 });
    assert.equal((await request()).status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('reopening an inactive profile chooses an active replacement, while submission rejects it', async t => {
  const oldProfile = identifier();
  const replacement = { _id: identifier(), slug: 'general', label: 'General use', active: true, isDefault: true };
  const build = { profile: oldProfile, items: [] };
  t.mock.method(Component, 'find', () => ({ lean: async () => [] }));
  t.mock.method(AllocationProfile, 'findOne', filter => ({ lean: async () => filter._id ? null : replacement }));
  await assert.rejects(() => resolveCurrentBuild(build, { requireAvailable: true }), error => error.status === 409 && /no longer active/.test(error.message));
  const current = await resolveCurrentBuild(build);
  assert.equal(current.profile.slug, 'general');
  assert.ok(current.notices.some(notice => /General use/.test(notice)));
  t.mock.method(AllocationProfile, 'findOne', () => ({ lean: async () => null }));
  await assert.rejects(() => resolveCurrentBuild(build), error => error.status === 409 && /No active/.test(error.message));
});


