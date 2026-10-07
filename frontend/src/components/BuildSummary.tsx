import { LABELS, pesos, type Item, type Validation } from '../types';
export function Parts({ items }: { items: Item[] }) {
  return <div className="divide-y divide-stroke">{items.map(({ component: c, quantity }) => <div className="part-row" key={c._id}>
    <div><span className="eyebrow">{LABELS[c.category]}</span><p className="font-semibold mt-1">{c.name}</p><p className="text-sm text-muted">{quantity > 1 ? `${quantity} × ` : ''}{c.brand} · {c.socket || c.memoryType || (c.capacityGb ? `${c.capacityGb}GB` : c.wattageRating ? `${c.wattageRating}W` : `${c.powerDraw}W draw`)}</p></div>
    <strong className="price">{pesos(c.price * quantity)}</strong></div>)}</div>;
}
export function Checks({ validation }: { validation: Validation }) {
  return <section className="panel"><div className="flex justify-between gap-3"><h2>Compatibility</h2><span className={`tag ${validation.valid ? 'pass' : 'warning'}`}>{validation.valid ? 'Ready' : 'Needs attention'}</span></div>
    {validation.missingCategories.length > 0 && <p className="notice warning mt-4">Choose: {validation.missingCategories.map(c => LABELS[c]).join(', ')}.</p>}
    {validation.issues.map((i, index) => <p className={`notice mt-3 ${i.severity}`} key={`${i.code}-${index}`}><strong className="block text-xs uppercase mb-1">{i.severity === 'error' ? 'Must fix' : i.severity}</strong>{i.message}</p>)}
    {validation.valid && !validation.issues.length && <p className="text-muted mt-4">All supported checks passed.</p>}
    <div className="mt-5 border-t border-stroke pt-4 space-y-2 text-sm"><p className="flex justify-between"><span>Estimated draw</span><strong>{validation.power.totalDraw}W</strong></p><p className="flex justify-between"><span>With {validation.power.marginPercent}% headroom</span><strong>{validation.power.requiredWattage}W</strong></p><p className="flex justify-between"><span>Supply rating</span><strong>{validation.power.supplyRating === null ? 'Not selected' : `${validation.power.supplyRating}W`}</strong></p></div>
  </section>;
}
