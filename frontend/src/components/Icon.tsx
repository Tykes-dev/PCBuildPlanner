import { Link } from 'react-router-dom';

// Icons are drawn here instead of pulled from a package. The project carries no
// icon dependency, and these match the 16px stroked style already used by the
// brand mark and the sidebar group headings.
const PATHS = {
  edit: <>
    <path d="M11.4 2.6a1.7 1.7 0 0 1 2.4 2.4l-7.6 7.6-3.2.8.8-3.2z"/>
    <path d="m9.9 4.1 2.4 2.4"/>
  </>,
  archive: <>
    <rect x="2.2" y="2.8" width="11.6" height="3.1" rx="1"/>
    <path d="M3.4 5.9v6.3a1.2 1.2 0 0 0 1.2 1.2h6.8a1.2 1.2 0 0 0 1.2-1.2V5.9"/>
    <path d="M6.5 8.8h3"/>
  </>,
  restore: <>
    <path d="M13.2 8A5.2 5.2 0 1 1 11.6 4.2"/>
    <path d="M13.5 2.2v3.2h-3.2"/>
  </>,
  star: <path d="m8 2.2 1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4-2.9-2.8 4-.6z"/>,
  remove: <>
    <path d="M2.8 4.3h10.4"/>
    <path d="M6.3 4.3V3.2a1 1 0 0 1 1-1h1.4a1 1 0 0 1 1 1v1.1"/>
    <path d="m4.4 4.3.6 8.3a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.6-8.3"/>
    <path d="M6.7 6.8v3.9M9.3 6.8v3.9"/>
  </>,
  power: <>
    <path d="M8 2.4v5.1"/>
    <path d="M11.6 4.3a5 5 0 1 1-7.2 0"/>
  </>,
  open: <>
    <path d="M6.4 3.2H3.6a1.2 1.2 0 0 0-1.2 1.2v8a1.2 1.2 0 0 0 1.2 1.2h8a1.2 1.2 0 0 0 1.2-1.2V9.6"/>
    <path d="M9.5 2.6h4v4"/>
    <path d="M13.5 2.6 8.3 7.8"/>
  </>,
  hide: <>
    <path d="m2.3 2.3 11.4 11.4"/>
    <path d="M6.4 3.7A6.5 6.5 0 0 1 8 3.5c3.3 0 5.5 2.3 6.3 4.5a9 9 0 0 1-2 2.8"/>
    <path d="M11.8 11.8a6.6 6.6 0 0 1-3.8.7c-3.3 0-5.5-2.3-6.3-4.5a9.2 9.2 0 0 1 2.9-3.6"/>
    <path d="M6.7 6.8a2 2 0 0 0 2.7 2.7"/>
  </>,
  search: <>
    <circle cx="7.2" cy="7.2" r="4.3"/>
    <path d="m10.5 10.5 3.3 3.3"/>
  </>,
  sort: <>
    <path d="M5.3 6.6 8 3.9l2.7 2.7"/>
    <path d="M5.3 9.4 8 12.1l2.7-2.7"/>
  </>,
  sortAsc: <path d="M4.6 9.7 8 6.3l3.4 3.4"/>,
  sortDesc: <path d="M4.6 6.3 8 9.7l3.4-3.4"/>,
  prev: <path d="M9.8 3.6 5.4 8l4.4 4.4"/>,
  next: <path d="M6.2 3.6 10.6 8l-4.4 4.4"/>
};

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>;
}

function Spinner() {
  return <svg className="icon-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="5.4" opacity="0.25"/>
    <path d="M13.4 8A5.4 5.4 0 0 0 8 2.6"/>
  </svg>;
}

// An icon-only control still needs a name. The label is the accessible name and
// the hover tooltip, so it should read as the action, not the icon.
export function IconButton({ icon, label, onClick, disabled, busy, tone }: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'danger';
}) {
  return <button type="button" className={'icon-button' + (tone ? ' ' + tone : '')}
    onClick={onClick} disabled={disabled || busy} aria-label={label} title={label}
    aria-busy={busy || undefined}>
    {busy ? <Spinner/> : <Icon name={icon}/>}
  </button>;
}

export function IconLink({ icon, label, to }: { icon: IconName; label: string; to: string }) {
  return <Link to={to} className="icon-button" aria-label={label} title={label}><Icon name={icon}/></Link>;
}