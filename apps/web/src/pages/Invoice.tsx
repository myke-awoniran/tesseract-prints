import { useEffect } from 'react';
import { formatNaira, type InvoiceResponse } from '@tesseract/shared';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { InvoiceSheet } from '../components/InvoiceSheet';
import { PayNowButton } from '../components/PayNowButton';
import { useQuery, type RouteParams } from '../lib/router';
import { api, rememberInvoiceLink } from '../lib/api';
import { useAsync } from '../lib/useAsync';

/** The private invoice link from the email: view and pay without signing in. */
export default function Invoice({ params }: { params: RouteParams }) {
  const number = (params.number ?? '').toUpperCase();
  const token = useQuery().get('t') ?? '';
  const [{ loading, data, error }] = useAsync(
    (signal) => api<InvoiceResponse>(`/invoices/${encodeURIComponent(number)}?t=${encodeURIComponent(token)}`, { signal }),
    [number, token]
  );

  useEffect(() => {
    if (data) rememberInvoiceLink(number, token);
  }, [data, number, token]);

  const invoice = data?.invoice;

  return (
    <>
      <SiteHeader />
      <main id="main" className="invoice-page">
        {loading && !invoice && (
          <p className="center-stage">
            <span className="spinner" aria-hidden="true" /> Loading invoice
          </p>
        )}
        {error && (
          <div className="center-stage">
            <h1>We couldn’t open this invoice.</h1>
            <p>{error}</p>
          </div>
        )}
        {invoice && (
          <div style={{ display: 'grid', gap: 24 }}>
            <InvoiceSheet invoice={invoice} />
            {invoice.status === 'open' && (
              <div className="inv-pay">
                <PayNowButton
                  path={`/invoices/${encodeURIComponent(number)}/pay`}
                  body={{ token }}
                  label={`Pay ${formatNaira(invoice.total)}`}
                />
                <p className="form-note">Card or bank transfer through our secure payment partner. A receipt is emailed when payment arrives.</p>
                {data.bankDetails && (
                  <p className="inv-pay__bank">
                    Or pay by bank transfer:{'\n'}
                    {data.bankDetails}
                    {'\n'}Reference: {invoice.number}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
