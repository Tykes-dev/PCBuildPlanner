import { useState } from 'react';
import { ComponentImage } from './ComponentImage';
import { Drawer } from './Drawer';
import { DataTable, type DataTableColumn } from './DataTable';
import { useTableState } from '../hooks/useTableState';
import { pesos, LABELS, type Category, type Component, type ComponentOption, type Item } from '../types';

interface Row { component: Component; option?: ComponentOption; blocked: boolean; over: boolean }

const searchText = (row: Row) => [row.component.name, row.component.brand, row.component.socket,
  row.component.memoryType, row.component.formFactor, row.component.storageType].filter(Boolean).join(' ');
const sortValues = {
  name: (row: Row) => row.component.name.toLowerCase(),
  price: (row: Row) => row.component.price,
  score: (row: Row) => row.component.performanceScore
};

// Choosing a part opens a dialog rather than expanding the page, so a long
// catalog stays searchable and the planner below does not jump around.
export function ComponentPicker({ category, components, options, loading, error, selected, target, onChoose }: {
  category: Category; components: Component[]; options: ComponentOption[]; loading: boolean; error: string;
  selected?: Item; target?: number; onChoose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [onlyFits, setOnlyFits] = useState(true);

  const all: Row[] = components.filter(component => component.category === category).map(component => {
    const option = options.find(entry => entry.componentId === component._id);
    const blocked = !option || !option.compatible || !option.available;
    const over = target !== undefined && component.price * (selected?.quantity ?? 1) > target;
    return { component, option, blocked, over };
  });
  const enabledCount = all.filter(row => !row.blocked).length;
  const rows = onlyFits && !loading ? all.filter(row => !row.blocked) : all;
  const table = useTableState<Row>({ rows, searchText, sortValues, pageSize: 10, initialSort: { key: 'price', direction: 'asc' } });
  const selectedStatus = options.find(entry => entry.componentId === selected?.component._id);

  const columns: DataTableColumn<Row>[] = [
    { key: 'name', header: 'Component', sortable: true, render: ({ component, option, blocked, over }) => <div className="flex items-start gap-3">
      <ComponentImage component={component} compact/>
      <div className="min-w-0">
        <p className="font-medium break-words">{component.name}</p>
        <p className="text-xs text-muted mt-1">{[component.brand, component.socket, component.memoryType, component.formFactor,
          component.capacityGb && component.capacityGb + 'GB', component.wattageRating && component.wattageRating + 'W'].filter(Boolean).join(' · ')}</p>
        {over && !blocked && <p className="text-xs text-muted mt-1">Above the category target</p>}
        {!loading && option?.reasons.map(reason => <p className="text-xs text-danger mt-1 leading-relaxed" key={reason}>{reason}</p>)}
      </div>
    </div> },
    { key: 'price', header: 'Price', sortable: true, align: 'right', render: row => pesos(row.component.price) },
    { key: 'score', header: 'Score', sortable: true, align: 'right', hideBelow: 'sm', render: row => row.component.performanceScore },
    { key: 'choose', header: 'Choose', align: 'right', render: ({ component, blocked }) => {
      const current = selected?.component._id === component._id;
      return <button type="button" className="button secondary !py-1.5" disabled={loading || blocked || current}
        aria-label={'Select ' + component.name} onClick={() => { onChoose(component._id); setOpen(false); }}>
        {current ? 'Selected' : blocked && !loading ? 'Does not fit' : 'Select'}
      </button>;
    } }
  ];

  return <div className="mt-4">
    <div className="flex items-center gap-3">
      {selected && <ComponentImage component={components.find(entry => entry._id === selected.component._id) || selected.component} compact/>}
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{selected?.component.name || 'No part selected'}</p>
        {selected && <p className="text-sm text-muted mt-1">{pesos(selected.component.price * selected.quantity)}</p>}
      </div>
      <button className="button secondary shrink-0" type="button" onClick={() => setOpen(true)}>{selected ? 'Change' : 'Choose'}</button>
    </div>
    {selected && selectedStatus && !selectedStatus.compatible &&
      <p className="text-sm text-danger mt-3">{selectedStatus.reasons.join(' ')} Remove this part to change platforms.</p>}
    {selected && <button type="button" className="text-xs text-muted underline underline-offset-4 mt-3" onClick={() => onChoose('')}>
      Remove {LABELS[category].toLowerCase()}
    </button>}

    <Drawer open={open} onClose={() => setOpen(false)} wide
      title={'Choose a ' + LABELS[category].toLowerCase()}
      description={loading ? 'Checking which parts fit your build…' : error ? 'Compatibility could not be checked, so selection is paused.' : enabledCount + ' of ' + all.length + ' parts fit this build.'}>
      {error && <p className="notice error mb-4">{error}</p>}
      <DataTable
        table={table} columns={columns} rowKey={row => row.component._id}
        label={LABELS[category] + ' options'} searchPlaceholder="Name, brand or specification"
        empty={'No ' + LABELS[category].toLowerCase() + ' parts in the catalog yet.'}
        noMatch={onlyFits ? 'Nothing matches. Try clearing the search, or untick "Only parts that fit" to see why others are blocked.' : 'Nothing matches that search.'}
        filters={<label className="flex items-center gap-2 text-sm whitespace-nowrap self-end pb-2">
          <input type="checkbox" className="!w-4 !h-4 !m-0" checked={onlyFits} onChange={event => setOnlyFits(event.target.checked)}/>
          Only parts that fit
        </label>}/>
      <p className="text-xs text-muted mt-4">To switch sockets or memory types, remove the conflicting part first. Budget and balance warnings never disable a choice.</p>
    </Drawer>
  </div>;
}