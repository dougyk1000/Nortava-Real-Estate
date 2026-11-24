import {
  getAllListings,
  getSavedListings,
  saveListing,
  unsaveListing,
  subscribeToListings,
  unsubscribe,
  saveSearch,
  getCurrentUser
} from '../api/api.js';
import { showToast } from '../utils/toast.js';
import { escapeHtml, safeImageUrl } from '../utils/sanitize.js';
import {
  ZIMBABWE_LOCATIONS,
  getProvinces,
  getCitiesByProvince,
  getZonesByCity,
  getAreas,
  getLocationStats,
  parseLocationString
} from '../locations/zimbabweLocations.js';

let listingsSubscription = null;
let savedListingIds = new Set();

document.addEventListener('DOMContentLoaded', () => {
  initLocationHierarchy();
  applyUrlFilters();
  renderBreadcrumbBar();
  updateFilterToolbarSummaries();
  renderDirectoryPanel();
  loadListings(getCurrentFilters());
  setupDropdownPopovers();
  setupFilters();
  setupDirectoryPanel();
  setupRealtimeUpdates();
  setupSaveSearch();
  setupClearFilters();
});

function initLocationHierarchy() {
  const provinceEl = document.getElementById('filterProvince');
  if (!provinceEl) return;

  const provinces = getProvinces();
  provinceEl.innerHTML = `<option value="">All Provinces (${provinces.length})</option>` +
    provinces.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

  populateCities();
  populateZones();
  populateAreas();
}

function populateCities(selectedProvince = '') {
  const cityEl = document.getElementById('filterCity');
  if (!cityEl) return;

  const currentVal = cityEl.value;
  if (!selectedProvince) {
    // Group all cities/towns cleanly by province
    cityEl.innerHTML = `<option value="">All Cities / Towns</option>` +
      ZIMBABWE_LOCATIONS.map(p => `
        <optgroup label="${escapeHtml(p.province)}">
          ${p.cities.map(c => `<option value="${escapeHtml(c.city)}" data-province="${escapeHtml(p.province)}">${escapeHtml(c.city)}</option>`).join('')}
        </optgroup>
      `).join('');
  } else {
    const cities = getCitiesByProvince(selectedProvince);
    cityEl.innerHTML = `<option value="">All Cities / Towns in ${escapeHtml(selectedProvince)}</option>` +
      cities.map(c => `<option value="${escapeHtml(c.city)}">${escapeHtml(c.city)}</option>`).join('');
  }

  if (currentVal && Array.from(cityEl.options).some(o => o.value === currentVal)) {
    cityEl.value = currentVal;
  } else {
    cityEl.value = '';
  }
}

function populateZones(selectedCity = '', selectedProvince = '') {
  const zoneEl = document.getElementById('filterZone');
  if (!zoneEl) return;

  const currentVal = zoneEl.value;
  if (!selectedCity) {
    zoneEl.innerHTML = '<option value="">All Zones / Categories</option>';
    zoneEl.disabled = true;
    return;
  }

  const zones = getZonesByCity(selectedCity, selectedProvince);
  zoneEl.disabled = zones.length === 0;
  zoneEl.innerHTML = `<option value="">All Zones in ${escapeHtml(selectedCity)}</option>` +
    zones.map(z => `<option value="${escapeHtml(z.zone)}">${escapeHtml(z.zone)} (${z.areas.length})</option>`).join('');

  if (currentVal && zones.some(z => z.zone === currentVal)) {
    zoneEl.value = currentVal;
  } else {
    zoneEl.value = '';
  }
}

function populateAreas({ province = '', city = '', zone = '' } = {}) {
  const areaEl = document.getElementById('filterArea');
  if (!areaEl) return;

  const currentVal = areaEl.value;

  if (!city && !province) {
    const stats = getLocationStats();
    areaEl.innerHTML = `<option value="">All Locations (${stats.areas} areas)</option>` +
      ZIMBABWE_LOCATIONS.map(p =>
        p.cities.map(c => `
          <optgroup label="${escapeHtml(c.city)} (${escapeHtml(p.province)})">
            ${c.zones.flatMap(z => z.areas).map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}
          </optgroup>
        `).join('')
      ).join('');
  } else if (city && !zone) {
    const zones = getZonesByCity(city, province);
    areaEl.innerHTML = `<option value="">All Locations in ${escapeHtml(city)}</option>` +
      zones.map(z => `
        <optgroup label="${escapeHtml(z.zone)}">
          ${z.areas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}
        </optgroup>
      `).join('');
  } else {
    const areas = getAreas({ province, city, zone });
    if (zone) {
      areaEl.innerHTML = `<option value="">All in ${escapeHtml(zone)}</option>` +
        areas.map(item => `<option value="${escapeHtml(item.area)}">${escapeHtml(item.area)}</option>`).join('');
    } else {
      const cities = getCitiesByProvince(province);
      areaEl.innerHTML = `<option value="">All Locations in ${escapeHtml(province)}</option>` +
        cities.map(c => {
          const cityAreas = getAreas({ province, city: c.city });
          return `
            <optgroup label="${escapeHtml(c.city)}">
              ${cityAreas.map(item => `<option value="${escapeHtml(item.area)}">${escapeHtml(item.area)}</option>`).join('')}
            </optgroup>
          `;
        }).join('');
    }
  }

  if (currentVal && Array.from(areaEl.options).some(o => o.value === currentVal)) {
    areaEl.value = currentVal;
  } else {
    areaEl.value = '';
  }
}

function setLocationHierarchy({ province = '', city = '', zone = '', area = '' }) {
  const provinceEl = document.getElementById('filterProvince');
  const cityEl = document.getElementById('filterCity');
  const zoneEl = document.getElementById('filterZone');
  const areaEl = document.getElementById('filterArea');

  if (provinceEl) provinceEl.value = province;
  populateCities(province);
  if (cityEl) cityEl.value = city;
  populateZones(city, province);
  if (zoneEl) zoneEl.value = zone;
  populateAreas({ province, city, zone });
  if (areaEl) areaEl.value = area;

  renderBreadcrumbBar();
  renderDirectoryPanel();
  updateFilterToolbarSummaries();
}

function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  let province = params.get('province') || '';
  let city = params.get('city') || '';
  let zone = params.get('zone') || '';
  let area = params.get('area') || '';
  const location = params.get('location') || '';
  const type = params.get('type');
  const maxPrice = params.get('max_price');
  const rooms = params.get('rooms');

  if (!province && !city && !area && location) {
    const parsed = parseLocationString(location);
    if (parsed.province || parsed.city || parsed.area) {
      province = parsed.province;
      city = parsed.city;
      zone = parsed.zone;
      area = parsed.area;
    } else if (document.getElementById('filterLocation')) {
      document.getElementById('filterLocation').value = location;
    }
  } else if (location && document.getElementById('filterLocation')) {
    document.getElementById('filterLocation').value = location;
  }

  if (province || city || zone || area) {
    setLocationHierarchy({ province, city, zone, area });
  }

  if (type && document.getElementById('filterType')) document.getElementById('filterType').value = type;
  if (maxPrice && document.getElementById('filterMaxPrice')) document.getElementById('filterMaxPrice').value = maxPrice;
  if (rooms && document.getElementById('filterRooms')) document.getElementById('filterRooms').value = rooms;
  updateFilterToolbarSummaries();
}

function renderBreadcrumbBar() {
  const bar = document.getElementById('locationBreadcrumbBar');
  if (!bar) return;

  const province = document.getElementById('filterProvince')?.value || '';
  const city = document.getElementById('filterCity')?.value || '';
  const zone = document.getElementById('filterZone')?.value || '';
  const area = document.getElementById('filterArea')?.value || '';

  if (!province && !city && !zone && !area) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }

  bar.style.display = 'flex';
  const crumbs = [
    { label: 'Zimbabwe (All)', level: 'root' }
  ];
  if (province) crumbs.push({ label: province, level: 'province' });
  if (city) crumbs.push({ label: city, level: 'city' });
  if (zone) crumbs.push({ label: zone, level: 'zone' });
  if (area) crumbs.push({ label: area, level: 'area' });

  bar.innerHTML = `<span style="font-weight: 600; color: var(--text-primary);"><i class="ri-map-pin-range-line" style="color: var(--primary);"></i> Area:</span> ` +
    crumbs.map((c, idx) => {
      const isLast = idx === crumbs.length - 1;
      const sep = idx > 0 ? '<i class="ri-arrow-right-s-line" style="color: var(--text-tertiary);"></i>' : '';
      return `${sep}<button type="button" class="btn btn-sm ${isLast ? 'btn-primary' : 'btn-ghost'}" data-crumb-level="${c.level}" style="padding: 0.2rem 0.55rem; font-size: 0.8rem;">${escapeHtml(c.label)}</button>`;
    }).join(' ');

  bar.querySelectorAll('[data-crumb-level]').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.dataset.crumbLevel;
      if (level === 'root') setLocationHierarchy({});
      else if (level === 'province') setLocationHierarchy({ province });
      else if (level === 'city') setLocationHierarchy({ province, city });
      else if (level === 'zone') setLocationHierarchy({ province, city, zone });
      loadListings(getCurrentFilters());
    });
  });
}

function closeAllDropdownPopovers() {
  document.querySelectorAll('.filter-popover.open').forEach(pop => pop.classList.remove('open'));
  document.querySelectorAll('.filter-dropdown-trigger[aria-expanded="true"]').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

function updateFilterToolbarSummaries() {
  const province = document.getElementById('filterProvince')?.value || '';
  const city = document.getElementById('filterCity')?.value || '';
  const zone = document.getElementById('filterZone')?.value || '';
  const area = document.getElementById('filterArea')?.value || '';
  const keyword = document.getElementById('filterLocation')?.value?.trim() || '';
  const type = document.getElementById('filterType')?.value || '';
  const minPrice = document.getElementById('filterMinPrice')?.value || '';
  const maxPrice = document.getElementById('filterMaxPrice')?.value || '';
  const rooms = document.getElementById('filterRooms')?.value || '';
  const bathrooms = document.getElementById('filterBathrooms')?.value || '';
  const amenityIds = ['filterFurnished', 'filterWater', 'filterElectricity', 'filterParking'];
  const activeAmenities = amenityIds.filter(id => document.getElementById(id)?.checked).length;

  const locLabelEl = document.getElementById('dropdownLocationLabel');
  const locBtn = document.getElementById('dropdownLocationBtn');
  const locParts = [area || zone, city || province].filter(Boolean);
  if (locLabelEl) {
    locLabelEl.textContent = locParts.length ? locParts.join(', ') : 'Location';
  }
  locBtn?.classList.toggle('active', Boolean(province || city || zone || area));

  const priceLabelEl = document.getElementById('dropdownPriceLabel');
  const priceBtn = document.getElementById('dropdownPriceBtn');
  const typeText = type === 'rent' ? 'Rent' : (type === 'sale' ? 'Buy' : '');
  let budgetText = '';
  if (minPrice && maxPrice) budgetText = `$${minPrice}–$${maxPrice}`;
  else if (maxPrice) budgetText = `≤ $${maxPrice}`;
  else if (minPrice) budgetText = `≥ $${minPrice}`;
  const priceSummary = [typeText, budgetText].filter(Boolean).join(' · ');
  if (priceLabelEl) {
    priceLabelEl.textContent = priceSummary || 'Type & Price';
  }
  priceBtn?.classList.toggle('active', Boolean(type || minPrice || maxPrice));

  document.querySelectorAll('.price-preset-btn').forEach(btn => {
    btn.classList.toggle('active', Boolean(maxPrice) && btn.dataset.maxPrice === String(maxPrice) && !minPrice);
  });

  const featureCount = (rooms ? 1 : 0) + (bathrooms ? 1 : 0) + activeAmenities;
  const badgeEl = document.getElementById('filterCountBadge');
  const featuresBtn = document.getElementById('dropdownFiltersBtn');
  if (badgeEl) {
    badgeEl.textContent = String(featureCount);
    badgeEl.style.display = featureCount > 0 ? 'inline-flex' : 'none';
  }
  featuresBtn?.classList.toggle('active', featureCount > 0);

  const hasAnyFilter = Boolean(
    province || city || zone || area || keyword || type || minPrice || maxPrice || featureCount > 0
  );
  const clearBtn = document.getElementById('clearFiltersBtn');
  if (clearBtn) {
    clearBtn.style.display = hasAnyFilter ? 'inline-flex' : 'none';
  }
}

function setupDropdownPopovers() {
  const wraps = document.querySelectorAll('.filter-dropdown-wrap');
  wraps.forEach(wrap => {
    const trigger = wrap.querySelector('.filter-dropdown-trigger');
    const popover = wrap.querySelector('.filter-popover');
    if (!trigger || !popover) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !popover.classList.contains('open');
      closeAllDropdownPopovers();
      if (willOpen) {
        popover.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    popover.addEventListener('click', (e) => e.stopPropagation());
    popover.querySelectorAll('.filter-popover-close, .filter-popover-done').forEach(btn => {
      btn.addEventListener('click', () => closeAllDropdownPopovers());
    });
  });

  document.querySelectorAll('[data-reset-popover]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.resetPopover;
      if (target === 'location') {
        setLocationHierarchy({});
      } else if (target === 'price') {
        ['filterType', 'filterMinPrice', 'filterMaxPrice'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
      } else if (target === 'features') {
        ['filterRooms', 'filterBathrooms'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        ['filterFurnished', 'filterWater', 'filterElectricity', 'filterParking'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.checked = false;
        });
      }
      updateFilterToolbarSummaries();
      loadListings(getCurrentFilters());
    });
  });

  document.querySelectorAll('.price-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const maxEl = document.getElementById('filterMaxPrice');
      const minEl = document.getElementById('filterMinPrice');
      if (minEl) minEl.value = '';
      if (maxEl) maxEl.value = btn.dataset.maxPrice || '';
      updateFilterToolbarSummaries();
      loadListings(getCurrentFilters());
    });
  });

  document.addEventListener('click', () => closeAllDropdownPopovers());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDropdownPopovers();
  });
}

function setupDirectoryPanel() {
  const toggleBtn = document.getElementById('toggleDirectoryBtn');
  const panel = document.getElementById('locationDirectoryPanel');
  const quickSearch = document.getElementById('directoryQuickSearch');

  toggleBtn?.addEventListener('click', () => {
    if (!panel) return;
    const isHidden = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = isHidden ? 'block' : 'none';
    toggleBtn.setAttribute('aria-expanded', String(isHidden));
    if (isHidden) renderDirectoryPanel();
  });

  quickSearch?.addEventListener('input', () => {
    renderDirectoryPanel(quickSearch.value.trim());
  });
}

function renderDirectoryPanel(searchQuery = '') {
  const grid = document.getElementById('directoryGrid');
  const subtitle = document.getElementById('directorySubtitle');
  if (!grid) return;

  const q = searchQuery.toLowerCase();
  if (q) {
    const matches = getAreas().filter(item =>
      item.area.toLowerCase().includes(q) ||
      item.city.toLowerCase().includes(q) ||
      item.province.toLowerCase().includes(q) ||
      item.zone.toLowerCase().includes(q)
    ).slice(0, 36);

    if (subtitle) {
      subtitle.textContent = `Showing ${matches.length} matching Zimbabwe locations for "${searchQuery}"`;
    }

    if (matches.length === 0) {
      grid.innerHTML = `<p style="color: var(--text-tertiary); margin: 0;">No areas matched "${escapeHtml(searchQuery)}". Try a province, city, town, or suburb name.</p>`;
      return;
    }

    grid.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem;">
        ${matches.map(m => `
          <button type="button" class="card" data-jump-prov="${escapeHtml(m.province)}" data-jump-city="${escapeHtml(m.city)}" data-jump-zone="${escapeHtml(m.zone)}" data-jump-area="${escapeHtml(m.area)}" style="text-align: left; padding: 0.85rem; cursor: pointer;">
            <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(m.area)}</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem;">${escapeHtml(m.city)} &bull; ${escapeHtml(m.zone)}</div>
            <div style="font-size: 0.75rem; color: var(--primary); margin-top: 0.15rem;">${escapeHtml(m.province)}</div>
          </button>
        `).join('')}
      </div>
    `;
    bindDirectoryJumpButtons(grid);
    return;
  }

  const province = document.getElementById('filterProvince')?.value || '';
  const city = document.getElementById('filterCity')?.value || '';
  const zone = document.getElementById('filterZone')?.value || '';

  if (!province) {
    const stats = getLocationStats();
    if (subtitle) {
      subtitle.textContent = `All ${stats.provinces} Zimbabwe Provinces • ${stats.cities} Cities/Towns/Districts • ${stats.areas} Suburbs & Centres`;
    }
    grid.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem;">
        ${ZIMBABWE_LOCATIONS.map(p => {
          const areaTotal = p.cities.reduce((sum, c) => sum + c.zones.reduce((s, z) => s + z.areas.length, 0), 0);
          return `
            <button type="button" class="card" data-pick-prov="${escapeHtml(p.province)}" style="text-align: left; padding: 1rem; cursor: pointer;">
              <div style="font-weight: 700; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center;">
                <span>${escapeHtml(p.province)}</span>
                <i class="ri-arrow-right-s-line" style="color: var(--primary);"></i>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem;">
                ${p.cities.length} cities/districts &bull; ${areaTotal} areas
              </div>
              <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(p.cities.slice(0, 3).map(c => c.city).join(', '))}${p.cities.length > 3 ? '...' : ''}
              </div>
            </button>
          `;
        }).join('')}
      </div>
    `;
    grid.querySelectorAll('[data-pick-prov]').forEach(btn => {
      btn.addEventListener('click', () => {
        setLocationHierarchy({ province: btn.dataset.pickProv });
        loadListings(getCurrentFilters());
      });
    });
    return;
  }

  if (province && !city) {
    const provObj = ZIMBABWE_LOCATIONS.find(p => p.province === province);
    if (!provObj) return;
    if (subtitle) subtitle.textContent = `${province} — Select a City, Town, or District`;
    grid.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 0.75rem;">
        ${provObj.cities.map(c => {
          const total = c.zones.reduce((s, z) => s + z.areas.length, 0);
          const preview = c.zones.flatMap(z => z.areas).slice(0, 3).join(', ');
          return `
            <button type="button" class="card" data-pick-city="${escapeHtml(c.city)}" style="text-align: left; padding: 1rem; cursor: pointer;">
              <div style="font-weight: 700; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center;">
                <span>${escapeHtml(c.city)}</span>
                <i class="ri-arrow-right-s-line" style="color: var(--primary);"></i>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem;">${c.zones.length} zone(s) &bull; ${total} locations</div>
              <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(preview)}</div>
            </button>
          `;
        }).join('')}
      </div>
    `;
    grid.querySelectorAll('[data-pick-city]').forEach(btn => {
      btn.addEventListener('click', () => {
        setLocationHierarchy({ province, city: btn.dataset.pickCity });
        loadListings(getCurrentFilters());
      });
    });
    return;
  }

  // City selected -> show Zones & actual Areas inside each Zone
  const zones = getZonesByCity(city, province).filter(z => !zone || z.zone === zone);
  if (subtitle) subtitle.textContent = `${province} > ${city} — Select a Zone or specific Location`;
  grid.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
      ${zones.map(z => `
        <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <button type="button" class="btn btn-ghost btn-sm" data-pick-zone="${escapeHtml(z.zone)}" style="padding: 0; font-weight: 700; color: var(--primary);">
              ${escapeHtml(z.zone)}
            </button>
            <span style="font-size: 0.75rem; color: var(--text-tertiary);">${z.areas.length} areas</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            ${z.areas.map(a => `
              <button type="button" class="btn btn-sm btn-secondary" data-jump-prov="${escapeHtml(province)}" data-jump-city="${escapeHtml(city)}" data-jump-zone="${escapeHtml(z.zone)}" data-jump-area="${escapeHtml(a)}" style="padding: 0.3rem 0.65rem; font-size: 0.8rem;">
                ${escapeHtml(a)}
              </button>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  grid.querySelectorAll('[data-pick-zone]').forEach(btn => {
    btn.addEventListener('click', () => {
      setLocationHierarchy({ province, city, zone: btn.dataset.pickZone });
      loadListings(getCurrentFilters());
    });
  });
  bindDirectoryJumpButtons(grid);
}

function bindDirectoryJumpButtons(container) {
  container.querySelectorAll('[data-jump-area]').forEach(btn => {
    btn.addEventListener('click', () => {
      setLocationHierarchy({
        province: btn.dataset.jumpProv || '',
        city: btn.dataset.jumpCity || '',
        zone: btn.dataset.jumpZone || '',
        area: btn.dataset.jumpArea || ''
      });
      loadListings(getCurrentFilters());
    });
  });
}

async function refreshSavedIds() {
  try {
    const { data } = await getSavedListings();
    savedListingIds = new Set((data || []).map(item => item.listing_id).filter(Boolean));
  } catch {
    savedListingIds = new Set();
  }
}

async function loadListings(filters = {}) {
  const grid = document.getElementById('listingsGrid');
  const emptyState = document.getElementById('emptyState');
  if (!grid) return;

  grid.innerHTML = '<div class="skeleton skeleton-listing-card"></div>'.repeat(3);
  if (emptyState) emptyState.style.display = 'none';

  const [{ data: listings, error }] = await Promise.all([
    getAllListings(filters),
    refreshSavedIds()
  ]);

  if (error) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    showToast('Error', 'Failed to load listings', 'error');
    return;
  }

  if (!listings || listings.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  grid.innerHTML = listings.map(listing => createListingCard(listing)).join('');
  setupFavoriteButtons();
}

function createListingCard(listing) {
  const rawImage = listing.listing_images?.[0]?.image_url || null;
  const image = safeImageUrl(rawImage);
  const safePrice = escapeHtml(listing.price);
  const priceText = listing.type === 'rent' ? `$${safePrice} <span>/month</span>` : `$${safePrice}`;
  const badgeClass = listing.type === 'sale' ? 'for-sale' : '';
  const badgeText = listing.type === 'sale' ? 'For Sale' : 'For Rent';
  const safeId = encodeURIComponent(listing.id);
  const safeTitle = escapeHtml(listing.title);

  const parsedLoc = parseLocationString(listing.location);
  const locationDisplay = escapeHtml(listing.location || '');
  const hierarchyHint = parsedLoc.province && !String(listing.location || '').toLowerCase().includes(parsedLoc.province.toLowerCase())
    ? ` (${escapeHtml(parsedLoc.province)})`
    : '';

  const safeTier = listing.users?.verification_tier
    ? escapeHtml(listing.users.verification_tier)
    : '';
  const isSaved = savedListingIds.has(listing.id);
  const imgAlt = `${safeTitle} property in ${locationDisplay || 'Zimbabwe'}`;

  return `
    <div class="card property-card" data-listing-id="${escapeHtml(listing.id)}">
      <div class="property-image">
        ${image
          ? `<img src="${escapeHtml(image)}" alt="${imgAlt}" width="400" height="250" loading="lazy">`
          : `<div class="property-image-placeholder">
              <i class="ri-image-line"></i>
            </div>`
        }
        <span class="property-badge ${badgeClass}">${badgeText}</span>
        <button type="button" class="property-favorite ${isSaved ? 'active' : ''}" data-id="${escapeHtml(listing.id)}" aria-label="Save property">
          <i class="${isSaved ? 'ri-heart-fill' : 'ri-heart-line'}"></i>
        </button>
      </div>
      <div class="property-content">
        <div class="property-price">${priceText}</div>
        <h3 class="property-title">${safeTitle}</h3>
        <div class="property-location">
          <i class="ri-map-pin-line"></i>
          <span>${locationDisplay}${hierarchyHint}</span>
        </div>
        <div class="property-features">
          <div class="property-feature"><i class="ri-hotel-bed-line"></i><span>${escapeHtml(listing.rooms)} Beds</span></div>
          <div class="property-feature"><i class="ri-drop-line"></i><span>${escapeHtml(listing.bathrooms || 1)} Bath</span></div>
          <div class="property-feature"><i class="ri-ruler-line"></i><span>${escapeHtml(listing.size || 'N/A')} sqft</span></div>
        </div>
        <div class="property-amenities" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
          ${listing.furnished ? '<span class="amenity-tag" title="Furnished"><i class="ri-home-gear-line"></i></span>' : ''}
          ${listing.water ? '<span class="amenity-tag" title="Water"><i class="ri-drop-fill"></i></span>' : ''}
          ${listing.electricity ? '<span class="amenity-tag" title="Electricity"><i class="ri-flashlight-fill"></i></span>' : ''}
          ${listing.parking ? '<span class="amenity-tag" title="Parking"><i class="ri-parking-fill"></i></span>' : ''}
        </div>
        ${safeTier ? `<div class="landlord-badge tier-${safeTier}" style="margin-top: 0.5rem;"><i class="ri-verified-badge-fill"></i> ${escapeHtml(safeTier.charAt(0).toUpperCase() + safeTier.slice(1))} Verified</div>` : ''}
        <a href="/listing.html?id=${safeId}" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">View Details</a>
      </div>
    </div>
  `;
}

function setupFilters() {
  const provinceEl = document.getElementById('filterProvince');
  const cityEl = document.getElementById('filterCity');
  const zoneEl = document.getElementById('filterZone');
  const areaEl = document.getElementById('filterArea');

  provinceEl?.addEventListener('change', () => {
    const prov = provinceEl.value;
    setLocationHierarchy({ province: prov });
    loadListings(getCurrentFilters());
  });

  cityEl?.addEventListener('change', () => {
    const city = cityEl.value;
    let prov = provinceEl?.value || '';
    if (!prov && city) {
      const selectedOpt = cityEl.options[cityEl.selectedIndex];
      prov = selectedOpt?.dataset?.province || parseLocationString(city).province || '';
    }
    setLocationHierarchy({ province: prov, city });
    loadListings(getCurrentFilters());
  });

  zoneEl?.addEventListener('change', () => {
    const prov = provinceEl?.value || '';
    const city = cityEl?.value || '';
    const zone = zoneEl.value;
    setLocationHierarchy({ province: prov, city, zone });
    loadListings(getCurrentFilters());
  });

  areaEl?.addEventListener('change', () => {
    const area = areaEl.value;
    let prov = provinceEl?.value || '';
    let city = cityEl?.value || '';
    let zone = zoneEl?.value || '';
    if (area && (!prov || !city || !zone)) {
      const parsed = parseLocationString(city ? `${area}, ${city}` : area);
      prov = prov || parsed.province;
      city = city || parsed.city;
      zone = zone || parsed.zone;
    }
    setLocationHierarchy({ province: prov, city, zone, area });
    loadListings(getCurrentFilters());
  });

  document.getElementById('applyFilters')?.addEventListener('click', () => {
    updateFilterToolbarSummaries();
    closeAllDropdownPopovers();
    loadListings(getCurrentFilters());
  });

  let keywordDebounce = null;
  document.getElementById('filterLocation')?.addEventListener('input', () => {
    updateFilterToolbarSummaries();
    clearTimeout(keywordDebounce);
    keywordDebounce = setTimeout(() => {
      loadListings(getCurrentFilters());
    }, 320);
  });

  ['filterLocation', 'filterMinPrice', 'filterMaxPrice'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(keywordDebounce);
        updateFilterToolbarSummaries();
        closeAllDropdownPopovers();
        loadListings(getCurrentFilters());
      }
    });
  });

  ['filterMinPrice', 'filterMaxPrice'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      updateFilterToolbarSummaries();
      loadListings(getCurrentFilters());
    });
  });

  ['filterType', 'filterRooms', 'filterBathrooms', 'filterFurnished', 'filterWater', 'filterElectricity', 'filterParking'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      updateFilterToolbarSummaries();
      loadListings(getCurrentFilters());
    });
  });
}

function setupFavoriteButtons() {
  document.querySelectorAll('.property-favorite').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const listingId = btn.dataset.id;
      if (!listingId) return;

      const icon = btn.querySelector('i');
      const isActive = btn.classList.contains('active');

      if (isActive) {
        const { error } = await unsaveListing(listingId);
        if (!error) {
          savedListingIds.delete(listingId);
          btn.classList.remove('active');
          icon.className = 'ri-heart-line';
          showToast('Removed', 'Property removed from saved', 'success');
        }
      } else {
        const { error } = await saveListing(listingId);
        if (!error) {
          savedListingIds.add(listingId);
          btn.classList.add('active');
          icon.className = 'ri-heart-fill';
          showToast('Saved', 'Property saved to your list', 'success');
        } else {
          showToast('Login Required', 'Please login to save properties', 'warning');
        }
      }
    });
  });
}

function setupRealtimeUpdates() {
  listingsSubscription = subscribeToListings((payload) => {
    if (payload.eventType === 'INSERT') {
      showToast('New Listing', 'A new property was just added!', 'info');
      loadListings(getCurrentFilters());
    } else if (payload.eventType === 'UPDATE') {
      loadListings(getCurrentFilters());
    } else if (payload.eventType === 'DELETE') {
      const card = document.querySelector(`[data-listing-id="${CSS.escape(String(payload.old.id))}"]`);
      if (card) {
        card.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => card.remove(), 300);
      }
    }
  });
}

function setupSaveSearch() {
  const saveBtn = document.getElementById('saveSearchBtn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    const user = await getCurrentUser();
    if (!user) {
      showToast('Login Required', 'Please login to save searches', 'warning');
      return;
    }

    const filters = getCurrentFilters();
    if (Object.keys(filters).length === 0) {
      showToast('No Filters', 'Apply some filters first to save a search', 'info');
      return;
    }

    const locPart = [filters.area, filters.city, filters.province].filter(Boolean).join(', ') || filters.location;
    const searchSummary = [locPart, filters.type, filters.rooms ? `${filters.rooms} beds` : null]
      .filter(Boolean)
      .join(' - ') || 'Saved Search';

    const { error } = await saveSearch(filters, searchSummary);
    if (error) {
      showToast('Error', 'Failed to save search', 'error');
    } else {
      showToast('Saved', `Search "${searchSummary}" saved to your account.`, 'success');
    }
  });
}

function setupClearFilters() {
  const clearBtn = document.getElementById('clearFiltersBtn');
  const emptyResetBtn = document.getElementById('emptyResetFiltersBtn');

  const handleReset = () => {
    setLocationHierarchy({});
    ['filterLocation', 'filterType', 'filterMinPrice', 'filterMaxPrice', 'filterRooms', 'filterBathrooms'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['filterFurnished', 'filterWater', 'filterElectricity', 'filterParking'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });

    updateFilterToolbarSummaries();
    closeAllDropdownPopovers();
    loadListings();
    showToast('Cleared', 'All filters have been cleared', 'success');
  };

  clearBtn?.addEventListener('click', handleReset);
  emptyResetBtn?.addEventListener('click', handleReset);
}

function getCurrentFilters() {
  const filters = {
    province: document.getElementById('filterProvince')?.value || '',
    city: document.getElementById('filterCity')?.value || '',
    zone: document.getElementById('filterZone')?.value || '',
    area: document.getElementById('filterArea')?.value || '',
    location: document.getElementById('filterLocation')?.value?.trim() || '',
    type: document.getElementById('filterType')?.value || '',
    min_price: document.getElementById('filterMinPrice')?.value || '',
    max_price: document.getElementById('filterMaxPrice')?.value || '',
    rooms: document.getElementById('filterRooms')?.value || '',
    bathrooms: document.getElementById('filterBathrooms')?.value || '',
    furnished: document.getElementById('filterFurnished')?.checked || false,
    water: document.getElementById('filterWater')?.checked || false,
    electricity: document.getElementById('filterElectricity')?.checked || false,
    parking: document.getElementById('filterParking')?.checked || false
  };

  Object.keys(filters).forEach(key => {
    if (!filters[key]) delete filters[key];
  });

  return filters;
}

window.addEventListener('beforeunload', () => {
  if (listingsSubscription) {
    unsubscribe(listingsSubscription);
  }
});
