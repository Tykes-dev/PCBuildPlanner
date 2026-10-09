import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../api/axios';
import { useAuth } from '../hooks/AuthContext';
import type { AuthUser, Role } from '../types';

interface UsersEnvelope { users: AuthUser[]; }
interface UserEnvelope { user: AuthUser; }

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function AdminUsers() {
  const { user: signedInUser, refresh } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, Role>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [savingId, setSavingId] = useState('');
  const [rowFeedback, setRowFeedback] = useState<Record<string, string>>({});

  const loadUsers = useCallback((signal: AbortSignal) => {
    setLoading(true); setError('');
    api.get<UsersEnvelope>('/admin/users', { signal }).then(response => {
      if (signal.aborted) return;
      setUsers(response.data.users);
      setDraftRoles(Object.fromEntries(response.data.users.map(user => [user._id, user.role])) as Record<string, Role>);
    }).catch(requestError => { if (!signal.aborted) setError(errorMessage(requestError)); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
  }, []);

  useEffect(() => { const controller = new AbortController(); loadUsers(controller.signal); return () => controller.abort(); }, [loadUsers, attempt]);

  const counts = useMemo(() => ({ admins: users.filter(user => user.role === 'admin').length, customers: users.filter(user => user.role === 'customer').length, active: users.filter(user => user.active).length }), [users]);

  async function saveRole(account: AuthUser) {
    const role = draftRoles[account._id];
    if (!role || role === account.role) return;
    setSavingId(account._id); setRowFeedback(current => ({ ...current, [account._id]: '' }));
    try {
      const response = await api.patch<UserEnvelope>(`/admin/users/${account._id}/role`, { role });
      setUsers(current => current.map(user => user._id === account._id ? response.data.user : user));
      setDraftRoles(current => ({ ...current, [account._id]: response.data.user.role }));
      setRowFeedback(current => ({ ...current, [account._id]: 'Role updated.' }));
      if (signedInUser?._id === account._id) await refresh();
    } catch (requestError) { setRowFeedback(current => ({ ...current, [account._id]: errorMessage(requestError) })); }
    finally { setSavingId(''); }
  }

  return <><div className="admin-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>User access.</h1><p className="intro">Review registered accounts and assign the minimum role each person needs.</p></div>{!loading && !error && <div className="admin-stats" aria-label="User counts"><span><strong>{users.length}</strong> total</span><span><strong>{counts.admins}</strong> admins</span><span><strong>{counts.customers}</strong> customers</span><span><strong>{counts.active}</strong> active</span></div>}</div>
    <div className="notice note admin-note"><strong>Role changes take effect immediately.</strong> New public registrations always start as customers. The API makes the final authorization decision.</div>
    {loading && <section className="panel auth-loading" role="status"><h2>Loading user accounts…</h2></section>}
    {error && <div className="notice error" role="alert"><p>{error}</p><button className="button secondary mt-3" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
    {!loading && !error && users.length === 0 && <section className="panel empty-state"><span className="step-number">00</span><h2>No users found.</h2><p>Register an account or run the documented administrator setup.</p></section>}
    {!loading && !error && users.length > 0 && <section className="panel user-directory" aria-label="Registered users"><div className="user-directory-head"><span>User</span><span>Activity</span><span>Role</span><span>Action</span></div>{users.map(account => {
      const changed = draftRoles[account._id] !== account.role;
      const saving = savingId === account._id;
      const feedback = rowFeedback[account._id];
      const feedbackIsError = feedback && feedback !== 'Role updated.';
      const initials = account.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';
      return <article className="user-row" key={account._id}><div className="user-identity"><span className="mini-avatar" aria-hidden="true">{initials}</span><div><strong>{account.name}</strong><span>{account.email}</span><small><span className={`status-dot ${account.active ? 'active' : ''}`} aria-hidden="true"/>{account.active ? 'Active account' : 'Inactive account'}</small></div></div><div className="user-activity"><span>Joined {formatDate(account.createdAt)}</span><small>Last sign in: {formatDate(account.lastLoginAt)}</small></div><label className="role-field"><span className="sr-only">Role for {account.name}</span><select value={draftRoles[account._id] ?? account.role} disabled={saving} onChange={event => { setDraftRoles(current => ({ ...current, [account._id]: event.target.value as Role })); setRowFeedback(current => ({ ...current, [account._id]: '' })); }}><option value="customer">Customer</option><option value="admin">Administrator</option></select></label><div className="role-action"><button className="button secondary" disabled={!changed || saving} onClick={() => saveRole(account)}>{saving ? 'Saving…' : 'Save role'}</button>{feedback && <small className={feedbackIsError ? 'row-error' : 'row-success'} role="status">{feedback}</small>}</div></article>;
    })}</section>}
  </>;
}
