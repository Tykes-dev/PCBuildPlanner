import { CATEGORIES, CATEGORY_LABELS } from '../models/Component.js';
import { badRequest } from './errors.js';

export function normalizeItems(items) {
  if (!Array.isArray(items)) throw badRequest('Items must be an array.');
  const seen = new Set();
  return items.map(item => {
    const component = item.component;
    const quantity = item.quantity ?? 1;
    if (!component || !CATEGORIES.includes(component.category) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 32) throw badRequest('Each item needs a valid component and quantity from 1 to 32.');
    if (seen.has(component.category)) throw badRequest('Use one component row per category; increase quantity for identical memory or storage.');
    if (!['memory', 'storage'].includes(component.category) && quantity !== 1) throw badRequest('Only memory and storage support multiple quantities.');
    seen.add(component.category);
    return { component, quantity };
  });
}

export function calculatePower(items, marginPercent = 30) {
  if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 100) throw badRequest('Power margin must be between 0 and 100.');
  const normalized = normalizeItems(items);
  const totalDraw = normalized.reduce((s, i) => s + i.component.powerDraw * i.quantity, 0);
  const requiredWattage = Math.ceil(totalDraw * (1 + marginPercent / 100));
  const supplyRating = normalized.find(i => i.component.category === 'psu')?.component.wattageRating ?? null;
  return { totalDraw, marginPercent, requiredWattage, supplyRating, sufficient: supplyRating !== null && supplyRating >= requiredWattage };
}

export function checkCpuSocket(cpu, motherboard) { return !cpu || !motherboard || cpu.socket === motherboard.socket; }
export function checkMemoryType(memory, motherboard) { return !memory || !motherboard || memory.memoryType === motherboard.memoryType; }
export function checkCaseFitsBoard(pcCase, motherboard) { return !pcCase || !motherboard || pcCase.supportedFormFactors.includes(motherboard.formFactor); }
export function checkPsuHeadroom(power) { return power.supplyRating === null || power.sufficient; }

export function validateBuild(items, settings = [], pairs = [], profile = null) {
  const normalized = normalizeItems(items);
  const parts = Object.fromEntries(normalized.map(i => [i.component.category, i.component]));
  const margin = settings.find(s => s.code === 'PSU_WATTAGE_HEADROOM')?.marginPercent ?? 30;
  const power = calculatePower(normalized, margin);
  const issues = [];
  const add = (code, severity, categories, fallback, detail = '') => issues.push({ code, severity, categories,
    message: [settings.find(s => s.code === code)?.message || fallback, detail].filter(Boolean).join(' ') });
  if (!checkCpuSocket(parts.cpu, parts.motherboard)) add('CPU_SOCKET_MATCH', 'error', ['cpu', 'motherboard'], 'Processor and motherboard sockets do not match.');
  if (!checkMemoryType(parts.memory, parts.motherboard)) add('MEMORY_TYPE_MATCH', 'error', ['memory', 'motherboard'], 'Memory type does not match the motherboard.');
  if (!checkCaseFitsBoard(parts.case, parts.motherboard)) add('CASE_FITS_BOARD', 'error', ['case', 'motherboard'], 'The case cannot fit this motherboard.');
  // The configured message explains the rule; the numbers explain this build.
  if (!checkPsuHeadroom(power)) add('PSU_WATTAGE_HEADROOM', 'error', ['psu'],
    'The power supply must cover the total draw plus the safety margin.',
    `This build draws ${power.totalDraw}W, so it needs ${power.requiredWattage}W with ${power.marginPercent}% headroom. The chosen power supply provides ${power.supplyRating}W.`);
  // Hard checks always run, even if a stale database record says active:false.
  const memoryQuantity = normalized.find(i => i.component.category === 'memory')?.quantity ?? 0;
  if (parts.motherboard && memoryQuantity > parts.motherboard.memorySlots) add('MEMORY_SLOT_CAPACITY', 'error', ['memory', 'motherboard'], 'The memory quantity exceeds available motherboard slots.');
  for (const pair of pairs.filter(p => p.active)) {
    const a = parts[pair.categoryA], b = parts[pair.categoryB];
    if (a && b && Math.abs(a.performanceScore - b.performanceScore) > pair.maxGap) {
      // Naming the weaker part tells the customer what to change. The raw gap
      // alone does not, and the category keys mean nothing outside the code.
      const aStronger = a.performanceScore >= b.performanceScore;
      const strong = CATEGORY_LABELS[aStronger ? pair.categoryA : pair.categoryB];
      const weak = CATEGORY_LABELS[aStronger ? pair.categoryB : pair.categoryA];
      const gap = Math.abs(a.performanceScore - b.performanceScore);
      issues.push({ code: 'PERFORMANCE_BALANCE', severity: 'warning', categories: [pair.categoryA, pair.categoryB],
        message: `Your ${strong} is much stronger than your ${weak}, so the ${weak} may hold this build back. Consider a better ${weak}, or spend less on the ${strong}. (Scores differ by ${gap}; this shop flags anything over ${pair.maxGap}. This is a rough guide, not a benchmark.)` });
    }
  }
  for (const minimum of profile?.minimums ?? []) {
    const item = normalized.find(i => i.component.category === minimum.category);
    if (item && item.component[minimum.field] * item.quantity < minimum.value) issues.push({ code: 'PROFILE_MINIMUM', severity: 'note', categories: [minimum.category],
      message: `${profile.label} builds usually have at least ${minimum.value}GB of ${CATEGORY_LABELS[minimum.category]}. You can still save and submit this build.` });
  }
  const missingCategories = CATEGORIES.filter(c => !parts[c]);
  return { valid: !missingCategories.length && !issues.some(i => i.severity === 'error'), missingCategories, issues, power,
    total: normalized.reduce((s, i) => s + i.component.price * i.quantity, 0) };
}