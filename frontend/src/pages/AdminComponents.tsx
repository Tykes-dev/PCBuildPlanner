import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { Feedback } from '../components/Feedback';
import { CATEGORIES, LABELS, pesos, type Category, type Component } from '../types';

const SOCKETS = ['AM4', 'AM5', 'LGA1700', 'LGA1851'];
const MEMORY_TYPES = ['DDR4', 'DDR5'];
const FORM_FACTORS = ['ATX', 'mATX', 'ITX'];
const STORAGE_TYPES = ['NVMe', 'SATA SSD', 'HDD'];
const AVAILABILITY = ['in stock', 'out of stock', 'not tracked'];

interface FormValues {
  name: string; brand: string; category: Category; price: string;
  performanceScore: string; powerDraw: string; stock: string; availability: string;
  imageUrl: string; imageSource: string; imageCaption: string;
  socket: string; memoryType: string; formFactor: string; memorySlots: string;
  capacityGb: string; storageType: string; wattageRating: string; supportedFormFactors: string[];
}
type FieldErrors = Partial<Record<keyof FormValues, string>>;
type InputName = Exclude<keyof FormValues, 'category' | 'supportedFormFactors'>;
const EMPTY_FORM: FormValues = {
  name: '', brand: '', category: 'cpu', price: '', performanceScore: '', powerDraw: '0',
  stock: '0', availability: 'not tracked', imageUrl: '', imageSource: '', imageCaption: '',
  socket: '', memoryType: '', formFactor: '', memorySlots: '', capacityGb: '',
  storageType: '', wattageRating: '', supportedFormFactors: []
};

const text = (value: unknown) => value === undefined || value === null ? '' : String(value);

// Catalog records store numbers; the form holds strings so empty inputs stay empty.
function toForm(component: Component): FormValues {
  return {
    name: component.name, brand: component.brand, category: component.category,
    price: text(component.price), performanceScore: text(component.performanceScore),
    powerDraw: text(component.powerDraw ?? 0), stock: text(component.stock ?? 0),
    availability: component.availability || 'not tracked',
    imageUrl: component.imageUrl || '', imageSource: component.imageSource || '', imageCaption: component.imageCaption || '',
    socket: component.socket || '', memoryType: component.memoryType || '',
    formFactor: component.formFactor || '', memorySlots: text(component.memorySlots),
    capacityGb: text(component.capacityGb), storageType: component.storageType || '',
    wattageRating: text(component.wattageRating), supportedFormFactors: component.supportedFormFactors || []
  };
}

function Field({ name, label, error, help, children }: {
  name: string; label: string; error?: string; help?: string; children: ReactNode;
}) {
  return <div>
    <label htmlFor={'component-' + name}>{label}</label>
    {children}
    {help && <p id={name + '-help'} className="text-xs text-muted mt-2 leading-relaxed">{help}</p>}
    {error && <p id={name + '-error'} className="field-error" role="alert">{error}</p>}
  </div>;
}

export function AdminComponents() {
  const catalog = useApi<Component[]>('/admin/components');
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [listCategory, setListCategory] = useState<'all' | Category>('all');
  const [listSearch, setListSearch] = useState('');
  const submitting = useRef(false);
  const formSection = useRef<HTMLFormElement>(null);

  const term = listSearch.trim().toLowerCase();
  const visible = (catalog.data || []).filter(component =>
    (listCategory === 'all' || component.category === listCategory)
    && (!term || component.name.toLowerCase().includes(term) || component.brand.toLowerCase().includes(term)));
  const archivedCount = (catalog.data || []).filter(component => component.archived).length;

  function update<K extends keyof FormValues>(name: K, value: FormValues[K]) {
    setForm(current => ({ ...current, [name]: value }));
    setFields(current => name === 'category' ? {} : { ...current, [name]: undefined });
    setFeedback('');
  }

  function startEdit(component: Component) {
    setEditingId(component._id);
    setForm(toForm(component));
    setFields({}); setError(''); setFeedback(''); setConfirmId(null);
    formSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFields({}); setError(''); setFeedback('');
  }

  function input(name: InputName, type = 'text', options: {
    min?: number; max?: number; maxLength?: number; step?: string; required?: boolean; help?: boolean;
  } = {}) {
    return <input id={'component-' + name} name={name} type={type} value={form[name]}
      onChange={event => update(name, event.target.value)} disabled={busy}
      required={options.required ?? true} min={options.min} max={options.max}
      maxLength={options.maxLength} step={options.step}
      aria-invalid={Boolean(fields[name])}
      aria-describedby={[options.help && name + '-help', fields[name] && name + '-error'].filter(Boolean).join(' ') || undefined}/>;
  }

  function select(name: 'socket' | 'memoryType' | 'formFactor' | 'storageType' | 'availability', values: string[]) {
    return <select id={'component-' + name} name={name} value={form[name]} required disabled={busy}
      onChange={event => update(name, event.target.value)} aria-invalid={Boolean(fields[name])}
      aria-describedby={fields[name] ? name + '-error' : undefined}>
      <option value="" disabled>Select an option</option>
      {values.map(value => <option key={value} value={value}>{value}</option>)}
    </select>;
  }

  async function archive(component: Component) {
    setError(''); setFeedback(''); setRowBusyId(component._id);
    try {
      const response = await api.delete<{ message: string }>('/admin/components/' + component._id);
      setFeedback(response.data.message);
      setConfirmId(null);
      if (editingId === component._id) cancelEdit();
      catalog.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setRowBusyId(null); }
  }

  async function restore(component: Component) {
    setError(''); setFeedback(''); setRowBusyId(component._id);
    try {
      const response = await api.patch<{ message: string }>('/admin/components/' + component._id + '/restore');
      setFeedback(response.data.message);
      catalog.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setRowBusyId(null); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(''); setFeedback('');
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = 'Enter a component name.';
    if (!form.brand.trim()) errors.brand = 'Enter a brand.';
    const numeric = (name: 'price' | 'performanceScore' | 'powerDraw' | 'stock' | 'memorySlots' | 'capacityGb' | 'wattageRating', minimum: number, maximum?: number, whole = false) => {
      const value = Number(form[name]);
      if (!form[name].trim() || !Number.isFinite(value) || value < minimum || (maximum !== undefined && value > maximum) || (whole && !Number.isSafeInteger(value))) {
        errors[name] = 'Enter ' + (whole ? 'a whole number' : 'a number') + (maximum !== undefined ? ' from ' + minimum + ' to ' + maximum : ' of at least ' + minimum) + '.';
      }
    };
    numeric('price', 0); numeric('performanceScore', 0, 100); numeric('powerDraw', 0); numeric('stock', 0, undefined, true);
    if (!AVAILABILITY.includes(form.availability)) errors.availability = 'Choose an availability status.';
    if (form.category === 'cpu' || form.category === 'motherboard') {
      if (!SOCKETS.includes(form.socket)) errors.socket = 'Choose a supported socket.';
    }
    if (form.category === 'motherboard' || form.category === 'memory') {
      if (!MEMORY_TYPES.includes(form.memoryType)) errors.memoryType = 'Choose a memory type.';
    }
    if (form.category === 'motherboard') {
      if (!FORM_FACTORS.includes(form.formFactor)) errors.formFactor = 'Choose a motherboard size.';
      numeric('memorySlots', 1, undefined, true);
    }
    if (form.category === 'memory' || form.category === 'storage') numeric('capacityGb', 1);
    if (form.category === 'storage' && !STORAGE_TYPES.includes(form.storageType)) errors.storageType = 'Choose a storage type.';
    if (form.category === 'psu') numeric('wattageRating', 1);
    if (form.category === 'case' && !form.supportedFormFactors.length) errors.supportedFormFactors = 'Choose at least one supported motherboard size.';
    const imageUrl = form.imageUrl.trim();
    const validHttpsUrl = (value: string) => {
      try { const url = new URL(value); return value.startsWith('https://') && url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; }
      catch { return false; }
    };
    if (imageUrl) {
      const localImage = imageUrl.startsWith('/images/components/') && imageUrl.length > '/images/components/'.length
        && !/[\\\s]/.test(imageUrl) && !imageUrl.split(/[/?#]/).includes('..');
      if (!localImage && !validHttpsUrl(imageUrl)) errors.imageUrl = 'Use an HTTPS image URL or a valid /images/components/ path.';
    }
    if (form.imageSource.trim() && !validHttpsUrl(form.imageSource.trim())) errors.imageSource = 'Use a valid HTTPS source URL.';
    setFields(errors);
    if (Object.keys(errors).length) { setError('Check the highlighted fields before saving the component.'); return; }

    const payload: Record<string, unknown> = {
      name: form.name.trim(), brand: form.brand.trim(), category: form.category,
      price: Number(form.price), performanceScore: Number(form.performanceScore),
      powerDraw: Number(form.powerDraw), stock: Number(form.stock), availability: form.availability,
      imageUrl, imageSource: form.imageSource.trim(), imageCaption: form.imageCaption.trim()
    };
    if (form.category === 'cpu' || form.category === 'motherboard') payload.socket = form.socket;
    if (form.category === 'memory' || form.category === 'motherboard') payload.memoryType = form.memoryType;
    if (form.category === 'motherboard') { payload.formFactor = form.formFactor; payload.memorySlots = Number(form.memorySlots); }
    if (form.category === 'memory' || form.category === 'storage') payload.capacityGb = Number(form.capacityGb);
    if (form.category === 'storage') payload.storageType = form.storageType;
    if (form.category === 'case') payload.supportedFormFactors = form.supportedFormFactors;
    if (form.category === 'psu') payload.wattageRating = Number(form.wattageRating);

    submitting.current = true; setBusy(true);
    try {
      const response = editingId
        ? await api.put<Component>('/admin/components/' + editingId, payload)
        : await api.post<Component>('/admin/components', payload);
      const savedName = response.data.name || form.name.trim();
      setFeedback(editingId ? savedName + ' was updated.' : savedName + ' was added to the catalog.');
      setEditingId(null);
      setForm({ ...EMPTY_FORM, category: form.category });
      setFields({});
      catalog.retry();
    } catch (failure) {
      setError(errorMessage(failure));
      if (isAxiosError(failure) && failure.response?.data?.fields) {
        const responseFields = failure.response.data.fields as Record<string, unknown>;
        setFields(Object.fromEntries(Object.entries(responseFields)
          .filter(([key, value]) => key in EMPTY_FORM && typeof value === 'string')) as FieldErrors);
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section className="max-w-4xl mx-auto">
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><span className="eyebrow">ADMINISTRATION</span><h1>Manage the catalog.</h1>
        <p className="intro !mb-0">Add parts, correct their details, and archive the ones you no longer sell.</p></div>
      <Link className="button secondary" to="/components">View public catalog <span aria-hidden="true">↗</span></Link>
    </div>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {feedback && <p role="status" className="notice note mb-5">{feedback}</p>}

    <form ref={formSection} className="grid gap-6" onSubmit={submit}>
      <fieldset disabled={busy} className="panel min-w-0">
        <legend className="sr-only">Component details</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>{editingId ? 'Edit component' : 'Component details'}</h2>
          {editingId && <button type="button" className="button secondary" onClick={cancelEdit} disabled={busy}>Cancel edit</button>}
        </div>
        <p className="text-sm text-muted mt-2 mb-5">All fields in this section are required.</p>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field name="category" label="Category" error={fields.category}>
            <select id="component-category" name="category" value={form.category} onChange={event => update('category', event.target.value as Category)} required>
              {CATEGORIES.map(category => <option key={category} value={category}>{LABELS[category]}</option>)}
            </select>
          </Field>
          <Field name="brand" label="Brand" error={fields.brand}>{input('brand', 'text', { maxLength: 120 })}</Field>
          <div className="sm:col-span-2"><Field name="name" label="Component name" error={fields.name}>{input('name', 'text', { maxLength: 120 })}</Field></div>
          <Field name="price" label="Price (PHP)" error={fields.price}>{input('price', 'number', { min: 0, step: '0.01' })}</Field>
          <Field name="performanceScore" label="Performance score (0–100)" error={fields.performanceScore}>{input('performanceScore', 'number', { min: 0, max: 100, step: 'any' })}</Field>
          <Field name="powerDraw" label="Power draw (watts)" error={fields.powerDraw}>{input('powerDraw', 'number', { min: 0, step: 'any' })}</Field>
          <Field name="availability" label="Availability" error={fields.availability}>{select('availability', AVAILABILITY)}</Field>
          <Field name="stock" label="Stock quantity" error={fields.stock}>{input('stock', 'number', { min: 0, step: '1' })}</Field>
        </div>
      </fieldset>

      {form.category !== 'gpu' && <fieldset disabled={busy} className="panel min-w-0">
        <legend className="sr-only">Compatibility specifications</legend>
        <h2>Compatibility specifications</h2>
        <p className="text-sm text-muted mt-2 mb-5">These details help the planner match compatible parts.</p>
        <div className="grid sm:grid-cols-2 gap-5">
          {(form.category === 'cpu' || form.category === 'motherboard') && <Field name="socket" label="CPU socket" error={fields.socket}>{select('socket', SOCKETS)}</Field>}
          {(form.category === 'memory' || form.category === 'motherboard') && <Field name="memoryType" label="Memory type" error={fields.memoryType}>{select('memoryType', MEMORY_TYPES)}</Field>}
          {form.category === 'motherboard' && <>
            <Field name="formFactor" label="Motherboard size" error={fields.formFactor}>{select('formFactor', FORM_FACTORS)}</Field>
            <Field name="memorySlots" label="Memory slots" error={fields.memorySlots}>{input('memorySlots', 'number', { min: 1, step: '1' })}</Field>
          </>}
          {(form.category === 'memory' || form.category === 'storage') && <Field name="capacityGb" label="Capacity (GB)" error={fields.capacityGb}>{input('capacityGb', 'number', { min: 1, step: 'any' })}</Field>}
          {form.category === 'storage' && <Field name="storageType" label="Storage type" error={fields.storageType}>{select('storageType', STORAGE_TYPES)}</Field>}
          {form.category === 'psu' && <Field name="wattageRating" label="Power supply rating (watts)" error={fields.wattageRating}>{input('wattageRating', 'number', { min: 1, step: 'any' })}</Field>}
          {form.category === 'case' && <div className="sm:col-span-2">
            <fieldset aria-describedby={fields.supportedFormFactors ? 'supportedFormFactors-error' : undefined}>
              <legend className="text-sm font-medium">Supported motherboard sizes</legend>
              <div className="flex flex-wrap gap-3 mt-3">{FORM_FACTORS.map(size => <label key={size} className="flex items-center gap-3 rounded-lg border border-stroke px-4 py-3 bg-control">
                <input className="!w-4 !h-4 !m-0" type="checkbox" value={size} checked={form.supportedFormFactors.includes(size)}
                  onChange={event => update('supportedFormFactors', event.target.checked ? [...form.supportedFormFactors, size] : form.supportedFormFactors.filter(item => item !== size))}/>
                {size}
              </label>)}</div>
              {fields.supportedFormFactors && <p id="supportedFormFactors-error" role="alert" className="field-error">{fields.supportedFormFactors}</p>}
            </fieldset>
          </div>}
        </div>
      </fieldset>}

      <fieldset disabled={busy} className="panel min-w-0">
        <legend className="sr-only">Optional product image</legend>
        <h2>Product image <span className="text-sm text-muted font-normal">(optional)</span></h2>
        <div className="grid gap-5 mt-5">
          <Field name="imageUrl" label="Image URL or local path" error={fields.imageUrl} help="Use an HTTPS image URL or an existing /images/components/ path.">{input('imageUrl', 'text', { required: false, maxLength: 2000, help: true })}</Field>
          <Field name="imageSource" label="Image source URL" error={fields.imageSource} help="An HTTPS link to the manufacturer or original image source.">{input('imageSource', 'url', { required: false, maxLength: 2000, help: true })}</Field>
          <Field name="imageCaption" label="Image caption" error={fields.imageCaption}>{input('imageCaption', 'text', { required: false, maxLength: 200 })}</Field>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-4 items-center">
        <button type="submit" className="button light w-full sm:w-auto" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add component'}<span aria-hidden="true">{editingId ? '✓' : '＋'}</span></button>
        {busy && <p role="status" className="text-sm text-muted">Saving to the catalog…</p>}
      </div>
    </form>

    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div><h2>Catalog parts</h2>
          <p className="text-sm text-muted mt-2">{catalog.data ? catalog.data.length + ' parts, ' + archivedCount + ' archived' : 'Loading the catalog…'}</p></div>
        <div className="flex flex-wrap gap-3">
          <label className="w-full sm:w-44">Category<select value={listCategory} onChange={event => setListCategory(event.target.value as 'all' | Category)}>
            <option value="all">All categories</option>
            {CATEGORIES.map(category => <option key={category} value={category}>{LABELS[category]}</option>)}
          </select></label>
          <label className="w-full sm:w-56">Search<input type="search" placeholder="Name or brand" value={listSearch} onChange={event => setListSearch(event.target.value)}/></label>
        </div>
      </div>
      <Feedback loading={catalog.loading} error={catalog.error} retry={catalog.retry}/>
      {catalog.data && (!visible.length
        ? <p className="notice note">{catalog.data.length ? 'No parts match this filter. Try another category or search.' : 'The catalog is empty. Add your first component with the form above.'}</p>
        : <ul className="space-y-3">
          {visible.map(component => <li className="panel" key={component._id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base break-words">{component.name}</h3>
                  {component.archived && <span className="tag">Archived</span>}
                </div>
                <p className="text-sm text-muted mt-2">{component.brand} · {LABELS[component.category]} · {pesos(component.price)} · {component.availability}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="button secondary" onClick={() => startEdit(component)} disabled={busy || rowBusyId === component._id}>Edit</button>
                {component.archived
                  ? <button type="button" className="button secondary" onClick={() => restore(component)} disabled={rowBusyId === component._id}>{rowBusyId === component._id ? 'Restoring…' : 'Restore'}</button>
                  : <button type="button" className="button secondary" onClick={() => setConfirmId(component._id)} disabled={rowBusyId === component._id}>Archive</button>}
              </div>
            </div>
            {confirmId === component._id && <div className="notice warning mt-4" role="alertdialog" aria-label={'Confirm archiving ' + component.name}>
              <p className="text-sm">Archive <strong>{component.name}</strong>? It will be removed from the catalog, the planner and recommendations. Saved builds that already include it keep their history, and you can restore it later.</p>
              <div className="flex flex-wrap gap-3 mt-4">
                <button type="button" className="button" onClick={() => archive(component)} disabled={rowBusyId === component._id}>{rowBusyId === component._id ? 'Archiving…' : 'Yes, archive it'}</button>
                <button type="button" className="button secondary" onClick={() => setConfirmId(null)} disabled={rowBusyId === component._id}>Cancel</button>
              </div>
            </div>}
          </li>)}
        </ul>)}
    </section>
  </section>;
}