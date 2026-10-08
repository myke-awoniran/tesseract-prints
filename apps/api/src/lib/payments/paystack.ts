import crypto from 'node:crypto';
import { config } from '../../config.js';
import { HttpError } from '../errors.js';
import { safeEqual } from '../crypto.js';
import { ownerMetadata, type PaymentGateway } from './types.js';

const BASE_URL = 'https://api.paystack.co';

interface PaystackEnvelope<T> {
  status: boolean;
  message?: string;
  data: T;
}

export interface PaystackInitData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackTransaction {
  status: 'success' | 'failed' | 'abandoned' | 'ongoing' | 'pending' | 'reversed' | string;
  reference: string;
  amount: number;
  currency: string;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE_URL + path, {
      ...init,
      headers: { Authorization: `Bearer ${config.payments.paystack.secretKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new HttpError(502, 'The payment provider could not be reached. Try again in a moment.');
  }
  const body = (await res.json().catch(() => null)) as PaystackEnvelope<T> | null;
  if (!res.ok || !body?.status) {
    throw new HttpError(502, body?.message || 'The payment provider declined the request.');
  }
  return body.data;
}

export function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}): Promise<PaystackInitData> {
  return call<PaystackInitData>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      currency: 'NGN',
      callback_url: input.callbackUrl,
      metadata: input.metadata
    })
  });
}

export function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  return call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export function isValidWebhookSignature(rawBody: Buffer | undefined, signature: unknown): boolean {
  if (!rawBody || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha512', config.payments.paystack.secretKey).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

export function amountMatches(amountKobo: number, data: PaystackTransaction | undefined): boolean {
  return data?.status === 'success' && Number(data.amount) === amountKobo && data.currency === 'NGN';
}

export const paystackGateway: PaymentGateway = {
  id: 'paystack',
  label: 'Paystack',
  configured: Boolean(config.payments.paystack.secretKey),

  async startCheckout(charge, { reference, returnUrl }) {
    const data = await initializeTransaction({
      email: charge.email,
      amountKobo: charge.amountKobo,
      reference,
      callbackUrl: `${returnUrl}?reference=${encodeURIComponent(reference)}`,
      metadata: { kind: charge.owner.kind, ...ownerMetadata(charge.owner) }
    });
    return { url: data.authorization_url, checkoutId: null };
  },

  async checkPayment(charge, attempt) {
    if (!attempt.reference) return { paid: false, status: 'unknown' };
    const data = await verifyTransaction(attempt.reference);
    return { paid: amountMatches(charge.amountKobo, data), status: data?.status ?? 'unknown' };
  }
};
