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
