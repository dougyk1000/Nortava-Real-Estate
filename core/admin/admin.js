import { getAdminOverview, verifyLandlord, updateReportStatus, verifyAdminSession } from '../api/api.js';
import { showToast } from '../utils/toast.js';
import { logout } from '../auth/auth.js';
import { escapeHtml } from '../utils/sanitize.js';

window.logout = logout;
window.logoutAdmin = logout;

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

export async function loadUnverifiedLandlords() {
  const { data: overview, error } = await getAdminOverview();
  const container = document.getElementById('landlordsList');
  if (!container) return;

  if (error || !overview) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 2rem;">Unable to load landlords</p>';
    return;
  }

  const landlords = (overview.users || []).filter(u => u.role === 'landlord' && !u.verified);
  if (landlords.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 2rem;">No landlords pending verification</p>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Joined</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${landlords.map(landlord => `
          <tr>
            <td>${escapeHtml(landlord.name || 'N/A')}</td>
            <td>${escapeHtml(landlord.email)}</td>
            <td>${escapeHtml(landlord.phone || 'N/A')}</td>
            <td>${escapeHtml(new Date(landlord.created_at).toLocaleDateString())}</td>
            <td>
              <button type="button" class="btn btn-sm btn-success" data-verify-id="${escapeHtml(landlord.id)}">
                <i class="ri-check-line"></i> Verify
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('[data-verify-id]').forEach(btn => {
    btn.addEventListener('click', () => window.verifyLandlordAction(btn.dataset.verifyId));
  });
}

window.verifyLandlordAction = async function(userId) {
  const { error } = await verifyLandlord(userId);
  if (error) {
    showToast('Error', error.message || 'Failed to verify landlord', 'error');
    return;
  }
  showToast('Success', 'Landlord verified successfully', 'success');
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
