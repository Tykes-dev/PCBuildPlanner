import { Router } from 'express';
import mongoose from 'mongoose';
import BuildRequest, { ACTIVE_REQUEST_STATUSES } from '../models/BuildRequest.js';
import { requireRole, databaseReady } from '../middleware/auth.js';
import { badRequest } from '../services/errors.js';
import { statusInput, checkTransition, serializeRequest, getReport } from '../services/requests.js';

const router = Router();
router.use(requireRole('admin'), databaseReady);
router.get('/reports', async (req, res) => res.json(await getReport()));
router.get('/requests', async (req, res) => {
  const requests = await BuildRequest.find({}).populate('owner', 'name email').sort({ createdAt: -1, _id: -1 }).limit(200).lean();
  res.json(requests.map(request => serializeRequest(request, true)));
});
router.patch('/requests/:id/status', async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw badRequest('Invalid request ID.');
  const input = statusInput(req.body);
  const current = await BuildRequest.findById(req.params.id).lean();
  if (!current) return res.status(404).json({ message: 'Build request not found.' });
  if (input.expectedStatus !== undefined && input.expectedStatus !== current.status) return res.status(409).json({ message: 'This request changed. Refresh before updating its status.' });
  checkTransition(current.status, input.status);
  const updated = await BuildRequest.findOneAndUpdate({ _id: current._id, status: current.status }, {
    $set: { status: input.status, active: ACTIVE_REQUEST_STATUSES.includes(input.status), remarks: input.remarks, reviewedBy: req.user._id }
  }, { new: true }).populate('owner', 'name email').lean();
  if (!updated) return res.status(409).json({ message: 'This request changed. Refresh before updating its status.' });
  res.json(serializeRequest(updated, true));
});
export default router;

