import { useEffect, useState, type ReactNode } from 'react';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { Feedback } from '../components/Feedback';
import { Checks, Parts } from '../components/BuildSummary';
import { ComponentPicker } from '../components/ComponentPicker';
import { SaveBuildControl } from '../components/SaveBuildControl';
import { useComponentOptions } from '../hooks/useComponentOptions';
import { CATEGORIES, LABELS, pesos, type Allocation, type Category, type Component, type Plan, type Profile, type ProfileAllocation, type Validation } from '../types';
export function Builder({ plan, setPlan, actions, showSave = true, allowCustomSplit = false }:
  { plan: Plan; setPlan: (plan: Plan) => void; actions?: ReactNode; showSave?: boolean; allowCustomSplit?: boolean }) {
  const catalog = useApi<Component[]>('/components'); const profiles = useApi<Profile[]>('/profiles');
  const [validation, setValidation] = useState<Validation | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [locks, setLocks] = useState<Partial<Record<Category, number>>>({});
  // A custom split replaces the use case percentages for this build only. It is
  // never saved: the build still records whichever use case it started from.
  const [custom, setCustom] = useState<ProfileAllocation[] | null>(null);
  const [error, setError] = useState(''); const [checking, setChecking] = useState(false);
  const total = plan.items.reduce((s, i) => s + i.component.price * i.quantity, 0);
  const lockCount = Object.keys(locks).length;
  const customTotal = custom ? custom.reduce((sum, row) => sum + (Number.isFinite(row.percent) ? row.percent : 0), 0) : 100;
  const customValid = !custom || Math.abs(customTotal - 100) <= 0.0001;
  // Priority decides which category spare budget fills first, so it follows the
  // shares rather than being set separately. Row order is left alone, otherwise
  // the list would jump around while the shares are being typed.
  const rankedCustom = custom && [...custom]
    .sort((a, b) => b.percent - a.percent || a.category.localeCompare(b.category))
    .reduce((ranks, row, index) => ranks.set(row.category, index + 1), new Map<string, number>());
  // Locking a category below its usual share frees money, which the server
  // shares among the unlocked categories in proportion to their percentages.
  // This explains that movement instead of leaving the numbers to be guessed.
  const freed = allocations.filter(a => !a.locked)
    .reduce((sum, a) => sum + (a.allocated - Math.round(plan.budget * a.percent / 100)), 0);
  const biggestGain = [...allocations].filter(a => !a.locked)
    .sort((a, b) => (b.allocated - Math.round(plan.budget * b.percent / 100)) - (a.allocated - Math.round(plan.budget * a.percent / 100)))[0];
  const splitNote = !allocations.length || !lockCount ? ''
    : freed > 0 ? `Your locks freed ${pesos(freed)}. It was shared among the unlocked categories in proportion to their share${biggestGain ? ', and ' + LABELS[biggestGain.category] + ' gained the most' : ''}.`
      : freed < 0 ? `Your locks take ${pesos(-freed)} more than their usual share, so the unlocked categories were reduced to pay for it.`
        : '';
  const candidates = useComponentOptions(plan.items);
  useEffect(() => {
    const controller = new AbortController();
    // The lock inputs are rendered from allocations, so clearing it here would
    // unmount the field being typed into and drop keyboard focus. The previous
    // split stays on screen until the new one arrives.
    setChecking(true); setError(''); setValidation(null);
    const timer = window.setTimeout(() => {
      // An incomplete custom split would be rejected, so the previous allocation
      // is kept on screen until the shares add up again.
      const allocationRequest = custom && !customValid
        ? Promise.resolve({ data: null as Allocation[] | null })
        : api.post<Allocation[] | null>('/allocations', { budget: plan.budget, profileSlug: plan.profileSlug, locks, ...(custom && rankedCustom ? { allocations: custom.map(row => ({ ...row, priority: rankedCustom.get(row.category) })) } : {}) }, { signal: controller.signal });
      Promise.all([api.post<Validation>('/validations', { items: plan.items.map(i => ({ componentId: i.component._id, quantity: i.quantity })), profileSlug: plan.profileSlug }, { signal: controller.signal }),
        allocationRequest])
        .then(([v, a]) => { if (!controller.signal.aborted) { setValidation(v.data); if (a.data) setAllocations(a.data); } })
        .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
        .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [plan.budget, plan.profileSlug, plan.items, locks, custom, customValid]);
  function choose(category: Category, id: string) {
    const component = catalog.data?.find(c => c._id === id);
    if (id && (candidates.loading || !candidates.options.some(o => o.componentId === id && o.compatible && o.available))) return;
    setPlan({ ...plan, items: [...plan.items.filter(i => i.component.category !== category), ...(component ? [{ component, quantity: 1 }] : [])] });
  }
  return <><div className="flex flex-wrap justify-between gap-4"><div><span className="eyebrow">YOUR BUILD WORKSPACE</span><h1 className="break-words">{plan.name || 'Bring your parts together.'}</h1><p className="intro">Choose, compare, and check as you go.</p></div><button className="button secondary no-print self-start" onClick={() => window.print()} disabled={!plan.items.length}>Print build sheet</button></div>
    {!!plan.reopenNotices?.length && <section className="notice warning mt-5 no-print" aria-label="Catalog changes when reopening"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-sm">Your catalog has changed.</h2><button className="text-sm underline underline-offset-4" onClick={() => setPlan({ ...plan, reopenNotices: undefined })}>Dismiss</button></div><ul className="list-disc pl-5 mt-3 space-y-2">{plan.reopenNotices.map(notice => <li key={notice}>{notice}</li>)}</ul></section>}
    <Feedback loading={catalog.loading || profiles.loading} error={catalog.error || profiles.error} retry={() => { catalog.retry(); profiles.retry(); }}/>
    {catalog.data && profiles.data && <><section className="panel budget-dashboard mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-5"><div><span className="eyebrow">BUILD TOTAL</span><p className="text-3xl font-semibold mt-2">{pesos(total)}</p><span className="text-xs text-muted">{plan.items.length} of 7 categories selected</span></div><div><span className="eyebrow">{total > plan.budget ? 'OVER BUDGET' : 'REMAINING'}</span><p className={`text-2xl font-semibold mt-2 ${total > plan.budget ? 'text-danger' : ''}`}>{pesos(Math.abs(plan.budget - total))}</p></div><label>Budget<input type="number" min="1" step="1" value={plan.budget} onChange={e => setPlan({ ...plan, budget: Number(e.target.value) })}/></label><label>Use case<select value={plan.profileSlug} onChange={e => { setCustom(null); setPlan({ ...plan, profileSlug: e.target.value }); }}>{profiles.data.map(p => <option key={p.slug} value={p.slug}>{p.label}</option>)}</select></label><div className="budget-meter sm:col-span-2 lg:col-span-4"><div className="budget-track" role="progressbar" aria-label="Budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, plan.budget > 0 ? Math.round(total / plan.budget * 100) : 0))} aria-valuetext={`${pesos(total)} of ${pesos(plan.budget)}`}><span className={total > plan.budget ? 'over' : ''} style={{width: `${Math.max(0, Math.min(100, plan.budget > 0 ? total / plan.budget * 100 : 0))}%`}}/></div><span className="text-xs text-muted">Budget used</span></div></section>
    <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 mt-6"><div className="space-y-4 no-print">{CATEGORIES.map(category => {
      const item = plan.items.find(i => i.component.category === category);
      const allocation = allocations.find(a => a.category === category);
      return <section className="panel" key={category}><div className="flex justify-between gap-3"><h2>{LABELS[category]}</h2><span className="text-sm text-muted">{allocation ? `${pesos(allocation.allocated)} target` : ''}</span></div>
        <ComponentPicker category={category} components={catalog.data!} options={candidates.options} loading={candidates.loading} error={candidates.error} selected={item} target={allocation?.allocated} onChoose={id => choose(category, id)}/>
        {item && <div className="flex flex-wrap gap-4 items-end mt-3"><p className="text-sm text-muted flex-1">{[item.component.socket, item.component.memoryType, item.component.formFactor, item.component.capacityGb && `${item.component.capacityGb}GB`, `${item.component.powerDraw}W draw`].filter(Boolean).join(' · ')}</p>{['memory', 'storage'].includes(category) && <label className="w-24">Quantity<input type="number" min="1" max="32" step="1" value={item.quantity} onChange={e => setPlan({ ...plan, items: plan.items.map(i => i === item ? { ...i, quantity: Number(e.target.value) } : i) })}/></label>}</div>}
      </section>;
    })}<p className="text-sm text-muted">Use Save build to keep your selections in your account before leaving or refreshing this page.</p></div>
    <div className="space-y-5">{actions}{showSave && <SaveBuildControl plan={plan} setPlan={setPlan}/>}<div className="print-only panel"><h2>Build sheet</h2><Parts items={plan.items}/></div>{checking && <p role="status" className="text-muted">Checking your selections…</p>}{error && <p className="notice error" role="alert">{error}</p>}{validation && <Checks validation={validation}/>}
      <section className="panel no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>Budget split</h2>
          <div className="flex flex-wrap gap-2">
            {allowCustomSplit && !!allocations.length && <button className="button secondary" onClick={() => setCustom(custom ? null : allocations.map(a => ({ category: a.category, percent: a.percent, priority: a.priority })))}>
              {custom ? 'Use the use case split' : 'Set your own shares'}
            </button>}
            {lockCount > 0 && <button className="button secondary" onClick={() => setLocks({})}>Clear locks</button>}
          </div>
        </div>
        <p className="text-sm text-muted mt-2">{custom
          ? 'You are setting the shares yourself for this build. The seven must add up to 100%, and the priority order follows the shares.'
          : "Your use case sets each category's share of the budget. They are listed in priority order. Lock one to fix its amount, and the rest share what is left."}</p>
        {custom && <p className={'text-sm mt-3 ' + (customValid ? 'text-muted' : 'text-danger')} role="status">
          Total share: {Math.round(customTotal * 100) / 100}%{customValid ? '' : ' · adjust until this reads 100%'}
        </p>}
        {!allocations.length && <p className="text-sm text-muted mt-4" role="status">Working out the split…</p>}
        {splitNote && <p className="notice note mt-4 text-sm">{splitNote}</p>}
        <div className="mt-5 space-y-5">
          {allocations.map(allocation => {
            const baseline = Math.round(plan.budget * allocation.percent / 100);
            const shift = allocation.allocated - baseline;
            const spent = plan.items.filter(item => item.component.category === allocation.category)
              .reduce((sum, item) => sum + item.component.price * item.quantity, 0);
            const chosen = plan.items.some(item => item.component.category === allocation.category);
            const share = custom?.find(row => row.category === allocation.category);
            return <div className={'grid gap-3 items-start ' + (custom ? 'grid-cols-[1fr_5.5rem_5.5rem]' : 'grid-cols-[1fr_7rem]')} key={allocation.category}>
              <div className="min-w-0">
                <p className="text-sm"><span className="text-xs text-muted">Priority {allocation.priority}</span> · {LABELS[allocation.category]}</p>
                <p className="text-xs text-muted mt-1">{allocation.percent}% share · <strong>{pesos(allocation.allocated)}</strong>
                  {allocation.locked ? ' · locked' : shift > 0 ? ` · ${pesos(shift)} above its usual share` : shift < 0 ? ` · ${pesos(-shift)} below its usual share` : ''}</p>
                {chosen && <p className={'text-xs mt-1 ' + (spent > allocation.allocated ? 'text-danger' : 'text-muted')}>
                  {pesos(spent)} chosen · {spent > allocation.allocated ? `${pesos(spent - allocation.allocated)} over target` : `${pesos(allocation.allocated - spent)} still available`}</p>}
              </div>
              {custom && <div>
                <label htmlFor={'share-' + allocation.category} className="text-xs">Share %</label>
                <input id={'share-' + allocation.category} type="number" min="0" max="100" step="any"
                  value={share ? share.percent : ''}
                  onChange={e => setCustom(current => (current || []).map(row => row.category === allocation.category
                    ? { ...row, percent: e.target.value === '' ? 0 : Number(e.target.value) } : row))}/>
              </div>}
              <div>
                <label htmlFor={'lock-' + allocation.category} className="text-xs">Lock (PHP)</label>
                <input id={'lock-' + allocation.category} type="number" min="0" step="1" placeholder="Auto" value={locks[allocation.category] ?? ''}
                  onChange={e => { const next = { ...locks }; if (!e.target.value) delete next[allocation.category]; else next[allocation.category] = Number(e.target.value); setLocks(next); }}/>
              </div>
            </div>;
          })}
        </div>
      </section>
    </div></div></>}
  </>;
}