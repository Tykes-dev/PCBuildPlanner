import { useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
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

export function AdminProfiles() {
  const profiles = useApi<Profile[]>('/admin/profiles');
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<Rows>(emptyRows);
  const [minimums, setMinimums] = useState<Minimums>(emptyMinimums);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const submitting = useRef(false);
  const formSection = useRef<HTMLFormElement>(null);

  // Derived during render so the running total always matches what is typed.
  const total = CATEGORIES.reduce((sum, category) => sum + (Number(rows[category].percent) || 0), 0);
  const usedPriorities = CATEGORIES.map(category => rows[category].priority);
  const duplicatePriority = new Set(usedPriorities).size !== usedPriorities.length;
  const ordered = [...CATEGORIES].sort((a, b) => Number(rows[a].priority) - Number(rows[b].priority));

  function setRow(category: Category, key: 'percent' | 'priority', value: string) {
    setRows(current => ({ ...current, [category]: { ...current[category], [key]: value } }));
    setFields(current => ({ ...current, allocations: undefined }));
    setFeedback('');
  }

  // Priority decides which category spare budget fills first, so it is only
  // meaningful when it follows the percentages. This lines the two up.
  function sortPriorityByPercent() {
    const ranked = [...CATEGORIES].sort((a, b) => (Number(rows[b].percent) || 0) - (Number(rows[a].percent) || 0) || a.localeCompare(b));
    setRows(current => {
      const next = { ...current };
      ranked.forEach((category, index) => { next[category] = { ...next[category], priority: String(index + 1) }; });
      return next;
    });
    setFields(current => ({ ...current, allocations: undefined }));
  }

  function resetForm() {
    setEditingId(null); setSlug(''); setLabel(''); setDescription('');
    setRows(emptyRows()); setMinimums(emptyMinimums());
    setFields({}); setError(''); setFeedback('');
  }

  function startEdit(profile: Profile) {
    setEditingId(profile._id || null);
    setSlug(profile.slug); setLabel(profile.label); setDescription(profile.description || '');
    setRows(toRows(profile)); setMinimums(toMinimums(profile));
    setFields({}); setError(''); setFeedback(''); setConfirmId(null);
    formSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function act(profile: Profile, run: () => Promise<{ data: { message?: string } }>, fallback: string) {
    setError(''); setFeedback(''); setRowBusyId(profile._id || '');
    try {
      const response = await run();
      setFeedback(response.data.message || fallback);
      setConfirmId(null);
      profiles.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setRowBusyId(null); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(''); setFeedback('');
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
    if (Object.keys(errors).length) { setError('Check the highlighted fields before saving the profile.'); return; }

    const payload = {
      slug: cleanSlug, label: label.trim(), description: description.trim(),
      allocations: CATEGORIES.map(category => ({ category, percent: Number(rows[category].percent), priority: Number(rows[category].priority) })),
      minimums: MINIMUM_CATEGORIES
        .filter(category => minimums[category as 'memory' | 'storage'].trim())
        .map(category => ({ category, value: Number(minimums[category as 'memory' | 'storage']) }))
    };

    submitting.current = true; setBusy(true);
    try {
      const response = editingId
        ? await api.put<Profile>('/admin/profiles/' + editingId, payload)
        : await api.post<Profile>('/admin/profiles', payload);
      setFeedback(response.data.label + (editingId ? ' was updated.' : ' was created.'));
      resetForm();
      profiles.retry();
    } catch (failure) {
      setError(errorMessage(failure));
      if (isAxiosError(failure) && failure.response?.data?.fields) {
        const responseFields = failure.response.data.fields as Record<string, unknown>;
        setFields(Object.fromEntries(Object.entries(responseFields).filter(([, value]) => typeof value === 'string')) as FieldErrors);
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section className="max-w-4xl mx-auto">
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><span className="eyebrow">ADMINISTRATION</span><h1>Use case profiles.</h1>
        <p className="intro !mb-0">A profile decides how a customer's budget is divided across the seven categories.</p></div>
    </div>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {feedback && <p role="status" className="notice note mb-5">{feedback}</p>}

    <form ref={formSection} className="grid gap-6" onSubmit={submit}>
      <fieldset disabled={busy} className="panel min-w-0">
        <legend className="sr-only">Profile details</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>{editingId ? 'Edit profile' : 'New profile'}</h2>
          {editingId && <button type="button" className="button secondary" onClick={resetForm} disabled={busy}>Cancel edit</button>}
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mt-5">
          <div>
            <label htmlFor="profile-label">Name</label>
            <input id="profile-label" value={label} onChange={event => { setLabel(event.target.value); setFields(current => ({ ...current, label: undefined })); }}
              maxLength={80} aria-invalid={Boolean(fields.label)} aria-describedby={fields.label ? 'label-error' : undefined}/>
            {fields.label && <p id="label-error" role="alert" className="field-error">{fields.label}</p>}
          </div>
          <div>
            <label htmlFor="profile-slug">Slug</label>
            <input id="profile-slug" value={slug} onChange={event => { setSlug(event.target.value); setFields(current => ({ ...current, slug: undefined })); }}
              maxLength={100} placeholder="gaming" aria-invalid={Boolean(fields.slug)} aria-describedby={'slug-help' + (fields.slug ? ' slug-error' : '')}/>
            <p id="slug-help" className="text-xs text-muted mt-2">Lowercase letters, numbers and hyphens. Saved builds keep this value.</p>
            {fields.slug && <p id="slug-error" role="alert" className="field-error">{fields.slug}</p>}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="profile-description">Description</label>
            <input id="profile-description" value={description} onChange={event => { setDescription(event.target.value); setFields(current => ({ ...current, description: undefined })); }}
              maxLength={300} placeholder="Competitive gaming at 1080p." aria-invalid={Boolean(fields.description)}/>
            {fields.description && <p role="alert" className="field-error">{fields.description}</p>}
          </div>
        </div>
      </fieldset>

      <fieldset disabled={busy} className="panel min-w-0">
        <legend className="sr-only">Budget split</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>Budget split</h2>
          <button type="button" className="button secondary" onClick={sortPriorityByPercent} disabled={busy}>Match priority to share</button>
        </div>
        <p className="text-sm text-muted mt-2 mb-5">The share decides how much of the budget a category gets. The priority decides which category spare budget fills first, so keep the two in the same order.</p>
        <div className="space-y-3">
          {ordered.map(category => {
            const percent = Number(rows[category].percent) || 0;
            return <div className="grid grid-cols-[1fr_6rem_6rem] gap-3 items-end" key={category}>
              <div>
                <span className="text-sm">{LABELS[category]}</span>
                <p className="text-xs text-muted mt-1">{pesos(Math.round(PREVIEW_BUDGET * percent / 100))} of a {pesos(PREVIEW_BUDGET)} budget</p>
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
        <p className={'mt-5 text-sm ' + (Math.abs(total - 100) > 0.0001 ? 'text-danger' : 'text-muted')} role="status">
          Total share: {Math.round(total * 100) / 100}% {Math.abs(total - 100) > 0.0001 ? '· must equal 100%' : '· ready to save'}
        </p>
        {duplicatePriority && <p className="field-error" role="alert">Each priority from 1 to 7 must be used exactly once.</p>}
        {fields.allocations && <p className="field-error" role="alert">{fields.allocations}</p>}
      </fieldset>

      <fieldset disabled={busy} className="panel min-w-0">
        <legend className="sr-only">Recommended minimums</legend>
        <h2>Recommended minimums <span className="text-sm text-muted font-normal">(optional)</span></h2>
        <p className="text-sm text-muted mt-2 mb-5">Shown to the customer as a note. These do not block a build.</p>
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

      <div className="flex flex-wrap gap-4 items-center">
        <button type="submit" className="button light w-full sm:w-auto" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create profile'}</button>
        {busy && <p role="status" className="text-sm text-muted">Saving the profile…</p>}
      </div>
    </form>

    <section className="mt-12">
      <h2>Existing profiles</h2>
      <p className="text-sm text-muted mt-2 mb-5">Customers choose from the active profiles. The default is used when a saved build's own profile is unavailable.</p>
      <Feedback loading={profiles.loading} error={profiles.error} retry={profiles.retry}/>
      {profiles.data && (!profiles.data.length
        ? <p className="notice note">No profiles yet. Create the first one with the form above.</p>
        : <ul className="space-y-3">
          {profiles.data.map(profile => {
            const sorted = [...profile.allocations].sort((a, b) => a.priority - b.priority);
            return <li className="panel" key={profile._id || profile.slug}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base break-words">{profile.label}</h3>
                    {profile.isDefault && <span className="tag">Default</span>}
                    {profile.active === false && <span className="tag">Archived</span>}
                  </div>
                  <p className="text-sm text-muted mt-2 break-words">{profile.description || 'No description.'}</p>
                  <p className="text-xs text-muted mt-2">{sorted.map(row => LABELS[row.category] + ' ' + row.percent + '%').join(' · ')}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="button secondary" onClick={() => startEdit(profile)} disabled={busy || rowBusyId === profile._id}>Edit</button>
                  {profile.active === false
                    ? <button type="button" className="button secondary" disabled={rowBusyId === profile._id}
                        onClick={() => act(profile, () => api.patch('/admin/profiles/' + profile._id + '/restore'), 'Profile restored.')}>Restore</button>
                    : <>
                      {!profile.isDefault && <button type="button" className="button secondary" disabled={rowBusyId === profile._id}
                        onClick={() => act(profile, () => api.patch('/admin/profiles/' + profile._id + '/default'), 'Default profile updated.')}>Make default</button>}
                      <button type="button" className="button secondary" onClick={() => setConfirmId(profile._id || null)} disabled={rowBusyId === profile._id}>Archive</button>
                    </>}
                </div>
              </div>
              {confirmId && confirmId === profile._id && <div className="notice warning mt-4" role="alertdialog" aria-label={'Confirm archiving ' + profile.label}>
                <p className="text-sm">Archive <strong>{profile.label}</strong>? Customers will no longer be able to choose it. Saved builds that used it keep their history and fall back to the default.</p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button type="button" className="button" disabled={rowBusyId === profile._id}
                    onClick={() => act(profile, () => api.delete('/admin/profiles/' + profile._id), 'Profile archived.')}>{rowBusyId === profile._id ? 'Archiving…' : 'Yes, archive it'}</button>
                  <button type="button" className="button secondary" onClick={() => setConfirmId(null)} disabled={rowBusyId === profile._id}>Cancel</button>
                </div>
              </div>}
            </li>;
          })}
        </ul>)}
    </section>
  </section>;
}