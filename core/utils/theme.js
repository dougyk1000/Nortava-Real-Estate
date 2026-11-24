import { hasConsent } from './consent.js';

const THEME_KEY = 'nortava-theme';
let themeDelegationBound = false;

function readSavedTheme() {
  if (hasConsent('preferences')) {
    try {
      const persisted = localStorage.getItem(THEME_KEY);
      if (persisted === 'dark' || persisted === 'light') return persisted;
    } catch {
      // Ignore storage error
    }
  }
  try {
    const sessionTheme = sessionStorage.getItem(THEME_KEY);
    if (sessionTheme === 'dark' || sessionTheme === 'light') return sessionTheme;
  } catch {
    // Ignore storage error
  }
  return null;
}

function persistTheme(theme) {
  try {
    sessionStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore sessionStorage error
  }
  if (hasConsent('preferences')) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore localStorage error
    }
  }
}

export function syncThemeIcons(theme = document.documentElement.getAttribute('data-theme') || 'light') {
  const isDark = theme === 'dark';
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(isDark));
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isDark ? 'ri-sun-line' : 'ri-moon-line';
    }
  });
}

export function initTheme() {
  const savedTheme = readSavedTheme();
  const prefersDark = Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');

  document.documentElement.setAttribute('data-theme', theme);
  syncThemeIcons(theme);
}

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  persistTheme(newTheme);
  syncThemeIcons(newTheme);
}

export function setupThemeToggle() {
  if (!themeDelegationBound) {
    document.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.theme-toggle');
      if (!btn) return;
      e.preventDefault();
      toggleTheme();
    });
    themeDelegationBound = true;
  }
  syncThemeIcons();
}
