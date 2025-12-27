import { getAdminStats, getAllUsers, verifyLandlord, getReports, updateReportStatus, getCurrentUser } from '../api/api.js';
import { showToast } from '../utils/toast.js';
import { logout } from '../auth/auth.js';

window.logout = logout;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== 'admin') {
      showToast('Access Denied', 'Admin access required', 'error');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
      return;
    }

    loadAdminDashboard();
  } catch (err) {
    console.error('Admin auth error:', err);
    showToast('Error', 'Failed to load admin dashboard', 'error');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }
});

async function loadAdminDashboard() {
  const { data: stats } = await getAdminStats();
  
  const totalUsers = document.getElementById('totalUsers');
  const totalListings = document.getElementById('totalListings');
  const totalPayments = document.getElementById('totalPayments');
  const pendingReports = document.getElementById('pendingReports');

  if (totalUsers) totalUsers.textContent = stats?.totalUsers || 0;
  if (totalListings) totalListings.textContent = stats?.totalListings || 0;
  if (totalPayments) totalPayments.textContent = stats?.totalUnlocks || 0;
  if (pendingReports) pendingReports.textContent = stats?.pendingReports || 0;
}

export async function loadUnverifiedLandlords() {
  const { data: users } = await getAllUsers();
  const landlords = users?.filter(u => u.role === 'landlord' && !u.verified) || [];
  
  const container = document.getElementById('landlordsList');
  if (!container) return;

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
            <td>${landlord.name || 'N/A'}</td>
            <td>${landlord.email}</td>
            <td>${landlord.phone || 'N/A'}</td>
            <td>${new Date(landlord.created_at).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-sm btn-success" onclick="verifyLandlordAction('${landlord.id}')">
                <i class="ri-check-line"></i> Verify
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.verifyLandlordAction = async function(userId) {
  const { error } = await verifyLandlord(userId);
  
  if (error) {
    showToast('Error', 'Failed to verify landlord', 'error');
    return;
  }
  
  showToast('Success', 'Landlord verified successfully', 'success');
  loadUnverifiedLandlords();
};

export async function loadReports() {
  const { data: reports } = await getReports();
  
  const container = document.getElementById('reportsList');
  if (!container) return;

  if (!reports || reports.length === 0) {
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
            <td>${report.reason}</td>
            <td>${report.listings?.title || 'N/A'}</td>
            <td>${report.users?.name || 'Anonymous'}</td>
            <td>${new Date(report.created_at).toLocaleDateString()}</td>
            <td><span class="badge badge-${report.status === 'pending' ? 'warning' : 'success'}">${report.status}</span></td>
            <td>
              ${report.status === 'pending' ? `
                <button class="btn btn-sm btn-success" onclick="resolveReport('${report.id}')">
                  <i class="ri-check-line"></i> Resolve
                </button>
              ` : '-'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.resolveReport = async function(reportId) {
  const { error } = await updateReportStatus(reportId, 'resolved');
  
  if (error) {
    showToast('Error', 'Failed to resolve report', 'error');
    return;
  }
  
  showToast('Success', 'Report resolved', 'success');
  loadReports();
};

if (window.location.pathname.includes('verify-landlords')) {
  loadUnverifiedLandlords();
}

if (window.location.pathname.includes('reports')) {
  loadReports();
}
