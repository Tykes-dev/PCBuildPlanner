import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/axios';
import { useAuth } from '../hooks/AuthContext';
import { loginSchema, type LoginInput } from '../schemas/auth';

export function Login() {
  const { user, loading, login } = useAuth();
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  const destination = state?.from?.startsWith('/') ? state.from : '/account';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  async function submit(input: LoginInput) {
    setError('');
    try { await login(input); navigate(destination, { replace: true }); }
    catch (requestError) { setError(errorMessage(requestError)); }
  }

  if (!loading && user) return <Navigate to="/account" replace/>;
  return <section className="auth-layout"><div className="auth-card panel"><span className="eyebrow">WELCOME BACK</span><h1>Sign in to your account.</h1><p className="intro">Continue with saved account features and your assigned access level.</p>
    <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
      <label>Email address<input type="email" autoComplete="email" inputMode="email" autoFocus {...register('email')}/>{errors.email && <span className="field-error">{errors.email.message}</span>}</label>
      <label>Password<input type="password" autoComplete="current-password" {...register('password')}/>{errors.password && <span className="field-error">{errors.password.message}</span>}</label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="button auth-submit" disabled={isSubmitting || loading}>{isSubmitting ? 'Signing in…' : 'Sign in →'}</button>
    </form>
    <p className="auth-switch">New to PC Build Planner? <Link to="/register">Create an account</Link></p></div>
    <aside className="auth-aside"><span className="step-number">01</span><p className="eyebrow">YOUR WORKSPACE</p><h2>One account. The right level of access.</h2><p>Customer accounts keep planning features close. Administrator tools appear only for approved team members.</p><ul><li><span aria-hidden="true">✓</span> Secure HTTP-only session</li><li><span aria-hidden="true">✓</span> Server-checked permissions</li><li><span aria-hidden="true">✓</span> No public admin signup</li></ul></aside>
  </section>;
}
