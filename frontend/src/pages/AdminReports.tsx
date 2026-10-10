import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Feedback } from '../components/Feedback';
import { LABELS, type Category } from '../types';
import { REQUEST_LABELS, type RequestStatus } from '../types/builds';

interface Reports {
  savedBuildCount: number;
  requestCount: number;
  activeRequestCount: number;
  statusCounts: Record<RequestStatus, number>;
  commonComponents: { componentId: string; name: string; brand: string; category: Category; selections: number; units: number }[];
  generatedAt: string;
}
const STATUSES: RequestStatus[] = ['pending', 'approved', 'rejected', 'completed'];
const count = (value: number) => value.toLocaleString('en-PH');

// Summary only. Acting on a request happens in the customer queue, so the
// dashboard is not also a workspace.
export function AdminReports() {
  const reports = useApi<Reports>('/admin/reports');
  const report = reports.data;

  return <section>
    <div className="flex flex-wrap justify-between items-start gap-4">
      <div><span className="eyebrow">ADMINISTRATION</span><h1>Dashboard.</h1></div>
      <div className="flex flex-wrap gap-3">
        <Link className="button secondary" to="/admin/inquiries">Customer queue <span aria-hidden="true">↗</span></Link>
        <button type="button" className="button secondary" disabled={reports.loading} onClick={reports.retry}>{reports.loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
    </div>
    <p className="intro">Activity across saved builds and customer requests.</p>

    <Feedback loading={reports.loading} error={reports.error} retry={reports.retry}/>

    {report && <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[{ label: 'Saved builds', value: report.savedBuildCount, note: 'Customer drafts, shop builds excluded' },
          { label: 'Total requests', value: report.requestCount, note: 'All time' },
          { label: 'Active requests', value: report.activeRequestCount, note: 'Pending or approved' },
          { label: 'Completed requests', value: report.statusCounts.completed, note: 'Fulfilled builds' }]
          .map(card => <div className="panel" key={card.label}>
            <p className="text-xs text-muted">{card.label}</p>
            <p className="text-3xl font-semibold tracking-tight mt-2">{count(card.value)}</p>
            <p className="text-xs text-muted mt-2">{card.note}</p>
          </div>)}
      </div>
      <p className="text-xs text-muted mt-3">Updated {new Date(report.generatedAt).toLocaleString('en-PH')}</p>

      <div className="grid xl:grid-cols-[22rem_minmax(0,1fr)] gap-4 mt-5 items-start">
        <section className="panel">
          <h2>Request status</h2>
          {report.requestCount === 0
            ? <p className="text-sm text-muted mt-3">No requests yet. Counts update when a customer submits a saved build.</p>
            : <div className="space-y-4 mt-5">{STATUSES.map(status => {
                const value = report.statusCounts[status];
                const percent = report.requestCount ? Math.round(value / report.requestCount * 100) : 0;
                return <div key={status}>
                  <div className="flex justify-between gap-3 text-sm"><span>{REQUEST_LABELS[status]}</span>
                    <strong>{count(value)} <span className="text-muted font-normal">({percent}%)</span></strong></div>
                  <div className="h-2 rounded-full bg-control border border-stroke mt-2 overflow-hidden" aria-hidden="true">
                    <div style={{ width: percent + '%', background: status === 'rejected' ? 'var(--color-danger)' : 'var(--color-signal-fill)' }} className="h-full"/>
                  </div>
                </div>;
              })}</div>}
          <Link className="button secondary w-full mt-5" to="/admin/inquiries?tab=requests">Review requests <span aria-hidden="true">↗</span></Link>
        </section>

        <section className="panel">
          <h2>Commonly selected components</h2>
          <p className="text-xs text-muted mt-2">Top 10 parts across saved builds. Selections count builds containing a part; units include memory and storage quantities.</p>
          {report.commonComponents.length ? <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm min-w-[24rem]">
              <caption className="sr-only">Most selected components</caption>
              <thead><tr className="border-b border-stroke text-muted">
                <th scope="col" className="py-2.5 pr-4 font-medium">Component</th>
                <th scope="col" className="py-2.5 pr-4 font-medium text-right">Selections</th>
                <th scope="col" className="py-2.5 font-medium text-right">Units</th>
              </tr></thead>
              <tbody>{report.commonComponents.map(component => <tr key={component.componentId} className="border-b last:border-0 border-stroke">
                <td className="py-2.5 pr-4"><p className="font-medium break-words">{component.name}</p>
                  <p className="text-xs text-muted mt-0.5">{component.brand} · {LABELS[component.category]}</p></td>
                <td className="py-2.5 pr-4 text-right">{count(component.selections)}</td>
                <td className="py-2.5 text-right">{count(component.units)}</td>
              </tr>)}</tbody>
            </table>
          </div> : <p className="text-sm text-muted mt-4">No component selections saved yet.</p>}
        </section>
      </div>
    </>}
  </section>;
}