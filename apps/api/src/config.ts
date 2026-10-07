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
  paystackSecret: string;
  logLevel: string;
  webDist: string | null;
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
  paystackSecret: env.PAYSTACK_SECRET_KEY || '',
  logLevel: env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  webDist: env.WEB_DIST || null
};

export const paymentsAreMocked = !config.paystackSecret;

if (isProd && paymentsAreMocked) {
  throw new Error('PAYSTACK_SECRET_KEY is required in production. Mock payments are development-only.');
}
