import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { useTableState } from '../hooks/useTableState';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
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

const searchText = (row: Component) => [row.name, row.brand, LABELS[row.category], row.socket, row.memoryType, row.storageType].filter(Boolean).join(' ');
const sortValues = {
  name: (row: Component) => row.name.toLowerCase(),
  category: (row: Component) => LABELS[row.category],
  price: (row: Component) => row.price,
  performanceScore: (row: Component) => row.performanceScore,
  stock: (row: Component) => row.stock ?? -1
};

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
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [confirm, setConfirm] = useState<Component | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [category, setCategory] = useState<'' | Category>('');
  const [state, setState] = useState<'' | 'active' | 'archived'>('');
  const submitting = useRef(false);

  const rows = (catalog.data || []).filter(row =>
    (!category || row.category === category)
    && (!state || (state === 'archived' ? row.archived : !row.archived)));
  const table = useTableState<Component>({ rows, searchText, sortValues, initialSort: { key: 'name', direction: 'asc' } });
  const archivedCount = (catalog.data || []).filter(row => row.archived).length;

  function update<K extends keyof FormValues>(name: K, value: FormValues[K]) {
    setForm(current => ({ ...current, [name]: value }));
    setFields(current => name === 'category' ? {} : { ...current, [name]: undefined });
    setFormError('');
  }

  function openForm(component?: Component) {
    setEditing(component || null);
    setForm(component ? toForm(component) : EMPTY_FORM);
    setFields({}); setFormError(''); setFeedback(''); setError('');
    setFormOpen(true);
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

  async function act(component: Component, run: () => Promise<{ data: { message?: string } }>, fallback: string) {
    setError(''); setFeedback(''); setRowBusy(component._id);
    try {
      const response = await run();
      setFeedback(response.data.message || fallback);
      setConfirm(null);
      catalog.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setRowBusy(null); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFormError('');
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
    if ((form.category === 'cpu' || form.category === 'motherboard') && !SOCKETS.includes(form.socket)) errors.socket = 'Choose a supported socket.';
    if ((form.category === 'motherboard' || form.category === 'memory') && !MEMORY_TYPES.includes(form.memoryType)) errors.memoryType = 'Choose a memory type.';
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
    if (Object.keys(errors).length) { setFormError('Check the highlighted fields before saving.'); return; }

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
      const response = editing
        ? await api.put<Component>('/admin/components/' + editing._id, payload)
        : await api.post<Component>('/admin/components', payload);
      setFeedback((response.data.name || form.name.trim()) + (editing ? ' was updated.' : ' was added to the catalog.'));
      setFormOpen(false); setEditing(null); setForm(EMPTY_FORM); setFields({});
      catalog.retry();
    } catch (failure) {
      setFormError(errorMessage(failure));
      if (isAxiosError(failure) && failure.response?.data?.fields) {
        const responseFields = failure.response.data.fields as Record<string, unknown>;
        setFields(Object.fromEntries(Object.entries(responseFields)
          .filter(([key, value]) => key in EMPTY_FORM && typeof value === 'string')) as FieldErrors);
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  const columns: DataTableColumn<Component>[] = [
    { key: 'name', header: 'Component', sortable: true, render: row => <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium break-words">{row.name}</p>
        {row.archived && <span className="tag">Archived</span>}
      </div>
      <p className="text-xs text-muted mt-1">{row.brand}</p>
    </> },
    { key: 'category', header: 'Category', sortable: true, hideBelow: 'sm', render: row => LABELS[row.category] },
    { key: 'price', header: 'Price', sortable: true, align: 'right', render: row => pesos(row.price) },
    { key: 'performanceScore', header: 'Score', sortable: true, align: 'right', hideBelow: 'lg', render: row => row.performanceScore },
    { key: 'stock', header: 'Availability', sortable: true, hideBelow: 'md', render: row => <>
      <p className="text-xs">{row.availability}</p>
      {row.availability === 'in stock' && <p className="text-xs text-muted">{row.stock} in stock</p>}
    </> },
    { key: 'actions', header: 'Actions', align: 'right', render: row => <div className="flex flex-wrap justify-end gap-2">
      <button type="button" className="button secondary !py-1.5" onClick={() => openForm(row)} disabled={rowBusy === row._id}>Edit</button>
      {row.archived
        ? <button type="button" className="button secondary !py-1.5" disabled={rowBusy === row._id}
            onClick={() => act(row, () => api.patch('/admin/components/' + row._id + '/restore'), 'Component restored.')}>Restore</button>
        : <button type="button" className="button secondary !py-1.5" onClick={() => setConfirm(row)} disabled={rowBusy === row._id}>Archive</button>}
    </div> }
  ];

  return <section>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><span className="eyebrow">ADMINISTRATION</span><h1>Catalog.</h1></div>
      <Link className="button secondary" to="/components">Public catalog <span aria-hidden="true">↗</span></Link>
    </div>
    <p className="intro">Every part the planner can choose from. {catalog.data ? `${catalog.data.length} parts, ${archivedCount} archived.` : ''}</p>

    {error && <p role="alert" className="notice error mb-4">{error}</p>}
    {feedback && <p role="status" className="notice note mb-4">{feedback}</p>}

    <Feedback loading={catalog.loading} error={catalog.error} retry={catalog.retry}/>
    {catalog.data && <DataTable
      table={table} columns={columns} rowKey={row => row._id}
      label="Catalog components" searchPlaceholder="Name, brand or specification"
      empty="The catalog is empty. Add your first component."
      filters={<>
        <label className="w-full sm:w-44"><span className="text-xs">Category</span>
          <select value={category} onChange={event => setCategory(event.target.value as '' | Category)}>
            <option value="">All categories</option>
            {CATEGORIES.map(value => <option key={value} value={value}>{LABELS[value]}</option>)}
          </select></label>
        <label className="w-full sm:w-36"><span className="text-xs">State</span>
          <select value={state} onChange={event => setState(event.target.value as '' | 'active' | 'archived')}>
            <option value="">All</option><option value="active">Active</option><option value="archived">Archived</option>
          </select></label>
      </>}
      toolbar={<button type="button" className="button light" onClick={() => openForm()}>Add component <span aria-hidden="true">＋</span></button>}/>}

    <Drawer open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} wide
      title={editing ? 'Edit ' + editing.name : 'Add a component'}
      description={editing ? 'Changing the category clears the specifications the new one does not use.' : 'All fields are required unless marked optional.'}
      footer={<>
        <button type="submit" form="component-form" className="button light" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add component'}</button>
        <button type="button" className="button secondary" onClick={() => { setFormOpen(false); setEditing(null); }} disabled={busy}>Cancel</button>
      </>}>
      {formError && <p role="alert" className="notice error mb-5">{formError}</p>}
      <form id="component-form" onSubmit={submit} className="grid gap-6">
        <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-4">Details</legend>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field name="category" label="Category" error={fields.category}>
              <select id="component-category" name="category" value={form.category} required
                onChange={event => update('category', event.target.value as Category)}>
                {CATEGORIES.map(value => <option key={value} value={value}>{LABELS[value]}</option>)}
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

        {form.category !== 'gpu' && <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-4">Compatibility specifications</legend>
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

        <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-4">Product image <span className="text-muted font-normal">(optional)</span></legend>
          <div className="grid gap-5">
            <Field name="imageUrl" label="Image URL or local path" error={fields.imageUrl} help="An HTTPS image URL, or an existing /images/components/ path.">{input('imageUrl', 'text', { required: false, maxLength: 2000, help: true })}</Field>
            <Field name="imageSource" label="Image source URL" error={fields.imageSource} help="A link to the manufacturer or original source.">{input('imageSource', 'url', { required: false, maxLength: 2000, help: true })}</Field>
            <Field name="imageCaption" label="Image caption" error={fields.imageCaption}>{input('imageCaption', 'text', { required: false, maxLength: 200 })}</Field>
          </div>
        </fieldset>
      </form>
    </Drawer>

    <Drawer open={Boolean(confirm)} onClose={() => setConfirm(null)} title={'Archive ' + (confirm?.name || '')}
      footer={confirm ? <>
        <button type="button" className="button" disabled={rowBusy === confirm._id}
          onClick={() => act(confirm, () => api.delete('/admin/components/' + confirm._id), 'Component archived.')}>
          {rowBusy === confirm._id ? 'Archiving…' : 'Yes, archive it'}
        </button>
        <button type="button" className="button secondary" onClick={() => setConfirm(null)} disabled={rowBusy === confirm._id}>Cancel</button>
      </> : undefined}>
      <p className="text-sm">It will be removed from the catalog, the planner and recommendations. Saved builds that already include it keep their history, and you can restore it at any time.</p>
    </Drawer>
  </section>;
}