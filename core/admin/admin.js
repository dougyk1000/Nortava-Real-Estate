import {
  getAdminOverview,
  verifyLandlord,
  rejectLandlord,
  aiVerifyLandlord,
  fetchAdminLandlordDoc,
  updateReportStatus,
  verifyAdminSession
} from '../api/api.js';
import { showToast } from '../utils/toast.js';
import { logout } from '../auth/auth.js';
import { escapeHtml } from '../utils/sanitize.js';

window.logout = logout;
window.logoutAdmin = logout;

let activeDocBlobUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const adminCheck = await verifyAdminSession();
    if (!adminCheck?.isAdmin) {
      showToast('Access Denied', 'Admin access required', 'error');
      setTimeout(() => {
        window.location.href = '/auth/login.html';
      }, 1200);
      return;
    }

    await loadAdminDashboard();

    if (window.location.pathname.includes('verify-landlords')) {
      setupDocAndRejectModals();
      await loadUnverifiedLandlords();
    }
    if (window.location.pathname.includes('reports')) {
      await loadReports();
    }
  } catch {
    showToast('Error', 'Failed to verify admin access', 'error');
    setTimeout(() => {
      window.location.href = '/auth/login.html';
    }, 1200);
  }
});

async function loadAdminDashboard() {
  const { data: overview, error } = await getAdminOverview();
  if (error || !overview) return;

  const stats = overview.stats || {};
  const totalUsers = document.getElementById('totalUsers');
  const totalListings = document.getElementById('totalListings');
  const totalPayments = document.getElementById('totalPayments');
  const pendingReports = document.getElementById('pendingReports');

  if (totalUsers) totalUsers.textContent = String(stats.totalUsers || 0);
  if (totalListings) totalListings.textContent = String(stats.totalListings || 0);
  if (totalPayments) totalPayments.textContent = String(stats.totalUnlocks || 0);
  if (pendingReports) pendingReports.textContent = String(stats.pendingReports || 0);
}

function setupDocAndRejectModals() {
  const docModal = document.getElementById('docViewerModal');
  const closeDocBtn = document.getElementById('closeDocModalBtn');
  const docBody = document.getElementById('docViewerBody');

  const closeDocModal = () => {
    if (docModal) docModal.style.display = 'none';
    if (docBody) docBody.innerHTML = '';
    if (activeDocBlobUrl) {
      URL.revokeObjectURL(activeDocBlobUrl);
      activeDocBlobUrl = null;
    }
  };

  closeDocBtn?.addEventListener('click', closeDocModal);
  docModal?.addEventListener('click', (e) => {
    if (e.target === docModal) closeDocModal();
  });

  const rejectModal = document.getElementById('rejectReasonModal');
  const cancelRejectBtn = document.getElementById('cancelRejectBtn');
  const rejectForm = document.getElementById('rejectReasonForm');

  cancelRejectBtn?.addEventListener('click', () => {
    if (rejectModal) rejectModal.style.display = 'none';
  });
  rejectModal?.addEventListener('click', (e) => {
    if (e.target === rejectModal) rejectModal.style.display = 'none';
  });

  rejectForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('rejectUserId')?.value;
    const reason = document.getElementById('rejectReasonInput')?.value.trim();
    if (!userId || !reason) return;

    const btn = rejectForm.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    const { error } = await rejectLandlord(userId, reason);
    if (btn) btn.disabled = false;

    if (error) {
      showToast('Error', error.message || 'Failed to reject landlord.', 'error');
      return;
    }

    showToast('Rejected', 'Landlord verification declined and logged.', 'success');
    if (rejectModal) rejectModal.style.display = 'none';
    rejectForm.reset();
    await loadUnverifiedLandlords();
  });
}

async function openLandlordDocument(userId, docKind, titleText) {
  const modal = document.getElementById('docViewerModal');
  const titleEl = document.getElementById('docViewerTitle');
  const bodyEl = document.getElementById('docViewerBody');
  const downloadEl = document.getElementById('docDownloadLink');
  if (!modal || !bodyEl) return;

  if (titleEl) titleEl.textContent = titleText;
  bodyEl.innerHTML = '<p style="color: var(--text-secondary);">Decrypting & loading private document...</p>';
  modal.style.display = 'flex';

  const { blobUrl, mimeType, error } = await fetchAdminLandlordDoc(userId, docKind);
  if (error || !blobUrl) {
    bodyEl.innerHTML = `<p style="color: var(--danger); padding: 1.5rem;">${escapeHtml(error?.message || 'Unable to load document.')}</p>`;
    if (downloadEl) downloadEl.style.display = 'none';
    return;
  }

  if (activeDocBlobUrl) URL.revokeObjectURL(activeDocBlobUrl);
  activeDocBlobUrl = blobUrl;

  if (downloadEl) {
    downloadEl.href = blobUrl;
    downloadEl.download = `${docKind}-${userId.slice(0, 8)}`;
    downloadEl.style.display = 'inline-flex';
  }

  if (mimeType.includes('pdf')) {
    bodyEl.innerHTML = `<iframe src="${blobUrl}" style="width: 100%; height: 65vh; border: none; border-radius: var(--radius);"></iframe>`;
  } else {
    bodyEl.innerHTML = `<img src="${blobUrl}" alt="${escapeHtml(titleText)}" style="max-width: 100%; max-height: 65vh; object-fit: contain; border-radius: var(--radius);">`;
  }
}

function renderAiStatusBadge(kyc) {
  if (!kyc) return '<span class="badge badge-warning">No Documents Uploaded</span>';
  const status = kyc.ai_status || 'pending_ai_screening';
  const conf = Number(kyc.ai_confidence || 0);
  if (status === 'recommended_approve') {
    return `<span class="badge badge-success"><i class="ri-sparkling-fill"></i> AI: Recommended (${conf}%)</span>`;
  }
  if (status === 'flagged_suspicious') {
    return `<span class="badge badge-danger"><i class="ri-alert-fill"></i> AI: Flagged Suspicious (${conf}%)</span>`;
  }
  if (status === 'needs_manual_review') {
    return `<span class="badge badge-warning"><i class="ri-eye-line"></i> AI: Manual Review (${conf}%)</span>`;
  }
  return '<span class="badge badge-secondary"><i class="ri-time-line"></i> AI Screening Pending</span>';
}

export async function loadUnverifiedLandlords() {
  const { data: overview, error } = await getAdminOverview();
  const container = document.getElementById('landlordsList');
  if (!container) return;

  if (error || !overview) {
    container.innerHTML = '<div class="card"><p style="text-align: center; color: var(--text-tertiary); padding: 2rem;">Unable to load landlords</p></div>';
    return;
  }

  const verificationsByUser = new Map(
    (overview.verifications || []).map(v => [v.user_id, v])
  );

  const landlords = (overview.users || []).filter(u => u.role === 'landlord');
  if (landlords.length === 0) {
    container.innerHTML = '<div class="card"><p style="text-align: center; color: var(--text-tertiary); padding: 2rem;">No landlord accounts registered yet.</p></div>';
    return;
  }

  // Show pending / rejected landlords first, then verified landlords
  const sorted = [...landlords].sort((a, b) => Number(Boolean(a.verified)) - Number(Boolean(b.verified)));

  container.innerHTML = sorted.map(landlord => {
    const kyc = verificationsByUser.get(landlord.id) || null;
    const dupWarnings = Array.isArray(kyc?.duplicate_warnings) ? kyc.duplicate_warnings : [];
    const aiFlags = Array.isArray(kyc?.ai_red_flags) ? kyc.ai_red_flags : [];
    const statusLabel = landlord.verified
      ? `<span class="badge badge-success"><i class="ri-verified-badge-fill"></i> Verified (${escapeHtml(landlord.verification_tier || 'silver')})</span>`
      : kyc?.admin_status === 'rejected'
        ? `<span class="badge badge-danger"><i class="ri-close-circle-line"></i> Rejected</span>`
        : `<span class="badge badge-warning"><i class="ri-time-line"></i> Pending Verification</span>`;

    return `
      <div class="card" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
          <div>
            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
              <h3 style="margin: 0; font-size: 1.15rem;">${escapeHtml(landlord.name || 'Unnamed Landlord')}</h3>
              ${statusLabel}
              ${renderAiStatusBadge(kyc)}
            </div>
            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.35rem;">
              <i class="ri-mail-line"></i> ${escapeHtml(landlord.email)} &nbsp;&bull;&nbsp;
              <i class="ri-phone-line"></i> ${escapeHtml(landlord.phone || 'Not provided')} &nbsp;&bull;&nbsp;
              Joined ${escapeHtml(new Date(landlord.created_at).toLocaleDateString())}
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
            ${kyc ? `
              <button type="button" class="btn btn-sm btn-outline" data-ai-verify-id="${escapeHtml(landlord.id)}">
                <i class="ri-sparkling-line"></i> Run AI Verify
              </button>
            ` : ''}
            <select class="input" data-tier-for="${escapeHtml(landlord.id)}" style="width: auto; padding: 0.35rem 0.65rem; font-size: 0.85rem;">
              <option value="bronze">Bronze Tier</option>
              <option value="silver" selected>Silver Tier</option>
              <option value="gold">Gold Tier</option>
            </select>
            <button type="button" class="btn btn-sm btn-success" data-verify-id="${escapeHtml(landlord.id)}">
              <i class="ri-check-line"></i> ${landlord.verified ? 'Update Tier' : 'Approve & Verify'}
            </button>
            <button type="button" class="btn btn-sm btn-danger" data-reject-id="${escapeHtml(landlord.id)}">
              <i class="ri-close-line"></i> Reject
            </button>
          </div>
        </div>

        ${dupWarnings.length > 0 ? `
          <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid var(--danger); border-radius: var(--radius); margin-bottom: 1rem; color: var(--danger); font-size: 0.875rem;">
            <strong><i class="ri-alarm-warning-fill"></i> Anti-Scam Alert:</strong> ${dupWarnings.map(w => escapeHtml(w)).join(' | ')}
          </div>
        ` : ''}

        ${kyc ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem; font-size: 0.875rem;">
            <div style="background: var(--bg-secondary); padding: 0.85rem; border-radius: var(--radius);">
              <div style="color: var(--text-tertiary); font-size: 0.78rem;">Zimbabwe National ID</div>
              <div style="font-weight: 600;">${escapeHtml(kyc.national_id_number)}</div>
              <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.25rem;">Capacity: ${escapeHtml(String(kyc.ownership_capacity || 'owner').replace(/_/g, ' '))}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 0.85rem; border-radius: var(--radius);">
              <div style="color: var(--text-tertiary); font-size: 0.78rem;">Declared Property Location</div>
              <div style="font-weight: 600;">${escapeHtml(kyc.property_address || 'N/A')}</div>
              <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.25rem;">${escapeHtml([kyc.property_area, kyc.property_city, kyc.property_province].filter(Boolean).join(', '))}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 0.85rem; border-radius: var(--radius);">
              <div style="color: var(--text-tertiary); font-size: 0.78rem;">AI Document Assessment</div>
              <div style="color: var(--text-primary); font-size: 0.84rem; margin-top: 0.2rem;">${escapeHtml(kyc.ai_summary || 'No AI summary recorded yet.')}</div>
              ${kyc.ai_extracted_owner ? `<div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem;">Extracted Owner: ${escapeHtml(kyc.ai_extracted_owner)}${kyc.ai_extracted_id ? ` | ID: ${escapeHtml(kyc.ai_extracted_id)}` : ''}</div>` : ''}
            </div>
          </div>

          ${aiFlags.length > 0 ? `
            <div style="font-size: 0.84rem; color: var(--warning); margin-bottom: 1rem;">
              <strong>Flags:</strong> ${aiFlags.map(f => escapeHtml(f)).join(' • ')}
            </div>
          ` : ''}

          ${kyc.rejection_reason ? `
            <div style="font-size: 0.84rem; color: var(--danger); margin-bottom: 1rem;">
              <strong>Decline Reason:</strong> ${escapeHtml(kyc.rejection_reason)}
            </div>
          ` : ''}

          <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm btn-secondary" data-view-doc="title_deed" data-doc-user="${escapeHtml(landlord.id)}" data-doc-label="Title Deed / Cession — ${escapeHtml(landlord.name || '')}">
              <i class="ri-file-shield-2-line"></i> View Title Deed
            </button>
            <button type="button" class="btn btn-sm btn-secondary" data-view-doc="national_id" data-doc-user="${escapeHtml(landlord.id)}" data-doc-label="Zimbabwe National ID — ${escapeHtml(landlord.name || '')}">
              <i class="ri-id-card-line"></i> View National ID
            </button>
            ${kyc.rates_bill_path ? `
              <button type="button" class="btn btn-sm btn-secondary" data-view-doc="rates_bill" data-doc-user="${escapeHtml(landlord.id)}" data-doc-label="Rates / Authority Proof — ${escapeHtml(landlord.name || '')}">
                <i class="ri-bill-line"></i> View Supporting Proof
              </button>
            ` : ''}
          </div>
        ` : `
          <p style="color: var(--text-tertiary); font-size: 0.875rem; margin: 0;">This landlord has not uploaded Title Deeds or National ID documents yet. Do not approve until valid documents are submitted.</p>
        `}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-verify-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.verifyId;
      const tierSelect = container.querySelector(`[data-tier-for="${CSS.escape(uid)}"]`);
      const tier = tierSelect?.value || 'silver';
      window.verifyLandlordAction(uid, tier);
    });
  });

  container.querySelectorAll('[data-ai-verify-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.aiVerifyId;
      btn.disabled = true;
      btn.innerHTML = '<span class="loading-spinner"></span> Screening...';
      const { error: aiErr } = await aiVerifyLandlord(uid);
      btn.disabled = false;
      btn.innerHTML = '<i class="ri-sparkling-line"></i> Run AI Verify';
      if (aiErr) {
        showToast('AI Screening Unavailable', aiErr.message || 'Unable to run AI screening.', 'error');
        return;
      }
      showToast('AI Screening Complete', 'Updated automated fraud & document check.', 'success');
      await loadUnverifiedLandlords();
    });
  });

  container.querySelectorAll('[data-reject-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('rejectReasonModal');
      const hiddenInput = document.getElementById('rejectUserId');
      if (hiddenInput) hiddenInput.value = btn.dataset.rejectId;
      if (modal) modal.style.display = 'flex';
    });
  });

  container.querySelectorAll('[data-view-doc]').forEach(btn => {
    btn.addEventListener('click', () => {
      openLandlordDocument(btn.dataset.docUser, btn.dataset.viewDoc, btn.dataset.docLabel || 'Document');
    });
  });
}

window.verifyLandlordAction = async function(userId, tier = 'silver') {
  const { error } = await verifyLandlord(userId, tier);
  if (error) {
    showToast('Error', error.message || 'Failed to verify landlord', 'error');
    return;
  }
  showToast('Success', `Landlord verified (${tier} tier)!`, 'success');
  await loadUnverifiedLandlords();
};

export async function loadReports() {
  const { data: overview, error } = await getAdminOverview();
  const container = document.getElementById('reportsList');
  if (!container) return;

  if (error || !overview) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 2rem;">Unable to load reports</p>';
    return;
  }

  const reports = overview.reports || [];
  if (reports.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 2rem;">No reports to review</p>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Listing</th>
          <th>Reporter</th>
          <th>Date</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${reports.map(report => `
          <tr>
            <td>${escapeHtml(report.reason)}</td>
            <td>${escapeHtml(report.listings?.title || 'N/A')}</td>
            <td>${escapeHtml(report.users?.name || 'Anonymous')}</td>
            <td>${escapeHtml(new Date(report.created_at).toLocaleDateString())}</td>
            <td><span class="badge badge-${report.status === 'pending' ? 'warning' : 'success'}">${escapeHtml(report.status)}</span></td>
            <td>
              ${report.status === 'pending' ? `
                <button type="button" class="btn btn-sm btn-success" data-resolve-id="${escapeHtml(report.id)}">
                  <i class="ri-check-line"></i> Resolve
                </button>
              ` : '-'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('[data-resolve-id]').forEach(btn => {
    btn.addEventListener('click', () => window.resolveReport(btn.dataset.resolveId));
  });
}

window.resolveReport = async function(reportId) {
  const { error } = await updateReportStatus(reportId, 'resolved');
  if (error) {
    showToast('Error', error.message || 'Failed to resolve report', 'error');
    return;
  }
  showToast('Success', 'Report resolved', 'success');
  await loadReports();
};
