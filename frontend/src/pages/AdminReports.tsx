import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/axios';
import { Parts } from '../components/BuildSummary';
import { LABELS, pesos, type Category } from '../types';
import { REQUEST_LABELS, REQUEST_TONES, buildDate, profileLabel, type BuildRequest, type RequestStatus } from '../types/builds';

interface AdminRequest extends BuildRequest { owner: { id: string; name: string; email: string }; }
interface Reports {
  savedBuildCount: number;
  requestCount: number;
  activeRequestCount: number;
  statusCounts: Record<RequestStatus, number>;
  commonComponents: { componentId: string; name: string; brand: string; category: Category; selections: number; units: number }[];
  generatedAt: string;
}
const STATUSES: RequestStatus[] = ['pending', 'approved', 'rejected', 'completed'];

function ReviewActions({ request, disabled, onUpdate }: {
  request: AdminRequest; disabled: boolean; onUpdate: (request: AdminRequest, status: RequestStatus, remarks: string) => void;
}) {
  const [remarks, setRemarks] = useState(request.remarks);
  if (request.status === 'completed' || request.status === 'rejected') return null;
  return <div className="mt-5 border-t border-stroke pt-5">
    <label htmlFor={'remarks-' + request.id}>Remarks to the customer <span className="font-normal text-muted">(optional)</span></label>
    <textarea id={'remarks-' + request.id} maxLength={1000} rows={3} value={remarks} disabled={disabled}
      onChange={event => setRemarks(event.target.value)}
      className="w-full min-w-0 rounded-lg border border-stroke bg-control px-3 py-2.5 mt-2 text-ink text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"/>
    <p className="text-xs text-muted mt-1">{remarks.length}/1,000 characters</p>
    <div className="flex flex-wrap gap-3 mt-4">
      {request.status === 'pending' ? <>
        <button className="button light" disabled={disabled} onClick={() => onUpdate(request, 'approved', remarks)}>Approve request</button>
        <button className="button secondary text-danger" disabled={disabled} onClick={() => onUpdate(request, 'rejected', remarks)}>Reject request</button>
      </> : <button className="button light" disabled={disabled} onClick={() => onUpdate(request, 'completed', remarks)}>Mark completed</button>}
    </div>
    <p className="text-xs text-muted mt-3">{request.status === 'pending'
      ? 'Approval moves the request forward. Rejection closes it.'
      : 'Mark completed once the build request has been fulfilled.'}</p>
  </div>;
}

export function AdminReports() {
  const [report, setReport] = useState<Reports | null>(null);
  const [totalsStale, setTotalsStale] = useState(false);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all');

  async function loadDashboard() {
    setRefreshing(true); setError('');
    try {
      const [reportsResponse, requestsResponse] = await Promise.all([
        api.get<Reports>('/admin/reports'), api.get<AdminRequest[]>('/admin/requests'),
      ]);
      setReport(reportsResponse.data); setRequests(requestsResponse.data); setTotalsStale(false);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { void loadDashboard(); }, []);
  async function updateStatus(request: AdminRequest, status: RequestStatus, remarks: string) {
    setSaving(request.id); setError(''); setSuccess('');
    try {
      const response = await api.patch<AdminRequest>('/admin/requests/' + request.id + '/status', { status, remarks, expectedStatus: request.status });
      setRequests(current => current.map(item => item.id === request.id ? response.data : item));
      setTotalsStale(true);
      setSuccess(request.snapshot.name + ' is now ' + REQUEST_LABELS[response.data.status].toLowerCase() + '.');
      await loadDashboard();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setSaving(''); }
  }
  const filteredRequests = filter === 'all' ? requests : requests.filter(request => request.status === filter);
  return <section>
    <div className="flex flex-wrap justify-between items-end gap-4">
      <div><span className="eyebrow">ADMINISTRATION</span><h1>Reports & requests.</h1></div>
      <button className="button secondary" disabled={refreshing || Boolean(saving)} onClick={() => void loadDashboard()}>{refreshing ? 'Refreshing…' : 'Refresh dashboard'}</button>
    </div>
    <p className="intro">Review customer build requests and see activity across saved builds.</p>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {success && <p role="status" className="notice note mb-5">{success}</p>}
    {totalsStale && <p role="status" className="notice note mb-5">{refreshing ? 'Updating report totals…' : 'The request status is saved. Report totals may be out of date; refresh the dashboard to update them.'}</p>}
    {loading && <p role="status" className="panel">Loading reports and build requests…</p>}
    {!loading && !report && <p className="text-muted">Reports could not be loaded. Use Refresh dashboard to try again.</p>}
    {report && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {[{ label: 'Saved builds', value: report.savedBuildCount }, { label: 'Total requests', value: report.requestCount },
          { label: 'Active requests', value: report.activeRequestCount }, { label: 'Completed requests', value: report.statusCounts.completed }]
          .map(card => <div className="panel" key={card.label}><p className="text-xs text-muted">{card.label}</p><p className="text-3xl sm:text-4xl font-semibold tracking-tight mt-3">{card.value.toLocaleString('en-PH')}</p></div>)}
      </div>
      <p className="text-xs text-muted mt-3">All-time totals · Active requests are pending or approved · Updated {new Date(report.generatedAt).toLocaleString('en-PH')}</p>
      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-5 mt-6">
        <section className="panel">
          <h2>Request status breakdown</h2>
          {report.requestCount === 0 && <p className="text-sm text-muted mt-3">No requests yet. Counts update when a customer submits a complete saved build.</p>}
          <div className="space-y-5 mt-6">{STATUSES.map(status => {
            const count = report.statusCounts[status];
            const percent = report.requestCount ? Math.round(count / report.requestCount * 100) : 0;
            return <div key={status}><div className="flex justify-between gap-3 text-sm"><span>{REQUEST_LABELS[status]}</span><strong>{count.toLocaleString('en-PH')} <span className="text-muted font-normal">({percent}%)</span></strong></div>
              <div className="h-2 rounded-full bg-control border border-stroke mt-2 overflow-hidden" aria-hidden="true"><div style={{ width: percent + '%', background: status === 'rejected' ? 'var(--color-danger)' : 'var(--color-signal-fill)' }} className="h-full"/></div></div>;
          })}</div>
        </section>
        <section className="panel">
          <h2>Commonly selected components</h2>
          <p className="text-xs text-muted mt-2">Top 10 parts across saved builds. Selections count saved builds containing a part; units include memory and storage quantities. These counts describe planning activity.</p>
          {report.commonComponents.length ? <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-stroke text-muted"><th className="py-3 pr-4">Component</th><th className="py-3 pr-4 text-right">Selections</th><th className="py-3 text-right">Units</th></tr></thead>
              <tbody>{report.commonComponents.map(component => <tr key={component.componentId} className="border-b last:border-0 border-stroke">
                <td className="py-3 pr-4"><p className="font-medium">{component.name}</p><p className="text-xs text-muted mt-1">{component.brand} · {LABELS[component.category]}</p></td>
                <td className="py-3 pr-4 text-right">{component.selections.toLocaleString('en-PH')}</td><td className="py-3 text-right">{component.units.toLocaleString('en-PH')}</td>
              </tr>)}</tbody>
            </table>
          </div> : <p className="text-sm text-muted mt-5">No component selections have been saved yet.</p>}
        </section>
      </div>
      <section className="mt-10">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div><span className="eyebrow">CUSTOMER REQUESTS</span><h2 className="text-2xl mt-2">Review queue</h2></div>
          <label className="w-full sm:w-52">Filter by status<select value={filter} onChange={event => setFilter(event.target.value as RequestStatus | 'all')}>
            <option value="all">All statuses</option>{STATUSES.map(status => <option value={status} key={status}>{REQUEST_LABELS[status]}</option>)}
          </select></label>
        </div>
        <p className="text-sm text-muted mt-3 mb-5">Requests preserve the parts and prices at submission. Review the supported compatibility checks before fulfilling a build.</p>
        {requests.length >= 200 && <p className="notice note mb-5">Showing the 200 most recent requests. Report totals include all requests.</p>}
        {!filteredRequests.length && <p className="panel text-muted">{requests.length ? 'No requests match this status.' : 'No customer build requests yet.'}</p>}
        <div className="space-y-5">{filteredRequests.map(request => <article key={request.id} className="panel">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div className="min-w-0"><p className="eyebrow">REQUEST {request.id.slice(-6).toUpperCase()}</p><h3 className="font-semibold text-xl mt-2 break-words">{request.snapshot.name}</h3>
              <p className="text-sm text-muted mt-2 break-words">{request.owner.name} · {request.owner.email}</p>
              <p className="text-xs text-muted mt-1">Submitted {buildDate(request.createdAt)} · {profileLabel(request.snapshot.profileSlug)}</p>
            </div>
            <span className={'tag ' + REQUEST_TONES[request.status]}>{REQUEST_LABELS[request.status]}</span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 mt-5 text-sm"><p>Submission total <strong>{pesos(request.snapshot.total)}</strong></p><p className="text-muted">Budget {pesos(request.snapshot.budget)}</p></div>
          {request.note && <div className="notice note mt-4"><strong className="block mb-1 text-xs">Customer note</strong><p className="whitespace-pre-wrap break-words">{request.note}</p></div>}
          {request.remarks && <div className="notice note mt-3"><strong className="block mb-1 text-xs">Admin remarks</strong><p className="whitespace-pre-wrap break-words">{request.remarks}</p></div>}
          <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">View submitted parts ({request.snapshot.items.length})</summary><div className="mt-3"><Parts items={request.snapshot.items}/></div></details>
          <ReviewActions key={request.id + request.status} request={request} disabled={Boolean(saving) || refreshing} onUpdate={(item, status, remarks) => void updateStatus(item, status, remarks)}/>
          {saving === request.id && <p role="status" className="text-sm text-muted mt-4">Updating request status…</p>}
        </article>)}</div>
      </section>
    </>}
  </section>;
}


