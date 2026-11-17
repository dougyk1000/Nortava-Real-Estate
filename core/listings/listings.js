import { getAllListings, saveListing, unsaveListing, subscribeToListings, unsubscribe, saveSearch, getCurrentUser } from '../api/api.js';
import { showToast } from '../utils/toast.js';
import { escapeHtml, safeImageUrl } from '../utils/sanitize.js';

let listingsSubscription = null;

document.addEventListener('DOMContentLoaded', () => {
  loadListings();
  setupFilters();
  setupRealtimeUpdates();
  setupSaveSearch();
  setupClearFilters();
});

async function loadListings(filters = {}) {
  const grid = document.getElementById('listingsGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="skeleton skeleton-image" style="height: 300px;"></div>'.repeat(3);

  const { data: listings, error } = await getAllListings(filters);
  if (error) {
    showToast('Error', 'Failed to load listings', 'error');
    return;
  }

  if (listings.length === 0) {
    grid.innerHTML = `
      <div class="card property-card">
        <div class="property-image">
          <img src="/assets/images/family_home_exterior.png" alt="Sample property" style="width: 100%; height: 200px; object-fit: cover;">
          <span class="property-badge">For Rent</span>
        </div>
        <div class="property-content">
          <div class="property-price">$150 <span>/month</span></div>
          <h3 class="property-title">Spacious 2 Bedroom House in Katanga (Sample)</h3>
          <div class="property-location">
            <i class="ri-map-pin-line"></i>
            <span>Katanga, Norton</span>
          </div>
          <div class="property-features">
            <div class="property-feature"><i class="ri-hotel-bed-line"></i><span>2 Beds</span></div>
            <div class="property-feature"><i class="ri-drop-line"></i><span>1 Bath</span></div>
            <div class="property-feature"><i class="ri-ruler-line"></i><span>850 sqft</span></div>
          </div>
          <a href="/listing.html?id=sample" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">View Details</a>
        </div>
      </div>
    `;
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
  const safeLocation = escapeHtml(listing.location);
  const safeTier = listing.users?.verification_tier
    ? escapeHtml(listing.users.verification_tier)
    : '';

  return `
    <div class="card property-card" data-listing-id="${escapeHtml(listing.id)}">
      <div class="property-image">
        ${image
          ? `<img src="${escapeHtml(image)}" alt="${safeTitle}" loading="lazy">`
          : `<div style="width: 100%; height: 200px; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: var(--text-tertiary);">
              <i class="ri-image-line" style="font-size: 2rem;"></i>
            </div>`
        }
        <span class="property-badge ${badgeClass}">${badgeText}</span>
        <button type="button" class="property-favorite" data-id="${escapeHtml(listing.id)}" aria-label="Save property">
          <i class="ri-heart-line"></i>
        </button>
      </div>
      <div class="property-content">
        <div class="property-price">${priceText}</div>
        <h3 class="property-title">${safeTitle}</h3>
        <div class="property-location">
          <i class="ri-map-pin-line"></i>
          <span>${safeLocation}</span>
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
  const applyBtn = document.getElementById('applyFilters');
  if (!applyBtn) return;

  applyBtn.addEventListener('click', () => {
    loadListings(getCurrentFilters());
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
          btn.classList.remove('active');
          icon.className = 'ri-heart-line';
          showToast('Removed', 'Property removed from saved', 'success');
        }
      } else {
        const { error } = await saveListing(listingId);
        if (!error) {
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

    const searchSummary = [filters.location, filters.type, filters.rooms ? `${filters.rooms} beds` : null]
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
  if (!clearBtn) return;

  clearBtn.addEventListener('click', () => {
    ['filterLocation', 'filterType', 'filterMinPrice', 'filterMaxPrice', 'filterRooms', 'filterBathrooms'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['filterFurnished', 'filterWater', 'filterElectricity', 'filterParking'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });

    loadListings();
    showToast('Cleared', 'All filters have been cleared', 'success');
  });
}

function getCurrentFilters() {
  const filters = {
    location: document.getElementById('filterLocation')?.value || '',
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
