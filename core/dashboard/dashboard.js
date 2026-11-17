import {
  getCurrentUser,
  getSavedListings,
  getUnlockedContacts,
  getLandlordListings,
  getLandlordUnlocks,
  subscribeToUnlocks,
  unsubscribe,
  verifyAdminSession
} from '../api/api.js';
import { showToast } from '../utils/toast.js';
import { logout } from '../auth/auth.js';
import { escapeHtml, safeImageUrl } from '../utils/sanitize.js';

window.logout = logout;

let unlocksSubscription = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/auth/login.html';
    return;
  }

  const adminCheck = await verifyAdminSession();
  if (adminCheck?.isAdmin && window.location.pathname.includes('/dashboard/')) {
    window.location.href = '/admin/index.html';
    return;
  }

  updateUserName(user);

  if (user.role === 'tenant') {
    loadTenantDashboard(user);
  } else if (user.role === 'landlord') {
    loadLandlordDashboard(user);
  }
});

function updateUserName(user) {
  const nameEl = document.getElementById('userName');
  if (nameEl) {
    nameEl.textContent = user.name || user.email?.split('@')[0] || 'User';
  }
}

async function loadTenantDashboard(user) {
  const [savedResult, unlockedResult] = await Promise.all([
    getSavedListings(),
    getUnlockedContacts(user.id)
  ]);

  const savedCount = document.getElementById('savedCount');
  const unlockedCount = document.getElementById('unlockedCount');
  const spentAmount = document.getElementById('spentAmount');

  const saved = savedResult.data || [];
  const unlocked = unlockedResult.data || [];

  if (savedCount) savedCount.textContent = String(saved.length);
  if (unlockedCount) unlockedCount.textContent = String(unlocked.length);
  if (spentAmount) spentAmount.textContent = `$${(unlocked.length * 2.5).toFixed(2)}`;

  renderRecentUnlocks(unlocked.slice(0, 3));
  renderSavedListings(saved.slice(0, 3));
}

async function loadLandlordDashboard(user) {
  const [listingsResult, unlocksResult] = await Promise.all([
    getLandlordListings(user.id),
    getLandlordUnlocks(user.id)
  ]);

  const listingsCount = document.getElementById('listingsCount');
  const unlocksCount = document.getElementById('unlocksCount');
  const viewsCount = document.getElementById('viewsCount');
  const earningsAmount = document.getElementById('earningsAmount');
  const conversionRate = document.getElementById('conversionRate');
  const weeklyUnlocks = document.getElementById('weeklyUnlocks');
  const weeklyEarnings = document.getElementById('weeklyEarnings');
  const verificationStatus = document.getElementById('verificationStatus');

  const listings = listingsResult.data || [];
  const unlocks = unlocksResult.data || [];
  const totalViews = listings.reduce((sum, l) => sum + (l.views || 0), 0);

  if (listingsCount) listingsCount.textContent = String(listings.length);
  if (unlocksCount) unlocksCount.textContent = String(unlocks.length);
  if (viewsCount) viewsCount.textContent = String(totalViews);
  if (earningsAmount) earningsAmount.textContent = `$${(unlocks.length * 2.5).toFixed(2)}`;

  if (conversionRate) {
    const rate = totalViews > 0 ? ((unlocks.length / totalViews) * 100).toFixed(1) : 0;
    conversionRate.textContent = `${rate}%`;
  }

  if (weeklyUnlocks || weeklyEarnings) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUnlocks = unlocks.filter(u => new Date(u.unlocked_at) > weekAgo);
    if (weeklyUnlocks) weeklyUnlocks.textContent = String(recentUnlocks.length);
    if (weeklyEarnings) weeklyEarnings.textContent = `$${(recentUnlocks.length * 2.5).toFixed(2)}`;
  }

  if (verificationStatus && user.verification_tier) {
    const tier = escapeHtml(user.verification_tier);
    const label = escapeHtml(tier.charAt(0).toUpperCase() + tier.slice(1));
    verificationStatus.innerHTML = `<span class="landlord-badge tier-${tier}"><i class="ri-verified-badge-fill"></i> ${label}</span>`;
  }

  renderLandlordUnlocks(unlocks.slice(0, 5));
  renderLandlordListings(listings);

  setupRealtimeNotifications(user.id);
}

function renderRecentUnlocks(unlocks) {
  const container = document.getElementById('recentUnlocks');
  if (!container || unlocks.length === 0) return;

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Property</th>
          <th>Landlord</th>
          <th>Contact</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${unlocks.map(unlock => `
          <tr>
            <td>${escapeHtml(unlock.listings?.title || 'N/A')}</td>
            <td>${escapeHtml(unlock.listings?.users?.name || 'N/A')}</td>
            <td>${escapeHtml(unlock.listings?.users?.phone || 'N/A')}</td>
            <td>${escapeHtml(new Date(unlock.unlocked_at).toLocaleDateString())}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderSavedListings(saved) {
  const container = document.getElementById('savedListings');
  if (!container || saved.length === 0) return;

  container.innerHTML = `
    <div class="listings-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
      ${saved.map(item => {
        const listing = item.listings;
        if (!listing) return '';
        const image = safeImageUrl(listing?.listing_images?.[0]?.image_url || null);
        return `
          <div class="card property-card" style="padding: 0;">
            <div class="property-image" style="height: 140px;">
              ${image
                ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)}">`
                : `<div style="width: 100%; height: 100%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;"><i class="ri-image-line" style="font-size: 1.5rem; color: var(--text-tertiary);"></i></div>`
              }
            </div>
            <div class="property-content" style="padding: 1rem;">
              <div class="property-price" style="font-size: 1.25rem;">$${escapeHtml(listing?.price || 0)}</div>
              <h3 class="property-title" style="font-size: 1rem;">${escapeHtml(listing?.title || 'N/A')}</h3>
              <a href="/listing.html?id=${encodeURIComponent(listing?.id)}" class="btn btn-sm btn-primary" style="width: 100%; margin-top: 0.5rem;">View</a>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderLandlordUnlocks(unlocks) {
  const container = document.getElementById('recentUnlocks');
  if (!container || unlocks.length === 0) return;

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Property</th>
          <th>Tenant</th>
          <th>Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${unlocks.map(unlock => `
          <tr>
            <td>${escapeHtml(unlock.listings?.title || 'N/A')}</td>
            <td>${escapeHtml(unlock.users?.name || 'Anonymous')}</td>
            <td>${escapeHtml(new Date(unlock.unlocked_at).toLocaleDateString())}</td>
            <td><span class="badge badge-success">Paid</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderLandlordListings(listings) {
  const container = document.getElementById('myListings');
  if (!container || listings.length === 0) return;

  container.innerHTML = `
    <div class="listings-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
      ${listings.map(listing => {
        const image = safeImageUrl(listing.listing_images?.[0]?.image_url || null);
        const safeId = encodeURIComponent(listing.id);
        return `
          <div class="card property-card" style="padding: 0;">
            <div class="property-image" style="height: 140px;">
              ${image
                ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)}">`
                : `<div style="width: 100%; height: 100%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;"><i class="ri-image-line" style="font-size: 1.5rem; color: var(--text-tertiary);"></i></div>`
              }
              <span class="property-badge">${listing.type === 'sale' ? 'For Sale' : 'For Rent'}</span>
            </div>
            <div class="property-content" style="padding: 1rem;">
              <div class="property-price" style="font-size: 1.25rem;">$${escapeHtml(listing.price)}</div>
              <h3 class="property-title" style="font-size: 1rem;">${escapeHtml(listing.title)}</h3>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <a href="/dashboard/landlord-edit.html?id=${safeId}" class="btn btn-sm btn-secondary" style="flex: 1;">Edit</a>
                <a href="/listing.html?id=${safeId}" class="btn btn-sm btn-primary" style="flex: 1;">View</a>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function setupRealtimeNotifications(landlordId) {
  unlocksSubscription = subscribeToUnlocks(landlordId, (payload) => {
    if (payload.eventType === 'INSERT') {
      showToast('New Unlock!', 'Someone just unlocked your contact info!', 'success');
      const badge = document.getElementById('notifBadge');
      if (badge) {
        badge.style.display = 'flex';
        badge.textContent = String(parseInt(badge.textContent || '0', 10) + 1);
      }
      loadLandlordDashboard({ id: landlordId });
    }
  });
}

window.addEventListener('beforeunload', () => {
  if (unlocksSubscription) {
    unsubscribe(unlocksSubscription);
  }
});
