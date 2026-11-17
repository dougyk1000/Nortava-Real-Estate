import { hasConsent } from './consent.js';

export function initTheme() {
  let savedTheme = null;
  if (hasConsent('preferences')) {
    try {
      savedTheme = localStorage.getItem('nortava-theme');
    } catch {
      savedTheme = null;
    }
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');

  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  if (hasConsent('preferences')) {
    try {
      localStorage.setItem('nortava-theme', newTheme);
    } catch {
      // Ignore storage error
    }
  }
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    if (icon) {
      icon.className = theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line';
    }
  }
}

export function setupThemeToggle() {
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}
