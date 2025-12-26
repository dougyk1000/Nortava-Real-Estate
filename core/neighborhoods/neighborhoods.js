// Neighborhood Intelligence Hub
// Shows nearby amenities, safety ratings, and transport info

export const neighborhoods = {
  'Katanga': {
    amenities: {
      hospitals: ['Norton Medical Centre (2.5km)', 'Chido Hospital (3.2km)'],
      schools: ['Katanga Primary (1.2km)', 'Norton High School (2.8km)'],
      markets: ['Katanga Shopping Centre (0.8km)', 'Main Market (2.1km)'],
      transport: ['Bus stop (400m)', 'Kombi rank (0.6km)'],
      water: ['Municipal tap (500m)', 'Borehole community (1.5km)']
    },
    safetyRating: 3.8,
    reviews: 24,
    costOfLiving: 'Medium',
    avgRent: 150
  },
  'Mabelreign': {
    amenities: {
      hospitals: ['Parirenyatwa Hospital (5.2km)', 'Private clinics (1.8km)'],
      schools: ['Mabelreign High (1.5km)', 'Primary schools (various)'],
      markets: ['Local shopping centres', 'Supermarkets (multiple)'],
      transport: ['Main bus routes (1.2km)', 'Kombi services'],
      water: ['Municipal water supply', 'Boreholes available']
    },
    safetyRating: 4.2,
    reviews: 42,
    costOfLiving: 'Medium-High',
    avgRent: 220
  },
  'Waterfalls': {
    amenities: {
      hospitals: ['Waterfalls Clinic (1.1km)', 'Emergency services nearby'],
      schools: ['Waterfalls Schools (various)', 'Universities nearby'],
      markets: ['Waterfalls Centre (0.9km)', 'Shopping malls'],
      transport: ['Main road (700m)', 'Public transport hub'],
      water: ['Good municipal supply', 'Reliable service']
    },
    safetyRating: 4.5,
    reviews: 68,
    costOfLiving: 'High',
    avgRent: 350
  },
  'Southerton': {
    amenities: {
      hospitals: ['Southerton Clinic (2.2km)', 'Private centres'],
      schools: ['Southerton Primary (1.8km)', 'Secondary schools'],
      markets: ['Local shops (1.2km)', 'Shopping complex'],
      transport: ['Bus stop (800m)', 'Kombi rank (1.1km)'],
      water: ['Municipal supply', 'Borehole option']
    },
    safetyRating: 3.9,
    reviews: 31,
    costOfLiving: 'Medium',
    avgRent: 180
  }
};

export function getNeighborhoodInfo(location) {
  const area = Object.keys(neighborhoods).find(key => location?.includes(key));
  return area ? neighborhoods[area] : null;
}

export function renderNeighborhoodWidget(location) {
  const info = getNeighborhoodInfo(location);
  if (!info) return '';

  return `
    <div class="neighborhood-widget card">
      <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="ri-map-pin-line"></i> Neighborhood Info
      </h3>
      
      <div class="safety-rating" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 500;">Safety Rating</span>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem; font-weight: 600;">${info.safetyRating}</span>
            <span style="color: var(--text-secondary);">(${info.reviews} reviews)</span>
          </div>
        </div>
        <div style="margin-top: 0.5rem; display: flex; gap: 0.25rem;">
          ${[...Array(5)].map((_, i) => `<i class="ri-star-${i < Math.floor(info.safetyRating) ? 'fill' : 'line'}" style="color: var(--warning);"></i>`).join('')}
        </div>
      </div>

      <div class="cost-info" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius);">
        <p style="margin-bottom: 0.5rem;"><strong>Cost of Living:</strong> ${info.costOfLiving}</p>
        <p><strong>Average Rent:</strong> $${info.avgRent}/month</p>
      </div>

      <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">Nearby Amenities</h4>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        ${Object.entries(info.amenities).map(([key, items]) => `
          <div>
            <p style="font-weight: 500; margin-bottom: 0.5rem; color: var(--primary); text-transform: capitalize;">${key}</p>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
              ${items.slice(0, 2).map(item => `<li style="padding: 0.25rem 0;">• ${item}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
