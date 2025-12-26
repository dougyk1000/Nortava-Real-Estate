// Smart Price Recommendation Tool
// Suggests optimal rental prices based on location, amenities, and market trends

const priceFactors = {
  location: {
    'Katanga': 1.0,
    'Mabelreign': 1.3,
    'Waterfalls': 1.8,
    'Southerton': 1.1,
    'default': 1.0
  },
  amenities: {
    furnished: 1.25,
    water: 1.15,
    electricity: 1.20,
    parking: 1.30
  },
  size: {
    'small': 0.8,    // < 500 sqft
    'medium': 1.0,   // 500-1000 sqft
    'large': 1.4,    // 1000-2000 sqft
    'xlarge': 1.8    // > 2000 sqft
  },
  rooms: {
    1: 100,
    2: 150,
    3: 200,
    4: 280,
    5: 350
  }
};

export function calculateRecommendedPrice(listingData) {
  const {
    location = '',
    rooms = 1,
    size = 600,
    furnished = false,
    water = false,
    electricity = false,
    parking = false,
    type = 'rent'
  } = listingData;

  // Base price from rooms
  let basePrice = priceFactors.rooms[rooms] || 150;

  // Location multiplier
  const area = Object.keys(priceFactors.location).find(key => location.includes(key));
  const locationMultiplier = priceFactors.location[area] || priceFactors.location.default;
  basePrice *= locationMultiplier;

  // Size factor
  const sizeCategory = size < 500 ? 'small' : size < 1000 ? 'medium' : size < 2000 ? 'large' : 'xlarge';
  basePrice *= priceFactors.size[sizeCategory];

  // Amenities boost
  let amenitiesMultiplier = 1;
  if (furnished) amenitiesMultiplier *= priceFactors.amenities.furnished;
  if (water) amenitiesMultiplier *= priceFactors.amenities.water;
  if (electricity) amenitiesMultiplier *= priceFactors.amenities.electricity;
  if (parking) amenitiesMultiplier *= priceFactors.amenities.parking;

  basePrice *= amenitiesMultiplier;

  // Round to nearest 5
  basePrice = Math.round(basePrice / 5) * 5;

  return {
    recommended: basePrice,
    low: Math.round(basePrice * 0.85 / 5) * 5,
    high: Math.round(basePrice * 1.15 / 5) * 5,
    marketTrend: 'Stable'
  };
}

export function renderPriceRecommendationWidget(listingData) {
  const pricing = calculateRecommendedPrice(listingData);

  return `
    <div class="price-recommendation card">
      <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="ri-trending-up-line"></i> Price Recommendation
      </h3>
      
      <div style="padding: 1.5rem; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); border-radius: var(--radius); color: white; margin-bottom: 1.5rem;">
        <p style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">Recommended Price</p>
        <p style="font-size: 2.5rem; font-weight: 700; margin: 0;">$${pricing.recommended}</p>
        <p style="font-size: 0.85rem; opacity: 0.8; margin: 0.5rem 0 0 0;">per month</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius);">
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Lower Range</p>
          <p style="font-size: 1.5rem; font-weight: 600;">$${pricing.low}</p>
        </div>
        <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius);">
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Upper Range</p>
          <p style="font-size: 1.5rem; font-weight: 600;">$${pricing.high}</p>
        </div>
      </div>

      <div style="padding: 1rem; background: var(--success-light); border-left: 3px solid var(--success); border-radius: var(--radius);">
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-primary);">
          <i class="ri-information-line"></i> Market trend: <strong>${pricing.marketTrend}</strong>
        </p>
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
    advice = 'Your price is significantly above market. Consider lowering to attract more tenants.';
  } else if (difference > 0) {
    status = 'Slightly High';
    advice = 'Your price is slightly above market average. May reduce inquiries.';
  } else if (difference < -20) {
    status = 'Low';
    advice = 'Your price is below market value. You could increase it to improve earnings.';
  } else if (difference < 0) {
    status = 'Slightly Low';
    advice = 'Your price is slightly below market. Good for quick tenant acquisition.';
  } else {
    status = 'Market Rate';
    advice = 'Your price matches the market perfectly.';
  }

  return { status, advice, difference: percentDifference };
}
