import { useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { Feedback } from '../components/Feedback';
import { Parts } from '../components/BuildSummary';
import { pesos } from '../types';
import { INQUIRY_LABELS, INQUIRY_TONES, buildDate, type Inquiry } from '../types/builds';

type Errors = Partial<Record<'useCase' | 'budget' | 'details', string>>;

export function RequestHelp() {
  const [params] = useSearchParams();
  const inquiries = useApi<Inquiry[]>('/inquiries');
  const suggested = Number(params.get('budget'));
  const [useCase, setUseCase] = useState('');
  const [budget, setBudget] = useState(Number.isFinite(suggested) && suggested > 0 ? String(suggested) : '');
  const [details, setDetails] = useState('');
  const [fields, setFields] = useState<Errors>({});
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Inquiry | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const submitting = useRef(false);

  async function openInquiry(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetail(null); setDetailBusy(true); setError('');
    try {
      const response = await api.get<Inquiry>('/inquiries/' + id);
      setDetail(response.data);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setDetailBusy(false); }
  }

  async function respond(id: string, action: 'accept' | 'decline') {
    setError(''); setFeedback(''); setDetailBusy(true);
    try {
      const response = await api.patch<{ message: string }>(`/inquiries/${id}/${action}`);
      setFeedback(response.data.message);
      setOpenId(null); setDetail(null);
      inquiries.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setDetailBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(''); setFeedback('');
    const errors: Errors = {};
    if (!useCase.trim() || useCase.trim().length > 120) errors.useCase = 'Say what you will use the PC for, up to 120 characters.';
    const amount = Number(budget);
    if (!budget.trim() || !Number.isSafeInteger(amount) || amount <= 0) errors.budget = 'Enter a whole-peso budget above zero.';
    if (details.length > 1000) errors.details = 'Keep the extra details under 1,000 characters.';
    setFields(errors);
    if (Object.keys(errors).length) { setError('Check the highlighted fields.'); return; }

    submitting.current = true; setBusy(true);
    try {
      await api.post('/inquiries', { useCase: useCase.trim(), budget: amount, details: details.trim() });
      setFeedback('Sent. The shop will put a parts list together and it will appear below.');
      setUseCase(''); setBudget(''); setDetails(''); setFields({});
      inquiries.retry();
    } catch (failure) {
      setError(errorMessage(failure));
      if (isAxiosError(failure) && failure.response?.data?.fields) setFields(failure.response.data.fields as Errors);
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section className="max-w-4xl mx-auto">
    <div className="mb-6">
      <span className="eyebrow">NOTHING FITS?</span><h1>Ask the shop to build it.</h1>
      <p className="intro !mb-0">Tell them your budget and what you need the PC for. They will put a parts list together and send it back for you to accept.</p>
    </div>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {feedback && <p role="status" className="notice note mb-5">{feedback}</p>}

    <form className="panel grid gap-5" onSubmit={submit}>
      <div>
        <label htmlFor="use-case">What will you use it for?</label>
        <input id="use-case" value={useCase} maxLength={120} disabled={busy} placeholder="3D rendering and animation"
          onChange={event => { setUseCase(event.target.value); setFields(current => ({ ...current, useCase: undefined })); }}
          aria-invalid={Boolean(fields.useCase)}/>
        {fields.useCase && <p role="alert" className="field-error">{fields.useCase}</p>}
      </div>
      <div className="sm:max-w-[16rem]">
        <label htmlFor="inquiry-budget">Your budget (PHP)</label>
        <input id="inquiry-budget" type="number" min="1" step="1" value={budget} disabled={busy}
          onChange={event => { setBudget(event.target.value); setFields(current => ({ ...current, budget: undefined })); }}
          aria-invalid={Boolean(fields.budget)}/>
        {fields.budget && <p role="alert" className="field-error">{fields.budget}</p>}
      </div>
      <div>
        <label htmlFor="inquiry-details">Anything else they should know <span className="text-muted font-normal">(optional)</span></label>
        <input id="inquiry-details" value={details} maxLength={1000} disabled={busy} placeholder="I already have a monitor and keyboard."
          onChange={event => { setDetails(event.target.value); setFields(current => ({ ...current, details: undefined })); }}
          aria-invalid={Boolean(fields.details)}/>
        {fields.details && <p role="alert" className="field-error">{fields.details}</p>}
      </div>
      <button type="submit" className="button light justify-self-start" disabled={busy}>{busy ? 'Sending…' : 'Send to the shop'}</button>
    </form>

    <section className="mt-12">
      <h2>Your inquiries</h2>
      <Feedback loading={inquiries.loading} error={inquiries.error} retry={inquiries.retry}/>
      {inquiries.data && (!inquiries.data.length
        ? <p className="notice note mt-4">Nothing sent yet. Use the form above and the shop will get back to you here.</p>
        : <div className="space-y-3 mt-4">
          {inquiries.data.map(inquiry => <article className="panel" key={inquiry.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base break-words">{inquiry.useCase}</h3>
                <p className="text-sm text-muted mt-2">{pesos(inquiry.budget)} · sent {buildDate(inquiry.createdAt)}</p>
                {inquiry.details && <p className="text-sm text-muted mt-2 break-words">{inquiry.details}</p>}
              </div>
              <span className={'tag ' + INQUIRY_TONES[inquiry.status]}>{INQUIRY_LABELS[inquiry.status]}</span>
            </div>
            {inquiry.reply && <p className="text-sm mt-3 whitespace-pre-wrap break-words"><span className="font-semibold">From the shop: </span>{inquiry.reply}</p>}
            {inquiry.status === 'accepted' && inquiry.acceptedBuildId &&
              <Link className="button secondary mt-4" to={'/builds/' + inquiry.acceptedBuildId}>Open the saved build <span aria-hidden="true">↗</span></Link>}
            {(inquiry.status === 'answered' || inquiry.proposedBuildId) &&
              <button type="button" className="button secondary mt-4" onClick={() => openInquiry(inquiry.id)} disabled={detailBusy}>
                {openId === inquiry.id ? 'Hide the parts list' : 'See the parts list'}
              </button>}
            {openId === inquiry.id && <div className="mt-5 border-t border-stroke pt-5">
              {detailBusy && !detail && <p role="status" className="text-sm text-muted">Loading the parts list…</p>}
              {detail?.proposal && <>
                <div className="flex flex-wrap justify-between gap-3"><h4 className="text-sm font-semibold">{detail.proposal.name}</h4><strong>{pesos(detail.proposal.total)}</strong></div>
                <div className="mt-3"><Parts items={detail.proposal.items}/></div>
                {detail.status === 'answered' && <div className="flex flex-wrap gap-3 mt-5">
                  <button type="button" className="button" onClick={() => respond(inquiry.id, 'accept')} disabled={detailBusy}>Accept and save to my builds</button>
                  <button type="button" className="button secondary" onClick={() => respond(inquiry.id, 'decline')} disabled={detailBusy}>Decline</button>
                </div>}
                <p className="text-xs text-muted mt-4">Accepting saves a copy to your account. You can open it in the planner and change anything.</p>
              </>}
              {detail && !detail.proposal && <p className="text-sm text-muted">The shop has not attached a parts list yet.</p>}
            </div>}
          </article>)}
        </div>)}
    </section>
  </section>;
}