import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
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
  resolvePublicAppOrigin,
  securityHeadersMiddleware
} from './server/security.js';
import { handleChatRequest } from './server/aiAssistant.js';
import {
  ALLOWED_OWNERSHIP_CAPACITIES,
  validateZimbabweNationalId,
  validateDocumentUpload,
  uploadVerificationDoc,
  checkDuplicateDocuments,
  analyzeLandlordDocumentsWithGemini,
  downloadVerificationDocBuffer
} from './server/landlordVerification.js';
import {
  fetchListingForSeo,
  injectSocialMetaTags,
  buildSitemapXml,
  buildRobotsTxt,
  isNoIndexPath
} from './server/seoMetadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function persistVerificationRecord(adminClient, record, authUserMetadataPatch = null) {
  let savedToTable = false;
  if (adminClient) {
    try {
      const { error } = await adminClient
        .from('landlord_verifications')
        .upsert(record, { onConflict: 'user_id' });
      if (!error) savedToTable = true;
    } catch {
      // Fallback to auth user metadata below if landlord_verifications table is not migrated yet
    }

    if (adminClient.auth?.admin && record.user_id) {
      try {
        const metaSummary = {
          ...(authUserMetadataPatch || {}),
          kyc_record: {
            user_id: record.user_id,
            national_id_number: record.national_id_number,
            ownership_capacity: record.ownership_capacity,
            property_province: record.property_province,
            property_city: record.property_city,
            property_area: record.property_area,
            property_address: record.property_address,
            title_deed_path: record.title_deed_path,
            national_id_path: record.national_id_path,
            rates_bill_path: record.rates_bill_path,
            title_deed_sha256: record.title_deed_sha256,
            national_id_sha256: record.national_id_sha256,
            duplicate_warnings: record.duplicate_warnings || [],
            ai_status: record.ai_status,
            ai_confidence: record.ai_confidence,
            ai_document_match: record.ai_document_match,
            ai_extracted_owner: record.ai_extracted_owner,
            ai_extracted_id: record.ai_extracted_id,
            ai_extracted_property: record.ai_extracted_property,
            ai_red_flags: record.ai_red_flags || [],
            ai_summary: record.ai_summary,
            ai_screened_at: record.ai_screened_at,
            admin_status: record.admin_status,
            rejection_reason: record.rejection_reason || null,
            reviewed_at: record.reviewed_at || null,
            updated_at: record.updated_at
          }
        };
        await adminClient.auth.admin.updateUserById(record.user_id, {
          user_metadata: metaSummary
        });
      } catch {
        // Non-fatal if metadata sync fails
      }
    }
  }
  return { savedToTable };
}

async function fetchVerificationForUser(adminClient, userId) {
  if (!adminClient || !userId) return null;
  try {
    const { data, error } = await adminClient
      .from('landlord_verifications')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!error && data) return data;
  } catch {
    // Fallback to auth metadata
  }

  try {
    if (adminClient.auth?.admin) {
      const { data } = await adminClient.auth.admin.getUserById(userId);
      if (data?.user?.user_metadata?.kyc_record) {
        return data.user.user_metadata.kyc_record;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

export function createApp(options = {}) {
  const { isProd = process.env.NODE_ENV === 'production', getVite = () => null } = options;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeadersMiddleware);

  const largeUploadJson = express.json({ limit: '26mb' });
  const standardJson = express.json({ limit: '256kb' });
  app.use((req, res, next) => {
    if (req.path === '/api/auth/register' || req.path === '/api/landlord/verification') {
      return largeUploadJson(req, res, next);
    }
    return standardJson(req, res, next);
  });
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  // --- HEALTH ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, status: 'healthy' });
  });

  // --- PUBLIC RUNTIME CONFIG (NO SECRETS) ---
  app.get('/api/public-config', (req, res) => {
    const cfg = getServerSupabaseConfig();
    const paymentsConfigured = Boolean(process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY);
    const paymentsSandbox = process.env.PAYMENTS_SANDBOX_MODE === 'true';
    const aiConfigured = Boolean((process.env.GEMINI_API_KEY || '').trim());
    const publicOrigin = resolvePublicAppOrigin(req);

    res.json({
      supabaseConfigured: cfg.configured,
      supabaseUrl: cfg.configured ? cfg.url : '',
      supabaseAnonKey: cfg.configured ? cfg.anonKey : '',
      paymentsConfigured,
      paymentsSandbox,
      aiConfigured,
      publicOrigin
    });
  });

  // --- SERVER-SIDE GEMINI PROPERTY ASSISTANT ---
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, context } = req.body || {};
      const supabase = createPublicServerSupabase();
      const result = await handleChatRequest({ message, history, context, supabase });
      if (!result.ok) {
        return res.status(result.status).json({
          error: result.error,
          code: result.code
        });
      }
      return res.json({
        reply: result.reply,
        model: result.model
      });
    } catch {
      return res.status(500).json({ error: 'Unable to process chat request right now.' });
    }
  });

  // --- COPPA, 18+ & LANDLORD ANTI-SCAM KYC REGISTRATION ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const {
        email,
        password,
        name,
        role,
        phone,
        birthYear,
        birthMonth,
        termsAccepted,
        landlordKyc
      } = req.body || {};

      // Enforce COPPA (< 13) and platform 18+ requirement BEFORE reading/storing PII
      const ageResult = verifyMinimumAge({
        birthYear,
        birthMonth,
        minimumAge: PLATFORM_MIN_AGE
      });
      if (!ageResult.allowed) {
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

      // Enforce Landlord KYC & Title Deed upload validation BEFORE calling auth.signUp
      let validatedKyc = null;
      if (cleanRole === 'landlord') {
        if (cleanPhone.length < 7) {
          return res.status(400).json({ error: 'Landlords must provide a valid Zimbabwe contact phone number.' });
        }

        const kyc = landlordKyc || {};
        if (kyc.antiFraudAttested !== true) {
          return res.status(400).json({
            error: 'Landlords must affirm the legal ownership & anti-fraud declaration.'
          });
        }

        const idCheck = validateZimbabweNationalId(kyc.nationalIdNumber);
        if (!idCheck.valid) {
          return res.status(400).json({ error: idCheck.error });
        }

        const capacity = ALLOWED_OWNERSHIP_CAPACITIES.has(kyc.ownershipCapacity)
          ? kyc.ownershipCapacity
          : 'owner';

        const propProvince = sanitizeText(kyc.propertyProvince || '', 80);
        const propCity = sanitizeText(kyc.propertyCity || '', 80);
        const propArea = sanitizeText(kyc.propertyArea || '', 100);
        const propAddress = sanitizeText(kyc.propertyAddress || '', 240);

        if (!propProvince || !propCity || !propAddress) {
          return res.status(400).json({
            error: 'Please enter the property province, city/town, and street or stand address.'
          });
        }

        const titleDeedDoc = validateDocumentUpload(kyc.titleDeedDoc, 'Title Deed / Cession / Offer Letter');
        if (!titleDeedDoc.valid) {
          return res.status(400).json({ error: titleDeedDoc.error });
        }

        const nationalIdDoc = validateDocumentUpload(kyc.nationalIdDoc, 'Zimbabwe National ID');
        if (!nationalIdDoc.valid) {
          return res.status(400).json({ error: nationalIdDoc.error });
        }

        let ratesBillDoc = null;
        if (kyc.ratesBillDoc && kyc.ratesBillDoc.dataBase64) {
          ratesBillDoc = validateDocumentUpload(kyc.ratesBillDoc, 'Council Rates / Utility / Authority Document');
          if (!ratesBillDoc.valid) {
            return res.status(400).json({ error: ratesBillDoc.error });
          }
        }

        validatedKyc = {
          nationalIdNumber: idCheck.normalized,
          ownershipCapacity: capacity,
          propertyProvince: propProvince,
          propertyCity: propCity,
          propertyArea: propArea,
          propertyAddress: propAddress,
          titleDeedDoc,
          nationalIdDoc,
          ratesBillDoc
        };
      }

      const supabase = createPublicServerSupabase();
      if (!supabase) {
        return res.status(503).json({
          error: 'Authentication backend is not configured yet. Set SUPABASE_URL and SUPABASE_ANON_KEY.',
          code: 'SUPABASE_NOT_CONFIGURED'
        });
      }

      const publicOrigin = resolvePublicAppOrigin(req);
      const emailRedirectTo = publicOrigin
        ? `${publicOrigin}/auth/login.html?confirmed=1`
        : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: {
            name: cleanName,
            role: cleanRole,
            phone: cleanPhone,
            age_verified: true,
            verification_status: cleanRole === 'landlord' ? 'pending' : 'unverified'
          }
        }
      });

      if (error) {
        const msg = String(error.message || 'Registration failed.');
        const lower = msg.toLowerCase();
        const isRateLimit = lower.includes('rate limit');
        const status = lower.includes('already registered') ? 409 : isRateLimit ? 429 : 400;
        const cleanMsg = isRateLimit
          ? 'Verification email limit reached temporarily. Please wait a few minutes and try again (platform admin: configure custom SMTP in Supabase Auth to raise email limits).'
          : msg;
        return res.status(status).json({ error: cleanMsg });
      }

      // Supabase returns user with empty identities[] and sends NO email when email already exists
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return res.status(409).json({
          error: 'An account with this email already exists. Please sign in on the Login page or use "Forgot password?" to reset your password.',
          code: 'EMAIL_ALREADY_REGISTERED'
        });
      }

      const adminClient = createAdminServerSupabase();
      const writeClient = adminClient || createAuthedServerSupabase(data?.session?.access_token);

      if (writeClient && data?.user?.id) {
        try {
          await writeClient
            .from('users')
            .upsert({
              id: data.user.id,
              email: cleanEmail,
              name: cleanName,
              role: cleanRole,
              phone: cleanPhone || null,
              verified: false,
              verification_status: cleanRole === 'landlord' ? 'pending' : 'unverified',
              age_verified: true
            }, { onConflict: 'id' });
        } catch {
          // If verification_status column hasn't been added to an older schema yet, retry without it
          try {
            await writeClient
              .from('users')
              .upsert({
                id: data.user.id,
                email: cleanEmail,
                name: cleanName,
                role: cleanRole,
                phone: cleanPhone || null,
                age_verified: true
              }, { onConflict: 'id' });
          } catch {
            // Do not crash registration on profile sync
          }
        }
      }

      let kycSummary = null;
      if (cleanRole === 'landlord' && validatedKyc && data?.user?.id) {
        if (!adminClient) {
          return res.status(503).json({
            error: 'Server storage configuration (SUPABASE_SERVICE_ROLE_KEY) is required to securely store landlord verification documents.',
            code: 'KYC_STORAGE_UNAVAILABLE'
          });
        }

        const duplicateWarnings = await checkDuplicateDocuments(adminClient, {
          userId: data.user.id,
          titleDeedSha256: validatedKyc.titleDeedDoc.sha256,
          nationalIdNumber: validatedKyc.nationalIdNumber
        });

        const [deedUpload, idUpload, ratesUpload] = await Promise.all([
          uploadVerificationDoc(adminClient, {
            userId: data.user.id,
            docKind: 'title_deed',
            validatedDoc: validatedKyc.titleDeedDoc
          }),
          uploadVerificationDoc(adminClient, {
            userId: data.user.id,
            docKind: 'national_id',
            validatedDoc: validatedKyc.nationalIdDoc
          }),
          validatedKyc.ratesBillDoc
            ? uploadVerificationDoc(adminClient, {
                userId: data.user.id,
                docKind: 'rates_bill',
                validatedDoc: validatedKyc.ratesBillDoc
              })
            : Promise.resolve({ path: null, error: null })
        ]);

        if (deedUpload.error || idUpload.error) {
          return res.status(500).json({
            error: `Failed to securely store verification documents: ${deedUpload.error || idUpload.error}`
          });
        }

        const aiScreening = await analyzeLandlordDocumentsWithGemini({
          applicantName: cleanName,
          nationalIdNumber: validatedKyc.nationalIdNumber,
          ownershipCapacity: validatedKyc.ownershipCapacity,
          propertyAddress: validatedKyc.propertyAddress,
          propertyProvince: validatedKyc.propertyProvince,
          propertyCity: validatedKyc.propertyCity,
          propertyArea: validatedKyc.propertyArea,
          duplicateWarnings,
          titleDeedDoc: validatedKyc.titleDeedDoc,
          nationalIdDoc: validatedKyc.nationalIdDoc,
          ratesBillDoc: validatedKyc.ratesBillDoc
        });

        const nowIso = new Date().toISOString();
        const kycRecord = {
          user_id: data.user.id,
          national_id_number: validatedKyc.nationalIdNumber,
          ownership_capacity: validatedKyc.ownershipCapacity,
          property_province: validatedKyc.propertyProvince,
          property_city: validatedKyc.propertyCity,
          property_area: validatedKyc.propertyArea,
          property_address: validatedKyc.propertyAddress,
          title_deed_path: deedUpload.path,
          national_id_path: idUpload.path,
          rates_bill_path: ratesUpload.path || null,
          title_deed_sha256: validatedKyc.titleDeedDoc.sha256,
          national_id_sha256: validatedKyc.nationalIdDoc.sha256,
          anti_fraud_attested: true,
          duplicate_warnings: duplicateWarnings,
          ai_status: aiScreening.ok ? aiScreening.analysis.aiStatus : 'pending_ai_screening',
          ai_confidence: aiScreening.ok ? aiScreening.analysis.confidence : 0,
          ai_document_match: aiScreening.ok ? aiScreening.analysis.documentMatch : null,
          ai_extracted_owner: aiScreening.ok ? aiScreening.analysis.extractedOwnerName : null,
          ai_extracted_id: aiScreening.ok ? aiScreening.analysis.extractedIdNumber : null,
          ai_extracted_property: aiScreening.ok ? aiScreening.analysis.extractedPropertyReference : null,
          ai_red_flags: aiScreening.ok ? aiScreening.analysis.redFlags : duplicateWarnings,
          ai_summary: aiScreening.ok
            ? aiScreening.analysis.summary
            : (aiScreening.error || 'Awaiting AI screening and admin verification.'),
          ai_screened_at: aiScreening.ok ? nowIso : null,
          admin_status: 'pending',
          updated_at: nowIso
        };

        await persistVerificationRecord(adminClient, kycRecord, data.user.user_metadata);

        kycSummary = {
          adminStatus: 'pending',
          aiStatus: kycRecord.ai_status,
          aiConfidence: kycRecord.ai_confidence,
          duplicateWarnings
        };
      }

      return res.status(201).json({
        user: data.user ? {
          id: data.user.id,
          email: data.user.email,
          name: cleanName,
          role: cleanRole
        } : null,
        session: data.session || null,
        requiresEmailConfirmation: !data.session,
        verification: kycSummary
      });
    } catch {
      return res.status(500).json({ error: 'Unable to process registration right now.' });
    }
  });

  // --- RESEND SIGNUP CONFIRMATION EMAIL ---
  app.post('/api/auth/resend-confirmation', async (req, res) => {
    try {
      const cleanEmail = normalizeEmail(req.body?.email);
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      const supabase = createPublicServerSupabase();
      if (!supabase) {
        return res.status(503).json({
          error: 'Authentication backend is not configured yet.',
          code: 'SUPABASE_NOT_CONFIGURED'
        });
      }

      const publicOrigin = resolvePublicAppOrigin(req);
      const emailRedirectTo = publicOrigin
        ? `${publicOrigin}/auth/login.html?confirmed=1`
        : undefined;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: emailRedirectTo ? { emailRedirectTo } : undefined
      });

      if (error) {
        const msg = String(error.message || 'Unable to resend confirmation email.');
        const lower = msg.toLowerCase();
        const isRateLimit = lower.includes('rate limit');
        return res.status(isRateLimit ? 429 : 400).json({
          error: isRateLimit
            ? 'Email sending limit reached temporarily. Please wait a few minutes before retrying (admin: configure custom SMTP in Supabase Auth).'
            : msg
        });
      }

      return res.json({
        ok: true,
        message: 'If an unconfirmed account exists for this email, a fresh confirmation link has been sent. Please check Inbox and Spam.'
      });
    } catch {
      return res.status(500).json({ error: 'Unable to resend confirmation email right now.' });
    }
  });

  // --- PASSWORD RESET EMAIL (PUBLIC HOST + CROSS-DEVICE RECOVERY FLOW) ---
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const cleanEmail = normalizeEmail(req.body?.email);
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      const supabase = createPublicServerSupabase();
      if (!supabase) {
        return res.status(503).json({
          error: 'Authentication backend is not configured yet.',
          code: 'SUPABASE_NOT_CONFIGURED'
        });
      }

      const publicOrigin = resolvePublicAppOrigin(req);
      const redirectTo = publicOrigin
        ? `${publicOrigin}/auth/reset-password.html`
        : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        redirectTo ? { redirectTo } : undefined
      );

      if (error) {
        const msg = String(error.message || 'Unable to send password reset link.');
        const lower = msg.toLowerCase();
        const isRateLimit = lower.includes('rate limit');
        return res.status(isRateLimit ? 429 : 400).json({
          error: isRateLimit
            ? 'Password reset email limit reached temporarily. Please wait a few minutes and try again (admin: configure custom SMTP in Supabase Auth).'
            : msg
        });
      }

      return res.json({
        ok: true,
        redirectTo: redirectTo || null,
        message: 'If an account exists for that email, a password reset link has been sent. Check Inbox and Spam.'
      });
    } catch {
      return res.status(500).json({ error: 'Unable to process password reset request right now.' });
    }
  });

  // --- LANDLORD KYC STATUS & DOCUMENT SUBMISSION ---
  app.get('/api/landlord/verification-status', async (req, res) => {
    const auth = await verifyAuthenticatedUser(req);
    if (!auth.user) return res.status(401).json({ error: 'Authentication required' });

    const adminClient = createAdminServerSupabase();
    if (!adminClient) {
      return res.status(503).json({ error: 'Verification service unavailable' });
    }

    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, role, verified, verification_tier, verification_status')
      .eq('id', auth.user.id)
      .maybeSingle();

    const kyc = await fetchVerificationForUser(adminClient, auth.user.id);
    return res.json({
      verified: Boolean(userProfile?.verified),
      verificationTier: userProfile?.verification_tier || null,
      verificationStatus: userProfile?.verification_status || kyc?.admin_status || 'unverified',
      verification: kyc ? {
        nationalIdNumber: kyc.national_id_number,
        ownershipCapacity: kyc.ownership_capacity,
        propertyProvince: kyc.property_province,
        propertyCity: kyc.property_city,
        propertyArea: kyc.property_area,
        propertyAddress: kyc.property_address,
        hasTitleDeed: Boolean(kyc.title_deed_path),
        hasNationalId: Boolean(kyc.national_id_path),
        hasRatesBill: Boolean(kyc.rates_bill_path),
        aiStatus: kyc.ai_status,
        aiSummary: kyc.ai_summary,
        adminStatus: kyc.admin_status,
        rejectionReason: kyc.rejection_reason || null,
        updatedAt: kyc.updated_at || kyc.created_at
      } : null
    });
  });

  app.post('/api/landlord/verification', async (req, res) => {
    const auth = await verifyAuthenticatedUser(req);
    if (!auth.user) return res.status(401).json({ error: 'Authentication required' });

    const adminClient = createAdminServerSupabase();
    if (!adminClient) {
      return res.status(503).json({ error: 'Server storage configuration is unavailable.' });
    }

    const kyc = req.body || {};
    if (kyc.antiFraudAttested !== true) {
      return res.status(400).json({ error: 'You must affirm the legal ownership & anti-fraud declaration.' });
    }

    const idCheck = validateZimbabweNationalId(kyc.nationalIdNumber);
    if (!idCheck.valid) return res.status(400).json({ error: idCheck.error });

    const capacity = ALLOWED_OWNERSHIP_CAPACITIES.has(kyc.ownershipCapacity) ? kyc.ownershipCapacity : 'owner';
    const propProvince = sanitizeText(kyc.propertyProvince || '', 80);
    const propCity = sanitizeText(kyc.propertyCity || '', 80);
    const propArea = sanitizeText(kyc.propertyArea || '', 100);
    const propAddress = sanitizeText(kyc.propertyAddress || '', 240);
    if (!propProvince || !propCity || !propAddress) {
      return res.status(400).json({ error: 'Property province, city/town, and street/stand address are required.' });
    }

    const titleDeedDoc = validateDocumentUpload(kyc.titleDeedDoc, 'Title Deed / Cession / Offer Letter');
    if (!titleDeedDoc.valid) return res.status(400).json({ error: titleDeedDoc.error });

    const nationalIdDoc = validateDocumentUpload(kyc.nationalIdDoc, 'Zimbabwe National ID');
    if (!nationalIdDoc.valid) return res.status(400).json({ error: nationalIdDoc.error });

    let ratesBillDoc = null;
    if (kyc.ratesBillDoc && kyc.ratesBillDoc.dataBase64) {
      ratesBillDoc = validateDocumentUpload(kyc.ratesBillDoc, 'Supporting Proof Document');
      if (!ratesBillDoc.valid) return res.status(400).json({ error: ratesBillDoc.error });
    }

    const duplicateWarnings = await checkDuplicateDocuments(adminClient, {
      userId: auth.user.id,
      titleDeedSha256: titleDeedDoc.sha256,
      nationalIdNumber: idCheck.normalized
    });

    const [deedUpload, idUpload, ratesUpload] = await Promise.all([
      uploadVerificationDoc(adminClient, { userId: auth.user.id, docKind: 'title_deed', validatedDoc: titleDeedDoc }),
      uploadVerificationDoc(adminClient, { userId: auth.user.id, docKind: 'national_id', validatedDoc: nationalIdDoc }),
      ratesBillDoc
        ? uploadVerificationDoc(adminClient, { userId: auth.user.id, docKind: 'rates_bill', validatedDoc: ratesBillDoc })
        : Promise.resolve({ path: null, error: null })
    ]);

    if (deedUpload.error || idUpload.error) {
      return res.status(500).json({ error: `Failed to store documents: ${deedUpload.error || idUpload.error}` });
    }

    const { data: userRow } = await adminClient.from('users').select('name').eq('id', auth.user.id).maybeSingle();
    const applicantName = userRow?.name || auth.user.user_metadata?.name || auth.user.email;

    const aiScreening = await analyzeLandlordDocumentsWithGemini({
      applicantName,
      nationalIdNumber: idCheck.normalized,
      ownershipCapacity: capacity,
      propertyAddress: propAddress,
      propertyProvince: propProvince,
      propertyCity: propCity,
      propertyArea: propArea,
      duplicateWarnings,
      titleDeedDoc,
      nationalIdDoc,
      ratesBillDoc
    });

    const nowIso = new Date().toISOString();
    const kycRecord = {
      user_id: auth.user.id,
      national_id_number: idCheck.normalized,
      ownership_capacity: capacity,
      property_province: propProvince,
      property_city: propCity,
      property_area: propArea,
      property_address: propAddress,
      title_deed_path: deedUpload.path,
      national_id_path: idUpload.path,
      rates_bill_path: ratesUpload.path || null,
      title_deed_sha256: titleDeedDoc.sha256,
      national_id_sha256: nationalIdDoc.sha256,
      anti_fraud_attested: true,
      duplicate_warnings: duplicateWarnings,
      ai_status: aiScreening.ok ? aiScreening.analysis.aiStatus : 'pending_ai_screening',
      ai_confidence: aiScreening.ok ? aiScreening.analysis.confidence : 0,
      ai_document_match: aiScreening.ok ? aiScreening.analysis.documentMatch : null,
      ai_extracted_owner: aiScreening.ok ? aiScreening.analysis.extractedOwnerName : null,
      ai_extracted_id: aiScreening.ok ? aiScreening.analysis.extractedIdNumber : null,
      ai_extracted_property: aiScreening.ok ? aiScreening.analysis.extractedPropertyReference : null,
      ai_red_flags: aiScreening.ok ? aiScreening.analysis.redFlags : duplicateWarnings,
      ai_summary: aiScreening.ok ? aiScreening.analysis.summary : (aiScreening.error || 'Queued for admin review.'),
      ai_screened_at: aiScreening.ok ? nowIso : null,
      admin_status: 'pending',
      rejection_reason: null,
      updated_at: nowIso
    };

    await persistVerificationRecord(adminClient, kycRecord, auth.user.user_metadata);

    try {
      await adminClient
        .from('users')
        .update({ verified: false, verification_status: 'pending' })
        .eq('id', auth.user.id);
    } catch {
      // Ignore if column absent
    }

    return res.status(200).json({
      ok: true,
      adminStatus: 'pending',
      aiStatus: kycRecord.ai_status,
      aiSummary: kycRecord.ai_summary
    });
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
        try {
          await supabase
            .from('contact_messages')
            .insert({
              reference_id: referenceId,
              name: cleanName,
              email: cleanEmail,
              subject: cleanSubject || 'General Inquiry',
              message: cleanMessage
            });
        } catch {
          // Non-fatal if contact_messages table not yet migrated
        }
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
        try {
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
            });
        } catch {
          // Non-fatal if table not yet migrated
        }
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

      let verifications = [];
      try {
        const verRes = await check.dbClient
          .from('landlord_verifications')
          .select('*')
          .order('created_at', { ascending: false });
        if (!verRes.error && Array.isArray(verRes.data)) {
          verifications = verRes.data;
        }
      } catch {
        verifications = [];
      }

      // Merge fallback auth metadata KYC records if table hasn't been created yet
      if (verifications.length === 0 && check.dbClient.auth?.admin) {
        try {
          const { data: authList } = await check.dbClient.auth.admin.listUsers({ page: 1, perPage: 200 });
          const authUsers = authList?.users || [];
          verifications = authUsers
            .map(au => au.user_metadata?.kyc_record)
            .filter(Boolean);
        } catch {
          // Ignore
        }
      }

      return res.json({
        stats: {
          totalUsers: users.length,
          totalListings: listings.length,
          totalUnlocks: unlocks.length,
          pendingReports: reports.filter(r => r.status === 'pending').length,
          verifiedLandlords: users.filter(u => u.role === 'landlord' && u.verified).length,
          pendingLandlords: users.filter(u => u.role === 'landlord' && !u.verified).length
        },
        users,
        verifications,
        listings,
        unlocks,
        reports
      });
    } catch {
      return res.status(500).json({ error: 'Failed to load admin overview' });
    }
  });

  app.get('/api/admin/landlord-doc', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    const userId = String(req.query.userId || '').trim();
    const doc = String(req.query.doc || '').trim();
    const pathColMap = {
      title_deed: 'title_deed_path',
      national_id: 'national_id_path',
      rates_bill: 'rates_bill_path'
    };

    const col = pathColMap[doc];
    if (!userId || !col) {
      return res.status(400).json({ error: 'Valid userId and doc parameter are required.' });
    }

    const kyc = await fetchVerificationForUser(check.dbClient, userId);
    const objectPath = kyc?.[col];
    if (!objectPath) {
      return res.status(404).json({ error: 'Requested verification document was not uploaded.' });
    }

    const fileData = await downloadVerificationDocBuffer(check.dbClient, objectPath);
    if (!fileData) {
      return res.status(404).json({ error: 'Document file not found in private storage.' });
    }

    res.setHeader('Content-Type', fileData.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(objectPath)}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(fileData.buffer);
  });

  app.post('/api/admin/ai-verify-landlord', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const [{ data: landlord }, kyc] = await Promise.all([
      check.dbClient.from('users').select('id, name, email, phone').eq('id', userId).maybeSingle(),
      fetchVerificationForUser(check.dbClient, userId)
    ]);

    if (!kyc) {
      return res.status(404).json({ error: 'This landlord has not uploaded verification documents yet.' });
    }

    const [titleDeedDoc, nationalIdDoc, ratesBillDoc] = await Promise.all([
      downloadVerificationDocBuffer(check.dbClient, kyc.title_deed_path),
      downloadVerificationDocBuffer(check.dbClient, kyc.national_id_path),
      kyc.rates_bill_path ? downloadVerificationDocBuffer(check.dbClient, kyc.rates_bill_path) : Promise.resolve(null)
    ]);

    const aiResult = await analyzeLandlordDocumentsWithGemini({
      applicantName: landlord?.name || landlord?.email,
      nationalIdNumber: kyc.national_id_number,
      ownershipCapacity: kyc.ownership_capacity,
      propertyAddress: kyc.property_address,
      propertyProvince: kyc.property_province,
      propertyCity: kyc.property_city,
      propertyArea: kyc.property_area,
      duplicateWarnings: Array.isArray(kyc.duplicate_warnings) ? kyc.duplicate_warnings : [],
      titleDeedDoc,
      nationalIdDoc,
      ratesBillDoc
    });

    if (!aiResult.ok) {
      return res.status(aiResult.status).json({ error: aiResult.error, code: aiResult.code });
    }

    const nowIso = new Date().toISOString();
    const updatedRecord = {
      ...kyc,
      ai_status: aiResult.analysis.aiStatus,
      ai_confidence: aiResult.analysis.confidence,
      ai_document_match: aiResult.analysis.documentMatch,
      ai_extracted_owner: aiResult.analysis.extractedOwnerName,
      ai_extracted_id: aiResult.analysis.extractedIdNumber,
      ai_extracted_property: aiResult.analysis.extractedPropertyReference,
      ai_red_flags: aiResult.analysis.redFlags,
      ai_summary: aiResult.analysis.summary,
      ai_screened_at: nowIso,
      updated_at: nowIso
    };

    await persistVerificationRecord(check.dbClient, updatedRecord);
    return res.json({ ok: true, verification: updatedRecord, analysis: aiResult.analysis });
  });

  app.post('/api/admin/verify-landlord', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    const { userId, tier = 'silver' } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const allowedTiers = new Set(['bronze', 'silver', 'gold']);
    const safeTier = allowedTiers.has(tier) ? tier : 'silver';
    const nowIso = new Date().toISOString();

    let updatedUser = null;
    const { data, error } = await check.dbClient
      .from('users')
      .update({
        verified: true,
        verification_tier: safeTier,
        verification_status: 'approved'
      })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      // Fallback if verification_status column hasn't been added yet
      const fallback = await check.dbClient
        .from('users')
        .update({ verified: true, verification_tier: safeTier })
        .eq('id', userId)
        .select()
        .maybeSingle();
      if (fallback.error) {
        return res.status(400).json({ error: 'Failed to verify landlord' });
      }
      updatedUser = fallback.data;
    } else {
      updatedUser = data;
    }

    const kyc = await fetchVerificationForUser(check.dbClient, userId);
    if (kyc) {
      await persistVerificationRecord(check.dbClient, {
        ...kyc,
        admin_status: 'approved',
        rejection_reason: null,
        reviewed_by: check.user.id,
        reviewed_at: nowIso,
        updated_at: nowIso
      });
    }

    try {
      await check.dbClient.from('notifications').insert({
        user_id: userId,
        title: 'Landlord Account Verified',
        message: 'Your Zimbabwe National ID and Title Deed documents have been approved. Your listings can now carry a verified badge.',
        type: 'success'
      });
    } catch {
      // Ignore notification insert failure
    }

    return res.json({ data: updatedUser });
  });

  app.post('/api/admin/reject-landlord', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    const { userId, reason } = req.body || {};
    const cleanReason = sanitizeText(reason || '', 500);
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!cleanReason) return res.status(400).json({ error: 'Please enter a rejection reason for audit and landlord notice.' });

    const nowIso = new Date().toISOString();
    try {
      await check.dbClient
        .from('users')
        .update({ verified: false, verification_tier: null, verification_status: 'rejected' })
        .eq('id', userId);
    } catch {
      await check.dbClient
        .from('users')
        .update({ verified: false, verification_tier: null })
        .eq('id', userId);
    }

    const kyc = await fetchVerificationForUser(check.dbClient, userId);
    if (kyc) {
      await persistVerificationRecord(check.dbClient, {
        ...kyc,
        admin_status: 'rejected',
        rejection_reason: cleanReason,
        reviewed_by: check.user.id,
        reviewed_at: nowIso,
        updated_at: nowIso
      });
    }

    try {
      await check.dbClient.from('notifications').insert({
        user_id: userId,
        title: 'Verification Documents Rejected',
        message: `Your landlord verification was declined: ${cleanReason}. Please upload clear, valid documents from your dashboard.`,
        type: 'warning'
      });
    } catch {
      // Ignore
    }

    return res.json({ ok: true, reason: cleanReason });
  });

  app.post('/api/admin/approve-listing', async (req, res) => {
    const check = await verifyAdminRequest(req);
    if (!check.ok) return res.status(check.status).json({ error: check.error });
    if (!check.dbClient) return res.status(503).json({ error: 'Database client unavailable' });

    const { listingId } = req.body || {};
    if (!listingId) return res.status(400).json({ error: 'listingId is required' });

    const { data: existingListing } = await check.dbClient
      .from('listings')
      .select('id, user_id, users!user_id(verified)')
      .eq('id', listingId)
      .maybeSingle();

    if (!existingListing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    if (!existingListing.users?.verified) {
      return res.status(400).json({
        error: 'Verify this landlord\'s National ID & Title Deeds first in Verify Landlords before publishing.'
      });
    }

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

  // --- CRAWLER / SEARCH ENGINE ROBOTS, SITEMAP & FAVICON ---
  app.get('/robots.txt', (req, res) => {
    const origin = resolvePublicAppOrigin(req);
    res.type('text/plain').send(buildRobotsTxt(origin));
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const origin = resolvePublicAppOrigin(req);
      const xml = await buildSitemapXml(origin, createPublicServerSupabase());
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).type('application/xml; charset=utf-8').send(xml);
    } catch {
      return res.status(500).type('text/plain').send('Unable to generate sitemap');
    }
  });

  app.get('/favicon.ico', (_req, res) => {
    const iconPath = path.join(__dirname, 'assets', 'images', 'logo', 'nortava-logo.png');
    if (fs.existsSync(iconPath)) {
      return res.sendFile(iconPath);
    }
    return res.status(204).end();
  });

  // --- DYNAMIC OPENGRAPH / TWITTER / SCHEMA.ORG HTML METADATA ---
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const reqPath = req.path || '/';
    if (
      reqPath.startsWith('/api/') ||
      reqPath.startsWith('/assets/') ||
      reqPath.startsWith('/core/') ||
      reqPath.startsWith('/@') ||
      reqPath.startsWith('/node_modules/')
    ) {
      return next();
    }

    const isHtmlRoute = reqPath === '/' || reqPath.endsWith('.html');
    if (!isHtmlRoute) return next();

    try {
      const relPath = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
      const htmlRoot = isProd ? path.join(__dirname, 'dist') : __dirname;
      const resolvedPath = path.resolve(htmlRoot, relPath);
      if (!resolvedPath.startsWith(`${htmlRoot}${path.sep}`)) {
        return next();
      }
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        return next();
      }

      const rawHtml = await fs.promises.readFile(resolvedPath, 'utf8');
      const origin = resolvePublicAppOrigin(req);
      const listingId = reqPath === '/listing.html' ? String(req.query?.id || '').trim() : '';
      let listingSeo = null;
      if (listingId) {
        listingSeo = await fetchListingForSeo(createPublicServerSupabase(), listingId);
      }

      let finalHtml = injectSocialMetaTags(rawHtml, {
        origin,
        pathname: reqPath,
        listingId,
        listingSeo
      });

      const vite = typeof getVite === 'function' ? getVite() : null;
      if (!isProd && vite) {
        finalHtml = await vite.transformIndexHtml(req.originalUrl, finalHtml);
      }

      if (isNoIndexPath(reqPath)) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-store');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=60');
      }
      return res.status(200).type('html').send(finalHtml);
    } catch {
      return next();
    }
  });

  return app;
}

function parseCliArg(flagName) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === flagName && args[i + 1]) return args[i + 1];
    if (arg.startsWith(`${flagName}=`)) return arg.slice(flagName.length + 1);
  }
  return '';
}

function resolveListenConfig() {
  const cliHost = parseCliArg('--host');
  const host = cliHost || process.env.HOST || '0.0.0.0';

  const cliPortRaw = parseCliArg('--port');
  const cliPort = Number(cliPortRaw);
  if (Number.isInteger(cliPort) && cliPort > 0 && cliPort <= 65535) {
    return { host, port: cliPort };
  }

  const isProd = process.env.NODE_ENV === 'production';
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT || 3000);

  if (!isProd && envPort && nginxPort && envPort === nginxPort) {
    return { host, port: defaultAppPort };
  }

  const resolvedPort = Number.isInteger(envPort) && envPort > 0 && envPort <= 65535
    ? envPort
    : defaultAppPort;
  return { host, port: resolvedPort };
}

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  let vite = null;
  const app = createApp({ isProd, getVite: () => vite });
  const { host, port } = resolveListenConfig();

  if (isProd) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use('/assets', express.static(path.join(__dirname, 'assets')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'mpa'
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(port, host, () => {
    console.log(`Nortava server listening on http://${host}:${port}`);
  });

  server.on('error', (err) => {
    console.error(`Failed to bind server on ${host}:${port}:`, err?.message || err);
    process.exit(1);
  });

  const shutdown = async () => {
    try {
      if (vite) await vite.close();
    } catch {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err?.message || err);
    process.exit(1);
  });
}
