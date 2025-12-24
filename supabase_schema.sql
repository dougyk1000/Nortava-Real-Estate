-- ===== NORTAVA DATABASE SCHEMA =====
-- Copy and paste this entire script into your Supabase SQL Editor
-- Go to: Supabase Dashboard → Your Project → SQL Editor → New Query

-- Users (extends Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'tenant', -- tenant, landlord, admin
  verified BOOLEAN DEFAULT false,
  verification_tier TEXT, -- bronze, silver, gold
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Listings
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'rent', -- rent, sale
  price DECIMAL NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Listing Images (max 3 per listing)
CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unlocks (payments)
CREATE TABLE IF NOT EXISTS unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  amount DECIMAL DEFAULT 2.50,
  payment_method TEXT,
  payment_ref TEXT,
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
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  reason TEXT,
  details TEXT,
  status TEXT DEFAULT 'pending',
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

-- Enable RLS (Row Level Security) if needed
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Increment views function
CREATE OR REPLACE FUNCTION increment_views(listing_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE listings SET views = views + 1 WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(location);
CREATE INDEX IF NOT EXISTS idx_unlocks_user_id ON unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocks_listing_id ON unlocks(listing_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_user_id ON saved_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
