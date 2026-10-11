import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { useTableState } from '../hooks/useTableState';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { Feedback } from '../components/Feedback';
import { IconButton } from '../components/Icon';
import {
  AVAILABILITY, EMPTY_COMPONENT, FORM_FACTORS, MEMORY_TYPES, SOCKETS, STORAGE_TYPES,
  componentSchema, toComponentPayload, type ComponentFormValues
} from '../schemas/component';
import { CATEGORIES, LABELS, pesos, type Category, type Component } from '../types';

type InputName = Exclude<keyof ComponentFormValues, 'category' | 'supportedFormFactors'>;

const text = (value: unknown) => value === undefined || value === null ? '' : String(value);

function toForm(component: Component): ComponentFormValues {
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
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [confirm, setConfirm] = useState<Component | null>(null);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [category, setCategory] = useState<'' | Category>('');
  const [state, setState] = useState<'' | 'active' | 'archived'>('');

  // The rules live in schemas/component.ts because they depend on the chosen
  // category, and the server checks the same thing again on arrival.
  const { register, handleSubmit, reset, watch, setValue, setError, clearErrors,
    formState: { errors, isSubmitting } } = useForm<ComponentFormValues>({
      resolver: zodResolver(componentSchema), defaultValues: EMPTY_COMPONENT
    });
  const busy = isSubmitting;
  const chosen = watch('category') as Category;
  const supported = watch('supportedFormFactors');

  const rows = (catalog.data || []).filter(row =>
    (!category || row.category === category)
    && (!state || (state === 'archived' ? row.archived : !row.archived)));
  const table = useTableState<Component>({ rows, searchText, sortValues, initialSort: { key: 'name', direction: 'asc' } });
  const archivedCount = (catalog.data || []).filter(row => row.archived).length;

  function openForm(component?: Component) {
    setEditing(component || null);
    reset(component ? toForm(component) : EMPTY_COMPONENT);
    setFormError(''); setFeedback(''); setPageError('');
    setFormOpen(true);
  }

  function input(name: InputName, type = 'text', options: {
    min?: number; max?: number; maxLength?: number; step?: string; required?: boolean; help?: boolean;
  } = {}) {
    return <input id={'component-' + name} type={type} {...register(name)} disabled={busy}
      required={options.required ?? true} min={options.min} max={options.max}
      maxLength={options.maxLength} step={options.step}
      aria-invalid={Boolean(errors[name])}
      aria-describedby={[options.help && name + '-help', errors[name] && name + '-error'].filter(Boolean).join(' ') || undefined}/>;
  }

  function select(name: 'socket' | 'memoryType' | 'formFactor' | 'storageType' | 'availability', values: string[]) {
    return <select id={'component-' + name} {...register(name)} required disabled={busy}
      aria-invalid={Boolean(errors[name])}
      aria-describedby={errors[name] ? name + '-error' : undefined}>
      <option value="" disabled>Select an option</option>
      {values.map(value => <option key={value} value={value}>{value}</option>)}
    </select>;
  }

  async function act(component: Component, run: () => Promise<{ data: { message?: string } }>, fallback: string) {
    setPageError(''); setFeedback(''); setRowBusy(component._id);
    try {
      const response = await run();
      setFeedback(response.data.message || fallback);
      setConfirm(null);
      catalog.retry();
    } catch (failure) { setPageError(errorMessage(failure)); }
    finally { setRowBusy(null); }
  }

  async function onSubmit(values: ComponentFormValues) {
    setFormError('');
    try {
      const response = editing
        ? await api.put<Component>('/admin/components/' + editing._id, toComponentPayload(values))
        : await api.post<Component>('/admin/components', toComponentPayload(values));
      setFeedback((response.data.name || values.name) + (editing ? ' was updated.' : ' was added to the catalog.'));
      setFormOpen(false); setEditing(null); reset(EMPTY_COMPONENT);
      catalog.retry();
    } catch (failure) {
      setFormError(errorMessage(failure));
      // The server checks the same rules and answers with a `fields` object on
      // a duplicate name or a value it rejects, so those land on the input too.
      if (isAxiosError(failure) && failure.response?.data?.fields) {
        for (const [key, message] of Object.entries(failure.response.data.fields as Record<string, unknown>)) {
          if (key in EMPTY_COMPONENT && typeof message === 'string') {
            setError(key as keyof ComponentFormValues, { message });
          }
        }
      }
    }
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
    { key: 'price', header: 'Price', sortable: true, align: 'right', numeric: true, render: row => pesos(row.price) },
    { key: 'performanceScore', header: 'Score', sortable: true, align: 'right', numeric: true, hideBelow: 'lg', render: row => row.performanceScore },
    { key: 'stock', header: 'Availability', sortable: true, hideBelow: 'md', render: row => <>
      <p className="text-xs">{row.availability}</p>
      {row.availability === 'in stock' && <p className="text-xs text-muted">{row.stock} in stock</p>}
    </> },
    { key: 'actions', header: 'Actions', align: 'right', render: row => <div className="row-actions">
      <IconButton icon="edit" label={'Edit ' + row.name} onClick={() => openForm(row)} disabled={rowBusy === row._id}/>
      {row.archived
        ? <IconButton icon="restore" label={'Restore ' + row.name} busy={rowBusy === row._id}
            onClick={() => act(row, () => api.patch('/admin/components/' + row._id + '/restore'), 'Component restored.')}/>
        : <IconButton icon="archive" tone="danger" label={'Archive ' + row.name}
            onClick={() => setConfirm(row)} disabled={rowBusy === row._id}/>}
    </div> }
  ];

  return <section>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><span className="eyebrow">ADMINISTRATION</span><h1>Catalog.</h1></div>
      <Link className="button secondary" to="/components">Public catalog <span aria-hidden="true">↗</span></Link>
    </div>
    <p className="intro">Every part the planner can choose from. {catalog.data ? `${catalog.data.length} parts, ${archivedCount} archived.` : ''}</p>

    {pageError && <p role="alert" className="notice error mb-4">{pageError}</p>}
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
      <form id="component-form" noValidate className="grid gap-6"
        onSubmit={handleSubmit(onSubmit, () => setFormError('Check the highlighted fields before saving.'))}>
        <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-4">Details</legend>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field name="category" label="Category" error={errors.category?.message}>
              {/* Changing the category changes which specifications apply, so
                  the old errors no longer describe the form. */}
              <select id="component-category" required disabled={busy}
                {...register('category', { onChange: () => { clearErrors(); setFormError(''); } })}>
                {CATEGORIES.map(value => <option key={value} value={value}>{LABELS[value]}</option>)}
              </select>
            </Field>
            <Field name="brand" label="Brand" error={errors.brand?.message}>{input('brand', 'text', { maxLength: 120 })}</Field>
            <div className="sm:col-span-2"><Field name="name" label="Component name" error={errors.name?.message}>{input('name', 'text', { maxLength: 120 })}</Field></div>
            <Field name="price" label="Price (PHP)" error={errors.price?.message}>{input('price', 'number', { min: 0, step: '0.01' })}</Field>
            <Field name="performanceScore" label="Performance score (0–100)" error={errors.performanceScore?.message}>{input('performanceScore', 'number', { min: 0, max: 100, step: 'any' })}</Field>
            <Field name="powerDraw" label="Power draw (watts)" error={errors.powerDraw?.message}>{input('powerDraw', 'number', { min: 0, step: 'any' })}</Field>
            <Field name="availability" label="Availability" error={errors.availability?.message}>{select('availability', AVAILABILITY)}</Field>
            <Field name="stock" label="Stock quantity" error={errors.stock?.message}>{input('stock', 'number', { min: 0, step: '1' })}</Field>
          </div>
        </fieldset>

        {chosen !== 'gpu' && <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-4">Compatibility specifications</legend>
          <div className="grid sm:grid-cols-2 gap-5">
            {(chosen === 'cpu' || chosen === 'motherboard') && <Field name="socket" label="CPU socket" error={errors.socket?.message}>{select('socket', SOCKETS)}</Field>}
            {(chosen === 'memory' || chosen === 'motherboard') && <Field name="memoryType" label="Memory type" error={errors.memoryType?.message}>{select('memoryType', MEMORY_TYPES)}</Field>}
            {chosen === 'motherboard' && <>
              <Field name="formFactor" label="Motherboard size" error={errors.formFactor?.message}>{select('formFactor', FORM_FACTORS)}</Field>
              <Field name="memorySlots" label="Memory slots" error={errors.memorySlots?.message}>{input('memorySlots', 'number', { min: 1, step: '1' })}</Field>
            </>}
            {(chosen === 'memory' || chosen === 'storage') && <Field name="capacityGb" label="Capacity (GB)" error={errors.capacityGb?.message}>{input('capacityGb', 'number', { min: 1, step: 'any' })}</Field>}
            {chosen === 'storage' && <Field name="storageType" label="Storage type" error={errors.storageType?.message}>{select('storageType', STORAGE_TYPES)}</Field>}
            {chosen === 'psu' && <Field name="wattageRating" label="Power supply rating (watts)" error={errors.wattageRating?.message}>{input('wattageRating', 'number', { min: 1, step: 'any' })}</Field>}
            {chosen === 'case' && <div className="sm:col-span-2">
              <fieldset aria-describedby={errors.supportedFormFactors ? 'supportedFormFactors-error' : undefined}>
                <legend className="text-sm font-medium">Supported motherboard sizes</legend>
                <div className="flex flex-wrap gap-3 mt-3">{FORM_FACTORS.map(size => <label key={size} className="flex items-center gap-3 rounded-lg border border-stroke px-4 py-3 bg-control">
                  <input className="!w-4 !h-4 !m-0" type="checkbox" value={size} checked={supported.includes(size)}
                    onChange={event => {
                      setValue('supportedFormFactors', event.target.checked
                        ? [...supported, size] : supported.filter(item => item !== size));
                      clearErrors('supportedFormFactors');
                    }}/>
                  {size}
                </label>)}</div>
                {errors.supportedFormFactors && <p id="supportedFormFactors-error" role="alert" className="field-error">{errors.supportedFormFactors.message}</p>}
              </fieldset>
            </div>}
          </div>
        </fieldset>}

        <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-semibold mb-4">Product image <span className="text-muted font-normal">(optional)</span></legend>
          <div className="grid gap-5">
            <Field name="imageUrl" label="Image URL or local path" error={errors.imageUrl?.message} help="An HTTPS image URL, or an existing /images/components/ path.">{input('imageUrl', 'text', { required: false, maxLength: 2000, help: true })}</Field>
            <Field name="imageSource" label="Image source URL" error={errors.imageSource?.message} help="A link to the manufacturer or original source.">{input('imageSource', 'url', { required: false, maxLength: 2000, help: true })}</Field>
            <Field name="imageCaption" label="Image caption" error={errors.imageCaption?.message}>{input('imageCaption', 'text', { required: false, maxLength: 200 })}</Field>
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