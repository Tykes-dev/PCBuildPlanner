import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { Feedback } from '../components/Feedback';
import { IconButton } from '../components/Icon';
import {
  MARGIN_CODE, checkSchema, pairSchema, toCheckPayload, toPairPayload,
  type CheckFormValues, type PairFormValues
} from '../schemas/rules';
import { CATEGORIES, LABELS, type BalancePair, type Category, type CheckSetting } from '../types';

interface Rules { checks: CheckSetting[]; pairs: BalancePair[]; }
type CheckDraft = Omit<CheckFormValues, 'code'>;
type CheckErrors = Partial<Record<'label' | 'message' | 'marginPercent', string>>;

export function AdminRules() {
  const rules = useApi<Rules>('/admin/rules');
  const [drafts, setDrafts] = useState<Record<string, CheckDraft>>({});
  const [checkErrors, setCheckErrors] = useState<Record<string, CheckErrors>>({});
  const [checkBusy, setCheckBusy] = useState<string | null>(null);
  const [editingPair, setEditingPair] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const { register: pairField, handleSubmit: handlePair, reset: resetPair, watch: watchPair,
    setError: setPairError, formState: { errors: pairErrors, isSubmitting: pairBusy } } =
    useForm<PairFormValues>({
      resolver: zodResolver(pairSchema),
      defaultValues: { categoryA: 'cpu', categoryB: 'gpu', maxGap: '25' }
    });
  const pairA = watchPair('categoryA') as Category;
  const pairB = watchPair('categoryB') as Category;

  // The saved values seed the editable drafts once, after the first load.
  useEffect(() => {
    if (!rules.data) return;
    setDrafts(Object.fromEntries(rules.data.checks.map(check => [check.code, {
      label: check.label, message: check.message,
      marginPercent: check.marginPercent === undefined ? '' : String(check.marginPercent)
    }])));
  }, [rules.data]);

  function setDraft(code: string, key: keyof CheckDraft, value: string) {
    setDrafts(current => ({ ...current, [code]: { ...current[code], [key]: value } }));
    setCheckErrors(current => ({ ...current, [code]: { ...current[code], [key]: undefined } }));
    setFeedback('');
  }

  async function saveCheck(check: CheckSetting) {
    const draft = drafts[check.code];
    if (!draft) return;
    setError(''); setFeedback('');
    const parsed = checkSchema.safeParse({ ...draft, code: check.code });
    if (!parsed.success) {
      const errors: CheckErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof CheckErrors;
        if (!errors[key]) errors[key] = issue.message;
      }
      setCheckErrors(current => ({ ...current, [check.code]: errors }));
      setError('Check the highlighted fields.');
      return;
    }
    setCheckErrors(current => ({ ...current, [check.code]: {} }));

    setCheckBusy(check.code);
    try {
      await api.put('/admin/rules/checks/' + check.code, toCheckPayload(parsed.data));
      setFeedback(parsed.data.label + ' was updated. Customers see the new wording straight away.');
      rules.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setCheckBusy(null); }
  }

  function resetPairForm() {
    setEditingPair(null);
    resetPair({ categoryA: 'cpu', categoryB: 'gpu', maxGap: '25' });
  }

  function startPairEdit(pair: BalancePair) {
    setEditingPair(pair._id);
    resetPair({ categoryA: pair.categoryA, categoryB: pair.categoryB, maxGap: String(pair.maxGap) });
    setError(''); setFeedback('');
  }

  async function submitPair(values: PairFormValues) {
    setError(''); setFeedback('');
    try {
      const payload = toPairPayload(values);
      if (editingPair) await api.put('/admin/rules/pairs/' + editingPair, payload);
      else await api.post('/admin/rules/pairs', payload);
      setFeedback(`${LABELS[values.categoryA as Category]} and ${LABELS[values.categoryB as Category]} are now compared with a maximum gap of ${payload.maxGap}.`);
      resetPairForm();
      rules.retry();
    } catch (failure) {
      setError(errorMessage(failure));
      if (isAxiosError(failure) && failure.response?.data?.fields) {
        for (const [key, message] of Object.entries(failure.response.data.fields as Record<string, unknown>)) {
          if (['categoryA', 'categoryB', 'maxGap'].includes(key) && typeof message === 'string') {
            setPairError(key as keyof PairFormValues, { message });
          }
        }
      }
    }
  }

  async function togglePair(pair: BalancePair) {
    setError(''); setFeedback(''); setRowBusy(pair._id);
    try {
      await api.put('/admin/rules/pairs/' + pair._id, { categoryA: pair.categoryA, categoryB: pair.categoryB, maxGap: pair.maxGap, active: !pair.active });
      setFeedback(`${LABELS[pair.categoryA]} and ${LABELS[pair.categoryB]} ${pair.active ? 'is no longer checked' : 'is checked again'}.`);
      rules.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setRowBusy(null); }
  }

  async function removePair(pair: BalancePair) {
    setError(''); setFeedback(''); setRowBusy(pair._id);
    try {
      const response = await api.delete<{ message: string }>('/admin/rules/pairs/' + pair._id);
      setFeedback(response.data.message);
      setConfirmId(null);
      if (editingPair === pair._id) resetPairForm();
      rules.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setRowBusy(null); }
  }

  return <section>
    <div className="mb-6">
      <span className="eyebrow">ADMINISTRATION</span><h1>Compatibility rules.</h1>
      <p className="intro !mb-0">Reword the checks customers see, set the power safety margin, and decide which parts are compared for balance.</p>
    </div>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {feedback && <p role="status" className="notice note mb-5">{feedback}</p>}
    <Feedback loading={rules.loading} error={rules.error} retry={rules.retry}/>

    {rules.data && <>
      <section>
        <h2>Compatibility checks</h2>
        <p className="text-sm text-muted mt-2 mb-5">These five checks always run and cannot be switched off, because a build that fails one cannot physically be assembled. You can change the wording a customer reads.</p>
        <div className="space-y-4">
          {rules.data.checks.map(check => {
            const draft = drafts[check.code];
            const errors = checkErrors[check.code] || {};
            if (!draft) return null;
            return <div className="panel" key={check.code}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base">{check.label}</h3>
                <span className="tag">Always on</span>
              </div>
              <div className="grid gap-5 mt-5">
                <div>
                  <label htmlFor={'label-' + check.code}>Short name</label>
                  <input id={'label-' + check.code} value={draft.label} maxLength={80} disabled={checkBusy === check.code}
                    onChange={event => setDraft(check.code, 'label', event.target.value)} aria-invalid={Boolean(errors.label)}/>
                  {errors.label && <p role="alert" className="field-error">{errors.label}</p>}
                </div>
                <div>
                  <label htmlFor={'message-' + check.code}>Message shown to the customer</label>
                  <input id={'message-' + check.code} value={draft.message} maxLength={300} disabled={checkBusy === check.code}
                    onChange={event => setDraft(check.code, 'message', event.target.value)} aria-invalid={Boolean(errors.message)}/>
                  {errors.message && <p role="alert" className="field-error">{errors.message}</p>}
                </div>
                {check.code === MARGIN_CODE && <div className="sm:max-w-[16rem]">
                  <label htmlFor="margin">Safety margin (%)</label>
                  <input id="margin" type="number" min="0" max="100" step="any" value={draft.marginPercent} disabled={checkBusy === check.code}
                    onChange={event => setDraft(check.code, 'marginPercent', event.target.value)} aria-invalid={Boolean(errors.marginPercent)} aria-describedby="margin-help"/>
                  <p id="margin-help" className="text-xs text-muted mt-2">A build drawing 300W with a 30% margin needs a 390W supply.</p>
                  {errors.marginPercent && <p role="alert" className="field-error">{errors.marginPercent}</p>}
                </div>}
              </div>
              <button type="button" className="button secondary mt-5" onClick={() => saveCheck(check)} disabled={checkBusy === check.code}>
                {checkBusy === check.code ? 'Saving…' : 'Save this check'}
              </button>
            </div>;
          })}
        </div>
        <p className="text-xs text-muted mt-4">The memory slot check is built into the planner and has no stored wording.</p>
      </section>

      <section className="mt-12">
        <h2>Balance checks</h2>
        <p className="text-sm text-muted mt-2 mb-5">A balance check compares two parts' performance scores and warns the customer when one is far stronger than the other. These are warnings, so a build can still be saved and submitted.</p>

        <form className="panel" noValidate onSubmit={handlePair(submitPair)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base">{editingPair ? 'Edit balance check' : 'Add a balance check'}</h3>
            {editingPair && <button type="button" className="button secondary" onClick={resetPairForm} disabled={pairBusy}>Cancel edit</button>}
          </div>
          <div className="grid sm:grid-cols-3 gap-5 mt-5">
            <div>
              <label htmlFor="pair-a">Compare</label>
              <select id="pair-a" {...pairField('categoryA')} disabled={pairBusy}>
                {CATEGORIES.map(category => <option key={category} value={category}>{LABELS[category]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pair-b">With</label>
              <select id="pair-b" {...pairField('categoryB')} disabled={pairBusy} aria-invalid={Boolean(pairErrors.categoryB)}>
                {CATEGORIES.map(category => <option key={category} value={category}>{LABELS[category]}</option>)}
              </select>
              {pairErrors.categoryB && <p role="alert" className="field-error">{pairErrors.categoryB.message}</p>}
            </div>
            <div>
              <label htmlFor="pair-gap">Warn above a gap of</label>
              <input id="pair-gap" type="number" min="0" max="100" step="any" {...pairField('maxGap')} disabled={pairBusy}
                aria-invalid={Boolean(pairErrors.maxGap)} aria-describedby="gap-help"/>
              {pairErrors.maxGap && <p role="alert" className="field-error">{pairErrors.maxGap.message}</p>}
            </div>
          </div>
          <p id="gap-help" className="text-xs text-muted mt-3">Scores run from 0 to 100. A smaller gap means the warning appears more often.</p>
          <button type="submit" className="button light mt-5" disabled={pairBusy}>{pairBusy ? 'Saving…' : editingPair ? 'Save changes' : 'Add balance check'}</button>
        </form>

        <div className="mt-5 space-y-3">
          {!rules.data.pairs.length
            ? <p className="notice note">No balance checks yet. Customers will not be warned about mismatched parts until you add one.</p>
            : rules.data.pairs.map(pair => <div className="panel" key={pair._id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base">{LABELS[pair.categoryA]} and {LABELS[pair.categoryB]}</h3>
                    {!pair.active && <span className="tag">Off</span>}
                  </div>
                  <p className="text-sm text-muted mt-2">Warns when the two scores differ by more than {pair.maxGap}.</p>
                </div>
                <div className="row-actions">
                  <IconButton icon="edit" label="Edit this balance check"
                    onClick={() => startPairEdit(pair)} disabled={pairBusy || rowBusy === pair._id}/>
                  <IconButton icon="power" label={pair.active ? 'Turn this balance check off' : 'Turn this balance check on'}
                    onClick={() => togglePair(pair)} busy={rowBusy === pair._id}/>
                  <IconButton icon="remove" tone="danger" label="Remove this balance check"
                    onClick={() => setConfirmId(pair._id)} disabled={rowBusy === pair._id}/>
                </div>
              </div>
              {confirmId === pair._id && <div className="notice warning mt-4" role="alertdialog" aria-label="Confirm removing this balance check">
                <p className="text-sm">Remove the {LABELS[pair.categoryA]} and {LABELS[pair.categoryB]} check? Builds will no longer be warned about this combination. Turning it off instead keeps the setting for later.</p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button type="button" className="button" onClick={() => removePair(pair)} disabled={rowBusy === pair._id}>{rowBusy === pair._id ? 'Removing…' : 'Yes, remove it'}</button>
                  <button type="button" className="button secondary" onClick={() => setConfirmId(null)} disabled={rowBusy === pair._id}>Cancel</button>
                </div>
              </div>}
            </div>)}
        </div>
      </section>
    </>}
  </section>;
}