import { Router } from 'express';
import Build from '../models/Build.js';
import BuildInquiry, { INQUIRY_STATUSES } from '../models/BuildInquiry.js';
import User from '../models/User.js';
import { requireRole, databaseReady } from '../middleware/auth.js';
import { badRequest } from '../services/errors.js';
import { prepareBuild, serializeBuild } from '../services/builds.js';
import { checkInquiryTransition, inquiryError, inquiryId, proposalInput, serializeInquiry } from '../services/inquiryInput.js';

const router = Router();
router.use(requireRole('admin'), databaseReady);

async function findInquiry(id) {
  const inquiry = await BuildInquiry.findById(inquiryId(id));
  if (!inquiry) throw inquiryError(404, 'Inquiry not found.');
  return inquiry;
}

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.status !== undefined) {
    if (!INQUIRY_STATUSES.includes(req.query.status)) throw badRequest('Choose a supported inquiry status.');
    filter.status = req.query.status;
  }
  const inquiries = await BuildInquiry.find(filter).sort({ createdAt: -1 }).limit(200).populate('customer', 'name email').lean();
  res.json(inquiries.map(inquiry => serializeInquiry(inquiry, { customer: inquiry.customer })));
});

router.get('/:id', async (req, res) => {
  const inquiry = await findInquiry(req.params.id);
  const [customer, build] = await Promise.all([
    User.findById(inquiry.customer).select('name email').lean(),
    inquiry.proposedBuild ? Build.findById(inquiry.proposedBuild).lean() : null
  ]);
  res.json(serializeInquiry(inquiry, { customer, build: build ? serializeBuild(build) : null }));
});

// The shop answers with a full parts list. It is saved as a build owned by the
// administrator and marked as a shop build, so it stays out of the customer
// activity counts until the customer accepts a copy of it.
router.patch('/:id/propose', async (req, res) => {
  const inquiry = await findInquiry(req.params.id);
  checkInquiryTransition(inquiry.status, 'answered');
  const { build, reply } = proposalInput(req.body);
  const prepared = await prepareBuild(build);
  let proposal;
  if (inquiry.proposedBuild) {
    proposal = await Build.findOneAndUpdate({ _id: inquiry.proposedBuild, owner: req.user._id },
      { $set: prepared }, { new: true, runValidators: true }).lean();
  }
  if (!proposal) {
    proposal = (await Build.create({ ...prepared, owner: req.user._id, shopBuild: true })).toObject();
  }
  inquiry.status = 'answered';
  inquiry.proposedBuild = proposal._id;
  inquiry.reply = reply;
  inquiry.answeredBy = req.user._id;
  await inquiry.save();
  res.json({ message: 'Sent back to the customer.', inquiry: serializeInquiry(inquiry, { build: serializeBuild(proposal) }) });
});

router.patch('/:id/close', async (req, res) => {
  const inquiry = await findInquiry(req.params.id);
  checkInquiryTransition(inquiry.status, 'closed');
  if (req.body?.reply !== undefined && (typeof req.body.reply !== 'string' || req.body.reply.length > 1000)) {
    throw badRequest('Reply must be text up to 1,000 characters.');
  }
  inquiry.status = 'closed';
  inquiry.reply = (req.body?.reply || '').trim();
  inquiry.answeredBy = req.user._id;
  await inquiry.save();
  res.json({ message: 'Inquiry closed.', inquiry: serializeInquiry(inquiry) });
});

export default router;