import crypto from 'node:crypto';

// NOTE: Nortava does NOT currently connect an outbound marketing email provider (ESP/SMTP).
// This module implements CAN-SPAM / RFC 8058 guardrails (HMAC-signed one-click unsubscribe tokens,
// suppression list verification, transactional vs. marketing separation, and physical address enforcement)
// so commercial email cannot be sent without compliance controls once an ESP is configured.

const ephemeralFallbackSecret = crypto.randomBytes(32).toString('hex');

function getSigningSecret() {
  return process.env.UNSUBSCRIBE_SECRET || ephemeralFallbackSecret;
}

// In-memory suppression store backed by Supabase `email_suppression` table when configured.
const localSuppressionSet = new Set();

export function normalizeEmail(email) {
  return String(email || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();
}

export function createUnsubscribeToken(email) {
  const normalized = normalizeEmail(email);
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(normalized)
    .digest('hex');
}

export function verifyUnsubscribeToken(email, token) {
  const normalized = normalizeEmail(email);
  if (!normalized || !token || typeof token !== 'string') return false;
  const expected = createUnsubscribeToken(normalized);
  const expectedDigest = crypto.createHash('sha256').update(expected, 'utf8').digest();
  const providedDigest = crypto.createHash('sha256').update(token.trim(), 'utf8').digest();
  return crypto.timingSafeEqual(expectedDigest, providedDigest);
}

export async function suppressEmail(email, supabaseClient = null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, error: 'Invalid email' };
  localSuppressionSet.add(normalized);

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('email_suppression')
        .upsert({ email: normalized, suppressed_at: new Date().toISOString() }, { onConflict: 'email' });
    } catch {
      // Ignore storage persistence failures if table not yet migrated
    }
  }
  return { ok: true, email: normalized };
}

export async function isEmailSuppressed(email, supabaseClient = null) {
  const normalized = normalizeEmail(email);
  if (localSuppressionSet.has(normalized)) return true;

  if (supabaseClient) {
    const { data } = await supabaseClient
      .from('email_suppression')
      .select('email')
      .eq('email', normalized)
      .maybeSingle();
    if (data) return true;
  }
  return false;
}

export async function validateMarketingSend({ to, category, physicalAddress, unsubscribeBaseUrl, supabaseClient = null }) {
  if (category === 'transactional') {
    return { allowed: true, headers: {} };
  }

  if (!physicalAddress || physicalAddress.includes('[OWNER CONFIRMATION REQUIRED]')) {
    return {
      allowed: false,
      reason: 'CAN_SPAM_PHYSICAL_ADDRESS_MISSING',
      message: 'A valid physical postal address is required before sending commercial emails.'
    };
  }

  const normalized = normalizeEmail(to);
  if (await isEmailSuppressed(normalized, supabaseClient)) {
    return {
      allowed: false,
      reason: 'RECIPIENT_SUPPRESSED',
      message: 'Recipient has unsubscribed and is suppressed.'
    };
  }

  const token = createUnsubscribeToken(normalized);
  const unsubscribeUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(normalized)}&token=${encodeURIComponent(token)}`;

  return {
    allowed: true,
    unsubscribeUrl,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}
