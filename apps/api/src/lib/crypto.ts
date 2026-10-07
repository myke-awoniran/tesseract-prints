import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

export interface EncryptedPayload {
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}

export function encryptBuffer(plain: Buffer, key: Buffer): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { iv, authTag: cipher.getAuthTag(), ciphertext };
}

export function decryptBuffer({ ciphertext, iv, authTag }: EncryptedPayload, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human-friendly order reference, e.g. TP-7K3Q9XA (no 0/O or 1/I to avoid misreading). */
export function orderRef(): string {
  let out = 'TP-';
  for (let i = 0; i < 7; i += 1) out += REF_ALPHABET[crypto.randomInt(REF_ALPHABET.length)];
  return out;
}

export function handoverCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}
