import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/axios';
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    api.get<T>(path, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setData(r.data); })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, attempt]);
  return { data, loading, error, retry: () => retry(n => n + 1) };
}
