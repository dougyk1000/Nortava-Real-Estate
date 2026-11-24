import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export function getServerSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return {
    url: url.trim(),
    anonKey: anonKey.trim(),
    serviceRoleKey: serviceRoleKey.trim(),
    configured: Boolean(url.trim() && anonKey.trim())
  };
}

export function createPublicServerSupabase() {
  const { url, anonKey, configured } = getServerSupabaseConfig();
  if (!configured) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function createAdminServerSupabase() {
  const { url, serviceRoleKey } = getServerSupabaseConfig();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function createAuthedServerSupabase(accessToken) {
  const { url, anonKey, configured } = getServerSupabaseConfig();
  if (!configured || !accessToken) return null;
  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function timingSafeEqualStrings(a, b) {
  const left = crypto.createHash('sha256').update(String(a || ''), 'utf8').digest();
  const right = crypto.createHash('sha256').update(String(b || ''), 'utf8').digest();
  return crypto.timingSafeEqual(left, right);
}

export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map(s => s.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase())
    .filter(Boolean);
}

const COMPACT_JWS_REGEX = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;

export function extractBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token || token.length > 4096 || !COMPACT_JWS_REGEX.test(token)) return null;
  return token;
}

export async function verifyAuthenticatedUser(req) {
  const token = extractBearerToken(req);
  if (!token) return { user: null, token: null, error: 'Authentication required' };

  const supabase = createPublicServerSupabase();
  if (!supabase) return { user: null, token: null, error: 'Authentication service is not configured' };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, token: null, error: 'Invalid or expired session' };
  }

  return { user: data.user, token, error: null };
}

export async function verifyAdminRequest(req) {
  const { user, token, error } = await verifyAuthenticatedUser(req);
  if (error || !user) {
    return { ok: false, status: 401, error: error || 'Unauthorized' };
  }

  const emailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
  const adminEmails = getAdminEmails();
  const userEmail = String(user.email || '').normalize('NFKC').trim().toLowerCase();
  const isEnvAdmin =
    emailConfirmed &&
    adminEmails.length > 0 &&
    Boolean(userEmail) &&
    adminEmails.some((allowed) => timingSafeEqualStrings(allowed, userEmail));

  const dbClient = createAdminServerSupabase() || createAuthedServerSupabase(token);
  let isDbAdmin = false;
  if (dbClient) {
    const { data: profile } = await dbClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    isDbAdmin = profile?.role === 'admin';
  }

  if (!isEnvAdmin && !isDbAdmin) {
    return { ok: false, status: 403, error: 'Admin privileges required' };
  }

  return {
    ok: true,
    user,
    token,
    dbClient: createAdminServerSupabase() || createAuthedServerSupabase(token)
  };
}

export function sanitizeText(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .slice(0, maxLength);
}

const ASCII_EMAIL_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const normalized = email
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();
  if (!normalized || normalized.length > 254) return false;
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0 || atIndex > 64) return false;
  return ASCII_EMAIL_REGEX.test(normalized);
}

const BLOCKED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function sanitizePrototypePollution(value, depth = 0) {
  if (depth > 12 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = sanitizePrototypePollution(value[i], depth + 1);
    }
    return value;
  }
  const clean = {};
  for (const [key, entry] of Object.entries(value)) {
    if (BLOCKED_OBJECT_KEYS.has(key)) continue;
    clean[key] = sanitizePrototypePollution(entry, depth + 1);
  }
  return clean;
}

export function stripPrototypePollutionMiddleware(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizePrototypePollution(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const cleanedQuery = sanitizePrototypePollution(req.query);
    for (const key of Object.keys(req.query)) {
      if (BLOCKED_OBJECT_KEYS.has(key)) {
        delete req.query[key];
      } else if (Object.prototype.hasOwnProperty.call(cleanedQuery, key)) {
        req.query[key] = cleanedQuery[key];
      }
    }
  }
  next();
}

export function createRateLimiter({ windowMs = 60_000, max = 30, message = 'Too many requests. Please try again shortly.' } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const rawIp = String(req.ip || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    let bucket = hits.get(rawIp);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(rawIp, bucket);
    }
    bucket.count += 1;

    if (hits.size > 5000) {
      for (const [key, entry] of hits.entries()) {
        if (now >= entry.resetAt) hits.delete(key);
      }
    }

    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: message });
    }
    return next();
  };
}

function isLocalHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return true;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
    return true;
  }
  if (!host.includes('.')) return true;
  return false;
}

const STRICT_HOST_HEADER_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::\d{1,5})?$/i;

function parseHttpOrigin(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (parsed.username || parsed.password) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

function getConfiguredAllowedHosts() {
  const hosts = new Set(['nortava.co.zw', 'www.nortava.co.zw']);
  for (const envUrl of [process.env.PUBLIC_APP_URL, process.env.SITE_URL, process.env.APP_URL]) {
    const origin = parseHttpOrigin(envUrl);
    if (origin) {
      try {
        hosts.add(new URL(origin).hostname.toLowerCase());
      } catch {
        // Ignore invalid env URL
      }
    }
  }
  const extraHosts = String(process.env.ALLOWED_HOSTS || '')
    .split(',')
    .map(h => h.trim().toLowerCase().replace(/:\d+$/, ''))
    .filter(Boolean);
  for (const host of extraHosts) {
    hosts.add(host);
  }
  return hosts;
}

function isTrustedPublicHost(hostname) {
  const cleanHost = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!cleanHost) return false;
  const configuredHosts = getConfiguredAllowedHosts();
  if (configuredHosts.has(cleanHost)) return true;
  if (cleanHost.endsWith('.run.app') || cleanHost.endsWith('.nortava.co.zw')) return true;
  if (process.env.NODE_ENV !== 'production' && (cleanHost === 'localhost' || cleanHost === '127.0.0.1')) {
    return true;
  }
  return false;
}

function parseValidatedHostHeader(rawHost, proto) {
  if (!rawHost || typeof rawHost !== 'string') return '';
  const firstHost = String(rawHost).split(',')[0].trim();
  if (!firstHost || firstHost.length > 255 || !STRICT_HOST_HEADER_REGEX.test(firstHost)) {
    return '';
  }
  const cleanProto = String(proto || 'https').split(',')[0].trim().toLowerCase() === 'http' ? 'http' : 'https';
  const origin = parseHttpOrigin(`${cleanProto}://${firstHost}`);
  if (!origin) return '';
  try {
    const parsed = new URL(origin);
    if (!isTrustedPublicHost(parsed.hostname)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export function resolvePublicAppOrigin(req) {
  const candidates = [];

  if (req && typeof req.get === 'function') {
    const forwardedHostRaw = req.get('x-forwarded-host');
    const forwardedProtoRaw = req.get('x-forwarded-proto');
    if (forwardedHostRaw) {
      const fOrigin = parseValidatedHostHeader(forwardedHostRaw, forwardedProtoRaw || 'https');
      if (fOrigin) candidates.push(fOrigin);
    }

    const hostHeader = req.get('host');
    if (hostHeader) {
      const proto = String(forwardedProtoRaw || req.protocol || 'http').split(',')[0].trim().toLowerCase() === 'https' ? 'https' : 'http';
      const hostOrigin = parseValidatedHostHeader(hostHeader, proto);
      if (hostOrigin) candidates.push(hostOrigin);
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (!isLocalHostname(parsed.hostname)) {
        return parsed.origin;
      }
    } catch {
      // Ignore invalid URL
    }
  }

  const envOrigin =
    parseHttpOrigin(process.env.PUBLIC_APP_URL) ||
    parseHttpOrigin(process.env.SITE_URL) ||
    parseHttpOrigin(process.env.APP_URL);
  if (envOrigin) {
    return envOrigin;
  }

  return candidates[0] || '';
}

export function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-XSS-Protection', '0');

  const { url } = getServerSupabaseConfig();
  let supabaseOrigin = '';
  let supabaseWsOrigin = '';
  if (url) {
    try {
      const parsed = new URL(url);
      supabaseOrigin = parsed.origin;
      supabaseWsOrigin = parsed.origin.replace(/^http/, 'ws');
    } catch {
      // Ignore malformed env URL in CSP builder
    }
  }

  const connectSrc = ["'self'", supabaseOrigin, supabaseWsOrigin].filter(Boolean).join(' ');
  const imgSrc = ["'self'", 'data:', 'blob:', supabaseOrigin].filter(Boolean).join(' ');

  // Strict CSP prohibiting remote font/script CDNs while preserving Vite MPA inline scripts & styles
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      `img-src ${imgSrc}`,
      `connect-src ${connectSrc}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  next();
}
