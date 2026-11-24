import { initTheme, toggleTheme, setupThemeToggle, syncThemeIcons } from './utils/theme.js';
import { initConsentManager } from './utils/consent.js';
import { initNavigation, updateNavForAuth } from './utils/navigation.js';
import { initChatbot } from './chatbot/chatbot.js';
import { logoutUser } from './api/api.js';
import { showToast } from './utils/toast.js';

export async function globalLogout() {
  await logoutUser();
  showToast('Logged Out', 'You have been signed out safely.', 'success');
  setTimeout(() => {
    window.location.href = '/';
  }, 400);
}

window.logout = globalLogout;
window.logoutAdmin = globalLogout;

function routeIncomingAuthCallback() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  const type = (hashParams.get('type') || queryParams.get('type') || '').toLowerCase();
  const hasAuthToken = Boolean(
    hashParams.get('access_token') ||
    queryParams.get('token_hash') ||
    queryParams.get('code')
  );
  const hasAuthError = Boolean(
    hashParams.get('error_description') ||
    queryParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error')
  );

  const path = window.location.pathname;
  if (type === 'recovery' && !path.endsWith('/auth/reset-password.html')) {
    window.location.replace(`/auth/reset-password.html${window.location.search}${window.location.hash}`);
    return true;
  }

  const isRootPage = path === '/' || path === '/index.html';
  if (isRootPage && (type === 'signup' || type === 'email_change' || hasAuthToken || hasAuthError)) {
    window.location.replace(`/auth/login.html${window.location.search}${window.location.hash}`);
    return true;
  }

  return false;
}

function bootNortavaApp() {
  if (routeIncomingAuthCallback()) return;

  initConsentManager();
  initTheme();
  setupThemeToggle();
  initNavigation();
  updateNavForAuth();
  initChatbot();

  observeAnimations();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootNortavaApp);
} else {
  bootNortavaApp();
}

function observeAnimations() {
  const cards = document.querySelectorAll('.card, .feature-card, .step-card, .stat-card');
  if (!('IntersectionObserver' in window)) {
    cards.forEach(el => { el.style.opacity = '1'; });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        entry.target.style.opacity = '1';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  cards.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      el.style.opacity = '1';
    } else {
      el.style.opacity = '0';
      observer.observe(el);
    }
  });
}

window.nortava = {
  theme: { initTheme, toggleTheme, setupThemeToggle, syncThemeIcons },
  navigation: { initNavigation },
  logout: globalLogout
};
