import { Router } from 'express';
import Build from '../models/Build.js';
import BuildInquiry from '../models/BuildInquiry.js';
import { requireCustomer, databaseReady } from '../middleware/auth.js';
import { serializeBuild } from '../services/builds.js';
import { checkInquiryTransition, inquiryError, inquiryId, newInquiryInput, serializeInquiry } from '../services/inquiryInput.js';

const router = Router();
router.use(requireCustomer, databaseReady);

async function ownedInquiry(id, customer) {
  const inquiry = await BuildInquiry.findOne({ _id: inquiryId(id), customer });
  if (!inquiry) throw inquiryError(404, 'Inquiry not found.');
  return inquiry;
}

router.get('/', async (req, res) => {
  const inquiries = await BuildInquiry.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(200).lean();
  res.json(inquiries.map(inquiry => serializeInquiry(inquiry)));
});

router.post('/', async (req, res) => {
  const input = newInquiryInput(req.body);
  const inquiry = await BuildInquiry.create({ ...input, customer: req.user._id, status: 'open' });
  res.status(201).json(serializeInquiry(inquiry));
});

router.get('/:id', async (req, res) => {
  const inquiry = await ownedInquiry(req.params.id, req.user._id);
  const build = inquiry.proposedBuild ? await Build.findById(inquiry.proposedBuild).lean() : null;
  res.json(serializeInquiry(inquiry, { build: build ? serializeBuild(build) : null }));
});

// Accepting copies the shop's build into the customer's own saved builds. The
// original stays with the administrator, so later shop edits cannot rewrite
// what the customer agreed to.
router.patch('/:id/accept', async (req, res) => {
  const inquiry = await ownedInquiry(req.params.id, req.user._id);
  checkInquiryTransition(inquiry.status, 'accepted');
  const proposal = inquiry.proposedBuild ? await Build.findById(inquiry.proposedBuild).lean() : null;
  if (!proposal) throw inquiryError(409, 'The proposed build is no longer available. Ask the shop to send it again.');
  const copy = await Build.create({
    owner: req.user._id, name: proposal.name, budget: proposal.budget,
    profile: proposal.profile, profileSlug: proposal.profileSlug, total: proposal.total,
    items: proposal.items.map(item => ({ component: item.component, quantity: item.quantity, snapshot: { ...item.snapshot } }))
  });
  inquiry.status = 'accepted';
  inquiry.acceptedBuild = copy._id;
  await inquiry.save();
  res.json({ message: 'Saved to your builds. You can open it in the planner and change anything you like.', inquiry: serializeInquiry(inquiry), build: serializeBuild(copy) });
});

router.patch('/:id/decline', async (req, res) => {
  const inquiry = await ownedInquiry(req.params.id, req.user._id);
  checkInquiryTransition(inquiry.status, 'declined');
  inquiry.status = 'declined';
  await inquiry.save();
  res.json({ message: 'Declined. You can send a new inquiry whenever you are ready.', inquiry: serializeInquiry(inquiry) });
});

export default router;