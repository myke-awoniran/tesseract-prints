import { formatNaira, type InvoiceResponse } from '@tesseract/shared';
import { api } from '../../lib/api';
import { Link, type RouteParams } from '../../lib/router';
import { useAsync } from '../../lib/useAsync';
import { InvoiceSheet } from '../../components/InvoiceSheet';
import { PayNowButton } from '../../components/PayNowButton';
import { PageHead } from './ConsoleLayout';

export default function InvoiceDetail({ params }: { params: RouteParams }) {
  const number = params.number ?? '';
  const [{ loading, data, error }] = useAsync(
    (signal) => api<InvoiceResponse>(`/enterprise/invoices/${encodeURIComponent(number)}`, { auth: true, signal }),
    [number]
  );
  const invoice = data?.invoice;

  return (
    <>
      <PageHead title={`Invoice ${number}`} subtitle={invoice ? invoice.period.label : ''}>
        <Link to="/console/billing" className="c-btn c-btn--quiet">All invoices</Link>
      </PageHead>
      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !invoice && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading invoice</p>}
      {invoice && (
        <div className="detail">
          <section className="panel">
            <InvoiceSheet invoice={invoice} orderLink={(ref) => `/console/orders/${ref}`} />
          </section>
          <section className="panel" style={{ alignSelf: 'start' }}>
            <div className="panel__head">
              <h2>{invoice.status === 'open' ? 'Pay this invoice' : 'Payment'}</h2>
            </div>
            {invoice.status === 'open' ? (
              <div className="inv-pay">
                <p className="muted-note">
                  {formatNaira(invoice.total)} {invoice.overdue ? 'was due' : 'is due'} by{' '}
                  {new Date(invoice.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </p>
                <PayNowButton
                  path={`/enterprise/invoices/${encodeURIComponent(invoice.number)}/pay`}
                  auth
                  label={`Pay ${formatNaira(invoice.total)}`}
                  className="c-btn c-btn--primary"
                  errorClassName="c-alert"
                />
                {data.bankDetails && (
                  <p className="inv-pay__bank">
                    Or pay by bank transfer:{'\n'}
                    {data.bankDetails}
                    {'\n'}Reference: {invoice.number}
                  </p>
                )}
              </div>
            ) : invoice.status === 'paid' ? (
              <p className="muted-note">Paid in full. The receipt was emailed to {invoice.billingEmail || 'your billing contact'}.</p>
            ) : (
              <p className="muted-note">This invoice was voided and does not need paying.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
