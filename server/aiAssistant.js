import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  ZIMBABWE_LOCATIONS,
  matchesLocationFilter,
  parseLocationString
} from '../core/locations/zimbabweLocations.js';
import { getNeighborhoodInfo } from '../core/neighborhoods/neighborhoods.js';

export const CHAT_MODEL = 'gemini-4-hydrogen';

const ZIMBABWE_REGION_SUMMARY = ZIMBABWE_LOCATIONS.map(p => {
  const citiesStr = p.cities
    .map(c => `${c.city} (${c.zones.flatMap(z => z.areas).slice(0, 5).join(', ')}${c.zones.flatMap(z => z.areas).length > 5 ? ', ...' : ''})`)
    .join('; ');
  return `- ${p.province}: ${citiesStr}`;
}).join('\n');

const ZIMBABWE_LOCATION_GUIDE = `
Nationwide Zimbabwe Coverage:
Nortava covers ALL 10 Provinces of Zimbabwe with hierarchical browsing (Province > City/Town/District > Zone > Suburb/Growth Point) at /listings.html:
${ZIMBABWE_REGION_SUMMARY}
`;

const ZIMBABWE_LEGAL_KNOWLEDGE = `
Key Zimbabwean Property & Platform Rules (informational guidance, not formal legal advice):
1. Nortava's Role (Estate Agents Act [Chapter 27:17]): Nortava is strictly a nationwide online property listing directory across Zimbabwe—NOT a licensed Estate Agent, property manager, or escrow agent. Nortava never collects rent, security deposits, or sale commissions.
2. Landlord Anti-Scam Verification: All landlords must submit their Zimbabwe National ID and property Title Deed / Cession / Council Offer Letter during registration, screened by AI and verified by Nortava admins before receiving a verified badge and publishing.
3. Pricing & Payments (Consumer Protection Act [Chapter 14:14] & National Payment Systems Act [Chapter 24:23]): Tenants browse free and pay a single, transparent one-time $2.50 USD fee per property (no subscription or auto-renewal) via RBZ-authorized payment channels (EcoCash, OneMoney, InnBucks, Mukuru) once merchant gateway keys are active. Landlords list properties for free.
4. Tenancy Best Practices (Rent Regulations & Legal Age of Majority [Chapter 8:07]): Only persons 18+ have contractual capacity to sign leases. Tenants should inspect properties in person before paying any rent or deposit, request original ownership proof + National ID, sign a written lease, demand written receipts for every payment, and never pay "viewing fees" or advance deposits to strangers. Disputes can go to the Zimbabwe Rent Board or Consumer Protection Commission; fraud is reported to ZRP.
5. Privacy & Copyright (Cyber and Data Protection Act [Chapter 12:07] / SI 155 of 2024 & Copyright and Neighbouring Rights Act [Chapter 26:05]): Users must be 18+ for accounts (under 13 strictly prohibited on all forms). Report scams at /report.html or copyright notices at /legal/dmca.html.
`;

function createGeminiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

export function buildListingsFilterUrl(criteria = {}) {
  const params = new URLSearchParams();
  if (criteria.province) params.set('province', String(criteria.province));
  if (criteria.city) params.set('city', String(criteria.city));
  if (criteria.zone) params.set('zone', String(criteria.zone));
  if (criteria.area) params.set('area', String(criteria.area));
  if (criteria.keyword) params.set('location', String(criteria.keyword));
  if (criteria.type) params.set('type', String(criteria.type));
  if (criteria.maxPrice !== undefined && criteria.maxPrice !== null && criteria.maxPrice !== '') {
    params.set('max_price', String(criteria.maxPrice));
  }
  if (criteria.minRooms !== undefined && criteria.minRooms !== null && criteria.minRooms !== '') {
    params.set('rooms', String(criteria.minRooms));
  }
  const qs = params.toString();
  return qs ? `/listings.html?${qs}` : '/listings.html';
}

export function filterListingsByConditions(listings = [], criteria = {}) {
  const {
    province = '',
    city = '',
    zone = '',
    area = '',
    keyword = '',
    type = '',
    minPrice,
    maxPrice,
    minRooms,
    maxRooms,
    minBathrooms,
    furnished,
    water,
    electricity,
    parking
  } = criteria;

  // Normalize location criteria if user passed a freeform suburb like "Katanga" or "Borrowdale"
  let resolvedLoc = { province, city, zone, area, location: keyword };
  if ((area || city || keyword) && (!province || !city)) {
    const probe = [area, city, province, keyword].filter(Boolean).join(', ');
    const parsed = parseLocationString(probe);
    if (!resolvedLoc.province && parsed.province) resolvedLoc.province = parsed.province;
    if (!resolvedLoc.city && parsed.city) resolvedLoc.city = parsed.city;
    if (!resolvedLoc.area && parsed.area) resolvedLoc.area = parsed.area;
  }

  return (listings || []).filter((item) => {
    if (type && item.type !== type) return false;
    const price = Number(item.price);
    if (Number.isFinite(Number(minPrice)) && minPrice !== '' && price < Number(minPrice)) return false;
    if (Number.isFinite(Number(maxPrice)) && maxPrice !== '' && price > Number(maxPrice)) return false;

    const rooms = Number(item.rooms || 0);
    if (Number.isFinite(Number(minRooms)) && minRooms !== '' && rooms < Number(minRooms)) return false;
    if (Number.isFinite(Number(maxRooms)) && maxRooms !== '' && rooms > Number(maxRooms)) return false;

    const bathrooms = Number(item.bathrooms || 1);
    if (Number.isFinite(Number(minBathrooms)) && minBathrooms !== '' && bathrooms < Number(minBathrooms)) return false;

    if (furnished === true && !item.furnished) return false;
    if (water === true && !item.water) return false;
    if (electricity === true && !item.electricity) return false;
    if (parking === true && !item.parking) return false;

    const hasLocFilter = Boolean(resolvedLoc.province || resolvedLoc.city || resolvedLoc.zone || resolvedLoc.area || resolvedLoc.location);
    if (hasLocFilter && !matchesLocationFilter(item.location, resolvedLoc)) {
      return false;
    }

    return true;
  });
}

async function fetchPublishedListingsPool(supabase) {
  if (!supabase) return { error: 'Live database is not connected.', listings: [] };
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, type, price, rooms, bathrooms, size, location, description, furnished, water, electricity, parking, users!user_id(verified, verification_tier)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(120);

    if (error) return { error: 'Unable to query published listings.', listings: [] };
    return { error: null, listings: data || [] };
  } catch {
    return { error: 'Unable to query published listings right now.', listings: [] };
  }
}

async function executeSearchProperties(supabase, args = {}) {
  const { error, listings } = await fetchPublishedListingsPool(supabase);
  if (error) {
    return {
      ok: false,
      error,
      matches: [],
      browseUrl: buildListingsFilterUrl(args)
    };
  }

  const matched = filterListingsByConditions(listings, args).slice(0, 8);
  return {
    ok: true,
    totalPublished: listings.length,
    matchCount: matched.length,
    browseUrl: buildListingsFilterUrl(args),
    matches: matched.map((l) => ({
      id: l.id,
      url: `/listing.html?id=${encodeURIComponent(l.id)}`,
      title: l.title,
      type: l.type,
      priceUsd: l.price,
      rooms: l.rooms,
      bathrooms: l.bathrooms || 1,
      size: l.size || 'N/A',
      location: l.location,
      amenities: [
        l.furnished ? 'Furnished' : null,
        l.water ? 'Water' : null,
        l.electricity ? 'Electricity' : null,
        l.parking ? 'Parking' : null
      ].filter(Boolean),
      verifiedLandlord: Boolean(l.users?.verified),
      verificationTier: l.users?.verification_tier || null
    }))
  };
}

function executeGetAreaInfo(args = {}) {
  const query = String(args.location || '').trim();
  if (!query) return { found: false, message: 'Provide a Zimbabwe suburb, town, or province name.' };
  const parsed = parseLocationString(query);
  const info = getNeighborhoodInfo(query);
  return {
    found: Boolean(parsed.province || parsed.city || parsed.area || info),
    hierarchy: parsed,
    neighborhoodInsights: info || null,
    browseUrl: buildListingsFilterUrl({
      province: parsed.province,
      city: parsed.city,
      zone: parsed.zone,
      area: parsed.area
    })
  };
}

const searchPropertiesDeclaration = {
  name: 'search_properties',
  description:
    'Search live published property listings across Zimbabwe filtered by area hierarchy (province, city/town, zone, suburb/area) and property conditions (rent/sale, price budget, bedrooms, bathrooms, furnished, water, electricity, parking). Always use this when a user asks to find or recommend homes matching criteria or areas.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      province: { type: Type.STRING, description: 'Zimbabwe province e.g. Harare, Mashonaland West, Bulawayo' },
      city: { type: Type.STRING, description: 'City, town, or district e.g. Norton, Harare, Bulawayo, Mutare, Chitungwiza' },
      zone: { type: Type.STRING, description: 'Area category/zone e.g. High Density & Estates, Low Density & Waterfront' },
      area: { type: Type.STRING, description: 'Specific suburb, township, or growth point e.g. Knowe, Katanga, Borrowdale, Avondale' },
      keyword: { type: Type.STRING, description: 'Optional location/street keyword' },
      type: { type: Type.STRING, description: 'Must be "rent" or "sale" if specified' },
      minPrice: { type: Type.NUMBER, description: 'Minimum price in USD' },
      maxPrice: { type: Type.NUMBER, description: 'Maximum price in USD' },
      minRooms: { type: Type.INTEGER, description: 'Minimum number of bedrooms' },
      maxRooms: { type: Type.INTEGER, description: 'Maximum number of bedrooms' },
      minBathrooms: { type: Type.INTEGER, description: 'Minimum number of bathrooms' },
      furnished: { type: Type.BOOLEAN, description: 'True if user requires furnished property' },
      water: { type: Type.BOOLEAN, description: 'True if user requires water available' },
      electricity: { type: Type.BOOLEAN, description: 'True if user requires electricity' },
      parking: { type: Type.BOOLEAN, description: 'True if user requires parking' }
    }
  }
};

const getAreaInfoDeclaration = {
  name: 'get_area_info',
  description:
    'Look up Zimbabwe province/city/zone hierarchy and typical rental/safety context for a suburb, town, or province.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: { type: Type.STRING, description: 'Suburb, town, or province name e.g. Knowe, Norton or Borrowdale, Harare' }
    },
    required: ['location']
  }
};

async function fetchCurrentListingSummary(supabase, currentListingId) {
  if (!supabase || !currentListingId) return '';
  try {
    const { data: current } = await supabase
      .from('listings')
      .select('id, title, type, price, rooms, bathrooms, size, location, description, furnished, water, electricity, parking, status')
      .eq('id', currentListingId)
      .eq('status', 'published')
      .maybeSingle();

    if (!current) return '';
    return `The user is currently viewing this listing: ${JSON.stringify({
      title: current.title,
      type: current.type,
      priceUsd: current.price,
      rooms: current.rooms,
      bathrooms: current.bathrooms || 1,
      size: current.size || 'N/A',
      location: current.location,
      water: current.water,
      electricity: current.electricity,
      furnished: current.furnished,
      parking: current.parking,
      url: `/listing.html?id=${encodeURIComponent(current.id)}`
    })}`;
  } catch {
    return '';
  }
}

async function generateWithRetry(ai, params, maxRetries = 2) {
  let attempt = 0;
  let lastError = null;
  while (attempt <= maxRetries) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastError = err;
      const status = Number(err?.status || err?.code || 0);
      const isRetryable = status === 429 || status >= 500 || !status;
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise(r => setTimeout(r, 350 * Math.pow(2, attempt)));
      attempt += 1;
    }
  }
  throw lastError;
}

function redactPossibleSecrets(text) {
  return String(text || '').replace(/AIza[0-9A-Za-z_-]{15,}/g, '[REDACTED_KEY]');
}

function unwrapGeminiErrorMessage(err) {
  const raw = redactPossibleSecrets(err?.message || '');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    const innerMsg = parsed?.error?.message || parsed?.message;
    if (innerMsg) return redactPossibleSecrets(innerMsg);
  } catch {
    // Plain text message
  }
  return raw;
}

function classifyGeminiError(err) {
  const status = Number(err?.status || err?.code || 500);
  const rawMessage = unwrapGeminiErrorMessage(err);
  const lower = rawMessage.toLowerCase();

  const isFreeTierBillingRequired =
    lower.includes('free tier is not available for this project') ||
    lower.includes('set up billing');

  const isKeyFailure =
    status === 401 ||
    status === 403 ||
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('permission denied') ||
    lower.includes('invalid authentication');

  if (isFreeTierBillingRequired) {
    return {
      ok: false,
      status: 502,
      code: 'GEMINI_BILLING_REQUIRED',
      error: 'Nortava AI cannot reply because the current GEMINI_API_KEY project requires billing / a paid-tier key (Gemini API free tier is unavailable on that project). Update GEMINI_API_KEY in Settings > Secrets with a billed key.'
    };
  }
  if (isKeyFailure) {
    return {
      ok: false,
      status: 502,
      code: 'GEMINI_KEY_INVALID',
      error: `AI service key authorization failed (${rawMessage || `HTTP ${status}`}). Please verify GEMINI_API_KEY in Settings > Secrets.`
    };
  }
  if (status === 404 || lower.includes('not_found') || lower.includes('not found')) {
    return {
      ok: false,
      status: 502,
      code: 'GEMINI_MODEL_NOT_FOUND',
      error: `AI model "${CHAT_MODEL}" could not be resolved (${rawMessage || '404 Not Found'}).`
    };
  }
  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      ok: false,
      status: 429,
      code: 'GEMINI_RATE_LIMITED',
      error: 'Nortava AI is busy right now (rate limit or quota reached). Please wait a few seconds and retry.'
    };
  }
  if (status === 400) {
    return {
      ok: false,
      status: 502,
      code: 'GEMINI_BAD_REQUEST',
      error: `AI request parameter error (${rawMessage || '400 Bad Request'}).`
    };
  }
  return {
    ok: false,
    status: 502,
    code: 'GEMINI_UPSTREAM_ERROR',
    error: `Unable to reach the AI assistant right now (${rawMessage || `HTTP ${status}`}). Please try again shortly.`
  };
}

export async function handleChatRequest({ message, history = [], context = {}, supabase = null }) {
  const cleanMessage = typeof message === 'string' ? message.trim().slice(0, 2000) : '';
  if (!cleanMessage) {
    return { ok: false, status: 400, error: 'Please enter a message.' };
  }

  const ai = createGeminiClient();
  if (!ai) {
    return {
      ok: false,
      status: 503,
      code: 'GEMINI_API_KEY_MISSING',
      error: 'Nortava AI is not configured yet. Please ensure GEMINI_API_KEY is set in Settings > Secrets.'
    };
  }

  const currentListingSummary = await fetchCurrentListingSummary(
    supabase,
    typeof context?.listingId === 'string' ? context.listingId.trim() : ''
  );

  const systemInstruction = [
    'You are Tariro, the intelligent, practical, and trustworthy AI Property Finder & Legal Guide for Nortava Real Estate across all 10 Provinces of Zimbabwe.',
    'Whenever a user asks to find a house, flat, cottage, stand, or commercial space—or asks about options matching conditions (area/suburb/city/province, price budget, bedrooms, bathrooms, water, electricity, furnished, parking)—ALWAYS call the search_properties tool first to inspect live published listings!',
    'Present matching real listings clearly with their title, location, USD price, matching amenities/conditions, and exact relative link (/listing.html?id=...). Also provide the filtered browse link (browseUrl, e.g. /listings.html?...) returned by search_properties so the user can view or adjust filters directly.',
    'If 0 live published listings match those exact criteria right now, say so honestly (never invent fake listings!), share the direct filtered browseUrl link, and mention typical market context or nearby areas using get_area_info.',
    'Never share landlord personal phone numbers or emails directly—explain that tenants unlock verified landlord contact details via the one-time $2.50 unlock flow on the listing page.',
    'When referring to platform pages, use exact relative paths like /listings.html, /listing.html?id=..., /safety.html, /report.html, /contact.html, /legal/terms.html, /legal/privacy.html, /legal/dmca.html, or /dashboard/landlord-add.html.',
    'Keep answers concise, scannable, and under 240 words unless a detailed legal/area breakdown is requested.',
    ZIMBABWE_LOCATION_GUIDE,
    ZIMBABWE_LEGAL_KNOWLEDGE,
    currentListingSummary
  ].filter(Boolean).join('\n\n');

  const safeHistory = Array.isArray(history)
    ? history
        .slice(-10)
        .filter(item => item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string' && item.text.trim())
        .map(item => ({
          role: item.role,
          parts: [{ text: item.text.trim().slice(0, 1500) }]
        }))
    : [];

  const contents = [
    ...safeHistory,
    { role: 'user', parts: [{ text: cleanMessage }] }
  ];

  const tools = [{ functionDeclarations: [searchPropertiesDeclaration, getAreaInfoDeclaration] }];
  let useThinkingConfig = true;

  const callModel = async (turnContents) => {
    const config = {
      systemInstruction,
      tools,
      ...(useThinkingConfig ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {})
    };
    try {
      return await generateWithRetry(ai, {
        model: CHAT_MODEL,
        contents: turnContents,
        config
      });
    } catch (err) {
      const status = Number(err?.status || err?.code || 0);
      const msg = String(err?.message || '').toLowerCase();
      if (useThinkingConfig && status === 400 && !msg.includes('api key')) {
        useThinkingConfig = false;
        return await generateWithRetry(ai, {
          model: CHAT_MODEL,
          contents: turnContents,
          config: { systemInstruction, tools }
        });
      }
      throw err;
    }
  };

  try {
    let response = await callModel(contents);

    // Execute up to 3 rounds of tool calls cleanly
    let rounds = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && rounds < 3) {
      rounds += 1;
      const modelContent = response.candidates?.[0]?.content;
      if (!modelContent) break;

      contents.push(modelContent);

      const responseParts = [];
      for (const call of response.functionCalls) {
        let toolOutput;
        if (call.name === 'search_properties') {
          toolOutput = await executeSearchProperties(supabase, call.args || {});
        } else if (call.name === 'get_area_info') {
          toolOutput = executeGetAreaInfo(call.args || {});
        } else {
          toolOutput = { error: `Unknown tool ${call.name}` };
        }
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            response: toolOutput
          }
        });
      }

      contents.push({ role: 'user', parts: responseParts });

      response = await callModel(contents);
    }

    const reply = (response.text || '').trim();
    if (!reply) {
      return {
        ok: false,
        status: 502,
        code: 'EMPTY_AI_RESPONSE',
        error: 'The AI assistant returned an empty response. Please try asking again.'
      };
    }

    return {
      ok: true,
      status: 200,
      reply,
      model: CHAT_MODEL
    };
  } catch (err) {
    return classifyGeminiError(err);
  }
}
