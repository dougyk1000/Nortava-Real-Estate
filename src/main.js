import { initTheme, setupThemeToggle } from './utils/theme.js';
import { initNavigation, updateNavForAuth } from './utils/navigation.js';
import { initChatbot } from './chatbot/chatbot.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupThemeToggle();
  initNavigation();
  updateNavForAuth();
  initChatbot();
  
  observeAnimations();
});

function observeAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.card, .feature-card, .step-card, .stat-card').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

window.nortava = {
  theme: { initTheme, setupThemeToggle },
  navigation: { initNavigation }
};
