import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateComponentOptions } from '../services/componentOptions.js';
import { components, settings } from '../data/catalog.js';
const part = name => components.find(c => c.name === name);
const item = name => ({ component: part(name), quantity: 1 });
const option = (options, name) => options.find(o => o.componentId === part(name).id);

test('processor selection disables boards with the wrong socket, in both directions', () => {
  const cpuFirst = evaluateComponentOptions(components, [item('Ryzen 5 5600')], settings);
  assert.equal(option(cpuFirst, 'B450M Pro-VDH Max').compatible, true);
  assert.equal(option(cpuFirst, 'B650M DS3H').compatible, false);
  assert.match(option(cpuFirst, 'B650M DS3H').reasons[0], /AM4/);
  const boardFirst = evaluateComponentOptions(components, [item('B650M DS3H')], settings);
  assert.equal(option(boardFirst, 'Ryzen 5 5600').compatible, false);
  assert.equal(option(boardFirst, 'Ryzen 5 7600').compatible, true);
});
test('memory type and case size are checked before selection, including motherboard replacement', () => {
  const boardFirst = evaluateComponentOptions(components, [item('B650M DS3H')], settings);
  assert.equal(option(boardFirst, 'Fury Beast 16GB DDR4').compatible, false);
  assert.equal(option(boardFirst, 'Vengeance 32GB DDR5').compatible, true);
  const caseFirst = evaluateComponentOptions(components, [item('DLM21 Mesh')], settings);
  assert.equal(option(caseFirst, 'TUF Gaming B550-Plus').compatible, false);
  assert.equal(option(caseFirst, 'B450M Pro-VDH Max').compatible, true);
  const memoryFirst = evaluateComponentOptions(components, [item('Fury Beast 16GB DDR4')], settings);
  assert.equal(option(memoryFirst, 'B650M DS3H').compatible, false);
});
test('GPU replacements account for actual power with the configured margin', () => {
  const items = ['Ryzen 5 5600', 'B450M Pro-VDH Max', 'Fury Beast 16GB DDR4', 'GeForce RTX 3050 8GB', 'NV2 500GB', 'DLM21 Mesh', 'MWE 450 Bronze V2'].map(item);
  const result = evaluateComponentOptions(components, items, settings);
  assert.equal(option(result, 'GeForce RTX 4060 8GB').compatible, true);
  assert.equal(option(result, 'Radeon RX 7800 XT').compatible, false);
  assert.match(option(result, 'Radeon RX 7800 XT').reasons[0], /headroom/);
  const stricter = settings.map(s => s.code === 'PSU_WATTAGE_HEADROOM' ? { ...s, marginPercent: 100 } : s);
  const changed = evaluateComponentOptions(components, items, stricter);
  assert.equal(option(changed, 'MWE 450 Bronze V2').compatible, false);
  assert.equal(option(changed, 'MAG A650BN').compatible, true);
});
test('empty categories remain selectable and unrelated errors do not block corrective choices', () => {
  assert.ok(evaluateComponentOptions(components, [], settings).every(o => o.compatible));
  const conflicting = [item('B450M Pro-VDH Max'), item('Vengeance 32GB DDR5')];
  const result = evaluateComponentOptions(components, conflicting, settings);
  assert.equal(option(result, 'Ryzen 5 5600').compatible, true);
  assert.equal(option(result, 'Fury Beast 16GB DDR4').compatible, true);
});
test('availability is separate from compatibility and archived parts are omitted', () => {
  const catalog = components.map(c => ({ ...c, availability: c.category === 'cpu' ? 'out of stock' : c.availability, archived: c.category === 'gpu' }));
  const result = evaluateComponentOptions(catalog, [], settings);
  assert.equal(option(result, 'Ryzen 5 5600').compatible, true);
  assert.equal(option(result, 'Ryzen 5 5600').available, false);
  assert.equal(option(result, 'GeForce RTX 3050 8GB'), undefined);
});
test('memory quantities are retained when evaluating motherboard replacements', () => {
  const board = { ...part('B450M Pro-VDH Max'), memorySlots: 2 };
  const result = evaluateComponentOptions([board], [{ ...item('Fury Beast 16GB DDR4'), quantity: 3 }], settings);
  assert.equal(result[0].compatible, false);
  assert.match(result[0].reasons[0], /2 slots/);
});
