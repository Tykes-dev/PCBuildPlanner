import { CATEGORIES } from '../models/Component.js';
import { badRequest } from './errors.js';

export function allocateBudget(budget, allocations, locks = {}) {
  if (!Number.isSafeInteger(budget) || budget <= 0) throw badRequest('Budget must be a positive whole-peso amount.');
  if (!locks || typeof locks !== 'object' || Array.isArray(locks)) throw badRequest('Locks must be an object.');
  for (const [category, amount] of Object.entries(locks)) {
    if (!CATEGORIES.includes(category) || !Number.isSafeInteger(amount) || amount < 0) throw badRequest('Each lock must name a category and a non-negative whole-peso amount.');
  }
  if (!Array.isArray(allocations) || allocations.length !== 7 || new Set(allocations.map(r => r.category)).size !== 7
    || allocations.some(r => !CATEGORIES.includes(r.category) || !Number.isFinite(r.percent) || r.percent < 0)
    || Math.abs(allocations.reduce((s, r) => s + r.percent, 0) - 100) > 0.000001) throw badRequest('Invalid allocation profile.');
  const lockedSum = Object.values(locks).reduce((s, n) => s + n, 0);
  if (lockedSum > budget) throw badRequest('Locked amounts exceed your budget.');
  const free = allocations.filter(r => !Object.hasOwn(locks, r.category));
  const remaining = budget - lockedSum;
  const weight = free.reduce((s, r) => s + r.percent, 0);
  if (remaining && (!free.length || !weight)) throw badRequest('Unlock a category to allocate the remaining budget.');
  const rows = allocations.map(r => {
    const locked = Object.hasOwn(locks, r.category);
    const exact = locked ? locks[r.category] : weight ? remaining * r.percent / weight : 0;
    return { ...r, locked, allocated: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remainder = budget - rows.reduce((s, r) => s + r.allocated, 0);
  const ranked = rows.filter(r => !r.locked).sort((a, b) => b.fraction - a.fraction || a.priority - b.priority);
  for (const row of ranked) { if (!remainder) break; row.allocated++; remainder--; }
  return rows.map(({ fraction, ...r }) => r).sort((a, b) => a.priority - b.priority);
}
