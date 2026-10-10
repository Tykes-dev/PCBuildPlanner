import { Router } from 'express';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Component from '../models/Component.js';
import { componentInput } from '../services/componentInput.js';
import { withSampleImage } from '../data/componentImages.js';
import { requireRole } from '../middleware/auth.js';
import { badRequest } from '../services/errors.js';
const router = Router();
router.use(requireRole('admin'));
router.post('/components', async (req, res) => {
  const input = componentInput(req.body);
  try {
    const component = await Component.create(input);
    res.status(201).json(withSampleImage(component.toJSON()));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A component with this brand and name already exists.' });
    throw error;
  }
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

