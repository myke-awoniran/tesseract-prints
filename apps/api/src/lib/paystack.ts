import crypto from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from './errors.js';
import { safeEqual } from './crypto.js';

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
      headers: { Authorization: `Bearer ${config.paystackSecret}`, 'Content-Type': 'application/json' },
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
  const expected = crypto.createHmac('sha512', config.paystackSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
