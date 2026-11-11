/**
 * Central configuration. Every external integration and every outbound
 * (marketing / consultation) sending feature is OFF unless explicitly enabled.
 * Missing secrets never make a feature "pretend" to work: callers receive an
 * explicit NOT_CONFIGURED / NOT_CONNECTED status instead.
 */

function bool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
}

function str(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v.trim() === '' ? undefined : v.trim();
}

function int(name: string, fallback: number): number {
  const v = str(name);
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  get nodeEnv() {
    return process.env.NODE_ENV ?? 'development';
  },
  get databaseUrl() {
    return str('DATABASE_URL');
  },
  get appBaseUrl() {
    return str('APP_BASE_URL') ?? 'http://localhost:3000';
  },

  // --- crypto ---
  get piiEncryptionKey() {
    return str('PII_ENCRYPTION_KEY');
  },
  get piiHashKey() {
    return str('PII_HASH_KEY');
  },
  get sessionSecret() {
    return str('SESSION_SECRET');
  },
  get resourceLinkSecret() {
    return str('RESOURCE_LINK_SECRET');
  },

  // --- compliance / policy values that MUST be confirmed by the operator ---
  /** Retention in days. No default on purpose: [보유기간 확정 필요] */
  get leadRetentionDays(): number | undefined {
    const v = str('LEAD_RETENTION_DAYS');
    if (!v) return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  },
  get privacyPolicyVersion() {
    return str('PRIVACY_POLICY_VERSION') ?? 'DRAFT-LEGAL_REVIEW_REQUIRED';
  },
  get consentNoticeVersion() {
    return str('CONSENT_NOTICE_VERSION') ?? '2026-11-v1-DRAFT';
  },
  get mqlThreshold() {
    return int('MQL_SCORE_THRESHOLD', 40);
  },

  // --- rate limiting ---
  get leadRateLimitPerMinute() {
    return int('LEAD_RATE_LIMIT_PER_MINUTE', 5);
  },

  // --- feature flags (all default OFF) ---
  flags: {
    get metaLeadSync() {
      return bool('FEATURE_META_LEAD_SYNC');
    },
    get crmSync() {
      return bool('FEATURE_CRM_SYNC');
    },
    get transactionalEmail() {
      return bool('FEATURE_TRANSACTIONAL_EMAIL');
    },
    get promotionalSending() {
      return bool('FEATURE_PROMOTIONAL_SENDING');
    },
    get consultationSending() {
      return bool('FEATURE_CONSULTATION_AUTOMATED_SENDING');
    },
    get analyticsForwarding() {
      return bool('FEATURE_ANALYTICS_FORWARDING');
    },
    get metaConversionsApi() {
      return bool('FEATURE_META_CAPI');
    },
  },

  // --- Meta (official Graph API only) ---
  meta: {
    get appSecret() {
      return str('META_APP_SECRET');
    },
    get verifyToken() {
      return str('META_WEBHOOK_VERIFY_TOKEN');
    },
    get pageAccessToken() {
      return str('META_PAGE_ACCESS_TOKEN');
    },
    get graphApiVersion() {
      return str('META_GRAPH_API_VERSION') ?? 'v21.0';
    },
    get defaultOfferId() {
      return str('META_DEFAULT_OFFER_ID');
    },
  },

  // --- existing CRM ---
  crm: {
    get webhookUrl() {
      return str('CRM_WEBHOOK_URL');
    },
    get webhookSecret() {
      return str('CRM_WEBHOOK_SECRET');
    },
  },

  // --- transactional email provider (not chosen yet) ---
  email: {
    get provider() {
      return str('EMAIL_PROVIDER');
    },
    get fromAddress() {
      return str('EMAIL_FROM_ADDRESS');
    },
  },
};

export type IntegrationStatus = 'CONNECTED' | 'NOT_CONFIGURED' | 'DISABLED';

export function integrationStatuses(): Record<string, { status: IntegrationStatus; note: string }> {
  const s = (flag: boolean, configured: boolean): IntegrationStatus =>
    !flag ? 'DISABLED' : configured ? 'CONNECTED' : 'NOT_CONFIGURED';
  return {
    database: {
      status: env.databaseUrl ? 'CONNECTED' : 'NOT_CONFIGURED',
      note: 'PostgreSQL (DATABASE_URL)',
    },
    piiCrypto: {
      status: env.piiEncryptionKey && env.piiHashKey ? 'CONNECTED' : 'NOT_CONFIGURED',
      note: 'PII_ENCRYPTION_KEY / PII_HASH_KEY',
    },
    metaLeadAds: {
      status: s(env.flags.metaLeadSync, !!(env.meta.appSecret && env.meta.verifyToken && env.meta.pageAccessToken)),
      note: 'Meta Lead Ads webhook + Graph API (권한/앱 심사 확인 후 활성화)',
    },
    crm: {
      status: s(env.flags.crmSync, !!env.crm.webhookUrl),
      note: '기존 CRM 어댑터 (AS-IS 미확인 → 기본 OFF)',
    },
    transactionalEmail: {
      status: s(env.flags.transactionalEmail, !!(env.email.provider && env.email.fromAddress)),
      note: '거래성 안내 메일 (발송 공급자 미정)',
    },
    promotionalSending: {
      status: s(env.flags.promotionalSending, false),
      note: 'LEGAL_REVIEW_REQUIRED — 광고성 정보 발송 기능은 MVP에 구현하지 않음',
    },
    analytics: {
      status: s(env.flags.analyticsForwarding, false),
      note: 'GA4 / Meta CAPI — 정책·동의 검토 전 미연동',
    },
  };
}
