import {
  getCurrentUser,
  getSavedListings,
  getUnlockedContacts,
  getLandlordListings,
  getLandlordUnlocks,
  getLandlordVerificationStatus,
  submitLandlordVerification,
  subscribeToUnlocks,
  unsubscribe,
  verifyAdminSession
} from '../api/api.js';
import { showToast } from '../utils/toast.js';
import { logout, readDocumentAsBase64 } from '../auth/auth.js';
import { escapeHtml, safeImageUrl } from '../utils/sanitize.js';
import { setupSmartNotifications, initNotificationCenter } from '../notifications/notifications.js';
import { initListingLocationPicker } from '../locations/locationSelector.js';

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
  setupSmartNotifications();
  initNotificationCenter();

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
  const [listingsResult, unlocksResult, kycResult] = await Promise.all([
    getLandlordListings(user.id),
    getLandlordUnlocks(user.id),
    getLandlordVerificationStatus()
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

  if (verificationStatus) {
    if (user.verified && user.verification_tier) {
      const tier = escapeHtml(user.verification_tier);
      const label = escapeHtml(tier.charAt(0).toUpperCase() + tier.slice(1));
      verificationStatus.innerHTML = `<span class="landlord-badge tier-${tier}"><i class="ri-verified-badge-fill"></i> ${label}</span>`;
    } else if (user.verified) {
      verificationStatus.innerHTML = `<span class="badge badge-success"><i class="ri-verified-badge-fill"></i> Verified</span>`;
    } else {
      verificationStatus.innerHTML = `<span class="badge badge-warning">Pending Review</span>`;
    }
  }

  setupLandlordVerificationPanel(kycResult?.data);
  renderLandlordUnlocks(unlocks.slice(0, 5));
  renderLandlordListings(listings);

  setupRealtimeNotifications(user.id);
}

function setupLandlordVerificationPanel(kycPayload) {
  const descEl = document.getElementById('kycStatusDescription');
  const bannerEl = document.getElementById('kycStatusBanner');
  const formEl = document.getElementById('dashboardKycForm');
  const toggleBtn = document.getElementById('toggleKycUploadBtn');
  if (!descEl || !bannerEl || !formEl) return;

  const isVerified = Boolean(kycPayload?.verified);
  const status = kycPayload?.verificationStatus || 'unverified';
  const kyc = kycPayload?.verification || null;

  if (isVerified) {
    descEl.textContent = 'Your identity and Title Deeds are verified. Your listings display a verified badge.';
    bannerEl.innerHTML = `
      <div style="padding: 0.85rem 1rem; background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success); border-radius: var(--radius); color: var(--success); font-size: 0.9rem;">
        <i class="ri-checkbox-circle-fill"></i> Verified Landlord (${escapeHtml(kycPayload?.verificationTier || 'silver')} tier) &bull; National ID ${escapeHtml(kyc?.nationalIdNumber || 'On file')}
      </div>
    `;
  } else if (status === 'rejected') {
    descEl.textContent = 'Your previous submission requires updated documents before your listings can go live.';
    bannerEl.innerHTML = `
      <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); border-radius: var(--radius); color: var(--danger); font-size: 0.9rem;">
        <strong><i class="ri-close-circle-fill"></i> Verification Declined:</strong> ${escapeHtml(kyc?.rejectionReason || 'Please upload clear Title Deeds and National ID.')}
      </div>
    `;
    formEl.style.display = 'block';
  } else if (kyc) {
    descEl.textContent = 'Your Title Deed and National ID are queued for AI screening and Admin approval.';
    bannerEl.innerHTML = `
      <div style="padding: 0.85rem 1rem; background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); border-radius: var(--radius); color: var(--text-primary); font-size: 0.9rem;">
        <i class="ri-time-fill" style="color: var(--warning);"></i> <strong>Pending Review:</strong> Submitted ID ${escapeHtml(kyc.nationalIdNumber)} for ${escapeHtml(kyc.propertyAddress || '')}.
        ${kyc.aiSummary ? `<div style="margin-top: 0.35rem; font-size: 0.82rem; color: var(--text-secondary);">AI Check: ${escapeHtml(kyc.aiSummary)}</div>` : ''}
      </div>
    `;
  } else {
    descEl.textContent = 'Upload your Zimbabwe National ID and Title Deed / Cession so Admin can verify your account and publish your listings.';
    bannerEl.innerHTML = `
      <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid var(--warning); border-radius: var(--radius); color: var(--text-primary); font-size: 0.9rem;">
        <i class="ri-shield-keyhole-line" style="color: var(--warning);"></i> <strong>Verification Required:</strong> No Title Deeds on file yet. Submit documents below to prevent delays publishing listings.
      </div>
    `;
    formEl.style.display = 'block';
  }

  toggleBtn?.addEventListener('click', () => {
    formEl.style.display = formEl.style.display === 'none' ? 'block' : 'none';
  });

  if (formEl.dataset.wired === 'true') return;
  formEl.dataset.wired = 'true';

  const picker = initListingLocationPicker({
    provinceEl: document.getElementById('dashKycProvince'),
    cityEl: document.getElementById('dashKycCity'),
    areaEl: document.getElementById('dashKycArea'),
    defaultProvince: kyc?.propertyProvince || 'Harare',
    defaultCity: kyc?.propertyCity || 'Harare'
  });

  if (kyc?.nationalIdNumber) {
    const idEl = document.getElementById('dashNationalId');
    if (idEl) idEl.value = kyc.nationalIdNumber;
  }
  if (kyc?.propertyAddress) {
    const addrEl = document.getElementById('dashPropertyAddress');
    if (addrEl) addrEl.value = kyc.propertyAddress;
  }

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = formEl.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner"></span> Uploading & Screening...';
    }

    try {
      const titleDeedFile = document.getElementById('dashTitleDeedFile')?.files?.[0] || null;
      const nationalIdFile = document.getElementById('dashNationalIdFile')?.files?.[0] || null;
      const ratesBillFile = document.getElementById('dashRatesBillFile')?.files?.[0] || null;

      const [titleDeedDoc, nationalIdDoc, ratesBillDoc] = await Promise.all([
        readDocumentAsBase64(titleDeedFile),
        readDocumentAsBase64(nationalIdFile),
        readDocumentAsBase64(ratesBillFile)
      ]);

      const { error } = await submitLandlordVerification({
        nationalIdNumber: document.getElementById('dashNationalId')?.value.trim(),
        ownershipCapacity: document.getElementById('dashOwnershipCapacity')?.value || 'owner',
        propertyProvince: document.getElementById('dashKycProvince')?.value || picker.getValues().province,
        propertyCity: document.getElementById('dashKycCity')?.value || picker.getValues().city,
        propertyArea: document.getElementById('dashKycArea')?.value || picker.getValues().area,
        propertyAddress: document.getElementById('dashPropertyAddress')?.value.trim(),
        antiFraudAttested: Boolean(document.getElementById('dashAntiFraudAttested')?.checked),
        titleDeedDoc,
        nationalIdDoc,
        ratesBillDoc
      });

      if (error) {
        showToast('Submission Error', error.message, 'error');
        return;
      }

      showToast('Submitted', 'Documents uploaded for AI & Admin verification!', 'success');
      const fresh = await getLandlordVerificationStatus();
      setupLandlordVerificationPanel(fresh?.data);
      formEl.style.display = 'none';
    } catch (err) {
      showToast('Document Error', err.message || 'Unable to process documents.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ri-shield-check-line"></i> Submit Documents for AI & Admin Verification';
      }
    }
  });
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
