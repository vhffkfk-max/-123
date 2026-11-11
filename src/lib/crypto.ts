import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { env } from '@/config/env';

export class CryptoNotConfiguredError extends Error {
  readonly code = 'CRYPTO_NOT_CONFIGURED';
  constructor(what: string) {
    super(`${what} is not configured. Refusing to store PII in plaintext.`);
  }
}

function decodeKey(raw: string | undefined, name: string): Buffer {
  if (!raw) throw new CryptoNotConfiguredError(name);
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new CryptoNotConfiguredError(`${name} (must be 32 bytes, base64)`);
  return buf;
}

/** AES-256-GCM. Output format: v1:<iv b64>:<tag b64>:<ciphertext b64> */
export function encryptPii(plain: string): string {
  const key = decodeKey(env.piiEncryptionKey, 'PII_ENCRYPTION_KEY');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptPii(token: string): string {
  const key = decodeKey(env.piiEncryptionKey, 'PII_ENCRYPTION_KEY');
  const [v, ivB, tagB, ctB] = token.split(':');
  if (v !== 'v1' || !ivB || !tagB || !ctB) throw new Error('Unsupported ciphertext format');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
}

/** Keyed HMAC-SHA256 for dedupe/suppression lookups (never an unsalted hash). */
export function hashPii(kind: 'EMAIL' | 'PHONE', normalized: string): string {
  const key = decodeKey(env.piiHashKey, 'PII_HASH_KEY');
  return createHmac('sha256', key).update(`${kind}:${normalized}`).digest('hex');
}

export function hmacHex(secret: string, data: string | Buffer): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// --- password hashing (admin users) ---
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, saltB, hashB] = stored.split(':');
  if (alg !== 'scrypt' || !saltB || !hashB) return false;
  const expected = Buffer.from(hashB, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expected, actual);
}

export function generateKeyB64(): string {
  return randomBytes(32).toString('base64');
}
