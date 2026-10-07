import { useState } from 'react';
import type { Component } from '../types';

export function ComponentImage({ component, compact = false }: { component: Component; compact?: boolean }) {
  const [failedUrl, setFailedUrl] = useState('');
  const source = component.imageUrl;
  return <div className={`component-image ${compact ? 'compact' : ''}`}>
    {source && failedUrl !== source ? <img src={source} alt={component.imageCaption || component.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(source)}/> : <div className="image-placeholder"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg><span>{compact ? 'No photo' : 'Product photo unavailable'}</span></div>}
  </div>;
}
