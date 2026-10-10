import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const COPY = {
  login: { title: 'Welcome back', cta: 'Log in', switchText: 'New to Flowcraft?', switchTo: '/register', switchLabel: 'Create an account' },
  register: { title: 'Create your free account', cta: 'Sign up', switchText: 'Already have an account?', switchTo: '/login', switchLabel: 'Log in' },
};

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/app';
  if (auth.user) return <Navigate to={from} replace />;

  const copy = COPY[mode];
  const update = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      if (mode === 'login') await auth.login({ email: form.email, password: form.password });
      else await auth.register(form);
      navigate(from, { replace: true });
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fieldErrors, form: err.message } : { form: 'Something went wrong' });
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={onSubmit} noValidate>
        <h1>{copy.title}</h1>
        {mode === 'login' && (
          <p className="muted small">
            Demo: <code>demo@flowcraft.app</code> / <code>demo12345</code> (after <code>npm run seed</code>)
          </p>
        )}
        {errors.form && <div className="alert">{errors.form}</div>}

        {mode === 'register' && (
          <Field label="Name" error={errors.name}>
            <input value={form.name} onChange={update('name')} autoComplete="name" autoFocus />
          </Field>
        )}
        <Field label="Email" error={errors.email}>
          <input type="email" value={form.email} onChange={update('email')} autoComplete="email" autoFocus={mode === 'login'} />
        </Field>
        <Field label="Password" error={errors.password} hint={mode === 'register' ? 'At least 8 characters' : undefined}>
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </Field>

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : copy.cta}
        </button>
        <p className="muted small center">
          {copy.switchText}{' '}
          <Link to={copy.switchTo} state={location.state}>
            {copy.switchLabel}
          </Link>
        </p>
      </form>
    </div>
  );
}
