import { createClient } from '@supabase/supabase-js'

// --- CONFIG ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xevualxnbklzbokqnole.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldnVhbHhuYmtsemJva3Fub2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5OTEyNjIsImV4cCI6MjA4MTU2NzI2Mn0.vNp1CleuKXFnC_-01-tJs5UneeqOjplXt3jxMossIHE' 
const supabase =  createClient(supabaseUrl, supabaseKey)

// --- UTILITY CHECK ---
function checkSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key not configured!')
    return false
  }
  return true
}

// --- AUTH ---
export async function loginUser(email, password) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { data: null, error }
  
  if (data?.user) {
    const profile = await getUserProfile(data.user.id)
    const userData = { ...data.user, ...profile }
    localStorage.setItem('nortava-user', JSON.stringify(userData))
  }
  
  return { data, error }
}

export async function registerUser(email, password, name, role, phone = '') {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role, phone } }
  })
  if (error) return { data: null, error }
  
  if (data?.user) {
    // Store in localStorage first - profile will be created lazily on first use
    const userData = { 
      id: data.user.id,
      email,
      name,
      role: role || 'tenant',
      phone,
      user_metadata: data.user.user_metadata
    }
    localStorage.setItem('nortava-user', JSON.stringify(userData))
    
    // Try to create profile in background, but don't fail registration if it doesn't work
    setTimeout(() => {
      createUserProfile(data.user.id, email, name, role, phone)
        .catch(err => console.log('Background profile creation will retry on first use:', err.message))
    }, 100)
  }
  
  return { data, error }
}

// Helper function to create or update user profile
async function createUserProfile(userId, email, name, role, phone) {
  if (!checkSupabase()) return null
  
  try {
    // Try upsert instead of insert to avoid conflicts
    const { data, error } = await supabase.from('users').upsert({
      id: userId,
      email,
      name: name || email.split('@')[0],
      role: role || 'tenant',
      phone: phone || null
    }, { onConflict: 'id' }).select().maybeSingle()
    
    if (error) {
      console.error('User profile creation error:', error)
      return null
    }
    return data
  } catch (err) {
    console.error('User profile creation failed:', err)
    return null
  }
}

export async function logoutUser() {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  localStorage.removeItem('nortava-user')
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const cached = localStorage.getItem('nortava-user')
  if (cached) return JSON.parse(cached)
  if (!checkSupabase()) return null
  
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  
  const profile = await getUserProfile(data.user.id)
  const userData = { ...data.user, ...profile }
  localStorage.setItem('nortava-user', JSON.stringify(userData))
  return userData
}

export async function getUserProfile(userId) {
  if (!checkSupabase()) return null
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  if (error) console.error('getUserProfile error:', error)
  return data
}

export async function updateUserProfile(userId, updates) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  
  const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().maybeSingle()
  if (data) {
    const current = JSON.parse(localStorage.getItem('nortava-user') || '{}')
    localStorage.setItem('nortava-user', JSON.stringify({ ...current, ...data }))
  }
  return { data, error }
}

// --- LISTINGS ---
export async function getAllListings(filters = {}) {
  if (!checkSupabase()) return { data: [], error: null }
  
  let query = supabase.from('listings').select(`
    *,
    listing_images(*),
    users!user_id(name, phone, verified, verification_tier)
  `).order('created_at', { ascending: false })
  
  // Only show published listings to normal users
  const user = await getCurrentUser();
  const adminEmail = 'douglasnkowo3036@gmail.com';
  if (!user || user.email !== adminEmail) {
    query = query.eq('status', 'published')
  }

  if (filters.type) query = query.eq('type', filters.type)
  if (filters.min_price) query = query.gte('price', filters.min_price)
  if (filters.max_price) query = query.lte('price', filters.max_price)
  if (filters.rooms) query = query.eq('rooms', filters.rooms)
  if (filters.location) query = query.ilike('location', `%${filters.location}%`)
  if (filters.furnished) query = query.eq('furnished', true)
  if (filters.water) query = query.eq('water', true)
  if (filters.electricity) query = query.eq('electricity', true)
  if (filters.parking) query = query.eq('parking', true)
  if (filters.bathrooms) query = query.eq('bathrooms', filters.bathrooms)
  
  const { data, error } = await query
  return { data: data || [], error }
}

export async function getSingleListing(id) {
  if (!checkSupabase()) return { data: null, error: null }
  
  const { data, error } = await supabase.from('listings').select(`
    *,
    listing_images(*),
    users!user_id(id, name, phone, email)
  `).eq('id', id).maybeSingle()
  
  return { data, error }
}

export async function getListingById(id) {
  return getSingleListing(id)
}

export async function createListing(listingData) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const user = await getCurrentUser()
  if (!user) return { error: { message: 'Not authenticated' } }
  if (!user.id) {
    console.error('CRITICAL: User ID missing. User object:', user)
    return { error: { message: 'User ID not found - registration may have failed. Try logging out and registering again.' } }
  }
  
  // Ensure user profile exists before creating listing
  const profileCreated = await createUserProfile(user.id, user.email, user.name, user.role, user.phone)
  
  // New listings start as 'pending'
  const { data, error } = await supabase.from('listings').insert({
    ...listingData,
    user_id: user.id,
    status: 'pending'
  }).select().maybeSingle()
  
  if (error) {
    console.error('Listing creation error:', error)
    if (error.message.includes('foreign key')) {
      console.error('User ID does not exist in users table:', user.id, '- profile creation may have failed')
      return { data: null, error: { message: 'Please log out and log back in, then try again.' } }
    }
  }
  
  if (data) {
    // Notify admin
    const adminEmail = 'douglasnkowo3036@gmail.com';
    const { data: admin } = await supabase.from('users').select('id').eq('email', adminEmail).maybeSingle();
    if (admin) {
      await createAdminNotification(admin.id, 'New Listing Pending', `A new listing "${listingData.title}" requires verification.`);
    }
  }
  
  return { data, error }
}

export async function updateListing(id, updates) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const { data, error } = await supabase.from('listings').update(updates).eq('id', id).select().maybeSingle()
  return { data, error }
}

export async function deleteListing(id) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const { error } = await supabase.from('listings').delete().eq('id', id)
  return { error }
}

export async function getLandlordListings(landlordId) {
  if (!checkSupabase()) return { data: [], error: null }
  const { data, error } = await supabase.from('listings').select('*, listing_images(*)').eq('user_id', landlordId).order('created_at', { ascending: false })
  return { data: data || [], error }
}

// --- IMAGES ---
export async function uploadListingImage(listingId, file) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  
  try {
    const fileName = `${listingId}/${Date.now()}-${file.name}`
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('listing-images')
      .upload(fileName, file, { upsert: true })
    
    if (uploadError) {
      console.error('Storage upload error:', {
        message: uploadError.message,
        status: uploadError.status,
        statusText: uploadError.statusText
      })
      return { error: uploadError }
    }
    
    // Get public URL
    const { data } = supabase.storage.from('listing-images').getPublicUrl(fileName)
    const publicUrl = data?.publicUrl
    
    if (!publicUrl) {
      return { error: { message: 'Failed to generate public URL' } }
    }
    
    // Save image reference to database
    const { data: dbData, error: dbError } = await supabase.from('listing_images').insert({ 
      listing_id: listingId, 
      image_url: publicUrl 
    }).select().maybeSingle()
    
    if (dbError) {
      console.error('Database error:', dbError)
      return { error: dbError }
    }
    
    return { data: dbData, error: null }
  } catch (err) {
    console.error('Upload exception:', err)
    return { error: { message: err.message || 'Upload failed' } }
  }
}

export async function deleteListingImage(imageId) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const { error } = await supabase.from('listing_images').delete().eq('id', imageId)
  return { error }
}

// --- SAVED LISTINGS ---
export async function saveListing(listingId) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const user = await getCurrentUser()
  if (!user) return { error: { message: 'Not authenticated' } }
  
  const { data, error } = await supabase.from('saved_listings').insert({ user_id: user.id, listing_id }).select().maybeSingle()
  return { data, error }
}

export async function unsaveListing(listingId) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const user = await getCurrentUser()
  if (!user) return { error: { message: 'Not authenticated' } }
  
  const { error } = await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('listing_id', listingId)
  return { error }
}

export async function getSavedListings() {
  if (!checkSupabase()) return { data: [], error: null }
  const user = await getCurrentUser()
  if (!user) return { data: [], error: null }
  
  const { data, error } = await supabase.from('saved_listings').select('*, listings(*, listing_images(*))').eq('user_id', user.id)
  return { data: data || [], error }
}

export async function checkIfSaved(listingId) {
  if (!checkSupabase()) return false
  const user = await getCurrentUser()
  if (!user) return false
  
  const { data } = await supabase.from('saved_listings').select('id').eq('user_id', user.id).eq('listing_id', listingId).maybeSingle()
  return !!data
}

// --- UNLOCKS ---
export async function getLandlordUnlocks(landlordId) {
  if (!checkSupabase()) return { data: [], error: null }
  
  // Get all listings for the landlord first
  const { data: listings, error: listingsError } = await supabase.from('listings').select('id').eq('user_id', landlordId)
  if (listingsError) return { data: [], error: listingsError }
  
  const listingIds = listings?.map(l => l.id) || []
  if (!listingIds.length) return { data: [], error: null }
  
  // Get unlocks for those listings
  const { data, error } = await supabase.from('unlocks').select('*, users(id, name, email, phone), listings(id, title)').in('listing_id', listingIds).order('unlocked_at', { ascending: false })
  return { data: data || [], error }
}

export async function getUnlockedContacts(userId) {
  if (!checkSupabase()) return { data: [], error: null }
  const { data, error } = await supabase.from('unlocks').select('*, listings(*, users(name, phone, email))').eq('user_id', userId).order('unlocked_at', { ascending: false })
  return { data: data || [], error }
}

export async function checkIfUnlocked(listingId) {
  if (!checkSupabase()) return false
  const user = await getCurrentUser()
  if (!user) return false
  
  const { data } = await supabase.from('unlocks').select('id').eq('user_id', user.id).eq('listing_id', listingId).maybeSingle()
  return !!data
}

// --- REALTIME SUBSCRIPTIONS ---
const subscriptions = {}

export function subscribeToListings(callback) {
  const subscription = supabase
    .channel('listings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, callback)
    .subscribe()
  subscriptions.listings = subscription
  return subscription
}

export function subscribeToUnlocks(landlordId, callback) {
  const subscription = supabase
    .channel(`unlocks-${landlordId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'unlocks', filter: `listing_id=eq.${landlordId}` }, callback)
    .subscribe()
  subscriptions[`unlocks-${landlordId}`] = subscription
  return subscription
}

export async function unsubscribe(channel) {
  if (subscriptions[channel]) {
    await supabase.removeChannel(subscriptions[channel])
    delete subscriptions[channel]
  }
}

// --- ADMIN ---
export async function getAdminStats() {
  if (!checkSupabase()) return { data: {}, error: null }
  
  const [users, listings, unlocks, reports] = await Promise.all([
    supabase.from('users').select('id'),
    supabase.from('listings').select('id'),
    supabase.from('unlocks').select('id'),
    supabase.from('reports').select('id')
  ])
  
  const verifiedLandlords = (await supabase.from('users').select('id').eq('role', 'landlord').eq('verified', true)).data?.length || 0;

  return {
    data: {
      totalUsers: users.data?.length || 0,
      totalListings: listings.data?.length || 0,
      totalUnlocks: unlocks.data?.length || 0,
      pendingReports: reports.data?.length || 0,
      verifiedLandlords
    },
    error: null
  }
}

export async function getAllUsers() {
  if (!checkSupabase()) return { data: [], error: null }
  const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function resetDatabase() {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  
  // This is a destructive action and should be handled with care
  const tables = ['unlocks', 'reports', 'reviews', 'saved_listings', 'listing_images', 'listings'];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return { error };
  }
  
  return { success: true };
}

export async function createAdminNotification(userId, title, message) {
  if (!checkSupabase()) return { error: null }
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    read: false
  })
  return { error }
}

export async function approveListing(listingId) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const { data, error } = await supabase.from('listings').update({ status: 'published' }).eq('id', listingId).select().maybeSingle()
  return { data, error }
}

export async function verifyLandlord(userId) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const { data, error } = await supabase.from('users').update({ verified: true }).eq('id', userId).select().maybeSingle()
  return { data, error }
}

export async function getReports() {
  if (!checkSupabase()) return { data: [], error: null }
  const { data, error } = await supabase.from('reports').select('*, users(name, email), listings(title)').order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function updateReportStatus(reportId, status) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const { data, error } = await supabase.from('reports').update({ status }).eq('id', reportId).select().maybeSingle()
  return { data, error }
}

// --- REVIEWS & RATINGS ---
export async function createReview(listingId, rating, comment) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const user = await getCurrentUser()
  if (!user) return { error: { message: 'Not authenticated' } }
  
  const { data, error } = await supabase.from('reviews').insert({
    listing_id: listingId,
    user_id: user.id,
    rating,
    comment
  }).select().maybeSingle()
  
  return { data, error }
}

export async function getListingReviews(listingId) {
  if (!checkSupabase()) return { data: [], error: null }
  const { data, error } = await supabase.from('reviews').select('*, users(name)').eq('listing_id', listingId).order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function getLandlordReviews(landlordId) {
  if (!checkSupabase()) return { data: [], error: null }
  const { data: listings } = await supabase.from('listings').select('id').eq('user_id', landlordId)
  if (!listings?.length) return { data: [], error: null }
  
  const listingIds = listings.map(l => l.id)
  const { data, error } = await supabase.from('reviews').select('*, users(name), listings(title)').in('listing_id', listingIds).order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function getAverageRating(listingId) {
  if (!checkSupabase()) return { data: 0, error: null }
  const { data, error } = await supabase.from('reviews').select('rating').eq('listing_id', listingId)
  if (!data?.length) return { data: 0, error }
  
  const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length
  return { data: Math.round(avg * 10) / 10, error }
}

// --- PAYMENT HISTORY ---
export async function getPaymentHistory(userId) {
  if (!checkSupabase()) return { data: [], error: null }
  const { data, error } = await supabase.from('unlocks').select('*, listings(title, location, listing_images(*))').eq('user_id', userId).order('unlocked_at', { ascending: false })
  return { data: data || [], error }
}

export async function createPaymentRecord(listingId, paymentMethod, paymentRef) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const user = await getCurrentUser()
  if (!user) return { error: { message: 'Not authenticated' } }
  
  const { data, error } = await supabase.from('unlocks').insert({
    user_id: user.id,
    listing_id: listingId,
    amount: 2.50,
    payment_method: paymentMethod,
    payment_ref: paymentRef
  }).select().maybeSingle()
  
  return { data, error }
}

// --- SAVED SEARCHES / WISHLISTS ---
export async function saveSearch(searchParams, name) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const user = await getCurrentUser()
  if (!user) return { error: { message: 'Not authenticated' } }
  
  const { data, error } = await supabase.from('saved_searches').insert({
    user_id: user.id,
    name,
    params: searchParams
  }).select().maybeSingle()
  
  return { data, error }
}

export async function getSavedSearches() {
  if (!checkSupabase()) return { data: [], error: null }
  const user = await getCurrentUser()
  if (!user) return { data: [], error: null }
  
  const { data, error } = await supabase.from('saved_searches').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function deleteSavedSearch(searchId) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const { error } = await supabase.from('saved_searches').delete().eq('id', searchId)
  return { error }
}

// --- LANDLORD ANALYTICS ---
export async function getLandlordAnalytics(landlordId) {
  if (!checkSupabase()) return { data: {}, error: null }
  
  const [listingsRes, unlocksRes] = await Promise.all([
    supabase.from('listings').select('id, views, created_at').eq('user_id', landlordId),
    supabase.from('unlocks').select('*, listings!inner(user_id)').eq('listings.user_id', landlordId)
  ])
  
  const listings = listingsRes.data || []
  const unlocks = unlocksRes.data || []
  
  const totalViews = listings.reduce((sum, l) => sum + (l.views || 0), 0)
  const totalUnlocks = unlocks.length
  const totalEarnings = totalUnlocks * 2.50
  const conversionRate = totalViews > 0 ? ((totalUnlocks / totalViews) * 100).toFixed(1) : 0
  
  // Weekly stats
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const recentUnlocks = unlocks.filter(u => new Date(u.unlocked_at) > weekAgo).length
  
  return {
    data: {
      totalListings: listings.length,
      totalViews,
      totalUnlocks,
      totalEarnings,
      conversionRate,
      weeklyUnlocks: recentUnlocks,
      weeklyEarnings: recentUnlocks * 2.50
    },
    error: null
  }
}

// --- VERIFICATION TIERS ---
export async function setVerificationTier(userId, tier) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const { data, error } = await supabase.from('users').update({ verification_tier: tier, verified: true }).eq('id', userId).select().maybeSingle()
  return { data, error }
}

// --- INCREMENT VIEWS ---
export async function incrementListingViews(listingId) {
  if (!checkSupabase()) return { error: null }
  const { error } = await supabase.rpc('increment_views', { listing_id: listingId })
  return { error }
}

// --- NOTIFICATIONS ---
export async function getUnreadNotifications(userId) {
  if (!checkSupabase()) return { data: [], error: null }
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).eq('read', false).order('created_at', { ascending: false })
  return { data: data || [], error }
}

// --- PAYMENTS ---
export async function createPayment(listingId, amount, method) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const user = await getCurrentUser()
  if (!user) return { error: { message: 'Not authenticated' } }
  
  const reference = `PAY-${Date.now()}-${Math.random().toString(36).substring(7)}`
  
  const { data, error } = await supabase.from('unlocks').insert({
    user_id: user.id,
    listing_id: listingId,
    amount: amount,
    payment_method: method,
    payment_ref: reference,
    status: 'pending'
  }).select().maybeSingle()
  
  if (error) return { data: null, error }
  return { data: { ...data, reference }, error: null }
}

export async function verifyPayment(reference) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  
  const { data, error } = await supabase.from('unlocks')
    .update({ status: 'completed' })
    .eq('payment_ref', reference)
    .select()
    .maybeSingle()
  
  if (error) return { data: null, error }
  return { data, error: null }
}

// --- REPORT LISTING ---
export async function reportListing(listingId, reason, details) {
  if (!checkSupabase()) return { error: { message: 'Supabase not configured' } }
  const user = await getCurrentUser()
  
  const { data, error } = await supabase.from('reports').insert({
    listing_id: listingId,
    user_id: user?.id || null,
    reason,
    details,
    status: 'pending'
  }).select().maybeSingle()
  
  return { data, error }
}
