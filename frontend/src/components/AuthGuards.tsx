import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';

function SessionLoading() {
  return <section className="panel auth-loading" role="status"><span className="eyebrow">ACCOUNT</span><h1>Checking your session…</h1><p className="intro">This should only take a moment.</p></section>;
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <SessionLoading/>;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }}/>;
  return <Outlet/>;
}

export function RequireAdmin() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <SessionLoading/>;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }}/>;
  if (user.role !== 'admin') return <Navigate to="/account" replace state={{ notice: 'Administrator access is required for that page.' }}/>;
  return <Outlet/>;
}
