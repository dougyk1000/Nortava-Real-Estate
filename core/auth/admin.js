// Admin authentication and verification module

const ADMIN_CREDENTIALS = {
  email: 'douglasnkowo3036@gmail.com',
  password: '#Br@@115g00d0145'
};

export function isValidAdminCredentials(email, password) {
  return email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password;
}

export function getAdminSession() {
  const session = localStorage.getItem('nortava-admin-session');
  if (!session) return null;
  return JSON.parse(session);
}

export function setAdminSession(userId, email) {
  const session = {
    userId,
    email,
    accessLevel: 'admin',
    loginTime: new Date().toISOString()
  };
  localStorage.setItem('nortava-admin-session', JSON.stringify(session));
  return session;
}

export function clearAdminSession() {
  localStorage.removeItem('nortava-admin-session');
}

export function isAdminLoggedIn() {
  return !!getAdminSession();
}

export function requireAdminAccess() {
  if (!isAdminLoggedIn()) {
    window.location.href = '/admin-login.html';
    return false;
  }
  return true;
}

export function checkAdminPage() {
  if (window.location.pathname.includes('/admin/') && !isAdminLoggedIn()) {
    window.location.href = '/admin-login.html';
  }
}

// Auto-check on page load
document.addEventListener('DOMContentLoaded', checkAdminPage);
