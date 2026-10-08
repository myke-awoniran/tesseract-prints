import { useState } from 'react';
import { formatNaira, type InvoiceResponse, type InvoiceView } from '@tesseract/shared';
import { api, errorMessage } from '../../lib/api';
import { Link, type RouteParams } from '../../lib/router';
import { useAsync } from '../../lib/useAsync';
import { InvoiceSheet } from '../../components/InvoiceSheet';
import { PageHead } from '../console/ConsoleLayout';
import { useLiveReload } from '../../lib/realtime';

function MarkPaid({ invoice, onChanged }: { invoice: InvoiceView; onChanged: (i: InvoiceView) => void }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<'bank_transfer' | 'other'>('bank_transfer');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await api<InvoiceResponse>(`/ops/invoices/${invoice.number}/mark-paid`, { method: 'POST', auth: true, body: { method, note } });
      onChanged(res.invoice);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="c-btn c-btn--primary c-btn--small" onClick={() => setOpen(true)}>
        Record a payment
      </button>
    );
  }
  return (
    <div className="ops-form">
      <div className="c-field">
        <label htmlFor="paid-method">How was it paid?</label>
        <select id="paid-method" className="c-input" value={method} onChange={(e) => setMethod(e.target.value as 'bank_transfer' | 'other')}>
          <option value="bank_transfer">Bank transfer</option>
          <option value="other">Other (cheque, cash…)</option>
        </select>
      </div>
      <div className="c-field">
        <label htmlFor="paid-note">Note (internal)</label>
        <input id="paid-note" className="c-input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. GTBank transfer, 8 Oct, ref 0049213" />
      </div>
      <p className="muted-note">Only record money that has arrived in the account. The client is emailed a receipt.</p>
      {error && <div className="c-alert" role="alert">{error}</div>}
      <div className="ops-form__actions">
        <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="button" className="c-btn c-btn--primary c-btn--small" onClick={save} disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          Mark {formatNaira(invoice.total)} paid
        </button>
      </div>
    </div>
  );
}

function VoidInvoice({ invoice, onChanged }: { invoice: InvoiceView; onChanged: (i: InvoiceView) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await api<InvoiceResponse>(`/ops/invoices/${invoice.number}/void`, { method: 'POST', auth: true, body: { reason } });
      onChanged(res.invoice);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="c-btn c-btn--quiet c-btn--small danger-link" onClick={() => setOpen(true)}>
        Void invoice
      </button>
    );
  }
  return (
    <div className="danger-zone">
      <div className="c-field">
        <label htmlFor="void-reason">Reason (internal)</label>
        <textarea id="void-reason" className="c-input" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Bundle B was reprinted at our cost." />
      </div>
      <p className="muted-note">
        The orders return to unbilled. Fix them (for example, cancel the wrong one), then use “Bill last month now” to issue a corrected invoice.
      </p>
      {error && <div className="c-alert" role="alert">{error}</div>}
      <div className="ops-form__actions">
        <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={() => setOpen(false)}>
          Keep invoice
        </button>
        <button type="button" className="c-btn c-btn--danger c-btn--small" onClick={save} disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          Void invoice
        </button>
      </div>
    </div>
  );
}

export default function OpsInvoiceDetail({ params }: { params: RouteParams }) {
  const number = (params.number ?? '').toUpperCase();
  const live = useLiveReload({ orders: false, invoices: true });
  const [{ loading, data, error }, setState] = useAsync(
    (signal) => api<InvoiceResponse>(`/ops/invoices/${encodeURIComponent(number)}`, { auth: true, signal }),
    [number, live]
  );
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [resending, setResending] = useState(false);
  const invoice = data?.invoice;

  const changed = (next: InvoiceView) => setState((s) => ({ ...s, data: s.data ? { ...s.data, invoice: next } : s.data }));

  async function resend() {
    setResending(true);
    setNotice(null);
    try {
      const res = await api<{ sent: number }>(`/ops/invoices/${number}/resend`, { method: 'POST', auth: true });
      setNotice({ ok: true, text: `Sent to ${res.sent === 1 ? invoice?.billingEmail || 'the organisation owner' : `${res.sent} owners`}.` });
    } catch (err) {
      setNotice({ ok: false, text: errorMessage(err) });
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <PageHead title={`Invoice ${number}`} subtitle={invoice ? `${invoice.organization.name} · ${invoice.period.label}` : ''}>
        <Link to="/console/ops/invoices" className="c-btn c-btn--quiet">All invoices</Link>
      </PageHead>
      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !invoice && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading invoice</p>}
      {invoice && (
        <div className="detail">
          <section className="panel">
            <InvoiceSheet invoice={invoice} orderLink={(ref) => `/console/ops/orders/${ref}`} />
          </section>
          <section className="panel" style={{ alignSelf: 'start' }}>
            <div className="panel__head">
              <h2>Payment</h2>
            </div>
            <dl className="kv kv--stacked">
              <div>
                <dt>Billing email</dt>
                <dd>{invoice.billingEmail || 'None set: emails go to the organisation’s owners'}</dd>
              </div>
              {invoice.payment.note && (
                <div>
                  <dt>Note</dt>
                  <dd>{invoice.payment.note}</dd>
                </div>
              )}
            </dl>
            {notice && <div className={notice.ok ? 'c-alert c-alert--ok' : 'c-alert'} role="status" style={{ marginTop: 16 }}>{notice.text}</div>}
            <div style={{ display: 'grid', gap: 12, marginTop: 20, justifyItems: 'start' }}>
              {invoice.status === 'open' && <MarkPaid invoice={invoice} onChanged={changed} />}
              {invoice.status !== 'void' && (
                <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={resend} disabled={resending}>
                  {resending && <span className="spinner" aria-hidden="true" />}
                  {invoice.status === 'paid' ? 'Resend receipt' : 'Resend invoice'}
                </button>
              )}
              {invoice.status === 'open' && <VoidInvoice invoice={invoice} onChanged={changed} />}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
