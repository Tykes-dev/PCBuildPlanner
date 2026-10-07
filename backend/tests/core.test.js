import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateBudget } from '../services/allocation.js';
import { calculatePower, validateBuild } from '../services/compatibility.js';
import { recommendBuild } from '../services/recommend.js';
import { components, profiles, settings, pairs } from '../data/catalog.js';
import app from '../app.js';
const gaming = profiles[0];
const fixture = ['Ryzen 5 5600', 'B450M Pro-VDH Max', 'Fury Beast 16GB DDR4', 'GeForce RTX 3050 8GB', 'NV2 500GB', 'DLM21 Mesh', 'MWE 450 Bronze V2'].map(name => ({ component: components.find(c => c.name === name), quantity: 1 }));

test('allocation rounding preserves every peso for odd budgets and locks', () => {
  for (const budget of [1, 123, 10001, 50003, 99999]) {
    const rows = allocateBudget(budget, gaming.allocations);
    assert.equal(rows.reduce((s, r) => s + r.allocated, 0), budget);
  }
  const rows = allocateBudget(50003, gaming.allocations, { gpu: 25000, cpu: 10000 });
  assert.equal(rows.find(r => r.category === 'gpu').allocated, 25000);
  assert.equal(rows.reduce((s, r) => s + r.allocated, 0), 50003);
});
test('rejects oversubscribed locks, unassigned budget, negative and fractional budgets', () => {
  assert.throws(() => allocateBudget(100, gaming.allocations, { gpu: 101 }), /exceed/);
  assert.throws(() => allocateBudget(100, gaming.allocations, Object.fromEntries(gaming.allocations.map(r => [r.category, 0]))), /Unlock/);
  for (const budget of [-1, 0, 2.5, NaN]) assert.throws(() => allocateBudget(budget, gaming.allocations));
});
test('validates a complete build and detects all four hard mismatches', () => {
  assert.equal(validateBuild(fixture, settings, [], gaming).valid, true);
  const broken = fixture.map(i => ({ component: { ...i.component }, quantity: i.quantity }));
  broken.find(i => i.component.category === 'cpu').component.socket = 'AM5';
  broken.find(i => i.component.category === 'memory').component.memoryType = 'DDR5';
  broken.find(i => i.component.category === 'case').component.supportedFormFactors = ['ITX'];
  broken.find(i => i.component.category === 'psu').component.wattageRating = 100;
  const result = validateBuild(broken, settings);
  assert.deepEqual(result.issues.map(i => i.code).sort(), ['CPU_SOCKET_MATCH', 'MEMORY_TYPE_MATCH', 'CASE_FITS_BOARD', 'PSU_WATTAGE_HEADROOM'].sort());
  assert.equal(result.valid, false);
});
test('quantity affects totals and power, and motherboard slots are enforced', () => {
  const items = fixture.map(i => ({ ...i, quantity: i.component.category === 'memory' ? 2 : 1 }));
  const result = validateBuild(items, settings);
  assert.equal(result.total, validateBuild(fixture, settings).total + 2400);
  assert.equal(result.power.totalDraw, calculatePower(fixture).totalDraw + 8);
  items.find(i => i.component.category === 'memory').quantity = 5;
  assert.ok(validateBuild(items, settings).issues.some(i => i.code === 'MEMORY_SLOT_CAPACITY'));
});
test('changed safety margin applies immediately and cannot disable physical checks', () => {
  const items = fixture.map(i => ({ component: { ...i.component }, quantity: 1 }));
  items.find(i => i.component.category === 'psu').component.wattageRating = 330;
  const low = settings.map(s => s.code === 'PSU_WATTAGE_HEADROOM' ? { ...s, marginPercent: 30 } : s);
  const high = settings.map(s => s.code === 'PSU_WATTAGE_HEADROOM' ? { ...s, marginPercent: 50, active: false } : s);
  assert.equal(validateBuild(items, low).valid, true);
  assert.equal(validateBuild(items, high).valid, false);
});
test('warnings and profile minimum notes do not block a complete build', () => {
  const result = validateBuild(fixture, settings, [{ categoryA: 'cpu', categoryB: 'gpu', maxGap: 1, active: true }], profiles[2]);
  assert.equal(result.valid, true);
  assert.ok(result.issues.some(i => i.severity === 'warning'));
  assert.ok(result.issues.some(i => i.severity === 'note'));
});
test('missing categories, duplicates, and invalid quantities are handled', () => {
  assert.equal(validateBuild([], settings).missingCategories.length, 7);
  assert.throws(() => validateBuild([...fixture, fixture[0]], settings), /one component/);
  assert.throws(() => validateBuild([{ ...fixture[0], quantity: 2 }], settings), /Only memory/);
  assert.throws(() => validateBuild([{ ...fixture[2], quantity: 0 }], settings), /quantity/);
});
test('recommendations are complete, compatible and within budget across profiles', () => {
  for (const profile of profiles) for (const budget of [30000, 50000, 100000]) {
    const result = recommendBuild({ budget, profile, components, settings, pairs });
    if (result.feasible) {
      assert.equal(result.items.length, 7);
      assert.equal(result.validation.valid, true);
      assert.ok(result.validation.total <= budget);
      for (const minimum of profile.minimums) assert.ok(result.items.find(i => i.component.category === minimum.category).component.capacityGb >= minimum.value);
    } else assert.ok(result.minimumBudget === null || result.minimumBudget > budget);
  }
});
test('recommendation handles insufficient budget and unavailable platforms', () => {
  const cheap = recommendBuild({ budget: 1000, profile: gaming, components, settings });
  assert.equal(cheap.feasible, false); assert.ok(cheap.minimumBudget > 1000);
  const unavailable = components.map(c => ({ ...c, archived: c.category === 'motherboard' }));
  const result = recommendBuild({ budget: 100000, profile: gaming, components: unavailable, settings });
  assert.equal(result.feasible, false); assert.equal(result.minimumBudget, null);
});
test('API reports unavailable database, JSON not-found, and malformed input', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/api/health`); assert.equal(health.status, 503);
    const missing = await fetch(`${base}/not-a-route`); assert.equal(missing.status, 404); assert.equal((await missing.json()).message, 'Endpoint not found');
    const data = await fetch(`${base}/api/components`); assert.equal(data.status, 503);
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
      const response = await fetch(`${base}/api/components`, { headers: { Origin: origin } });
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
    }
    const blocked = await fetch(`${base}/api/components`, { headers: { Origin: 'https://unrelated.example' } });
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
    const malformed = await fetch(`${base}/api/validations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }); assert.equal(malformed.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
