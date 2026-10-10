import { useState } from 'react';
import { api, errorMessage } from '../api/axios';
import { useApi } from '../hooks/useApi';
import { useTableState } from '../hooks/useTableState';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Feedback } from '../components/Feedback';
import type { AccountRole } from '../auth/AuthContext';

interface Account { id: string; name: string; email: string; role: AccountRole; createdAt: string; }

const searchText = (row: Account) => [row.name, row.email, row.role].join(' ');
const sortValues = {
  name: (row: Account) => row.name.toLowerCase(),
  email: (row: Account) => row.email.toLowerCase(),
  role: (row: Account) => row.role,
  createdAt: (row: Account) => new Date(row.createdAt).getTime()
};

export function AdminUsers() {
  const accounts = useApi<Account[]>('/admin/users');
  const [role, setRole] = useState<'' | AccountRole>('');
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const rows = (accounts.data || []).filter(row => !role || row.role === role);
  const table = useTableState<Account>({ rows, searchText, sortValues, initialSort: { key: 'createdAt', direction: 'desc' } });
  const admins = (accounts.data || []).filter(row => row.role === 'admin').length;

  async function changeRole(account: Account, next: AccountRole) {
    setSaving(account.id); setError(''); setFeedback('');
    try {
      await api.patch('/admin/users/' + account.id + '/role', { role: next });
      setFeedback(account.name + ' is now ' + (next === 'admin' ? 'an administrator' : 'a customer') + '. Their existing sessions were signed out.');
      accounts.retry();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setSaving(''); }
  }

  const columns: DataTableColumn<Account>[] = [
    { key: 'name', header: 'Name', sortable: true, render: row => <>
      <p className="font-medium break-words">{row.name}</p>
      <p className="text-xs text-muted mt-1 sm:hidden break-words">{row.email}</p>
    </> },
    { key: 'email', header: 'Email', sortable: true, hideBelow: 'sm', render: row => <span className="break-words">{row.email}</span> },
    { key: 'createdAt', header: 'Joined', sortable: true, hideBelow: 'lg', render: row => <span className="text-xs text-muted">{new Date(row.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span> },
    { key: 'role', header: 'Role', sortable: true, align: 'right', render: row => <select
      aria-label={'Role for ' + row.email} className="!mt-0 !w-auto !py-1.5 min-w-28"
      disabled={saving === row.id} value={row.role}
      onChange={event => changeRole(row, event.target.value as AccountRole)}>
      <option value="customer">Customer</option><option value="admin">Admin</option>
    </select> }
  ];

  return <section>
    <span className="eyebrow">ADMINISTRATION</span><h1>User access.</h1>
    <p className="intro">Assign customer or administrator access. Changing a role signs that account out everywhere.{accounts.data ? ` ${accounts.data.length} accounts, ${admins} with administrator access.` : ''}</p>

    {error && <p role="alert" className="notice error mb-4">{error}</p>}
    {feedback && <p role="status" className="notice note mb-4">{feedback}</p>}

    <Feedback loading={accounts.loading} error={accounts.error} retry={accounts.retry}/>
    {accounts.data && <>
      {accounts.data.length >= 500 && <p className="notice note mb-4">Showing the 500 most recently created accounts.</p>}
      <DataTable
        table={table} columns={columns} rowKey={row => row.id}
        label="User accounts" searchPlaceholder="Name or email"
        empty="No accounts found."
        filters={<label className="w-full sm:w-40"><span className="text-xs">Role</span>
          <select value={role} onChange={event => setRole(event.target.value as '' | AccountRole)}>
            <option value="">All roles</option><option value="customer">Customer</option><option value="admin">Admin</option>
          </select></label>}/>
    </>}
  </section>;
}