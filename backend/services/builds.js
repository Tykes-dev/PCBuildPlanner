import mongoose from 'mongoose';
import Build from '../models/Build.js';
import Component from '../models/Component.js';
import AllocationProfile from '../models/AllocationProfile.js';
import { normalizeItems } from './compatibility.js';
import { badRequest } from './errors.js';
import { withSampleImage } from '../data/componentImages.js';

const componentFields = [
  'name', 'brand', 'category', 'price', 'performanceScore', 'availability', 'stock',
  'archived', 'imageUrl', 'imageSource', 'imageCaption', 'socket', 'memoryType',
  'formFactor', 'supportedFormFactors', 'wattageRating', 'capacityGb',
  'storageType', 'memorySlots', 'powerDraw'
];

export function snapshotComponent(record) {
  const source = withSampleImage(record.toObject ? record.toObject() : record);
  const result = { _id: String(source._id) };
  for (const field of componentFields) {
    if (source[field] !== undefined) result[field] = Array.isArray(source[field]) ? [...source[field]] : source[field];
  }
  result.powerDraw ??= 0;
  return result;
}

export function requireObject(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Provide a build object.');
  const unknown = Object.keys(body).filter(field => !allowed.includes(field));
  if (unknown.length) throw badRequest('Some fields are not supported.', Object.fromEntries(unknown.map(field => [field, 'This field is not supported.'])));
}

export function buildName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw badRequest('Use a build name from 1 to 100 characters.', { name: 'Use a build name from 1 to 100 characters.' });
  }
  return value.trim();
}

export function buildInput(body) {
  requireObject(body, ['name', 'budget', 'profileSlug', 'items']);
  const name = buildName(body.name);
  if (!Number.isSafeInteger(body.budget) || body.budget <= 0) throw badRequest('Budget must be a positive whole-peso amount.', { budget: 'Budget must be a positive whole-peso amount.' });
  if (typeof body.profileSlug !== 'string' || !/^[a-z0-9-]{1,100}$/.test(body.profileSlug)) throw badRequest('Choose a valid profile.', { profileSlug: 'Choose a valid profile.' });
  if (!Array.isArray(body.items) || body.items.length > 7) throw badRequest('Provide up to seven item rows.', { items: 'Provide up to seven item rows.' });
  const seen = new Set();
  const items = body.items.map(item => {
    requireObject(item, ['componentId', 'quantity']);
    if (typeof item.componentId !== 'string' || !mongoose.isObjectIdOrHexString(item.componentId)) throw badRequest('Invalid component ID.');
    const id = item.componentId.toLowerCase();
    if (seen.has(id)) throw badRequest('Use each component only once.');
    seen.add(id);
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 32) throw badRequest('Quantity must be a whole number from 1 to 32.');
    return { componentId: id, quantity: item.quantity };
  });
  return { name, budget: body.budget, profileSlug: body.profileSlug, items };
}

function errorWithStatus(message, status) {
  return Object.assign(new Error(message), { status });
}

export function buildId(id) {
  if (typeof id !== 'string' || !mongoose.isObjectIdOrHexString(id)) throw badRequest('Invalid build ID.');
  return id;
}

export async function getOwnedBuild(id, owner) {
  const build = await Build.findOne({ _id: buildId(id), owner }).lean();
  if (!build) throw errorWithStatus('Build not found.', 404);
  return build;
}

export function serializeBuild(document) {
  const build = document.toObject ? document.toObject() : document;
  return {
    id: String(build._id), name: build.name, budget: build.budget, profileSlug: build.profileSlug,
    items: build.items.map(item => ({ component: { ...item.snapshot, _id: String(item.component) }, quantity: item.quantity })),
    total: build.total, imageUrl: build.imageUrl || '',
    createdAt: build.createdAt, updatedAt: build.updatedAt
  };
}

export async function prepareBuild(body) {
  const input = buildInput(body);
  const [profile, components] = await Promise.all([
    AllocationProfile.findOne({ slug: input.profileSlug, active: true }).lean(),
    Component.find({ _id: { $in: input.items.map(item => item.componentId) }, archived: false }).lean()
  ]);
  if (!profile) throw errorWithStatus('Profile not found or no longer active.', 404);
  const records = new Map(components.map(component => [String(component._id), component]));
  const items = normalizeItems(input.items.map(item => {
    const component = records.get(item.componentId);
    if (!component) throw errorWithStatus('A selected component is missing or archived. Reopen the planner and choose another part.', 409);
    return { component, quantity: item.quantity };
  }));
  const total = items.reduce((sum, item) => sum + item.component.price * item.quantity, 0);
  if (!Number.isFinite(total) || total < 0) throw badRequest('The selected component prices cannot be saved.');
  return {
    name: input.name, budget: input.budget, profile: profile._id, profileSlug: profile.slug,
    items: items.map(item => ({ component: item.component._id, quantity: item.quantity, snapshot: snapshotComponent(item.component) })),
    total
  };
}

// Historical details always use the saved snapshots. Reopening and submission
// resolve current catalog records so later price, stock and spec changes apply.
export async function resolveCurrentBuild(build, { requireAvailable = false } = {}) {
  const [components, savedProfile] = await Promise.all([
    Component.find({ _id: { $in: build.items.map(item => item.component) } }).lean(),
    AllocationProfile.findOne({ _id: build.profile, active: true }).lean()
  ]);
  const notices = [];
  let profile = savedProfile;
  if (!profile) {
    if (requireAvailable) throw errorWithStatus('This build profile is no longer active. Reopen and save the build with an active profile.', 409);
    profile = await AllocationProfile.findOne({ active: true, isDefault: true }).lean();
    profile ??= await AllocationProfile.findOne({ active: true }).lean();
    if (!profile) throw errorWithStatus('No active allocation profile is available. Ask an administrator to restore one.', 409);
    notices.push('The saved profile is no longer active. The planner now uses ' + profile.label + '.');
  }
  const records = new Map(components.map(component => [String(component._id), component]));
  const items = [];
  for (const row of build.items) {
    const component = records.get(String(row.component));
    const name = row.snapshot?.name || 'A saved component';
    const reason = !component ? 'is no longer in the catalog'
      : component.archived ? 'has been archived'
        : component.availability === 'out of stock' ? 'is out of stock'
          : requireAvailable && component.availability === 'in stock' && component.stock < row.quantity ? 'has insufficient stock for the saved quantity'
            : null;
    if (reason) {
      const message = name + ' ' + reason + '.';
      if (requireAvailable) throw errorWithStatus(message + ' Reopen the build and choose an available part.', 409);
      notices.push(message + ' It was removed from this planner draft.');
      continue;
    }
    const current = snapshotComponent(component);
    if (!requireAvailable) {
      if (component.availability === 'in stock' && component.stock < row.quantity) notices.push(name + ': current stock is less than the saved quantity. Review the quantity before submitting a request.');
      if (current.price !== row.snapshot?.price) notices.push(name + ': the current price is ' + current.price + ' PHP; the saved price was ' + row.snapshot?.price + ' PHP.');
      const changed = componentFields.filter(field => !['price', 'stock', 'availability', 'imageUrl', 'imageSource', 'imageCaption', 'archived'].includes(field))
        .some(field => JSON.stringify(current[field]) !== JSON.stringify(row.snapshot?.[field]));
      if (changed) notices.push(name + ': current catalog specifications have been loaded. Review compatibility before saving.');
    }
    items.push({ component: current, quantity: row.quantity });
  }
  return { items: normalizeItems(items), profile, notices };
}