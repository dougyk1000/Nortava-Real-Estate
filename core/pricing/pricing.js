// Smart Price Recommendation Tool calibrated across Zimbabwe's 10 Provinces & Cities
import { escapeHtml } from '../utils/sanitize.js';
import { parseLocationString } from '../locations/zimbabweLocations.js';

const priceFactors = {
  area: {
    // Norton, Mashonaland West
    'Katanga': 1.0,
    'Ngoni': 1.0,
    'Maridale': 1.15,
    'Johannesburg': 1.15,
    'Marshlands': 1.2,
    'The Crescent': 1.35,
    'Twin Lakes': 1.45,
    'Galloway': 1.55,
    'Knowe': 1.65,
    // Harare & Metro
    'Borrowdale': 3.2,
    'Borrowdale Brooke': 3.8,
    'Helensvale': 3.0,
    'Glen Lorne': 2.9,
    'Chisipite': 2.8,
    'Highlands': 2.7,
    'Mount Pleasant': 2.6,
    'Avondale': 2.2,
    'Belgravia': 2.4,
    'Greendale': 2.0,
    'Marlborough': 1.9,
    'Mabelreign': 1.6,
    'Waterfalls': 1.35,
    'Hatfield': 1.45,
    'Tynwald': 1.4,
    'Kuwadzana': 1.1,
    'Budiriro': 1.05,
    'Glen View': 1.05,
    'Mbare': 1.0,
    'Highfield': 1.05,
    'Seke Unit': 1.0,
    'Zengeza': 1.0,
    'Nyatsime': 1.1,
    'Ruwa': 1.35,
    // Bulawayo
    'Hillside (Bulawayo)': 2.0,
    'Matsheumhlope': 2.2,
    'Burnside': 2.1,
    'Suburbs': 2.1,
    'Kumalo': 2.0,
    'Cowdray Park': 1.0,
    'Nkulumane': 1.05,
    // Victoria Falls & Major Cities
    'Victoria Falls': 2.2,
    'Murambi': 1.75,
    'Dangamvura': 1.05,
    'Chikanga': 1.15,
    'Mkoba': 1.05,
    'Southdowns': 1.65,
    'Rhodene': 1.6,
    'Mucheke': 1.0
  },
  cityDefault: {
    'Harare': 1.55,
    'Chitungwiza': 1.05,
    'Ruwa': 1.35,
    'Epworth': 0.9,
    'Bulawayo': 1.35,
    'Victoria Falls': 1.75,
    'Norton': 1.15,
    'Mutare': 1.25,
    'Gweru': 1.2,
    'Masvingo': 1.2,
    'Kwekwe': 1.15,
    'Chinhoyi': 1.15,
    'Kadoma': 1.1,
    'Marondera': 1.2,
    'Bindura': 1.1,
    'Kariba': 1.35,
    'Beitbridge': 1.25,
    'Zvishavane': 1.15,
    'Chiredzi': 1.15
  },
  zoneMultiplier: {
    'Northern & North-Eastern Low Density': 2.5,
    'CBD & Inner Suburbs': 1.85,
    'Low Density & Waterfront': 1.55,
    'Eastern & Southern Low Density': 1.8,
    'CBD & Low Density': 1.65,
    'CBD & Low/Medium Density': 1.5,
    'Low & Medium Density': 1.4,
    'North-Western & Medium Density': 1.5,
    'Medium Density & Town': 1.3,
    'High Density': 1.0,
    'High Density & Estates': 1.0,
    'High Density & Extensions': 1.0,
    'Western High Density & Developing': 1.0,
    'Western & High-Density Suburbs': 1.0
  },
  amenities: {
    furnished: 1.25,
    water: 1.12,
    electricity: 1.15,
    parking: 1.1
  },
  size: {
    small: 0.85,    // < 500 sqft
    medium: 1.0,    // 500-1000 sqft
    large: 1.3,     // 1000-2000 sqft
    xlarge: 1.65    // > 2000 sqft
  },
  rooms: {
    1: 95,
    2: 150,
    3: 220,
    4: 300,
    5: 380
  }
};

export function calculateRecommendedPrice(listingData) {
  const {
    location = '',
    rooms = 1,
    size = 650,
    furnished = false,
    water = false,
    electricity = false,
    parking = false,
    type = 'rent'
  } = listingData;

  const numericRooms = Math.min(5, Math.max(1, Number(rooms) || 1));
  const numericSize = Number(size) || 650;
  let basePrice = priceFactors.rooms[numericRooms] || 150;

  const parsed = parseLocationString(location);
  const lowerLoc = String(location).toLowerCase();

  const areaKey = Object.keys(priceFactors.area).find(
    key => key.toLowerCase() === (parsed.area || '').toLowerCase() || lowerLoc.includes(key.toLowerCase())
  );

  let locationMultiplier = 1.0;
  if (areaKey) {
    locationMultiplier = priceFactors.area[areaKey];
  } else if (parsed.zone && priceFactors.zoneMultiplier[parsed.zone]) {
    const cityBase = priceFactors.cityDefault[parsed.city] || 1.05;
    locationMultiplier = (priceFactors.zoneMultiplier[parsed.zone] + cityBase) / 2;
  } else if (parsed.city && priceFactors.cityDefault[parsed.city]) {
    locationMultiplier = priceFactors.cityDefault[parsed.city];
  }

  basePrice *= locationMultiplier;

  const sizeCategory = numericSize < 500 ? 'small' : numericSize < 1000 ? 'medium' : numericSize < 2000 ? 'large' : 'xlarge';
  basePrice *= priceFactors.size[sizeCategory];

  let amenitiesMultiplier = 1;
  if (furnished) amenitiesMultiplier *= priceFactors.amenities.furnished;
  if (water) amenitiesMultiplier *= priceFactors.amenities.water;
  if (electricity) amenitiesMultiplier *= priceFactors.amenities.electricity;
  if (parking) amenitiesMultiplier *= priceFactors.amenities.parking;

  basePrice *= amenitiesMultiplier;

  const marketLabel = parsed.city
    ? `Active ${parsed.city} Market`
    : 'Steady Zimbabwe Market';

  if (type === 'sale') {
    basePrice = Math.round((basePrice * 180) / 500) * 500;
    return {
      recommended: basePrice,
      low: Math.round((basePrice * 0.88) / 500) * 500,
      high: Math.round((basePrice * 1.12) / 500) * 500,
      marketTrend: marketLabel
    };
  }

  basePrice = Math.round(basePrice / 5) * 5;

  return {
    recommended: basePrice,
    low: Math.round((basePrice * 0.85) / 5) * 5,
    high: Math.round((basePrice * 1.15) / 5) * 5,
    marketTrend: marketLabel
  };
}

export function renderPriceRecommendationWidget(listingData) {
  const pricing = calculateRecommendedPrice(listingData);
  const unitLabel = listingData?.type === 'sale' ? 'estimated sale value' : 'per month';
  const parsed = parseLocationString(listingData?.location || '');
  const areaTitle = parsed.area || parsed.city || 'Zimbabwe';

  return `
    <div class="price-recommendation card" style="margin-top: 1.5rem;">
      <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="ri-trending-up-line"></i> ${escapeHtml(areaTitle)} Price Recommendation
      </h3>

      <div style="padding: 1.25rem; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); border-radius: var(--radius); color: white; margin-bottom: 1rem;">
        <p style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.35rem;">Suggested Fair Price (USD)</p>
        <p style="font-size: 2rem; font-weight: 700; margin: 0;">$${escapeHtml(pricing.recommended.toLocaleString())}</p>
        <p style="font-size: 0.85rem; opacity: 0.85; margin: 0.25rem 0 0 0;">${escapeHtml(unitLabel)} &bull; ${escapeHtml(pricing.marketTrend)}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div style="padding: 0.85rem; background: var(--bg-tertiary); border-radius: var(--radius);">
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Lower Range</p>
          <p style="font-size: 1.25rem; font-weight: 600; margin: 0;">$${escapeHtml(pricing.low.toLocaleString())}</p>
        </div>
        <div style="padding: 0.85rem; background: var(--bg-tertiary); border-radius: var(--radius);">
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Upper Range</p>
          <p style="font-size: 1.25rem; font-weight: 600; margin: 0;">$${escapeHtml(pricing.high.toLocaleString())}</p>
        </div>
      </div>
    </div>
  `;
}

export function showPriceComparison(price, recommendedPrice) {
  const difference = price - recommendedPrice;
  const percentDifference = ((difference / recommendedPrice) * 100).toFixed(1);

  let status = '';
  let advice = '';

  if (difference > 20) {
    status = 'High';
    advice = 'Your price is above typical local rates for this suburb. Consider lowering to attract faster inquiries.';
  } else if (difference > 0) {
    status = 'Slightly High';
    advice = 'Slightly above area average.';
  } else if (difference < -20) {
    status = 'Low';
    advice = 'Below market value; likely to attract strong demand quickly.';
  } else if (difference < 0) {
    status = 'Slightly Low';
    advice = 'Competitive rate for quick tenant placement.';
  } else {
    status = 'Market Rate';
    advice = 'Matches typical rates for this area.';
  }

  return { status, advice, difference: percentDifference };
}
