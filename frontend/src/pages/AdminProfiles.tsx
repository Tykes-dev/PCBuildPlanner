import { useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { useTableState } from '../hooks/useTableState';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { Feedback } from '../components/Feedback';
import { CATEGORIES, LABELS, pesos, type Category, type Profile } from '../types';

const MINIMUM_CATEGORIES: Category[] = ['memory', 'storage'];
const PREVIEW_BUDGET = 50000;

type Rows = Record<Category, { percent: string; priority: string }>;
type Minimums = Record<'memory' | 'storage', string>;
type FieldErrors = Partial<Record<'slug' | 'label' | 'description' | 'allocations' | 'minimums', string>>;

const EVEN = Math.floor(100 / CATEGORIES.length);
const emptyRows = (): Rows => Object.fromEntries(CATEGORIES.map((category, index) => [category,
  { percent: String(index === 0 ? 100 - EVEN * (CATEGORIES.length - 1) : EVEN), priority: String(index + 1) }])) as Rows;
const emptyMinimums = (): Minimums => ({ memory: '', storage: '' });

function toRows(profile: Profile): Rows {
  const rows = emptyRows();
  for (const category of CATEGORIES) {
    const match = profile.allocations.find(allocation => allocation.category === category);
    rows[category] = { percent: match ? String(match.percent) : '0', priority: match ? String(match.priority) : '1' };
  }
  return rows;
}
function toMinimums(profile: Profile): Minimums {
  const minimums = emptyMinimums();
  for (const category of MINIMUM_CATEGORIES) {
    const match = profile.minimums?.find(minimum => minimum.category === category);
    if (match) minimums[category as 'memory' | 'storage'] = String(match.value);
  }
  return minimums;
}

const searchText = (row: Profile) => [row.label, row.slug, row.description].filter(Boolean).join(' ');
const sortValues = {
  label: (row: Profile) => row.label.toLowerCase(),
  slug: (row: Profile) => row.slug,
  top: (row: Profile) => [...row.allocations].sort((a, b) => a.priority - b.priority)[0]?.percent ?? 0
};

export function AdminProfiles() {
  const profiles = useApi<Profile[]>('/admin/profiles');
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<Rows>(emptyRows);
  const [minimums, setMinimums] = useState<Minimums>(emptyMinimums);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [confirm, setConfirm] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [state, setState] = useState<'' | 'active' | 'archived'>('');
  const submitting = useRef(false);

  const visible = (profiles.data || []).filter(row =>
    !state || (state === 'archived' ? row.active === false : row.active !== false));
  const table = useTableState<Profile>({ rows: visible, searchText, sortValues, pageSize: 10, initialSort: { key: 'label', direction: 'asc' } });

  const total = CATEGORIES.reduce((sum, category) => sum + (Number(rows[category].percent) || 0), 0);
  const usedPriorities = CATEGORIES.map(category => rows[category].priority);
  const duplicatePriority = new Set(usedPriorities).size !== usedPriorities.length;
  const ordered = [...CATEGORIES].sort((a, b) => Number(rows[a].priority) - Number(rows[b].priority));

  function setRow(category: Category, key: 'percent' | 'priority', value: string) {
    setRows(current => ({ ...current, [category]: { ...current[category], [key]: value } }));
    setFields(current => ({ ...current, allocations: undefined }));
    setFormError('');
  }

  function sortPriorityByPercent() {
    const ranked = [...CATEGORIES].sort((a, b) => (Number(rows[b].percent) || 0) - (Number(rows[a].percent) || 0) || a.localeCompare(b));
    setRows(current => {
      const next = { ...current };
      ranked.forEach((category, index) => { next[category] = { ...next[category], priority: String(index + 1) }; });
      return next;
    });
    setFields(current => ({ ...current, allocations: undefined }));
  }

  function openForm(profile?: Profile) {
    setEditing(profile || null);
    setSlug(profile?.slug || ''); setLabel(profile?.label || ''); setDescription(profile?.description || '');
    setRows(profile ? toRows(profile) : emptyRows());
    setMinimums(profile ? toMinimums(profile) : emptyMinimums());
    setFields({}); setFormError(''); setFeedback(''); setError('');
    setFormOpen(true);
  }

  async function act(profile: Profile, run: () => Promise<{ data: { message?: string } }>, fallback: string) {
    setError(''); setFeedback(''); setRowBusy(profile._id || '');
    try {
      const response = await run();
      setFeedback(response.data.message || fallback);
      setConfirm(null);
      profiles.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setRowBusy(null); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFormError('');
    const errors: FieldErrors = {};
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || cleanSlug.length > 100 || !/^[a-z0-9-]+$/.test(cleanSlug)) errors.slug = 'Use lowercase letters, numbers and hyphens, up to 100 characters.';
    if (!label.trim() || label.trim().length > 80) errors.label = 'Enter a name up to 80 characters.';
    if (description.length > 300) errors.description = 'Use text up to 300 characters.';
    if (CATEGORIES.some(category => {
      const percent = Number(rows[category].percent);
      return !rows[category].percent.trim() || !Number.isFinite(percent) || percent < 0 || percent > 100;
    })) errors.allocations = 'Each percentage must be a number from 0 to 100.';
    else if (duplicatePriority) errors.allocations = 'Use each priority from 1 to 7 exactly once.';
    else if (Math.abs(total - 100) > 0.0001) errors.allocations = `The seven percentages must total 100. They currently total ${Math.round(total * 100) / 100}.`;
    for (const category of MINIMUM_CATEGORIES) {
      const raw = minimums[category as 'memory' | 'storage'].trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isSafeInteger(value) || value < 1) errors.minimums = 'Enter whole capacities in GB of at least 1, or leave them blank.';
    }
    setFields(errors);
    if (Object.keys(errors).length) { setFormError('Check the highlighted fields before saving.'); return; }

    const payload = {
      slug: cleanSlug, label: label.trim(), description: description.trim(),
      allocations: CATEGORIES.map(category => ({ category, percent: Number(rows[category].percent), priority: Number(rows[category].priority) })),
      minimums: MINIMUM_CATEGORIES
        .filter(category => minimums[category as 'memory' | 'storage'].trim())
        .map(category => ({ category, value: Number(minimums[category as 'memory' | 'storage']) }))
    };

    submitting.current = true; setBusy(true);
    try {
      const response = editing
        ? await api.put<Profile>('/admin/profiles/' + editing._id, payload)
        : await api.post<Profile>('/admin/profiles', payload);
      setFeedback(response.data.label + (editing ? ' was updated.' : ' was created.'));
      setFormOpen(false); setEditing(null);
      profiles.retry();
    } catch (failure) {
      setFormError(errorMessage(failure));
      if (isAxiosError(failure) && failure.response?.data?.fields) {
        setFields(Object.fromEntries(Object.entries(failure.response.data.fields as Record<string, unknown>)
          .filter(([, value]) => typeof value === 'string')) as FieldErrors);
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  const columns: DataTableColumn<Profile>[] = [
    { key: 'label', header: 'Use case', sortable: true, render: row => <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium break-words">{row.label}</p>
        {row.isDefault && <span className="tag pass">Default</span>}
        {row.active === false && <span className="tag">Archived</span>}
      </div>
      {row.description && <p className="text-xs text-muted mt-1 break-words">{row.description}</p>}
    </> },
    { key: 'slug', header: 'Slug', sortable: true, hideBelow: 'lg', render: row => <span className="text-xs text-muted">{row.slug}</span> },
    { key: 'top', header: 'Largest shares', sortable: true, hideBelow: 'md', render: row => <span className="text-xs text-muted">
      {[...row.allocations].sort((a, b) => a.priority - b.priority).slice(0, 3).map(item => LABELS[item.category] + ' ' + item.percent + '%').join(' · ')}
    </span> },
    { key: 'actions', header: 'Actions', align: 'right', render: row => <div className="flex flex-wrap justify-end gap-2">
      <button type="button" className="button secondary !py-1.5" onClick={() => openForm(row)} disabled={rowBusy === row._id}>Edit</button>
      {row.active === false
        ? <button type="button" className="button secondary !py-1.5" disabled={rowBusy === row._id}
            onClick={() => act(row, () => api.patch('/admin/profiles/' + row._id + '/restore'), 'Profile restored.')}>Restore</button>
        : <>
          {!row.isDefault && <button type="button" className="button secondary !py-1.5" disabled={rowBusy === row._id}
            onClick={() => act(row, () => api.patch('/admin/profiles/' + row._id + '/default'), 'Default updated.')}>Make default</button>}
          <button type="button" className="button secondary !py-1.5" onClick={() => setConfirm(row)} disabled={rowBusy === row._id}>Archive</button>
        </>}
    </div> }
  ];

  return <section>
    <span className="eyebrow">ADMINISTRATION</span><h1>Use cases.</h1>
    <p className="intro">A use case decides how a customer's budget is divided across the seven categories.</p>

    {error && <p role="alert" className="notice error mb-4">{error}</p>}
    {feedback && <p role="status" className="notice note mb-4">{feedback}</p>}

    <Feedback loading={profiles.loading} error={profiles.error} retry={profiles.retry}/>
    {profiles.data && <DataTable
      table={table} columns={columns} rowKey={row => row._id || row.slug}
      label="Use case profiles" searchPlaceholder="Name, slug or description"
      empty="No use cases yet. Create the first one."
      filters={<label className="w-full sm:w-36"><span className="text-xs">State</span>
        <select value={state} onChange={event => setState(event.target.value as '' | 'active' | 'archived')}>
          <option value="">All</option><option value="active">Active</option><option value="archived">Archived</option>
        </select></label>}
      toolbar={<button type="button" className="button light" onClick={() => openForm()}>Add use case <span aria-hidden="true">＋</span></button>}/>}

    <Drawer open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} wide
      title={editing ? 'Edit ' + editing.label : 'New use case'}
      description="The share decides how much of the budget a category gets. The priority decides which category spare budget fills first."
      footer={<>
        <button type="submit" form="profile-form" className="button light" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create use case'}</button>
        <button type="button" className="button secondary" onClick={() => { setFormOpen(false); setEditing(null); }} disabled={busy}>Cancel</button>
      </>}>
      {formError && <p role="alert" className="notice error mb-5">{formError}</p>}
      <form id="profile-form" onSubmit={submit} className="grid gap-6">
        <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-4">Details</legend>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="profile-label">Name</label>
              <input id="profile-label" value={label} maxLength={80} aria-invalid={Boolean(fields.label)}
                onChange={event => { setLabel(event.target.value); setFields(current => ({ ...current, label: undefined })); }}/>
              {fields.label && <p role="alert" className="field-error">{fields.label}</p>}
            </div>
            <div>
              <label htmlFor="profile-slug">Slug</label>
              <input id="profile-slug" value={slug} maxLength={100} placeholder="gaming" aria-invalid={Boolean(fields.slug)}
                onChange={event => { setSlug(event.target.value); setFields(current => ({ ...current, slug: undefined })); }}/>
              <p className="text-xs text-muted mt-2">Lowercase letters, numbers and hyphens. Saved builds keep this value.</p>
              {fields.slug && <p role="alert" className="field-error">{fields.slug}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="profile-description">Description</label>
              <input id="profile-description" value={description} maxLength={300} placeholder="Competitive gaming at 1080p."
                onChange={event => { setDescription(event.target.value); setFields(current => ({ ...current, description: undefined })); }}/>
              {fields.description && <p role="alert" className="field-error">{fields.description}</p>}
            </div>
          </div>
        </fieldset>

        <fieldset disabled={busy} className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <legend className="text-sm font-semibold">Budget split</legend>
            <button type="button" className="button secondary !py-1.5" onClick={sortPriorityByPercent} disabled={busy}>Match priority to share</button>
          </div>
          <div className="space-y-3">
            {ordered.map(category => {
              const percent = Number(rows[category].percent) || 0;
              return <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-3 items-end" key={category}>
                <div>
                  <span className="text-sm">{LABELS[category]}</span>
                  <p className="text-xs text-muted mt-1">{pesos(Math.round(PREVIEW_BUDGET * percent / 100))} of {pesos(PREVIEW_BUDGET)}</p>
                </div>
                <div>
                  <label htmlFor={'percent-' + category} className="text-xs">Share %</label>
                  <input id={'percent-' + category} type="number" min="0" max="100" step="any" value={rows[category].percent} onChange={event => setRow(category, 'percent', event.target.value)}/>
                </div>
                <div>
                  <label htmlFor={'priority-' + category} className="text-xs">Priority</label>
                  <select id={'priority-' + category} value={rows[category].priority} onChange={event => setRow(category, 'priority', event.target.value)}>
                    {CATEGORIES.map((_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                  </select>
                </div>
              </div>;
            })}
          </div>
          <p className={'mt-4 text-sm ' + (Math.abs(total - 100) > 0.0001 ? 'text-danger' : 'text-muted')} role="status">
            Total share: {Math.round(total * 100) / 100}%{Math.abs(total - 100) > 0.0001 ? ' · must equal 100%' : ' · ready to save'}
          </p>
          {duplicatePriority && <p className="field-error" role="alert">Each priority from 1 to 7 must be used exactly once.</p>}
          {fields.allocations && <p className="field-error" role="alert">{fields.allocations}</p>}
        </fieldset>

        <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-2">Recommended minimums <span className="text-muted font-normal">(optional)</span></legend>
          <p className="text-xs text-muted mb-4">Shown to the customer as a note. These do not block a build.</p>
          <div className="grid sm:grid-cols-2 gap-5">
            {MINIMUM_CATEGORIES.map(category => <div key={category}>
              <label htmlFor={'minimum-' + category}>{LABELS[category]} capacity (GB)</label>
              <input id={'minimum-' + category} type="number" min="1" step="1" placeholder="None"
                value={minimums[category as 'memory' | 'storage']}
                onChange={event => { setMinimums(current => ({ ...current, [category]: event.target.value })); setFields(current => ({ ...current, minimums: undefined })); }}/>
            </div>)}
          </div>
          {fields.minimums && <p className="field-error" role="alert">{fields.minimums}</p>}
        </fieldset>
      </form>
    </Drawer>

    <Drawer open={Boolean(confirm)} onClose={() => setConfirm(null)} title={'Archive ' + (confirm?.label || '')}
      footer={confirm ? <>
        <button type="button" className="button" disabled={rowBusy === confirm._id}
          onClick={() => act(confirm, () => api.delete('/admin/profiles/' + confirm._id), 'Profile archived.')}>
          {rowBusy === confirm._id ? 'Archiving…' : 'Yes, archive it'}
        </button>
        <button type="button" className="button secondary" onClick={() => setConfirm(null)} disabled={rowBusy === confirm._id}>Cancel</button>
      </> : undefined}>
      <p className="text-sm">Customers will no longer be able to choose it. Saved builds that used it keep their history and fall back to the default.</p>
    </Drawer>
  </section>;
}