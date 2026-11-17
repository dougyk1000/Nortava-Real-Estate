// Smart Notifications System
import { getCurrentUser } from '../api/api.js';
import { escapeHtml } from '../utils/sanitize.js';

export const notificationTypes = {
  NEW_UNLOCK: 'new_unlock',
  LISTING_VIEW: 'listing_view',
  SAVED_SEARCH_MATCH: 'saved_search_match',
  LANDLORD_VERIFICATION: 'landlord_verification',
  PROPERTY_COMPARISON: 'property_comparison',
  PRICE_CHANGE: 'price_change'
};

let notifications = [];

export async function createNotification(type, data) {
  const user = await getCurrentUser();
  if (!user) return;

  const notification = {
    id: `notif-${Date.now()}`,
    userId: user.id,
    type,
    data,
    timestamp: new Date().toISOString(),
    read: false
  };

  notifications.unshift(notification);
  try {
    localStorage.setItem('nortava-notifications', JSON.stringify(notifications.slice(0, 50)));
  } catch {
    // Ignore storage error
  }

  return notification;
}

export function getNotifications(userId, limit = 10) {
  return notifications.filter(n => n.userId === userId).slice(0, limit);
}

export function markAsRead(notificationId) {
  const notif = notifications.find(n => n.id === notificationId);
  if (notif) {
    notif.read = true;
    try {
      localStorage.setItem('nortava-notifications', JSON.stringify(notifications));
    } catch {
      // Ignore
    }
  }
}

export function renderNotificationBell(unreadCount) {
  return `
    <button type="button" class="notification-bell" aria-label="Notifications" onclick="openNotifications()">
      <i class="ri-notification-2-line"></i>
      ${unreadCount > 0 ? `<span class="notification-badge">${unreadCount > 9 ? '9+' : escapeHtml(unreadCount)}</span>` : ''}
    </button>
  `;
}

export function renderNotificationItem(notification) {
  const icons = {
    new_unlock: 'ri-lock-unlock-line',
    listing_view: 'ri-eye-line',
    saved_search_match: 'ri-search-line',
    landlord_verification: 'ri-verified-badge-fill',
    property_comparison: 'ri-layout-grid-line',
    price_change: 'ri-trending-up-line'
  };

  const d = notification.data || {};
  const messages = {
    new_unlock: `Someone unlocked your listing: <strong>${escapeHtml(d.listingTitle || '')}</strong>`,
    listing_view: `Your listing <strong>${escapeHtml(d.listingTitle || '')}</strong> was viewed`,
    saved_search_match: `New property matches your saved search: <strong>${escapeHtml(d.propertyTitle || '')}</strong>`,
    landlord_verification: `Your landlord account has been <strong>${escapeHtml(d.tier || 'verified')}</strong>`,
    property_comparison: `You compared <strong>${escapeHtml(d.count || 0)}</strong> properties`,
    price_change: `Price updated for <strong>${escapeHtml(d.listingTitle || '')}</strong>`
  };

  const timeAgo = getTimeAgo(new Date(notification.timestamp));

  return `
    <div class="notification-item ${notification.read ? '' : 'unread'}" data-notif-id="${escapeHtml(notification.id)}">
      <div class="notification-icon">
        <i class="${icons[notification.type] || 'ri-notification-line'}"></i>
      </div>
      <div class="notification-content">
        <p>${messages[notification.type] || 'You have a new notification'}</p>
        <small class="notification-time">${escapeHtml(timeAgo)}</small>
      </div>
      ${!notification.read ? '<div class="notification-dot"></div>' : ''}
    </div>
  `;
}

export function getTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function setupSmartNotifications() {
  try {
    const stored = localStorage.getItem('nortava-notifications');
    if (stored) {
      notifications = JSON.parse(stored);
    }
  } catch {
    notifications = [];
  }

  document.addEventListener('unlockCreated', async (e) => {
    await createNotification(notificationTypes.NEW_UNLOCK, {
      listingTitle: e.detail?.listingTitle,
      unlockAmount: e.detail?.amount
    });
  });
}

export function initNotificationCenter() {
  const bell = document.getElementById('notifBtn') || document.querySelector('.notification-bell');
  if (!bell) return;

  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    const user = await getCurrentUser();
    if (!user) return;

    const notifs = getNotifications(user.id);
    const unread = notifs.filter(n => !n.read);
    showNotificationPanel(notifs, unread.length);
  });
}

function showNotificationPanel(list, unreadCount) {
  let panel = document.getElementById('notificationPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'notification-panel card';
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="notification-header">
      <h3>Notifications <span class="badge" style="background: var(--primary);">${escapeHtml(unreadCount)}</span></h3>
      <button type="button" id="closeNotifPanelBtn" aria-label="Close notifications" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
        <i class="ri-close-line"></i>
      </button>
    </div>
    <div class="notification-list">
      ${list.length === 0
        ? '<p style="padding: 2rem; text-align: center; color: var(--text-secondary);">No notifications yet</p>'
        : list.map(n => renderNotificationItem(n)).join('')
      }
    </div>
  `;

  panel.querySelector('#closeNotifPanelBtn')?.addEventListener('click', window.closeNotifications);
  panel.querySelectorAll('.notification-item[data-notif-id]').forEach(item => {
    item.addEventListener('click', () => {
      window.markNotificationRead(item.dataset.notifId);
    });
  });

  panel.style.display = 'block';
}

window.openNotifications = async function() {
  const user = await getCurrentUser();
  if (user) {
    const notifs = getNotifications(user.id);
    const unread = notifs.filter(n => !n.read).length;
    showNotificationPanel(notifs, unread);
  }
};

window.closeNotifications = function() {
  const panel = document.getElementById('notificationPanel');
  if (panel) panel.style.display = 'none';
};

window.markNotificationRead = function(id) {
  markAsRead(id);
  window.openNotifications();
};
