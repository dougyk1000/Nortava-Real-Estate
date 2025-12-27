# Nortava Production Launch Checklist

## Critical Database Setup (Do First)

- [ ] **Add status column** to listings table in Supabase:
```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
```

- [ ] **Enable Row Level Security policies** - Copy entire content from `supabase_rls_policies.sql` and run in Supabase SQL Editor

- [ ] **Verify tables exist** - Check Supabase Dashboard → Database → Tables:
  - users
  - listings
  - listing_images
  - unlocks
  - saved_listings
  - reports
  - reviews
  - saved_searches

## Supabase Configuration

- [ ] **Email Authentication Enabled** - Go to Authentication → Providers → Email (should be default)
- [ ] **Anon Key configured** - Verify VITE_SUPABASE_ANON_KEY is set in Replit Secrets
- [ ] **Project URL configured** - Verify VITE_SUPABASE_URL is set in Replit Secrets
- [ ] **Storage bucket created** (optional) - For listing images: Create bucket named `listing-images`
- [ ] **Realtime enabled** (optional) - For live listing updates in Supabase dashboard

## Application Configuration

- [ ] **Admin email** - Update `core/api/api.js` line 110 and 160:
  - Change `douglasnkowo3036@gmail.com` to your admin email
  - This is used for notifications and admin functions

- [ ] **Contact info in HTML files** - Update with your contact details:
  - Email: nortava@gmail.com (change to your email)
  - Phone: +263789707745 (change to your number)
  - Web Dev email: kulearnerebooks@gmail.com (change if needed)
  - Search files: `grep -r "nortava@gmail.com"` or check each page

- [ ] **Logo** - Add your actual Nortava logo (currently using placeholder)
  - Replace `assets/images/logo/nortava-logo.jpg`

## Testing Checklist

- [ ] **User Registration** - Test signup with email, verify account is created
- [ ] **User Login** - Test login with registered account
- [ ] **Create Listing** - Test listing creation as landlord
- [ ] **Browse Listings** - Verify listings appear in listings page
- [ ] **Search & Filters** - Test filtering by location, price, amenities
- [ ] **Unlock System** - Test $2.50 payment/unlock flow
- [ ] **Dark/Light Theme** - Verify theme toggle works
- [ ] **Responsive Design** - Test on mobile, tablet, desktop
- [ ] **Chatbot** - Test FAQ chatbot on pages
- [ ] **Admin Panel** - Test admin verification and reporting

## Security Checklist

- [ ] **RLS Policies Active** - Verify no unauthorized access
- [ ] **No hardcoded secrets** - All API keys in Replit Secrets only
- [ ] **HTTPS enforced** (automatic on Replit)
- [ ] **Password requirements** - Supabase defaults are secure

## Performance Optimization

- [ ] **Images optimized** - Use compressed image formats
- [ ] **CSS/JS minified** - Vite handles this in production build
- [ ] **Database indexes created** - Already included in schema
- [ ] **No console errors** - Check browser console in production

## Pre-Launch Final Steps

1. Run this once everything is set up:
```bash
npm run build
```

2. Deploy to production - Click the **Publish** button in Replit

3. Test the live domain
   - All pages load
   - No console errors
   - Database operations work
   - Payment flow works

## Support & Maintenance

- Admin email: Your configured admin email will receive notifications
- Keep Supabase credentials safe in Replit Secrets
- Monitor error logs in browser console
- Regular database backups (Supabase handles this)

## Important Notes

- **Status column values**: `draft`, `pending`, `published`
  - Drafts: Only visible to listing owner
  - Pending: Awaiting admin verification
  - Published: Visible to all users

- **Verification tiers**: Bronze, Silver, Gold (configurable in user profiles)

- **Payment system**: Currently supports EcoCash, OneMoney, Mukuru, InnBucks integration points exist in code

---

**Once you complete all checks above, your app is production-ready for launch!**
