import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { recommendationSchema, type RecommendationInput } from '../schemas/recommendation';
import { Feedback } from '../components/Feedback';
import { Checks, Parts } from '../components/BuildSummary';
import { LABELS, pesos, type Plan, type Profile, type Recommendation } from '../types';
export function Recommend({ setPlan }: { setPlan: (plan: Plan) => void }) {
  const profiles = useApi<Profile[]>('/profiles');
  const [result, setResult] = useState<Recommendation | null>(null);
  const [submitted, setSubmitted] = useState<RecommendationInput | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RecommendationInput>({ resolver: zodResolver(recommendationSchema), defaultValues: { budget: 50000, profileSlug: 'gaming' } });
  async function submit(input: RecommendationInput) {
    setError(''); setResult(null);
    try { const response = await api.post<Recommendation>('/recommendations', input); setResult(response.data); setSubmitted(input); }
    catch (e) { setError(errorMessage(e)); }
  }
  return <><span className="eyebrow">BUDGET FIRST</span><h1>Find your starting build.</h1><p className="intro">A complete set of parts, with room for your own choices.</p>
    <Feedback {...profiles}/>
    {profiles.data && !profiles.data.length && <p className="notice warning">No use cases available. Seed the database first.</p>}
    {!!profiles.data?.length && <form className="panel grid md:grid-cols-[1fr_1fr_auto] gap-5 items-start mt-6" onSubmit={handleSubmit(submit)}>
      <label>Budget in pesos<input type="number" {...register('budget', { valueAsNumber: true })}/>{errors.budget && <span className="field-error">{errors.budget.message}</span>}</label>
      <label>What will you use it for?<select {...register('profileSlug')}>{profiles.data.map(p => <option value={p.slug} key={p.slug}>{p.label}</option>)}</select>{errors.profileSlug && <span className="field-error">{errors.profileSlug.message}</span>}</label>
      <button className="button mt-6" disabled={isSubmitting}>{isSubmitting ? 'Finding parts…' : 'Find my build ↗'}</button></form>}
    {error && <p className="notice error mt-5" role="alert">{error}</p>}
    {result && <div className="mt-6" aria-live="polite"><p className={`notice ${result.feasible ? 'note' : 'warning'}`}>{result.message}</p>
      {result.feasible && result.validation && submitted && <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 mt-5"><section className="panel"><div className="flex justify-between gap-3"><h2>Your recommended parts</h2><strong>{pesos(result.validation.total)}</strong></div><Parts items={result.items}/><div className="flex flex-wrap justify-between gap-4 mt-5"><p>{pesos(result.remaining ?? 0)} remaining</p><button className="button" onClick={() => { setPlan({ ...submitted, items: result.items }); navigate('/builder'); }}>Make this build yours ↗</button></div></section>
      <div className="space-y-5"><Checks validation={result.validation}/><section className="panel"><h2>Budget targets</h2>{result.allocations.map(a => <p className="flex justify-between mt-3 text-sm" key={a.category}><span>{LABELS[a.category]} · {a.percent}%</span><strong>{pesos(a.allocated)}</strong></p>)}</section></div></div>}
    </div>}</>;
}
