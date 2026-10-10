import { lazy, Suspense, useState } from 'react';
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
function CustomerOnly() {
  const location = useLocation();
  const { user } = useAuth();
  if (user?.role === 'admin') return <Navigate to="/admin/reports" replace/>;
  return user?.role === "customer" ? <Outlet/> : <Navigate to={"/auth?next=" + encodeURIComponent(location.pathname)} replace/>;
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
  async function signOut() {
    setError(''); setLoggingOut(true);
    try { await logout(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setLoggingOut(false); }
  }
  const links: [string, string][] = user?.role === 'admin'
    ? [['/admin/reports', 'Dashboard'], ['/admin/inquiries', 'Inquiries'], ['/admin/plan', 'Planner'], ['/admin/components', 'Catalog'], ['/admin/profiles', 'Use cases'], ['/admin/rules', 'Rules'], ['/admin/users', 'Users']]
    : user?.role === 'customer'
      ? [['/', 'Overview'], ['/recommend', 'Find a build'], ['/builder', 'Planner'], ['/builds', 'Saved builds'], ['/help', 'Ask the shop'], ['/components', 'Components']]
      : [['/', 'Overview'], ['/components', 'Components'], ['/auth', 'Log in / Register']];
  return <><header className="site-header no-print"><div className="shell flex flex-wrap items-center justify-between gap-4 py-5">
    <Link to={user?.role === 'admin' ? '/admin/reports' : '/'} className="brand"><span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M8 3v3m4-3v3m4-3v3M8 18v3m4-3v3m4-3v3M3 8h3m-3 4h3m-3 4h3M18 8h3m-3 4h3m-3 4h3"/></svg></span> PC Build Planner</Link>
    <div className="header-controls">{!loading && <nav aria-label="Main navigation" className="flex flex-wrap gap-1">{links.map(([to, label]) => <NavLink key={to} end={to === '/'} to={to} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>{label}</NavLink>)}</nav>}
      {user && <><span className="text-xs text-muted">{user.name} · {user.role}</span><button className="nav-link" onClick={signOut} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Log out'}</button></>}<ThemeToggle/>
    </div></div></header>
    <main className="shell py-8 sm:py-12">{error && <p role="alert" className="notice error mb-5">{error}</p>}
      {loading ? <p role="status" className="text-muted">Checking your session…</p> : <Suspense fallback={<p role="status" className="text-muted">Loading page…</p>}><Routes>
        <Route path="/" element={user?.role === 'admin' ? <Navigate to="/admin/reports" replace/> : <Home guest={!user}/>}/>
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
        <Route element={<AdminOnly/>}><Route path="/admin/reports" element={<AdminReports/>}/><Route path="/admin/users" element={<AdminUsers/>}/><Route path="/admin/components" element={<AdminComponents/>}/><Route path="/admin/profiles" element={<AdminProfiles/>}/><Route path="/admin/rules" element={<AdminRules/>}/><Route path="/admin/inquiries" element={<AdminInquiries/>}/><Route path="/admin/plan" element={<AdminPlanner/>}/></Route>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes></Suspense>}
    </main>
    <footer className="shell site-footer no-print"><span>PC Build Planner <span className="footer-dot" aria-hidden="true">·</span> Make every part count.</span><span>CTADWEBL · Compatibility &amp; budget planning</span></footer>
  </>;
}
function AccountWorkspace() {
  const { user } = useAuth();
  return <Application key={(user ? user.id + ':' + user.role : 'guest')}/>;
}
export default function App() { return <AuthProvider><AccountWorkspace/></AuthProvider>; }