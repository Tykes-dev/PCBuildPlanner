import { useMemo, useState } from 'react';

// One place for search, sorting and pagination so every admin table behaves the
// same way. Filtering stays with the page, because each one filters on
// different fields, and the filtered array is what gets passed in here.
export type SortDirection = 'asc' | 'desc';
export interface TableSort { key: string; direction: SortDirection; }

export interface TableState<T> {
  search: string;
  setSearch: (value: string) => void;
  sort: TableSort | null;
  toggleSort: (key: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageCount: number;
  pageSize: number;
  setPageSize: (size: number) => void;
  visible: T[];
  total: number;
  sourceCount: number;
}

export function useTableState<T>({ rows, searchText, sortValues, pageSize = 10, initialSort }: {
  rows: T[];
  searchText?: (row: T) => string;
  sortValues?: Record<string, (row: T) => string | number>;
  pageSize?: number;
  initialSort?: TableSort;
}): TableState<T> {
  const [search, setSearchValue] = useState('');
  const [sort, setSort] = useState<TableSort | null>(initialSort ?? null);
  const [page, setPageValue] = useState(1);
  const [size, setSize] = useState(pageSize);

  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || !searchText) return rows;
    return rows.filter(row => searchText(row).toLowerCase().includes(term));
  }, [rows, search, searchText]);

  const sorted = useMemo(() => {
    const read = sort && sortValues ? sortValues[sort.key] : undefined;
    if (!sort || !read) return searched;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...searched].sort((a, b) => {
      const left = read(a), right = read(b);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
      return String(left).localeCompare(String(right), 'en', { numeric: true }) * factor;
    });
  }, [searched, sort, sortValues]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  // Clamped during render instead of in an effect, so a shrinking result set
  // never leaves the table showing an empty page for a frame.
  const current = Math.min(Math.max(page, 1), pageCount);
  const visible = useMemo(() => sorted.slice((current - 1) * size, current * size), [sorted, current, size]);

  return {
    search,
    setSearch: value => { setSearchValue(value); setPageValue(1); },
    sort,
    // First click sorts ascending, second descending, third clears it.
    toggleSort: key => {
      setPageValue(1);
      setSort(currentSort => currentSort?.key !== key
        ? { key, direction: 'asc' }
        : currentSort.direction === 'asc' ? { key, direction: 'desc' } : null);
    },
    page: current,
    setPage: next => setPageValue(Math.min(Math.max(next, 1), pageCount)),
    pageCount,
    pageSize: size,
    setPageSize: next => { setSize(next); setPageValue(1); },
    visible,
    total,
    sourceCount: rows.length
  };
}