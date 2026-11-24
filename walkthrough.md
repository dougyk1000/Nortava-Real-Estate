# Security Summary

We performed a comprehensive 20-point security, SEO, and UX hardening audit across Nortava Real Estate's Express server, Supabase database schema, client modules, and HTML entrypoints. All critical and high-risk items from the 20-point checklist are protected or remediated:

- **Trusted Origin & Cache Poisoning Defense (`server/security.js`, `server.js`)**: Removed untrusted `Origin` and `Referer` header trust from `resolvePublicAppOrigin`, enforced strict hostname syntax checks against an explicit host allowlist (`PUBLIC_APP_URL`, `SITE_URL`, `APP_URL`, `ALLOWED_HOSTS`, `.run.app`, and `nortava.co.zw`), added `Vary: Host, X-Forwarded-Host` on cacheable public HTML, `/robots.txt`, and `/sitemap.xml`, and enforced `Cache-Control: no-store` on `/api/*`, `/auth/*`, `/admin/*`, `/dashboard/*`, and `/payment/*`.
- **Database View Access Control (`supabase_schema.sql`)**: Updated the `public_profiles` SQL view with `WITH (security_invoker = true)` so queries execute under the caller's Row Level Security permissions rather than bypassing `users` table policies.
- **Confirmed Email & Timing-Safe Admin Verification (`server/security.js`, `server/emailCompliance.js`)**: Required verified email confirmation (`email_confirmed_at` / `confirmed_at`) before granting `ADMIN_EMAILS` access, and added fixed-length SHA-256 `timingSafeEqualStrings` comparisons for both admin allowlist checks and RFC 8058 unsubscribe token validation.
- **Unicode Confusable & Input Bound Protection (`server/security.js`, `server/emailCompliance.js`, `server/landlordVerification.js`)**: Applied Unicode `NFKC` normalization, stripped zero-width invisibles, and enforced strict ASCII email validation (blocking Cyrillic/Greek homograph spoofing) along with character bounds on names, passwords, National IDs, and KYC payloads.
- **JWT Format Validation, Prototype Pollution Scrubbing & Rate Limiting (`server/security.js`, `server.js`)**: Enforced compact 3-part JWS formatting in `extractBearerToken` to reject malformed or unsigned `alg: none` tokens early, scrubbed `__proto__`, `constructor`, and `prototype` keys recursively from request bodies and query parameters, added sliding-window IP rate limiting across AI chat, auth, contact/report/DMCA, and payment endpoints, and sandboxed admin document previews (`Content-Security-Policy: default-src 'none'; sandbox`).
- **HTTP Request Framing, Timeout & ReDoS Resilience (`server.js`, `server/landlordVerification.js`, `core/chatbot/chatbot.js`)**: Rejected ambiguous `Transfer-Encoding` + `Content-Length` framing headers with `400`, configured Node HTTP server socket/header limits (`headersTimeout`, `requestTimeout`, `keepAliveTimeout`, `maxHeadersCount`), and pre-checked upload payload lengths before string parsing to prevent regular-expression backtracking.
- **Zero-Exposure Items Verified**: Confirmed zero `Math.random` token generation (cryptographic `crypto.randomBytes` used throughout), zero SAML/SSO handlers, zero GraphQL servers, zero AES-CBC padding-oracle ciphers, zero XML/XXE parsers, and WebSockets disabled in Vite dev middleware (`hmr: false, ws: false`).

*(Note on dev build dependencies: `bun audit` flags upstream `vite@5.4.21` / `esbuild@0.21.5` advisories affecting local development tooling only; production runs without Vite middleware via prebuilt static files and `NODE_ENV=production`.)*

---

## PoC Verification

All checks below were executed and verified in the automated test suite (`npm test` — 12/12 passing) as well as live HTTP probes against port `3000`:

1. **Host Header & Cache Poisoning Rejection**:
   - **Trace**: `resolvePublicAppOrigin` called with spoofed `Origin: https://evil-attacker.com`, `Referer: https://evil-attacker.com/login`, `X-Forwarded-Host: evil-attacker.com`, and `Host: evil-attacker.com`.
   - **Expected**: Spoofed domain is rejected and never emitted into `<link rel="canonical">`, `og:url`, `og:image`, `/robots.txt`, `/sitemap.xml`, or auth email redirect URLs.
   - **Verified**: Confirmed by `Pen-Test Hardening PoCs` test (`resolvePublicAppOrigin(spoofedReq).includes('evil-attacker.com') === false`) and `Vary: Host, X-Forwarded-Host` header assertions.

2. **Unicode Homograph & Bounds Check**:
   - **Trace**: `isValidEmail('admin@nortav\u0430.co.zw')` (Cyrillic small letter `а`) and oversized local-part `${'a'.repeat(65)}@example.com`.
   - **Expected**: ASCII email `admin@nortava.co.zw` returns `true`; homograph and over-length inputs return `false`.
   - **Verified**: Passed in `Pen-Test Hardening PoCs` test.

3. **Prototype Pollution & Unsigned JWT Rejection**:
   - **Trace**: Parsed JSON payload containing `"__proto__": {"isAdmin": true}` and `"constructor": {"prototype": ...}` passed through `sanitizePrototypePollution`; unsigned `alg: none` Bearer header passed to `extractBearerToken`.
   - **Expected**: Polluted keys are stripped before handlers execute; unsigned two-segment JWT returns `null` (HTTP `401`).
   - **Verified**: Passed in `Pen-Test Hardening PoCs` test.

4. **Database View RLS Compliance (`public_profiles`)**:
   - **Trace**: Inspected `supabase_schema.sql` view definition for `public_profiles`.
   - **Expected**: View declares `WITH (security_invoker = true)`.
   - **Verified**: Passed automated regex assertion in `Pen-Test Hardening PoCs`.

5. **Google Search SEO, Canonical Redirects, SSR & Real HTTP 404s**:
   - **Trace**: Requested `GET /index.html?utm_source=test` (`redirect: 'manual'`), `GET /nonexistent-page.html`, `GET /does-not-exist`, `GET /listing.html`, `GET /listing.html?id=sample`, and SSR hydration helpers `injectListingBodySsr` / `injectListingsDirectorySsr`.
   - **Expected**: `/index.html` returns `301` -> `/?utm_source=test`; missing pages/invalid listing IDs return `404` with `X-Robots-Tag: noindex, nofollow`; valid listings hydrate heading, price, description, and image `alt` HTML server-side.
   - **Verified**: Passed in `Social Media Metadata & Google SEO` test (`12/12` passing).

6. **Listings Page Compact Dropdown Filters**:
   - **Trace**: Loaded `/listings.html` and verified `.compact-filter-toolbar` with `#dropdownLocationBtn`, `#dropdownPriceBtn`, and `#dropdownFiltersBtn` popovers.
   - **Expected**: Multi-row stacked filter cards replaced by a single-row search + popover toolbar so property cards render immediately above the fold.
   - **Verified**: Confirmed markup & runtime JS integration.
