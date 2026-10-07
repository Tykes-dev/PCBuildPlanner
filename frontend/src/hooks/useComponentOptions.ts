import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/axios';
import type { ComponentOption, Item } from '../types';

export function useComponentOptions(items: Item[]) {
  const key = JSON.stringify(items.map(i => ({ componentId: i.component._id, quantity: i.quantity })));
  const [result, setResult] = useState<{ key: string; data: ComponentOption[]; error: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api.post<ComponentOption[]>('/component-options', { items: JSON.parse(key) }, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setResult({ key, data: response.data, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, data: [], error: errorMessage(error) }); });
    return () => controller.abort();
  }, [key]);
  const current = result?.key === key ? result : null;
  return { options: current?.data ?? [], loading: !current, error: current?.error ?? '' };
}
