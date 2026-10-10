import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Component from '../models/Component.js';
import AllocationProfile from '../models/AllocationProfile.js';
import CheckSetting, { CHECK_CODES } from '../models/CheckSetting.js';
import BalancePair from '../models/BalancePair.js';
import { componentInput } from '../services/componentInput.js';
import { profileInput } from '../services/profileInput.js';
import { checkInput, pairInput } from '../services/ruleInput.js';
import { withSampleImage } from '../data/componentImages.js';
import { requireRole } from '../middleware/auth.js';
import { badRequest } from '../services/errors.js';
const router = Router();
router.use(requireRole('admin'));

// Category-specific specifications. A category change must clear the fields the
// new category does not use, otherwise stale specs stay on the record.
const SPEC_FIELDS = ['socket', 'memoryType', 'formFactor', 'memorySlots', 'capacityGb', 'storageType', 'wattageRating', 'supportedFormFactors'];
const DUPLICATE = 'A component with this brand and name already exists.';
const NOT_FOUND = 'Component not found.';

function componentId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) throw badRequest('Invalid component ID.');
  return value;
}

// Administrators manage archived parts too, so this list is not filtered the
// way the public catalog is.
router.get('/components', async (req, res) => {
  const components = await Component.find().sort({ archived: 1, category: 1, price: 1 }).lean();
  res.json(components.map(withSampleImage));
});

router.post('/components', async (req, res) => {
  const input = componentInput(req.body);
  try {
    const component = await Component.create(input);
    res.status(201).json(withSampleImage(component.toJSON()));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: DUPLICATE });
    throw error;
  }
});

router.put('/components/:id', async (req, res) => {
  const id = componentId(req.params.id);
  const input = componentInput(req.body);
  // Archiving is handled by the delete and restore routes, so an edit never
  // silently brings an archived part back into the catalog.
  delete input.archived;
  const component = await Component.findById(id);
  if (!component) return res.status(404).json({ message: NOT_FOUND });
  for (const field of SPEC_FIELDS) component.set(field, undefined);
  component.set(input);
  try {
    await component.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: DUPLICATE });
    throw error;
  }
  res.json(withSampleImage(component.toJSON()));
});

// Saved builds reference catalog components, so removing a record would leave
// a customer's history pointing at nothing. Archiving hides the part from the
// catalog, the planner and recommendations while keeping those references valid.
router.delete('/components/:id', async (req, res) => {
  const component = await Component.findById(componentId(req.params.id));
  if (!component) return res.status(404).json({ message: NOT_FOUND });
  if (component.archived) return res.status(409).json({ message: 'This component is already archived.' });
  component.archived = true;
  await component.save();
  res.json({ message: 'Component archived. It no longer appears in the catalog, and saved builds keep their history.', component: withSampleImage(component.toJSON()) });
});

router.patch('/components/:id/restore', async (req, res) => {
  const component = await Component.findById(componentId(req.params.id));
  if (!component) return res.status(404).json({ message: NOT_FOUND });
  if (!component.archived) return res.status(409).json({ message: 'This component is already active.' });
  component.archived = false;
  await component.save();
  res.json({ message: 'Component restored to the catalog.', component: withSampleImage(component.toJSON()) });
});

// ---- Compatibility rules -----------------------------------------------
// Check codes are fixed because the engine runs them by name. Balance pairs
// are free-form: an administrator decides which two categories are compared
// and how wide a score gap is acceptable before a warning is shown.
router.get('/rules', async (req, res) => {
  const [checks, pairs] = await Promise.all([
    CheckSetting.find().lean(),
    BalancePair.find().sort({ categoryA: 1, categoryB: 1 }).lean()
  ]);
  const ordered = CHECK_CODES.map(code => checks.find(check => check.code === code)).filter(Boolean);
  res.json({ checks: ordered, pairs });
});

router.put('/rules/checks/:code', async (req, res) => {
  const code = req.params.code;
  if (!CHECK_CODES.includes(code)) return res.status(404).json({ message: 'Compatibility check not found.' });
  const input = checkInput(req.body, code);
  const check = await CheckSetting.findOne({ code });
  if (!check) return res.status(404).json({ message: 'Compatibility check not found. Run the seed command first.' });
  check.set(input);
  await check.save();
  res.json(check.toJSON());
});

router.post('/rules/pairs', async (req, res) => {
  const input = pairInput(req.body);
  try {
    const pair = await BalancePair.create(input);
    res.status(201).json(pair.toJSON());
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'These two categories are already compared by another pair.' });
    throw error;
  }
});

router.put('/rules/pairs/:id', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw badRequest('Invalid balance pair ID.');
  const input = pairInput(req.body);
  const pair = await BalancePair.findById(req.params.id);
  if (!pair) return res.status(404).json({ message: 'Balance pair not found.' });
  pair.set(input);
  try {
    await pair.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'These two categories are already compared by another pair.' });
    throw error;
  }
  res.json(pair.toJSON());
});

// A balance pair is configuration that nothing else references, so it can be
// removed outright rather than archived like catalog parts and profiles.
router.delete('/rules/pairs/:id', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw badRequest('Invalid balance pair ID.');
  const pair = await BalancePair.findByIdAndDelete(req.params.id);
  if (!pair) return res.status(404).json({ message: 'Balance pair not found.' });
  res.json({ message: 'Balance pair removed. Builds are no longer checked against it.' });
});

// ---- Use case profiles -------------------------------------------------
// A profile decides how a budget is split across the seven categories, so it
// is shop configuration rather than catalog data. Profiles are deactivated
// rather than removed, because saved builds reference the profile they used.
const PROFILE_MISSING = 'Use case profile not found.';

function profileId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) throw badRequest('Invalid use case profile ID.');
  return value;
}

router.get('/profiles', async (req, res) => {
  const profiles = await AllocationProfile.find().sort({ active: -1, isDefault: -1, label: 1 }).lean();
  res.json(profiles);
});

router.post('/profiles', async (req, res) => {
  const input = profileInput(req.body);
  try {
    const first = !(await AllocationProfile.exists({ active: true }));
    const profile = await AllocationProfile.create({ ...input, active: true, isDefault: first });
    res.status(201).json(profile.toJSON());
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A use case profile with this slug already exists.' });
    throw error;
  }
});

router.put('/profiles/:id', async (req, res) => {
  const input = profileInput(req.body);
  const profile = await AllocationProfile.findById(profileId(req.params.id));
  if (!profile) return res.status(404).json({ message: PROFILE_MISSING });
  profile.set(input);
  try {
    await profile.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A use case profile with this slug already exists.' });
    throw error;
  }
  res.json(profile.toJSON());
});

// Only one profile may be the default, enforced by a unique partial index, so
// the previous default is cleared before the new one is set.
router.patch('/profiles/:id/default', async (req, res) => {
  const profile = await AllocationProfile.findById(profileId(req.params.id));
  if (!profile) return res.status(404).json({ message: PROFILE_MISSING });
  if (!profile.active) return res.status(409).json({ message: 'Restore this profile before making it the default.' });
  if (profile.isDefault) return res.json(profile.toJSON());
  await AllocationProfile.updateMany({ isDefault: true }, { $set: { isDefault: false } });
  profile.isDefault = true;
  await profile.save();
  res.json(profile.toJSON());
});

router.delete('/profiles/:id', async (req, res) => {
  const profile = await AllocationProfile.findById(profileId(req.params.id));
  if (!profile) return res.status(404).json({ message: PROFILE_MISSING });
  if (!profile.active) return res.status(409).json({ message: 'This use case profile is already archived.' });
  if (profile.isDefault) return res.status(409).json({ message: 'Make another profile the default before archiving this one.' });
  if (await AllocationProfile.countDocuments({ active: true }) <= 1) {
    return res.status(409).json({ message: 'At least one use case profile must stay active.' });
  }
  profile.active = false;
  await profile.save();
  res.json({ message: 'Use case profile archived. Customers can no longer choose it, and saved builds that used it keep their history.', profile: profile.toJSON() });
});

router.patch('/profiles/:id/restore', async (req, res) => {
  const profile = await AllocationProfile.findById(profileId(req.params.id));
  if (!profile) return res.status(404).json({ message: PROFILE_MISSING });
  if (profile.active) return res.status(409).json({ message: 'This use case profile is already active.' });
  profile.active = true;
  await profile.save();
  res.json({ message: 'Use case profile restored.', profile: profile.toJSON() });
});

router.get('/users', async (req, res) => {
  const users = await User.find().select('name email role createdAt').sort({ createdAt: -1 }).limit(500).lean();
  res.json(users.map(user => ({ id: String(user._id), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })));
});

router.patch('/users/:id/role', async (req, res) => {
  if (!['customer', 'admin'].includes(req.body?.role)) throw badRequest('Choose a supported role.');
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role === 'admin' && req.body.role !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) return res.status(409).json({ message: 'You cannot remove the last administrator.' });
  }
  user.role = req.body.role;
  await user.save();
  await Session.deleteMany({ user: user._id });
  res.json({ id: String(user._id), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
});
export default router;