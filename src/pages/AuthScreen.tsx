import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorNote } from '../components/ui';
import { login, openDemo, signup } from '../state/store';

export function LoginPage() {
  return <AuthScreen mode="login" />;
}

export function SignupPage() {
  return <AuthScreen mode="signup" />;
}

function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const isSignup = mode === 'signup';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (isSignup && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setPending(true);
    const result = isSignup ? await signup({ name, email, password }) : await login({ email, password });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate(isSignup ? '/onboarding' : '/');
  }

  async function onDemo() {
    setPending(true);
    const result = await openDemo();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate('/');
  }

  return (
    <div className="auth">
      <section className="auth-story">
        <p className="brand">
          <span className="brand-mark" aria-hidden="true" />
          MoneyRes
        </p>
        <h1>Know which rupee to send today.</h1>
        <p className="lede">
          A private desk for EMIs, gold, home, vehicle loans, and credit cards. Record what you pay, and see the
          interest that payment avoids.
        </p>
        <ul>
          <li>What you still owe, and how much of each loan is already cleared.</li>
          <li>The next due date, and the extra payment that cuts the most interest.</li>
          <li>Salary, spending, and savings goals on the same ledger.</li>
        </ul>
      </section>
      <section className="auth-panel">
        <p className="mobile-brand brand">
          <span className="brand-mark" aria-hidden="true" />
          MoneyRes
        </p>
        <form onSubmit={onSubmit} className="stack">
          <header>
            <p className="kicker">{isSignup ? 'Create an account' : 'Welcome back'}</p>
            <h2>{isSignup ? 'Open your desk' : 'Sign in'}</h2>
          </header>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          {isSignup ? (
            <Label text="Name">
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </Label>
          ) : null}
          <Label text="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </Label>
          <Label text="Password">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </Label>
          {isSignup ? (
            <Label text="Confirm password">
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Label>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Please wait' : isSignup ? 'Create account' : 'Sign in'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onDemo} disabled={pending}>
            Open the sample desk
          </button>
          <p className="fine">
            {isSignup ? (
              <>
                Already have a desk? <Link to="/login">Sign in</Link>
              </>
            ) : (
              <>
                New here? <Link to="/signup">Create an account</Link>
              </>
            )}
          </p>
          <p className="fine">The sample desk signs you in as Meera. Password demo1234 if you return later.</p>
        </form>
      </section>
    </div>
  );
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{text}</span>
      {children}
    </label>
  );
}
