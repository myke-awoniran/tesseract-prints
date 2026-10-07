import { useEffect, useState } from 'react';
import type { VerifyPaymentResponse } from '@tesseract/shared';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { SealStamp } from '../components/SealStamp';
import { Link, useQuery } from '../lib/router';
import { api, recallExpressToken, errorMessage } from '../lib/api';

type ReturnState =
  | { status: 'checking' }
  | { status: 'paid' | 'pending'; ref: string }
  | { status: 'error'; message: string };

export default function PaymentReturn() {
  const query = useQuery();
  const reference = query.get('reference') || query.get('trxref');
  const [state, setState] = useState<ReturnState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    async function verify(attempt = 0): Promise<void> {
      if (!reference) {
        setState({ status: 'error', message: 'This page needs a payment reference. Open it from the payment confirmation.' });
        return;
      }
      try {
        const res = await api<VerifyPaymentResponse>(`/payments/verify?reference=${encodeURIComponent(reference)}`);
        if (cancelled) return;
        if (res.paid) setState({ status: 'paid', ref: res.ref });
        else if (attempt < 4) setTimeout(() => verify(attempt + 1), 2500);
        else setState({ status: 'pending', ref: res.ref });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: errorMessage(err) });
      }
    }
    verify();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const ref = 'ref' in state ? state.ref : null;
  const token = ref ? recallExpressToken(ref) : null;
  const trackUrl = ref && token ? `/track/${ref}?t=${token}` : null;

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
