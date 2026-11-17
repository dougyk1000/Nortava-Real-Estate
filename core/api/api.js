import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;
let configPromise = null;

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
    return { data: null, error: { message: 'Authentication service is not configured yet.' } };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { data: null, error };

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

export async function registerUser({ email, password, name, role, phone = '', birthYear, birthMonth, termsAccepted }) {
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
        termsAccepted
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

export async function requestPasswordReset(email) {
  const supabase = await getSupabase();
  if (!supabase) {
    return { error: { message: 'Authentication service is not configured yet.' } };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/login.html`
  });
  return { error };
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
  if (filters.rooms) query = query.eq('rooms', filters.rooms);
  if (filters.location) query = query.ilike('location', `%${filters.location}%`);
  if (filters.furnished) query = query.eq('furnished', true);
  if (filters.water) query = query.eq('water', true);
  if (filters.electricity) query = query.eq('electricity', true);
  if (filters.parking) query = query.eq('parking', true);
  if (filters.bathrooms) query = query.eq('bathrooms', filters.bathrooms);

  const { data, error } = await query;
  return { data: data || [], error };
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

export async function verifyLandlord(userId) {
  return adminFetch('/api/admin/verify-landlord', {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
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
