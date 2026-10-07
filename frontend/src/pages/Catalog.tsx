import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Feedback } from '../components/Feedback';
import { ComponentImage } from '../components/ComponentImage';
import { CATEGORIES, LABELS, pesos, type Component } from '../types';
export function Catalog() {
  const catalog = useApi<Component[]>('/components');
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('');
  const list = catalog.data?.filter(c => (!category || c.category === category) && `${c.name} ${c.brand}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <><span className="eyebrow">EXPLORE THE PARTS</span><h1>The component library.</h1><p className="intro">Compare specifications, prices, and availability.</p><Feedback {...catalog}/>
    {catalog.data && <><div className="panel grid sm:grid-cols-2 gap-4 mt-6"><label>Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or brand"/></label><label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All components</option>{CATEGORIES.map(c => <option key={c} value={c}>{LABELS[c]}</option>)}</select></label></div>
    <div className="category-tabs" aria-label="Filter component category"><button className={`category-tab ${!category ? 'selected' : ''}`} aria-pressed={!category} onClick={() => setCategory('')}>All parts <span>{catalog.data.length}</span></button>{CATEGORIES.map(c => <button key={c} className={`category-tab ${category === c ? 'selected' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>{LABELS[c]} <span>{catalog.data!.filter(p => p.category === c).length}</span></button>)}</div>
    <p className="text-muted text-sm my-5">{list.length} matching parts · Sample prices</p><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{list.map(c => <article className="panel catalog-card" key={c._id}><div className="product-image-wrap"><span className="product-category">{LABELS[c.category]}</span><ComponentImage component={c}/></div><div className="mt-5"><span className="eyebrow">{c.brand}</span><h2 className="mt-2">{c.name}</h2><p className="text-muted mt-2 text-sm">{[c.socket, c.memoryType, c.formFactor, c.capacityGb && `${c.capacityGb}GB`, c.wattageRating && `${c.wattageRating}W`].filter(Boolean).join(' · ') || `${c.powerDraw}W estimated draw`}</p><div className="product-price-row"><strong>{pesos(c.price)}</strong><span className="tag">{c.availability}</span></div><div className="score-row"><span>Sample score</span><span className="score-track" aria-hidden="true"><span style={{width: `${c.performanceScore}%`}}/></span><strong>{c.performanceScore}<span>/100</span></strong></div><p className="text-xs text-muted mt-3">Estimated draw {c.powerDraw}W</p>{c.imageCaption && <p className="text-xs text-muted mt-2">{c.imageCaption}</p>}{c.imageSource && <a href={c.imageSource} target="_blank" rel="noreferrer" className="text-xs text-muted underline underline-offset-4 inline-block mt-2">Photo source ↗</a>}</div></article>)}</div>
    {!list.length && <p className="panel">No matching components. Try another search or category.</p>}</>}
  </>;
}
