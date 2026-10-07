import { allocateBudget } from './allocation.js';
import { validateBuild } from './compatibility.js';

const idOf = c => String(c._id ?? c.id);
const cheapest = (a, b) => a.price - b.price || idOf(a).localeCompare(idOf(b));

export function recommendBuild({ budget, profile, components, settings = [], pairs = [], locks = {} }) {
  const allocations = allocateBudget(budget, profile.allocations, locks);
  const caps = Object.fromEntries(allocations.map(r => [r.category, r.allocated]));
  const minimums = profile.minimums ?? [];
  const eligible = category => components.filter(c => c.category === category && !c.archived && c.availability !== 'out of stock'
    && minimums.filter(m => m.category === category).every(m => c[m.field] >= m.value)).sort(cheapest);
  const margin = settings.find(s => s.code === 'PSU_WATTAGE_HEADROOM')?.marginPercent ?? 30;
  let best = null;
  let minimumCost = Infinity;
  // Search CPU/board platforms, then a GPU. Cheapest compatible remaining parts
  // give a feasibility baseline before optional upgrades use the leftover budget.
  for (const cpu of eligible('cpu')) for (const motherboard of eligible('motherboard').filter(m => m.socket === cpu.socket)) {
    const memory = eligible('memory').find(m => m.memoryType === motherboard.memoryType);
    const storage = eligible('storage')[0];
    const pcCase = eligible('case').find(c => c.supportedFormFactors.includes(motherboard.formFactor));
    if (!memory || !storage || !pcCase) continue;
    for (const gpu of eligible('gpu')) {
      const picked = { cpu, motherboard, memory, gpu, storage, case: pcCase };
      const draw = Object.values(picked).reduce((s, p) => s + p.powerDraw, 0);
      const psu = eligible('psu').find(p => p.wattageRating >= Math.ceil(draw * (1 + margin / 100)));
      if (!psu) continue;
      picked.psu = psu;
      const total = Object.values(picked).reduce((s, p) => s + p.price, 0);
      minimumCost = Math.min(minimumCost, total);
      if (total > budget) continue;
      const fit = Object.values(picked).reduce((s, p) => s + Math.max(0, p.price - caps[p.category]), 0);
      const score = allocations.reduce((s, r) => s + picked[r.category].performanceScore * (8 - r.priority), 0);
      if (!best || fit < best.fit || (fit === best.fit && score > best.score)) best = { picked, total, fit, score };
    }
  }
  if (!best) return { feasible: false, items: [], allocations, minimumBudget: Number.isFinite(minimumCost) ? minimumCost : null,
    message: Number.isFinite(minimumCost) ? `The least expensive complete build meeting this profile costs ₱${minimumCost.toLocaleString('en-PH')}.` : 'The available catalog cannot form a complete compatible build meeting this profile.' };
  // Upgrade independent categories in business priority order. CPU and board
  // remain the selected platform; every trial is revalidated, including PSU draw.
  for (const row of allocations.filter(r => !['cpu', 'motherboard', 'psu'].includes(r.category))) {
    const candidates = eligible(row.category).filter(c => c.performanceScore > best.picked[row.category].performanceScore)
      .sort((a, b) => b.performanceScore - a.performanceScore || cheapest(a, b));
    for (const candidate of candidates) {
      const trial = { ...best.picked, [row.category]: candidate };
      const draw = Object.values(trial).reduce((s, p) => s + p.powerDraw, 0);
      trial.psu = eligible('psu').find(p => p.wattageRating >= Math.ceil(draw * (1 + margin / 100)));
      if (!trial.psu) continue;
      const items = Object.values(trial).map(component => ({ component, quantity: 1 }));
      const validation = validateBuild(items, settings, pairs, profile);
      if (validation.valid && validation.total <= budget) { best.picked = trial; break; }
    }
  }
  const items = Object.values(best.picked).map(component => ({ component, quantity: 1 }));
  const validation = validateBuild(items, settings, pairs, profile);
  return { feasible: true, items, allocations, validation, remaining: budget - validation.total,
    message: 'A compatible build within your total budget. Category allocations are targets; leftover money is used by priority.' };
}
