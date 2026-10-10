import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import Component from './models/Component.js';
import AllocationProfile from './models/AllocationProfile.js';
import CheckSetting from './models/CheckSetting.js';
import BalancePair from './models/BalancePair.js';
import User from './models/User.js';
import Build from './models/Build.js';
import BuildRequest from './models/BuildRequest.js';
import { hashPassword } from './services/auth.js';
import { prepareBuild, resolveCurrentBuild, snapshotComponent } from './services/builds.js';
import { validateBuild } from './services/compatibility.js';

// Demonstration data only. Every record created here belongs to an account on
// DEMO_DOMAIN, so `npm run seed:demo -- --remove` can delete all of it again
// without touching the shared catalog or any real account.
const DEMO_DOMAIN = 'demo.pcbuildplanner.test';
const DEMO_PASSWORD = 'DemoPass2026!';

const CUSTOMERS = [
  { name: 'Andrea Cruz', email: 'andrea@' + DEMO_DOMAIN },
  { name: 'Marco Dela Pena', email: 'marco@' + DEMO_DOMAIN },
  { name: 'Joyce Ramirez', email: 'joyce@' + DEMO_DOMAIN }
];

// customer index, build name, budget, and the request status to leave it in.
const PLANS = [
  { customer: 0, name: 'Starter editing rig', budget: 40000, request: 'completed', note: 'For photo editing and light video work.' },
  { customer: 0, name: 'Streaming upgrade', budget: 60000, request: 'pending', note: 'Planning to stream on weekends.' },
  { customer: 1, name: 'Esports daily driver', budget: 55000, request: 'approved', note: 'Mostly competitive shooters at 1080p.' },
  { customer: 1, name: 'Budget office build', budget: 35000, request: 'rejected', note: 'Office use only, no gaming.' },
  { customer: 2, name: 'Student workstation', budget: 50000, request: null },
  { customer: 2, name: 'Dream build draft', budget: 90000, request: null },
  { customer: 0, name: 'Spare parts draft', budget: 45000, request: null },
  { customer: 1, name: 'Second opinion build', budget: 70000, request: null }
];

const REMARKS = {
  approved: 'Parts are compatible and within budget. Approved for quotation.',
  rejected: 'The graphics card is out of scope for this budget. Please revise and resubmit.',
  completed: 'Build released to the customer. Thank you.'
};

function activeFor(status) {
  return status === 'pending' || status === 'approved';
}

// Walks the live catalog and returns distinct seven-category sets that pass the
// same hard checks the planner runs, so every seeded build is genuinely valid.
function compatibleSets(all, settings, pairs, profile, limit) {
  const by = category => all.filter(c => c.category === category && !c.archived && c.availability !== 'out of stock');
  const gpus = by('gpu'), storages = by('storage'), psus = [...by('psu')].sort((a, b) => a.wattageRating - b.wattageRating);
  const sets = [], seen = new Set();
  let turn = 0;
  for (const board of by('motherboard')) {
    const cpus = by('cpu').filter(c => c.socket === board.socket);
    const memories = by('memory').filter(c => c.memoryType === board.memoryType);
    const cases = by('case').filter(c => (c.supportedFormFactors || []).includes(board.formFactor));
    if (!cpus.length || !memories.length || !cases.length || !gpus.length || !storages.length || !psus.length) continue;
    for (let pass = 0; pass < 3 && sets.length < limit; pass++, turn++) {
      const at = list => list[turn % list.length];
      const cpu = at(cpus), memory = at(memories), pcCase = at(cases), gpu = at(gpus), storage = at(storages);
      const memoryQuantity = board.memorySlots >= 2 && (memory.availability !== 'in stock' || memory.stock >= 2) ? 2 : 1;
      const draw = cpu.powerDraw + board.powerDraw + memory.powerDraw * memoryQuantity + gpu.powerDraw + storage.powerDraw + pcCase.powerDraw;
      const required = Math.ceil(draw * 1.3);
      const psu = psus.find(candidate => candidate.wattageRating >= required);
      if (!psu) continue;
      const items = [cpu, board, memory, gpu, storage, pcCase, psu]
        .map(component => ({ component, quantity: component === memory ? memoryQuantity : 1 }));
      const key = items.map(item => String(item.component._id)).sort().join(',');
      if (seen.has(key)) continue;
      if (!validateBuild(items, settings, pairs, profile).valid) continue;
      seen.add(key);
      sets.push(items);
    }
  }
  return sets.slice(0, limit);
}

async function removeDemoData() {
  const owners = await User.find({ email: { $regex: '@' + DEMO_DOMAIN.replace(/\./g, '\\.') + '$' } }).select('_id').lean();
  if (!owners.length) return console.log('No demonstration accounts were found. Nothing to remove.');
  const ids = owners.map(owner => owner._id);
  const requests = await BuildRequest.deleteMany({ owner: { $in: ids } });
  const builds = await Build.deleteMany({ owner: { $in: ids } });
  const users = await User.deleteMany({ _id: { $in: ids } });
  console.log(`Removed ${users.deletedCount} demonstration accounts, ${builds.deletedCount} saved builds, and ${requests.deletedCount} requests. The catalog was not changed.`);
}

async function createDemoData() {
  const [components, profile, settings, pairs, admin] = await Promise.all([
    Component.find({ archived: false }).lean(),
    AllocationProfile.findOne({ active: true, isDefault: true }).lean()
      .then(found => found || AllocationProfile.findOne({ active: true }).lean()),
    CheckSetting.find().lean(),
    BalancePair.find({ active: true }).lean(),
    User.findOne({ role: 'admin' }).select('_id').lean()
  ]);
  if (!components.length) throw new Error('The catalog is empty. Run npm run seed first.');
  if (!profile) throw new Error('No active allocation profile exists. Run npm run seed first.');
  if (!admin) console.log('Note: no administrator account exists yet, so reviewed requests will have no reviewer recorded.');

  const sets = compatibleSets(components, settings, pairs, profile, PLANS.length);
  if (sets.length < PLANS.length) console.log(`Only ${sets.length} compatible build combinations are available in this catalog; seeding that many.`);

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const owners = [];
  for (const customer of CUSTOMERS) {
    const existing = await User.findOne({ email: customer.email }).lean();
    if (existing) { owners.push(existing); continue; }
    owners.push(await User.create({ ...customer, passwordHash, role: 'customer' }));
    console.log('Created customer ' + customer.email);
  }

  let createdBuilds = 0, createdRequests = 0;
  for (const [index, plan] of PLANS.entries()) {
    const items = sets[index];
    if (!items) break;
    const owner = owners[plan.customer]._id;
    if (await Build.exists({ owner, name: plan.name })) continue;

    const prepared = await prepareBuild({
      name: plan.name,
      budget: plan.budget,
      profileSlug: profile.slug,
      items: items.map(item => ({ componentId: String(item.component._id), quantity: item.quantity }))
    });
    const build = await Build.create({ ...prepared, owner });
    createdBuilds++;

    if (!plan.request) continue;
    // Mirrors POST /api/requests so the snapshot matches a real submission.
    const saved = await Build.findById(build._id).lean();
    const resolved = await resolveCurrentBuild(saved, { requireAvailable: true });
    const validation = validateBuild(resolved.items, settings, pairs, resolved.profile);
    if (!validation.valid) { console.log(`Skipped the request for "${plan.name}" because the current catalog no longer satisfies every check.`); continue; }
    await BuildRequest.create({
      owner,
      build: build._id,
      status: plan.request,
      active: activeFor(plan.request),
      note: plan.note,
      remarks: REMARKS[plan.request] || '',
      ...(admin && plan.request !== 'pending' ? { reviewedBy: admin._id } : {}),
      snapshot: {
        name: saved.name,
        budget: saved.budget,
        profileSlug: resolved.profile.slug,
        items: resolved.items.map(item => ({ component: snapshotComponent(item.component), quantity: item.quantity })),
        total: validation.total
      }
    });
    createdRequests++;
  }

  console.log(`\nDemonstration data is ready. Added ${createdBuilds} saved builds and ${createdRequests} requests.`);
  console.log(`Sign in as any of: ${CUSTOMERS.map(customer => customer.email).join(', ')}`);
  console.log(`Password for all demonstration accounts: ${DEMO_PASSWORD}`);
  console.log('Remove this data later with: npm run seed:demo -w backend -- --remove');
}

try {
  await connectDatabase(process.env.MONGO_URI);
  await Promise.all([User.init(), Build.init(), BuildRequest.init()]);
  if (process.argv.includes('--remove')) await removeDemoData();
  else await createDemoData();
} catch (error) {
  if (error.code === 'DATABASE_CONFIGURATION') console.error('Seeding failed: ' + error.message);
  else if (error.code === 18 || error.codeName === 'AuthenticationFailed') console.error('Seeding failed: database authentication failed. Check the username and password in backend/.env.');
  else if (error.name === 'MongooseServerSelectionError') console.error('Seeding failed: cannot reach the database. Check cluster readiness and Atlas Network Access for your current IP.');
  else if (error.name === 'ValidationError') console.error('Seeding failed: the demonstration data did not satisfy the database schema.');
  else if (error.code === 11000) console.error('Seeding failed: a unique constraint conflicts with existing records.');
  else console.error('Seeding failed: ' + error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}