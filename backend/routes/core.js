import { requireUser } from '../middleware/auth.js';
import { Router } from 'express';
import mongoose from 'mongoose';
import Component, { CATEGORIES } from '../models/Component.js';
import AllocationProfile from '../models/AllocationProfile.js';
import CheckSetting from '../models/CheckSetting.js';
import BalancePair from '../models/BalancePair.js';
import { badRequest } from '../services/errors.js';
import { allocateBudget } from '../services/allocation.js';
import { validateBuild } from '../services/compatibility.js';
import { recommendBuild } from '../services/recommend.js';
import { evaluateComponentOptions } from '../services/componentOptions.js';
import { withSampleImage } from '../data/componentImages.js';

const router = Router();
// The catalog is public. Everything else here reads configuration or runs the
// planning engine: no writes, nothing owned. Any signed-in account may use it,
// because administrators plan builds too when answering an inquiry.
router.use((req, res, next) => {
  if (req.method === 'GET' && /^\/components(?:\/[^/]+)?\/?$/.test(req.path)) return next();
  return requireUser(req, res, next);
});
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'Database unavailable. Configure MongoDB Atlas and run the seed command.' });
  next();
});
const loadProfile = async slug => {
  if (typeof slug !== 'string') throw badRequest('Choose a profile.');
  const profile = await AllocationProfile.findOne({ slug, active: true }).lean();
  if (!profile) { const error = new Error('Profile not found'); error.status = 404; throw error; }
  return profile;
};
const configuration = async () => {
  const [settings, pairs] = await Promise.all([CheckSetting.find().lean(), BalancePair.find({ active: true }).lean()]);
  return { settings, pairs };
};
async function resolveItems(input) {
  if (!Array.isArray(input) || input.length > 7) throw badRequest('Provide up to seven item rows.');
  for (const item of input) if (!item || typeof item.componentId !== 'string' || !mongoose.isObjectIdOrHexString(item.componentId)) throw badRequest('Invalid component ID.');
  const records = await Component.find({ _id: { $in: input.map(i => i.componentId) } }).lean();
  return input.map(item => {
    const component = records.find(c => String(c._id) === item.componentId);
    if (!component) { const error = new Error('Component not found'); error.status = 404; throw error; }
    return { component, quantity: item.quantity ?? 1 };
  });
}
router.get('/components', async (req, res) => {
  const { category, q } = req.query;
  const filter = { archived: false };
  if (category !== undefined) {
    if (!CATEGORIES.includes(category)) throw badRequest('Invalid category.');
    filter.category = category;
  }
  if (q !== undefined) {
    if (typeof q !== 'string' || q.length > 100) throw badRequest('Search must be text up to 100 characters.');
    const search = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: search, $options: 'i' } }, { brand: { $regex: search, $options: 'i' } }];
  }
  res.json((await Component.find(filter).sort({ category: 1, price: 1 }).lean()).map(withSampleImage));
});
router.get('/components/:id', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw badRequest('Invalid component ID.');
  const component = await Component.findOne({ _id: req.params.id, archived: false }).lean();
  if (!component) return res.status(404).json({ message: 'Component not found' });
  res.json(withSampleImage(component));
});
router.get('/profiles', async (req, res) => res.json(await AllocationProfile.find({ active: true }).lean()));
router.get('/profiles/:slug', async (req, res) => res.json(await loadProfile(req.params.slug)));
// A custom split lets the shop answer a customer no use case covers, without
// pretending they fit one. allocateBudget checks the categories and the total;
// the priorities are checked here because only this route accepts them.
function customSplit(allocations) {
  if (allocations === undefined) return null;
  if (!Array.isArray(allocations) || allocations.length !== CATEGORIES.length) throw badRequest('Provide one share for each of the seven categories.');
  const priorities = new Set();
  for (const row of allocations) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw badRequest('Each share needs a category, a percentage and a priority.');
    if (!Number.isSafeInteger(row.priority) || row.priority < 1 || row.priority > CATEGORIES.length || priorities.has(row.priority)) {
      throw badRequest('Use each priority from 1 to 7 exactly once.');
    }
    priorities.add(row.priority);
  }
  return allocations.map(row => ({ category: row.category, percent: row.percent, priority: row.priority }));
}

router.post('/allocations', async (req, res) => {
  const custom = customSplit(req.body.allocations);
  const allocations = custom ?? (await loadProfile(req.body.profileSlug)).allocations;
  res.json(allocateBudget(req.body.budget, allocations, req.body.locks ?? {}));
});
router.post('/recommendations', async (req, res) => {
  const profile = await loadProfile(req.body.profileSlug);
  const [components, config] = await Promise.all([Component.find({ archived: false, availability: { $ne: 'out of stock' } }).lean(), configuration()]);
  res.json(recommendBuild({ budget: req.body.budget, profile, components: components.map(withSampleImage), ...config, locks: req.body.locks ?? {} }));
});
async function evaluate(req) {
  const [items, config, profile] = await Promise.all([resolveItems(req.body.items), configuration(), req.body.profileSlug ? loadProfile(req.body.profileSlug) : null]);
  return validateBuild(items, config.settings, config.pairs, profile);
}
router.post('/validations', async (req, res) => res.json(await evaluate(req)));
router.post('/power-calculations', async (req, res) => res.json((await evaluate(req)).power));
router.post('/balance-assessments', async (req, res) => res.json({ issues: (await evaluate(req)).issues.filter(i => i.severity === 'warning') }));
router.post('/component-options', async (req, res) => {
  const [items, components, config] = await Promise.all([
    resolveItems(req.body.items), Component.find({ archived: false }).lean(), configuration()
  ]);
  res.json(evaluateComponentOptions(components, items, config.settings));
});
export default router;