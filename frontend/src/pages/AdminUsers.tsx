import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/axios';
import type { AccountRole } from '../auth/AuthContext';
interface Account { id: string; name: string; email: string; role: AccountRole; createdAt: string; }
export function AdminUsers() {
  const [users, setUsers] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  async function loadUsers() {
    setError('');
    try { const response = await api.get<Account[]>('/admin/users'); setUsers(response.data); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadUsers(); }, []);
  async function changeRole(user: Account, role: AccountRole) {
    setSaving(user.id); setError('');
    try {
      const response = await api.patch<Account>('/admin/users/' + user.id + '/role', { role });
      setUsers(current => current.map(item => item.id === user.id ? response.data : item));
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setSaving(''); }
  }
  return <section>
    <span className="eyebrow">ADMINISTRATION</span><h1>User access.</h1>
    <p className="intro">View accounts and assign customer or administrator access. Role changes revoke that account’s existing sessions.</p>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {loading ? <p role="status" className="text-muted">Loading accounts…</p> : <div className="panel overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-stroke text-muted"><th className="py-3 pr-4">Name</th><th className="py-3 pr-4">Email</th><th className="py-3 pr-4">Joined</th><th className="py-3">Role</th></tr></thead>
        <tbody>{users.map(user => <tr key={user.id} className="border-b last:border-0 border-stroke">
          <td className="py-4 pr-4 font-medium">{user.name}</td><td className="py-4 pr-4">{user.email}</td>
          <td className="py-4 pr-4 text-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
          <td className="py-4"><select aria-label={'Role for ' + user.email} className="mt-0 min-w-32" disabled={saving === user.id} value={user.role} onChange={event => void changeRole(user, event.target.value as AccountRole)}>
            <option value="customer">Customer</option><option value="admin">Admin</option></select></td>
        </tr>)}</tbody>
      </table>
      {!users.length && <p className="text-muted py-4">No accounts found.</p>}
      {users.length >= 500 && <p className="text-muted text-xs mt-4">Showing the 500 most recently created accounts.</p>}
    </div>}
  </section>;
}
