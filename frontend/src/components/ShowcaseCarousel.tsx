import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/axios';
import { LABELS, pesos } from '../types';
import type { SavedBuild } from '../types/builds';

// A horizontally snapping track rather than a timed slider: nothing moves on
// its own, it works with a keyboard, and the scrolling is contained so the page
// itself never scrolls sideways on a narrow screen.
export function ShowcaseCarousel({ guest = false }: { guest?: boolean }) {
  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<SavedBuild[]>('/showcase')
      .then(response => { if (!cancelled) setBuilds(response.data); })
      .catch(() => { if (!cancelled) setBuilds([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function edges() {
    const node = track.current;
    if (!node) return;
    setAtStart(node.scrollLeft <= 4);
    setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 4);
  }

  useEffect(() => { edges(); }, [builds]);

  function scrollBy(direction: 1 | -1) {
    const node = track.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(260, node.clientWidth * 0.8), behavior: 'smooth' });
  }

  // Nothing published yet is a normal state, so the section stays out of the
  // way rather than showing an empty shelf to visitors.
  if (loading || !builds.length) return null;

  return <section className="how-section" aria-labelledby="showcase-heading">
    <div className="section-heading">
      <div>
        <span className="eyebrow">READY WHEN YOU ARE</span>
        <h2 id="showcase-heading">Builds the shop put together.</h2>
      </div>
      <div className="flex gap-2">
        <button type="button" className="button secondary" onClick={() => scrollBy(-1)} disabled={atStart} aria-label="Previous builds"><span aria-hidden="true">←</span></button>
        <button type="button" className="button secondary" onClick={() => scrollBy(1)} disabled={atEnd} aria-label="More builds"><span aria-hidden="true">→</span></button>
      </div>
    </div>
    <ul ref={track} onScroll={edges} className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1">
      {builds.map(build => <li key={build.id} className="panel snap-start shrink-0 w-[min(20rem,85vw)] flex flex-col">
        <h3 className="text-base break-words">{build.name}</h3>
        <p className="text-sm text-muted mt-2">{build.items.length} of 7 categories · {build.profileSlug.replace(/-/g, ' ')}</p>
        <p className="text-2xl font-semibold mt-3">{pesos(build.total)}</p>
        <ul className="text-sm text-muted mt-3 space-y-1">
          {build.items.slice(0, 3).map(item => <li key={item.component._id} className="truncate">{LABELS[item.component.category]} · {item.component.name}</li>)}
          {build.items.length > 3 && <li>and {build.items.length - 3} more</li>}
        </ul>
        <Link className="button secondary mt-auto pt-3" to={guest ? '/auth?next=/recommend' : '/recommend'}>
          {guest ? 'Log in to start from this' : 'Plan something like this'} <span aria-hidden="true">↗</span>
        </Link>
      </li>)}
    </ul>
    <p className="text-xs text-muted">Swipe or use the arrows. Prices are the shop's sample values.</p>
  </section>;
}