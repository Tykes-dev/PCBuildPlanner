import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../app.js';
import Component from '../models/Component.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { tokenHash } from '../services/auth.js';
import { componentInput } from '../services/componentInput.js';

const base = { name: 'New part', brand: 'Example', price: 5000, performanceScore: 50 };
const specifications = {
  cpu: { socket: 'AM4' },
  motherboard: { socket: 'AM5', memoryType: 'DDR5', formFactor: 'mATX', memorySlots: 4 },
  memory: { memoryType: 'DDR4', capacityGb: 16 },
  gpu: {},
  storage: { storageType: 'NVMe', capacityGb: 1000 },
  case: { supportedFormFactors: ['ATX', 'mATX', 'ITX'] },
  psu: { wattageRating: 650 }
};
const input = category => ({ ...base, category, ...specifications[category] });
const fieldError = (body, field) => assert.throws(() => componentInput(body), error => error.status === 400 && Boolean(error.fields?.[field]));

test('each component category requires its own compatibility fields and validates against the model', async () => {
  for (const [category, specs] of Object.entries(specifications)) {
    const clean = componentInput(input(category));
    await new Component(clean).validate();
    assert.equal(clean.archived, false);
    assert.equal(clean.stock, 0);
    assert.equal(clean.availability, 'not tracked');
    assert.equal(clean.powerDraw, 0);
    for (const field of Object.keys(specs)) {
      const missing = input(category);
      delete missing[field];
      fieldError(missing, field);
    }
  }
});

test('numeric fields reject coercion, nonfinite values and unsafe counts', () => {
  for (const value of ['5000', null, true, {}, [], NaN, Infinity, -1]) fieldError({ ...input('cpu'), price: value }, 'price');
  for (const value of [101, -1, '50', NaN]) fieldError({ ...input('cpu'), performanceScore: value }, 'performanceScore');
  for (const value of [1.5, -1, '2', Number.MAX_SAFE_INTEGER + 1]) fieldError({ ...input('cpu'), stock: value }, 'stock');
  fieldError({ ...input('cpu'), powerDraw: -1 }, 'powerDraw');
  fieldError({ ...input('motherboard'), memorySlots: 1.5 }, 'memorySlots');
  fieldError({ ...input('memory'), capacityGb: 0 }, 'capacityGb');
  fieldError({ ...input('psu'), wattageRating: Infinity }, 'wattageRating');
  assert.equal(componentInput({ ...input('gpu'), price: 0, performanceScore: 100, stock: 0 }).price, 0);
});

test('input has an allowlist, preserves only relevant specs, and rejects invalid enums', () => {
  const clean = componentInput({ ...input('cpu'), memoryType: 'DDR5', memorySlots: 4, formFactor: 'ATX' });
  assert.equal(clean.memoryType, undefined);
  assert.equal(clean.memorySlots, undefined);
  assert.equal(clean.formFactor, undefined);
  for (const field of ['archived', '_id', 'createdAt', 'role', '$set']) fieldError({ ...input('cpu'), [field]: true }, field);
  fieldError(JSON.parse('{"name":"Example","brand":"Example","category":"gpu","price":100,"performanceScore":50,"__proto__":{}}'), '__proto__');
  for (const category of ['__proto__', 'toString', {}, 'CPU']) fieldError({ ...input('cpu'), category }, 'category');
  fieldError({ ...input('cpu'), socket: 'AM6' }, 'socket');
  fieldError({ ...input('storage'), storageType: 'SSD' }, 'storageType');
  fieldError({ ...input('memory'), memoryType: 'DDR3' }, 'memoryType');
  fieldError({ ...input('case'), supportedFormFactors: [] }, 'supportedFormFactors');
  fieldError({ ...input('case'), supportedFormFactors: ['ATX', 'ATX'] }, 'supportedFormFactors');
  fieldError({ ...input('case'), supportedFormFactors: ['EATX'] }, 'supportedFormFactors');
  fieldError({ ...input('cpu'), availability: 'available' }, 'availability');
});

test('text and image fields trim safely and reject malformed values', () => {
  const clean = componentInput({ ...input('gpu'), name: '  New part  ', brand: ' Example ', imageUrl: ' https://example.com/part.jpg ' });
  assert.equal(clean.name, 'New part');
  assert.equal(clean.brand, 'Example');
  assert.equal(clean.imageUrl, 'https://example.com/part.jpg');
  assert.equal(componentInput({ ...input('gpu'), imageUrl: '/images/components/part.jpg' }).imageUrl, '/images/components/part.jpg');
  fieldError({ ...input('gpu'), name: ' ' }, 'name');
  fieldError({ ...input('gpu'), name: 'a'.repeat(121) }, 'name');
  fieldError({ ...input('gpu'), brand: {} }, 'brand');
  fieldError({ ...input('gpu'), imageCaption: 'a'.repeat(201) }, 'imageCaption');
  for (const imageUrl of ['http://example.com/part.jpg', 'javascript:alert(1)', 'https://', 'https://user:secret@example.com/part.jpg', '/images/components/../part.jpg']) fieldError({ ...input('gpu'), imageUrl }, 'imageUrl');
  for (const imageSource of ['http://example.com/part', 'javascript:alert(1)', 'https://', 'https://user:secret@example.com/part']) fieldError({ ...input('gpu'), imageSource }, 'imageSource');
  assert.equal(componentInput({ ...input('gpu'), imageSource: ' https://example.com/source ' }).imageSource, 'https://example.com/source');
  for (const body of [null, false, 'component', []]) assert.throws(() => componentInput(body), error => error.status === 400);
});

test('admin component endpoint enforces authorization, reports field errors, creates catalog entries, and handles duplicates', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
  t.after(() => {
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor);
    else delete mongoose.connection.readyState;
  });
  const token = 'a'.repeat(64);
  const identity = { _id: new mongoose.Types.ObjectId(), role: 'customer', name: 'Account' };
  const records = [];
  t.mock.method(Session, 'findOne', filter => ({ lean: async () => filter.tokenHash === tokenHash(token) ? { user: identity._id, expiresAt: new Date(Date.now() + 60000) } : null }));
  t.mock.method(User, 'findById', () => ({ lean: async () => identity }));
  t.mock.method(Component, 'create', async body => {
    if (records.some(part => part.name === body.name && part.brand === body.brand)) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const component = new Component(body);
    await component.validate();
    records.push(component);
    return component;
  });
  t.mock.method(Component, 'find', () => ({ sort: () => ({ lean: async () => records.map(part => part.toJSON()) }) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const api = 'http://127.0.0.1:' + server.address().port + '/api';
  const request = (body, authenticated = true) => fetch(api + '/admin/components', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: 'pcbp_session=' + token } : {}) }, body: JSON.stringify(body)
  });
  try {
    assert.equal((await request(input('cpu'), false)).status, 401);
    assert.equal((await request(input('cpu'))).status, 403);
    assert.equal(records.length, 0);
    identity.role = 'admin';
    const invalid = await request({ ...input('cpu'), price: '5000', archived: true });
    assert.equal(invalid.status, 400);
    const invalidBody = await invalid.json();
    assert.ok(invalidBody.fields.price);
    assert.ok(invalidBody.fields.archived);
    assert.equal(records.length, 0);
    const created = await request({ ...input('cpu'), name: 'Ryzen 5 5600', brand: 'AMD', stock: 3, availability: 'in stock' });
    assert.equal(created.status, 201);
    const component = await created.json();
    assert.ok(mongoose.isObjectIdOrHexString(component._id));
    assert.equal(component.archived, false);
    assert.equal(component.stock, 3);
    assert.equal(component.availability, 'in stock');
    assert.equal(component.socket, 'AM4');
    assert.ok(component.imageUrl.startsWith('https://'));
    const catalog = await fetch(api + '/components');
    assert.equal(catalog.status, 200);
    assert.equal((await catalog.json())[0]._id, component._id);
    const duplicate = await request({ ...input('cpu'), name: 'Ryzen 5 5600', brand: 'AMD' });
    assert.equal(duplicate.status, 409);
    assert.match((await duplicate.json()).message, /brand and name already exists/);
    assert.equal(records.length, 1);
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 0 });
    assert.equal((await request(input('gpu'))).status, 503);
    assert.equal(records.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

