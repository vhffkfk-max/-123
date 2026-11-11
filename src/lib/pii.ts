/** PII normalization and masking helpers. Never log raw values. */

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isValidEmail(raw: string): boolean {
  return raw.length <= 254 && EMAIL_RE.test(raw.trim());
}

/**
 * Normalizes Korean phone numbers to E.164 (+82...). Returns null when the
 * value cannot be a plausible phone number.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  let d = digits.startsWith('+') ? digits.slice(1) : digits;
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith('0')) d = `82${d.slice(1)}`;
  if (!d.startsWith('82') && d.length >= 8 && d.length <= 15) return `+${d}`; // foreign number kept as-is
  if (d.startsWith('82')) {
    const national = d.slice(2);
    if (national.length < 8 || national.length > 10) return null;
    return `+${d}`;
  }
  return null;
}

/** TradingView usernames: letters, digits, underscore, dot, hyphen. Self-reported, existence verified later by an operator. */
const TV_RE = /^[A-Za-z0-9_.-]{2,40}$/;
export function normalizeTradingviewUsername(raw: string): string | null {
  const v = raw.trim().replace(/^@/, '');
  return TV_RE.test(v) ? v : null;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.length <= 4) return '****';
  return `${phone.slice(0, 5)}****${phone.slice(-2)}`;
}

export function maskName(name: string | null | undefined): string {
  if (!name) return '—';
  const chars = Array.from(name);
  if (chars.length === 1) return '*';
  return `${chars[0]}${'*'.repeat(chars.length - 1)}`;
}

export function maskTv(tv: string | null | undefined): string {
  if (!tv) return '—';
  return tv.length <= 3 ? '***' : `${tv.slice(0, 3)}***`;
}

const PII_PATTERNS = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email
  /(\+?82|0)1[016789][-\s]?\d{3,4}[-\s]?\d{4}/, // KR mobile
];

/** Returns true when the string looks like it contains an email or phone number. */
export function containsPii(value: string): boolean {
  return PII_PATTERNS.some((re) => re.test(value));
}
