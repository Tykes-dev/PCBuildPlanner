import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useTableState } from '../hooks/useTableState';
import { Feedback } from '../components/Feedback';
import { ComponentImage } from '../components/ComponentImage';
import { Icon, IconButton } from '../components/Icon';
import { CATEGORIES, LABELS, pesos, type Component } from '../types';

const SORTS: [string, string][] = [
  ['name', 'Name, A to Z'],
  ['price-asc', 'Price, low to high'],
  ['price-desc', 'Price, high to low'],
  ['score-desc', 'Performance score'],
  ['power-asc', 'Power draw, lowest first']
];

export function Catalog() {
  const catalog = useApi<Component[]>('/components');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('name');

  // The grid does its own ordering, so the shared table state here is only
  // carrying the search box and the pager.
  const rows = useMemo(() => {
    const list = (catalog.data || []).filter(part => !category || part.category === category);
    const by: Record<string, (a: Component, b: Component) => number> = {
      'name': (a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      'score-desc': (a, b) => b.performanceScore - a.performanceScore,
      'power-asc': (a, b) => a.powerDraw - b.powerDraw
    };
    return [...list].sort(by[sort] || by.name);
  }, [catalog.data, category, sort]);

  const table = useTableState<Component>({
    rows,
    searchText: part => part.name + ' ' + part.brand,
    pageSize: 12
  });
  const { search, setSearch, page, setPage, pageCount, visible, total, sourceCount } = table;
  const counts = catalog.data || [];

  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">EXPLORE THE PARTS</span>
        <h1>The component library.</h1>
        <p className="intro">Compare specifications, prices, and availability across every part the shop stocks.</p>
      </div>
    </div>
    <Feedback {...catalog}/>

    {catalog.data && <>
      <div className="catalog-bar">
        <label className="table-search">
          <Icon name="search"/>
          <input type="search" value={search} placeholder="Search by name or brand"
            onChange={event => setSearch(event.target.value)} aria-label="Search the catalog"/>
        </label>
        <label className="catalog-sort"><span className="text-xs">Sort by</span>
          <select value={sort} onChange={event => setSort(event.target.value)}>
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="category-tabs" aria-label="Filter component category">
        <button className={'category-tab' + (!category ? ' selected' : '')} aria-pressed={!category}
          onClick={() => { setCategory(''); setPage(1); }}>All parts <span>{counts.length}</span></button>
        {CATEGORIES.map(key => <button key={key} className={'category-tab' + (category === key ? ' selected' : '')}
          aria-pressed={category === key} onClick={() => { setCategory(key); setPage(1); }}>
          {LABELS[key]} <span>{counts.filter(part => part.category === key).length}</span>
        </button>)}
      </div>

      <p className="catalog-count" role="status">
        {total ? `Showing ${visible.length} of ${total}` : 'No matches'}
        {total !== sourceCount ? ` matching, ${sourceCount} in this category` : ''} · sample prices
      </p>

      {!total
        ? <p className="panel empty-state"><span>No components match that search or category. Try a different term.</span></p>
        : <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {visible.map(part => <article className="panel catalog-card" key={part._id}>
              <div className="product-image-wrap">
                <span className="product-category">{LABELS[part.category]}</span>
                <ComponentImage component={part}/>
              </div>
              <div className="mt-5">
                <span className="eyebrow">{part.brand}</span>
                <h2 className="mt-2">{part.name}</h2>
                <p className="text-muted mt-2 text-sm">{[part.socket, part.memoryType, part.formFactor,
                  part.capacityGb && part.capacityGb + 'GB', part.wattageRating && part.wattageRating + 'W']
                  .filter(Boolean).join(' · ') || part.powerDraw + 'W estimated draw'}</p>
                <div className="product-price-row">
                  <strong className="cell-num">{pesos(part.price)}</strong>
                  <span className={'tag' + (part.availability === 'in stock' ? ' pass' : '')}>{part.availability}</span>
                </div>
                <div className="score-row">
                  <span>Sample score</span>
                  <span className="score-track" aria-hidden="true"><span style={{ width: part.performanceScore + '%' }}/></span>
                  <strong>{part.performanceScore}<span>/100</span></strong>
                </div>
                <p className="text-xs text-muted mt-3">Estimated draw {part.powerDraw}W</p>
              </div>
            </article>)}
          </div>

          {pageCount > 1 && <div className="grid-foot">
            <IconButton icon="prev" label="Previous page" onClick={() => setPage(page - 1)} disabled={page <= 1}/>
            <span className="page-count">Page {page} of {pageCount}</span>
            <IconButton icon="next" label="Next page" onClick={() => setPage(page + 1)} disabled={page >= pageCount}/>
          </div>}
        </>}
      <p className="catalog-note">Prices and performance scores are sample values for coursework. Product photos come from the manufacturers and need an internet connection.</p>
    </>}
  </>;
}