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
    if (state.status === 'signed-in') navigate(state.user.role === 'operator' ? '/console/ops' : '/console', { replace: true });
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
    <div className="console console--light">
      <div className="login">
        <div className="login__bg" aria-hidden="true">
          <img src="/images/bridge.jpg" alt="" />
        </div>

        <main className="login__center">
          <form className="login__card" onSubmit={submit}>
            <Link to="/" className="login__brand" aria-label="Tesseract Prints home">
              <Wordmark size={34} fill="#2B1442" line="#FFFFFF" />
            </Link>
            <h1>Sign in to your console</h1>
            <p>Place orders, follow deliveries and manage your organisation.</p>
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
              <button type="submit" className="c-btn c-btn--primary c-btn--block" disabled={busy} style={{ minHeight: 48 }}>
                {busy && <span className="spinner" aria-hidden="true" />}
                {busy ? 'Signing in' : 'Sign in'}
              </button>
            </div>
            <p className="login__help">
              Need access? Your organisation’s owner can add you, or <Link to="/#contact">speak with us</Link>.
            </p>
          </form>
        </main>

        <footer className="login__foot">
          <p>
            Every document handled by one person, sealed by hand, and erased once it reaches you.
            <span>The Tesseract Prints standard · Sessions end after 8 hours</span>
          </p>
          <nav aria-label="Other services">
            <Link to="/express">Express printing</Link>
            <Link to="/">Website</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
