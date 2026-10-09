import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { assertRoleChangeAllowed, toPublicUser, validateRoleInput } from '../services/auth.js';
import { badRequest } from '../services/errors.js';

const router = Router();

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

router.get('/users', async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  res.json({ users: users.map(toPublicUser) });
});

router.patch('/users/:id/role', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw badRequest('Invalid user ID.');
  const role = validateRoleInput(req.body);
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User not found.');

  const isAdminDemotion = user.role === 'admin' && role !== 'admin';
  const isSelf = String(user._id) === String(req.user._id);
  const activeAdminCount = isAdminDemotion && user.active && !isSelf
    ? await User.countDocuments({ role: 'admin', active: true })
    : undefined;
  assertRoleChangeAllowed({ actorId: req.user._id, user, nextRole: role, activeAdminCount });

  user.role = role;
  await user.save();
  res.json({ user: toPublicUser(user) });
});

export default router;
