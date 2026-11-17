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
import { escapeHtml, safeUrl, safeImageUrl, sanitizePhone } from '../core/utils/sanitize.js';

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
      ['POST', '/api/admin/verify-landlord'],
      ['POST', '/api/admin/approve-listing'],
      ['DELETE', '/api/admin/listings/abc'],
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

    // 7. Unsubscribe endpoint validates HMAC token
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
    { name: 'hardcoded admin email', regex: /douglasnkowo3036@gmail\.com/i }
  ];

  const ignoredDirs = new Set(['node_modules', 'dist', '.git', 'tests']);
  const checkFile = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.html', '.css', '.js'].includes(ext)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pat of forbiddenPatterns) {
      assert.equal(
        pat.regex.test(content),
        false,
        `Forbidden pattern "${pat.name}" found in ${path.relative(ROOT, filePath)}`
      );
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
