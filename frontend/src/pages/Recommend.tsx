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

const NOT_LISTED = '__not-listed';
const PRESETS = [30000, 50000, 80000, 120000];

export function Recommend({ setPlan }: { setPlan: (plan: Plan) => void }) {
  const profiles = useApi<Profile[]>('/profiles');
  const [result, setResult] = useState<Recommendation | null>(null);
  const [submitted, setSubmitted] = useState<RecommendationInput | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<RecommendationInput>({ resolver: zodResolver(recommendationSchema), defaultValues: { budget: 50000, profileSlug: 'gaming' } });

  const budget = watch('budget');
  const chosen = watch('profileSlug');

  async function submit(input: RecommendationInput) {
    // No profile fits this customer, so the shop builds it by hand instead.
    if (input.profileSlug === NOT_LISTED) { navigate('/help?budget=' + input.budget); return; }
    setError(''); setResult(null);
    try {
      const response = await api.post<Recommendation>('/recommendations', input);
      setResult(response.data); setSubmitted(input);
    } catch (failure) { setError(errorMessage(failure)); }
  }

  const spent = result?.validation?.total ?? 0;
  const used = submitted?.budget ? Math.min(100, Math.round((spent / submitted.budget) * 100)) : 0;

  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">BUDGET FIRST</span>
        <h1>Find your starting build.</h1>
        <p className="intro">Set a budget, say what the PC is for, and get a complete set of parts that fit together. Change anything you like afterwards.</p>
      </div>
    </div>

    <Feedback {...profiles}/>
    {profiles.data && !profiles.data.length && <p className="notice warning">No use cases available. Seed the database first.</p>}

    {Boolean(profiles.data?.length) && <form className="finder" onSubmit={handleSubmit(submit)}>
      <div className="finder-budget">
        <label htmlFor="budget-field">Your budget</label>
        <div className="peso-field">
          <span aria-hidden="true">₱</span>
          <input id="budget-field" type="number" min="1" step="1" {...register('budget', { valueAsNumber: true })}/>
        </div>
        <div className="preset-row">
          {PRESETS.map(amount => <button type="button" key={amount}
            className={'preset' + (budget === amount ? ' picked' : '')}
            onClick={() => setValue('budget', amount, { shouldValidate: true })}>{pesos(amount)}</button>)}
        </div>
        {errors.budget && <span className="field-error">{errors.budget.message}</span>}
      </div>

      <fieldset className="finder-use">
        <legend>What will you use it for?</legend>
        <div className="use-grid">
          {profiles.data!.map(profile => <label key={profile.slug} className={'use-card' + (chosen === profile.slug ? ' picked' : '')}>
            <input type="radio" value={profile.slug} {...register('profileSlug')} className="sr-only"/>
            <span className="use-name">{profile.label}</span>
            {profile.description && <span className="use-desc">{profile.description}</span>}
          </label>)}
          <label className={'use-card other' + (chosen === NOT_LISTED ? ' picked' : '')}>
            <input type="radio" value={NOT_LISTED} {...register('profileSlug')} className="sr-only"/>
            <span className="use-name">Something else</span>
            <span className="use-desc">Send it to the shop and they will build it by hand.</span>
          </label>
        </div>
        {errors.profileSlug && <span className="field-error">{errors.profileSlug.message}</span>}
      </fieldset>

      <div className="finder-go">
        <button className="button light" disabled={isSubmitting}>{isSubmitting ? 'Finding parts…' : 'Find my build'} <span aria-hidden="true">↗</span></button>
        <p className="row-sub">Nothing is saved until you choose to save it.</p>
      </div>
    </form>}

    {error && <p className="notice error mt-6" role="alert">{error}</p>}

    {result && <div className="mt-8" aria-live="polite">
      {!result.feasible || !result.validation || !submitted
        ? <p className="notice warning">{result.message}</p>
        : <>
          <div className="summary-bar">
            <div><span className="eyebrow">Parts total</span><strong className="cell-num">{pesos(result.validation.total)}</strong></div>
            <div><span className="eyebrow">Your budget</span><strong className="cell-num">{pesos(submitted.budget)}</strong></div>
            <div><span className="eyebrow">Left over</span><strong className="cell-num">{pesos(result.remaining ?? 0)}</strong></div>
            <div><span className="eyebrow">Compatibility</span>
              <strong><span className={'tag ' + (result.validation.valid ? 'pass' : 'warning')}>{result.validation.valid ? 'Ready' : 'Check it'}</span></strong></div>
            <div className="summary-meter">
              <span className="budget-track" aria-hidden="true"><span style={{ width: used + '%' }}/></span>
              <p className="row-sub">{used}% of the budget used</p>
            </div>
          </div>
          <p className="result-message">{result.message}</p>

          <div className="detail-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>Your recommended parts</h2>
                <strong className="cell-num">{pesos(result.validation.total)}</strong>
              </div>
              <p className="panel-note">A starting point, not a final answer. Open it in the planner to swap anything.</p>
              <Parts items={result.items}/>
              <div className="panel-total">
                <strong>Total</strong><strong className="cell-num">{pesos(result.validation.total)}</strong>
              </div>
              <button className="button light mt-5" onClick={() => { setPlan({ ...submitted, items: result.items }); navigate('/builder'); }}>
                Make this build yours <span aria-hidden="true">↗</span>
              </button>
            </section>

            <div className="space-y-5">
              <Checks validation={result.validation}/>
              <section className="panel">
                <div className="panel-head"><h2>Budget targets</h2></div>
                <p className="panel-note">What each category was aiming for. Leftover money goes to the highest priority first.</p>
                <div className="target-rows">
                  {result.allocations.map(allocation => <div key={allocation.category}>
                    <span className="target-label">{LABELS[allocation.category]}</span>
                    <span className="split-track" aria-hidden="true"><span style={{ width: allocation.percent + '%' }}/></span>
                    <span className="target-amount cell-num">{pesos(allocation.allocated)}</span>
                  </div>)}
                </div>
              </section>
            </div>
          </div>
        </>}
    </div>}
  </>;
}