import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTableState } from '../hooks/useTableState';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { api, errorMessage } from '../api/axios';
import { Builder } from './Builder';
import { pesos, type Item, type Plan } from '../types';
import { buildDate } from '../types/builds';
import type { Inquiry, SavedBuild } from '../types/builds';

// The shop's own planner. With ?inquiry=<id> it answers a customer who could
// not find a use case that fits. Without one it builds a suggestion to publish.
export function AdminPlanner() {
  const [params, setParams] = useSearchParams();
  const inquiryId = params.get('inquiry');
  const buildId = params.get('build');
  const tab = params.get('tab') === 'showcase' && !inquiryId ? 'showcase' : 'planner';
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan>({ budget: 50000, profileSlug: 'general', items: [] });
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(Boolean(params.get('inquiry') || params.get('build')));
  const [name, setName] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showcase, setShowcase] = useState<SavedBuild[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const showcaseTable = useTableState<SavedBuild>({
    rows: showcase,
    searchText: row => [row.name, row.profileSlug].join(' '),
    sortValues: {
      name: row => row.name.toLowerCase(),
      total: row => row.total,
      updatedAt: row => new Date(row.updatedAt).getTime()
    },
    initialSort: { key: 'updatedAt', direction: 'desc' }
  });

  const loadShowcase = () => api.get<SavedBuild[]>('/showcase')
    .then(response => setShowcase(response.data)).catch(() => setShowcase([]));
  useEffect(() => { if (!inquiryId) loadShowcase(); }, [inquiryId]);

  // Opening ?build=<id> loads a published suggestion back into the planner so
  // it can be corrected instead of republished as a duplicate.
  useEffect(() => {
    if (!buildId) return;
    let cancelled = false;
    setLoading(true);
    api.get<SavedBuild>('/builds/' + buildId)
      .then(response => {
        if (cancelled) return;
        setName(response.data.name);
        setPlan(current => ({ ...current, budget: response.data.budget, profileSlug: response.data.profileSlug, items: response.data.items as Item[] }));
      })
      .catch(failure => { if (!cancelled) setError(errorMessage(failure)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buildId]);

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

  function switchTab(next: 'planner' | 'showcase') {
    const updated = new URLSearchParams(params);
    if (next === 'showcase') updated.set('tab', 'showcase'); else updated.delete('tab');
    setParams(updated, { replace: true });
    setError(''); setFeedback('');
  }

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
      const id = buildId || (await api.post<SavedBuild>('/builds', payload())).data.id;
      if (buildId) await api.put('/builds/' + buildId, payload());
      await api.patch('/builds/' + id + '/visibility', { visibility: 'published' });
      setFeedback(name.trim() + (buildId ? ' was updated on the landing page.' : ' is now on the landing page for customers to see.'));
      loadShowcase();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  async function unpublish(build: SavedBuild) {
    setError(''); setFeedback(''); setRowBusy(build.id);
    try {
      const response = await api.patch<{ message: string }>('/builds/' + build.id + '/visibility', { visibility: 'private' });
      setFeedback(response.data.message);
      loadShowcase();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setRowBusy(null); }
  }

  const showcaseColumns: DataTableColumn<SavedBuild>[] = [
    { key: 'name', header: 'Build', sortable: true, render: row => <>
      <p className="font-medium break-words">{row.name}</p>
      <p className="text-xs text-muted mt-1">{row.items.length} of 7 categories · {row.profileSlug.replace(/-/g, ' ')}</p>
    </> },
    { key: 'total', header: 'Total', sortable: true, align: 'right', render: row => pesos(row.total) },
    { key: 'updatedAt', header: 'Updated', sortable: true, hideBelow: 'md', render: row => <span className="text-xs text-muted">{buildDate(row.updatedAt)}</span> },
    { key: 'actions', header: 'Actions', align: 'right', render: row => <div className="flex flex-wrap justify-end gap-2">
      <Link className="button secondary !py-1.5" to={'/admin/plan?build=' + row.id}>Edit</Link>
      <button type="button" className="button secondary !py-1.5" onClick={() => unpublish(row)} disabled={rowBusy === row.id}>
        {rowBusy === row.id ? 'Removing…' : 'Unpublish'}
      </button>
    </div> }
  ];

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
      {busy ? 'Saving…' : inquiryId ? 'Send to the customer' : buildId ? 'Save changes' : 'Publish to the landing page'}
    </button>
    {!plan.items.length && <p className="text-xs text-muted mt-3">Choose some parts first.</p>}
    {error && <p role="alert" className="notice error mt-4">{error}</p>}
    {feedback && <p role="status" className="notice note mt-4">{feedback}</p>}
  </section>;

  if (loading) return <p role="status" className="text-muted">Loading the inquiry…</p>;

  return <>
    <span className="eyebrow">ADMINISTRATION</span><h1>Planner.</h1>
    <p className="intro">{inquiryId
      ? 'Building a parts list for a customer inquiry. Pick a use case as a starting point, or set your own shares in the budget split.'
      : 'Build a suggestion for the landing page, or answer an inquiry from the customer queue.'}</p>
    {!inquiryId && <div className="tab-row" role="tablist" aria-label="Planner view">
      <button type="button" role="tab" aria-selected={tab === 'planner'} className={'tab' + (tab === 'planner' ? ' active' : '')} onClick={() => switchTab('planner')}>Planner</button>
      <button type="button" role="tab" aria-selected={tab === 'showcase'} className={'tab' + (tab === 'showcase' ? ' active' : '')} onClick={() => switchTab('showcase')}>
        Landing page{showcase.length > 0 && <span className="tab-count">{showcase.length}</span>}
      </button>
    </div>}

    {tab === 'planner'
      ? <Builder plan={plan} setPlan={setPlan} actions={actions} showSave={false} allowCustomSplit showPrint={false}/>
      : <>
        {error && <p role="alert" className="notice error mb-4">{error}</p>}
        {feedback && <p role="status" className="notice note mb-4">{feedback}</p>}
        <DataTable
          table={showcaseTable} columns={showcaseColumns} rowKey={row => row.id}
          label="Published suggestions" searchPlaceholder="Build name or use case"
          empty="Nothing published yet. Build something on the Planner tab and publish it."/>
      </>}
  </>;
}