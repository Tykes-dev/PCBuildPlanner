import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { useAuth } from '../auth/AuthContext';

export function AuthPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const register = params.get('mode') === 'register';
  const next = params.get('next');
  const customerDestination = next && (['/builder', '/recommend', '/builds'].includes(next) || /^\/builds\/[a-f0-9]{24}$/.test(next)) ? next : '/';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.role === 'admin' ? '/admin/reports' : customerDestination} replace/>;

  function changeMode(mode: 'login' | 'register', clearFeedback = true) {
    const updated = new URLSearchParams(params);
    if (mode === 'register') updated.set('mode', mode);
    else updated.delete('mode');
    setParams(updated, { replace: true });
    setPassword(''); setConfirmation('');
    if (clearFeedback) { setError(''); setSuccess(''); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(''); setSuccess('');
    if (register && !name.trim()) { setError('Enter your full name.'); return; }
    if (register && password !== confirmation) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      if (register) {
        await api.post('/auth/register', { name: name.trim(), email: email.trim(), password });
        changeMode('login', false);
        setSuccess('Account created. Log in below to start planning your build.');
      } else {
        const account = await login(email.trim(), password);
        navigate(account.role === 'admin' ? '/admin/reports' : customerDestination, { replace: true });
      }
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="panel max-w-lg mx-auto">
    <span className="eyebrow">YOUR NEXT BUILD STARTS HERE</span>
    <h1 className="!text-3xl">Your account.</h1>
    <p className="intro">Log in or create a customer account to plan a PC. Administrators use the same login form.</p>
    <div className="flex gap-2 mb-6" aria-label="Choose account action">
      <button type="button" className={'button flex-1' + (register ? ' secondary' : '')} aria-pressed={!register} onClick={() => changeMode('login')} disabled={busy}>Log in</button>
      <button type="button" className={'button flex-1' + (!register ? ' secondary' : '')} aria-pressed={register} onClick={() => changeMode('register')} disabled={busy}>Register</button>
    </div>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {success && <p role="status" className="notice mb-5">{success}</p>}
    <h2 className="mb-4">{register ? 'Create your customer account' : 'Welcome back'}</h2>
    <form onSubmit={submit} className="grid gap-5">
      {register && <label>Full name<input autoComplete="name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} disabled={busy}/></label>}
      <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy}/></label>
      <div><label htmlFor="account-password">Password</label><input id="account-password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} aria-describedby={register ? 'password-help' : undefined}/>
        {register && <span id="password-help" className="text-xs text-muted block mt-2">Use 12–128 characters. A long, unique passphrase works well.</span>}</div>
      {register && <label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy}/></label>}
      <button type="submit" className="button" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create customer account' : 'Log in'}</button>
    </form>
    <Link to="/" className="text-sm text-muted underline underline-offset-4 inline-block mt-6">Back to overview</Link>
    <Link to="/components" className="text-sm text-muted underline underline-offset-4 inline-block ml-5 mt-6">Browse components</Link>
  </section>;
}


