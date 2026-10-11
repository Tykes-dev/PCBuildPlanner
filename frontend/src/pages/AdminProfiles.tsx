import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { useTableState } from '../hooks/useTableState';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { Feedback } from '../components/Feedback';
import { IconButton } from '../components/Icon';
import { emptyProfile, profileSchema, toProfilePayload, type ProfileFormValues } from '../schemas/profile';
import { CATEGORIES, LABELS, pesos, type Category, type Profile } from '../types';

const PREVIEW_BUDGET = 50000;

function toForm(profile: Profile): ProfileFormValues {
  const minimum = (category: string) => {
    const match = profile.minimums?.find(entry => entry.category === category);
    return match ? String(match.value) : '';
  };
  return {
    slug: profile.slug, label: profile.label, description: profile.description || '',
    minMemory: minimum('memory'), minStorage: minimum('storage'),
    rows: CATEGORIES.map(category => {
      const match = profile.allocations.find(allocation => allocation.category === category);
      return { category, percent: match ? String(match.percent) : '0', priority: match ? String(match.priority) : '1' };
    })
  };
}

const searchText = (row: Profile) => [row.label, row.slug, row.description].filter(Boolean).join(' ');
const sortValues = {
  label: (row: Profile) => row.label.toLowerCase(),
  slug: (row: Profile) => row.slug,
  top: (row: Profile) => [...row.allocations].sort((a, b) => a.priority - b.priority)[0]?.percent ?? 0
};

export function AdminProfiles() {
  const profiles = useApi<Profile[]>('/admin/profiles');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [confirm, setConfirm] = useState<Profile | null>(null);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [state, setState] = useState<'' | 'active' | 'archived'>('');

  // The seven shares have to total 100 and each priority has to be used once,
  // so the rules live in schemas/profile.ts where they can see the whole form.
  const { register, handleSubmit, reset, watch, setValue, setError,
    formState: { errors, isSubmitting } } = useForm<ProfileFormValues>({
      resolver: zodResolver(profileSchema), defaultValues: emptyProfile()
    });
  const busy = isSubmitting;
  const rows = watch('rows');

  const visible = (profiles.data || []).filter(row =>
    !state || (state === 'archived' ? row.active === false : row.active !== false));
  const table = useTableState<Profile>({ rows: visible, searchText, sortValues, pageSize: 10, initialSort: { key: 'label', direction: 'asc' } });

  // Derived while rendering rather than stored, so the running total and the
  // priority warning react as the administrator types.
  const total = rows.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
  const usedPriorities = rows.map(row => row.priority);
  const duplicatePriority = new Set(usedPriorities).size !== usedPriorities.length;
  const ordered = rows.map((row, index) => ({ row, index }))
    .sort((a, b) => Number(a.row.priority) - Number(b.row.priority));

  function sortPriorityByPercent() {
    const ranked = rows.map((row, index) => ({ row, index }))
      .sort((a, b) => (Number(b.row.percent) || 0) - (Number(a.row.percent) || 0)
        || a.row.category.localeCompare(b.row.category));
    ranked.forEach((entry, position) => setValue(`rows.${entry.index}.priority`, String(position + 1)));
    setFormError('');
  }

  function openForm(profile?: Profile) {
    setEditing(profile || null);
    reset(profile ? toForm(profile) : emptyProfile());
    setFormError(''); setFeedback(''); setPageError('');
    setFormOpen(true);
  }

  async function act(profile: Profile, run: () => Promise<{ data: { message?: string } }>, fallback: string) {
    setPageError(''); setFeedback(''); setRowBusy(profile._id || '');
    try {
      const response = await run();
      setFeedback(response.data.message || fallback);
      setConfirm(null);
      profiles.retry();
    } catch (failure) { setPageError(errorMessage(failure)); }
    finally { setRowBusy(null); }
  }

  async function onSubmit(values: ProfileFormValues) {
    setFormError('');
    try {
      const payload = toProfilePayload(values);
      const response = editing
        ? await api.put<Profile>('/admin/profiles/' + editing._id, payload)
        : await api.post<Profile>('/admin/profiles', payload);
      setFeedback(response.data.label + (editing ? ' was updated.' : ' was created.'));
      setFormOpen(false); setEditing(null);
      profiles.retry();
    } catch (failure) {
      setFormError(errorMessage(failure));
      // A duplicate slug comes back from the server, not from the schema.
      if (isAxiosError(failure) && failure.response?.data?.fields) {
        for (const [key, message] of Object.entries(failure.response.data.fields as Record<string, unknown>)) {
          if (['slug', 'label', 'description'].includes(key) && typeof message === 'string') {
            setError(key as 'slug' | 'label' | 'description', { message });
          }
        }
      }
    }
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
    { key: 'actions', header: 'Actions', align: 'right', render: row => <div className="row-actions">
      <IconButton icon="edit" label={'Edit ' + row.label} onClick={() => openForm(row)} disabled={rowBusy === row._id}/>
      {row.active === false
        ? <IconButton icon="restore" label={'Restore ' + row.label} busy={rowBusy === row._id}
            onClick={() => act(row, () => api.patch('/admin/profiles/' + row._id + '/restore'), 'Profile restored.')}/>
        : <>
          {!row.isDefault && <IconButton icon="star" label={'Make ' + row.label + ' the default'} busy={rowBusy === row._id}
            onClick={() => act(row, () => api.patch('/admin/profiles/' + row._id + '/default'), 'Default updated.')}/>}
          <IconButton icon="archive" tone="danger" label={'Archive ' + row.label}
            onClick={() => setConfirm(row)} disabled={rowBusy === row._id}/>
        </>}
    </div> }
  ];

  return <section>
    <span className="eyebrow">ADMINISTRATION</span><h1>Use cases.</h1>
    <p className="intro">A use case decides how a customer's budget is divided across the seven categories.</p>

    {pageError && <p role="alert" className="notice error mb-4">{pageError}</p>}
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
      <form id="profile-form" noValidate className="grid gap-6"
        onSubmit={handleSubmit(onSubmit, () => setFormError('Check the highlighted fields before saving.'))}>
        <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-4">Details</legend>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="profile-label">Name</label>
              <input id="profile-label" {...register('label')} maxLength={80} aria-invalid={Boolean(errors.label)}/>
              {errors.label && <p role="alert" className="field-error">{errors.label.message}</p>}
            </div>
            <div>
              <label htmlFor="profile-slug">Slug</label>
              <input id="profile-slug" {...register('slug')} maxLength={100} placeholder="gaming" aria-invalid={Boolean(errors.slug)}/>
              <p className="text-xs text-muted mt-2">Lowercase letters, numbers and hyphens. Saved builds keep this value.</p>
              {errors.slug && <p role="alert" className="field-error">{errors.slug.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="profile-description">Description</label>
              <input id="profile-description" {...register('description')} maxLength={300} placeholder="Competitive gaming at 1080p." aria-invalid={Boolean(errors.description)}/>
              {errors.description && <p role="alert" className="field-error">{errors.description.message}</p>}
            </div>
          </div>
        </fieldset>

        <fieldset disabled={busy} className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <legend className="text-sm font-semibold">Budget split</legend>
            <button type="button" className="button secondary !py-1.5" onClick={sortPriorityByPercent} disabled={busy}>Match priority to share</button>
          </div>
          <div className="space-y-3">
            {/* Rows are shown in priority order, but each input stays bound to
                its own category so reordering never moves a value. */}
            {ordered.map(({ row, index }) => {
              const category = row.category as Category;
              const percent = Number(row.percent) || 0;
              return <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-3 items-end" key={category}>
                <div>
                  <span className="text-sm">{LABELS[category]}</span>
                  <p className="text-xs text-muted mt-1">{pesos(Math.round(PREVIEW_BUDGET * percent / 100))} of {pesos(PREVIEW_BUDGET)}</p>
                </div>
                <div>
                  <label htmlFor={'percent-' + category} className="text-xs">Share %</label>
                  <input id={'percent-' + category} type="number" min="0" max="100" step="any" {...register(`rows.${index}.percent`)}/>
                </div>
                <div>
                  <label htmlFor={'priority-' + category} className="text-xs">Priority</label>
                  <select id={'priority-' + category} {...register(`rows.${index}.priority`)}>
                    {CATEGORIES.map((_, option) => <option key={option + 1} value={option + 1}>{option + 1}</option>)}
                  </select>
                </div>
              </div>;
            })}
          </div>
          <p className={'mt-4 text-sm ' + (Math.abs(total - 100) > 0.0001 ? 'text-danger' : 'text-muted')} role="status">
            Total share: {Math.round(total * 100) / 100}%{Math.abs(total - 100) > 0.0001 ? ' · must equal 100%' : ' · ready to save'}
          </p>
          {duplicatePriority && <p className="field-error" role="alert">Each priority from 1 to 7 must be used exactly once.</p>}
          {errors.rows?.message && <p className="field-error" role="alert">{errors.rows.message}</p>}
        </fieldset>

        <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-2">Recommended minimums <span className="text-muted font-normal">(optional)</span></legend>
          <p className="text-xs text-muted mb-4">Shown to the customer as a note. These do not block a build.</p>
          <div className="grid sm:grid-cols-2 gap-5">
            {([['memory', 'minMemory'], ['storage', 'minStorage']] as const).map(([category, field]) => <div key={category}>
              <label htmlFor={'minimum-' + category}>{LABELS[category]} capacity (GB)</label>
              <input id={'minimum-' + category} type="number" min="1" step="1" placeholder="None"
                {...register(field)} aria-invalid={Boolean(errors[field])}/>
              {errors[field] && <p className="field-error" role="alert">{errors[field]?.message}</p>}
            </div>)}
          </div>
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