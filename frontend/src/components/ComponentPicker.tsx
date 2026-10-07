import { useState } from 'react';
import { ComponentImage } from './ComponentImage';
import { pesos, LABELS, type Category, type Component, type ComponentOption, type Item } from '../types';

export function ComponentPicker({ category, components, options, loading, error, selected, target, onChoose }: {
  category: Category; components: Component[]; options: ComponentOption[]; loading: boolean; error: string;
  selected?: Item; target?: number; onChoose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rows = components.filter(c => c.category === category).map(component => {
    const option = options.find(o => o.componentId === component._id);
    const blocked = !option || !option.compatible || !option.available;
    const over = target !== undefined && component.price * (selected?.quantity ?? 1) > target;
    return { component, option, blocked, over };
  }).sort((a, b) => Number(a.blocked) - Number(b.blocked) || Number(a.over) - Number(b.over) || a.component.price - b.component.price);
  const enabledCount = rows.filter(r => !r.blocked).length;
  const selectedStatus = options.find(o => o.componentId === selected?.component._id);
  return <div className="mt-4">
    <div className="flex items-center gap-3">
      {selected && <ComponentImage component={components.find(c => c._id === selected.component._id) || selected.component} compact/>}
      <div className="min-w-0 flex-1"><p className="font-medium">{selected?.component.name || 'No part selected'}</p>{selected && <p className="text-sm text-muted mt-1">{pesos(selected.component.price * selected.quantity)}</p>}</div>
      <button className="button secondary shrink-0" type="button" aria-expanded={open} aria-controls={`picker-${category}`} onClick={() => setOpen(!open)}>{open ? 'Close' : selected ? 'Change' : 'Choose'}</button>
    </div>
    {selected && selectedStatus && !selectedStatus.compatible && <p className="text-sm text-danger mt-3">{selectedStatus.reasons.join(' ')} Remove this part to change platforms.</p>}
    {selected && <button type="button" className="text-xs text-muted underline underline-offset-4 mt-3" onClick={() => onChoose('')}>Remove {LABELS[category].toLowerCase()}</button>}
    {open && <div id={`picker-${category}`} className="picker-list">
      <p className="text-xs text-muted mb-3" aria-live="polite">{loading ? 'Checking compatible options…' : error ? 'Compatibility could not be checked. Selection is paused.' : `${enabledCount} available options. Incompatible parts are disabled.`}</p>
      {error && <p className="notice error mb-3">{error}</p>}
      {rows.map(({ component, option, blocked, over }) => <div className={`picker-option ${blocked && !loading ? 'unavailable' : ''} ${selected?.component._id === component._id ? 'selected' : ''}`} key={component._id}>
        <ComponentImage component={component} compact/>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{component.name}</p><p className="text-xs text-muted mt-1">{[component.socket, component.memoryType, component.formFactor, component.capacityGb && `${component.capacityGb}GB`, component.wattageRating && `${component.wattageRating}W`].filter(Boolean).join(' · ')}</p>
          <p className="text-sm mt-2">{pesos(component.price)}{over && !blocked && <span className="text-xs text-muted ml-2">Above category target</span>}</p>
          {!loading && option?.reasons.map(reason => <p className="text-xs text-muted mt-2 leading-relaxed" key={reason}>{reason}</p>)}
        </div>
        <button type="button" className="button secondary picker-select" disabled={loading || blocked || selected?.component._id === component._id} aria-label={`Select ${component.name}`} onClick={() => { onChoose(component._id); setOpen(false); }}>{selected?.component._id === component._id ? 'Selected' : blocked && !loading ? 'Unavailable' : 'Select'}</button>
      </div>)}
      {!rows.length && <p className="text-sm text-muted">No parts in this category yet.</p>}
      <p className="text-xs text-muted mt-3">To switch sockets or memory types, remove the conflicting selected part first. Budget and balance warnings do not disable choices.</p>
    </div>}
  </div>;
}
