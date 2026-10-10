import mongoose from 'mongoose';
import Build from '../models/Build.js';
import BuildRequest, { REQUEST_STATUSES } from '../models/BuildRequest.js';
import { badRequest } from './errors.js';

export function requestError(status, message) { return Object.assign(new Error(message), { status }); }
function inputObject(input, keys) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('Provide a valid request.');
  for (const key of Object.keys(input)) if (!keys.includes(key)) throw badRequest('Unsupported request field: ' + key + '.');
}
function textInput(value, label) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 1000) throw badRequest(label + ' must be text up to 1,000 characters.');
  return value.trim();
}
export function newRequestInput(input) {
  inputObject(input, ['buildId', 'note']);
  if (typeof input.buildId !== 'string' || !mongoose.isObjectIdOrHexString(input.buildId)) throw badRequest('Invalid saved build ID.');
  return { buildId: input.buildId, note: textInput(input.note, 'Note') };
}
export function statusInput(input) {
  inputObject(input, ['status', 'remarks', 'expectedStatus']);
  if (!REQUEST_STATUSES.includes(input.status)) throw badRequest('Choose a supported request status.');
  if (input.expectedStatus !== undefined && !REQUEST_STATUSES.includes(input.expectedStatus)) throw badRequest('Invalid previous request status.');
  return { status: input.status, remarks: textInput(input.remarks, 'Remarks'), expectedStatus: input.expectedStatus };
}
export function checkTransition(previous, next) {
  const transitions = { pending: ['approved', 'rejected'], approved: ['completed'], rejected: [], completed: [] };
  if (!transitions[previous]?.includes(next)) throw requestError(409,
    previous === 'rejected' || previous === 'completed' ? 'This request is already closed.' : 'This status change is no longer available. Refresh the requests.');
}
export function serializeRequest(record, includeOwner = false) {
  const doc = typeof record.toObject === 'function' ? record.toObject() : record;
  const dto = { id: String(doc._id), buildId: String(doc.build), status: doc.status, note: doc.note || '',
    remarks: doc.remarks || '', createdAt: doc.createdAt, updatedAt: doc.updatedAt, snapshot: doc.snapshot };
  if (includeOwner) dto.owner = doc.owner && typeof doc.owner === 'object' && doc.owner.name !== undefined
    ? { id: String(doc.owner._id), name: doc.owner.name, email: doc.owner.email }
    : { id: String(doc.owner || ''), name: 'Account unavailable', email: '' };
  return dto;
}
export function assembleReport(savedBuildCount, statusRows, componentRows) {
  const statusCounts = Object.fromEntries(REQUEST_STATUSES.map(status => [status, 0]));
  for (const row of statusRows) if (REQUEST_STATUSES.includes(row._id)) statusCounts[row._id] = row.count;
  return { savedBuildCount, requestCount: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
    activeRequestCount: statusCounts.pending + statusCounts.approved, statusCounts,
    commonComponents: componentRows, generatedAt: new Date().toISOString() };
}
export async function getReport() {
  const [savedBuildCount, statusRows, componentRows] = await Promise.all([
    Build.countDocuments({}),
    BuildRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Build.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.component', selections: { $sum: 1 }, units: { $sum: '$items.quantity' },
        savedName: { $first: '$items.snapshot.name' }, savedBrand: { $first: '$items.snapshot.brand' }, savedCategory: { $first: '$items.snapshot.category' } } },
      { $sort: { selections: -1, units: -1, _id: 1 } }, { $limit: 10 },
      { $lookup: { from: 'components', localField: '_id', foreignField: '_id', as: 'catalog' } },
      { $unwind: { path: '$catalog', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, componentId: { $toString: '$_id' }, name: { $ifNull: ['$catalog.name', '$savedName'] },
        brand: { $ifNull: ['$catalog.brand', '$savedBrand'] }, category: { $ifNull: ['$catalog.category', '$savedCategory'] }, selections: 1, units: 1 } }
    ])
  ]);
  return assembleReport(savedBuildCount, statusRows, componentRows);
}

