import type { ReactNode } from 'react';
import type { TableState } from '../hooks/useTableState';
import { Icon, IconButton } from './Icon';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'right';
  numeric?: boolean;
  hideBelow?: 'sm' | 'md' | 'lg';
}

const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

// The search row, the table and the pager share one bordered frame, so a list
// reads as a single piece rather than three stacked parts. The table scrolls
// inside its own container so a narrow screen never scrolls the page sideways.
// Columns marked hideBelow drop out before that happens.
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

  const cellClass = (column: DataTableColumn<T>) => [
    column.align === 'right' ? 'cell-right' : '',
    column.numeric ? 'cell-num' : '',
    column.hideBelow ? HIDE[column.hideBelow] : ''
  ].filter(Boolean).join(' ');

  return <div className="data-panel">
    <div className="table-top">
      <label className="table-search">
        <Icon name="search"/>
        <input type="search" value={search} placeholder={searchPlaceholder || 'Search'}
          onChange={event => setSearch(event.target.value)} aria-label={'Search ' + label}/>
      </label>
      {filters}
      {toolbar && <div className="table-tools">{toolbar}</div>}
    </div>

    {!sourceCount
      ? <p className="table-empty">{empty}</p>
      : !total
        ? <p className="table-empty">{noMatch || 'Nothing matches those filters. Try a different search.'}</p>
        : <>
          <div className="data-scroll">
            <table className="data-table">
              <caption className="sr-only">{label}</caption>
              <thead><tr>
                {columns.map(column => {
                  const active = sort?.key === column.key;
                  return <th key={column.key} scope="col" className={cellClass(column)}
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {column.sortable
                      ? <button type="button" onClick={() => toggleSort(column.key)}
                          className={'col-sort' + (active ? ' sorted' : '')}>
                          {column.header}
                          <Icon name={active ? (sort.direction === 'asc' ? 'sortAsc' : 'sortDesc') : 'sort'}/>
                          <span className="sr-only">{active ? ', sorted ' + (sort.direction === 'asc' ? 'ascending' : 'descending') : ', not sorted'}</span>
                        </button>
                      : column.header}
                  </th>;
                })}
              </tr></thead>
              <tbody>{visible.map(row => <tr key={rowKey(row)}>
                {columns.map(column => <td key={column.key} className={cellClass(column)}>
                  {column.render(row)}
                </td>)}
              </tr>)}</tbody>
            </table>
          </div>

          <div className="table-foot">
            <p role="status">
              Showing {first}–{last} of {total}{total !== sourceCount ? ' matching, ' + sourceCount + ' in total' : ''}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">Rows
                <select className="table-size" value={pageSize} aria-label="Rows per page"
                  onChange={event => setPageSize(Number(event.target.value))}>
                  {[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <div className="pager">
                <IconButton icon="prev" label="Previous page" onClick={() => setPage(page - 1)} disabled={page <= 1}/>
                <span className="page-count">Page {page} of {pageCount}</span>
                <IconButton icon="next" label="Next page" onClick={() => setPage(page + 1)} disabled={page >= pageCount}/>
              </div>
            </div>
          </div>
        </>}
  </div>;
}