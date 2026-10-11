import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { useTableState } from '../hooks/useTableState';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { Feedback } from '../components/Feedback';
import { IconButton } from '../components/Icon';
import { Parts } from '../components/BuildSummary';
import { inquirySchema, toInquiryPayload, type InquiryFormValues } from '../schemas/inquiry';
import { pesos } from '../types';
import { INQUIRY_LABELS, INQUIRY_TONES, buildDate, type Inquiry } from '../types/builds';

export function RequestHelp() {
  const [params] = useSearchParams();
  const inquiries = useApi<Inquiry[]>('/inquiries');
  const suggested = Number(params.get('budget'));
  const [askOpen, setAskOpen] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<Inquiry | null>(null);
  const [detail, setDetail] = useState<Inquiry | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  // Arriving from the recommendation page with ?budget= pre-fills the amount.
  const { register, handleSubmit, reset, setError: setFieldError,
    formState: { errors, isSubmitting } } = useForm<InquiryFormValues>({
      resolver: zodResolver(inquirySchema),
      defaultValues: { useCase: '', details: '', budget: Number.isFinite(suggested) && suggested > 0 ? String(suggested) : '' }
    });
  const busy = isSubmitting;

  const rows = useMemo(() => (inquiries.data || []).filter(row => !status || row.status === status),
    [inquiries.data, status]);
  const table = useTableState<Inquiry>({
    rows,
    searchText: row => row.useCase + ' ' + row.details,
    sortValues: {
      useCase: row => row.useCase.toLowerCase(),
      budget: row => row.budget,
      status: row => row.status,
      createdAt: row => Date.parse(row.createdAt)
    },
    initialSort: { key: 'createdAt', direction: 'desc' }
  });

  // The list only carries the summary, so the parts list is fetched when the
  // customer opens one rather than for every row up front.
  async function view(inquiry: Inquiry) {
    setOpen(inquiry); setDetail(null); setDetailBusy(true); setError('');
    try {
      const response = await api.get<Inquiry>('/inquiries/' + inquiry.id);
      setDetail(response.data);
    } catch (failure) { setError(errorMessage(failure)); setOpen(null); }
    finally { setDetailBusy(false); }
  }

  async function respond(id: string, choice: 'accept' | 'decline') {
    setError(''); setFeedback(''); setDetailBusy(true);
    try {
      const response = await api.patch<{ message: string }>(`/inquiries/${id}/${choice}`);
      setFeedback(response.data.message);
      setOpen(null); setDetail(null);
      inquiries.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setDetailBusy(false); }
  }

  async function onSubmit(values: InquiryFormValues) {
    setError(''); setFeedback('');
    try {
      await api.post('/inquiries', toInquiryPayload(values));
      setFeedback('Sent. The shop will put a parts list together and it will appear in your list.');
      reset({ useCase: '', budget: '', details: '' });
      setAskOpen(false);
      inquiries.retry();
    } catch (failure) {
      setError(errorMessage(failure));
      if (isAxiosError(failure) && failure.response?.data?.fields) {
        for (const [key, message] of Object.entries(failure.response.data.fields as Record<string, unknown>)) {
          if (['useCase', 'budget', 'details'].includes(key) && typeof message === 'string') {
            setFieldError(key as keyof InquiryFormValues, { message });
          }
        }
      }
    }
  }

  const columns: DataTableColumn<Inquiry>[] = [
    { key: 'useCase', header: 'What you asked for', sortable: true, render: row => <>
      <p className="row-title">{row.useCase}</p>
      {row.details && <p className="row-sub line-clamp-2 break-words">{row.details}</p>}
    </> },
    { key: 'budget', header: 'Budget', sortable: true, align: 'right', numeric: true, render: row => pesos(row.budget) },
    { key: 'status', header: 'Status', sortable: true, render: row =>
      <span className={'tag ' + INQUIRY_TONES[row.status]}>{INQUIRY_LABELS[row.status]}</span> },
    { key: 'createdAt', header: 'Sent', sortable: true, hideBelow: 'md', render: row =>
      <span className="row-sub">{buildDate(row.createdAt)}</span> },
    { key: 'actions', header: 'Open', align: 'right', render: row => <div className="row-actions">
      <IconButton icon="open" label={'Open the inquiry for ' + row.useCase} onClick={() => void view(row)} busy={detailBusy && open?.id === row.id}/>
    </div> }
  ];

  const waiting = (inquiries.data || []).filter(row => row.status === 'open').length;
  const ready = (inquiries.data || []).filter(row => row.status === 'answered').length;
  const shown = detail || open;

  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">NOTHING FITS?</span>
        <h1>Ask the shop.</h1>
        <p className="intro">Say what the PC is for and what you can spend. The shop puts a parts list together and sends it back for you to accept.</p>
      </div>
      <button type="button" className="button light" onClick={() => { setAskOpen(true); setError(''); setFeedback(''); }}>
        New request <span aria-hidden="true">↗</span>
      </button>
    </div>

    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {feedback && <p role="status" className="notice note mb-5">{feedback}</p>}

    {Boolean(ready) && <p className="notice warning mb-5">
      {ready === 1 ? 'One build is ready for you.' : ready + ' builds are ready for you.'} Open it to see the parts and accept or decline.
    </p>}

    <div className="stat-strip">
      <div><span className="eyebrow">Requests sent</span><strong>{inquiries.data ? inquiries.data.length : '—'}</strong></div>
      <div><span className="eyebrow">Waiting on the shop</span><strong>{inquiries.data ? waiting : '—'}</strong></div>
      <div><span className="eyebrow">Ready for you</span><strong>{inquiries.data ? ready : '—'}</strong></div>
    </div>

    <Feedback loading={inquiries.loading} error={inquiries.error} retry={inquiries.retry}/>
    {inquiries.data && (!inquiries.data.length
      ? <section className="panel empty-state">
          <h2>Nothing sent yet.</h2>
          <p>If none of the use cases on the recommendation page describe what you need, describe it here instead and the shop will build it by hand.</p>
          <button type="button" className="button light" onClick={() => setAskOpen(true)}>Send your first request <span aria-hidden="true">↗</span></button>
        </section>
      : <DataTable
          table={table} columns={columns} rowKey={row => row.id}
          label="Your requests to the shop" searchPlaceholder="Search what you asked for"
          empty="Nothing sent yet."
          filters={<label className="w-full sm:w-48"><span className="text-xs">Status</span>
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(INQUIRY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>}/>)}

    <Drawer open={askOpen} onClose={() => setAskOpen(false)} title="Ask the shop to build it"
      description="Three fields. The shop replies with a full parts list."
      footer={<>
        <button type="submit" form="ask-form" className="button light" disabled={busy}>{busy ? 'Sending…' : 'Send to the shop'}</button>
        <button type="button" className="button secondary" onClick={() => setAskOpen(false)} disabled={busy}>Cancel</button>
      </>}>
      <form id="ask-form" noValidate className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="use-case">What will you use it for?</label>
          <input id="use-case" {...register('useCase')} maxLength={120} disabled={busy}
            placeholder="3D rendering and animation" aria-invalid={Boolean(errors.useCase)}/>
          {errors.useCase && <p role="alert" className="field-error">{errors.useCase.message}</p>}
        </div>
        <div className="sm:max-w-[16rem]">
          <label htmlFor="inquiry-budget">Your budget in pesos</label>
          <input id="inquiry-budget" type="number" min="1" step="1" {...register('budget')} disabled={busy}
            aria-invalid={Boolean(errors.budget)}/>
          {errors.budget && <p role="alert" className="field-error">{errors.budget.message}</p>}
        </div>
        <div>
          <label htmlFor="inquiry-details">Anything else they should know <span className="text-muted font-normal">(optional)</span></label>
          <textarea id="inquiry-details" className="w-full rounded-lg border border-stroke bg-control px-3 py-2.5 mt-2 text-ink text-sm"
            rows={3} maxLength={1000} {...register('details')} disabled={busy}
            placeholder="I already have a monitor and keyboard." aria-invalid={Boolean(errors.details)}/>
          {errors.details && <p role="alert" className="field-error">{errors.details.message}</p>}
        </div>
      </form>
    </Drawer>

    <Drawer open={Boolean(open)} onClose={() => { setOpen(null); setDetail(null); }} wide
      title={shown?.useCase || ''}
      description={shown ? pesos(shown.budget) + ' · sent ' + buildDate(shown.createdAt) : ''}
      footer={detail?.status === 'answered' ? <>
        <button type="button" className="button light" onClick={() => void respond(detail.id, 'accept')} disabled={detailBusy}>Accept and save to my builds</button>
        <button type="button" className="button secondary" onClick={() => void respond(detail.id, 'decline')} disabled={detailBusy}>Decline</button>
      </> : null}>
      {detailBusy && !detail && <p role="status" className="text-sm text-muted">Loading…</p>}
      {detail && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={'tag ' + INQUIRY_TONES[detail.status]}>{INQUIRY_LABELS[detail.status]}</span>
          {detail.proposal && <strong className="cell-num">{pesos(detail.proposal.total)}</strong>}
        </div>
        {detail.details && <p className="feed-quote mt-4"><span>What you asked</span>{detail.details}</p>}
        {detail.reply && <p className="feed-quote shop mt-3"><span>From the shop</span>{detail.reply}</p>}
        {detail.proposal
          ? <div className="mt-5">
              <div className="panel-head"><h3 className="text-base">{detail.proposal.name}</h3><span className="row-sub">{detail.proposal.items.length} parts</span></div>
              <Parts items={detail.proposal.items}/>
              <div className="panel-total"><strong>Proposed total</strong><strong className="cell-num">{pesos(detail.proposal.total)}</strong></div>
              {detail.status === 'answered' && <p className="panel-foot">Accepting saves a copy to your account. You can open it in the planner afterwards and change anything.</p>}
            </div>
          : <p className="notice note mt-5">The shop has not attached a parts list yet. It will show up here once they answer.</p>}
        {detail.status === 'accepted' && detail.acceptedBuildId &&
          <Link className="button secondary mt-5" to={'/builds/' + detail.acceptedBuildId}>Open the saved build <span aria-hidden="true">↗</span></Link>}
      </>}
    </Drawer>
  </>;
}