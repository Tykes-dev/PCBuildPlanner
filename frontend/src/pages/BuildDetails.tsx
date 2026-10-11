import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { Parts } from '../components/BuildSummary';
import { Drawer } from '../components/Drawer';
import { Feedback } from '../components/Feedback';
import { IconButton } from '../components/Icon';
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
  const [renaming, setRenaming] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [openRequest, setOpenRequest] = useState<BuildRequest | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const requests = useApi<BuildRequest[]>('/requests');
  const [newRequests, setNewRequests] = useState<BuildRequest[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(''); setBuild(null); setError(''); setSuccess('');
    setRenaming(false); setSubmitOpen(false); setNote(''); setNewRequests([]);
    api.get<SavedBuild>('/builds/' + id, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setBuild(response.data); setName(response.data.name); } })
      .catch(failure => { if (!controller.signal.aborted) setLoadError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);

  const history = [...(requests.data || []), ...newRequests]
    .filter((request, index, all) => request.buildId === id && all.findIndex(item => item.id === request.id) === index)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const active = history.find(request => request.status === 'pending' || request.status === 'approved') || null;
  const missing = CATEGORIES.filter(category => !build?.items.some(item => item.component.category === category));
  const over = build ? build.total > build.budget : false;
  const used = build && build.budget ? Math.min(100, Math.round((build.total / build.budget) * 100)) : 0;

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (!build || actionInProgress.current) return;
    if (!name.trim()) { setError('Give your build a name.'); return; }
    actionInProgress.current = true; setAction('rename'); setError(''); setSuccess('');
    try {
      const response = await api.patch<SavedBuild>('/builds/' + build.id, { name: name.trim() });
      setBuild(response.data); setName(response.data.name); setRenaming(false); setSuccess('Build renamed.');
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
    if (!build || actionInProgress.current || active) return;
    actionInProgress.current = true; setAction('submit'); setError(''); setSuccess('');
    try {
      const response = await api.post<BuildRequest>('/requests', { buildId: build.id, note: note.trim() });
      setNewRequests(current => [response.data, ...current]); setNote(''); setSubmitOpen(false);
      setSuccess('Request sent. Its status is in the request history below.');
      requests.retry();
    } catch (failure) { setError(errorMessage(failure)); setSubmitOpen(false); }
    finally { actionInProgress.current = false; setAction(''); }
  }

  return <>
    <Link to="/builds" className="text-link mb-5"><span aria-hidden="true">←</span> Saved builds</Link>
    <Feedback loading={loading} error={loadError} retry={() => setAttempt(current => current + 1)}/>
    {build && <>
      <div className="page-head">
        <div className="min-w-0">
          <span className="eyebrow">{profileLabel(build.profileSlug)} · SAVED {buildDate(build.createdAt).toUpperCase()}</span>
          <div className="title-row">
            <h1 className="break-words">{build.name}</h1>
            <IconButton icon="edit" label="Rename this build" onClick={() => { setName(build.name); setRenaming(true); }} disabled={Boolean(action)}/>
          </div>
          <p className="intro mb-0">Last updated {buildDate(build.updatedAt)}.</p>
        </div>
        <div className="head-actions no-print">
          <button className="button light" disabled={Boolean(action)} onClick={() => void reopen()}>{action === 'reopen' ? 'Opening…' : 'Reopen in planner'}</button>
          <button className="button secondary" disabled={Boolean(action)} onClick={() => void duplicate()}>{action === 'duplicate' ? 'Duplicating…' : 'Duplicate'}</button>
        </div>
      </div>

      {error && <p className="notice error mt-5" role="alert">{error}</p>}
      {success && <p className="notice note mt-5" role="status">{success}</p>}

      <div className="summary-bar">
        <div><span className="eyebrow">Saved total</span><strong className="cell-num">{pesos(build.total)}</strong></div>
        <div><span className="eyebrow">Budget</span><strong className="cell-num">{pesos(build.budget)}</strong></div>
        <div><span className="eyebrow">{over ? 'Over budget' : 'Still available'}</span>
          <strong className={'cell-num ' + (over ? 'text-danger' : '')}>{pesos(Math.abs(build.budget - build.total))}</strong></div>
        <div><span className="eyebrow">Categories</span><strong className="cell-num">{CATEGORIES.length - missing.length} / {CATEGORIES.length}</strong></div>
        <div className="summary-meter">
          <span className="budget-track" aria-hidden="true"><span className={over ? 'over' : ''} style={{ width: used + '%' }}/></span>
          <p className="row-sub">{used}% of the budget committed</p>
        </div>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Saved parts</h2>
            <span className="tag">Price snapshot</span>
          </div>
          <p className="panel-note">These prices were captured when you saved. Reopening refreshes them and removes anything no longer available.</p>
          {build.items.length
            ? <Parts items={build.items}/>
            : <p className="text-muted text-sm mt-5">No parts in this draft yet.</p>}
          {Boolean(missing.length) && <p className="notice note mt-4">Still to choose: {missing.map(category => LABELS[category]).join(', ')}.</p>}
          <div className="panel-total"><strong>Total</strong><strong className="cell-num">{pesos(build.total)}</strong></div>
        </section>

        <section className="panel no-print">
          <div className="panel-head">
            <h2>Shop review</h2>
            {active && <span className={'tag ' + REQUEST_TONES[active.status]}>{REQUEST_LABELS[active.status]}</span>}
          </div>
          {active
            ? <>
              <p className="panel-note">Sent {buildDate(active.createdAt)}. The parts and prices in that request are frozen, so editing this build will not change it.</p>
              {active.remarks && <p className="notice note mt-4 whitespace-pre-wrap break-words"><strong>From the shop: </strong>{active.remarks}</p>}
            </>
            : <>
              <p className="panel-note">Send these parts to the shop at current catalog prices. All seven categories must be filled and the compatibility checks must pass.</p>
              <ul className="ready-list">
                <li className={missing.length ? 'no' : 'yes'}>{missing.length ? missing.length + ' categories still empty' : 'All seven categories chosen'}</li>
                <li className={over ? 'no' : 'yes'}>{over ? 'Over budget, which the shop will see' : 'Within your budget'}</li>
              </ul>
              <button type="button" className="button light mt-5" disabled={Boolean(action) || !build.items.length}
                onClick={() => setSubmitOpen(true)}>Submit for review <span aria-hidden="true">↗</span></button>
            </>}
          <p className="panel-foot">A request keeps its own copy of the build. Renaming or editing later never rewrites what you sent.</p>
        </section>
      </div>

      <section className="mt-8 no-print">
        <div className="panel-head mb-4">
          <h2>Request history</h2>
          <span className="row-sub">{history.length} for this build</span>
        </div>
        <Feedback loading={requests.loading && !newRequests.length} error={requests.error} retry={requests.retry}/>
        {!requests.loading && !requests.error && !history.length && <p className="panel empty-state"><span>Nothing submitted for this build yet.</span></p>}
        <ol className="request-feed">
          {history.map(request => <li key={request.id}>
            <span className={'feed-dot ' + request.status} aria-hidden="true"/>
            <div className="feed-body">
              <div className="feed-head">
                <div>
                  <p className="row-title">{REQUEST_LABELS[request.status]}</p>
                  <p className="row-sub">Sent {buildDate(request.createdAt)} · updated {buildDate(request.updatedAt)} · <span className="cell-num">{pesos(request.snapshot.total)}</span></p>
                </div>
                <IconButton icon="open" label={'See the parts sent on ' + buildDate(request.createdAt)} onClick={() => setOpenRequest(request)}/>
              </div>
              {request.note && <p className="feed-quote"><span>Your note</span>{request.note}</p>}
              {request.remarks && <p className="feed-quote shop"><span>From the shop</span>{request.remarks}</p>}
            </div>
          </li>)}
        </ol>
      </section>

      <Drawer open={renaming} onClose={() => setRenaming(false)} title="Rename build"
        footer={<>
          <button type="submit" form="rename-form" className="button light" disabled={Boolean(action)}>{action === 'rename' ? 'Saving…' : 'Save name'}</button>
          <button type="button" className="button secondary" onClick={() => setRenaming(false)} disabled={Boolean(action)}>Cancel</button>
        </>}>
        <form id="rename-form" onSubmit={rename}>
          <label htmlFor="rename-build">Build name
            <input id="rename-build" value={name} onChange={event => setName(event.target.value)} maxLength={100} required autoFocus disabled={Boolean(action)}/>
          </label>
        </form>
        <p className="panel-foot">Up to 100 characters. Requests you already sent keep the name they were sent with.</p>
      </Drawer>

      <Drawer open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit for review"
        description="The shop checks the parts against the live catalog before accepting."
        footer={<>
          <button type="submit" form="request-form" className="button light" disabled={Boolean(action)}>{action === 'submit' ? 'Sending…' : 'Send request'}</button>
          <button type="button" className="button secondary" onClick={() => setSubmitOpen(false)} disabled={Boolean(action)}>Cancel</button>
        </>}>
        <form id="request-form" onSubmit={submitRequest}>
          <label htmlFor="request-note">Note for the shop <span className="text-muted font-normal">(optional)</span></label>
          <textarea id="request-note" className="w-full rounded-lg border border-stroke bg-control px-3 py-2.5 mt-2 text-ink text-sm"
            rows={4} maxLength={1000} placeholder="Anything the reviewer should know?" value={note}
            disabled={Boolean(action)} onChange={event => setNote(event.target.value)}/>
        </form>
      </Drawer>

      <Drawer open={Boolean(openRequest)} onClose={() => setOpenRequest(null)} wide
        title={openRequest ? openRequest.snapshot.name : ''}
        description={openRequest ? 'Sent ' + buildDate(openRequest.createdAt) + ' · ' + openRequest.snapshot.items.length + ' parts' : ''}>
        {openRequest && <>
          <Parts items={openRequest.snapshot.items}/>
          <div className="panel-total"><strong>Submitted total</strong><strong className="cell-num">{pesos(openRequest.snapshot.total)}</strong></div>
        </>}
      </Drawer>
    </>}
  </>;
}