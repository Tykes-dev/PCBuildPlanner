import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/axios';
import { useAuth } from '../hooks/AuthContext';
import { registerSchema, type RegisterInput } from '../schemas/auth';

export function Register() {
  const { user, loading, register: registerUser } = useAuth();
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { name: '', email: '', password: '', confirmPassword: '' } });

  async function submit({ name, email, password }: RegisterInput) {
    setError('');
    try { await registerUser({ name, email, password }); navigate('/account', { replace: true }); }
    catch (requestError) { setError(errorMessage(requestError)); }
  }

  if (!loading && user) return <Navigate to="/account" replace/>;
  return <section className="auth-layout"><div className="auth-card panel"><span className="eyebrow">CREATE ACCOUNT</span><h1>Start your workspace.</h1><p className="intro">Register as a customer. Administrator access is granted separately by an existing administrator.</p>
    <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
      <label>Full name<input type="text" autoComplete="name" autoFocus {...register('name')}/>{errors.name && <span className="field-error">{errors.name.message}</span>}</label>
      <label>Email address<input type="email" autoComplete="email" inputMode="email" {...register('email')}/>{errors.email && <span className="field-error">{errors.email.message}</span>}</label>
      <div className="form-pair"><label>Password<input type="password" autoComplete="new-password" {...register('password')}/>{errors.password && <span className="field-error">{errors.password.message}</span>}</label><label>Confirm password<input type="password" autoComplete="new-password" {...register('confirmPassword')}/>{errors.confirmPassword && <span className="field-error">{errors.confirmPassword.message}</span>}</label></div>
      <p className="form-hint">Use 8–72 characters. Your password is never displayed back to you.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="button auth-submit" disabled={isSubmitting || loading}>{isSubmitting ? 'Creating account…' : 'Create account →'}</button>
    </form>
    <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p></div>
    <aside className="auth-aside"><span className="step-number">02</span><p className="eyebrow">CLEAR BY DESIGN</p><h2>Your public signup is always a customer account.</h2><p>Roles are enforced by the API, not by a browser-only switch. That keeps administrator features limited to approved users.</p><div className="role-preview"><span className="role-badge customer">Customer</span><span>Plan, compare, and manage your account</span></div></aside>
  </section>;
}
