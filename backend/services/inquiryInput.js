import mongoose from 'mongoose';
import { badRequest } from './errors.js';

const NEW_FIELDS = ['useCase', 'budget', 'details'];
const PROPOSE_FIELDS = ['name', 'budget', 'profileSlug', 'items', 'reply'];

export function inquiryError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function inquiryId(value) {
  if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value)) throw badRequest('Invalid inquiry ID.');
  return value;
}

function textInput(value, label, limit, required) {
  if (value === undefined || value === null) {
    if (required) throw badRequest(label + ' is required.', { [label.toLowerCase()]: label + ' is required.' });
    return '';
  }
  if (typeof value !== 'string' || value.length > limit) throw badRequest(`${label} must be text up to ${limit} characters.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw badRequest(label + ' is required.');
  return trimmed;
}

export function newInquiryInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Provide an inquiry object.');
  for (const key of Object.keys(body)) {
    if (!NEW_FIELDS.includes(key)) throw badRequest('Unsupported field: ' + key + '.');
  }
  const useCase = textInput(body.useCase, 'Use case', 120, true);
  if (!Number.isSafeInteger(body.budget) || body.budget <= 0) {
    throw badRequest('Budget must be a positive whole-peso amount.', { budget: 'Budget must be a positive whole-peso amount.' });
  }
  return { useCase, budget: body.budget, details: textInput(body.details, 'Details', 1000, false) };
}

// The shop's answer carries a full build payload plus a note, so the parts are
// validated by the normal build pipeline and only the note is handled here.
export function proposalInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Provide a proposal object.');
  for (const key of Object.keys(body)) {
    if (!PROPOSE_FIELDS.includes(key)) throw badRequest('Unsupported field: ' + key + '.');
  }
  const reply = textInput(body.reply, 'Reply', 1000, false);
  const { reply: _ignored, ...build } = body;
  return { build, reply };
}

// open    -> answered (the shop proposes a build) or closed (the shop declines)
// answered-> answered (the shop revises), accepted or declined (the customer)
const TRANSITIONS = {
  open: ['answered', 'closed'],
  answered: ['answered', 'accepted', 'declined'],
  accepted: [], declined: [], closed: []
};

export function checkInquiryTransition(previous, next) {
  if (!TRANSITIONS[previous]?.includes(next)) {
    throw inquiryError(409, ['accepted', 'declined', 'closed'].includes(previous)
      ? 'This inquiry is already closed.'
      : 'That change is no longer available. Refresh the inquiry and try again.');
  }
}

export function serializeInquiry(record, { customer = null, build = null } = {}) {
  const doc = typeof record.toObject === 'function' ? record.toObject() : record;
  return {
    id: String(doc._id), useCase: doc.useCase, budget: doc.budget, details: doc.details || '',
    status: doc.status, reply: doc.reply || '',
    proposedBuildId: doc.proposedBuild ? String(doc.proposedBuild) : null,
    acceptedBuildId: doc.acceptedBuild ? String(doc.acceptedBuild) : null,
    createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    ...(customer ? { customer: { id: String(customer._id), name: customer.name, email: customer.email } } : {}),
    ...(build ? { proposal: build } : {})
  };
}