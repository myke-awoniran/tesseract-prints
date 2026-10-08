import { useState } from 'react';
import type { PayResponse } from '@tesseract/shared';
import { useRouter } from '../lib/router';
import { api, errorMessage } from '../lib/api';

/**
 * Starts a fresh checkout and sends the payer to the payment page.
 * `path` is the API endpoint that starts it: an express order's or an invoice's.
 */
export function PayNowButton({
  path,
  body,
  auth = false,
  label = 'Pay now',
  className = 'btn btn--accent',
  errorClassName = 'alert'
}: {
  path: string;
  body?: unknown;
  auth?: boolean;
  label?: string;
  className?: string;
  errorClassName?: string;
}) {
  const { navigate } = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pay() {
    setBusy(true);
    setError('');
    try {
      const res = await api<PayResponse>(path, { method: 'POST', body: body ?? {}, auth });
      navigate(res.authorizationUrl);
    } catch (err) {
      setBusy(false);
      setError(errorMessage(err));
    }
  }

  return (
    <>
      {error && (
        <div className={errorClassName} role="alert">
          {error}
        </div>
      )}
      <button type="button" className={className} onClick={pay} disabled={busy}>
        {busy ? 'Opening payment…' : label}
      </button>
    </>
  );
}

export const expressPayPath = (ref: string) => `/express/orders/${encodeURIComponent(ref)}/pay`;
