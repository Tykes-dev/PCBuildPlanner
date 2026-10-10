import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { Feedback } from '../components/Feedback';
import { useApi } from '../hooks/useApi';
import { CATEGORIES, pesos } from '../types';
import { REQUEST_LABELS, REQUEST_TONES, buildDate, profileLabel, type BuildRequest, type SavedBuild } from '../types/builds';

export function SavedBuilds() {
  const builds = useApi<SavedBuild[]>('/builds');
  const requests = useApi<BuildRequest[]>('/requests');
  const [search, setSearch] = useState('');
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  // A build under review cannot be deleted, so the request history is refreshed
  // alongside the build list after a successful removal.
  async function remove(id: string, name: string) {
    setActionError(''); setActionNotice(''); setDeletingId(id);
    try {
      await api.delete('/builds/' + id);
      setActionNotice(name + ' was deleted.');
      setConfirmId(null);
      builds.retry(); requests.retry();
    } catch (failure) { setActionError(errorMessage(failure)); }
    finally { setDeletingId(null); }
  }
  const visibleBuilds = builds.data?.filter(build => build.name.toLowerCase().includes(search.trim().toLowerCase())) || [];
  const requestHistory = requests.data || [];
  const shownRequests = showAllRequests ? requestHistory : requestHistory.slice(0, 5);
  const pendingCount = requestHistory.filter(request => request.status === 'pending').length;

  return <>
    <div className="flex flex-wrap justify-between gap-4 items-start">
      <div><span className="eyebrow">YOUR ACCOUNT</span><h1>Saved builds.</h1><p className="intro">Keep your drafts, compare versions, and follow your build requests.</p></div>
      <Link className="button secondary" to="/builder">Open planner <span aria-hidden="true">↗</span></Link>
    </div>
    {actionError && <p role="alert" className="notice error mt-5">{actionError}</p>}
    {actionNotice && <p role="status" className="notice note mt-5">{actionNotice}</p>}
    <Feedback loading={builds.loading} error={builds.error} retry={builds.retry}/>
    {builds.data && <>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="panel"><span className="eyebrow">SAVED BUILDS</span><p className="text-3xl font-semibold mt-2">{builds.data.length}</p></div>
        <div className="panel"><span className="eyebrow">RECENT REQUESTS</span><p className="text-3xl font-semibold mt-2">{requests.data ? requestHistory.length : '—'}</p></div>
        <div className="panel"><span className="eyebrow">RECENT PENDING REQUESTS</span><p className="text-3xl font-semibold mt-2">{requests.data ? pendingCount : '—'}</p></div>
      </div>
      {!builds.data.length ? <section className="panel">
        <h2>Your first build starts here.</h2><p className="text-muted text-sm mt-3">Choose parts in the planner, give your build a name, then save it. Drafts can be saved before all parts are selected.</p>
        <Link className="button mt-5" to="/builder">Choose your parts <span aria-hidden="true">↗</span></Link>
      </section> : <>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <h2>{search.trim() ? visibleBuilds.length + ' matching builds' : 'Your builds'}</h2>
          <label className="w-full sm:w-72">Search builds<input type="search" placeholder="Search by build name" value={search} onChange={event => setSearch(event.target.value)}/></label>
        </div>
        {!visibleBuilds.length && <p className="notice note">No builds match this name. Try a different search.</p>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleBuilds.map(build => {
            const selected = new Set(build.items.map(item => item.component.category)).size;
            const activeRequest = requestHistory.find(request => request.buildId === build.id && (request.status === 'pending' || request.status === 'approved'));
            return <article className="panel flex flex-col" key={build.id}>
              <div className="flex flex-wrap justify-between gap-3"><span className="eyebrow">{profileLabel(build.profileSlug)}</span><span className={'tag ' + (activeRequest ? REQUEST_TONES[activeRequest.status] : '')}>{activeRequest ? REQUEST_LABELS[activeRequest.status] : selected < CATEGORIES.length ? 'Draft' : 'Saved'}</span></div>
              <h2 className="text-xl break-words mt-4"><Link className="hover:underline underline-offset-4" to={'/builds/' + build.id}>{build.name}</Link></h2>
              <p className="text-sm text-muted mt-2">{selected} of {CATEGORIES.length} categories · Updated {buildDate(build.updatedAt)}</p>
              <div className="border-y border-stroke py-4 my-5 space-y-2 text-sm"><p className="flex flex-wrap justify-between gap-2"><span className="text-muted">Saved total</span><strong>{pesos(build.total)}</strong></p><p className="flex flex-wrap justify-between gap-2"><span className="text-muted">Budget</span><span>{pesos(build.budget)}</span></p></div>
              <p className="text-sm text-muted mb-5">{build.items.length ? build.items.slice(0, 2).map(item => item.component.name).join(' · ') + (build.items.length > 2 ? ' + ' + (build.items.length - 2) + ' more' : '') : 'No parts selected yet.'}</p>
              <div className="mt-auto grid gap-3">
                <Link className="button secondary" to={'/builds/' + build.id}>Open build details <span aria-hidden="true">↗</span></Link>
                {activeRequest
                  ? <p className="text-xs text-muted">This build is under review, so it cannot be deleted yet.</p>
                  : confirmId === build.id
                    ? <div className="notice warning" role="alertdialog" aria-label={'Confirm deleting ' + build.name}>
                        <p className="text-sm">Delete <strong>{build.name}</strong>? This cannot be undone. Requests you already submitted keep their own saved copy.</p>
                        <div className="flex flex-wrap gap-3 mt-4">
                          <button type="button" className="button" onClick={() => remove(build.id, build.name)} disabled={deletingId === build.id}>{deletingId === build.id ? 'Deleting…' : 'Yes, delete it'}</button>
                          <button type="button" className="button secondary" onClick={() => setConfirmId(null)} disabled={deletingId === build.id}>Cancel</button>
                        </div>
                      </div>
                    : <button type="button" className="button secondary" onClick={() => { setConfirmId(build.id); setActionError(''); setActionNotice(''); }}>Delete build</button>}
              </div>
            </article>;
          })}
        </div>
        <p className="text-xs text-muted mt-4">Saved totals use prices captured when you saved. Reopening loads current prices and availability.</p>
      </>}
    </>}
    <section className="mt-10">
      <div className="flex flex-wrap justify-between gap-3 items-center mb-4"><h2>Your recent build requests</h2>{requestHistory.length > 5 && <button className="button secondary" onClick={() => setShowAllRequests(current => !current)}>{showAllRequests ? 'Show latest five' : 'Show all recent requests'}</button>}</div>
      {requestHistory.length >= 200 && <p className="text-xs text-muted mb-4">Showing your 200 most recent requests. Counts above refer to these recent requests.</p>}
      <Feedback loading={requests.loading} error={requests.error} retry={requests.retry}/>
      {requests.data && (!requestHistory.length ? <p className="panel text-sm text-muted">Open a saved build to submit it for administrator review. Its request status and remarks will appear here.</p> : <div className="space-y-3">
        {shownRequests.map(request => <article className="panel" key={request.id}>
          <div className="flex flex-wrap justify-between gap-3"><div><Link to={'/builds/' + request.buildId} className="font-semibold break-words hover:underline underline-offset-4">{request.snapshot.name}</Link><p className="text-xs text-muted mt-2">Submitted {buildDate(request.createdAt)} · {pesos(request.snapshot.total)}</p></div><span className={'tag ' + REQUEST_TONES[request.status]}>{REQUEST_LABELS[request.status]}</span></div>
          {request.remarks && <p className="text-sm mt-3 whitespace-pre-wrap break-words"><span className="font-semibold">Admin remarks: </span>{request.remarks}</p>}
        </article>)}
      </div>)}
    </section>
  </>;
}