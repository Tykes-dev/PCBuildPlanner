import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import requestsRoutes from '../routes/requests.js';
import reportingRoutes from '../routes/reporting.js';
import { errorHandler } from '../middleware/errors.js';
import Build from '../models/Build.js';
import BuildRequest from '../models/BuildRequest.js';
import Component from '../models/Component.js';
import AllocationProfile from '../models/AllocationProfile.js';
import CheckSetting from '../models/CheckSetting.js';
import BalancePair from '../models/BalancePair.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { tokenHash } from '../services/auth.js';
import { assembleReport, newRequestInput, statusInput, checkTransition, serializeRequest } from '../services/requests.js';

const id = () => new mongoose.Types.ObjectId();
const same = (a, b) => String(a) === String(b);
const clone = value => structuredClone(value);
test('request inputs reject spoofed snapshots, owners, malformed IDs and unsupported transitions', () => {
  const buildId = String(id());
  assert.deepEqual(newRequestInput({ buildId, note: '  Please review  ' }), { buildId, note: 'Please review' });
  for (const body of [null, [], { buildId: {} }, { buildId: 'bad' }, { buildId, note: 'x'.repeat(1001) },
    { buildId, owner: String(id()) }, { buildId, snapshot: {} }, { buildId, status: 'approved' },
    JSON.parse('{"buildId":"' + buildId + '","__proto__":{}}')]) assert.throws(() => newRequestInput(body), error => error.status === 400);
  for (const body of [{ status: 'unknown' }, { status: 'approved', remarks: {} }, { status: 'completed', remarks: 'x'.repeat(1001) },
    { status: 'approved', expectedStatus: {} }, { status: 'approved', active: false }]) assert.throws(() => statusInput(body), error => error.status === 400);
  for (const [previous, next] of [['pending', 'approved'], ['pending', 'rejected'], ['approved', 'completed']]) checkTransition(previous, next);
  for (const [previous, next] of [['pending', 'completed'], ['approved', 'rejected'], ['completed', 'pending'], ['rejected', 'approved']]) assert.throws(() => checkTransition(previous, next), error => error.status === 409);
});

test('reports preserve zero statuses and request DTOs only reveal customer identity for administrators', () => {
  const empty = assembleReport(0, [], []);
  assert.equal(empty.requestCount, 0);
  assert.deepEqual(empty.statusCounts, { pending: 0, approved: 0, rejected: 0, completed: 0 });
  const report = assembleReport(10, [{ _id: 'pending', count: 2 }, { _id: 'approved', count: 3 }, { _id: 'completed', count: 4 }], [{ selections: 6, units: 12 }]);
  assert.equal(report.requestCount, 9);
  assert.equal(report.activeRequestCount, 5);
  assert.equal(report.statusCounts.rejected, 0);
  const raw = { _id: id(), build: id(), owner: { _id: id(), name: 'Customer', email: 'customer@example.com', passwordHash: 'secret' },
    status: 'pending', snapshot: { name: 'Plan' } };
  assert.equal(serializeRequest(raw).owner, undefined);
  assert.deepEqual(Object.keys(serializeRequest(raw, true).owner).sort(), ['email', 'id', 'name']);
});

test('customer submission validates current builds, preserves snapshots, isolates ownership, and admin transitions feed all-time reports', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
  t.after(() => descriptor ? Object.defineProperty(mongoose.connection, 'readyState', descriptor) : delete mongoose.connection.readyState);
  const customers = [{ _id: id(), role: 'customer', name: 'Customer A', email: 'a@example.com' },
    { _id: id(), role: 'customer', name: 'Customer B', email: 'b@example.com' }];
  const admin = { _id: id(), role: 'admin', name: 'Admin', email: 'admin@example.com' };
  const identities = [customers[0], customers[1], admin];
  const tokens = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
  t.mock.method(Session, 'findOne', filter => ({ lean: async () => {
    const index = tokens.findIndex(token => tokenHash(token) === filter.tokenHash);
    return index < 0 ? null : { user: identities[index]._id };
  } }));
  t.mock.method(User, 'findById', userId => ({ lean: async () => identities.find(user => same(user._id, userId)) || null }));
  const categories = ['cpu', 'motherboard', 'memory', 'gpu', 'storage', 'case', 'psu'];
  const catalog = categories.map(category => ({ _id: id(), name: 'Part ' + category, brand: 'Example', category,
    price: 100, performanceScore: 50, stock: 20, availability: 'in stock', archived: false, powerDraw: category === 'psu' ? 0 : 10,
    ...(category === 'cpu' ? { socket: 'AM4' } : {}),
    ...(category === 'motherboard' ? { socket: 'AM4', memoryType: 'DDR4', formFactor: 'mATX', memorySlots: 4 } : {}),
    ...(category === 'memory' ? { memoryType: 'DDR4', capacityGb: 8 } : {}),
    ...(category === 'storage' ? { capacityGb: 500, storageType: 'NVMe' } : {}),
    ...(category === 'case' ? { supportedFormFactors: ['mATX'] } : {}),
    ...(category === 'psu' ? { wattageRating: 500 } : {}) }));
  const profile = { _id: id(), slug: 'gaming', label: 'Gaming', active: true, minimums: [] };
  const makeBuild = (owner, complete = true) => ({ _id: id(), owner: owner._id, name: 'Saved gaming build', budget: 400, profile: profile._id, profileSlug: profile.slug,
    items: catalog.slice(0, complete ? 7 : 2).map(component => ({ component: component._id, quantity: component.category === 'memory' ? 2 : 1,
      snapshot: { ...component, _id: String(component._id) } })), total: complete ? 800 : 200 });
  const builds = [makeBuild(customers[0]), makeBuild(customers[1]), makeBuild(customers[0], false), makeBuild(customers[0])];
  t.mock.method(Build, 'findOne', filter => ({ lean: async () => builds.find(build => same(build._id, filter._id) && same(build.owner, filter.owner)) || null }));
  t.mock.method(Component, 'find', filter => ({ lean: async () => catalog.filter(component => filter._id.$in.some(value => same(value, component._id))) }));
  t.mock.method(AllocationProfile, 'findOne', filter => ({ lean: async () => profile.active && same(filter._id, profile._id) ? profile : null }));
  t.mock.method(CheckSetting, 'find', () => ({ lean: async () => [] }));
  t.mock.method(BalancePair, 'find', () => ({ lean: async () => [] }));
  const records = [];
  t.mock.method(BuildRequest, 'create', async input => {
    if (records.some(record => record.active && same(record.owner, input.owner) && same(record.build, input.build))) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const document = new BuildRequest(input);
    await document.validate();
    const record = document.toObject();
    record.createdAt = new Date(); record.updatedAt = new Date();
    records.push(record); return document;
  });
  const withOwner = record => ({ ...record, owner: identities.find(user => same(record.owner, user._id)) || null });
  t.mock.method(BuildRequest, 'find', filter => {
    let populate = false, limit = Infinity;
    const query = { populate: () => { populate = true; return query; }, sort: () => query, limit: value => { limit = value; return query; },
      lean: async () => records.filter(record => !filter.owner || same(record.owner, filter.owner)).slice().reverse().slice(0, limit).map(record => populate ? withOwner(record) : record) };
    return query;
  });
  t.mock.method(BuildRequest, 'findById', requestId => ({ lean: async () => {
    const record = records.find(record => same(record._id, requestId));
    return record ? { ...record } : null;
  } }));
  let rejectAtomicUpdate = false;
  t.mock.method(BuildRequest, 'findOneAndUpdate', (filter, update) => ({ populate: () => ({ lean: async () => {
    if (rejectAtomicUpdate) { rejectAtomicUpdate = false; return null; }
    const record = records.find(record => same(record._id, filter._id) && record.status === filter.status);
    if (!record) return null;
    Object.assign(record, update.$set); record.updatedAt = new Date();
    return withOwner(record);
  } }) }));
  t.mock.method(Build, 'countDocuments', filter => { assert.deepEqual(filter, {}); return Promise.resolve(builds.length); });
  t.mock.method(BuildRequest, 'aggregate', pipeline => {
    assert.deepEqual(pipeline, [{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const counts = new Map();
    for (const record of records) counts.set(record.status, (counts.get(record.status) || 0) + 1);
    return Promise.resolve([...counts].map(([status, count]) => ({ _id: status, count })));
  });
  t.mock.method(Build, 'aggregate', pipeline => {
    assert.deepEqual(pipeline[0], { $unwind: '$items' });
    assert.equal(pipeline[1].$group._id, '$items.component');
    assert.deepEqual(pipeline[1].$group.units, { $sum: '$items.quantity' });
    assert.equal(pipeline.find(stage => stage.$limit).$limit, 10);
    const groups = new Map();
    for (const build of builds) for (const item of build.items) {
      const componentId = String(item.component), current = catalog.find(component => same(component._id, item.component));
      const group = groups.get(componentId) || { componentId, name: current?.name || item.snapshot.name,
        brand: current?.brand || item.snapshot.brand, category: current?.category || item.snapshot.category, selections: 0, units: 0 };
      group.selections++; group.units += item.quantity; groups.set(componentId, group);
    }
    return Promise.resolve([...groups.values()].sort((a, b) => b.selections - a.selections || b.units - a.units).slice(0, 10));
  });
  const app = express(); app.use(express.json()); app.use('/api/requests', requestsRoutes); app.use('/api/admin', reportingRoutes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const request = (path, identityIndex, body, method) => fetch(base + path, { method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { ...(identityIndex !== undefined ? { Cookie: 'pcbp_session=' + tokens[identityIndex] } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const submit = (build = builds[0], index = 0, note = '') => request('/requests', index, { buildId: String(build._id), note });
  const status = (requestId, next, expectedStatus, remarks = '') => request('/admin/requests/' + requestId + '/status', 2, { status: next, expectedStatus, remarks }, 'PATCH');
  try {
    for (const path of ['/requests', '/admin/reports', '/admin/requests']) assert.equal((await request(path)).status, 401);
    assert.equal((await request('/admin/reports', 0)).status, 403);
    assert.equal((await request('/requests', 2)).status, 403);
    assert.equal((await submit(builds[1])).status, 404);
    assert.equal((await request('/requests', 0, { buildId: String(builds[0]._id), owner: String(customers[1]._id) })).status, 400);
    const incomplete = await submit(builds[2]);
    assert.equal(incomplete.status, 409);
    assert.equal((await incomplete.json()).validation.missingCategories.length, 5);
    const cpu = catalog[0];
    cpu.availability = 'out of stock'; assert.equal((await submit(builds[3])).status, 409); cpu.availability = 'in stock';
    cpu.archived = true; assert.equal((await submit(builds[3])).status, 409); cpu.archived = false;
    const memory = catalog[2]; memory.stock = 1; assert.equal((await submit(builds[3])).status, 409); memory.stock = 20;
    cpu.socket = 'AM5'; assert.equal((await submit(builds[3])).status, 409); cpu.socket = 'AM4';
    profile.active = false; assert.equal((await submit(builds[3])).status, 409); profile.active = true;
    const removed = catalog.pop(); assert.equal((await submit(builds[3])).status, 409); catalog.push(removed);
    builds[3].items[2].quantity = 8; assert.equal((await submit(builds[3])).status, 409); builds[3].items[2].quantity = 2;
    cpu.price = 250;
    const created = await submit(builds[0], 0, 'Please review.');
    assert.equal(created.status, 201);
    const first = await created.json();
    assert.equal(first.status, 'pending');
    assert.equal(first.snapshot.total, 950);
    assert.ok(first.snapshot.total > first.snapshot.budget);
    assert.equal(first.snapshot.items[0].component.price, 250);
    assert.equal(first.owner, undefined);
    cpu.price = 900;
    assert.equal(records[0].snapshot.items[0].component.price, 250);
    assert.equal((await submit()).status, 409);
    assert.equal((await submit(builds[1], 1, 'Private customer B note.')).status, 201);
    const owned = await (await request('/requests', 0)).json();
    assert.equal(owned.length, 1); assert.equal(owned[0].note, 'Please review.'); assert.equal(owned[0].owner, undefined);
    const reviewed = await (await request('/admin/requests', 2)).json();
    assert.equal(reviewed.length, 2); assert.equal(reviewed.find(record => record.id === first.id).owner.email, customers[0].email);
    assert.equal((await request('/admin/requests/' + first.id + '/status', 0, { status: 'approved' }, 'PATCH')).status, 403);
    assert.equal((await status('invalid', 'approved')).status, 400);
    assert.equal((await status(first.id, 'completed', 'pending')).status, 409);
    const approved = await status(first.id, 'approved', 'pending', 'Looks compatible.');
    assert.equal(approved.status, 200); assert.equal((await approved.json()).remarks, 'Looks compatible.'); assert.equal(records[0].active, true);
    assert.equal((await submit()).status, 409);
    assert.equal((await status(first.id, 'completed', 'pending')).status, 409);
    assert.equal((await status(first.id, 'rejected', 'approved')).status, 409);
    assert.equal((await status(first.id, 'completed', 'approved', 'Build fulfilled.')).status, 200);
    assert.equal(records[0].active, false);
    assert.equal((await status(first.id, 'approved', 'completed')).status, 409);
    const resubmitted = await submit(); assert.equal(resubmitted.status, 201);
    const next = await resubmitted.json();
    rejectAtomicUpdate = true;
    assert.equal((await status(next.id, 'approved', 'pending')).status, 409);
    assert.equal(records[2].status, 'pending');
    assert.equal((await status(next.id, 'rejected', 'pending', 'Choose another part.')).status, 200);
    assert.equal(records[2].active, false);
    assert.equal((await status(next.id, 'approved', 'rejected')).status, 409);
    // Reports include every request while the review queue deliberately shows the latest 200.
    for (let index = 0; index < 250; index++) records.push({ ...records[0], _id: id(), status: 'completed', active: false });
    const reportResponse = await request('/admin/reports', 2); assert.equal(reportResponse.status, 200);
    const report = await reportResponse.json();
    assert.equal(report.savedBuildCount, 4); assert.equal(report.requestCount, 253);
    assert.deepEqual(report.statusCounts, { pending: 1, approved: 0, rejected: 1, completed: 251 });
    assert.equal(report.activeRequestCount, 1);
    const memoryRow = report.commonComponents.find(row => row.category === 'memory');
    assert.equal(memoryRow.selections, 3); assert.equal(memoryRow.units, 6);
    assert.equal((await (await request('/admin/requests', 2)).json()).length, 200);
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 0 });
    assert.equal((await request('/admin/reports', 2)).status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

