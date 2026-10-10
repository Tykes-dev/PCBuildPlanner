import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { Builder } from './Builder';
import { pesos, type Plan } from '../types';
import type { Inquiry, SavedBuild } from '../types/builds';

// The shop's own planner. With ?inquiry=<id> it answers a customer who could
// not find a use case that fits. Without one it builds a suggestion to publish.
export function AdminPlanner() {
  const [params] = useSearchParams();
  const inquiryId = params.get('inquiry');
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan>({ budget: 50000, profileSlug: 'general', items: [] });
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(Boolean(inquiryId));
  const [name, setName] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!inquiryId) return;
    let cancelled = false;
    setLoading(true);
    api.get<Inquiry>('/admin/inquiries/' + inquiryId)
      .then(response => {
        if (cancelled) return;
        setInquiry(response.data);
        setName(response.data.proposal?.name || response.data.useCase.slice(0, 100));
        setReply(response.data.reply || '');
        // Load the customer's budget, and their existing proposal if revising.
        setPlan(current => ({
          ...current,
          budget: response.data.budget,
          profileSlug: response.data.proposal?.profileSlug || current.profileSlug,
          items: response.data.proposal?.items || []
        }));
      })
      .catch(failure => { if (!cancelled) setError(errorMessage(failure)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [inquiryId]);

  const payload = () => ({
    name: name.trim(), budget: plan.budget, profileSlug: plan.profileSlug,
    items: plan.items.map(item => ({ componentId: item.component._id, quantity: item.quantity }))
  });

  async function send() {
    if (!inquiryId) return;
    setError(''); setFeedback(''); setBusy(true);
    try {
      const response = await api.patch<{ message: string }>('/admin/inquiries/' + inquiryId + '/propose', { ...payload(), reply: reply.trim() });
      setFeedback(response.data.message);
      setTimeout(() => navigate('/admin/inquiries'), 900);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  async function publish() {
    setError(''); setFeedback(''); setBusy(true);
    try {
      const created = await api.post<SavedBuild>('/builds', payload());
      await api.patch('/builds/' + created.data.id + '/visibility', { visibility: 'published' });
      setFeedback(name.trim() + ' is now a published suggestion customers can browse.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  const ready = Boolean(name.trim()) && plan.items.length > 0 && !busy;

  const actions = <section className="panel">
    <h2>{inquiryId ? 'Answer this customer' : 'Publish a suggestion'}</h2>
    {inquiry && <p className="text-sm text-muted mt-2">
      <strong>{inquiry.customer?.name || 'A customer'}</strong> asked for a build for {inquiry.useCase.toLowerCase()} at {pesos(inquiry.budget)}.
    </p>}
    {inquiry?.details && <p className="text-sm text-muted mt-2 break-words">{inquiry.details}</p>}
    <div className="mt-4">
      <label htmlFor="proposal-name">Build name</label>
      <input id="proposal-name" value={name} maxLength={100} disabled={busy}
        onChange={event => setName(event.target.value)} placeholder="Rendering workstation"/>
    </div>
    {inquiryId && <div className="mt-4">
      <label htmlFor="proposal-reply">Message to the customer <span className="text-muted font-normal">(optional)</span></label>
      <input id="proposal-reply" value={reply} maxLength={1000} disabled={busy}
        onChange={event => setReply(event.target.value)} placeholder="This stays under your budget and leaves room to upgrade."/>
    </div>}
    <button type="button" className="button light w-full mt-5" disabled={!ready}
      onClick={inquiryId ? send : publish}>
      {busy ? 'Sending…' : inquiryId ? 'Send to the customer' : 'Publish as a suggestion'}
    </button>
    {!plan.items.length && <p className="text-xs text-muted mt-3">Choose some parts first.</p>}
    {error && <p role="alert" className="notice error mt-4">{error}</p>}
    {feedback && <p role="status" className="notice note mt-4">{feedback}</p>}
  </section>;

  if (loading) return <p role="status" className="text-muted">Loading the inquiry…</p>;

  return <>
    <div className="mb-6"><span className="eyebrow">ADMINISTRATION</span>
      <p className="text-sm text-muted">{inquiryId ? 'Building a parts list for a customer inquiry. Pick a use case as a starting point, or set your own shares in the budget split.' : 'Building a suggestion for the showcase.'}</p></div>
    <Builder plan={plan} setPlan={setPlan} actions={actions} showSave={false} allowCustomSplit/>
  </>;
}