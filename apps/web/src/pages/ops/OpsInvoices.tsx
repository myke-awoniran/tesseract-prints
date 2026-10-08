import { useState } from 'react';
import { formatNaira, type OpsInvoicesResponse, type RunBillingResponse } from '@tesseract/shared';
import { api, errorMessage } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Link } from '../../lib/router';
import { InvoiceStatus } from '../../components/InvoiceSheet';
import { PageHead } from '../console/ConsoleLayout';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
  { id: 'void', label: 'Void' }
];

export default function OpsInvoices() {
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [{ loading, data, error }] = useAsync(
    (signal) => api<OpsInvoicesResponse>(`/ops/invoices${status ? `?status=${status}` : ''}`, { auth: true, signal }),
    [status, reload]
  );

  async function runBilling() {
    setRunning(true);
    setNotice(null);
    try {
      const res = await api<RunBillingResponse>('/ops/billing/run', { method: 'POST', auth: true });
      setNotice({
        ok: true,
        text: res.created
          ? `Issued ${res.created} ${res.created === 1 ? 'invoice' : 'invoices'} for ${res.period.label} and emailed them.`
          : `Nothing new to bill for ${res.period.label}. Every organisation with orders already has its invoice.`
      });
      setReload((n) => n + 1);
    } catch (err) {
      setNotice({ ok: false, text: errorMessage(err) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHead title="Invoices" subtitle="Account clients are billed monthly. Invoices go out automatically on the 1st, due in 14 days, with one reminder when overdue.">
        <button type="button" className="c-btn c-btn--primary" onClick={runBilling} disabled={running}>
          {running ? 'Billing…' : 'Bill last month now'}
        </button>
      </PageHead>
      {notice && <div className={notice.ok ? 'c-alert c-alert--ok' : 'c-alert'} role="status">{notice.text}</div>}
      {error && <div className="c-alert" role="alert">{error}</div>}

      {data && (
        <dl className="figures figures--3">
          <div className="figure">
            <dt>Outstanding</dt>
            <dd style={{ fontSize: 30 }}>{formatNaira(data.totals.outstanding)}</dd>
            <small>Open invoices</small>
          </div>
          <div className="figure">
            <dt>Overdue</dt>
            <dd style={{ fontSize: 30 }}>{formatNaira(data.totals.overdue)}</dd>
            <small>Past their due date</small>
          </div>
          <div className="figure">
            <dt>Collected this month</dt>
            <dd style={{ fontSize: 30 }}>{formatNaira(data.totals.paidThisMonth)}</dd>
            <small>Invoices paid since the 1st</small>
          </div>
        </dl>
      )}

      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={status === f.id} onClick={() => setStatus(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading invoices</p>}
      {data && (
        <div className="table-wrap">
          {data.invoices.length === 0 ? (
            <div className="empty">
              <strong>No invoices here</strong>
              {status ? 'Try another filter.' : 'Invoices appear on the 1st for each organisation that ordered the month before.'}
            </div>
          ) : (
            <table className="c-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Organisation</th>
                  <th scope="col">Period</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i.number}>
                    <td>
                      <Link to={`/console/ops/invoices/${i.number}`} className="ref">{i.number}</Link>
                    </td>
                    <td>
                      <strong className="strong">{i.organization.name}</strong>
                      <div className="muted">{i.billingEmail || 'No billing email'}</div>
                    </td>
                    <td>{i.period.label}</td>
                    <td><InvoiceStatus invoice={i} /></td>
                    <td className="num">{formatNaira(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
