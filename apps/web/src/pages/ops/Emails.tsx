import { useEffect, useState, type FormEvent } from 'react';
import type { EmailsResponse, EmailTemplatesResponse, EmailView } from '@tesseract/shared';
import { api, errorMessage } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useSession } from '../../lib/auth';
import { Link } from '../../lib/router';
import { formatDate } from '../../lib/format';
import { PageHead } from '../console/ConsoleLayout';
import { Icon } from '../../components/Icons';

const STATUS_LABEL: Record<string, string> = { sent: 'Sent', failed: 'Failed', skipped: 'Not sent' };
const PROVIDER_LABEL: Record<string, string> = { resend: 'Resend', smtp: 'SMTP', log: 'Not configured' };

interface Preview {
  subject: string;
  html: string;
  to?: string;
  at?: string;
}

/** Renders an email exactly as sent, isolated from the console's styles. */
function EmailFrame({ preview, onClose }: { preview: Preview; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="mail-preview" role="dialog" aria-modal="true" aria-label={`Preview: ${preview.subject}`} onClick={onClose}>
      <div className="mail-preview__sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <strong>{preview.subject}</strong>
            <small>{preview.to ? `To ${preview.to} · ${formatDate(preview.at)}` : 'Sample data'}</small>
          </div>
          <button type="button" className="sidebar__signout" aria-label="Close preview" onClick={onClose}>
            <Icon.Close />
          </button>
        </header>
        <iframe title="Email preview" srcDoc={preview.html} sandbox="" />
      </div>
    </div>
  );
}

function Templates({ onPreview }: { onPreview: (p: Preview) => void }) {
  const { user } = useSession();
  const [{ data }] = useAsync((signal) => api<EmailTemplatesResponse>('/ops/emails/templates', { auth: true, signal }), []);
  const [to, setTo] = useState(user.email);
  const [template, setTemplate] = useState('order_confirmed');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function open(id: string) {
    try {
      const res = await api<{ subject: string; html: string }>(`/ops/emails/templates/${id}`, { auth: true });
      onPreview(res);
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err) });
    }
  }

  async function sendTest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await api<{ email: EmailView | null }>('/ops/emails/test', { method: 'POST', auth: true, body: { to, template } });
      const s = res.email?.status;
      setResult(
        s === 'sent'
          ? { ok: true, text: `Test sent to ${to}. Check the inbox (and spam folder).` }
          : s === 'skipped'
            ? { ok: false, text: 'Not sent: no email provider is configured. Set RESEND_API_KEY or SMTP_URL on the server.' }
            : { ok: false, text: res.email?.error ? `Failed: ${res.email.error}` : 'The email could not be sent.' }
      );
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="tpl-title">
      <div className="panel__head">
        <h2 id="tpl-title">Templates</h2>
        <span>Click to preview with sample data</span>
      </div>
      <ul className="tpl-grid">
        {data?.templates.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => open(t.id)}>
              <Icon.Mail width={18} height={18} />
              <strong>{t.name}</strong>
              <small>{t.description}</small>
            </button>
          </li>
        ))}
      </ul>
      <form className="test-send" onSubmit={sendTest}>
        <div className="c-field">
          <label htmlFor="test-template">Send a test of</label>
          <select id="test-template" className="c-input" value={template} onChange={(e) => setTemplate(e.target.value)}>
            {data?.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="c-field">
          <label htmlFor="test-to">To</label>
          <input id="test-to" className="c-input" type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <button type="submit" className="c-btn c-btn--primary" disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          Send test
        </button>
      </form>
      {result && (
        <div className={result.ok ? 'c-alert c-alert--ok' : 'c-alert'} role="status" style={{ marginTop: 14 }}>
          {result.text}
        </div>
      )}
    </section>
  );
}

export default function Emails() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [resending, setResending] = useState('');
  const [error, setError] = useState('');
  const [{ loading, data, error: loadError }, setState] = useAsync(
    (signal) => api<EmailsResponse>(`/ops/emails?page=${page}${status ? `&status=${status}` : ''}`, { auth: true, signal }),
    [status, page]
  );

  async function view(id: string) {
    try {
      const res = await api<{ email: EmailView; html: string }>(`/ops/emails/${id}`, { auth: true });
      setPreview({ subject: res.email.subject, html: res.html, to: res.email.to, at: res.email.at });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function resend(id: string) {
    setResending(id);
    setError('');
    try {
      const res = await api<{ email: EmailView }>(`/ops/emails/${id}/resend`, { method: 'POST', auth: true });
      setState((s) => (s.data ? { ...s, data: { ...s.data, items: [res.email, ...s.data.items], total: s.data.total + 1 } } : s));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending('');
    }
  }

  return (
    <>
      <PageHead title="Emails" subtitle="Everything the platform sends customers and the print room, kept for 180 days.">
        {data && (
          <span className={`provider provider--${data.provider}`}>
            <span className="dot" aria-hidden="true" /> {PROVIDER_LABEL[data.provider] ?? data.provider}
          </span>
        )}
      </PageHead>

      {data?.provider === 'log' && (
        <div className="c-alert" role="status" style={{ marginBottom: 20 }}>
          Emails are not being delivered. Set <code>RESEND_API_KEY</code> or <code>SMTP_URL</code> (and <code>EMAIL_FROM</code>) on the API server, then restart it.
          Until then every email is recorded here as “Not sent”.
        </div>
      )}

      <Templates onPreview={setPreview} />

      <div className="toolbar" style={{ marginTop: 28 }}>
        <div className="tabs" role="group" aria-label="Filter by delivery status">
          {[
            ['', 'All'],
            ['sent', 'Sent'],
            ['failed', 'Failed'],
            ['skipped', 'Not sent']
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={status === id}
              onClick={() => {
                setStatus(id);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(loadError || error) && <div className="c-alert" role="alert">{loadError || error}</div>}
      {loading && !data && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading emails</p>}
      {data && data.items.length === 0 && (
        <div className="table-wrap">
          <div className="empty">
            <strong>No emails yet</strong>
            Order confirmations, delivery updates and receipts will be listed here.
          </div>
        </div>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="c-table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Email</th>
                  <th scope="col">Recipient</th>
                  <th scope="col">Order</th>
                  <th scope="col">When</th>
                  <th scope="col" className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={`mail-status mail-status--${m.status}`}>{STATUS_LABEL[m.status]}</span>
                    </td>
                    <td>
                      <span className="clip">{m.subject}</span>
                      {m.error && <div className="muted clip" title={m.error}>{m.error}</div>}
                    </td>
                    <td className="muted">{m.to}</td>
                    <td>{m.orderRef ? <Link to={`/console/ops/orders/${m.orderRef}`} className="ref">{m.orderRef}</Link> : <span className="muted">—</span>}</td>
                    <td className="muted">{formatDate(m.at)}</td>
                    <td className="num">
                      <div className="row-actions">
                        <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={() => view(m.id)}>
                          View
                        </button>
                        <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={() => resend(m.id)} disabled={resending === m.id}>
                          {resending === m.id ? 'Sending' : 'Resend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span>
              {data.total} {data.total === 1 ? 'email' : 'emails'}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="c-btn c-btn--quiet c-btn--small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>
                Page {data.page} of {data.pages}
              </span>
              <button type="button" className="c-btn c-btn--quiet c-btn--small" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {preview && <EmailFrame preview={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
