import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { Feedback } from '../components/Feedback';
import { Checks, Parts } from '../components/BuildSummary';
import { ComponentPicker } from '../components/ComponentPicker';
import { useComponentOptions } from '../hooks/useComponentOptions';
import { CATEGORIES, LABELS, pesos, type Allocation, type Category, type Component, type Plan, type Profile, type Validation } from '../types';
export function Builder({ plan, setPlan }: { plan: Plan; setPlan: (plan: Plan) => void }) {
  const catalog = useApi<Component[]>('/components'); const profiles = useApi<Profile[]>('/profiles');
  const [validation, setValidation] = useState<Validation | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [locks, setLocks] = useState<Partial<Record<Category, number>>>({});
  const [error, setError] = useState(''); const [checking, setChecking] = useState(false);
  const total = plan.items.reduce((s, i) => s + i.component.price * i.quantity, 0);
  const candidates = useComponentOptions(plan.items);
  useEffect(() => {
    const controller = new AbortController();
    setChecking(true); setError(''); setValidation(null); setAllocations([]);
    const timer = window.setTimeout(() => {
      Promise.all([api.post<Validation>('/validations', { items: plan.items.map(i => ({ componentId: i.component._id, quantity: i.quantity })), profileSlug: plan.profileSlug }, { signal: controller.signal }),
        api.post<Allocation[]>('/allocations', { budget: plan.budget, profileSlug: plan.profileSlug, locks }, { signal: controller.signal })])
        .then(([v, a]) => { if (!controller.signal.aborted) { setValidation(v.data); setAllocations(a.data); } })
        .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
        .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [plan, locks]);
  function choose(category: Category, id: string) {
    const component = catalog.data?.find(c => c._id === id);
    if (id && (candidates.loading || !candidates.options.some(o => o.componentId === id && o.compatible && o.available))) return;
    setPlan({ ...plan, items: [...plan.items.filter(i => i.component.category !== category), ...(component ? [{ component, quantity: 1 }] : [])] });
  }
  return <><div className="flex flex-wrap justify-between gap-4"><div><span className="eyebrow">YOUR BUILD WORKSPACE</span><h1>Bring your parts together.</h1><p className="intro">Choose, compare, and check as you go.</p></div><button className="button secondary no-print self-start" onClick={() => window.print()} disabled={!plan.items.length}>Print build sheet</button></div>
    <Feedback loading={catalog.loading || profiles.loading} error={catalog.error || profiles.error} retry={() => { catalog.retry(); profiles.retry(); }}/>
    {catalog.data && profiles.data && <><section className="panel budget-dashboard mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-5"><div><span className="eyebrow">BUILD TOTAL</span><p className="text-3xl font-semibold mt-2">{pesos(total)}</p><span className="text-xs text-muted">{plan.items.length} of 7 categories selected</span></div><div><span className="eyebrow">{total > plan.budget ? 'OVER BUDGET' : 'REMAINING'}</span><p className={`text-2xl font-semibold mt-2 ${total > plan.budget ? 'text-danger' : ''}`}>{pesos(Math.abs(plan.budget - total))}</p></div><label>Budget<input type="number" min="1" step="1" value={plan.budget} onChange={e => setPlan({ ...plan, budget: Number(e.target.value) })}/></label><label>Use case<select value={plan.profileSlug} onChange={e => setPlan({ ...plan, profileSlug: e.target.value })}>{profiles.data.map(p => <option key={p.slug} value={p.slug}>{p.label}</option>)}</select></label><div className="budget-meter sm:col-span-2 lg:col-span-4"><div className="budget-track" role="progressbar" aria-label="Budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, plan.budget > 0 ? Math.round(total / plan.budget * 100) : 0))} aria-valuetext={`${pesos(total)} of ${pesos(plan.budget)}`}><span className={total > plan.budget ? 'over' : ''} style={{width: `${Math.max(0, Math.min(100, plan.budget > 0 ? total / plan.budget * 100 : 0))}%`}}/></div><span className="text-xs text-muted">Budget used</span></div></section>
    <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 mt-6"><div className="space-y-4 no-print">{CATEGORIES.map(category => {
      const item = plan.items.find(i => i.component.category === category);
      const allocation = allocations.find(a => a.category === category);
      return <section className="panel" key={category}><div className="flex justify-between gap-3"><h2>{LABELS[category]}</h2><span className="text-sm text-muted">{allocation ? `${pesos(allocation.allocated)} target` : ''}</span></div>
        <ComponentPicker category={category} components={catalog.data!} options={candidates.options} loading={candidates.loading} error={candidates.error} selected={item} target={allocation?.allocated} onChoose={id => choose(category, id)}/>
        {item && <div className="flex flex-wrap gap-4 items-end mt-3"><p className="text-sm text-muted flex-1">{[item.component.socket, item.component.memoryType, item.component.formFactor, item.component.capacityGb && `${item.component.capacityGb}GB`, `${item.component.powerDraw}W draw`].filter(Boolean).join(' · ')}</p>{['memory', 'storage'].includes(category) && <label className="w-24">Quantity<input type="number" min="1" max="32" step="1" value={item.quantity} onChange={e => setPlan({ ...plan, items: plan.items.map(i => i === item ? { ...i, quantity: Number(e.target.value) } : i) })}/></label>}</div>}
      </section>;
    })}<p className="text-sm text-muted">Your draft remains in this session. Saved builds and account ownership will be completed by the team.</p></div>
    <div className="space-y-5"><div className="print-only panel"><h2>Build sheet</h2><Parts items={plan.items}/></div>{checking && <p role="status" className="text-muted">Checking your selections…</p>}{error && <p className="notice error" role="alert">{error}</p>}{validation && <Checks validation={validation}/>}
      <section className="panel no-print"><h2>Category budget locks</h2><p className="text-sm text-muted mt-2">Set a peso target. The unlocked categories share the remaining budget.</p>{CATEGORIES.map(category => <label className="grid grid-cols-[1fr_7rem] items-center gap-3 mt-3" key={category}><span className="text-sm">{LABELS[category]}</span><input aria-label={`${LABELS[category]} budget lock`} type="number" min="0" step="1" placeholder="Auto" value={locks[category] ?? ''} onChange={e => { const next = { ...locks }; if (!e.target.value) delete next[category]; else next[category] = Number(e.target.value); setLocks(next); }}/></label>)}<button className="button secondary mt-4" onClick={() => setLocks({})}>Reset locks</button></section>
    </div></div></>}
  </>;
}
