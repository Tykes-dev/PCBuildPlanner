import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { Feedback } from '../components/Feedback';
import { IconButton } from '../components/Icon';
import { useApi } from '../hooks/useApi';
import { useTableState } from '../hooks/useTableState';
import { CATEGORIES, pesos } from '../types';
import { REQUEST_LABELS, REQUEST_TONES, buildDate, profileLabel, type BuildRequest, type SavedBuild } from '../types/builds';

type Row = SavedBuild & { selected: number; state: 'draft' | 'ready' | 'review'; active: BuildRequest | null };
const STATE_LABELS: Record<Row['state'], string> = { draft: 'Draft', ready: 'Ready', review: 'Under review' };

export function SavedBuilds() {
  const builds = useApi<SavedBuild[]>('/builds');
  const requests = useApi<BuildRequest[]>('/requests');
  const navigate = useNavigate();
  const [tab, setTab] = useState<'builds' | 'requests'>('builds');
  const [state, setState] = useState<'' | Row['state']>('');
  const [status, setStatus] = useState('');
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const history = useMemo(() => requests.data || [], [requests.data]);

  // A build's state is derived rather than stored: an open request outranks
  // whether every category has been filled in.
  const rows: Row[] = useMemo(() => (builds.data || []).map(build => {
    const active = history.find(request => request.buildId === build.id
      && (request.status === 'pending' || request.status === 'approved')) || null;
    const selected = new Set(build.items.map(item => item.component.category)).size;
    return { ...build, selected, active, state: active ? 'review' : selected < CATEGORIES.length ? 'draft' : 'ready' };
  }), [builds.data, history]);

  const filtered = useMemo(() => rows.filter(row => !state || row.state === state), [rows, state]);
  const filteredRequests = useMemo(() => history.filter(row => !status || row.status === status), [history, status]);

  const buildTable = useTableState<Row>({
    rows: filtered,
    searchText: row => row.name + ' ' + profileLabel(row.profileSlug),
    sortValues: {
      name: row => row.name.toLowerCase(),
      selected: row => row.selected,
      budget: row => row.budget,
      total: row => row.total,
      updatedAt: row => Date.parse(row.updatedAt)
    },
    initialSort: { key: 'updatedAt', direction: 'desc' }
  });
  const requestTable = useTableState<BuildRequest>({
    rows: filteredRequests,
    searchText: row => row.snapshot.name,
    sortValues: {
      name: row => row.snapshot.name.toLowerCase(),
      total: row => row.snapshot.total,
      status: row => row.status,
      createdAt: row => Date.parse(row.createdAt)
    },
    initialSort: { key: 'createdAt', direction: 'desc' }
  });

  async function remove() {
    if (!confirm) return;
    setError(''); setNotice(''); setDeleting(true);
    try {
      await api.delete('/builds/' + confirm.id);
      setNotice(confirm.name + ' was deleted.');
      setConfirm(null);
      builds.retry(); requests.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setDeleting(false); }
  }

  const buildColumns: DataTableColumn<Row>[] = [
    { key: 'name', header: 'Build', sortable: true, render: row => <>
      <Link className="row-title" to={'/builds/' + row.id}>{row.name}</Link>
      <p className="row-sub">{profileLabel(row.profileSlug)} · updated {buildDate(row.updatedAt)}</p>
    </> },
    { key: 'selected', header: 'Parts', sortable: true, hideBelow: 'sm', render: row => <div className="parts-meter">
      <span className="cell-num">{row.selected}/{CATEGORIES.length}</span>
      <span className="score-track" aria-hidden="true"><span style={{ width: (row.selected / CATEGORIES.length) * 100 + '%' }}/></span>
    </div> },
    { key: 'budget', header: 'Budget', sortable: true, align: 'right', numeric: true, hideBelow: 'lg', render: row => pesos(row.budget) },
    { key: 'total', header: 'Saved total', sortable: true, align: 'right', numeric: true, render: row => <>
      <p>{pesos(row.total)}</p>
      <p className={'row-sub ' + (row.total > row.budget ? 'text-danger' : '')}>
        {row.total > row.budget ? pesos(row.total - row.budget) + ' over' : pesos(row.budget - row.total) + ' left'}
      </p>
    </> },
    { key: 'state', header: 'Status', sortable: true, hideBelow: 'md', render: row =>
      <span className={'tag ' + (row.active ? REQUEST_TONES[row.active.status] : row.state === 'ready' ? 'pass' : '')}>
        {row.active ? REQUEST_LABELS[row.active.status] : STATE_LABELS[row.state]}
      </span> },
    { key: 'actions', header: 'Actions', align: 'right', render: row => <div className="row-actions">
      <IconButton icon="open" label={'Open ' + row.name} onClick={() => navigate('/builds/' + row.id)}/>
      <IconButton icon="remove" tone="danger" label={row.active ? row.name + ' is under review and cannot be deleted' : 'Delete ' + row.name}
        onClick={() => { setConfirm(row); setError(''); setNotice(''); }} disabled={Boolean(row.active)}/>
    </div> }
  ];

  const requestColumns: DataTableColumn<BuildRequest>[] = [
    { key: 'name', header: 'Build', sortable: true, render: row => <>
      <Link className="row-title" to={'/builds/' + row.buildId}>{row.snapshot.name}</Link>
      <p className="row-sub">{row.snapshot.items.length} parts · sent {buildDate(row.createdAt)}</p>
    </> },
    { key: 'total', header: 'Submitted total', sortable: true, align: 'right', numeric: true, render: row => pesos(row.snapshot.total) },
    { key: 'status', header: 'Status', sortable: true, render: row => <span className={'tag ' + REQUEST_TONES[row.status]}>{REQUEST_LABELS[row.status]}</span> },
    { key: 'remarks', header: 'From the shop', hideBelow: 'md', render: row =>
      row.remarks ? <span className="row-sub break-words">{row.remarks}</span> : <span className="row-sub">—</span> },
    { key: 'actions', header: 'Build', align: 'right', render: row => <div className="row-actions">
      <IconButton icon="open" label={'Open ' + row.snapshot.name} onClick={() => navigate('/builds/' + row.buildId)}/>
    </div> }
  ];

  const pending = history.filter(request => request.status === 'pending').length;
  const ready = rows.filter(row => row.state === 'ready').length;

  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">YOUR ACCOUNT</span>
        <h1>Saved builds.</h1>
        <p className="intro">Every draft you have kept, and where each build request stands.</p>
      </div>
      <Link className="button light" to="/builder">Open planner <span aria-hidden="true">↗</span></Link>
    </div>

    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {notice && <p role="status" className="notice note mb-5">{notice}</p>}

    <div className="stat-strip">
      <div><span className="eyebrow">Saved builds</span><strong>{builds.data ? rows.length : '—'}</strong></div>
      <div><span className="eyebrow">Complete</span><strong>{builds.data ? ready : '—'}</strong></div>
      <div><span className="eyebrow">Requests sent</span><strong>{requests.data ? history.length : '—'}</strong></div>
      <div><span className="eyebrow">Waiting on the shop</span><strong>{requests.data ? pending : '—'}</strong></div>
    </div>

    <div className="tab-row" role="tablist" aria-label="Saved builds sections">
      <button type="button" role="tab" aria-selected={tab === 'builds'} className={'tab' + (tab === 'builds' ? ' active' : '')}
        onClick={() => setTab('builds')}>Builds <span className="tab-count">{rows.length}</span></button>
      <button type="button" role="tab" aria-selected={tab === 'requests'} className={'tab' + (tab === 'requests' ? ' active' : '')}
        onClick={() => setTab('requests')}>Requests <span className="tab-count">{history.length}</span></button>
    </div>

    {tab === 'builds' ? <>
      <Feedback loading={builds.loading} error={builds.error} retry={builds.retry}/>
      {builds.data && (!rows.length
        ? <section className="panel empty-state">
            <h2>Your first build starts here.</h2>
            <p>Choose parts in the planner, give the build a name, then save it. A draft can be saved before every category is filled.</p>
            <Link className="button light" to="/builder">Choose your parts <span aria-hidden="true">↗</span></Link>
          </section>
        : <>
          <DataTable
            table={buildTable} columns={buildColumns} rowKey={row => row.id}
            label="Saved builds" searchPlaceholder="Search by build name"
            empty="No saved builds yet."
            filters={<label className="w-full sm:w-44"><span className="text-xs">Status</span>
              <select value={state} onChange={event => setState(event.target.value as '' | Row['state'])}>
                <option value="">All builds</option>
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="review">Under review</option>
              </select></label>}/>
          <p className="table-note">Saved totals use the prices captured when you saved. Reopening a build loads current prices and availability.</p>
        </>)}
    </> : <>
      <Feedback loading={requests.loading} error={requests.error} retry={requests.retry}/>
      {requests.data && (!history.length
        ? <section className="panel empty-state">
            <h2>No requests yet.</h2>
            <p>Open a saved build and submit it for review. Its status and the shop's remarks will show up here.</p>
          </section>
        : <>
          <DataTable
            table={requestTable} columns={requestColumns} rowKey={row => row.id}
            label="Build requests" searchPlaceholder="Search by build name"
            empty="No requests yet."
            filters={<label className="w-full sm:w-44"><span className="text-xs">Status</span>
              <select value={status} onChange={event => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {Object.entries(REQUEST_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>}/>
          {history.length >= 200 && <p className="table-note">Showing your 200 most recent requests.</p>}
        </>)}
    </>}

    <Drawer open={Boolean(confirm)} onClose={() => setConfirm(null)} title={'Delete ' + (confirm?.name || '')}
      description="This cannot be undone."
      footer={confirm ? <>
        <button type="button" className="button" onClick={() => void remove()} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes, delete it'}</button>
        <button type="button" className="button secondary" onClick={() => setConfirm(null)} disabled={deleting}>Cancel</button>
      </> : null}>
      <p className="text-sm leading-relaxed">Deleting removes this draft from your account. Requests you already submitted keep their own saved copy, so nothing you sent to the shop changes.</p>
    </Drawer>
  </>;
}