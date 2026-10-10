import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/axios';
import { useAuth } from '../auth/AuthContext';
import { authSchema, type AuthInput } from '../schemas/auth';

export function AuthPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const register = params.get('mode') === 'register';
  const next = params.get('next');
  const customerDestination = next && (['/builder', '/recommend', '/builds'].includes(next) || /^\/builds\/[a-f0-9]{24}$/.test(next)) ? next : '/';
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { register: field, handleSubmit, reset, getValues, formState: { errors, isSubmitting, isValid } } = useForm<AuthInput>({
    resolver: zodResolver(authSchema(register)),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' }
  });

  // Switching between logging in and registering changes which rules apply, so
  // the entered password is cleared and the resolver is re-evaluated.
  useEffect(() => { reset({ ...getValues(), password: '', confirmPassword: '' }); }, [register, reset, getValues]);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin/reports' : customerDestination} replace/>;

  function changeMode(mode: 'login' | 'register', clearFeedback = true) {
    const updated = new URLSearchParams(params);
    if (mode === 'register') updated.set('mode', mode);
    else updated.delete('mode');
    setParams(updated, { replace: true });
    if (clearFeedback) { setError(''); setSuccess(''); }
  }

  async function submit(values: AuthInput) {
    setError(''); setSuccess('');
    try {
      if (register) {
        await api.post('/auth/register', { name: values.name.trim(), email: values.email.trim(), password: values.password });
        changeMode('login', false);
        setSuccess('Account created. Log in below to start planning your build.');
      } else {
        const account = await login(values.email.trim(), values.password);
        navigate(account.role === 'admin' ? '/admin/reports' : customerDestination, { replace: true });
      }
    } catch (failure) { setError(errorMessage(failure)); }
  }

  return <section className="panel max-w-lg mx-auto">
    <span className="eyebrow">YOUR NEXT BUILD STARTS HERE</span>
    <h1 className="!text-3xl">Your account.</h1>
    <p className="intro">Log in or create a customer account to plan a PC. Administrators use the same login form.</p>
    <div className="flex gap-2 mb-6" aria-label="Choose account action">
      <button type="button" className={'button flex-1' + (register ? ' secondary' : '')} aria-pressed={!register} onClick={() => changeMode('login')} disabled={isSubmitting}>Log in</button>
      <button type="button" className={'button flex-1' + (!register ? ' secondary' : '')} aria-pressed={register} onClick={() => changeMode('register')} disabled={isSubmitting}>Register</button>
    </div>
    {error && <p role="alert" className="notice error mb-5">{error}</p>}
    {success && <p role="status" className="notice mb-5">{success}</p>}
    <h2 className="mb-4">{register ? 'Create your customer account' : 'Welcome back'}</h2>
    <form onSubmit={handleSubmit(submit)} className="grid gap-5" noValidate>
      {register && <div>
        <label htmlFor="account-name">Full name</label>
        <input id="account-name" autoComplete="name" maxLength={80} disabled={isSubmitting}
          aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} {...field('name')}/>
        {errors.name && <p id="name-error" role="alert" className="field-error">{errors.name.message}</p>}
      </div>}
      <div>
        <label htmlFor="account-email">Email address</label>
        <input id="account-email" type="email" autoComplete="email" maxLength={254} disabled={isSubmitting}
          aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} {...field('email')}/>
        {errors.email && <p id="email-error" role="alert" className="field-error">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="account-password">Password</label>
        <input id="account-password" type="password" autoComplete={register ? 'new-password' : 'current-password'} maxLength={128} disabled={isSubmitting}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={[register && 'password-help', errors.password && 'password-error'].filter(Boolean).join(' ') || undefined} {...field('password')}/>
        {register && <span id="password-help" className="text-xs text-muted block mt-2">Use 12–128 characters. A long, unique passphrase works well.</span>}
        {errors.password && <p id="password-error" role="alert" className="field-error">{errors.password.message}</p>}
      </div>
      {register && <div>
        <label htmlFor="account-confirm">Confirm password</label>
        <input id="account-confirm" type="password" autoComplete="new-password" maxLength={128} disabled={isSubmitting}
          aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined} {...field('confirmPassword')}/>
        {errors.confirmPassword && <p id="confirm-error" role="alert" className="field-error">{errors.confirmPassword.message}</p>}
      </div>}
      <button type="submit" className="button" disabled={isSubmitting || !isValid}>{isSubmitting ? 'Please wait…' : register ? 'Create customer account' : 'Log in'}</button>
    </form>
    <Link to="/" className="text-sm text-muted underline underline-offset-4 inline-block mt-6">Back to overview</Link>
    <Link to="/components" className="text-sm text-muted underline underline-offset-4 inline-block ml-5 mt-6">Browse components</Link>
  </section>;
}