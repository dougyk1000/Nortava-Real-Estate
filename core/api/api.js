import { createClient } from '@supabase/supabase-js';
import { matchesLocationFilter } from '../locations/zimbabweLocations.js';

let supabaseInstance = null;
let configPromise = null;
let passwordRecoveryDetected = false;
const initialLocationHash = typeof window !== 'undefined' ? window.location.hash : '';
const initialLocationSearch = typeof window !== 'undefined' ? window.location.search : '';

async function resolvePublicConfig() {
  const envUrl = import.meta.env?.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
  if (envUrl && envKey) {
    return { supabaseConfigured: true, supabaseUrl: envUrl, supabaseAnonKey: envKey };
  }

  try {
    const res = await fetch('/api/public-config', { credentials: 'same-origin' });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Offline or test environment
  }
  return { supabaseConfigured: false, supabaseUrl: '', supabaseAnonKey: '' };
}

export async function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  if (!configPromise) {
    configPromise = resolvePublicConfig();
  }
  const cfg = await configPromise;
  if (!cfg?.supabaseConfigured || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    return null;
  }
  supabaseInstance = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  supabaseInstance.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      passwordRecoveryDetected = true;
    }
  });
  return supabaseInstance;
}

export async function getAccessToken() {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

// --- AUTH ---
export async function loginUser(email, password) {
  const supabase = await getSupabase();
  if (!supabase) {
    return { data: null, error: { message: 'Authentication service is not configured yet.', code: 'AUTH_NOT_CONFIGURED' } };
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  if (error) {
    const rawMsg = String(error.message || 'Sign in failed.');
    const lower = rawMsg.toLowerCase();
    let code = 'LOGIN_FAILED';
    if (lower.includes('email not confirmed')) {
      code = 'EMAIL_NOT_CONFIRMED';
    } else if (lower.includes('invalid login credentials')) {
      code = 'INVALID_CREDENTIALS';
    } else if (lower.includes('rate limit')) {
      code = 'RATE_LIMITED';
    }
    return { data: null, error: { ...error, message: rawMsg, code } };
  }

  if (data?.user) {
    const profile = await getUserProfile(data.user.id);
    const displayUser = {
      id: data.user.id,
      email: data.user.email,
      name: profile?.name || data.user.user_metadata?.name || data.user.email.split('@')[0],
      role: profile?.role || data.user.user_metadata?.role || 'tenant'
    };
    try {
      localStorage.setItem('nortava-user', JSON.stringify(displayUser));
    } catch {
      // Ignore storage error
    }
  }

  return { data, error: null };
}

export async function registerUser({ email, password, name, role, phone = '', birthYear, birthMonth, termsAccepted, landlordKyc = null }) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name,
        role,
        phone,
        birthYear,
        birthMonth,
        termsAccepted,
        landlordKyc
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        data: null,
        error: { message: payload.error || 'Registration failed.', code: payload.code || 'REGISTER_ERROR' }
      };
    }

    if (payload?.session?.access_token && payload?.session?.refresh_token) {
      const supabase = await getSupabase();
      if (supabase) {
        await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token
        });
      }
    }

    if (payload?.user && payload?.session) {
      try {
        localStorage.setItem('nortava-user', JSON.stringify({
          id: payload.user.id,
          email: payload.user.email,
          name: payload.user.name,
          role: payload.user.role
        }));
      } catch {
        // Ignore storage error
      }
    }

    return { data: payload, error: null };
  } catch {
    return { data: null, error: { message: 'Unable to reach registration server.' } };
  }
}

export async function resendConfirmationEmail(email) {
  try {
    const res = await fetch('/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(email || '').trim().toLowerCase() })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: { message: payload.error || 'Unable to resend confirmation email.' } };
    }
    return { data: payload, error: null };
  } catch {
    return { data: null, error: { message: 'Unable to reach server to resend confirmation email.' } };
  }
}

export async function requestPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: { message: payload.error || 'Unable to send password reset link.' } };
    }
    return { data: payload, error: null };
  } catch {
    return { data: null, error: { message: 'Unable to reach server to send password reset link.' } };
  }
}

export async function onPasswordRecoveryState(callback) {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
      callback(event, session);
    }
  });
  return data?.subscription || null;
}

export async function completePasswordRecoverySession() {
  const hashSource = (typeof window !== 'undefined' && window.location.hash) || initialLocationHash || '';
  const searchSource = (typeof window !== 'undefined' && window.location.search) || initialLocationSearch || '';
  const hashParams = new URLSearchParams(hashSource.replace(/^#/, ''));
  const queryParams = new URLSearchParams(searchSource);

  const supabase = await getSupabase();
  if (!supabase) {
    return { ready: false, error: { message: 'Authentication service is not configured yet.' } };
  }

  const urlError =
    hashParams.get('error_description') ||
    queryParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error');

  if (urlError) {
    return { ready: false, error: { message: urlError, code: 'RECOVERY_LINK_ERROR' } };
  }

  const { data: existingSessionData } = await supabase.auth.getSession();
  const type = (queryParams.get('type') || hashParams.get('type') || '').toLowerCase();
  const code = queryParams.get('code');
  const tokenHash = queryParams.get('token_hash') || hashParams.get('token_hash');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (existingSessionData?.session && (passwordRecoveryDetected || type === 'recovery' || code || accessToken)) {
    return { ready: true, session: existingSessionData.session, error: null };
  }

  if (tokenHash && type === 'recovery') {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error) {
      return { ready: false, error: { message: error.message || 'This reset link is invalid or has expired.', code: 'RECOVERY_OTP_INVALID' } };
    }
    return { ready: Boolean(data?.session), session: data?.session || null, error: null };
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) {
      return { ready: false, error: { message: error.message || 'Unable to verify recovery link.', code: 'RECOVERY_SESSION_ERROR' } };
    }
    return { ready: Boolean(data?.session), session: data?.session || null, error: null };
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const msg = String(error.message || '').toLowerCase().includes('code verifier')
        ? 'This reset link was opened on a different browser or device than the one that requested it. Request a fresh reset link below — new links work on any device.'
        : (error.message || 'This reset link is invalid or has expired.');
      return { ready: false, error: { message: msg, code: 'RECOVERY_CODE_ERROR' } };
    }
    return { ready: Boolean(data?.session), session: data?.session || null, error: null };
  }

  return { ready: false, session: null, error: null };
}

export async function updateRecoveredPassword(newPassword) {
  const supabase = await getSupabase();
  if (!supabase) {
    return { data: null, error: { message: 'Authentication service is not configured yet.' } };
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return { data: null, error: { message: 'Password must be between 8 and 128 characters.' } };
  }
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { data: null, error };
  }
  try {
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch {
    // Ignore history error
  }
  await supabase.auth.signOut().catch(() => {});
  try {
    localStorage.removeItem('nortava-user');
    localStorage.removeItem('nortava-admin-session');
  } catch {
    // Ignore storage error
  }
  return { data, error: null };
}

async function createUserProfile(userId, email, name, role, phone) {
  const supabase = await getSupabase();
  if (!supabase) return null;

  try {
    const safeRole = role === 'landlord' ? 'landlord' : 'tenant';
    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email,
        name: name || email.split('@')[0],
        role: safeRole,
        phone: phone || null
      }, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function logoutUser() {
  try {
    localStorage.removeItem('nortava-user');
    localStorage.removeItem('nortava-admin-session');
  } catch {
    // Ignore storage error
  }
  const supabase = await getSupabase();
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const supabase = await getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    try {
      localStorage.removeItem('nortava-user');
    } catch {
      // Ignore
    }
    return null;
  }

  const profile = await getUserProfile(data.user.id);
  const userData = {
    ...data.user,
    ...(profile || {}),
    role: profile?.role || data.user.user_metadata?.role || 'tenant',
    name: profile?.name || data.user.user_metadata?.name || data.user.email?.split('@')[0]
  };

  try {
    localStorage.setItem('nortava-user', JSON.stringify({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role
    }));
  } catch {
    // Ignore storage error
  }

  return userData;
}

export async function verifyAdminSession() {
  const token = await getAccessToken();
  if (!token) return { isAdmin: false };
  try {
    const res = await fetch('/api/admin/session', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return { isAdmin: false };
    return await res.json();
  } catch {
    return { isAdmin: false };
  }
}

export async function getUserProfile(userId) {
  const supabase = await getSupabase();
  if (!supabase || !userId) return null;
  const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  return data || null;
}

export async function updateUserProfile(userId, updates) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };

  const allowedUpdates = {
    name: updates.name,
    phone: updates.phone
  };
  const { data, error } = await supabase
    .from('users')
    .update(allowedUpdates)
    .eq('id', userId)
    .select()
    .maybeSingle();

  return { data, error };
}

// --- LISTINGS ---
export async function getAllListings(filters = {}) {
  const supabase = await getSupabase();
  if (!supabase) return { data: [], error: null };

  let query = supabase
    .from('listings')
    .select(`
      *,
      listing_images(*),
      users!user_id(name, verified, verification_tier)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.min_price) query = query.gte('price', filters.min_price);
  if (filters.max_price) query = query.lte('price', filters.max_price);
  if (filters.rooms) {
    query = Number(filters.rooms) >= 4
      ? query.gte('rooms', Number(filters.rooms))
      : query.eq('rooms', Number(filters.rooms));
  }
  if (filters.furnished) query = query.eq('furnished', true);
  if (filters.water) query = query.eq('water', true);
  if (filters.electricity) query = query.eq('electricity', true);
  if (filters.parking) query = query.eq('parking', true);
  if (filters.bathrooms) {
    query = Number(filters.bathrooms) >= 3
      ? query.gte('bathrooms', Number(filters.bathrooms))
      : query.eq('bathrooms', Number(filters.bathrooms));
  }

  const { data, error } = await query;
  let rows = data || [];
  if (!error && (filters.province || filters.city || filters.zone || filters.area || filters.location)) {
    rows = rows.filter(item =>
      matchesLocationFilter(item.location, {
        province: filters.province,
        city: filters.city,
        zone: filters.zone,
        area: filters.area,
        location: filters.location
      })
    );
  }
  return { data: rows, error };
}

export async function getSingleListing(id) {
  const supabase = await getSupabase();
  if (!supabase || !id) return { data: null, error: null };

  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      listing_images(*),
      users!user_id(id, name, verified, verification_tier)
    `)
    .eq('id', id)
    .maybeSingle();

  return { data, error };
}

export async function getListingById(id) {
  return getSingleListing(id);
}

export async function createListing(listingData) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };

  const user = await getCurrentUser();
  if (!user || !user.id) return { error: { message: 'Authentication required.' } };

  await createUserProfile(user.id, user.email, user.name, user.role, user.phone);

  const { data, error } = await supabase
    .from('listings')
    .insert({
      ...listingData,
      user_id: user.id,
      status: 'pending'
    })
    .select()
    .maybeSingle();

  return { data, error };
}

export async function updateListing(id, updates) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Authentication required.' } };

  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  return { data, error };
}

export async function deleteListing(id) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Authentication required.' } };

  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  return { error };
}

export async function getLandlordListings(landlordId) {
  const supabase = await getSupabase();
  if (!supabase || !landlordId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_images(*)')
    .eq('user_id', landlordId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

// --- IMAGES ---
export async function uploadListingImage(listingId, file) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Storage service not configured.' } };

  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) {
    return { error: { message: 'Only JPG, PNG, or WebP images are allowed.' } };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: { message: 'Image must be smaller than 5MB.' } };
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${listingId}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('listing-images')
    .upload(fileName, file, { upsert: true });

  if (uploadError) return { error: uploadError };

  const { data } = supabase.storage.from('listing-images').getPublicUrl(fileName);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) return { error: { message: 'Failed to generate image URL.' } };

  const { data: dbData, error: dbError } = await supabase
    .from('listing_images')
    .insert({ listing_id: listingId, image_url: publicUrl })
    .select()
    .maybeSingle();

  if (dbError) return { error: dbError };
  return { data: dbData, error: null };
}

export async function deleteListingImage(imageId) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };
  const { error } = await supabase.from('listing_images').delete().eq('id', imageId);
  return { error };
}

// --- SAVED LISTINGS ---
export async function saveListing(listingId) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Authentication required.' } };

  const { data, error } = await supabase
    .from('saved_listings')
    .insert({ user_id: user.id, listing_id: listingId })
    .select()
    .maybeSingle();
  return { data, error };
}

export async function unsaveListing(listingId) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Authentication required.' } };

  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_id', listingId);
  return { error };
}

export async function getSavedListings() {
  const supabase = await getSupabase();
  if (!supabase) return { data: [], error: null };
  const user = await getCurrentUser();
  if (!user) return { data: [], error: null };

  const { data, error } = await supabase
    .from('saved_listings')
    .select('*, listings(*, listing_images(*))')
    .eq('user_id', user.id);
  return { data: data || [], error };
}

export async function checkIfSaved(listingId) {
  const supabase = await getSupabase();
  if (!supabase) return false;
  const user = await getCurrentUser();
  if (!user) return false;

  const { data } = await supabase
    .from('saved_listings')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle();
  return Boolean(data);
}

// --- UNLOCKS ---
export async function getLandlordUnlocks(landlordId) {
  const supabase = await getSupabase();
  if (!supabase || !landlordId) return { data: [], error: null };

  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id')
    .eq('user_id', landlordId);
  if (listingsError) return { data: [], error: listingsError };

  const listingIds = listings?.map(l => l.id) || [];
  if (!listingIds.length) return { data: [], error: null };

  const { data, error } = await supabase
    .from('unlocks')
    .select('*, users(id, name), listings(id, title)')
    .in('listing_id', listingIds)
    .eq('status', 'completed')
    .order('unlocked_at', { ascending: false });

  return { data: data || [], error };
}

export async function getUnlockedContacts(userId = null) {
  const supabase = await getSupabase();
  if (!supabase) return { data: [], error: null };

  let targetUserId = userId;
  if (!targetUserId) {
    const user = await getCurrentUser();
    if (!user) return { data: [], error: null };
    targetUserId = user.id;
  }

  const { data, error } = await supabase
    .from('unlocks')
    .select('*, listings(*, users(name, phone, email))')
    .eq('user_id', targetUserId)
    .eq('status', 'completed')
    .order('unlocked_at', { ascending: false });

  return { data: data || [], error };
}

export async function checkIfUnlocked(listingId) {
  const supabase = await getSupabase();
  if (!supabase || !listingId) return { unlocked: false, landlordContact: null };
  const user = await getCurrentUser();
  if (!user) return { unlocked: false, landlordContact: null };

  const { data } = await supabase
    .from('unlocks')
    .select('id, status, listings(users(phone, email, name))')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .eq('status', 'completed')
    .maybeSingle();

  return {
    unlocked: Boolean(data),
    landlordContact: data?.listings?.users || null
  };
}

// --- REALTIME SUBSCRIPTIONS ---
const subscriptions = {};

export function subscribeToListings(callback) {
  getSupabase().then(supabase => {
    if (!supabase) return;
    const subscription = supabase
      .channel('listings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, callback)
      .subscribe();
    subscriptions.listings = subscription;
  });
  return 'listings';
}

export function subscribeToUnlocks(landlordId, callback) {
  const channelKey = `unlocks-${landlordId}`;
  getSupabase().then(supabase => {
    if (!supabase) return;
    const subscription = supabase
      .channel(channelKey)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'unlocks' }, callback)
      .subscribe();
    subscriptions[channelKey] = subscription;
  });
  return channelKey;
}

export async function unsubscribe(channelOrSubscription) {
  const supabase = await getSupabase();
  if (!supabase || !channelOrSubscription) return;

  if (typeof channelOrSubscription === 'string' && subscriptions[channelOrSubscription]) {
    await supabase.removeChannel(subscriptions[channelOrSubscription]);
    delete subscriptions[channelOrSubscription];
  } else if (typeof channelOrSubscription === 'object') {
    await supabase.removeChannel(channelOrSubscription).catch(() => {});
  }
}

// --- ADMIN (SERVER-ENFORCED) ---
async function adminFetch(path, options = {}) {
  const token = await getAccessToken();
  if (!token) return { data: null, error: { message: 'Authentication required.' } };

  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: null, error: { message: payload.error || 'Admin request failed.' } };
  }
  return { data: payload, error: null };
}

export async function getAdminOverview() {
  return adminFetch('/api/admin/overview');
}

export async function verifyLandlord(userId, tier = 'silver') {
  return adminFetch('/api/admin/verify-landlord', {
    method: 'POST',
    body: JSON.stringify({ userId, tier })
  });
}

export async function rejectLandlord(userId, reason) {
  return adminFetch('/api/admin/reject-landlord', {
    method: 'POST',
    body: JSON.stringify({ userId, reason })
  });
}

export async function aiVerifyLandlord(userId) {
  return adminFetch('/api/admin/ai-verify-landlord', {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
}

export async function fetchAdminLandlordDoc(userId, docKind) {
  const token = await getAccessToken();
  if (!token) return { blobUrl: null, mimeType: '', error: { message: 'Authentication required.' } };

  const res = await fetch(`/api/admin/landlord-doc?userId=${encodeURIComponent(userId)}&doc=${encodeURIComponent(docKind)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    return { blobUrl: null, mimeType: '', error: { message: payload.error || 'Document unavailable.' } };
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, mimeType: blob.type || '', error: null };
}

export async function getLandlordVerificationStatus() {
  const token = await getAccessToken();
  if (!token) return { data: null, error: { message: 'Authentication required.' } };

  const res = await fetch('/api/landlord/verification-status', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: null, error: { message: payload.error || 'Unable to load verification status.' } };
  }
  return { data: payload, error: null };
}

export async function submitLandlordVerification(kycPayload) {
  const token = await getAccessToken();
  if (!token) return { data: null, error: { message: 'Authentication required.' } };

  const res = await fetch('/api/landlord/verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(kycPayload)
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: null, error: { message: payload.error || 'Failed to submit verification documents.' } };
  }
  return { data: payload, error: null };
}

export async function approveListing(listingId) {
  return adminFetch('/api/admin/approve-listing', {
    method: 'POST',
    body: JSON.stringify({ listingId })
  });
}

export async function updateReportStatus(reportId, status = 'resolved') {
  return adminFetch('/api/admin/resolve-report', {
    method: 'POST',
    body: JSON.stringify({ reportId, status })
  });
}

export async function adminDeleteListing(listingId) {
  return adminFetch(`/api/admin/listings/${encodeURIComponent(listingId)}`, {
    method: 'DELETE'
  });
}

// --- REVIEWS & RATINGS ---
export async function createReview(listingId, rating, comment) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Authentication required.' } };

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      listing_id: listingId,
      user_id: user.id,
      rating,
      comment
    })
    .select()
    .maybeSingle();

  return { data, error };
}

export async function getListingReviews(listingId) {
  const supabase = await getSupabase();
  if (!supabase || !listingId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('reviews')
    .select('*, users(name)')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function getPaymentHistory(userId) {
  const supabase = await getSupabase();
  if (!supabase || !userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('unlocks')
    .select('*, listings(title, location, listing_images(*))')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });
  return { data: data || [], error };
}

// --- SAVED SEARCHES ---
export async function saveSearch(searchParams, name) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Authentication required.' } };

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({ user_id: user.id, name, params: searchParams })
    .select()
    .maybeSingle();

  return { data, error };
}

export async function getSavedSearches() {
  const supabase = await getSupabase();
  if (!supabase) return { data: [], error: null };
  const user = await getCurrentUser();
  if (!user) return { data: [], error: null };

  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function deleteSavedSearch(searchId) {
  const supabase = await getSupabase();
  if (!supabase) return { error: { message: 'Database service not configured.' } };
  const { error } = await supabase.from('saved_searches').delete().eq('id', searchId);
  return { error };
}

// --- INCREMENT VIEWS (CONSENT-GATED) ---
export async function incrementListingViews(listingId) {
  const supabase = await getSupabase();
  if (!supabase || !listingId) return { error: null };
  const { error } = await supabase.rpc('increment_views', { listing_id: listingId });
  return { error };
}

// --- SERVER-SIDE PAYMENTS ---
export async function createPayment(listingId, method, phone, oneTimeAcknowledged) {
  const token = await getAccessToken();
  if (!token) {
    return { data: null, error: { message: 'Please login to complete your payment.' } };
  }

  const res = await fetch('/api/payments/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ listingId, method, phone, oneTimeAcknowledged })
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: null, error: { message: payload.error || 'Payment could not be initiated.', code: payload.code } };
  }
  return { data: payload.data, sandbox: payload.sandbox, error: null };
}

export async function verifyPayment(reference) {
  const token = await getAccessToken();
  if (!token) {
    return { data: null, error: { message: 'Authentication required.' } };
  }
  const res = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ reference })
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: null, error: { message: payload.error || 'Payment verification failed.' } };
  }
  return { data: payload.data, error: null };
}

// --- REPORT LISTING (SERVER-SIDE COPPA GUARD) ---
export async function reportListing({ listingId, listingUrl, reason, details, contactEmail, birthYear, birthMonth }) {
  const token = await getAccessToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/reports', {
    method: 'POST',
    headers,
    body: JSON.stringify({ listingId, listingUrl, reason, details, contactEmail, birthYear, birthMonth })
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: null, error: { message: payload.error || 'Failed to submit report.', code: payload.code } };
  }
  return { data: payload, error: null };
}
