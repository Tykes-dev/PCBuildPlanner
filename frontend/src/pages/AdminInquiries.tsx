import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { useTableState } from '../hooks/useTableState';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { Feedback } from '../components/Feedback';
import { Parts } from '../components/BuildSummary';
import { IconButton } from '../components/Icon';
import { pesos } from '../types';
import {
  INQUIRY_LABELS, INQUIRY_TONES, REQUEST_LABELS, REQUEST_TONES, buildDate, profileLabel,
  type BuildRequest, type Inquiry, type InquiryStatus, type RequestStatus
} from '../types/builds';

interface AdminRequest extends BuildRequest { owner: { id: string; name: string; email: string }; }

const INQUIRY_STATUSES: InquiryStatus[] = ['open', 'answered', 'accepted', 'declined', 'closed'];
const REQUEST_STATUSES: RequestStatus[] = ['pending', 'approved', 'rejected', 'completed'];

// Declared outside the component so the table's memoised work is not thrown
// away on every render.
const inquiryText = (row: Inquiry) => [row.useCase, row.details, row.customer?.name, row.customer?.email, INQUIRY_LABELS[row.status]].join(' ');
const inquirySort = {
  useCase: (row: Inquiry) => row.useCase.toLowerCase(),
  customer: (row: Inquiry) => (row.customer?.name || '').toLowerCase(),
  budget: (row: Inquiry) => row.budget,
  status: (row: Inquiry) => INQUIRY_LABELS[row.status],
  createdAt: (row: Inquiry) => new Date(row.createdAt).getTime()
};
const requestText = (row: AdminRequest) => [row.snapshot.name, row.owner.name, row.owner.email, REQUEST_LABELS[row.status], row.note].join(' ');
const requestSort = {
  name: (row: AdminRequest) => row.snapshot.name.toLowerCase(),
  customer: (row: AdminRequest) => row.owner.name.toLowerCase(),
  total: (row: AdminRequest) => row.snapshot.total,
  status: (row: AdminRequest) => REQUEST_LABELS[row.status],
  createdAt: (row: AdminRequest) => new Date(row.createdAt).getTime()
};

export function AdminInquiries() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'requests' ? 'requests' : 'inquiries';
  const inquiries = useApi<Inquiry[]>('/admin/inquiries');
  const requests = useApi<AdminRequest[]>('/admin/requests');

  const [inquiryStatus, setInquiryStatus] = useState<'' | InquiryStatus>('');
  const [requestStatus, setRequestStatus] = useState<'' | RequestStatus>('');
  const [openInquiry, setOpenInquiry] = useState<Inquiry | null>(null);
  const [openRequest, setOpenRequest] = useState<AdminRequest | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [reply, setReply] = useState('');
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const inquiryRows = (inquiries.data || []).filter(row => !inquiryStatus || row.status === inquiryStatus);
  const requestRows = (requests.data || []).filter(row => !requestStatus || row.status === requestStatus);
  const inquiryTable = useTableState<Inquiry>({ rows: inquiryRows, searchText: inquiryText, sortValues: inquirySort, initialSort: { key: 'createdAt', direction: 'desc' } });
  const requestTable = useTableState<AdminRequest>({ rows: requestRows, searchText: requestText, sortValues: requestSort, initialSort: { key: 'createdAt', direction: 'desc' } });

  const waiting = (inquiries.data || []).filter(row => row.status === 'open').length;
  const pending = (requests.data || []).filter(row => row.status === 'pending').length;

  function switchTab(next: 'inquiries' | 'requests') {
    const updated = new URLSearchParams(params);
    if (next === 'requests') updated.set('tab', 'requests'); else updated.delete('tab');
    setParams(updated, { replace: true });
    setError(''); setFeedback('');
  }

  async function viewInquiry(row: Inquiry) {
    setError(''); setFeedback(''); setClosing(false); setReply('');
    setOpenInquiry(row); setDetailBusy(true);
    try {
      const response = await api.get<Inquiry>('/admin/inquiries/' + row.id);
      setOpenInquiry(response.data);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setDetailBusy(false); }
  }

  async function closeInquiry() {
    if (!openInquiry) return;
    setDetailBusy(true); setError('');
    try {
      const response = await api.patch<{ message: string }>('/admin/inquiries/' + openInquiry.id + '/close', { reply: reply.trim() });
      setFeedback(response.data.message);
      setOpenInquiry(null); setClosing(false);
      inquiries.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setDetailBusy(false); }
  }

  async function updateRequest(status: RequestStatus) {
    if (!openRequest) return;
    setDetailBusy(true); setError('');
    try {
      await api.patch('/admin/requests/' + openRequest.id + '/status', { status, remarks, expectedStatus: openRequest.status });
      setFeedback(openRequest.snapshot.name + ' is now ' + REQUEST_LABELS[status].toLowerCase() + '.');
      setOpenRequest(null);
      requests.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setDetailBusy(false); }
  }

  const inquiryColumns: DataTableColumn<Inquiry>[] = [
    { key: 'useCase', header: 'Use case', sortable: true, render: row => <>
      <p className="font-medium break-words">{row.useCase}</p>
      {row.details && <p className="text-xs text-muted mt-1 line-clamp-2 break-words">{row.details}</p>}
    </> },
    { key: 'customer', header: 'Customer', sortable: true, hideBelow: 'md', render: row => <>
      <p className="break-words">{row.customer?.name || '—'}</p>
      <p className="text-xs text-muted break-words">{row.customer?.email}</p>
    </> },
    { key: 'budget', header: 'Budget', sortable: true, align: 'right', numeric: true, render: row => pesos(row.budget) },
    { key: 'status', header: 'Status', sortable: true, render: row => <span className={'tag ' + INQUIRY_TONES[row.status]}>{INQUIRY_LABELS[row.status]}</span> },
    { key: 'createdAt', header: 'Sent', sortable: true, hideBelow: 'lg', render: row => <span className="text-xs text-muted">{buildDate(row.createdAt)}</span> },
    { key: 'actions', header: 'Details', align: 'right', render: row => <div className="row-actions">
      <IconButton icon="open" label={'Open the inquiry from ' + (row.customer?.name || 'this customer')}
        onClick={() => viewInquiry(row)}/>
    </div> }
  ];

  const requestColumns: DataTableColumn<AdminRequest>[] = [
    { key: 'name', header: 'Build', sortable: true, render: row => <>
      <p className="font-medium break-words">{row.snapshot.name}</p>
      <p className="text-xs text-muted mt-1">{profileLabel(row.snapshot.profileSlug)}</p>
    </> },
    { key: 'customer', header: 'Customer', sortable: true, hideBelow: 'md', render: row => <>
      <p className="break-words">{row.owner.name}</p>
      <p className="text-xs text-muted break-words">{row.owner.email}</p>
    </> },
    { key: 'total', header: 'Total', sortable: true, align: 'right', numeric: true, render: row => <>
      <p>{pesos(row.snapshot.total)}</p>
      <p className="text-xs text-muted">of {pesos(row.snapshot.budget)}</p>
    </> },
    { key: 'status', header: 'Status', sortable: true, render: row => <span className={'tag ' + REQUEST_TONES[row.status]}>{REQUEST_LABELS[row.status]}</span> },
    { key: 'createdAt', header: 'Submitted', sortable: true, hideBelow: 'lg', render: row => <span className="text-xs text-muted">{buildDate(row.createdAt)}</span> },
    { key: 'actions', header: 'Review', align: 'right', render: row => <div className="row-actions">
      <IconButton icon="open" label={'Review ' + row.snapshot.name}
        onClick={() => { setOpenRequest(row); setRemarks(row.remarks); setError(''); setFeedback(''); }}/>
    </div> }
  ];

  return <section>
    <span className="eyebrow">ADMINISTRATION</span>
    <h1>Customer queue.</h1>
    <p className="intro">Two kinds of work. An inquiry means the shop builds for the customer. A review request means the customer built it and wants it checked.</p>

    <div className="tab-row" role="tablist" aria-label="Queue type">
      <button type="button" role="tab" aria-selected={tab === 'inquiries'} className={'tab' + (tab === 'inquiries' ? ' active' : '')} onClick={() => switchTab('inquiries')}>
        Build inquiries{waiting > 0 && <span className="tab-count">{waiting}</span>}
      </button>
      <button type="button" role="tab" aria-selected={tab === 'requests'} className={'tab' + (tab === 'requests' ? ' active' : '')} onClick={() => switchTab('requests')}>
        Review requests{pending > 0 && <span className="tab-count">{pending}</span>}
      </button>
    </div>

    {error && <p role="alert" className="notice error mb-4">{error}</p>}
    {feedback && <p role="status" className="notice note mb-4">{feedback}</p>}

    {tab === 'inquiries' ? <>
      <Feedback loading={inquiries.loading} error={inquiries.error} retry={inquiries.retry}/>
      {inquiries.data && <DataTable
        table={inquiryTable} columns={inquiryColumns} rowKey={row => row.id}
        label="Build inquiries" searchPlaceholder="Use case, customer or email"
        empty="No inquiries yet. One arrives when a customer finds no use case that fits them."
        filters={<label className="w-full sm:w-48"><span className="text-xs">Status</span>
          <select value={inquiryStatus} onChange={event => setInquiryStatus(event.target.value as '' | InquiryStatus)}>
            <option value="">All statuses</option>
            {INQUIRY_STATUSES.map(status => <option key={status} value={status}>{INQUIRY_LABELS[status]}</option>)}
          </select></label>}/>}
    </> : <>
      <Feedback loading={requests.loading} error={requests.error} retry={requests.retry}/>
      {requests.data && <>
        {requests.data.length >= 200 && <p className="notice note mb-4">Showing the 200 most recent requests. Dashboard totals include all of them.</p>}
        <DataTable
          table={requestTable} columns={requestColumns} rowKey={row => row.id}
          label="Review requests" searchPlaceholder="Build, customer or email"
          empty="No review requests yet. One arrives when a customer submits a saved build."
          filters={<label className="w-full sm:w-48"><span className="text-xs">Status</span>
            <select value={requestStatus} onChange={event => setRequestStatus(event.target.value as '' | RequestStatus)}>
              <option value="">All statuses</option>
              {REQUEST_STATUSES.map(status => <option key={status} value={status}>{REQUEST_LABELS[status]}</option>)}
            </select></label>}/>
      </>}
    </>}

    <Drawer open={Boolean(openInquiry)} onClose={() => { setOpenInquiry(null); setClosing(false); }}
      title={openInquiry?.useCase || 'Inquiry'}
      description={openInquiry ? `${pesos(openInquiry.budget)} · ${openInquiry.customer?.name || 'Customer'} · sent ${buildDate(openInquiry.createdAt)}` : undefined}
      footer={openInquiry && (openInquiry.status === 'open' || openInquiry.status === 'answered') ? <>
        <Link className="button light" to={'/admin/plan?inquiry=' + openInquiry.id}>
          {openInquiry.status === 'answered' ? 'Revise the build' : 'Build a parts list'} <span aria-hidden="true">↗</span>
        </Link>
        {openInquiry.status === 'open' && <button type="button" className="button secondary" onClick={() => setClosing(true)} disabled={detailBusy}>Close without a build</button>}
      </> : undefined}>
      {openInquiry && <>
        <span className={'tag ' + INQUIRY_TONES[openInquiry.status]}>{INQUIRY_LABELS[openInquiry.status]}</span>
        {openInquiry.customer && <p className="text-sm text-muted mt-4 break-words">{openInquiry.customer.email}</p>}
        {openInquiry.details && <div className="notice note mt-4"><strong className="block text-xs mb-1">What the customer said</strong><p className="whitespace-pre-wrap break-words">{openInquiry.details}</p></div>}
        {openInquiry.reply && <div className="notice note mt-3"><strong className="block text-xs mb-1">Your last message</strong><p className="whitespace-pre-wrap break-words">{openInquiry.reply}</p></div>}
        {detailBusy && <p role="status" className="text-sm text-muted mt-4">Loading…</p>}
        {openInquiry.proposal ? <div className="mt-5">
          <div className="flex flex-wrap justify-between gap-3"><h3 className="text-sm font-semibold">{openInquiry.proposal.name}</h3><strong>{pesos(openInquiry.proposal.total)}</strong></div>
          <div className="mt-3"><Parts items={openInquiry.proposal.items}/></div>
        </div> : <p className="text-sm text-muted mt-5">No parts list sent yet.</p>}
        {closing && <div className="notice warning mt-5">
          <p className="text-sm">Close without sending a build? Tell the customer why.</p>
          <label htmlFor="close-reply" className="mt-3 block text-sm">Message to the customer</label>
          <input id="close-reply" value={reply} maxLength={1000} onChange={event => setReply(event.target.value)} placeholder="We cannot cover this budget right now."/>
          <div className="flex flex-wrap gap-3 mt-4">
            <button type="button" className="button" onClick={closeInquiry} disabled={detailBusy}>{detailBusy ? 'Closing…' : 'Close the inquiry'}</button>
            <button type="button" className="button secondary" onClick={() => setClosing(false)} disabled={detailBusy}>Cancel</button>
          </div>
        </div>}
      </>}
    </Drawer>

    <Drawer open={Boolean(openRequest)} onClose={() => setOpenRequest(null)}
      title={openRequest?.snapshot.name || 'Request'}
      description={openRequest ? `${openRequest.owner.name} · submitted ${buildDate(openRequest.createdAt)}` : undefined}
      footer={openRequest && openRequest.status !== 'completed' && openRequest.status !== 'rejected' ? (
        openRequest.status === 'pending' ? <>
          <button type="button" className="button light" onClick={() => updateRequest('approved')} disabled={detailBusy}>Approve</button>
          <button type="button" className="button secondary text-danger" onClick={() => updateRequest('rejected')} disabled={detailBusy}>Reject</button>
        </> : <button type="button" className="button light" onClick={() => updateRequest('completed')} disabled={detailBusy}>Mark completed</button>
      ) : undefined}>
      {openRequest && <>
        <div className="flex flex-wrap items-center gap-3">
          <span className={'tag ' + REQUEST_TONES[openRequest.status]}>{REQUEST_LABELS[openRequest.status]}</span>
          <span className="text-xs text-muted">Request {openRequest.id.slice(-6).toUpperCase()}</span>
        </div>
        <p className="text-sm text-muted mt-3 break-words">{openRequest.owner.email}</p>
        <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 text-sm">
          <p>Submission total <strong>{pesos(openRequest.snapshot.total)}</strong></p>
          <p className="text-muted">Budget {pesos(openRequest.snapshot.budget)}</p>
        </div>
        {openRequest.note && <div className="notice note mt-4"><strong className="block text-xs mb-1">Customer note</strong><p className="whitespace-pre-wrap break-words">{openRequest.note}</p></div>}
        {openRequest.remarks && <div className="notice note mt-3"><strong className="block text-xs mb-1">Your remarks</strong><p className="whitespace-pre-wrap break-words">{openRequest.remarks}</p></div>}
        <div className="mt-5"><h3 className="text-sm font-semibold mb-3">Submitted parts ({openRequest.snapshot.items.length})</h3><Parts items={openRequest.snapshot.items}/></div>
        {openRequest.status !== 'completed' && openRequest.status !== 'rejected' && <div className="mt-5">
          <label htmlFor="remarks">Remarks to the customer <span className="font-normal text-muted">(optional)</span></label>
          <input id="remarks" value={remarks} maxLength={1000} disabled={detailBusy} onChange={event => setRemarks(event.target.value)}/>
          <p className="text-xs text-muted mt-2">{openRequest.status === 'pending'
            ? 'Approval moves the request forward. Rejection closes it.'
            : 'Mark completed once the build has been fulfilled.'}</p>
        </div>}
      </>}
    </Drawer>
  </section>;
}