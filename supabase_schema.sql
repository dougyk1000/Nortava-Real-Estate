-- ===== NORTAVA DATABASE SCHEMA =====
-- Copy and paste this entire script into your Supabase SQL Editor
-- Go to: Supabase Dashboard -> Your Project -> SQL Editor -> New Query

-- Users (extends Supabase auth; stores boolean age_verified only, never full DOB)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'tenant' CHECK (role IN ('tenant', 'landlord', 'admin')),
  verified BOOLEAN DEFAULT false,
  verification_tier TEXT CHECK (verification_tier IN ('bronze', 'silver', 'gold') OR verification_tier IS NULL),
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'approved', 'rejected')),
  age_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Public non-PII profile projection (excludes email and phone)
CREATE OR REPLACE VIEW public_profiles AS
  SELECT id, name, verified, verification_tier
  FROM users;

GRANT SELECT ON public_profiles TO anon, authenticated;

-- Landlord KYC & Ownership Verification (Title Deeds, National ID, Anti-Scam Hash & AI/Admin Audit)
CREATE TABLE IF NOT EXISTS landlord_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  national_id_number TEXT NOT NULL,
  ownership_capacity TEXT NOT NULL DEFAULT 'owner' CHECK (ownership_capacity IN ('owner', 'cession_holder', 'authorized_representative', 'registered_agent')),
  property_province TEXT,
  property_city TEXT,
  property_area TEXT,
  property_address TEXT NOT NULL,
  title_deed_path TEXT NOT NULL,
  national_id_path TEXT NOT NULL,
  rates_bill_path TEXT,
  title_deed_sha256 TEXT NOT NULL,
  national_id_sha256 TEXT NOT NULL,
  anti_fraud_attested BOOLEAN NOT NULL DEFAULT false,
  duplicate_warnings JSONB DEFAULT '[]'::jsonb,
  ai_status TEXT DEFAULT 'pending_ai_screening',
  ai_confidence INTEGER DEFAULT 0,
  ai_document_match BOOLEAN,
  ai_extracted_owner TEXT,
  ai_extracted_id TEXT,
  ai_extracted_property TEXT,
  ai_red_flags JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  ai_screened_at TIMESTAMPTZ,
  admin_status TEXT NOT NULL DEFAULT 'pending' CHECK (admin_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Listings
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'rent' CHECK (type IN ('rent', 'sale')),
  price DECIMAL NOT NULL CHECK (price >= 0),
  rooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  size TEXT,
  location TEXT NOT NULL,
  description TEXT,
  views INTEGER DEFAULT 0,
  furnished BOOLEAN DEFAULT false,
  water BOOLEAN DEFAULT false,
  electricity BOOLEAN DEFAULT false,
  parking BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'published')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Listing Images (max 3 per listing)
CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unlocks (one-time $2.50 payments; server-verified settlement)
CREATE TABLE IF NOT EXISTS unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  amount DECIMAL DEFAULT 2.50 CHECK (amount >= 0),
  payment_method TEXT,
  payment_ref TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  unlocked_at TIMESTAMPTZ DEFAULT now()
);

-- Saved Listings
CREATE TABLE IF NOT EXISTS saved_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  reason TEXT,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reviews (for rating properties/landlords)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Saved Searches (for search alerts)
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  params JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contact Messages (submitted through server /api/contact with COPPA check)
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DMCA Takedown Reports (submitted through server /api/dmca with COPPA check)
CREATE TABLE IF NOT EXISTS dmca_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id TEXT UNIQUE,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  work_description TEXT NOT NULL,
  infringing_url TEXT NOT NULL,
  electronic_signature TEXT NOT NULL,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'reviewing', 'removed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email Suppression List (CAN-SPAM / RFC 8058)
CREATE TABLE IF NOT EXISTS email_suppression (
  email TEXT PRIMARY KEY,
  suppressed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security on ALL tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dmca_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppression ENABLE ROW LEVEL SECURITY;

-- Increment views function (published listings only)
CREATE OR REPLACE FUNCTION increment_views(listing_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE listings
  SET views = COALESCE(views, 0) + 1
  WHERE id = listing_id AND status = 'published';
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(location);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_landlord_verifications_status ON landlord_verifications(admin_status);
CREATE INDEX IF NOT EXISTS idx_landlord_verifications_deed_hash ON landlord_verifications(title_deed_sha256);
CREATE INDEX IF NOT EXISTS idx_landlord_verifications_nat_id ON landlord_verifications(national_id_number);
CREATE INDEX IF NOT EXISTS idx_unlocks_user_id ON unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocks_listing_id ON unlocks(listing_id);
CREATE INDEX IF NOT EXISTS idx_unlocks_payment_ref ON unlocks(payment_ref);
CREATE INDEX IF NOT EXISTS idx_saved_listings_user_id ON saved_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
