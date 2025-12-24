# Nortava - Real Estate Platform for Norton, Zimbabwe

## Overview
Nortava is a professional real estate platform specifically built for Norton, Zimbabwe. It connects tenants/buyers with landlords/sellers through a freemium model where listing is free, but tenants pay a small $2.50 fee to unlock landlord contact information.

## Current State
The platform is fully built with all UI components, pages, and JavaScript modules. It requires Supabase credentials to be fully operational with real data.

## Project Structure
```
├── assets/
│   ├── css/main.css          # Global styles, theme variables, components
│   └── images/
│       └── logo/             # Logo placeholder (user will add nortava-logo.jpg)
├── src/
│   ├── main.js               # Global initialization (theme, nav, chatbot)
│   ├── api/api.js            # Central Supabase API - ALL database operations
│   ├── auth/auth.js          # Authentication module
│   ├── listings/listings.js  # Listings functionality
│   ├── dashboard/dashboard.js # Dashboard logic
│   ├── payments/payments.js  # Payment flow
│   ├── admin/admin.js        # Admin functionality
│   ├── chatbot/chatbot.js    # AI chatbot (rule-based)
│   └── utils/
│       ├── toast.js          # Toast notifications
│       └── navigation.js     # Navigation utilities
├── auth/                     # Auth pages (login, register)
├── dashboard/                # Dashboard pages (tenant, landlord)
├── payment/                  # Payment flow pages
├── admin/                    # Admin panel pages
├── legal/                    # Legal pages (terms, privacy, cookies)
├── index.html                # Homepage
├── listings.html             # Browse listings
├── listing.html              # Single listing detail
├── about.html, faq.html, etc # Public pages
└── vite.config.js            # Vite configuration
```

## Key Features
- **Free listings** for landlords - no posting fees
- **Unlock system** - $2.50 to access landlord contact
- **Local payments** - EcoCash, OneMoney, Mukuru, InnBucks
- **Dark/Light theme** with smooth transitions
- **Real-time updates** via Supabase subscriptions
- **Rule-based chatbot** for user assistance
- **Image uploads** - max 3 images per listing
- **Responsive design** - mobile-first approach
- **Advanced Search Filters** - Filter by amenities (furnished, water, electricity, parking), bathrooms
- **Property Comparison** - Compare up to 3 properties side-by-side
- **Reviews & Ratings** - Tenants can rate landlords and properties with stars
- **Payment History** - Track unlock payments with downloadable receipts
- **Landlord Analytics** - Conversion rate, weekly unlocks/earnings, verification tier
- **Verification Tiers** - Bronze/Silver/Gold badges for landlords
- **Image Gallery** - Click to zoom with keyboard navigation
- **Saved Searches** - Save search filters for quick access

## User Roles
1. **Visitors** - Browse listings freely
2. **Tenants/Buyers** - Save listings, unlock contacts
3. **Landlords/Sellers** - Post free listings, get notified on unlocks
4. **Administrators** - Verify landlords, manage reports

## Technical Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Bundler**: Vite (multi-page application)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Icons**: Remixicon (no emojis)
- **Styling**: CSS custom properties, BEM-like naming

## Contact Information
- **Email (Nortava Support)**: nortava@gmail.com
- **WhatsApp**: +263789707745
- **Email (Web Development)**: kulearnerebooks@gmail.com

## Setup Instructions

### 1. Get Supabase Credentials
1. Go to [Supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **Settings → API** in your Supabase dashboard
4. Copy your **Project URL** and **Anon Key**
5. Add these to Replit Secrets:
   - `VITE_SUPABASE_URL` = Your Project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Anon Key

### 2. Create Database Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire SQL from `supabase_schema.sql` file in this project
4. Paste it into the SQL editor and click **Run**
5. Wait for all tables to be created successfully

### 3. Enable Authentication
1. In Supabase dashboard, go to **Authentication → Providers**
2. Make sure **Email** provider is enabled (it is by default)
3. You can also enable other providers (Google, GitHub, etc.) if needed

### 4. Test Login/Signup
1. The app should now be fully functional
2. Visit the signup page to create an account
3. Login with your credentials
4. Start browsing and creating listings!

## Database Schema
All required tables are created automatically when you run the `supabase_schema.sql` file. Here's what gets created:

```sql
-- Users (extends Supabase auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'tenant', -- tenant, landlord, admin
  verified BOOLEAN DEFAULT false,
  verification_tier TEXT, -- bronze, silver, gold
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
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
CREATE TABLE listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unlocks (payments)
CREATE TABLE unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  listing_id UUID REFERENCES listings(id),
  amount DECIMAL DEFAULT 2.50,
  payment_method TEXT,
  payment_ref TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT now()
);

-- Saved Listings
CREATE TABLE saved_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  listing_id UUID REFERENCES listings(id),
  saved_at TIMESTAMPTZ DEFAULT now()
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  listing_id UUID REFERENCES listings(id),
  reason TEXT,
  details TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reviews (for rating properties/landlords)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Saved Searches (for search alerts)
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT,
  params JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Increment views function
CREATE OR REPLACE FUNCTION increment_views(listing_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE listings SET views = views + 1 WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql;
```

## Environment Variables Required
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## Recent Changes
- December 18, 2025: Added advanced features
  - Advanced search filters with amenities (furnished, water, electricity, parking)
  - Property comparison tool (up to 3 properties side-by-side)
  - Reviews & ratings system with star ratings
  - Payment history with downloadable receipts
  - Enhanced landlord analytics (conversion rate, weekly stats, verification tier)
  - Verification tier badges (Bronze/Silver/Gold)
  - Image gallery with zoom modal and keyboard navigation
  - Saved searches functionality
- December 2024: Initial build of all pages and components
- All pages created with professional dark/light theme support
- Central API pattern implemented in src/api/api.js
- Real-time subscriptions for listings and unlocks
- Rule-based chatbot with FAQ responses

## User Preferences
- No emojis - use Remixicon icons instead
- Professional, non-plain design with smooth transitions
- Placeholder images acceptable (user will add real images later)
- Max 3 images per listing

## Running the Project
```bash
npm run dev    # Development server on port 5000
npm run build  # Production build
```
