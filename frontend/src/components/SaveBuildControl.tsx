import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import type { Plan } from '../types';
import type { SavedBuild } from '../types/builds';

function contentsKey(plan: Plan) {
  return JSON.stringify([plan.budget, plan.profileSlug, plan.items.map(item => [item.component._id, item.quantity])]);
}

export function SaveBuildControl({ plan, setPlan }: { plan: Plan; setPlan: (plan: Plan) => void }) {
  const [name, setName] = useState(plan.name || 'My PC build');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ id: string; message: string } | null>(null);
  const submitting = useRef(false);
  const latestPlan = useRef(plan);
  latestPlan.current = plan;
  useEffect(() => {
    setName(plan.name || 'My PC build');
    setError(''); setSaved(current => current?.id === plan.savedBuildId ? current : null);
  }, [plan.savedBuildId, plan.name]);

  async function save(event: FormEvent, asNew = false) {
    event.preventDefault();
    if (submitting.current) return;
    const buildName = name.trim();
    if (!buildName) { setError('Give your build a name.'); return; }
    const source = plan;
    const payload = {
      name: buildName, budget: source.budget, profileSlug: source.profileSlug,
      items: source.items.map(item => ({ componentId: item.component._id, quantity: item.quantity })),
    };
    submitting.current = true;
    setSaving(true); setError(''); setSaved(null);
    try {
      const response = source.savedBuildId && !asNew
        ? await api.put<SavedBuild>('/builds/' + source.savedBuildId, payload)
        : await api.post<SavedBuild>('/builds', payload);
      const current = latestPlan.current;
      const editedWhileSaving = contentsKey(current) !== contentsKey(source);
      if (current.savedBuildId === source.savedBuildId) {
        setPlan({ ...current, items: editedWhileSaving ? current.items : response.data.items, savedBuildId: response.data.id, name: response.data.name });
      }
      setSaved({ id: response.data.id, message: editedWhileSaving ? 'Build saved. Save again to include the edits made while saving.' : 'Build saved to your account.' });
    } catch (failure) { setError(errorMessage(failure)); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <section className="panel no-print">
    <span className="eyebrow">{plan.savedBuildId ? 'SAVED BUILD' : 'KEEP THIS DRAFT'}</span>
    <h2 className="mt-2">{plan.savedBuildId ? 'Save your changes.' : 'Save your build.'}</h2>
    <p className="text-sm text-muted mt-2">Save any stage of your build and return to it from your account.</p>
    <form className="mt-4" onSubmit={save}>
      <label htmlFor="save-build-name">Build name</label>
      <input id="save-build-name" value={name} maxLength={100} required disabled={saving} onChange={event => { setName(event.target.value); setSaved(null); }} placeholder="My PC build"/>
      <div className="flex flex-wrap gap-3 mt-4">
        <button className="button" disabled={saving}>{saving ? 'Saving…' : plan.savedBuildId ? 'Save changes' : 'Save build'}</button>
        {plan.savedBuildId && <button type="button" className="button secondary" disabled={saving} onClick={event => void save(event, true)}>Save as new</button>}
      </div>
    </form>
    {error && <p className="notice error mt-4" role="alert">{error}</p>}
    {saved && <p className="notice note mt-4" role="status">{saved.message} <Link className="underline underline-offset-4" to={'/builds/' + saved.id}>View details</Link></p>}
    {!saved && plan.savedBuildId && <Link className="text-link mt-4" to={'/builds/' + plan.savedBuildId}>Build details &amp; requests <span aria-hidden="true">↗</span></Link>}
  </section>;
}




