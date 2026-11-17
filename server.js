import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMinimumAge, COPPA_MIN_AGE, PLATFORM_MIN_AGE } from './server/ageVerification.js';
import {
  verifyUnsubscribeToken,
  suppressEmail,
  normalizeEmail
} from './server/emailCompliance.js';
import {
  getServerSupabaseConfig,
  createPublicServerSupabase,
  createAdminServerSupabase,
  createAuthedServerSupabase,
  verifyAuthenticatedUser,
  verifyAdminRequest,
  sanitizeText,
  isValidEmail,
  securityHeadersMiddleware
} from './server/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  // --- HEALTH ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, status: 'healthy' });
  });

  // --- PUBLIC RUNTIME CONFIG (NO SECRETS) ---
  app.get('/api/public-config', (_req, res) => {
    const cfg = getServerSupabaseConfig();
    const paymentsConfigured = Boolean(process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY);
    const paymentsSandbox = process.env.PAYMENTS_SANDBOX_MODE === 'true';

    res.json({
      supabaseConfigured: cfg.configured,
      supabaseUrl: cfg.configured ? cfg.url : '',
      supabaseAnonKey: cfg.configured ? cfg.anonKey : '',
      paymentsConfigured,
      paymentsSandbox
    });
  });

  // --- COPPA & MINIMUM-AGE ENFORCED REGISTRATION ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name, role, phone, birthYear, birthMonth, termsAccepted } = req.body || {};

      // Enforce COPPA (< 13) and platform 18+ requirement BEFORE reading/storing PII
      const ageResult = verifyMinimumAge({
        birthYear,
        birthMonth,
        minimumAge: PLATFORM_MIN_AGE
      });
      if (!ageResult.allowed) {
        // Do NOT log or persist any PII on rejected attempts
        return res.status(ageResult.status).json({
          error: ageResult.message,
          code: ageResult.code
        });
      }

      if (termsAccepted !== true) {
        return res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy.' });
      }

      const cleanName = sanitizeText(name, 120);
      const cleanEmail = normalizeEmail(email);
      const cleanPhone = sanitizeText(phone || '', 30);
      const allowedRoles = new Set(['tenant', 'landlord']);
      const cleanRole = allowedRoles.has(role) ? role : 'tenant';

      if (!cleanName || !isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please provide a valid full name and email address.' });
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      }

      const supabase = createPublicServerSupabase();
      if (!supabase) {
        return res.status(503).json({
          error: 'Authentication backend is not configured yet. Set SUPABASE_URL and SUPABASE_ANON_KEY.',
          code: 'SUPABASE_NOT_CONFIGURED'
        });
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            role: cleanRole,
            phone: cleanPhone,
            age_verified: true
          }
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message || 'Registration failed.' });
      }

      const adminClient = createAdminServerSupabase() || createAuthedServerSupabase(data?.session?.access_token);
      if (adminClient && data?.user?.id) {
        await adminClient
          .from('users')
          .upsert({
            id: data.user.id,
            email: cleanEmail,
            name: cleanName,
            role: cleanRole,
            phone: cleanPhone || null,
            age_verified: true
          }, { onConflict: 'id' })
          .catch(() => {});
      }

      return res.status(201).json({
        user: data.user ? {
          id: data.user.id,
          email: data.user.email,
          name: cleanName,
          role: cleanRole
        } : null,
        session: data.session || null,
        requiresEmailConfirmation: !data.session
      });
    } catch {
      return res.status(500).json({ error: 'Unable to process registration right now.' });
    }
  });

  // --- CONTACT FORM WITH SERVER-SIDE COPPA CHECK ---
  app.post('/api/contact', async (req, res) => {
    try {
      const { name, email, subject, message, birthYear, birthMonth, privacyAccepted } = req.body || {};

      const ageResult = verifyMinimumAge({ birthYear, birthMonth, minimumAge: COPPA_MIN_AGE });
      if (!ageResult.allowed) {
        return res.status(ageResult.status).json({ error: ageResult.message, code: ageResult.code });
      }

      if (privacyAccepted !== true) {
        return res.status(400).json({ error: 'Please confirm you have read the Privacy Policy.' });
      }

      const cleanName = sanitizeText(name, 120);
      const cleanEmail = normalizeEmail(email);
      const cleanSubject = sanitizeText(subject, 160);
      const cleanMessage = sanitizeText(message, 4000);

      if (!cleanName || !isValidEmail(cleanEmail) || !cleanMessage) {
        return res.status(400).json({ error: 'Please complete your name, valid email, and message.' });
      }

      const referenceId = `MSG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const supabase = createAdminServerSupabase() || createPublicServerSupabase();
      if (supabase) {
        await supabase
          .from('contact_messages')
          .insert({
            reference_id: referenceId,
            name: cleanName,
            email: cleanEmail,
            subject: cleanSubject || 'General Inquiry',
            message: cleanMessage
          })
          .catch(() => {});
      }

      return res.status(201).json({ ok: true, referenceId });
    } catch {
      return res.status(500).json({ error: 'Unable to submit your message right now.' });
    }
  });

  // --- REPORTS FORM WITH SERVER-SIDE COPPA CHECK ---
  app.post('/api/reports', async (req, res) => {
    try {
      const { listingId, listingUrl, reason, details, contactEmail, birthYear, birthMonth } = req.body || {};
      const auth = await verifyAuthenticatedUser(req);

      if (!auth.user) {
        const ageResult = verifyMinimumAge({ birthYear, birthMonth, minimumAge: COPPA_MIN_AGE });
        if (!ageResult.allowed) {
          return res.status(ageResult.status).json({ error: ageResult.message, code: ageResult.code });
        }
      }

      const cleanReason = sanitizeText(reason, 80);
      const cleanDetails = sanitizeText(details, 3000);
      const cleanEmail = contactEmail ? normalizeEmail(contactEmail) : '';

      if (!cleanReason || !cleanDetails) {
        return res.status(400).json({ error: 'Please select a reason and describe the issue.' });
      }
      if (cleanEmail && !isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please provide a valid contact email or leave it blank.' });
      }

      const supabase = auth.user
        ? (createAdminServerSupabase() || createAuthedServerSupabase(auth.token))
        : (createAdminServerSupabase() || createPublicServerSupabase());

      if (!supabase) {
        return res.status(503).json({ error: 'Reporting database is not configured yet.' });
      }

      const safeDetails = [
        listingUrl ? `Listing URL: ${sanitizeText(listingUrl, 300)}` : null,
        cleanEmail ? `Reporter Email: ${cleanEmail}` : null,
        cleanDetails
      ].filter(Boolean).join('\n\n');

      const { error } = await supabase.from('reports').insert({
        listing_id: listingId || null,
        user_id: auth.user?.id || null,
        reason: cleanReason,
        details: safeDetails,
        status: 'pending'
      });

      if (error) {
        return res.status(400).json({ error: 'Failed to submit report.' });
      }

      return res.status(201).json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Unable to submit report right now.' });
    }
  });

  // --- DMCA COPYRIGHT NOTICE SUBMISSION ---
  app.post('/api/dmca', async (req, res) => {
    try {
      const {
        claimantName,
        claimantEmail,
        workDescription,
        infringingUrl,
        goodFaithStatement,
        accuracyStatement,
        electronicSignature,
        birthYear,
        birthMonth
      } = req.body || {};

      const ageResult = verifyMinimumAge({ birthYear, birthMonth, minimumAge: COPPA_MIN_AGE });
      if (!ageResult.allowed) {
        return res.status(ageResult.status).json({ error: ageResult.message, code: ageResult.code });
      }

      const cleanName = sanitizeText(claimantName, 150);
      const cleanEmail = normalizeEmail(claimantEmail);
      const cleanWork = sanitizeText(workDescription, 3000);
      const cleanUrl = sanitizeText(infringingUrl, 500);
      const cleanSig = sanitizeText(electronicSignature, 150);

      if (!cleanName || !isValidEmail(cleanEmail) || !cleanWork || !cleanUrl || !cleanSig) {
        return res.status(400).json({ error: 'All required DMCA notice fields must be completed.' });
      }
      if (goodFaithStatement !== true || accuracyStatement !== true) {
        return res.status(400).json({ error: 'Both statutory DMCA declarations must be affirmed.' });
      }

      const referenceId = `DMCA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const supabase = createAdminServerSupabase() || createPublicServerSupabase();
      if (supabase) {
        await supabase
          .from('dmca_reports')
          .insert({
            reference_id: referenceId,
            claimant_name: cleanName,
            claimant_email: cleanEmail,
            work_description: cleanWork,
            infringing_url: cleanUrl,
            electronic_signature: cleanSig,
            status: 'received'
          })
          .catch(() => {});
      }

      return res.status(201).json({ ok: true, referenceId });
    } catch {
      return res.status(500).json({ error: 'Unable to record DMCA notice right now.' });
    }
  });

  // --- SERVER-SIDE ADMIN SESSION & ACTIONS ---
  app.get('/api/admin/session', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) {
      return res.status(check.status).json({ isAdmin: false, error: check.error });
    }
    return res.json({ isAdmin: true, email: check.user.email, id: check.user.id });
  });

  app.get('/api/admin/overview', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    try {
      const [usersRes, listingsRes, unlocksRes, reportsRes] = await Promise.all([
        check.dbClient.from('users').select('*').order('created_at', { ascending: false }),
        check.dbClient.from('listings').select('*, listing_images(*), users!user_id(name, phone, email, verified, verification_tier)').order('created_at', { ascending: false }),
        check.dbClient.from('unlocks').select('*, users(name, email), listings(title)').order('unlocked_at', { ascending: false }),
        check.dbClient.from('reports').select('*, users(name, email), listings(title)').order('created_at', { ascending: false })
      ]);

      const users = usersRes.data || [];
      const listings = listingsRes.data || [];
      const unlocks = unlocksRes.data || [];
      const reports = reportsRes.data || [];

      return res.json({
        stats: {
          totalUsers: users.length,
          totalListings: listings.length,
          totalUnlocks: unlocks.length,
          pendingReports: reports.filter(r => r.status === 'pending').length,
          verifiedLandlords: users.filter(u => u.role === 'landlord' && u.verified).length
        },
        users,
        listings,
        unlocks,
        reports
      });
    } catch {
      return res.status(500).json({ error: 'Failed to load admin overview' });
    }
  });

  app.post('/api/admin/verify-landlord', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const { data, error } = await check.dbClient
      .from('users')
      .update({ verified: true })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ error: 'Failed to verify landlord' });
    return res.json({ data });
  });

  app.post('/api/admin/approve-listing', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    const { listingId } = req.body || {};
    if (!listingId) return res.status(400).json({ error: 'listingId is required' });

    const { data, error } = await check.dbClient
      .from('listings')
      .update({ status: 'published' })
      .eq('id', listingId)
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ error: 'Failed to approve listing' });
    return res.json({ data });
  });

  app.post('/api/admin/resolve-report', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    const { reportId, status = 'resolved' } = req.body || {};
    if (!reportId) return res.status(400).json({ error: 'reportId is required' });

    const { data, error } = await check.dbClient
      .from('reports')
      .update({ status: sanitizeText(status, 30) })
      .eq('id', reportId)
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ error: 'Failed to update report' });
    return res.json({ data });
  });

  app.delete('/api/admin/listings/:id', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    const { error } = await check.dbClient.from('listings').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: 'Failed to delete listing' });
    return res.json({ ok: true });
  });

  // --- SERVER-SIDE PAYMENT INITIATION & VERIFICATION ---
  app.post('/api/payments/create', async (req, res) => {
    const auth = await verifyAuthenticatedUser(req);
    if (!auth.user) return res.status(401).json({ error: 'Please login to make a payment.' });

    const { listingId, method, phone, oneTimeAcknowledged } = req.body || {};
    const allowedMethods = new Set(['ecocash', 'onemoney', 'mukuru', 'innbucks']);

    if (!listingId || listingId === 'sample') {
      return res.status(400).json({ error: 'Please select a real property listing before paying.' });
    }
    if (!allowedMethods.has(method)) {
      return res.status(400).json({ error: 'Unsupported payment method selected.' });
    }
    if (!phone || sanitizeText(phone, 30).length < 7) {
      return res.status(400).json({ error: 'Please enter a valid mobile money phone number.' });
    }
    if (oneTimeAcknowledged !== true) {
      return res.status(400).json({ error: 'Please acknowledge the one-time $2.50 unlock fee terms.' });
    }

    const paymentsConfigured = Boolean(process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY);
    const paymentsSandbox = process.env.PAYMENTS_SANDBOX_MODE === 'true';

    if (!paymentsConfigured && !paymentsSandbox) {
      return res.status(503).json({
        error: 'Live mobile-money payment gateway is not configured yet. Merchant credentials must be configured server-side to settle payments.',
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED'
      });
    }

    const dbClient = createAdminServerSupabase() || createAuthedServerSupabase(auth.token);
    if (!dbClient) {
      return res.status(503).json({ error: 'Database unavailable for recording payment.' });
    }

    const reference = `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { data, error } = await dbClient
      .from('unlocks')
      .insert({
        user_id: auth.user.id,
        listing_id: listingId,
        amount: 2.50,
        payment_method: method,
        payment_ref: reference,
        status: paymentsSandbox ? 'completed' : 'pending'
      })
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: 'Could not initialize payment record.' });
    }

    return res.status(201).json({
      data: { ...data, reference },
      sandbox: paymentsSandbox
    });
  });

  app.post('/api/payments/verify', async (req, res) => {
    const auth = await verifyAuthenticatedUser(req);
    if (!auth.user) return res.status(401).json({ error: 'Authentication required' });

    const { reference } = req.body || {};
    if (!reference) return res.status(400).json({ error: 'Payment reference is required' });

    const paymentsSandbox = process.env.PAYMENTS_SANDBOX_MODE === 'true';
    const paymentsConfigured = Boolean(process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY);
    if (!paymentsConfigured && !paymentsSandbox) {
      return res.status(503).json({
        error: 'Payment verification requires server-side payment gateway configuration.',
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED'
      });
    }

    const dbClient = createAdminServerSupabase() || createAuthedServerSupabase(auth.token);
    if (!dbClient) return res.status(503).json({ error: 'Database unavailable' });

    const { data, error } = await dbClient
      .from('unlocks')
      .select('*, listings(*, users(name, phone, email))')
      .eq('payment_ref', reference)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    return res.json({ data });
  });

  // --- CAN-SPAM / RFC 8058 ONE-CLICK UNSUBSCRIBE ---
  app.get('/api/email/unsubscribe', async (req, res) => {
    const email = normalizeEmail(req.query.email);
    const token = String(req.query.token || '');

    if (!verifyUnsubscribeToken(email, token)) {
      return res.status(403).send('<h1>Invalid or expired unsubscribe link</h1><p>Please verify the link or contact support.</p>');
    }

    const supabase = createAdminServerSupabase() || createPublicServerSupabase();
    await suppressEmail(email, supabase);
    return res.status(200).send('<h1>Unsubscribed</h1><p>Your email address has been added to our suppression list and will not receive promotional emails.</p>');
  });

  app.post('/api/email/unsubscribe', async (req, res) => {
    const email = normalizeEmail(req.body?.email || req.query.email);
    const token = String(req.body?.token || req.query.token || '');

    if (!verifyUnsubscribeToken(email, token)) {
      return res.status(403).json({ error: 'Invalid or missing unsubscribe verification token.' });
    }

    const supabase = createAdminServerSupabase() || createPublicServerSupabase();
    const result = await suppressEmail(email, supabase);
    return res.status(200).json(result);
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);

  if (isProd) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'mpa'
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Nortava server listening on http://0.0.0.0:${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}
