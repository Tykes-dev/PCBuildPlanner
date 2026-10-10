import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { Parts } from '../components/BuildSummary';
import { Feedback } from '../components/Feedback';
import { useApi } from '../hooks/useApi';
import { CATEGORIES, LABELS, pesos, type Plan } from '../types';
import { REQUEST_LABELS, REQUEST_TONES, buildDate, profileLabel, type BuildRequest, type ReopenedBuild, type SavedBuild } from '../types/builds';

export function BuildDetails({ setPlan }: { setPlan: (plan: Plan) => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [build, setBuild] = useState<SavedBuild | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState('');
  const actionInProgress = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const requests = useApi<BuildRequest[]>('/requests');
  const [newRequests, setNewRequests] = useState<BuildRequest[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(''); setBuild(null); setError(''); setSuccess('');
    setEditingName(false); setNote(''); setNewRequests([]);
    api.get<SavedBuild>('/builds/' + id, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setBuild(response.data); setName(response.data.name); } })
      .catch(failure => { if (!controller.signal.aborted) setLoadError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);

  const history = [...(requests.data || []), ...newRequests]
    .filter((request, index, all) => request.buildId === id && all.findIndex(item => item.id === request.id) === index)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const hasActiveRequest = history.some(request => request.status === 'pending' || request.status === 'approved');
  const missingCategories = CATEGORIES.filter(category => !build?.items.some(item => item.component.category === category));

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (!build || actionInProgress.current) return;
    if (!name.trim()) { setError('Give your build a name.'); return; }
    actionInProgress.current = true; setAction('rename'); setError(''); setSuccess('');
    try {
      const response = await api.patch<SavedBuild>('/builds/' + build.id, { name: name.trim() });
      setBuild(response.data); setName(response.data.name); setEditingName(false); setSuccess('Build renamed.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { actionInProgress.current = false; setAction(''); }
  }
  async function duplicate() {
    if (!build || actionInProgress.current) return;
    actionInProgress.current = true; setAction('duplicate'); setError(''); setSuccess('');
    try {
      const response = await api.post<SavedBuild>('/builds/' + build.id + '/duplicate', {});
      navigate('/builds/' + response.data.id);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { actionInProgress.current = false; setAction(''); }
  }
  async function reopen() {
    if (!build || actionInProgress.current) return;
    actionInProgress.current = true; setAction('reopen'); setError(''); setSuccess('');
    try {
      const response = await api.post<ReopenedBuild>('/builds/' + build.id + '/reopen', {});
      setPlan({ ...response.data.plan, savedBuildId: build.id, name: build.name, reopenNotices: response.data.notices });
      navigate('/builder');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { actionInProgress.current = false; setAction(''); }
  }
  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (!build || actionInProgress.current || hasActiveRequest) return;
    actionInProgress.current = true; setAction('submit'); setError(''); setSuccess('');
    try {
      const response = await api.post<BuildRequest>('/requests', { buildId: build.id, note: note.trim() });
      setNewRequests(current => [response.data, ...current]); setNote('');
      setSuccess('Your build request has been submitted. Follow its status below or in Saved builds.');
      requests.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { actionInProgress.current = false; setAction(''); }
  }

  return <>
    <Link to="/builds" className="text-link mb-5"><span aria-hidden="true">←</span> Saved builds</Link>
    <Feedback loading={loading} error={loadError} retry={() => setAttempt(current => current + 1)}/>
    {build && <>
      <div className="flex flex-col sm:flex-row justify-between gap-5 items-start">
        <div className="min-w-0 flex-1"><span className="eyebrow">BUILD DETAILS · {profileLabel(build.profileSlug)}</span><h1 className="break-words">{build.name}</h1><p className="intro mb-0">Saved {buildDate(build.createdAt)} · Updated {buildDate(build.updatedAt)}</p></div>
        <div className="flex flex-wrap shrink-0 gap-3 no-print">
          <button className="button" disabled={!!action} onClick={() => void reopen()}>{action === 'reopen' ? 'Opening…' : 'Reopen in planner'}</button>
          <button className="button secondary" disabled={!!action} onClick={() => void duplicate()}>{action === 'duplicate' ? 'Duplicating…' : 'Duplicate'}</button>
        </div>
      </div>
      {error && <p className="notice error mt-5" role="alert">{error}</p>}
      {success && <p className="notice note mt-5" role="status">{success}</p>}
      <div className="grid sm:grid-cols-3 gap-4 mt-6">
        <div className="panel"><span className="eyebrow">SAVED TOTAL</span><p className="text-2xl font-semibold mt-2">{pesos(build.total)}</p></div>
        <div className="panel"><span className="eyebrow">BUDGET</span><p className="text-2xl font-semibold mt-2">{pesos(build.budget)}</p><p className={'text-xs mt-2 ' + (build.total > build.budget ? 'text-danger' : 'text-muted')}>{pesos(Math.abs(build.budget - build.total))} {build.total > build.budget ? 'over budget' : 'remaining'}</p></div>
        <div className="panel"><span className="eyebrow">SELECTED CATEGORIES</span><p className="text-2xl font-semibold mt-2">{CATEGORIES.length - missingCategories.length} / {CATEGORIES.length}</p><p className="text-xs text-muted mt-2">{missingCategories.length ? 'Draft in progress' : 'All categories selected'}</p></div>
      </div>
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 mt-6 items-start">
        <section className="panel">
          <div className="flex flex-wrap justify-between gap-3 items-center"><h2>Saved parts</h2><span className="tag">Price snapshot</span></div>
          <p className="text-sm text-muted mt-3">These parts and prices were captured when you saved. Reopening refreshes catalog prices and removes unavailable parts so you can choose replacements.</p>
          {build.items.length ? <Parts items={build.items}/> : <p className="text-muted mt-5">No parts selected in this draft yet.</p>}
          {!!missingCategories.length && <p className="notice note mt-4">Still to choose: {missingCategories.map(category => LABELS[category]).join(', ')}.</p>}
          <div className="flex flex-wrap justify-between gap-3 border-t border-stroke pt-4 mt-4"><strong>Total</strong><strong>{pesos(build.total)}</strong></div>
        </section>
        <div className="space-y-5 no-print">
          <section className="panel">
            <h2>Build name</h2>
            {editingName ? <form className="mt-4" onSubmit={rename}>
              <label htmlFor="rename-build">Name<input id="rename-build" value={name} onChange={event => setName(event.target.value)} maxLength={100} required autoFocus disabled={!!action}/></label>
              <div className="flex flex-wrap gap-3 mt-4"><button className="button" disabled={!!action}>{action === 'rename' ? 'Renaming…' : 'Save name'}</button><button type="button" className="button secondary" disabled={!!action} onClick={() => { setEditingName(false); setName(build.name); }}>Cancel</button></div>
            </form> : <><p className="text-sm text-muted mt-3 break-words">{build.name}</p><button className="button secondary mt-4" disabled={!!action} onClick={() => setEditingName(true)}>Rename build</button></>}
          </section>
          <section className="panel">
            <span className="eyebrow">ADMIN REVIEW</span><h2 className="mt-2">Submit a build request.</h2>
            <p className="text-sm text-muted mt-3">Submit these selected parts using current catalog prices and specifications. Reopen the planner first to review changes. Complete all categories and resolve compatibility or stock issues before submitting.</p>
            {hasActiveRequest ? <p className="notice warning mt-4">You already have a pending or approved request for this build. Follow its status below.</p> : <form className="mt-4" onSubmit={submitRequest}>
              <label htmlFor="request-note">Note to the administrator (optional)</label>
              <textarea id="request-note" className="w-full rounded-lg border border-stroke bg-control px-3 py-2.5 mt-2 text-ink text-sm" rows={3} maxLength={1000} placeholder="Anything you want the reviewer to know?" value={note} disabled={!!action} onChange={event => setNote(event.target.value)}/>
              <button className="button mt-4" disabled={!!action}>{action === 'submit' ? 'Submitting…' : 'Submit build request'}</button>
            </form>}
            <p className="text-xs text-muted mt-4">Requests keep their own copy of the submitted build. Saving or renaming later does not change an existing request.</p>
          </section>
        </div>
      </div>
      <section className="mt-8 no-print">
        <h2 className="mb-4">Recent requests for this build</h2>{(requests.data?.length || 0) >= 200 && <p className="text-xs text-muted mb-4">From your 200 most recent requests.</p>}
        <Feedback loading={requests.loading && !newRequests.length} error={requests.error} retry={requests.retry}/>
        {!requests.loading && !requests.error && !history.length && <p className="panel text-sm text-muted">No requests submitted for this build yet.</p>}
        <div className="space-y-3">{history.map(request => <article className="panel" key={request.id}>
          <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold break-words">{request.snapshot.name}</h3><p className="text-xs text-muted mt-2">Submitted {buildDate(request.createdAt)} · Updated {buildDate(request.updatedAt)} · {pesos(request.snapshot.total)}</p></div><span className={'tag ' + REQUEST_TONES[request.status]}>{REQUEST_LABELS[request.status]}</span></div>
          <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">View submitted parts ({request.snapshot.items.length})</summary><div className="mt-3"><Parts items={request.snapshot.items}/></div></details>
          {request.note && <p className="text-sm text-muted mt-3 whitespace-pre-wrap break-words"><span className="font-semibold">Your note: </span>{request.note}</p>}
          {request.remarks && <p className="notice note mt-3 whitespace-pre-wrap break-words"><strong>Administrator remarks: </strong>{request.remarks}</p>}
        </article>)}</div>
      </section>
    </>}
  </>;
}




