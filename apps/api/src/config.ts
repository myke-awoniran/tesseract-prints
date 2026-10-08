import 'dotenv/config';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

const DEV_FILE_KEY = 'a'.repeat(64);

function required(name: string, devFallback?: string): string {
  const value = env[name];
  if (value) return value;
  if (!isProd && devFallback !== undefined) return devFallback;
  throw new Error(`Missing required environment variable ${name}. See apps/api/.env.example.`);
}

function parseKey(value: string): Buffer {
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('FILE_ENCRYPTION_KEY must be 32 bytes (64 hex characters).');
  return key;
}

export type PaymentProviderId = 'bachs' | 'paystack';
const PAYMENT_PROVIDERS: readonly PaymentProviderId[] = ['bachs', 'paystack'];

function paymentProvider(value: string | undefined): PaymentProviderId {
  const id = (value || 'bachs').trim().toLowerCase();
  if (!(PAYMENT_PROVIDERS as readonly string[]).includes(id)) {
    throw new Error(`PAYMENT_PROVIDER must be one of: ${PAYMENT_PROVIDERS.join(', ')}.`);
  }
  return id as PaymentProviderId;
}

/** Sandbox keys talk to the sandbox deployment, live keys to production, unless BACHS_API_URL overrides it. */
function bachsApiUrl(key: string): string {
  if (env.BACHS_API_URL) return env.BACHS_API_URL.replace(/\/$/, '');
  return key.startsWith('sk_live_') ? 'https://api.bachs.io' : 'https://sandbox-api.bachs.io';
}

function billingStart(value: string | undefined): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec((value || '2026-10').trim());
  const month = Number(match?.[2]);
  if (!match || month < 1 || month > 12) throw new Error('BILLING_START must look like 2026-10 (year-month).');
  return { year: Number(match[1]), month };
}

const bachsKey = env.BACHS_SECRET_KEY || '';

const webUrl = (env.WEB_URL || 'http://localhost:5173').replace(/\/$/, '');

export interface AppConfig {
  isProd: boolean;
  port: number;
  host: string;
  mongoUri: string;
  jwtSecret: string;
  fileKey: Buffer;
  webUrl: string;
  corsOrigins: string[];
  payments: {
    /** Which gateway new checkouts go to. Orders already sent to the other gateway still confirm through it. */
    provider: PaymentProviderId;
    bachs: { secretKey: string; webhookSecret: string; apiUrl: string };
    paystack: { secretKey: string };
  };
  billing: {
    /** First month (YYYY-MM, Lagos time) whose account orders are invoiced. Earlier orders are never billed. */
    startMonth: { year: number; month: number };
    /** Shown on invoices for clients who pay by bank transfer. Empty hides it. */
    bankDetails: string;
  };
  logLevel: string;
  webDist: string | null;
  email: {
    /** Sender shown to customers, e.g. "Tesseract Prints <orders@tesseractprints.com>". */
    from: string;
    replyTo: string;
    /** Where new-order and enquiry alerts for the print room go. Empty disables them. */
    opsAddress: string;
    resendApiKey: string;
    smtpUrl: string;
  };
}

export const config: AppConfig = {
  isProd,
  port: Number(env.PORT || 4000),
  host: env.HOST || '0.0.0.0',
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/tesseract-prints'),
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-do-not-use-in-production'),
  fileKey: parseKey(required('FILE_ENCRYPTION_KEY', DEV_FILE_KEY)),
  webUrl,
  corsOrigins: (env.CORS_ORIGINS || webUrl).split(',').map((s) => s.trim()),
  payments: {
    provider: paymentProvider(env.PAYMENT_PROVIDER),
    bachs: { secretKey: bachsKey, webhookSecret: env.BACHS_WEBHOOK_SECRET || '', apiUrl: bachsApiUrl(bachsKey) },
    paystack: { secretKey: env.PAYSTACK_SECRET_KEY || '' }
  },
  billing: {
    startMonth: billingStart(env.BILLING_START),
    bankDetails: (env.BILLING_BANK_DETAILS || '').replace(/\\n/g, '\n').trim()
  },
  logLevel: env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  webDist: env.WEB_DIST || null,
  email: {
    from: env.EMAIL_FROM || 'Tesseract Prints <orders@tesseractprints.com>',
    replyTo: env.EMAIL_REPLY_TO || '',
    opsAddress: env.OPS_EMAIL || '',
    resendApiKey: env.RESEND_API_KEY || '',
    smtpUrl: env.SMTP_URL || ''
  }
};

const activeKey = config.payments.provider === 'bachs' ? config.payments.bachs.secretKey : config.payments.paystack.secretKey;

export const paymentsAreMocked = !activeKey;

if (isProd && paymentsAreMocked) {
  const name = config.payments.provider === 'bachs' ? 'BACHS_SECRET_KEY' : 'PAYSTACK_SECRET_KEY';
  throw new Error(`${name} is required in production (PAYMENT_PROVIDER=${config.payments.provider}). Mock payments are development-only.`);
}

if (isProd && config.payments.provider === 'bachs' && !config.payments.bachs.webhookSecret) {
  throw new Error('BACHS_WEBHOOK_SECRET is required in production. Copy the signing secret from your Bachs webhook endpoint.');
}

if (isProd && config.payments.provider === 'bachs' && !bachsKey.startsWith('sk_live_')) {
  console.warn('WARNING: BACHS_SECRET_KEY is not a live key. Payments are simulated and no money will be collected.');
}
