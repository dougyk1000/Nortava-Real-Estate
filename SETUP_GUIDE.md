# Nortava Setup Guide

Your Nortava platform is **fully built and ready to deploy!** Follow these steps to make it fully operational.

## What's Already Done ✓
- ✓ Complete UI/UX with all pages and components
- ✓ Authentication system (login/signup with role selection)
- ✓ All advanced features: search filters, comparisons, reviews, analytics, etc.
- ✓ Contact page with clickable links
- ✓ Responsive mobile-first design
- ✓ Dark/Light theme support

## What You Need To Do (3 Simple Steps)

### Step 1: Get Your Supabase Credentials (5 minutes)
1. Go to [Supabase.com](https://supabase.com)
2. Sign up/login and create a **new project**
3. Once created, go to **Project Settings → API**
4. Copy your **Project URL** (looks like: `https://xxxxx.supabase.co`)
5. Copy your **Anon Key** (starts with `eyJh...`)
6. In Replit, go to **Secrets** tab and paste:
   - `VITE_SUPABASE_URL` = Your Project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Anon Key
7. The app will automatically restart with these credentials

### Step 2: Create Database Tables (2 minutes)
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query** (top right)
3. Open the `supabase_schema.sql` file in this project (or copy from below)
4. Paste the **entire SQL** into the editor
5. Click **Run** button
6. Wait for the green checkmark - all tables are created!

### Step 3: Test It Works (2 minutes)
1. Go back to your Nortava app
2. Click **"Get Started"** (top right)
3. Click **"Create Account"**
4. Select "Tenant / Buyer" and fill in the form
5. Click **"Create Account"**
6. Login with the credentials you just created
7. You should see your tenant dashboard!

## SQL Schema to Copy (if needed)

See `supabase_schema.sql` file in your project - it has all 8 tables:
- `users` - User profiles
- `listings` - Properties
- `listing_images` - Images for listings
- `unlocks` - Payment records
- `saved_listings` - Favorites
- `reports` - User reports
- `reviews` - Ratings & feedback
- `saved_searches` - Saved filters

## Contact Information
- **Nortava Support**: nortava@gmail.com
- **WhatsApp**: +263789707745
- **Web Development**: kulearnerebooks@gmail.com

## Features Available (Once Setup Complete)

### For Visitors
- Browse listings
- View property details
- See landlord reviews

### For Tenants/Buyers
- Save favorite listings
- Unlock landlord contact ($2.50)
- Leave reviews and ratings
- Track payment history
- Compare properties side-by-side
- Save search filters
- Get landlord verification badges

### For Landlords/Sellers
- Post properties for **free**
- Unlimited listings
- Upload up to 3 images per property
- See how many viewed your listing
- Track unlock payments
- View analytics dashboard
- Get verified with Bronze/Silver/Gold badges

### For Admins
- Manage user accounts
- Verify landlords
- Review property reports
- View all platform activity

## Payment Methods (When You Configure)
- EcoCash
- OneMoney
- Mukuru
- InnBucks

These can be added in your admin dashboard after setup.

## Next Steps After Setup

1. **Add Your Logo**: Replace `assets/images/logo/nortava-logo.jpg` with your actual logo
2. **Test Listings**: Create a test landlord account and post some properties
3. **Customize Branding**: Update colors/fonts in `assets/css/main.css` if needed
4. **Add Real Images**: Upload real property images
5. **Configure Payments**: Set up actual payment processing when ready
6. **Deploy**: Click the "Publish" button to make it live

## Troubleshooting

**"supabaseUrl is required" error?**
- You haven't added the secrets yet
- Go to Replit → Secrets tab → Add both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Restart the workflow

**Can't login/signup?**
- Check that the database tables are created in Supabase
- Run the `supabase_schema.sql` script
- Make sure email authentication is enabled in Supabase Dashboard → Authentication

**Tables not created?**
- Copy the entire `supabase_schema.sql` file
- Go to Supabase SQL Editor
- Click "New Query"
- Paste and click "Run"

## Questions?

Email: kulearnerebooks@gmail.com or WhatsApp: +263789707745

Good luck launching Nortava! 🚀
