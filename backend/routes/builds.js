import { Router } from 'express';
import Build from '../models/Build.js';
import BuildRequest from '../models/BuildRequest.js';
import { requireUser } from '../middleware/auth.js';
import { badRequest } from '../services/errors.js';
import { validHttpsUrl } from '../services/componentInput.js';
import {
  buildId, buildName, getOwnedBuild, prepareBuild, requireObject, resolveCurrentBuild, serializeBuild
} from '../services/builds.js';

const router = Router();
// Administrators plan builds too, for inquiry proposals and showcase builds.
// Every route below still scopes reads and writes to the signed-in owner.
router.use(requireUser);

router.get('/', async (req, res) => {
  const builds = await Build.find({ owner: req.user._id }).sort({ updatedAt: -1 }).lean();
  res.json(builds.map(serializeBuild));
});

router.post('/', async (req, res) => {
  const input = await prepareBuild(req.body);
  const build = await Build.create({ ...input, owner: req.user._id });
  res.status(201).json(serializeBuild(build));
});

router.get('/:id', async (req, res) => {
  res.json(serializeBuild(await getOwnedBuild(req.params.id, req.user._id)));
});

router.put('/:id', async (req, res) => {
  // Check ownership before resolving client input, and repeat the filter on writes.
  await getOwnedBuild(req.params.id, req.user._id);
  const input = await prepareBuild(req.body);
  const build = await Build.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { $set: input }, { new: true, runValidators: true }).lean();
  if (!build) return res.status(404).json({ message: 'Build not found.' });
  res.json(serializeBuild(build));
});

router.patch('/:id', async (req, res) => {
  requireObject(req.body, ['name']);
  const name = buildName(req.body.name);
  const build = await Build.findOneAndUpdate({ _id: buildId(req.params.id), owner: req.user._id }, { $set: { name } }, { new: true, runValidators: true }).lean();
  if (!build) return res.status(404).json({ message: 'Build not found.' });
  res.json(serializeBuild(build));
});

// A saved build belongs to one customer and nothing downstream depends on it:
// a submitted request keeps its own immutable snapshot. Removing a build while
// it is under review would leave the administrator reviewing a missing record,
// so that case is refused instead.
router.delete('/:id', async (req, res) => {
  const build = await getOwnedBuild(req.params.id, req.user._id);
  if (await BuildRequest.exists({ build: build._id, owner: req.user._id, active: true })) {
    return res.status(409).json({ message: 'This build has a pending or approved request. Wait for the review to close before deleting it.' });
  }
  await Build.deleteOne({ _id: build._id, owner: req.user._id });
  res.json({ message: 'Build deleted.' });
});

// Publishing is how a shop build becomes a suggestion customers can browse.
// The landing-page photo is set here rather than on the build payload, so an
// inquiry proposal can never carry one.
router.patch('/:id/visibility', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Only an administrator can publish a build.' });
  if (!['private', 'published'].includes(req.body?.visibility)) throw badRequest('Choose private or published.');
  const changes = { visibility: req.body.visibility, shopBuild: true };
  // Left out entirely means leave the current photo alone, so unpublishing and
  // republishing does not lose it. An empty string clears it.
  if (req.body.imageUrl !== undefined) {
    if (typeof req.body.imageUrl !== 'string' || req.body.imageUrl.length > 2000) {
      throw badRequest('Photo link must be text up to 2,000 characters.', { imageUrl: 'Photo link must be text up to 2,000 characters.' });
    }
    const photo = req.body.imageUrl.trim();
    if (photo && !validHttpsUrl(photo)) throw badRequest('Use a valid HTTPS photo link.', { imageUrl: 'Use a valid HTTPS photo link.' });
    changes.imageUrl = photo;
  }
  const build = await getOwnedBuild(req.params.id, req.user._id);
  const updated = await Build.findOneAndUpdate({ _id: build._id, owner: req.user._id },
    { $set: changes }, { new: true, runValidators: true }).lean();
  if (!updated) return res.status(404).json({ message: 'Build not found.' });
  res.json({ message: req.body.visibility === 'published' ? 'Build published. Customers can now see it.' : 'Build hidden from customers.', build: serializeBuild(updated) });
});

router.post('/:id/duplicate', async (req, res) => {
  requireObject(req.body, ['name']);
  const original = await getOwnedBuild(req.params.id, req.user._id);
  const name = req.body.name === undefined ? (original.name.slice(0, 93) + ' (copy)') : buildName(req.body.name);
  const copy = await Build.create({
    owner: req.user._id, name, budget: original.budget,
    profile: original.profile, profileSlug: original.profileSlug, total: original.total,
    items: original.items.map(item => ({ component: item.component, quantity: item.quantity, snapshot: { ...item.snapshot } }))
  });
  res.status(201).json(serializeBuild(copy));
});

router.post('/:id/reopen', async (req, res) => {
  requireObject(req.body, []);
  const build = await getOwnedBuild(req.params.id, req.user._id);
  const current = await resolveCurrentBuild(build);
  res.json({
    plan: { budget: build.budget, profileSlug: current.profile.slug, items: current.items, savedBuildId: String(build._id), name: build.name },
    notices: current.notices
  });
});

export default router;