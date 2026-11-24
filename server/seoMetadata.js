export const BRAND_NAME = 'Nortava Real Estate';
export const DEFAULT_OG_IMAGE_PATH = '/assets/images/nortava-og-card.jpg';
export const DEFAULT_LOGO_PATH = '/assets/images/logo/nortava-logo.png';
export const DEFAULT_GOOGLE_SITE_VERIFICATION = '4aCMJuKR4l8mPFePSPdcX8kGYdonI_o4O4Uek2RSIiw';
export const DEFAULT_TITLE = 'Nortava - Real Estate Across Zimbabwe';
export const DEFAULT_DESCRIPTION =
  'Zimbabwe-wide property rental and sales directory across all 10 provinces with Tariro AI property finder, Title Deed & National ID verified landlords, and EcoCash, OneMoney, Mukuru & InnBucks unlock support. Find your perfect property anywhere in Zimbabwe and connect directly with verified landlords.';

export function resolveGoogleVerificationToken() {
  const raw = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim();
  const stripped = raw.replace(/^google-site-verification=/i, '').trim();
  if (/^[a-zA-Z0-9_-]{10,128}$/.test(stripped)) {
    return stripped;
  }
  return DEFAULT_GOOGLE_SITE_VERIFICATION;
}

export const PUBLIC_SITEMAP_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/listings.html', changefreq: 'hourly', priority: '0.9' },
  { path: '/how-it-works.html', changefreq: 'weekly', priority: '0.8' },
  { path: '/about.html', changefreq: 'monthly', priority: '0.7' },
  { path: '/faq.html', changefreq: 'weekly', priority: '0.8' },
  { path: '/safety.html', changefreq: 'monthly', priority: '0.8' },
  { path: '/contact.html', changefreq: 'monthly', priority: '0.6' },
  { path: '/report.html', changefreq: 'monthly', priority: '0.5' },
  { path: '/legal/terms.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/privacy.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/cookies.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/dmca.html', changefreq: 'yearly', priority: '0.3' }
];

export const PAGE_SEO_MAP = {
  '/': {
    title: 'Nortava - Real Estate Across Zimbabwe',
    description:
      'Find your perfect property anywhere in Zimbabwe across all 10 provinces — Harare, Bulawayo, Norton, Mutare, Gweru, Masvingo, and Victoria Falls. Browse free, use Tariro AI to match conditions, and connect directly with document-verified landlords.',
    breadcrumb: null
  },
  '/index.html': {
    title: 'Nortava - Real Estate Across Zimbabwe',
    description:
      'Find your perfect property anywhere in Zimbabwe across all 10 provinces — Harare, Bulawayo, Norton, Mutare, Gweru, Masvingo, and Victoria Falls. Browse free, use Tariro AI to match conditions, and connect directly with document-verified landlords.',
    breadcrumb: null
  },
  '/listings.html': {
    title: 'Browse Properties Across Zimbabwe - Nortava Real Estate',
    description:
      'Browse verified rental houses, flats, cottages, rooms, and stands for sale across Harare, Bulawayo, Norton (Knowe, Galloway, Katanga), Mutare, Gweru, Masvingo, and all 10 provinces of Zimbabwe.',
    breadcrumb: 'Browse Listings'
  },
  '/listing.html': {
    title: 'Property Details - Nortava Real Estate Zimbabwe',
    description:
      'View verified Zimbabwe property photos, pricing, water/electricity/solar amenities, and unlock direct contact details for document-verified landlords on Nortava Real Estate.',
    breadcrumb: 'Property Details'
  },
  '/how-it-works.html': {
    title: 'How It Works - Nortava Real Estate Zimbabwe',
    description:
      'Learn how Nortava Real Estate works in Zimbabwe: browse listings free across all 10 provinces, ask Tariro AI to match suburbs and conditions, and pay a flat $2.50 via EcoCash, OneMoney, Mukuru, or InnBucks to contact verified landlords directly.',
    breadcrumb: 'How It Works'
  },
  '/about.html': {
    title: 'About Us - Nortava Real Estate Zimbabwe',
    description:
      'Learn how Nortava Real Estate eliminates agent delays and rental scams across Zimbabwe by connecting tenants directly with Title Deed and National ID verified landlords across all 10 provinces.',
    breadcrumb: 'About Us'
  },
  '/faq.html': {
    title: 'Frequently Asked Questions - Nortava Real Estate Zimbabwe',
    description:
      'Find answers to common questions about browsing Zimbabwe properties on Nortava, landlord Title Deed and National ID verification, EcoCash and InnBucks unlock fees, and tenant safety.',
    breadcrumb: 'FAQ'
  },
  '/safety.html': {
    title: 'Safety Guide - Nortava Real Estate Zimbabwe',
    description:
      'Essential anti-scam tips, Title Deed and National ID verification checks, and safe viewing practices for renting or buying property anywhere in Zimbabwe.',
    breadcrumb: 'Safety Guide'
  },
  '/contact.html': {
    title: 'Contact Us - Nortava Real Estate Zimbabwe',
    description:
      'Get in touch with Nortava Real Estate support for landlord KYC verification help, tenant assistance, listing questions, or partnership inquiries across Zimbabwe.',
    breadcrumb: 'Contact Us'
  },
  '/report.html': {
    title: 'Report an Issue - Nortava Real Estate Zimbabwe',
    description:
      'Report suspicious listings, inaccurate property details, or suspected scams so our moderation team can protect Zimbabwean tenants and landlords.',
    breadcrumb: 'Report Issue'
  },
  '/auth/login.html': {
    title: 'Login - Nortava Real Estate',
    description:
      'Sign in to your Nortava Real Estate account to manage verified Zimbabwe property listings, saved homes, and unlocked landlord contacts.',
    noindex: true
  },
  '/auth/register.html': {
    title: 'Create Account - Nortava Real Estate',
    description:
      'Create a Nortava Real Estate account as a tenant or submit Title Deeds and Zimbabwe National ID for verified landlord onboarding across all 10 provinces.',
    noindex: true
  },
  '/auth/reset-password.html': {
    title: 'Reset Password - Nortava Real Estate',
    description:
      'Request a password reset link or set a new password securely for your Nortava Real Estate account.',
    noindex: true
  },
  '/legal/terms.html': {
    title: 'Terms of Service - Nortava Real Estate',
    description:
      'Read the Nortava Real Estate Terms of Service governing Zimbabwe property listings, landlord KYC verification, and platform unlock fees.',
    breadcrumb: 'Terms of Service'
  },
  '/legal/privacy.html': {
    title: 'Privacy Policy - Nortava Real Estate',
    description:
      'Learn how Nortava Real Estate collects, protects, and processes personal information and landlord verification documents safely under Zimbabwe law.',
    breadcrumb: 'Privacy Policy'
  },
  '/legal/cookies.html': {
    title: 'Cookie & Storage Policy - Nortava Real Estate',
    description:
      'Understand how Nortava Real Estate uses essential session storage and optional preference controls across the platform.',
    breadcrumb: 'Cookie Policy'
  },
  '/legal/dmca.html': {
    title: 'DMCA & Copyright Policy - Nortava Real Estate',
    description:
      'Submit copyright takedown notices or intellectual property inquiries for content hosted on Nortava Real Estate.',
    breadcrumb: 'DMCA Policy'
  }
};

export function isNoIndexPath(pathname = '/') {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (
    cleanPath.startsWith('/admin/') ||
    cleanPath.startsWith('/dashboard/') ||
    cleanPath.startsWith('/payment/') ||
    cleanPath.startsWith('/auth/')
  ) {
    return true;
  }
  return Boolean(PAGE_SEO_MAP[cleanPath]?.noindex);
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeJsonLdStringify(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

function normalizeHttpImageUrl(rawUrl, origin) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return origin ? `${origin}${trimmed}` : trimmed;
  return origin ? `${origin}/${trimmed.replace(/^\.?\//, '')}` : `/${trimmed.replace(/^\.?\//, '')}`;
}

export async function fetchListingForSeo(supabase, listingId) {
  if (!supabase || typeof listingId !== 'string') return null;
  const cleanId = listingId.trim();
  if (!cleanId || cleanId === 'sample' || cleanId.length < 6 || cleanId.length > 80) {
    return null;
  }

  try {
    const queryPromise = supabase
      .from('listings')
      .select('id, title, price, type, location, rooms, bathrooms, size, description, created_at, listing_images(image_url)')
      .eq('id', cleanId)
      .eq('status', 'published')
      .maybeSingle();

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 1500)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
    if (error || !data) return null;

    const priceNum = Number(data.price);
    const formattedPrice = Number.isFinite(priceNum)
      ? `$${priceNum.toLocaleString('en-US')}${data.type === 'rent' ? '/mo' : ''}`
      : '';
    const listingTypeLabel = data.type === 'rent' ? 'For Rent' : 'For Sale';
    const bedsText = data.rooms ? `${data.rooms} Bed${Number(data.rooms) === 1 ? '' : 's'}` : '';
    const bathsText = data.bathrooms ? `${data.bathrooms} Bath` : '';
    const specs = [listingTypeLabel, data.location, bedsText, bathsText].filter(Boolean).join(' • ');
    const snippet = String(data.description || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    const title = [data.title, formattedPrice, BRAND_NAME].filter(Boolean).join(' – ').slice(0, 110);
    const description = [specs, snippet].filter(Boolean).join(' — ').slice(0, 220);
    const imageUrls = (data.listing_images || [])
      .map((img) => String(img?.image_url || '').trim())
      .filter((u) => /^https?:\/\//i.test(u));
    const imageUrl = imageUrls[0] || '';

    return {
      id: data.id,
      title,
      shortTitle: data.title || 'Property Details',
      description,
      fullDescription: String(data.description || '').trim(),
      imageUrl,
      imageUrls,
      price: Number.isFinite(priceNum) ? priceNum : null,
      type: data.type || 'rent',
      location: data.location || 'Zimbabwe',
      rooms: Number.isFinite(Number(data.rooms)) ? Number(data.rooms) : null,
      bathrooms: Number.isFinite(Number(data.bathrooms)) ? Number(data.bathrooms) : null,
      size: data.size || '',
      createdAt: data.created_at || null
    };
  } catch {
    return null;
  }
}

export async function fetchPublishedListingsForSsr(supabase, limit = 12) {
  if (!supabase) return [];
  try {
    const queryPromise = supabase
      .from('listings')
      .select('id, title, price, type, location, rooms, bathrooms, listing_images(image_url)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(1, Number(limit) || 12), 24));

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 1500)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
    if (error || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

export function injectListingBodySsr(html, listingSeo) {
  if (typeof html !== 'string' || !listingSeo) return html;
  const safeTitle = escapeText(listingSeo.shortTitle || listingSeo.title || 'Property Details');
  const safeLocation = escapeText(listingSeo.location || 'Zimbabwe');
  const safeDesc = escapeText(listingSeo.fullDescription || listingSeo.description || '');
  const priceNum = listingSeo.price !== null ? Number(listingSeo.price).toLocaleString('en-US') : '0';
  const priceHtml = listingSeo.type === 'rent' ? `$${escapeText(priceNum)} <span>/month</span>` : `$${escapeText(priceNum)}`;
  const roomsText = listingSeo.rooms !== null ? escapeText(listingSeo.rooms) : '-';
  const bathsText = listingSeo.bathrooms !== null ? escapeText(listingSeo.bathrooms) : '-';
  const sizeText = listingSeo.size ? escapeText(listingSeo.size) : 'N/A';

  let out = html
    .replace(/(<span id="listingTitle">)[\s\S]*?(<\/span>)/i, `$1${safeTitle}$2`)
    .replace(/(<h1 id="propertyTitle">)[\s\S]*?(<\/h1>)/i, `$1${safeTitle}$2`)
    .replace(/(<span id="propertyLocation">)[\s\S]*?(<\/span>)/i, `$1${safeLocation}$2`)
    .replace(/(<strong id="bedroomCount">)[\s\S]*?(<\/strong>)/i, `$1${roomsText}$2`)
    .replace(/(<strong id="bathroomCount">)[\s\S]*?(<\/strong>)/i, `$1${bathsText}$2`)
    .replace(/(<strong id="propertySize">)[\s\S]*?(<\/strong>)/i, `$1${sizeText}$2`)
    .replace(/(<p id="propertyDescription">)[\s\S]*?(<\/p>)/i, `$1${safeDesc}$2`)
    .replace(/(<div class="listing-price-large">)[\s\S]*?(<\/div>)/i, `$1${priceHtml}$2`);

  if (listingSeo.imageUrl) {
    const safeImg = escapeAttr(listingSeo.imageUrl);
    out = out.replace(
      /(<div class="gallery-main">)[\s\S]*?(<\/div>)/i,
      `$1<img src="${safeImg}" alt="${escapeAttr(`${listingSeo.shortTitle || 'Zimbabwe property'} in ${listingSeo.location || 'Zimbabwe'}`)}" width="800" height="500" fetchpriority="high">$2`
    );
  }
  return out;
}

export function injectListingsDirectorySsr(html, listings = []) {
  if (typeof html !== 'string' || !Array.isArray(listings) || listings.length === 0) return html;
  const gridMarker = '<div class="listings-grid" id="listingsGrid">';
  const startIdx = html.indexOf(gridMarker);
  if (startIdx === -1) return html;

  const endMarker = '</div>\n\n        <div class="empty-state"';
  const endIdx = html.indexOf(endMarker, startIdx);
  if (endIdx === -1) return html;

  const cardsHtml = listings
    .filter((item) => item && item.id)
    .map((item) => {
      const safeTitle = escapeText(item.title || 'Zimbabwe Property');
      const safeLoc = escapeText(item.location || 'Zimbabwe');
      const priceVal = Number(item.price || 0).toLocaleString('en-US');
      const suffix = item.type === 'rent' ? '/month' : '';
      const rawImg = item.listing_images?.[0]?.image_url || '';
      const imgHtml = /^https?:\/\//i.test(rawImg)
        ? `<img src="${escapeAttr(rawImg)}" alt="${escapeAttr(`${item.title || 'Property'} in ${item.location || 'Zimbabwe'}`)}" width="400" height="250" loading="lazy">`
        : `<div class="property-image-placeholder"><i class="ri-home-4-line"></i></div>`;
      return `
          <article class="card property-card">
            <a href="/listing.html?id=${encodeURIComponent(item.id)}" style="text-decoration: none; color: inherit; display: block;">
              <div class="property-image">${imgHtml}</div>
              <div class="property-body">
                <div class="property-price">$${escapeText(priceVal)}${suffix ? `<span>${suffix}</span>` : ''}</div>
                <h2 class="property-title">${safeTitle}</h2>
                <p class="property-location"><i class="ri-map-pin-line"></i> ${safeLoc}</p>
              </div>
            </a>
          </article>`;
    })
    .join('\n');

  if (!cardsHtml.trim()) return html;
  return `${html.slice(0, startIdx + gridMarker.length)}\n${cardsHtml}\n        ${html.slice(endIdx)}`;
}

export function build404Html({
  origin = '',
  title = 'Page Not Found – Nortava Real Estate',
  message = 'The page or property listing you are looking for could not be found.'
} = {}) {
  const cleanOrigin = String(origin || '').replace(/\/+$/, '');
  const logoSrc = cleanOrigin ? `${cleanOrigin}${DEFAULT_LOGO_PATH}` : DEFAULT_LOGO_PATH;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeText(title)}</title>
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="shortcut icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/css/main.css">
</head>
<body>
  <header class="header">
    <div class="container header-inner">
      <a href="/" class="logo">
        <img src="/assets/images/logo/nortava-logo.jpg" alt="Nortava Real Estate Zimbabwe logo" width="44" height="44">
        <span>Nortava</span>
      </a>
      <nav class="nav">
        <ul class="nav-links">
          <li><a href="/" class="nav-link">Home</a></li>
          <li><a href="/listings.html" class="nav-link">Listings</a></li>
          <li><a href="/how-it-works.html" class="nav-link">How It Works</a></li>
          <li><a href="/about.html" class="nav-link">About</a></li>
          <li><a href="/contact.html" class="nav-link">Contact</a></li>
        </ul>
      </nav>
    </div>
  </header>
  <main style="padding: 8rem 0 5rem; min-height: 75vh; display: flex; align-items: center;">
    <div class="container" style="max-width: 640px; text-align: center;">
      <div class="card" style="padding: 3rem 2rem;">
        <p style="font-size: 3rem; font-weight: 800; color: var(--primary); margin: 0 0 0.5rem;">404</p>
        <h1 style="margin: 0 0 0.75rem;">${escapeText(title.replace(/\s*[–-]\s*Nortava.*$/i, ''))}</h1>
        <p style="color: var(--text-secondary); margin-bottom: 1.75rem;">${escapeText(message)}</p>
        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
          <a href="/" class="btn btn-secondary">Back to Home</a>
          <a href="/listings.html" class="btn btn-primary">Browse Zimbabwe Listings</a>
        </div>
      </div>
    </div>
  </main>
</body>
</html>`;
}

export async function buildSitemapXml(origin = '', supabase = null) {
  const cleanOrigin = String(origin || '').replace(/\/+$/, '');
  const base = cleanOrigin || 'https://nortava.example';
  const todayIso = new Date().toISOString().split('T')[0];

  const urls = PUBLIC_SITEMAP_ROUTES.map((route) => ({
    loc: `${base}${route.path}`,
    lastmod: todayIso,
    changefreq: route.changefreq,
    priority: route.priority
  }));

  if (supabase) {
    try {
      const queryPromise = supabase
        .from('listings')
        .select('id, updated_at, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(500);
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 1500)
      );
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      if (!error && Array.isArray(data)) {
        for (const item of data) {
          if (!item?.id) continue;
          const rawDate = item.updated_at || item.created_at;
          const lastmod = rawDate ? String(rawDate).slice(0, 10) : todayIso;
          urls.push({
            loc: `${base}/listing.html?id=${encodeURIComponent(item.id)}`,
            lastmod: /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? lastmod : todayIso,
            changefreq: 'daily',
            priority: '0.85'
          });
        }
      }
    } catch {
      // Fall back to static routes if database query fails
    }
  }

  const entries = urls
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${escapeText(u.loc)}</loc>\n` +
        `    <lastmod>${escapeText(u.lastmod)}</lastmod>\n` +
        `    <changefreq>${escapeText(u.changefreq)}</changefreq>\n` +
        `    <priority>${escapeText(u.priority)}</priority>\n` +
        `  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function buildRobotsTxt(origin = '') {
  const cleanOrigin = String(origin || '').replace(/\/+$/, '');
  const verificationToken = resolveGoogleVerificationToken();
  const lines = [
    `# google-site-verification=${verificationToken}`,
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /dashboard/',
    'Disallow: /payment/',
    'Disallow: /api/',
    'Disallow: /auth/reset-password.html'
  ];
  if (cleanOrigin) {
    lines.push(`Sitemap: ${cleanOrigin}/sitemap.xml`);
  }
  return `${lines.join('\n')}\n`;
}

function buildPageStructuredData({ cleanOrigin, cleanPath, canonicalUrl, pageTitle, pageDescription, ogImageUrl, logoUrl, listingSeo }) {
  const baseOrigin = cleanOrigin || '/';

  if (listingSeo) {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'RealEstateListing',
          name: listingSeo.title,
          description: listingSeo.description,
          url: canonicalUrl,
          image: ogImageUrl,
          ...(listingSeo.price !== null
            ? {
                offers: {
                  '@type': 'Offer',
                  price: String(listingSeo.price),
                  priceCurrency: 'USD',
                  availability: 'https://schema.org/InStock'
                }
              }
            : {}),
          provider: {
            '@type': 'RealEstateAgent',
            name: BRAND_NAME,
            url: baseOrigin,
            logo: logoUrl,
            telephone: '+263789707745',
            email: 'nortava@gmail.com',
            areaServed: { '@type': 'Country', name: 'Zimbabwe' },
            address: { '@type': 'PostalAddress', addressLocality: 'Norton', addressCountry: 'ZW' }
          }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: 'Browse Listings', item: `${cleanOrigin}/listings.html` },
            { '@type': 'ListItem', position: 3, name: listingSeo.shortTitle || 'Property Details', item: canonicalUrl }
          ]
        }
      ]
    };
  }

  const graph = [
    {
      '@type': 'RealEstateAgent',
      name: BRAND_NAME,
      url: baseOrigin,
      logo: logoUrl,
      image: ogImageUrl,
      description: DEFAULT_DESCRIPTION,
      telephone: '+263789707745',
      email: 'nortava@gmail.com',
      areaServed: { '@type': 'Country', name: 'Zimbabwe' },
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Norton',
        addressRegion: 'Mashonaland West',
        addressCountry: 'ZW'
      }
    },
    {
      '@type': 'WebApplication',
      name: BRAND_NAME,
      url: canonicalUrl,
      description: pageDescription,
      image: ogImageUrl,
      applicationCategory: 'RealEstateApplication',
      operatingSystem: 'All',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      }
    }
  ];

  if (cleanPath === '/') {
    graph.push({
      '@type': 'WebSite',
      name: BRAND_NAME,
      url: `${cleanOrigin}/`,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${cleanOrigin}/listings.html?location={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    });
  } else {
    const breadcrumbName = PAGE_SEO_MAP[cleanPath]?.breadcrumb;
    if (breadcrumbName) {
      graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
          { '@type': 'ListItem', position: 2, name: breadcrumbName, item: canonicalUrl }
        ]
      });
    }
  }

  if (cleanPath === '/faq.html') {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Nortava?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Nortava is a Zimbabwe-wide direct real estate platform covering all 10 provinces—including Harare, Bulawayo, Norton, Mutare, Gweru, Masvingo, Chinhoyi, and Victoria Falls—connecting tenants and buyers with document-verified landlords.'
          }
        },
        {
          '@type': 'Question',
          name: 'Is Nortava free to use?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Browsing listings and asking Tariro AI to match homes by area and conditions is completely free. Verified landlords can list properties for free. Tenants only pay a small $2.50 fee when they want to unlock a landlord contact.'
          }
        },
        {
          '@type': 'Question',
          name: 'Which parts of Zimbabwe does Nortava cover?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Nortava covers all 10 Provinces of Zimbabwe down to Cities/Towns, Zones, and Suburbs such as Knowe, Galloway, and Katanga in Norton, Borrowdale and Avondale in Harare, Suburbs in Bulawayo, and dozens more nationwide.'
          }
        },
        {
          '@type': 'Question',
          name: 'What payment methods are accepted?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We accept EcoCash, OneMoney, Mukuru, and InnBucks—trusted mobile payment methods in Zimbabwe.'
          }
        },
        {
          '@type': 'Question',
          name: 'How are landlords verified against scams?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Landlords must submit their Zimbabwe National ID and property proof (Title Deed, Cession Agreement, or Council Offer Letter) for AI screening, duplicate hash checks, and Admin authentication before listings go live.'
          }
        }
      ]
    });
  } else if (cleanPath === '/how-it-works.html') {
    graph.push({
      '@type': 'HowTo',
      name: 'How to Find and Rent a Verified Home in Zimbabwe on Nortava',
      description: pageDescription,
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Browse Listings',
          text: 'Search properties across all 10 provinces of Zimbabwe by province, city/town, zone, suburb, price, and amenities, or ask Tariro AI.'
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Save Favorites',
          text: 'Create a free account to save and compare shortlisted homes across Zimbabwe.'
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Unlock Contact',
          text: 'Pay a one-time $2.50 fee using EcoCash, OneMoney, Mukuru, or InnBucks to unlock verified landlord contact details.'
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: 'Connect Directly',
          text: 'Call or WhatsApp the verified landlord directly to schedule viewings and agree on lease terms.'
        }
      ]
    });
  } else if (cleanPath === '/listings.html') {
    graph.push({
      '@type': 'CollectionPage',
      name: pageTitle,
      description: pageDescription,
      url: canonicalUrl
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph
  };
}

export function injectSocialMetaTags(html, { origin = '', pathname = '/', listingId = '', listingSeo = null } = {}) {
  if (typeof html !== 'string' || !/<\/head>/i.test(html)) {
    return html;
  }

  const cleanOrigin = String(origin || '').replace(/\/+$/, '');
  const cleanPath = pathname === '/index.html' ? '/' : (pathname.startsWith('/') ? pathname : `/${pathname}`);
  const routeSeo = PAGE_SEO_MAP[pathname] || PAGE_SEO_MAP[cleanPath] || null;
  const noIndex = isNoIndexPath(cleanPath);

  const existingTitleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const existingDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);

  const pageTitle = listingSeo?.title
    || routeSeo?.title
    || (existingTitleMatch?.[1]?.trim() ? `${existingTitleMatch[1].trim()}` : DEFAULT_TITLE);

  const pageDescription = listingSeo?.description
    || routeSeo?.description
    || existingDescMatch?.[1]?.trim()
    || DEFAULT_DESCRIPTION;

  const canonicalPath = listingSeo?.id
    ? `/listing.html?id=${encodeURIComponent(listingSeo.id)}`
    : (cleanPath === '/listing.html' && listingId && listingId !== 'sample'
        ? `/listing.html?id=${encodeURIComponent(listingId)}`
        : cleanPath);
  const canonicalUrl = cleanOrigin ? `${cleanOrigin}${canonicalPath}` : canonicalPath;

  const ogImageUrl = listingSeo?.imageUrl
    ? normalizeHttpImageUrl(listingSeo.imageUrl, cleanOrigin)
    : normalizeHttpImageUrl(DEFAULT_OG_IMAGE_PATH, cleanOrigin);
  const logoUrl = normalizeHttpImageUrl(DEFAULT_LOGO_PATH, cleanOrigin);
  const isDefaultCard = !listingSeo?.imageUrl;

  const safeGoogleVerification = resolveGoogleVerificationToken();

  let cleanedHtml = html
    .replace(/<meta\s+[^>]*property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+[^>]*name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+[^>]*name=["']robots["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+[^>]*name=["']google-site-verification["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+[^>]*property=["']fb:app_id["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+[^>]*property=["']linkedin:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+[^>]*name=["']theme-color["'][^>]*>\s*/gi, '')
    .replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*>\s*/gi, '')
    .replace(/<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*>\s*/gi, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  if (/<title>[\s\S]*?<\/title>/i.test(cleanedHtml)) {
    cleanedHtml = cleanedHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(pageTitle)}</title>`);
  } else {
    cleanedHtml = cleanedHtml.replace(/<head[^>]*>/i, (m) => `${m}\n  <title>${escapeText(pageTitle)}</title>`);
  }

  if (/<meta\s+name=["']description["'][^>]*>/i.test(cleanedHtml)) {
    cleanedHtml = cleanedHtml.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${escapeAttr(pageDescription)}">`
    );
  } else {
    cleanedHtml = cleanedHtml.replace(
      /<title>[\s\S]*?<\/title>/i,
      (m) => `${m}\n  <meta name="description" content="${escapeAttr(pageDescription)}">`
    );
  }

  const robotsContent = noIndex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  const structuredData = noIndex
    ? null
    : buildPageStructuredData({
        cleanOrigin,
        cleanPath,
        canonicalUrl,
        pageTitle,
        pageDescription,
        ogImageUrl,
        logoUrl,
        listingSeo
      });

  const socialMetaBlock = [
    `  <meta name="robots" content="${robotsContent}">`,
    ...(safeGoogleVerification ? [`  <meta name="google-site-verification" content="${escapeAttr(safeGoogleVerification)}">`] : []),
    `  <meta name="theme-color" content="#0f172a">`,
    `  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">`,
    `  <link rel="icon" href="/favicon.ico" sizes="any">`,
    `  <link rel="shortcut icon" href="/favicon.ico">`,
    `  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">`,
    `  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">`,
    `  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">`,
    `  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`,
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:site_name" content="${escapeAttr(BRAND_NAME)}">`,
    `  <meta property="og:locale" content="en_ZW">`,
    `  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">`,
    `  <meta property="og:title" content="${escapeAttr(pageTitle)}">`,
    `  <meta property="og:description" content="${escapeAttr(pageDescription)}">`,
    `  <meta property="og:image" content="${escapeAttr(ogImageUrl)}">`,
    ...(ogImageUrl.startsWith('https://')
      ? [`  <meta property="og:image:secure_url" content="${escapeAttr(ogImageUrl)}">`]
      : []),
    ...(isDefaultCard
      ? [
          `  <meta property="og:image:type" content="image/jpeg">`,
          `  <meta property="og:image:width" content="1200">`,
          `  <meta property="og:image:height" content="630">`
        ]
      : []),
    `  <meta property="og:image:alt" content="${escapeAttr(pageTitle.includes(BRAND_NAME) ? pageTitle : `${BRAND_NAME} – ${pageTitle}`)}">`,
    `  <meta property="og:logo" content="${escapeAttr(logoUrl)}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:url" content="${escapeAttr(canonicalUrl)}">`,
    `  <meta name="twitter:title" content="${escapeAttr(pageTitle)}">`,
    `  <meta name="twitter:description" content="${escapeAttr(pageDescription)}">`,
    `  <meta name="twitter:image" content="${escapeAttr(ogImageUrl)}">`,
    `  <meta name="twitter:image:alt" content="${escapeAttr(`${BRAND_NAME} Logo`)}">`,
    ...(structuredData
      ? [`  <script type="application/ld+json">\n${safeJsonLdStringify(structuredData)}\n  </script>`]
      : [])
  ].join('\n');

  return cleanedHtml.replace(/<\/head>/i, `${socialMetaBlock}\n</head>`);
}
