import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/axios';
import { useAuth } from '../hooks/AuthContext';

function formatDate(value: string | null) {
  if (!value) return 'Not recorded yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded yet' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function Account() {
  const { user, logout, sessionError } = useAuth();
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  if (!user) return null;
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';

  async function signOut() {
    setError(''); setSigningOut(true);
    try { await logout(); navigate('/', { replace: true }); }
    catch (requestError) { setError(errorMessage(requestError)); setSigningOut(false); }
  }

  return <><div className="account-heading"><div><span className="eyebrow">ACCOUNT</span><h1>Your workspace.</h1><p className="intro">Review your identity and current access level.</p></div><div className="account-avatar" aria-hidden="true">{initials}</div></div>
    {notice && <p className="notice warning mb-5" role="status">{notice}</p>}
    {sessionError && <p className="notice warning mb-5" role="status">{sessionError}</p>}
    {error && <p className="notice error mb-5" role="alert">{error}</p>}
    <div className="account-grid"><section className="panel account-profile"><div className="account-profile-top"><div><p className="eyebrow">SIGNED IN AS</p><h2>{user.name}</h2><p>{user.email}</p></div><span className={`role-badge ${user.role}`}>{user.role === 'admin' ? 'Administrator' : 'Customer'}</span></div>
      <dl className="detail-list"><div><dt>Account status</dt><dd><span className={`status-dot ${user.active ? 'active' : ''}`} aria-hidden="true"/>{user.active ? 'Active' : 'Inactive'}</dd></div><div><dt>Member since</dt><dd>{formatDate(user.createdAt)}</dd></div><div><dt>Last sign in</dt><dd>{formatDate(user.lastLoginAt)}</dd></div></dl>
      <div className="account-actions">{user.role === 'admin' && <Link className="button" to="/admin/users">Manage users →</Link>}<button className="button secondary" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div></section>
      <aside className="panel access-card"><span className="eyebrow">ACCESS LEVEL</span><span className="step-number">{user.role === 'admin' ? 'A' : 'C'}</span><h2>{user.role === 'admin' ? 'Administrator tools enabled' : 'Customer access'}</h2><p>{user.role === 'admin' ? 'You can review users and assign customer or administrator roles. Server authorization still checks every protected request.' : 'You have access to the public planning tools and your account. An administrator can grant elevated access when appropriate.'}</p></aside></div>
  </>;
}
