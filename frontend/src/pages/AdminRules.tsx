import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { Feedback } from '../components/Feedback';
import { CATEGORIES, LABELS, type BalancePair, type Category, type CheckSetting } from '../types';

interface Rules { checks: CheckSetting[]; pairs: BalancePair[]; }
type CheckDraft = { label: string; message: string; marginPercent: string };
type CheckErrors = Partial<Record<'label' | 'message' | 'marginPercent', string>>;
type PairErrors = Partial<Record<'categoryA' | 'categoryB' | 'maxGap', string>>;

const MARGIN_CODE = 'PSU_WATTAGE_HEADROOM';

export function AdminRules() {
  const rules = useApi<Rules>('/admin/rules');
  const [drafts, setDrafts] = useState<Record<string, CheckDraft>>({});
  const [checkErrors, setCheckErrors] = useState<Record<string, CheckErrors>>({});
  const [checkBusy, setCheckBusy] = useState<string | null>(null);
  const [pairA, setPairA] = useState<Category>('cpu');
  const [pairB, setPairB] = useState<Category>('gpu');
  const [pairGap, setPairGap] = useState('25');
  const [pairErrors, setPairErrors] = useState<PairErrors>({});
  const [editingPair, setEditingPair] = useState<string | null>(null);
  const [pairBusy, setPairBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const submitting = useRef(false);

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
    const errors: CheckErrors = {};
    if (!draft.label.trim() || draft.label.trim().length > 80) errors.label = 'Enter a short name up to 80 characters.';
    if (!draft.message.trim() || draft.message.trim().length > 300) errors.message = 'Enter the customer message, up to 300 characters.';
    if (check.code === MARGIN_CODE) {
      const margin = Number(draft.marginPercent);
      if (!draft.marginPercent.trim() || !Number.isFinite(margin) || margin < 0 || margin > 100) errors.marginPercent = 'Enter a margin from 0 to 100 percent.';
    }
    setCheckErrors(current => ({ ...current, [check.code]: errors }));
    if (Object.keys(errors).length) { setError('Check the highlighted fields.'); return; }

    setCheckBusy(check.code);
    try {
      await api.put('/admin/rules/checks/' + check.code, {
        label: draft.label.trim(), message: draft.message.trim(),
        ...(check.code === MARGIN_CODE ? { marginPercent: Number(draft.marginPercent) } : {})
      });
      setFeedback(draft.label.trim() + ' was updated. Customers see the new wording straight away.');
      rules.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setCheckBusy(null); }
  }

  function resetPairForm() {
    setEditingPair(null); setPairA('cpu'); setPairB('gpu'); setPairGap('25'); setPairErrors({});
  }

  function startPairEdit(pair: BalancePair) {
    setEditingPair(pair._id);
    setPairA(pair.categoryA); setPairB(pair.categoryB); setPairGap(String(pair.maxGap));
    setPairErrors({}); setError(''); setFeedback('');
  }

  async function submitPair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(''); setFeedback('');
    const errors: PairErrors = {};
    if (pairA === pairB) errors.categoryB = 'Compare two different categories.';
    const gap = Number(pairGap);
    if (!pairGap.trim() || !Number.isFinite(gap) || gap < 0 || gap > 100) errors.maxGap = 'Enter a score gap from 0 to 100.';
    setPairErrors(errors);
    if (Object.keys(errors).length) return;

    submitting.current = true; setPairBusy(true);
    try {
      const payload = { categoryA: pairA, categoryB: pairB, maxGap: gap };
      if (editingPair) await api.put('/admin/rules/pairs/' + editingPair, payload);
      else await api.post('/admin/rules/pairs', payload);
      setFeedback(`${LABELS[pairA]} and ${LABELS[pairB]} are now compared with a maximum gap of ${gap}.`);
      resetPairForm();
      rules.retry();
    } catch (failure) {
      setError(errorMessage(failure));
      if (isAxiosError(failure) && failure.response?.data?.fields) {
        setPairErrors(failure.response.data.fields as PairErrors);
      }
    } finally { submitting.current = false; setPairBusy(false); }
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

  return <section className="max-w-4xl mx-auto">
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

        <form className="panel" onSubmit={submitPair}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base">{editingPair ? 'Edit balance check' : 'Add a balance check'}</h3>
            {editingPair && <button type="button" className="button secondary" onClick={resetPairForm} disabled={pairBusy}>Cancel edit</button>}
          </div>
          <div className="grid sm:grid-cols-3 gap-5 mt-5">
            <div>
              <label htmlFor="pair-a">Compare</label>
              <select id="pair-a" value={pairA} disabled={pairBusy} onChange={event => { setPairA(event.target.value as Category); setPairErrors({}); }}>
                {CATEGORIES.map(category => <option key={category} value={category}>{LABELS[category]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pair-b">With</label>
              <select id="pair-b" value={pairB} disabled={pairBusy} onChange={event => { setPairB(event.target.value as Category); setPairErrors({}); }} aria-invalid={Boolean(pairErrors.categoryB)}>
                {CATEGORIES.map(category => <option key={category} value={category}>{LABELS[category]}</option>)}
              </select>
              {pairErrors.categoryB && <p role="alert" className="field-error">{pairErrors.categoryB}</p>}
            </div>
            <div>
              <label htmlFor="pair-gap">Warn above a gap of</label>
              <input id="pair-gap" type="number" min="0" max="100" step="any" value={pairGap} disabled={pairBusy}
                onChange={event => { setPairGap(event.target.value); setPairErrors(current => ({ ...current, maxGap: undefined })); }}
                aria-invalid={Boolean(pairErrors.maxGap)} aria-describedby="gap-help"/>
              {pairErrors.maxGap && <p role="alert" className="field-error">{pairErrors.maxGap}</p>}
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
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="button secondary" onClick={() => startPairEdit(pair)} disabled={pairBusy || rowBusy === pair._id}>Edit</button>
                  <button type="button" className="button secondary" onClick={() => togglePair(pair)} disabled={rowBusy === pair._id}>{pair.active ? 'Turn off' : 'Turn on'}</button>
                  <button type="button" className="button secondary" onClick={() => setConfirmId(pair._id)} disabled={rowBusy === pair._id}>Remove</button>
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