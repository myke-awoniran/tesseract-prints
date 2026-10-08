import crypto from 'node:crypto';
import { config } from '../../config.js';
import { HttpError } from '../errors.js';
import { safeEqual } from '../crypto.js';
import { ownerMetadata, type Charge, type PaymentCheck, type PaymentGateway } from './types.js';

// Bachs prices in decimal strings at the currency's precision ("7500.00"), never minor units.
// Docs: https://docs.bachs.io/guides/checkout/checkout-sessions

const SIGNATURE_TOLERANCE_SECONDS = 300;
const PAID_CHARGE_STATUSES = new Set(['succeeded', 'accepted', 'overpaid']);

interface BachsError {
  detail?: string;
  error_code?: string;
}

export interface BachsCheckoutCreated {
  checkout_id: string;
  checkout_url: string;
  status: string;
}

export interface BachsCheckoutSession {
  checkout_id: string;
  status: 'open' | 'completed' | 'expired' | 'cancelled' | string;
  payment_status?: string | null;
  amount: string;
  currency: string;
  reference?: string | null;
  metadata?: Record<string, unknown> | null;
  charge?: { status?: string } | null;
}

export interface BachsEvent {
  id?: string;
  type?: string;
  data?: { checkout_id?: string | null; reference?: string | null; status?: string; metadata?: Record<string, unknown> | null };
}

/** Bachs rejects localhost and private-network return URLs, so local development goes without them. */
function isPublicUrl(url: string): boolean {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  return !(
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '::1' ||
    /^(127|10)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

function toMajor(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

function toKobo(amount: string): number {
  return Math.round(Number(amount) * 100);
}

async function call<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const { idempotencyKey, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(config.payments.bachs.apiUrl + path, {
      ...rest,
      headers: {
        Authorization: `Bearer ${config.payments.bachs.secretKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new HttpError(502, 'The payment provider could not be reached. Try again in a moment.');
  }
  const body = (await res.json().catch(() => null)) as (T & BachsError) | null;
  if (res.status === 404) throw new HttpError(404, 'We could not find a payment with that reference.');
  if (!res.ok || !body) {
    throw new HttpError(502, body?.detail || 'The payment provider declined the request.');
  }
  return body;
}

export function getCheckoutSession(checkoutId: string): Promise<BachsCheckoutSession> {
  return call<BachsCheckoutSession>(`/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`);
}

/** Paid only if the session is complete and is the full NGN amount for this very charge. */
export function evaluateSession(charge: Charge, session: BachsCheckoutSession): PaymentCheck {
  const status = session.payment_status || session.status || 'unknown';
  const belongs = Object.entries(ownerMetadata(charge.owner)).every(([key, value]) => session.metadata?.[key] === value);
  const chargeOk = !session.charge?.status || PAID_CHARGE_STATUSES.has(session.charge.status);
  const paid =
    session.status === 'completed' &&
    chargeOk &&
    belongs &&
    session.currency === 'NGN' &&
    toKobo(session.amount) === charge.amountKobo;
  return { paid, status };
}

/** Accepts the V2 header (any v1 signature, for safe secret rotation) or the original pair of headers. */
export function isValidWebhookSignature(rawBody: Buffer | undefined, headers: Record<string, unknown>): boolean {
  const secret = config.payments.bachs.webhookSecret;
  if (!rawBody || !secret) return false;

  let timestamp: string | undefined;
  const signatures: string[] = [];
  const v2 = headers['x-bachs-signature-v2'];
  if (typeof v2 === 'string') {
    for (const part of v2.split(',')) {
      const [key, ...rest] = part.trim().split('=');
      const value = rest.join('=');
      if (key === 't') timestamp = value;
      else if (key === 'v1') signatures.push(value);
    }
  } else if (typeof headers['x-bachs-timestamp'] === 'string' && typeof headers['x-bachs-signature'] === 'string') {
    timestamp = headers['x-bachs-timestamp'];
    signatures.push(headers['x-bachs-signature']);
  }

  const seconds = Number(timestamp);
  if (!timestamp || !Number.isInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
  return signatures.some((signature) => safeEqual(expected, signature));
}

export const bachsGateway: PaymentGateway = {
  id: 'bachs',
  label: 'Bachs',
  configured: Boolean(config.payments.bachs.secretKey),

  async startCheckout(charge, { reference, returnUrl, cancelUrl }) {
    // Bachs appends ?checkout_id= to success_url, so it is passed without a query string.
    // Without return URLs (local development) the customer stays on Bachs; the tracking page confirms payment.
    const session = await call<BachsCheckoutCreated>('/v1/checkout-sessions', {
      method: 'POST',
      idempotencyKey: reference,
      body: JSON.stringify({
        pricing: { currency: 'NGN', amount: toMajor(charge.amountKobo) },
        customer: { email: charge.email, name: charge.name },
        ...(isPublicUrl(returnUrl) ? { success_url: returnUrl, cancel_url: cancelUrl } : {}),
        reference,
        expires_in_minutes: 60,
        metadata: { kind: charge.owner.kind, ...ownerMetadata(charge.owner) }
      })
    });
    return { url: session.checkout_url, checkoutId: session.checkout_id };
  },

  async checkPayment(charge, attempt) {
    if (!attempt.checkoutId) return { paid: false, status: 'unknown' };
    return evaluateSession(charge, await getCheckoutSession(attempt.checkoutId));
  }
};
