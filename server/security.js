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

export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function extractBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
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

  const adminEmails = getAdminEmails();
  const userEmail = (user.email || '').toLowerCase();
  const isEnvAdmin = adminEmails.length > 0 && adminEmails.includes(userEmail);

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
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 254;
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

function parseHttpOrigin(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export function resolvePublicAppOrigin(req) {
  const candidates = [];

  if (req && typeof req.get === 'function') {
    const originHeader = parseHttpOrigin(req.get('origin'));
    if (originHeader) candidates.push(originHeader);

    const refererOrigin = parseHttpOrigin(req.get('referer'));
    if (refererOrigin) candidates.push(refererOrigin);

    const forwardedHostRaw = req.get('x-forwarded-host');
    const forwardedProtoRaw = req.get('x-forwarded-proto');
    if (forwardedHostRaw) {
      const fHost = String(forwardedHostRaw).split(',')[0].trim();
      const fProto = String(forwardedProtoRaw || 'https').split(',')[0].trim().toLowerCase() === 'http' ? 'http' : 'https';
      const fOrigin = parseHttpOrigin(`${fProto}://${fHost}`);
      if (fOrigin) candidates.push(fOrigin);
    }

    const hostHeader = req.get('host');
    if (hostHeader) {
      const proto = String(forwardedProtoRaw || req.protocol || 'http').split(',')[0].trim().toLowerCase() === 'https' ? 'https' : 'http';
      const hostOrigin = parseHttpOrigin(`${proto}://${hostHeader}`);
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
