import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// A slide-over panel for details and forms, so a table page never navigates
// away to show one record. Escape closes it, focus is kept inside while it is
// open, and focus returns to whatever opened it.
export function Drawer({ open, title, description, onClose, children, footer, wide = false }: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // Callers pass a fresh arrow function on every render. Depending on its
  // identity re-ran the whole effect on every keystroke, which moved focus to
  // the close button mid-sentence, so the callback is read through a ref and
  // the effect depends on `open` alone.
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // The first field, not the close button.
    const body = panel.current?.querySelector<HTMLElement>('.drawer-body');
    (body?.querySelector<HTMLElement>(FOCUSABLE) || panel.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.stopPropagation(); close.current(); return; }
      if (event.key !== 'Tab' || !panel.current) return;
      const targets = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!targets.length) return;
      const [start, end] = [targets[0], targets[targets.length - 1]];
      if (event.shiftKey && document.activeElement === start) { event.preventDefault(); end.focus(); }
      else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return <div className="drawer-overlay no-print" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className={'drawer-panel' + (wide ? ' drawer-wide' : '')} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-head">
        <div className="min-w-0">
          <h2 id="drawer-title" className="!text-xl break-words">{title}</h2>
          {description && <p className="text-sm text-muted mt-2 break-words">{description}</p>}
        </div>
        <button type="button" className="button secondary" onClick={onClose} aria-label="Close panel"><span aria-hidden="true">✕</span></button>
      </div>
      <div className="drawer-body">{children}</div>
      {footer && <div className="drawer-foot">{footer}</div>}
    </div>
  </div>;
}