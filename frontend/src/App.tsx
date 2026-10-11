import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Route, Routes, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Recommend } from './pages/Recommend';
import { Builder } from './pages/Builder';
import { Catalog } from './pages/Catalog';
import { AuthPage } from './pages/AuthPage';
import { AdminUsers } from './pages/AdminUsers';
import { AdminComponents } from './pages/AdminComponents';
import type { Plan } from './types';
import { ThemeToggle } from './components/ThemeToggle';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { errorMessage } from './api/axios';

const SavedBuilds = lazy(() => import('./pages/SavedBuilds').then(module => ({ default: module.SavedBuilds })));
const BuildDetails = lazy(() => import('./pages/BuildDetails').then(module => ({ default: module.BuildDetails })));
const AdminReports = lazy(() => import('./pages/AdminReports').then(module => ({ default: module.AdminReports })));
const AdminProfiles = lazy(() => import('./pages/AdminProfiles').then(module => ({ default: module.AdminProfiles })));
const AdminRules = lazy(() => import('./pages/AdminRules').then(module => ({ default: module.AdminRules })));
const AdminInquiries = lazy(() => import('./pages/AdminInquiries').then(module => ({ default: module.AdminInquiries })));
const AdminPlanner = lazy(() => import('./pages/AdminPlanner').then(module => ({ default: module.AdminPlanner })));
const RequestHelp = lazy(() => import('./pages/RequestHelp').then(module => ({ default: module.RequestHelp })));

const icon = (path: ReactNode) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>;
const GROUP_ICONS = {
  overview: icon(<><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></>),
  people: icon(<><circle cx="6" cy="5.5" r="2.5"/><path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><path d="M11 3.2a2.4 2.4 0 0 1 0 4.6"/></>),
  setup: icon(<><path d="M8 2v2m0 8v2M2 8h2m8 0h2M3.8 3.8l1.4 1.4m5.6 5.6 1.4 1.4m0-8.4-1.4 1.4m-5.6 5.6-1.4 1.4"/><circle cx="8" cy="8" r="2.2"/></>),
  access: icon(<><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></>)
};

function CustomerOnly() {
  const location = useLocation();
  const { user } = useAuth();
  if (user?.role === 'admin') return <Navigate to="/admin/reports" replace/>;
  return user?.role === 'customer' ? <Outlet/> : <Navigate to={'/auth?next=' + encodeURIComponent(location.pathname)} replace/>;
}
function AdminOnly() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Outlet/> : <Navigate to={user ? '/' : '/auth'} replace/>;
}

function Application() {
  const [plan, setPlan] = useState<Plan>({ budget: 50000, profileSlug: 'gaming', items: [] });
  const { user, loading, logout } = useAuth();
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  // Navigating closes the menu, otherwise the panel covers the page just opened.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menuOpen]);

  async function signOut() {
    setError(''); setLoggingOut(true);
    try { await logout(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setLoggingOut(false); }
  }

  // Administration is grouped by what the section is for, the way a settings
  // console is, because seven flat links give no sense of where anything lives.
  const adminGroups: { title: string; icon: keyof typeof GROUP_ICONS; links: [string, string][] }[] = [
    { title: 'Overview', icon: 'overview', links: [['/admin/reports', 'Dashboard']] },
    { title: 'Customer work', icon: 'people', links: [['/admin/inquiries', 'Inquiries'], ['/admin/plan', 'Planner']] },
    { title: 'Shop setup', icon: 'setup', links: [['/admin/components', 'Catalog'], ['/admin/profiles', 'Use cases'], ['/admin/rules', 'Rules']] },
    { title: 'Access', icon: 'access', links: [['/admin/users', 'Users']] }
  ];
  const visitorLinks: [string, string][] = user?.role === 'customer'
    ? [['/', 'Overview'], ['/recommend', 'Find a build'], ['/builder', 'Planner'], ['/builds', 'Saved builds'], ['/help', 'Ask the shop'], ['/components', 'Components']]
    : [['/', 'Overview'], ['/components', 'Components'], ['/auth', 'Log in / Register']];

  const link = ([to, label]: [string, string]) => <NavLink key={to} end={to === '/'} to={to}
    className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>{label}</NavLink>;

  const navigation = (className: string) => <nav aria-label="Main navigation" className={className}>
    {isAdmin
      ? adminGroups.map(group => <div className="side-group" key={group.title}>
          <p className="side-group-title">{GROUP_ICONS[group.icon]}{group.title}</p>
          <div className="side-nav">{group.links.map(link)}</div>
        </div>)
      : visitorLinks.map(link)}
  </nav>;

  const routes = <Routes>
    <Route path="/" element={isAdmin ? <Navigate to="/admin/reports" replace/> : <Home guest={!user}/>}/>
    <Route path="/components" element={<Catalog/>}/>
    <Route path="/auth" element={<AuthPage/>}/>
    <Route path="/login" element={<Navigate to="/auth" replace/>}/>
    <Route path="/register" element={<Navigate to="/auth?mode=register" replace/>}/>
    <Route element={<CustomerOnly/>}>
      <Route path="/recommend" element={<Recommend setPlan={setPlan}/>}/>
      <Route path="/builder" element={<Builder plan={plan} setPlan={setPlan}/>}/>
      <Route path="/builds" element={<SavedBuilds/>}/>
      <Route path="/builds/:id" element={<BuildDetails setPlan={setPlan}/>}/>
      <Route path="/help" element={<RequestHelp/>}/>
    </Route>
    <Route element={<AdminOnly/>}>
      <Route path="/admin/reports" element={<AdminReports/>}/>
      <Route path="/admin/inquiries" element={<AdminInquiries/>}/>
      <Route path="/admin/plan" element={<AdminPlanner/>}/>
      <Route path="/admin/components" element={<AdminComponents/>}/>
      <Route path="/admin/profiles" element={<AdminProfiles/>}/>
      <Route path="/admin/rules" element={<AdminRules/>}/>
      <Route path="/admin/users" element={<AdminUsers/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;

  const brand = <Link to={isAdmin ? '/admin/reports' : '/'} className="brand">
    <span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M8 3v3m4-3v3m4-3v3M8 18v3m4-3v3m4-3v3M3 8h3m-3 4h3m-3 4h3M18 8h3m-3 4h3m-3 4h3"/></svg></span> PC Build Planner
  </Link>;

  const accountFoot = <>
    <div className="flex items-center justify-between gap-3">
      {user
        ? <p className="account-name">{user.name}</p>
        : <p className="text-xs text-muted truncate">Not signed in</p>}
      <ThemeToggle/>
    </div>
    {user && <button type="button" className="button secondary w-full mt-3" onClick={signOut} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Log out'}</button>}
  </>;

  // The slide-in menu mirrors the sidebar exactly, so a narrow screen loses the
  // layout but never loses an option.
  const menuPanel = <div className="nav-overlay no-print" onMouseDown={event => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
    <div className="nav-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-stroke">
        <span className="min-w-0 truncate">{brand}</span>
        <button type="button" className="button secondary" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><span aria-hidden="true">✕</span></button>
      </div>
      {navigation(isAdmin ? 'side-sections !px-0 !py-5' : 'drawer-nav')}
      <div className="pt-4 border-t border-stroke">{accountFoot}</div>
    </div>
  </div>;

  const content = <>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {loading
      ? <p role="status" className="text-muted">Checking your session…</p>
      : <Suspense fallback={<p role="status" className="text-muted">Loading page…</p>}>{routes}</Suspense>}
  </>;

  const account = user && <>
    <span className="account-name">{user.name}</span>
    <span className="header-divider" aria-hidden="true"/>
    <button className="nav-link" onClick={signOut} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Log out'}</button>
  </>;
  // Shown and hidden by stylesheet, not by a Tailwind responsive class. See
  // the note beside .nav-toggle in styles.css.
  const menuButton = !loading && <button type="button" className="nav-toggle"
    onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-label="Open navigation"><span aria-hidden="true">☰</span></button>;

  // Guests are offered the two things they can actually do. Everything else
  // behind the account is pointless until they sign in.
  const footerColumns: [string, [string, string][]][] = user
    ? [['Plan', [['/recommend', 'Find a build'], ['/builder', 'Planner'], ['/builds', 'Saved builds']]],
       ['Browse', [['/components', 'Components'], ['/help', 'Ask the shop']]]]
    : [['Plan', [['/auth', 'Log in'], ['/auth?mode=register', 'Register']]],
       ['Browse', [['/components', 'Components']]]];

  const siteFooter = <footer className="site-footer-wrap no-print">
    <div className="shell footer-grid">
      <div className="footer-brand">
        {brand}
        <p>Plan a desktop PC that fits your budget and actually fits together. Seven parts, checked against each other as you choose them.</p>
      </div>
      {footerColumns.map(([title, links]) => <div key={title}>
        <h2 className="footer-heading">{title}</h2>
        <div className="footer-links">{links.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</div>
      </div>)}
      <div>
        <h2 className="footer-heading">Project</h2>
        <p className="footer-note">CTADWEBL final project<br/>National University Clark<br/>A.Y. 2026 to 2027</p>
      </div>
    </div>
    <div className="footer-bar">
      <div className="shell footer-bar-inner">
        <span>PC Build Planner <span className="footer-dot" aria-hidden="true">·</span> Compatibility and budget planning</span>
        <span>Catalog prices and performance scores are sample values for coursework.</span>
      </div>
    </div>
  </footer>;

  if (isAdmin) return <div className="admin-frame">
    <aside className="admin-sidebar no-print" aria-label="Administration sections">
      <div className="side-brand">{brand}</div>
      {navigation('side-sections')}
      <div className="side-foot">{accountFoot}</div>
    </aside>
    <div className="admin-main">
      {/* Only shown once the sidebar collapses; on a wide screen the sidebar
          already carries the brand, the sections and the account controls. */}
      <header className="admin-topbar no-print lg:hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <span className="min-w-0 truncate">{brand}</span>
          {menuButton}
        </div>
      </header>
      {menuOpen && menuPanel}
      {/* No footer in the console: the sidebar already carries the brand and
          the account, and a marketing footer is noise in a work tool. */}
      <main className="admin-content min-w-0">{content}</main>
    </div>
  </div>;

  return <div className="site-frame">
    <header className={'site-header no-print' + (user ? ' nav-wide' : '')}>
      <div className="shell header-shell">
        {brand}
        {!loading && navigation('site-nav')}
        <div className="header-right">
          {account}
          <ThemeToggle/>
          {menuButton}
        </div>
      </div>
    </header>

    {menuOpen && menuPanel}
    <main className="shell py-8 sm:py-12">{content}</main>
    {siteFooter}
  </div>;
}

function AccountWorkspace() {
  const { user } = useAuth();
  return <Application key={user ? user.id + ':' + user.role : 'guest'}/>;
}
export default function App() { return <AuthProvider><AccountWorkspace/></AuthProvider>; }