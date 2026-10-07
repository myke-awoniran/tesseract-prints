import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { Link, useRouter } from '../../lib/router';
import { errorMessage } from '../../lib/api';
import { Wordmark } from '../../components/Logo';

export default function Login() {
  const { login, state } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === 'signed-in') navigate(state.user.role === 'operator' ? '/console/queue' : '/console', { replace: true });
  }, [state, navigate]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="console">
      <div className="login">
        <div className="login__form-side">
          <Link to="/" className="sidebar__brand" aria-label="Tesseract Prints home">
            <Wordmark size={34} fill="#4B2384" line="#FFFFFF" />
          </Link>

          <form className="login__form" onSubmit={submit}>
            <h1>Client console</h1>
            <p>Sign in to place orders, follow deliveries and manage your organisation.</p>
            <div className="login__fields">
              <div className="c-field">
                <label htmlFor="email">Work email</label>
                <input id="email" type="email" className="c-input" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="c-field">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" className="c-input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && (
                <div className="c-alert" role="alert">
                  {error}
                </div>
              )}
              <button type="submit" className="c-btn c-btn--primary c-btn--block" disabled={busy} style={{ minHeight: 50 }}>
                {busy && <span className="spinner" aria-hidden="true" />}
                {busy ? 'Signing in' : 'Sign in'}
              </button>
              <p style={{ color: 'var(--c-muted)', fontSize: 14 }}>
                Need access? Your organisation’s owner can add you, or <Link to="/#contact" style={{ color: 'var(--c-lilac)' }}>speak with us</Link>.
              </p>
            </div>
          </form>

          <div className="login__foot">
            <span>Sessions end after 8 hours.</span>
            <Link to="/express" style={{ color: 'var(--c-muted)' }}>Express printing, no account needed</Link>
          </div>
        </div>
        <div className="login__visual" aria-hidden="true">
          <img src="/images/bridge.jpg" alt="" />
          <div className="login__quote">
            <p>Every document handled by one person, sealed by hand, and erased once it reaches you.</p>
            <span>The Tesseract Prints standard</span>
          </div>
        </div>
      </div>
    </div>
  );
}
