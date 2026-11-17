// Neighborhood Intelligence Hub for Zimbabwe (detailed Norton profiles + nationwide Zimbabwe regional hierarchy)
import { escapeHtml } from '../utils/sanitize.js';
import { parseLocationString } from '../locations/zimbabweLocations.js';

export const neighborhoods = {
  'Katanga': {
    amenities: {
      clinics: ['Katanga Polyclinic (1.2km)', 'Norton District Hospital (2.8km)'],
      schools: ['Katanga Primary School', 'Vimbai Primary & Secondary'],
      markets: ['Katanga Shopping Centre', 'Katanga Main Market'],
      transport: ['Katanga Kombi Rank', 'Bulawayo Rd / Harare Corridor']
    },
    safetyRating: 3.9,
    reviews: 28,
    costOfLiving: 'Affordable',
    avgRent: 140
  },
  'Knowe': {
    amenities: {
      clinics: ['Norton Medical Centre (2.4km)', 'Norton District Hospital (3.5km)'],
      schools: ['Knowe Primary', 'Dudley Hall Primary (nearby)'],
      markets: ['Norton Town Shopping Centre', 'Local Supermarkets'],
      transport: ['Bulawayo Highway Access', 'Local Commuter Routes']
    },
    safetyRating: 4.5,
    reviews: 34,
    costOfLiving: 'Medium-High',
    avgRent: 320
  },
  'Twin Lakes': {
    amenities: {
      clinics: ['Norton Medical Centre (3.0km)', 'Private GP Clinics'],
      schools: ['Dudley Hall Primary', 'Norton Secondary Options'],
      markets: ['Twin Lakes Tuckshops & Centres', 'Town Centre (3.5km)'],
      transport: ['Twin Lakes Access Road', 'Harare–Bulawayo Corridor']
    },
    safetyRating: 4.3,
    reviews: 22,
    costOfLiving: 'Medium',
    avgRent: 240
  },
  'Galloway': {
    amenities: {
      clinics: ['Norton District Hospital (4.0km)', 'Private Medical Centres'],
      schools: ['Dudley Hall Primary', 'Local High Schools'],
      markets: ['Galloway Shopping Point', 'Norton Town Centre'],
      transport: ['Private & Commuter Access', 'Bulawayo Rd Junction']
    },
    safetyRating: 4.4,
    reviews: 19,
    costOfLiving: 'Medium-High',
    avgRent: 280
  },
  'Maridale': {
    amenities: {
      clinics: ['Norton Town Clinics (2.5km)'],
      schools: ['Vimbai High School', 'Local Primary Schools'],
      markets: ['Maridale Local Shops', 'Katanga Market (nearby)'],
      transport: ['Kombi & Bus Routes']
    },
    safetyRating: 4.0,
    reviews: 16,
    costOfLiving: 'Affordable - Medium',
    avgRent: 170
  },
  'The Crescent': {
    amenities: {
      clinics: ['Norton District Hospital (2.0km)'],
      schools: ['Norton Development Council Primary', 'Local Secondary Schools'],
      markets: ['Norton Town Centre Shops'],
      transport: ['Main Highway Access']
    },
    safetyRating: 4.2,
    reviews: 21,
    costOfLiving: 'Medium',
    avgRent: 200
  }
};

export function getNeighborhoodInfo(location) {
  if (!location || typeof location !== 'string') return null;
  const lower = location.toLowerCase();
  const parsed = parseLocationString(location);
  const area = Object.keys(neighborhoods).find(
    key => key.toLowerCase() === (parsed.area || '').toLowerCase() || lower.includes(key.toLowerCase())
  );

  if (area) {
    return {
      name: area,
      province: parsed.province || 'Mashonaland West',
      city: parsed.city || 'Norton',
      zone: parsed.zone || '',
      ...neighborhoods[area]
    };
  }

  if (parsed.province || parsed.city) {
    return {
      name: parsed.area || parsed.city || parsed.province,
      province: parsed.province,
      city: parsed.city,
      zone: parsed.zone,
      isHierarchyOnly: true
    };
  }

  return null;
}

export function renderNeighborhoodWidget(location) {
  const info = getNeighborhoodInfo(location);
  if (!info) return '';

  const hierarchyBreadcrumb = [info.province, info.city, info.zone, info.name]
    .filter((v, idx, arr) => v && arr.indexOf(v) === idx)
    .join(' › ');

  if (info.isHierarchyOnly) {
    return `
      <div class="neighborhood-widget card" style="margin-top: 2rem;">
        <h3 style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="ri-map-pin-line"></i> ${escapeHtml(info.name)} Area Category
        </h3>
        <p style="color: var(--text-secondary); margin: 0 0 1rem 0;">
          <strong>Region Hierarchy:</strong> ${escapeHtml(hierarchyBreadcrumb)}
        </p>
        <a href="/listings.html?province=${encodeURIComponent(info.province || '')}&city=${encodeURIComponent(info.city || '')}" class="btn btn-sm btn-secondary">
          <i class="ri-search-line"></i> Browse More in ${escapeHtml(info.city || info.province)}
        </a>
      </div>
    `;
  }

  return `
    <div class="neighborhood-widget card" style="margin-top: 2rem;">
      <h3 style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="ri-map-pin-line"></i> ${escapeHtml(info.name)} Neighborhood Guide
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-tertiary); margin: 0 0 1rem 0;">
        ${escapeHtml(hierarchyBreadcrumb)}
      </p>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
        <div style="padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
          <div style="font-size: 0.85rem; color: var(--text-secondary);">Community Rating</div>
          <div style="font-size: 1.25rem; font-weight: 600; margin-top: 0.25rem;">
            ${escapeHtml(info.safetyRating)} / 5.0 <span style="font-size: 0.85rem; font-weight: 400; color: var(--text-secondary);">(${escapeHtml(info.reviews)})</span>
          </div>
        </div>
        <div style="padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
          <div style="font-size: 0.85rem; color: var(--text-secondary);">Typical Suburb Rent</div>
          <div style="font-size: 1.25rem; font-weight: 600; margin-top: 0.25rem;">~$${escapeHtml(info.avgRent)}/mo</div>
        </div>
        <div style="padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius);">
          <div style="font-size: 0.85rem; color: var(--text-secondary);">Cost of Living</div>
          <div style="font-size: 1.25rem; font-weight: 600; margin-top: 0.25rem;">${escapeHtml(info.costOfLiving)}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        ${Object.entries(info.amenities).map(([key, items]) => `
          <div>
            <p style="font-weight: 600; margin-bottom: 0.35rem; color: var(--primary); text-transform: capitalize;">${escapeHtml(key)}</p>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
              ${items.slice(0, 2).map(item => `<li style="padding: 0.15rem 0;">• ${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
