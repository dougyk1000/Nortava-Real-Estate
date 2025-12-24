// Smart Notifications System
// Alerts for landlords and tenants

import { getCurrentUser } from '../api/api.js';

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
    timestamp: new Date(),
    read: false
  };

  notifications.unshift(notification);
  localStorage.setItem('nortava-notifications', JSON.stringify(notifications));
  
  return notification;
}

export function getNotifications(userId, limit = 10) {
  return notifications
    .filter(n => n.userId === userId)
    .slice(0, limit);
}

export function markAsRead(notificationId) {
  const notif = notifications.find(n => n.id === notificationId);
  if (notif) {
    notif.read = true;
    localStorage.setItem('nortava-notifications', JSON.stringify(notifications));
  }
}

export function renderNotificationBell(unreadCount) {
  return `
    <button class="notification-bell" aria-label="Notifications" onclick="openNotifications()">
      <i class="ri-notification-2-line"></i>
      ${unreadCount > 0 ? `<span class="notification-badge">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
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

  const messages = {
    new_unlock: `Someone unlocked your listing: <strong>${notification.data.listingTitle}</strong>`,
    listing_view: `Your listing <strong>${notification.data.listingTitle}</strong> was viewed`,
    saved_search_match: `New property matches your saved search: <strong>${notification.data.propertyTitle}</strong>`,
    landlord_verification: `Your landlord account has been <strong>${notification.data.tier || 'verified'}</strong>`,
    property_comparison: `You compared <strong>${notification.data.count}</strong> properties`,
    price_change: `Price updated for <strong>${notification.data.listingTitle}</strong>`
  };

  const timeAgo = getTimeAgo(notification.timestamp);

  return `
    <div class="notification-item ${notification.read ? '' : 'unread'}" onclick="markNotificationRead('${notification.id}')">
      <div class="notification-icon">
        <i class="${icons[notification.type] || 'ri-notification-line'}"></i>
      </div>
      <div class="notification-content">
        <p>${messages[notification.type] || 'You have a new notification'}</p>
        <small class="notification-time">${timeAgo}</small>
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
  // Initialize notifications from localStorage
  const stored = localStorage.getItem('nortava-notifications');
  if (stored) {
    notifications = JSON.parse(stored);
  }

  // Auto-notify on saved search matches
  document.addEventListener('listingLoaded', async (e) => {
    const user = await getCurrentUser();
    if (user?.role === 'tenant') {
      // Check if listing matches saved searches
      await checkSavedSearchMatches(e.detail.listing, user.id);
    }
  });

  // Auto-notify on listing unlocks
  document.addEventListener('unlockCreated', async (e) => {
    await createNotification(notificationTypes.NEW_UNLOCK, {
      listingTitle: e.detail.listingTitle,
      unlockAmount: e.detail.amount
    });
  });
}

async function checkSavedSearchMatches(listing, userId) {
  // This would check against user's saved searches
  // For now, just a placeholder
}

export function initNotificationCenter() {
  const bell = document.querySelector('.notification-bell');
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

function showNotificationPanel(notifications, unreadCount) {
  let panel = document.getElementById('notificationPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'notification-panel card';
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="notification-header">
      <h3>Notifications <span class="badge" style="background: var(--primary);">${unreadCount}</span></h3>
      <button onclick="closeNotifications()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
        <i class="ri-close-line"></i>
      </button>
    </div>
    <div class="notification-list">
      ${notifications.length === 0 
        ? '<p style="padding: 2rem; text-align: center; color: var(--text-secondary);">No notifications yet</p>'
        : notifications.map(n => renderNotificationItem(n)).join('')
      }
    </div>
  `;

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
  openNotifications();
};
