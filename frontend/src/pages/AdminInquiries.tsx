import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { Feedback } from '../components/Feedback';
import { Parts } from '../components/BuildSummary';
import { pesos } from '../types';
import { INQUIRY_LABELS, INQUIRY_TONES, buildDate, type Inquiry, type InquiryStatus } from '../types/builds';

const FILTERS: Array<{ value: '' | InquiryStatus; label: string }> = [
  { value: '', label: 'All' }, { value: 'open', label: 'Waiting' }, { value: 'answered', label: 'Answered' },
  { value: 'accepted', label: 'Accepted' }, { value: 'declined', label: 'Declined' }, { value: 'closed', label: 'Closed' }
];

export function AdminInquiries() {
  const [status, setStatus] = useState<'' | InquiryStatus>('');
  const inquiries = useApi<Inquiry[]>('/admin/inquiries' + (status ? '?status=' + status : ''));
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Inquiry | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  async function open(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetail(null); setDetailBusy(true); setError('');
    try {
      const response = await api.get<Inquiry>('/admin/inquiries/' + id);
      setDetail(response.data);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setDetailBusy(false); }
  }

  async function close(id: string) {
    setError(''); setFeedback(''); setDetailBusy(true);
    try {
      const response = await api.patch<{ message: string }>('/admin/inquiries/' + id + '/close', { reply: reply.trim() });
      setFeedback(response.data.message);
      setClosingId(null); setReply(''); setOpenId(null); setDetail(null);
      inquiries.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setDetailBusy(false); }
  }

  const waiting = (inquiries.data || []).filter(inquiry => inquiry.status === 'open').length;

  return <section className="max-w-4xl mx-auto">
    <div className="mb-6">
      <span className="eyebrow">ADMINISTRATION</span><h1>Build inquiries.</h1>
      <p className="intro !mb-0">Customers whose use case no profile covers. Build them a parts list and send it back.</p>
    </div>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {feedback && <p role="status" className="notice note mb-5">{feedback}</p>}
    {waiting > 0 && <p className="notice warning mb-5">{waiting} {waiting === 1 ? 'inquiry is' : 'inquiries are'} waiting for an answer.</p>}

    <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Filter by status">
      {FILTERS.map(filter => <button type="button" key={filter.label}
        className={'button' + (status === filter.value ? '' : ' secondary')}
        aria-pressed={status === filter.value}
        onClick={() => { setStatus(filter.value); setOpenId(null); setDetail(null); }}>{filter.label}</button>)}
    </div>

    <Feedback loading={inquiries.loading} error={inquiries.error} retry={inquiries.retry}/>
    {inquiries.data && (!inquiries.data.length
      ? <p className="notice note">No inquiries{status ? ' with this status' : ''} yet.</p>
      : <div className="space-y-3">
        {inquiries.data.map(inquiry => <article className="panel" key={inquiry.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base break-words">{inquiry.useCase}</h2>
              <p className="text-sm text-muted mt-2">{pesos(inquiry.budget)} · {inquiry.customer?.name || 'Account unavailable'} · {buildDate(inquiry.createdAt)}</p>
              {inquiry.details && <p className="text-sm text-muted mt-2 break-words">{inquiry.details}</p>}
            </div>
            <span className={'tag ' + INQUIRY_TONES[inquiry.status]}>{INQUIRY_LABELS[inquiry.status]}</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {(inquiry.status === 'open' || inquiry.status === 'answered') &&
              <Link className="button" to={'/admin/plan?inquiry=' + inquiry.id}>{inquiry.status === 'answered' ? 'Revise the build' : 'Build a parts list'} <span aria-hidden="true">↗</span></Link>}
            <button type="button" className="button secondary" onClick={() => open(inquiry.id)} disabled={detailBusy}>
              {openId === inquiry.id ? 'Hide details' : 'View details'}
            </button>
            {inquiry.status === 'open' && <button type="button" className="button secondary" onClick={() => { setClosingId(inquiry.id); setReply(''); }} disabled={detailBusy}>Close without a build</button>}
          </div>

          {closingId === inquiry.id && <div className="notice warning mt-4" role="alertdialog" aria-label="Close this inquiry">
            <p className="text-sm">Close this inquiry without sending a build? Tell the customer why.</p>
            <label htmlFor="close-reply" className="mt-3 block text-sm">Message to the customer</label>
            <input id="close-reply" value={reply} maxLength={1000} onChange={event => setReply(event.target.value)}
              placeholder="We cannot cover this budget right now."/>
            <div className="flex flex-wrap gap-3 mt-4">
              <button type="button" className="button" onClick={() => close(inquiry.id)} disabled={detailBusy}>{detailBusy ? 'Closing…' : 'Close the inquiry'}</button>
              <button type="button" className="button secondary" onClick={() => setClosingId(null)} disabled={detailBusy}>Cancel</button>
            </div>
          </div>}

          {openId === inquiry.id && <div className="mt-5 border-t border-stroke pt-5">
            {detailBusy && !detail && <p role="status" className="text-sm text-muted">Loading…</p>}
            {detail && <>
              <p className="text-sm text-muted">{detail.customer?.email}</p>
              {detail.reply && <p className="text-sm mt-3 whitespace-pre-wrap break-words"><span className="font-semibold">Your last message: </span>{detail.reply}</p>}
              {detail.proposal ? <>
                <div className="flex flex-wrap justify-between gap-3 mt-4"><h3 className="text-sm font-semibold">{detail.proposal.name}</h3><strong>{pesos(detail.proposal.total)}</strong></div>
                <div className="mt-3"><Parts items={detail.proposal.items}/></div>
              </> : <p className="text-sm text-muted mt-3">No parts list sent yet.</p>}
            </>}
          </div>}
        </article>)}
      </div>)}
  </section>;
}