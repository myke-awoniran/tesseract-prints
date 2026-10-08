import { useEffect, useState } from 'react';
import type { VerifyPaymentResponse } from '@tesseract/shared';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { SealStamp } from '../components/SealStamp';
import { PayNowButton, expressPayPath } from '../components/PayNowButton';
import { Link, useQuery, useRouter } from '../lib/router';
import { api, getToken, recallExpressToken, recallInvoiceToken, recallLatestExpressOrder, errorMessage } from '../lib/api';

// A checkout is valid for an hour; allow a little longer for the customer to come back.
const RECENT_ORDER_MS = 2 * 60 * 60 * 1000;

type ReturnState =
  | { status: 'checking' }
  | { status: 'paid' | 'pending' | 'cancelled'; ref: string; kind: 'order' | 'invoice' }
  | { status: 'error'; message: string };

export default function PaymentReturn() {
  const query = useQuery();
  const { navigate } = useRouter();
  // Bachs returns with checkout_id; Paystack, the mock and our cancel link carry reference.
  const checkoutId = query.get('checkout_id');
  const reference = query.get('reference') || query.get('trxref');
  const cancelled = query.get('cancelled') === '1';
  const [state, setState] = useState<ReturnState>({ status: 'checking' });

  useEffect(() => {
    let stopped = false;
    async function verify(attempt = 0): Promise<void> {
      if (!checkoutId && !reference) {
        // The gateway came back without identifying the payment. The tracking page checks the
        // gateway itself, so send the customer to the order they just placed on this device.
        const recent = recallLatestExpressOrder(RECENT_ORDER_MS);
        if (recent) {
          navigate(`/track/${recent.ref}?t=${recent.token}`, { replace: true });
          return;
        }
        setState({
          status: 'error',
          message: 'This page needs a payment reference. Open your order from the tracking link we emailed you to see its payment status.'
        });
        return;
      }
      try {
        const lookup = checkoutId ? `checkout_id=${encodeURIComponent(checkoutId)}` : `reference=${encodeURIComponent(reference ?? '')}`;
        const res = await api<VerifyPaymentResponse>(`/payments/verify?${lookup}`);
        if (stopped) return;
        const kind = res.kind ?? 'order';
        if (res.paid) setState({ status: 'paid', ref: res.ref, kind });
        else if (cancelled) setState({ status: 'cancelled', ref: res.ref, kind });
        else if (attempt < 4) setTimeout(() => verify(attempt + 1), 2500);
        else setState({ status: 'pending', ref: res.ref, kind });
      } catch (err) {
        if (!stopped) setState({ status: 'error', message: errorMessage(err) });
      }
    }
    verify();
    return () => {
      stopped = true;
    };
  }, [checkoutId, reference, cancelled, navigate]);

  const ref = 'ref' in state ? state.ref : null;
  const isInvoice = 'kind' in state && state.kind === 'invoice';
  const token = ref && !isInvoice ? recallExpressToken(ref) : null;
  const trackUrl = ref && token ? `/track/${ref}?t=${token}` : null;

  if (isInvoice && ref) return <InvoiceReturn status={state.status as 'paid' | 'pending' | 'cancelled'} number={ref} />;

  return (
    <>
      <SiteHeader />
      <main id="main" className="center-stage" aria-live="polite">
        {state.status === 'checking' && (
          <>
            <span className="spinner" aria-hidden="true" />
            <h1>Confirming your payment</h1>
            <p>This usually takes a few seconds.</p>
          </>
        )}
        {state.status === 'paid' && (
          <>
            <SealStamp />
            <h1>Paid. Your document is in the queue.</h1>
            <p>
              Order {ref} is with our print room. Your tracking page shows each step and the code you’ll give the courier on
              delivery.
            </p>
            {trackUrl ? (
              <Link to={trackUrl} className="btn btn--primary">Track your order</Link>
            ) : (
              <p>Use the tracking link saved on the device you ordered from.</p>
            )}
          </>
        )}
        {state.status === 'pending' && (
          <>
            <h1>We haven’t received confirmation yet.</h1>
            <p>If you completed payment, it can take a minute to arrive. Your tracking page will update automatically.</p>
            {trackUrl && <Link to={trackUrl} className="btn btn--primary">Go to your tracking page</Link>}
          </>
        )}
        {state.status === 'cancelled' && (
          <>
            <h1>Payment not completed.</h1>
            <p>Order {ref} is saved and waiting. Nothing was charged, and you can pay whenever you’re ready.</p>
            {ref && token ? (
              <PayNowButton path={expressPayPath(ref)} body={{ token }} label="Try payment again" />
            ) : (
              <p>Use the tracking link saved on the device you ordered from to pay.</p>
            )}
          </>
        )}
        {state.status === 'error' && (
          <>
            <h1>We couldn’t confirm this payment.</h1>
            <p>{state.message}</p>
            <Link to="/express" className="btn btn--outline">Return to express printing</Link>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

/** After paying an organisation's invoice: back to the console if signed in, otherwise to the invoice link. */
function InvoiceReturn({ status, number }: { status: 'paid' | 'pending' | 'cancelled'; number: string }) {
  const publicToken = recallInvoiceToken(number);
  const invoiceUrl = getToken()
    ? `/console/billing/${number}`
    : publicToken
      ? `/invoice/${number}?t=${encodeURIComponent(publicToken)}`
      : null;

  return (
    <>
      <SiteHeader />
      <main id="main" className="center-stage" aria-live="polite">
        {status === 'paid' && (
          <>
            <SealStamp />
            <h1>Paid. Thank you.</h1>
            <p>Invoice {number} is settled. A receipt is on its way to your billing email.</p>
          </>
        )}
        {status === 'pending' && (
          <>
            <h1>We haven’t received confirmation yet.</h1>
            <p>If you completed payment, it can take a minute to arrive. The invoice will show as paid once it does.</p>
          </>
        )}
        {status === 'cancelled' && (
          <>
            <h1>Payment not completed.</h1>
            <p>Nothing was charged. Invoice {number} is still open and you can pay whenever you’re ready.</p>
          </>
        )}
        {invoiceUrl ? (
          <Link to={invoiceUrl} className="btn btn--primary">View invoice</Link>
        ) : (
          <p>Use the link in your invoice email to view it.</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
