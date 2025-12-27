-- ===== ROW LEVEL SECURITY POLICIES FOR NORTAVA =====
-- Run this in Supabase SQL Editor AFTER enabling RLS on all tables

-- Users table - Allow users to see and edit their own profile
CREATE POLICY "Users can view their own profile" ON users 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users 
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Public read access for user names (for landlord display)
CREATE POLICY "Public can view user names and verification" ON users
  FOR SELECT USING (true);

-- Listings table - Allow anyone to view published listings
CREATE POLICY "Anyone can view published listings" ON listings
  FOR SELECT USING (status = 'published' OR auth.uid() = user_id);

CREATE POLICY "Users can create their own listings" ON listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings" ON listings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listings" ON listings
  FOR DELETE USING (auth.uid() = user_id);

-- Listing images - Allow viewing images for visible listings
CREATE POLICY "Anyone can view listing images" ON listing_images
  FOR SELECT USING (true);

CREATE POLICY "Users can upload images for their listings" ON listing_images
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM listings WHERE listings.id = listing_id AND listings.user_id = auth.uid()
  ));

-- Unlocks (payments) - Users can see their own unlocks
CREATE POLICY "Users can view their own unlocks" ON unlocks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create unlocks" ON unlocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Saved listings - Users can manage their own saved listings
CREATE POLICY "Users can view their own saved listings" ON saved_listings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save listings" ON saved_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete saved listings" ON saved_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Reports - Users can create reports, admins can view all
CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT USING (auth.uid() = user_id);

-- Reviews - Anyone can view, users can create their own
CREATE POLICY "Anyone can view reviews" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- Saved searches - Users can manage their own
CREATE POLICY "Users can view their own saved searches" ON saved_searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create saved searches" ON saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete saved searches" ON saved_searches
  FOR DELETE USING (auth.uid() = user_id);
