-- ===== ROW LEVEL SECURITY POLICIES FOR NORTAVA =====
-- Run this in Supabase SQL Editor AFTER running supabase_schema.sql

-- 1. USERS TABLE (Strict PII Protection — NO public USING (true) policy)
DROP POLICY IF EXISTS "Public can view user names and verification" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Tenants can view landlord contact after completed unlock" ON users;
DROP POLICY IF EXISTS "Landlords can view tenant name for completed unlock" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Tenants can view landlord contact after completed unlock" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM unlocks u
      JOIN listings l ON l.id = u.listing_id
      WHERE u.user_id = auth.uid()
        AND u.status = 'completed'
        AND l.user_id = users.id
    )
  );

CREATE POLICY "Landlords can view tenant name for completed unlock" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM unlocks u
      JOIN listings l ON l.id = u.listing_id
      WHERE l.user_id = auth.uid()
        AND u.user_id = users.id
        AND u.status = 'completed'
    )
  );

-- Prevent client self-promotion to admin or pre-verified status
CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND role IN ('tenant', 'landlord')
    AND verified = false
  );

-- Users may update basic contact info but cannot escalate role or verified flags
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM users u WHERE u.id = auth.uid())
    AND verified = (SELECT verified FROM users u WHERE u.id = auth.uid())
    AND verification_tier IS NOT DISTINCT FROM (SELECT verification_tier FROM users u WHERE u.id = auth.uid())
  );

-- 2. LISTINGS TABLE
DROP POLICY IF EXISTS "Anyone can view published listings" ON listings;
DROP POLICY IF EXISTS "Users can create their own listings" ON listings;
DROP POLICY IF EXISTS "Users can update their own listings" ON listings;
DROP POLICY IF EXISTS "Users can delete their own listings" ON listings;

CREATE POLICY "Anyone can view published listings" ON listings
  FOR SELECT USING (status = 'published' OR auth.uid() = user_id);

-- Newly created listings must start in draft or pending moderation state
CREATE POLICY "Users can create their own listings" ON listings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'pending')
  );

CREATE POLICY "Users can update their own listings" ON listings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'pending')
  );

CREATE POLICY "Users can delete their own listings" ON listings
  FOR DELETE USING (auth.uid() = user_id);

-- 3. LISTING IMAGES TABLE
DROP POLICY IF EXISTS "Anyone can view listing images" ON listing_images;
DROP POLICY IF EXISTS "Users can upload images for their listings" ON listing_images;
DROP POLICY IF EXISTS "Users can delete images for their listings" ON listing_images;

CREATE POLICY "Anyone can view listing images" ON listing_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_id AND (l.status = 'published' OR l.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can upload images for their listings" ON listing_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete images for their listings" ON listing_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_id AND l.user_id = auth.uid()
    )
  );

-- 4. UNLOCKS TABLE (Prevent client-side fake completed payment inserts)
DROP POLICY IF EXISTS "Users can view their own unlocks" ON unlocks;
DROP POLICY IF EXISTS "Users can create unlocks" ON unlocks;

CREATE POLICY "Users can view their own unlocks" ON unlocks
  FOR SELECT USING (
    auth.uid() = user_id
    OR (
      status = 'completed'
      AND EXISTS (
        SELECT 1 FROM listings l
        WHERE l.id = listing_id AND l.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can initiate pending unlocks" ON unlocks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- 5. SAVED LISTINGS
DROP POLICY IF EXISTS "Users can view their own saved listings" ON saved_listings;
DROP POLICY IF EXISTS "Users can save listings" ON saved_listings;
DROP POLICY IF EXISTS "Users can delete saved listings" ON saved_listings;

CREATE POLICY "Users can view their own saved listings" ON saved_listings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save listings" ON saved_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete saved listings" ON saved_listings
  FOR DELETE USING (auth.uid() = user_id);

-- 6. REPORTS
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;

CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT USING (auth.uid() = user_id);

-- 7. REVIEWS
DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;

CREATE POLICY "Anyone can view reviews" ON reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_id AND l.status = 'published'
    )
  );

CREATE POLICY "Users can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- 8. SAVED SEARCHES
DROP POLICY IF EXISTS "Users can view their own saved searches" ON saved_searches;
DROP POLICY IF EXISTS "Users can create saved searches" ON saved_searches;
DROP POLICY IF EXISTS "Users can delete saved searches" ON saved_searches;

CREATE POLICY "Users can view their own saved searches" ON saved_searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create saved searches" ON saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete saved searches" ON saved_searches
  FOR DELETE USING (auth.uid() = user_id);

-- 9. NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- 10. SERVER-ONLY TABLES (contact_messages, dmca_reports, email_suppression)
-- RLS is enabled with zero client policies; only server-side SUPABASE_SERVICE_ROLE_KEY may write/read.
