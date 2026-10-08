import { formatNaira, type ClientInvoicesResponse } from '@tesseract/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Link } from '../../lib/router';
import { formatNumber } from '../../lib/format';
import { InvoiceStatus } from '../../components/InvoiceSheet';
import { PageHead } from './ConsoleLayout';

export default function Billing() {
  const [{ loading, data, error }] = useAsync((signal) => api<ClientInvoicesResponse>('/enterprise/invoices', { auth: true, signal }), []);

  return (
    <>
      <PageHead title="Billing" subtitle="One invoice a month for everything your organisation sent to print. Each is due 14 days after it is issued." />
      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !data && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading invoices</p>}
      {data && (
        <>
          <dl className="figures figures--2">
            <div className="figure">
              <dt>Outstanding</dt>
              <dd style={{ fontSize: 30 }}>{formatNaira(data.outstanding)}</dd>
              <small>{data.invoices.filter((i) => i.status === 'open').length} open {data.invoices.filter((i) => i.status === 'open').length === 1 ? 'invoice' : 'invoices'}</small>
            </div>
            <div className="figure">
              <dt>Not yet invoiced</dt>
              <dd style={{ fontSize: 30 }}>{formatNaira(data.upcoming.total)}</dd>
              <small>
                {formatNumber(data.upcoming.orders)} {data.upcoming.orders === 1 ? 'order' : 'orders'} · billed on the 1st
              </small>
            </div>
          </dl>

          {data.invoices.length === 0 ? (
            <div className="table-wrap">
              <div className="empty">
                <strong>No invoices yet</strong>
                Your first invoice arrives on the 1st of next month, covering this month’s orders.
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="c-table">
                <thead>
                  <tr>
                    <th scope="col">Invoice</th>
                    <th scope="col">Period</th>
                    <th scope="col" className="num">Orders</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((i) => (
                    <tr key={i.number}>
                      <td>
                        <Link to={`/console/billing/${i.number}`} className="ref">{i.number}</Link>
                      </td>
                      <td>{i.period.label}</td>
                      <td className="num">{i.lines.length}</td>
                      <td><InvoiceStatus invoice={i} /></td>
                      <td className="num">{formatNaira(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
