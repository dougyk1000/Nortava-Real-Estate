import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

import { verifyMinimumAge, COPPA_MIN_AGE, PLATFORM_MIN_AGE } from '../server/ageVerification.js';
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  suppressEmail,
  isEmailSuppressed,
  validateMarketingSend
} from '../server/emailCompliance.js';
import { createApp } from '../server.js';
import {
  resolvePublicAppOrigin,
  isValidEmail,
  timingSafeEqualStrings,
  sanitizePrototypePollution,
  extractBearerToken
} from '../server/security.js';
import {
  injectSocialMetaTags,
  injectListingBodySsr,
  injectListingsDirectorySsr
} from '../server/seoMetadata.js';
import { escapeHtml, safeUrl, safeImageUrl, sanitizePhone } from '../core/utils/sanitize.js';
import { calculateRecommendedPrice } from '../core/pricing/pricing.js';
import { getNeighborhoodInfo } from '../core/neighborhoods/neighborhoods.js';
import {
  ZIMBABWE_LOCATIONS,
  getProvinces,
  getCitiesByProvince,
  getZonesByCity,
  getAreas,
  parseLocationString,
  matchesLocationFilter,
  formatLocationLabel
} from '../core/locations/zimbabweLocations.js';
import {
  validateZimbabweNationalId,
  validateDocumentUpload,
  MAX_KYC_DOC_BYTES
} from '../server/landlordVerification.js';
import {
  filterListingsByConditions,
  buildListingsFilterUrl
} from '../server/aiAssistant.js';

const ROOT = path.resolve(import.meta.dirname, '..');

function startTestServer() {
  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
    server.on('error', reject);
  });
}

test('COPPA & Age Verification: blocks under-13 and enforces 18+ account boundary conservatively', () => {
  const fixedNow = new Date('2026-06-15T12:00:00Z');

  // Born July 2013 -> turns 13 next month (still 12 in June 2026) -> blocked under COPPA
  const under13Boundary = verifyMinimumAge({
    birthYear: 2013,
    birthMonth: 7,
    minimumAge: COPPA_MIN_AGE,
    now: fixedNow
  });
  assert.equal(under13Boundary.allowed, false);
  assert.equal(under13Boundary.status, 403);
  assert.equal(under13Boundary.code, 'COPPA_UNDER_13');

  // Born June 2013 -> conservative check subtracts 1 on birthMonth === currentMonth -> blocked under COPPA
  const sameMonthBoundary = verifyMinimumAge({
    birthYear: 2013,
    birthMonth: 6,
    minimumAge: COPPA_MIN_AGE,
    now: fixedNow
  });
  assert.equal(sameMonthBoundary.allowed, false);
  assert.equal(sameMonthBoundary.code, 'COPPA_UNDER_13');

  // Born May 2013 -> 13 years old -> allowed for COPPA check (e.g. contact/report), blocked for 18+ account registration
  const teenCoppa = verifyMinimumAge({
    birthYear: 2013,
    birthMonth: 5,
    minimumAge: COPPA_MIN_AGE,
    now: fixedNow
  });
  assert.equal(teenCoppa.allowed, true);

  const teenAccount = verifyMinimumAge({
    birthYear: 2013,
    birthMonth: 5,
    minimumAge: PLATFORM_MIN_AGE,
    now: fixedNow
  });
  assert.equal(teenAccount.allowed, false);
  assert.equal(teenAccount.status, 403);
  assert.equal(teenAccount.code, 'MINIMUM_AGE_REQUIRED');

  // Born May 2008 -> 18 years old -> allowed for account registration
  const adultAccount = verifyMinimumAge({
    birthYear: 2008,
    birthMonth: 5,
    minimumAge: PLATFORM_MIN_AGE,
    now: fixedNow
  });
  assert.equal(adultAccount.allowed, true);

  // Invalid inputs rejected with 400
  const invalid = verifyMinimumAge({ birthYear: 'abc', birthMonth: 13, minimumAge: COPPA_MIN_AGE, now: fixedNow });
  assert.equal(invalid.allowed, false);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.code, 'INVALID_AGE_INPUT');
});

test('CAN-SPAM / RFC 8058 Email Compliance: verifies signed tokens, blocks missing address, and enforces suppression', async () => {
  const email = 'Tenant.Example@Example.com';
  const token = createUnsubscribeToken(email);

  assert.equal(verifyUnsubscribeToken(email, token), true);
  assert.equal(verifyUnsubscribeToken('other@example.com', token), false);
  assert.equal(verifyUnsubscribeToken(email, 'tampered-token'), false);

  // Missing physical address must block commercial emails
  const missingAddr = await validateMarketingSend({
    to: email,
    category: 'marketing',
    physicalAddress: '[OWNER CONFIRMATION REQUIRED]',
    unsubscribeBaseUrl: 'https://nortava.example/api/email/unsubscribe'
  });
  assert.equal(missingAddr.allowed, false);
  assert.equal(missingAddr.reason, 'CAN_SPAM_PHYSICAL_ADDRESS_MISSING');

  // Transactional email bypasses marketing address guard
  const transactional = await validateMarketingSend({
    to: email,
    category: 'transactional',
    physicalAddress: '',
    unsubscribeBaseUrl: 'https://nortava.example/api/email/unsubscribe'
  });
  assert.equal(transactional.allowed, true);

  // Valid physical address allows unsuppressed recipient and generates List-Unsubscribe headers
  const allowedMarketing = await validateMarketingSend({
    to: 'fresh-user@example.com',
    category: 'marketing',
    physicalAddress: '123 Samora Machel Ave, Norton, Zimbabwe',
    unsubscribeBaseUrl: 'https://nortava.example/api/email/unsubscribe'
  });
  assert.equal(allowedMarketing.allowed, true);
  assert.equal(allowedMarketing.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');

  // Suppression immediately blocks subsequent marketing sends
  await suppressEmail('fresh-user@example.com');
  assert.equal(await isEmailSuppressed('fresh-user@example.com'), true);

  const blockedAfterUnsub = await validateMarketingSend({
    to: 'fresh-user@example.com',
    category: 'marketing',
    physicalAddress: '123 Samora Machel Ave, Norton, Zimbabwe',
    unsubscribeBaseUrl: 'https://nortava.example/api/email/unsubscribe'
  });
  assert.equal(blockedAfterUnsub.allowed, false);
  assert.equal(blockedAfterUnsub.reason, 'RECIPIENT_SUPPRESSED');
});

test('XSS & URL Sanitization: neutralizes scripts and unsafe URI schemes', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">`\'&'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#96;&#39;&amp;'
  );
  assert.equal(safeImageUrl('javascript:alert(1)'), null);
  assert.equal(safeImageUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safeImageUrl('//evil.example/img.png'), null);
  assert.equal(safeImageUrl('/assets/images/family_home_exterior.png'), '/assets/images/family_home_exterior.png');
  assert.equal(safeImageUrl('https://cdn.example.com/photo.jpg'), 'https://cdn.example.com/photo.jpg');
  assert.equal(safeUrl('javascript:alert(1)', { allowRelative: true }), '#');
  assert.equal(sanitizePhone('+263 77-123 (4567)<script>'), '+263771234567');
});

test('HTTP Server Security, COPPA Endpoints, Fail-Closed Auth/Payments & Unsubscribe Routes', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Health + CSP / Security Headers
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    const csp = healthRes.headers.get('content-security-policy') || '';
    assert.match(csp, /font-src 'self'/);
    assert.doesNotMatch(csp, /fonts\.googleapis\.com|cdn\.jsdelivr\.net/);

    // 2. Public config never leaks service role key
    const cfgRes = await fetch(`${baseUrl}/api/public-config`);
    assert.equal(cfgRes.status, 200);
    const cfgJson = await cfgRes.json();
    assert.equal('serviceRoleKey' in cfgJson, false);

    // 3. Register blocks under-13 without echoing PII
    const currentYear = new Date().getUTCFullYear();
    const under13Reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'child@example.com',
        password: 'Password123!',
        name: 'Minor Child',
        birthYear: currentYear - 10,
        birthMonth: 1,
        termsAccepted: true
      })
    });
    assert.equal(under13Reg.status, 403);
    const under13RegBody = await under13Reg.json();
    assert.equal(under13RegBody.code, 'COPPA_UNDER_13');
    assert.equal(JSON.stringify(under13RegBody).includes('child@example.com'), false);

    // 4. Register blocks 15-year-old under 18+ ToS
    const teenReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'teen@example.com',
        password: 'Password123!',
        name: 'Teen User',
        birthYear: currentYear - 15,
        birthMonth: 1,
        termsAccepted: true
      })
    });
    assert.equal(teenReg.status, 403);
    assert.equal((await teenReg.json()).code, 'MINIMUM_AGE_REQUIRED');

    // 5. Contact, Report, and DMCA forms enforce COPPA < 13 server-side
    const under13Contact = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Child',
        email: 'kid@example.com',
        message: 'Hello',
        birthYear: currentYear - 11,
        birthMonth: 1,
        privacyAccepted: true
      })
    });
    assert.equal(under13Contact.status, 403);

    const validContact = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Adult Tenant',
        email: 'tenant@example.com',
        subject: 'Inquiry',
        message: 'Looking for 2 bed house in Katanga.',
        birthYear: 1995,
        birthMonth: 3,
        privacyAccepted: true
      })
    });
    assert.equal(validContact.status, 201);
    const contactData = await validContact.json();
    assert.match(contactData.referenceId, /^MSG-[A-F0-9]+$/);

    const under13Report = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'spam',
        details: 'Test report',
        birthYear: currentYear - 9,
        birthMonth: 1
      })
    });
    assert.equal(under13Report.status, 403);

    const under13Dmca = await fetch(`${baseUrl}/api/dmca`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimantName: 'Child',
        claimantEmail: 'kid@example.com',
        workDescription: 'Photo',
        infringingUrl: 'https://nortava.example/listing.html?id=1',
        electronicSignature: 'Child',
        goodFaithStatement: true,
        accuracyStatement: true,
        birthYear: currentYear - 10,
        birthMonth: 1
      })
    });
    assert.equal(under13Dmca.status, 403);

    const validDmca = await fetch(`${baseUrl}/api/dmca`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimantName: 'Photo Owner',
        claimantEmail: 'owner@example.com',
        workDescription: 'Original architectural photograph of 14 Main St.',
        infringingUrl: 'https://nortava.example/listing.html?id=123',
        electronicSignature: 'Photo Owner',
        goodFaithStatement: true,
        accuracyStatement: true,
        birthYear: 1990,
        birthMonth: 4
      })
    });
    assert.equal(validDmca.status, 201);
    const dmcaData = await validDmca.json();
    assert.match(dmcaData.referenceId, /^DMCA-[A-F0-9]+$/);

    // 6. Admin & payment endpoints fail closed when unauthenticated
    for (const [method, endpoint] of [
      ['GET', '/api/admin/session'],
      ['GET', '/api/admin/overview'],
      ['GET', '/api/admin/landlord-doc?path=test.png'],
      ['POST', '/api/admin/verify-landlord'],
      ['POST', '/api/admin/reject-landlord'],
      ['POST', '/api/admin/ai-verify-landlord'],
      ['POST', '/api/admin/approve-listing'],
      ['DELETE', '/api/admin/listings/abc'],
      ['GET', '/api/landlord/verification-status'],
      ['POST', '/api/landlord/verification'],
      ['POST', '/api/payments/create'],
      ['POST', '/api/payments/verify']
    ]) {
      const r = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({})
      });
      assert.equal(r.status, 401, `${method} ${endpoint} should require authentication`);
    }

    // 7. Resend confirmation and password reset reject malformed emails with 400
    const badResend = await fetch(`${baseUrl}/api/auth/resend-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' })
    });
    assert.equal(badResend.status, 400);

    const badReset = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad-email' })
    });
    assert.equal(badReset.status, 400);

    // 7b. Public origin resolver ignores localhost and uses public forwarded host or APP_URL
    const fakeLocalReq = {
      protocol: 'http',
      get(h) {
        const key = h.toLowerCase();
        if (key === 'host') return 'localhost:3000';
        if (key === 'origin') return 'http://localhost:3000';
        return '';
      }
    };
    const prevAppUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://nortava-public.example.com';
    try {
      assert.equal(resolvePublicAppOrigin(fakeLocalReq), 'https://nortava-public.example.com');
    } finally {
      if (prevAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevAppUrl;
    }

    const fakeForwardedReq = {
      protocol: 'http',
      get(h) {
        const key = h.toLowerCase();
        if (key === 'host') return 'localhost:3000';
        if (key === 'x-forwarded-host') return 'nortava.co.zw';
        if (key === 'x-forwarded-proto') return 'https';
        return '';
      }
    };
    assert.equal(resolvePublicAppOrigin(fakeForwardedReq), 'https://nortava.co.zw');

    // 8. Unsubscribe endpoint validates HMAC token
    const badUnsub = await fetch(`${baseUrl}/api/email/unsubscribe?email=user@example.com&token=invalid`);
    assert.equal(badUnsub.status, 403);

    const goodToken = createUnsubscribeToken('user@example.com');
    const goodUnsub = await fetch(
      `${baseUrl}/api/email/unsubscribe?email=${encodeURIComponent('user@example.com')}&token=${encodeURIComponent(goodToken)}`,
      { method: 'POST' }
    );
    assert.equal(goodUnsub.status, 200);
    assert.equal((await goodUnsub.json()).ok, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Repository Static Security & Font Self-Hosting Audit', () => {
  // Confirm local Inter and RemixIcon font files exist
  const requiredFonts = [
    'assets/fonts/inter-latin-400-normal.woff2',
    'assets/fonts/inter-latin-600-normal.woff2',
    'assets/fonts/inter-latin-700-normal.woff2',
    'assets/fonts/remixicon.css',
    'assets/fonts/remixicon.woff2'
  ];
  for (const rel of requiredFonts) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `Missing self-hosted font asset: ${rel}`);
  }

  // Recursively scan HTML, CSS, JS source files for forbidden CDNs or hardcoded secrets
  const forbiddenPatterns = [
    { name: 'cdn.jsdelivr.net', regex: /cdn\.jsdelivr\.net/i },
    { name: 'fonts.googleapis.com', regex: /fonts\.googleapis\.com/i },
    { name: 'fonts.gstatic.com', regex: /fonts\.gstatic\.com/i },
    { name: 'hardcoded password', regex: /Br@@115/ },
    { name: 'hardcoded admin email', regex: /douglasnkowo3036@gmail\.com/i },
    { name: 'sample listing link', regex: /\?id=sample|listing=sample|Sample Property|\(Sample\)/i },
    { name: 'Math.random usage', regex: /\bMath\.random\b/ }
  ];

  const ignoredDirs = new Set(['node_modules', 'dist', '.git', 'tests']);
  const checkFile = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.html', '.css', '.js'].includes(ext)) return;
    const relPath = path.relative(ROOT, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pat of forbiddenPatterns) {
      assert.equal(
        pat.regex.test(content),
        false,
        `Forbidden pattern "${pat.name}" found in ${relPath}`
      );
    }
    if (
      ext === '.html' &&
      /<\/head>/i.test(content) &&
      !relPath.startsWith(`public${path.sep}`) &&
      path.basename(filePath) !== 'google6a7d612c835742de.html'
    ) {
      assert.match(content, /<title>[\s\S]+?<\/title>/i, `Missing <title> in ${relPath}`);
      assert.match(content, /<link rel="icon" href="\/favicon\.ico" sizes="any">/i, `Missing tab favicon in ${relPath}`);
      assert.match(content, /class="[^"]*\btheme-toggle\b/i, `Missing theme-toggle button in ${relPath}`);
      assert.match(content, /src="\/core\/main\.js"/i, `Missing /core/main.js script in ${relPath}`);
    }
  };

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignoredDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else checkFile(full);
    }
  };

  walk(ROOT);
});

test('AI Property Assistant API (/api/chat): validates input and surfaces real GEMINI_API_KEY state without fake fallbacks', async () => {
  const { server, baseUrl } = await startTestServer();
  const prevKey = process.env.GEMINI_API_KEY;
  try {
    // Reject empty messages cleanly
    const emptyRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' })
    });
    assert.equal(emptyRes.status, 400);

    // Without GEMINI_API_KEY, endpoint must fail honestly with 503 GEMINI_API_KEY_MISSING (no canned masking)
    delete process.env.GEMINI_API_KEY;
    const unconfiguredRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What houses are available in Katanga?' })
    });
    assert.equal(unconfiguredRes.status, 503);
    const unconfiguredBody = await unconfiguredRes.json();
    assert.equal(unconfiguredBody.code, 'GEMINI_API_KEY_MISSING');

    // Public config reflects aiConfigured accurately without exposing any secret value
    const cfgRes = await fetch(`${baseUrl}/api/public-config`);
    const cfg = await cfgRes.json();
    assert.equal(cfg.aiConfigured, false);
    assert.equal('geminiApiKey' in cfg, false);
  } finally {
    if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    else delete process.env.GEMINI_API_KEY;
    await new Promise(resolve => server.close(resolve));
  }
});

test('Norton Suburb Pricing, Neighborhood Intelligence & Zimbabwe Statutory Compliance Disclosures', () => {
  // Verify Norton suburb pricing calibration
  const katangaRent = calculateRecommendedPrice({ location: 'Katanga, Norton', rooms: 2, type: 'rent', water: true });
  const knoweRent = calculateRecommendedPrice({ location: 'Knowe, Norton', rooms: 3, type: 'rent', water: true, electricity: true });
  assert.ok(katangaRent.recommended > 0 && knoweRent.recommended > katangaRent.recommended);

  // Verify real Norton suburbs and nationwide Zimbabwe regional hierarchy in neighborhood intelligence
  assert.equal(getNeighborhoodInfo('Katanga, Norton')?.name, 'Katanga');
  assert.equal(getNeighborhoodInfo('Twin Lakes, Norton')?.name, 'Twin Lakes');
  assert.equal(getNeighborhoodInfo('Borrowdale, Harare')?.province, 'Harare');

  // Verify Zimbabwe statutory notices are present across legal & safety docs
  const privacy = fs.readFileSync(path.join(ROOT, 'legal/privacy.html'), 'utf8');
  assert.match(privacy, /Cyber and Data Protection Act \[Chapter 12:07\]/);
  assert.match(privacy, /SI 155 of 2024|Statutory Instrument 155 of 2024/);
  assert.match(privacy, /POTRAZ/);

  const terms = fs.readFileSync(path.join(ROOT, 'legal/terms.html'), 'utf8');
  assert.match(terms, /Estate Agents Act \[Chapter 27:17\]/);
  assert.match(terms, /Consumer Protection Act \[Chapter 14:14\]/);
  assert.match(terms, /National Payment Systems Act \[Chapter 24:23\]/);
  assert.match(terms, /Republic of Zimbabwe/);

  const dmca = fs.readFileSync(path.join(ROOT, 'legal/dmca.html'), 'utf8');
  assert.match(dmca, /Copyright and Neighbouring Rights Act \[Chapter 26:05\]/);

  const safety = fs.readFileSync(path.join(ROOT, 'safety.html'), 'utf8');
  assert.match(safety, /Estate Agents Council of Zimbabwe/);
  assert.match(safety, /Zimbabwe Rent Board/);
});

test('Zimbabwe Hierarchical Locations: covers all 10 provinces, cities/districts, zones, and suburbs with legacy compatibility', () => {
  const provinces = getProvinces();
  assert.equal(provinces.length, 10);
  for (const expectedProv of [
    'Harare',
    'Bulawayo',
    'Mashonaland West',
    'Mashonaland East',
    'Mashonaland Central',
    'Manicaland',
    'Midlands',
    'Masvingo',
    'Matabeleland North',
    'Matabeleland South'
  ]) {
    assert.ok(provinces.includes(expectedProv), `Missing province: ${expectedProv}`);
  }

  // Mashonaland West -> Norton -> Zones -> Knowe / Galloway / Katanga
  const mashWestCities = getCitiesByProvince('Mashonaland West').map(c => c.city);
  assert.ok(mashWestCities.includes('Norton'));
  assert.ok(mashWestCities.includes('Chinhoyi'));
  assert.ok(mashWestCities.includes('Kadoma'));
  assert.ok(mashWestCities.includes('Kariba'));

  const nortonZones = getZonesByCity('Norton', 'Mashonaland West');
  assert.ok(nortonZones.length >= 3);
  const nortonAreas = getAreas({ province: 'Mashonaland West', city: 'Norton' }).map(a => a.area);
  assert.ok(nortonAreas.includes('Knowe'));
  assert.ok(nortonAreas.includes('Galloway'));
  assert.ok(nortonAreas.includes('Katanga'));
  assert.ok(nortonAreas.includes('Twin Lakes'));

  // Parsing legacy string without province still resolves Mashonaland West > Norton > Katanga
  const legacyParsed = parseLocationString('Katanga, Norton');
  assert.equal(legacyParsed.province, 'Mashonaland West');
  assert.equal(legacyParsed.city, 'Norton');
  assert.equal(legacyParsed.area, 'Katanga');

  // Filtering by Province / City / Zone matches legacy listings accurately
  assert.equal(matchesLocationFilter('Katanga, Norton', { province: 'Mashonaland West' }), true);
  assert.equal(matchesLocationFilter('Katanga, Norton', { province: 'Mashonaland West', city: 'Norton' }), true);
  assert.equal(matchesLocationFilter('Katanga, Norton', { province: 'Mashonaland West', city: 'Norton', zone: 'High Density & Estates' }), true);
  assert.equal(matchesLocationFilter('Katanga, Norton', { province: 'Mashonaland West', city: 'Norton', zone: 'Low Density & Waterfront' }), false);
  assert.equal(matchesLocationFilter('Knowe, Norton, Mashonaland West', { province: 'Mashonaland West', city: 'Norton', area: 'Knowe' }), true);
  assert.equal(matchesLocationFilter('Borrowdale, Harare, Harare', { province: 'Harare', city: 'Harare', area: 'Borrowdale' }), true);
  assert.equal(matchesLocationFilter('Seke Unit C, Chitungwiza, Harare', { province: 'Harare', city: 'Chitungwiza' }), true);
  assert.equal(matchesLocationFilter('Cowdray Park, Bulawayo, Bulawayo', { province: 'Bulawayo', city: 'Bulawayo', area: 'Cowdray Park' }), true);

  assert.equal(
    formatLocationLabel({ area: 'Galloway', city: 'Norton', province: 'Mashonaland West' }),
    'Galloway, Norton, Mashonaland West'
  );
  assert.ok(ZIMBABWE_LOCATIONS.every(p => p.cities.length >= 1));
});

test('Anti-Scam Landlord KYC: validates Zimbabwe National IDs, magic-byte file verification, and rejects incomplete landlord registration', async () => {
  // Valid Zimbabwe National ID formats
  const validId = validateZimbabweNationalId('63-1234567 a 42');
  assert.equal(validId.valid, true);
  assert.equal(validId.normalized, '63-1234567A42');

  const badId = validateZimbabweNationalId('12345');
  assert.equal(badId.valid, false);

  // Genuine PNG magic-byte document vs spoofed HTML disguised as image/png
  const pngBytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('IHDR-NORTAVA-DEED-TEST-CONTENT')
  ]);
  const validPng = validateDocumentUpload({
    fileName: 'title-deed.png',
    mimeType: 'image/png',
    dataBase64: `data:image/png;base64,${pngBytes.toString('base64')}`
  }, 'Title Deed');
  assert.equal(validPng.valid, true);
  assert.equal(validPng.mimeType, 'image/png');
  assert.match(validPng.sha256, /^[a-f0-9]{64}$/);

  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
  const validPdf = validateDocumentUpload({
    fileName: 'deed.pdf',
    mimeType: 'application/pdf',
    dataBase64: pdfBytes.toString('base64')
  }, 'Title Deed');
  assert.equal(validPdf.valid, true);
  assert.equal(validPdf.mimeType, 'application/pdf');

  const spoofedHtml = validateDocumentUpload({
    fileName: 'fake-deed.png',
    mimeType: 'image/png',
    dataBase64: `data:image/png;base64,${Buffer.from('<html><script>alert(1)</script></html>').toString('base64')}`
  }, 'Title Deed');
  assert.equal(spoofedHtml.valid, false);

  const oversizedBuf = Buffer.alloc(MAX_KYC_DOC_BYTES + 1024, 0x41);
  const tooBig = validateDocumentUpload({
    fileName: 'huge.pdf',
    mimeType: 'application/pdf',
    dataBase64: oversizedBuf.toString('base64')
  }, 'Title Deed');
  assert.equal(tooBig.valid, false);

  // Server-side landlord registration rejects unattested or missing Title Deed / ID with 400
  const { server, baseUrl } = await startTestServer();
  try {
    const unattested = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'scam.landlord@example.com',
        password: 'Password123!',
        name: 'Unverified Seller',
        role: 'landlord',
        phone: '+263771234567',
        birthYear: 1985,
        birthMonth: 4,
        termsAccepted: true,
        landlordKyc: {
          nationalIdNumber: '63-1234567A42',
          ownershipCapacity: 'owner',
          propertyProvince: 'Harare',
          propertyCity: 'Harare',
          propertyArea: 'Borrowdale',
          propertyAddress: 'Stand 44 Borrowdale',
          antiFraudAttested: false
        }
      })
    });
    assert.equal(unattested.status, 400);

    const incompleteLandlord = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'scam.landlord@example.com',
        password: 'Password123!',
        name: 'Unverified Seller',
        role: 'landlord',
        phone: '+263771234567',
        birthYear: 1985,
        birthMonth: 4,
        termsAccepted: true,
        landlordKyc: {
          nationalIdNumber: '63-1234567A42',
          ownershipCapacity: 'owner',
          propertyProvince: 'Harare',
          propertyCity: 'Harare',
          propertyArea: 'Borrowdale',
          propertyAddress: 'Stand 44 Borrowdale',
          antiFraudAttested: true
          // missing titleDeedDoc & nationalIdDoc
        }
      })
    });
    assert.equal(incompleteLandlord.status, 400);
    const incompleteBody = await incompleteLandlord.json();
    assert.match(incompleteBody.error, /Title Deed|required/i);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Tariro AI Property Finder: filters live Zimbabwe listings by province/city/suburb & conditions and generates filter URLs', () => {
  const sampleListings = [
    {
      id: 'l-knowe-1',
      title: '3 Bed House with Borehole in Knowe',
      type: 'rent',
      price: 380,
      rooms: 3,
      bathrooms: 2,
      location: 'Knowe, Norton, Mashonaland West',
      furnished: false,
      water: true,
      electricity: true,
      parking: true
    },
    {
      id: 'l-borrowdale-1',
      title: 'Furnished Cottage in Borrowdale',
      type: 'rent',
      price: 750,
      rooms: 2,
      bathrooms: 2,
      location: 'Borrowdale, Harare, Harare',
      furnished: true,
      water: true,
      electricity: true,
      parking: true
    },
    {
      id: 'l-katanga-1',
      title: '2 Bed Starter Home in Katanga',
      type: 'rent',
      price: 160,
      rooms: 2,
      bathrooms: 1,
      location: 'Katanga, Norton, Mashonaland West',
      furnished: false,
      water: true,
      electricity: false,
      parking: false
    }
  ];

  // Condition + area match: Norton, max $400, 3+ rooms, water + electricity + parking
  const nortonMatches = filterListingsByConditions(sampleListings, {
    city: 'Norton',
    type: 'rent',
    maxPrice: 400,
    minRooms: 3,
    water: true,
    electricity: true,
    parking: true
  });
  assert.equal(nortonMatches.length, 1);
  assert.equal(nortonMatches[0].id, 'l-knowe-1');

  // Suburb match: Borrowdale furnished
  const harareMatches = filterListingsByConditions(sampleListings, {
    area: 'Borrowdale',
    furnished: true
  });
  assert.equal(harareMatches.length, 1);
  assert.equal(harareMatches[0].id, 'l-borrowdale-1');

  // Non-matching province returns 0 cleanly
  const bulawayoMatches = filterListingsByConditions(sampleListings, {
    province: 'Bulawayo',
    city: 'Bulawayo'
  });
  assert.equal(bulawayoMatches.length, 0);

  // Filter URL builder
  const filterUrl = buildListingsFilterUrl({
    province: 'Mashonaland West',
    city: 'Norton',
    area: 'Knowe',
    type: 'rent',
    maxPrice: 400,
    minRooms: 3
  });
  assert.equal(
    filterUrl,
    '/listings.html?province=Mashonaland+West&city=Norton&area=Knowe&type=rent&max_price=400&rooms=3'
  );
});

test('Social Media Metadata & Google SEO: injects OpenGraph/Schema.org, handles canonical redirects, SSR, and real 404s', async () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'assets/images/nortava-og-card.jpg')), true);
  assert.equal(fs.existsSync(path.join(ROOT, 'assets/images/logo/nortava-logo.png')), true);

  const prevAllowed = process.env.ALLOWED_HOSTS;
  process.env.ALLOWED_HOSTS = 'nortava-share.example.com';
  const { server, baseUrl } = await startTestServer();
  try {
    const headers = {
      'x-forwarded-host': 'nortava-share.example.com',
      'x-forwarded-proto': 'https'
    };

    for (const reqPath of ['/', '/listings.html', '/faq.html', '/how-it-works.html', '/safety.html', '/legal/privacy.html']) {
      const res = await fetch(`${baseUrl}${reqPath}`, { headers });
      assert.equal(res.status, 200, `Expected 200 for ${reqPath}`);
      assert.match(res.headers.get('vary') || '', /Host/i);
      const html = await res.text();

      assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="any">/);
      assert.match(html, /<link rel="icon" type="image\/png" sizes="48x48" href="\/favicon-48x48\.png">/);
      assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large/);
      assert.match(html, /<meta name="google-site-verification" content="4aCMJuKR4l8mPFePSPdcX8kGYdonI_o4O4Uek2RSIiw">/);
      assert.match(html, /<meta property="og:site_name" content="Nortava Real Estate">/);
      assert.match(html, /<meta property="og:image" content="https:\/\/nortava-share\.example\.com\/assets\/images\/nortava-og-card\.jpg">/);
      assert.match(html, /<meta property="og:image:secure_url" content="https:\/\/nortava-share\.example\.com\/assets\/images\/nortava-og-card\.jpg">/);
      assert.match(html, /<meta property="og:logo" content="https:\/\/nortava-share\.example\.com\/assets\/images\/logo\/nortava-logo\.png">/);
      assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
      assert.match(html, /<meta name="twitter:image" content="https:\/\/nortava-share\.example\.com\/assets\/images\/nortava-og-card\.jpg">/);
      assert.match(html, /<link rel="canonical" href="https:\/\/nortava-share\.example\.com\//);
      assert.doesNotMatch(html, /content="https:\/\/nortava\.co\.zw"/);

      const ldMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
      assert.ok(ldMatch, `Missing Schema.org JSON-LD on ${reqPath}`);
      const ld = JSON.parse(ldMatch[1]);
      assert.equal(ld['@context'], 'https://schema.org');
      assert.ok(Array.isArray(ld['@graph']) && ld['@graph'].length >= 2);
      const types = new Set(ld['@graph'].map(item => item['@type']));
      if (reqPath === '/') assert.equal(types.has('WebSite'), true);
      if (reqPath === '/faq.html') assert.equal(types.has('FAQPage'), true);
      if (reqPath === '/how-it-works.html') assert.equal(types.has('HowTo'), true);
    }

    // One URL per page: /index.html permanently redirects 301 to /
    const redirRes = await fetch(`${baseUrl}/index.html?utm_source=test`, { headers, redirect: 'manual' });
    assert.equal(redirRes.status, 301);
    assert.equal(redirRes.headers.get('location'), '/?utm_source=test');

    // Real HTTP 404s for missing pages, missing listing IDs, and unknown routes
    for (const notFoundPath of ['/nonexistent-page.html', '/does-not-exist', '/listing.html', '/listing.html?id=sample']) {
      const nfRes = await fetch(`${baseUrl}${notFoundPath}`, { headers });
      assert.equal(nfRes.status, 404, `Expected 404 for ${notFoundPath}`);
      assert.equal(nfRes.headers.get('x-robots-tag'), 'noindex, nofollow');
    }

    // Compact dropdown filter toolbar markup on /listings.html
    const listingsHtml = await (await fetch(`${baseUrl}/listings.html`, { headers })).text();
    assert.match(listingsHtml, /id="dropdownLocationBtn"/);
    assert.match(listingsHtml, /id="dropdownPriceBtn"/);
    assert.match(listingsHtml, /id="dropdownFiltersBtn"/);

    // Auth / admin / dashboard / payment pages must be marked noindex, nofollow AND still include tab icons
    for (const privatePath of ['/auth/login.html', '/admin/index.html', '/dashboard/tenant.html', '/payment/pay.html']) {
      const privRes = await fetch(`${baseUrl}${privatePath}`, { headers });
      assert.equal(privRes.status, 200);
      assert.equal(privRes.headers.get('x-robots-tag'), 'noindex, nofollow');
      const privHtml = await privRes.text();
      assert.match(privHtml, /<meta name="robots" content="noindex, nofollow">/);
      assert.match(privHtml, /<link rel="icon" href="\/favicon\.ico" sizes="any">/);
      assert.match(privHtml, /<link rel="icon" type="image\/png" sizes="48x48" href="\/favicon-48x48\.png">/);
    }

    const robotsRes = await fetch(`${baseUrl}/robots.txt`, { headers });
    assert.equal(robotsRes.status, 200);
    const robotsTxt = await robotsRes.text();
    assert.match(robotsTxt, /# google-site-verification=4aCMJuKR4l8mPFePSPdcX8kGYdonI_o4O4Uek2RSIiw/);
    assert.match(robotsTxt, /Allow:\s*\//);
    assert.match(robotsTxt, /Disallow:\s*\/admin\//);
    assert.match(robotsTxt, /Sitemap:\s*https:\/\/nortava-share\.example\.com\/sitemap\.xml/);

    for (const txtPath of ['/google-site-verification.txt', '/.well-known/google-site-verification.txt']) {
      const txtRes = await fetch(`${baseUrl}${txtPath}`, { headers });
      assert.equal(txtRes.status, 200);
      assert.match(txtRes.headers.get('content-type') || '', /text\/plain/);
      assert.equal((await txtRes.text()).trim(), 'google-site-verification=4aCMJuKR4l8mPFePSPdcX8kGYdonI_o4O4Uek2RSIiw');
    }

    const htmlVerifyRes = await fetch(`${baseUrl}/google6a7d612c835742de.html`, { headers });
    assert.equal(htmlVerifyRes.status, 200);
    assert.match(htmlVerifyRes.headers.get('content-type') || '', /text\/html/);
    assert.equal((await htmlVerifyRes.text()).trim(), 'google-site-verification: google6a7d612c835742de.html');

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`, { headers });
    assert.equal(sitemapRes.status, 200);
    assert.match(sitemapRes.headers.get('content-type') || '', /xml/);
    const sitemapXml = await sitemapRes.text();
    assert.match(sitemapXml, /<loc>https:\/\/nortava-share\.example\.com\/<\/loc>/);
    assert.match(sitemapXml, /<loc>https:\/\/nortava-share\.example\.com\/listings\.html<\/loc>/);
    assert.match(sitemapXml, /<loc>https:\/\/nortava-share\.example\.com\/faq\.html<\/loc>/);
    assert.doesNotMatch(sitemapXml, /\/admin\/|\/dashboard\/|\/auth\/login\.html/);

    for (const iconRoute of ['/favicon.ico', '/favicon-192x192.png', '/favicon-48x48.png', '/favicon-32x32.png', '/apple-touch-icon.png', '/assets/images/logo/nortava-tab-icon.png']) {
      const favRes = await fetch(`${baseUrl}${iconRoute}`);
      assert.equal(favRes.status, 200, `Expected 200 for ${iconRoute}`);
    }
  } finally {
    if (prevAllowed === undefined) delete process.env.ALLOWED_HOSTS;
    else process.env.ALLOWED_HOSTS = prevAllowed;
    await new Promise(resolve => server.close(resolve));
  }

  // Verify SSR hydration injects real listing & listings directory HTML cleanly
  const rawListingHtml = fs.readFileSync(path.join(ROOT, 'listing.html'), 'utf8');
  const hydratedListing = injectListingBodySsr(rawListingHtml, {
    id: 'prop-123',
    title: '3 Bed Knowe Home – $380/mo – Nortava Real Estate',
    shortTitle: '3 Bed Knowe Home',
    description: 'For Rent in Knowe, Norton',
    fullDescription: 'Spacious family home with borehole water in Knowe.',
    imageUrl: 'https://cdn.example.com/knowe.jpg',
    price: 380,
    type: 'rent',
    location: 'Knowe, Norton, Mashonaland West',
    rooms: 3,
    bathrooms: 2,
    size: '400 sqm'
  });
  assert.match(hydratedListing, /<h1 id="propertyTitle">3 Bed Knowe Home<\/h1>/);
  assert.match(hydratedListing, /Spacious family home with borehole water in Knowe\./);
  assert.match(hydratedListing, /alt="3 Bed Knowe Home in Knowe, Norton, Mashonaland West"/);

  const rawListingsHtml = fs.readFileSync(path.join(ROOT, 'listings.html'), 'utf8');
  const hydratedDir = injectListingsDirectorySsr(rawListingsHtml, [
    {
      id: 'prop-123',
      title: '3 Bed Knowe Home',
      price: 380,
      type: 'rent',
      location: 'Knowe, Norton, Mashonaland West',
      listing_images: [{ image_url: 'https://cdn.example.com/knowe.jpg' }]
    }
  ]);
  assert.match(hydratedDir, /href="\/listing\.html\?id=prop-123"/);

  // Verify XSS payloads inside listing metadata are neutralized in attributes and JSON-LD
  const maliciousHtml = injectSocialMetaTags('<html><head><title>X</title></head><body></body></html>', {
    origin: 'https://nortava-share.example.com',
    pathname: '/listing.html',
    listingSeo: {
      id: 'abc-123',
      title: '3 Bed House </script><script>alert("xss")</script>',
      description: 'Safe description "quoted" <img src=x>',
      imageUrl: 'https://cdn.example.com/house.jpg',
      price: 450,
      type: 'rent',
      location: 'Knowe, Norton'
    }
  });
  assert.doesNotMatch(maliciousHtml, /<script>alert\("xss"\)<\/script>/i);
  assert.match(maliciousHtml, /&lt;\/script&gt;/);
  assert.match(maliciousHtml, /\\u003c\/script>/);
});

test('Pen-Test Hardening PoCs: blocks cache poisoning, Unicode homographs, prototype pollution, alg:none JWT, and RLS view bypass', async () => {
  // 1. Cache poisoning / spoofed Origin & unallowlisted X-Forwarded-Host must never leak into canonicals or redirects
  const spoofedReq = {
    protocol: 'http',
    get(h) {
      const key = h.toLowerCase();
      if (key === 'origin') return 'https://evil-attacker.com';
      if (key === 'referer') return 'https://evil-attacker.com/login';
      if (key === 'x-forwarded-host') return 'evil-attacker.com';
      if (key === 'host') return 'evil-attacker.com';
      return '';
    }
  };
  assert.equal(resolvePublicAppOrigin(spoofedReq).includes('evil-attacker.com'), false);

  // 2. Unicode homograph spoofing (Cyrillic "а" in domain/local part) rejected cleanly
  assert.equal(isValidEmail('admin@nortava.co.zw'), true);
  assert.equal(isValidEmail('admin@nortav\u0430.co.zw'), false);
  assert.equal(isValidEmail(`${'a'.repeat(65)}@example.com`), false);

  // 3. JWT alg:none or malformed tokens fail closed before upstream auth check
  assert.equal(extractBearerToken({ headers: { authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.' } }), null);
  assert.equal(extractBearerToken({ headers: { authorization: 'Bearer not-a-jwt' } }), null);

  // 4. Prototype pollution keys scrubbed from nested objects
  const polluted = JSON.parse('{"name":"Test","__proto__":{"isAdmin":true},"nested":{"constructor":{"prototype":{"pwned":true}},"ok":1}}');
  const scrubbed = sanitizePrototypePollution(polluted);
  assert.equal(Object.prototype.hasOwnProperty.call(scrubbed, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(scrubbed.nested, 'constructor'), false);
  assert.equal(scrubbed.nested.ok, 1);

  // 5. Timing-safe string equality handles mismatched lengths safely
  assert.equal(timingSafeEqualStrings('admin@nortava.co.zw', 'admin@nortava.co.zw'), true);
  assert.equal(timingSafeEqualStrings('admin@nortava.co.zw', 'short'), false);

  // 6. public_profiles SQL view enforces security_invoker = true so users RLS is never bypassed
  const schemaSql = fs.readFileSync(path.join(ROOT, 'supabase_schema.sql'), 'utf8');
  assert.match(schemaSql, /CREATE OR REPLACE VIEW public_profiles[\s\S]*security_invoker\s*=\s*true/i);
});




