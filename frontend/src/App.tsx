import { useState } from 'react';
import { NavLink, Route, Routes, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Recommend } from './pages/Recommend';
import { Builder } from './pages/Builder';
import { Catalog } from './pages/Catalog';
import type { Plan } from './types';
import { ThemeToggle } from './components/ThemeToggle';
export default function App() {
  const [plan, setPlan] = useState<Plan>({ budget: 50000, profileSlug: 'gaming', items: [] });
  return <><header className="site-header no-print"><div className="shell flex flex-wrap items-center justify-between gap-4 py-5"><Link to="/" className="brand"><span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M8 3v3m4-3v3m4-3v3M8 18v3m4-3v3m4-3v3M3 8h3m-3 4h3m-3 4h3M18 8h3m-3 4h3m-3 4h3"/></svg></span> PC Build Planner</Link><div className="header-controls"><nav aria-label="Main navigation" className="flex flex-wrap gap-1">{[['/', 'Overview'], ['/recommend', 'Find a build'], ['/builder', 'Planner'], ['/components', 'Components']].map(([to, label]) => <NavLink key={to} end={to === '/'} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{label}</NavLink>)}</nav><ThemeToggle/></div></div></header>
    <main className="shell py-8 sm:py-12"><Routes><Route path="/" element={<Home/>}/><Route path="/recommend" element={<Recommend setPlan={setPlan}/>}/><Route path="/builder" element={<Builder plan={plan} setPlan={setPlan}/>}/><Route path="/components" element={<Catalog/>}/><Route path="*" element={<section className="panel"><h1>Page not found.</h1><Link className="button mt-5" to="/">Back to overview</Link></section>}/></Routes></main>
    <footer className="shell site-footer no-print"><span>PC Build Planner <span className="footer-dot" aria-hidden="true">·</span> Make every part count.</span><span>CTADWEBL · Compatibility & budget planning</span></footer></>;
}
