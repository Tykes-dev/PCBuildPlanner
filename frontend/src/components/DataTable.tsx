import type { ReactNode } from 'react';
import type { TableState } from '../hooks/useTableState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'right';
  hideBelow?: 'sm' | 'md' | 'lg';
}

const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

// The table scrolls inside its own container so a narrow screen never scrolls
// the page sideways. Columns marked hideBelow drop out before that happens.
export function DataTable<T>({ table, columns, rowKey, label, searchPlaceholder, filters, toolbar, empty, noMatch }: {
  table: TableState<T>;
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  label: string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  toolbar?: ReactNode;
  empty: string;
  noMatch?: string;
}) {
  const { search, setSearch, sort, toggleSort, page, setPage, pageCount, pageSize, setPageSize, visible, total, sourceCount } = table;
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);

  return <div>
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <label className="flex-1 min-w-[12rem]">
        <span className="text-xs">Search</span>
        <input type="search" value={search} placeholder={searchPlaceholder || 'Search'}
          onChange={event => setSearch(event.target.value)} aria-label={'Search ' + label}/>
      </label>
      {filters}
      {toolbar && <div className="flex flex-wrap gap-3">{toolbar}</div>}
    </div>

    {!sourceCount
      ? <p className="notice note">{empty}</p>
      : !total
        ? <p className="notice note">{noMatch || 'Nothing matches those filters. Try a different search.'}</p>
        : <>
          <div className="overflow-x-auto rounded-xl border border-stroke bg-surface">
            <table className="w-full text-left text-sm min-w-[32rem]">
              <caption className="sr-only">{label}</caption>
              <thead><tr className="border-b border-stroke text-muted">
                {columns.map(column => {
                  const active = sort?.key === column.key;
                  return <th key={column.key} scope="col"
                    className={'py-3 px-4 font-medium ' + (column.align === 'right' ? 'text-right ' : '') + (column.hideBelow ? HIDE[column.hideBelow] : '')}
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {column.sortable
                      ? <button type="button" onClick={() => toggleSort(column.key)}
                          className="inline-flex items-center gap-1 hover:text-ink">
                          {column.header}<span aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                          <span className="sr-only">{active ? ', sorted ' + (sort.direction === 'asc' ? 'ascending' : 'descending') : ', not sorted'}</span>
                        </button>
                      : column.header}
                  </th>;
                })}
              </tr></thead>
              <tbody>{visible.map(row => <tr key={rowKey(row)} className="border-b last:border-0 border-stroke align-top">
                {columns.map(column => <td key={column.key}
                  className={'py-3 px-4 ' + (column.align === 'right' ? 'text-right ' : '') + (column.hideBelow ? HIDE[column.hideBelow] : '')}>
                  {column.render(row)}
                </td>)}
              </tr>)}</tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <p className="text-xs text-muted" role="status">
              Showing {first}–{last} of {total}{total !== sourceCount ? ' matching, ' + sourceCount + ' in total' : ''}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs">Rows
                <select className="!w-auto !py-1.5" value={pageSize} aria-label="Rows per page"
                  onChange={event => setPageSize(Number(event.target.value))}>
                  {[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button type="button" className="button secondary !py-1.5" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><span aria-hidden="true">←</span></button>
                <span className="text-xs text-muted">Page {page} of {pageCount}</span>
                <button type="button" className="button secondary !py-1.5" onClick={() => setPage(page + 1)} disabled={page >= pageCount} aria-label="Next page"><span aria-hidden="true">→</span></button>
              </div>
            </div>
          </div>
        </>}
  </div>;
}