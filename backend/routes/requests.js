import { Router } from 'express';
import BuildRequest from '../models/BuildRequest.js';
import { CATEGORY_LABELS } from '../models/Component.js';
import CheckSetting from '../models/CheckSetting.js';
import BalancePair from '../models/BalancePair.js';
import { requireCustomer, databaseReady } from '../middleware/auth.js';
import { getOwnedBuild, resolveCurrentBuild, snapshotComponent } from '../services/builds.js';
import { validateBuild } from '../services/compatibility.js';
import { newRequestInput, serializeRequest } from '../services/requests.js';

const router = Router();
router.use(requireCustomer, databaseReady);
router.get('/', async (req, res) => {
  const requests = await BuildRequest.find({ owner: req.user._id }).sort({ createdAt: -1, _id: -1 }).limit(200).lean();
  res.json(requests.map(request => serializeRequest(request)));
});
router.post('/', async (req, res) => {
  const input = newRequestInput(req.body);
  const build = await getOwnedBuild(input.buildId, req.user._id);
  const [{ items, profile }, settings, pairs] = await Promise.all([
    resolveCurrentBuild(build, { requireAvailable: true }), CheckSetting.find().lean(), BalancePair.find({ active: true }).lean()
  ]);
  const validation = validateBuild(items, settings, pairs, profile);
  if (!validation.valid) {
    const reasons = [validation.missingCategories.length ? 'Still to choose: ' + validation.missingCategories.map(category => CATEGORY_LABELS[category]).join(', ') + '.' : '',
      ...validation.issues.filter(issue => issue.severity === 'error').map(issue => issue.message)].filter(Boolean);
    return res.status(409).json({ message: 'This build is not ready to submit. ' + reasons.join(' '), validation });
  }
  try {
    const request = await BuildRequest.create({ owner: req.user._id, build: build._id, note: input.note, status: 'pending', active: true,
      snapshot: { name: build.name, budget: build.budget, profileSlug: profile.slug,
        items: items.map(item => ({ component: snapshotComponent(item.component), quantity: item.quantity })), total: validation.total } });
    res.status(201).json(serializeRequest(request));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This saved build already has a pending or approved request.' });
    throw error;
  }
});
export default router;