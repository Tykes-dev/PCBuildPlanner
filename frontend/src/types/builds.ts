import type { Item, Plan } from './index';

export interface SavedBuild {
  id: string;
  name: string;
  budget: number;
  profileSlug: string;
  items: Item[];
  total: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export interface BuildRequest {
  id: string;
  buildId: string;
  status: RequestStatus;
  note: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  snapshot: Pick<SavedBuild, 'name' | 'budget' | 'profileSlug' | 'items' | 'total'>;
}

export type InquiryStatus = 'open' | 'answered' | 'accepted' | 'declined' | 'closed';
export interface Inquiry {
  id: string;
  useCase: string;
  budget: number;
  details: string;
  status: InquiryStatus;
  reply: string;
  proposedBuildId: string | null;
  acceptedBuildId: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; email: string };
  proposal?: SavedBuild | null;
}
export const INQUIRY_LABELS: Record<InquiryStatus, string> = {
  open: 'Waiting on the shop', answered: 'Build ready for you', accepted: 'Accepted', declined: 'Declined', closed: 'Closed',
};
export const INQUIRY_TONES: Record<InquiryStatus, string> = {
  open: 'warning', answered: 'pass', accepted: 'pass', declined: 'text-danger', closed: '',
};

export interface ReopenedBuild { plan: Plan; notices: string[]; }
export const REQUEST_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', completed: 'Completed',
};
export const REQUEST_TONES: Record<RequestStatus, string> = {
  pending: 'warning', approved: 'pass', rejected: 'text-danger', completed: 'pass',
};
export function profileLabel(slug: string) {
  return slug.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
export function buildDate(date: string) {
  return new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}