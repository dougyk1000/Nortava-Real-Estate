import { getCurrentUser as fetchCurrentUser, verifyAdminSession } from '../api/api.js';
import { escapeHtml } from './sanitize.js';

export function initNavigation() {
  setupMobileMenu();
  setupScrollEffect();
  highlightCurrentPage();
}

function buildFallbackMobileNav() {
  const nav = document.createElement('nav');
  nav.className = 'mobile-nav';
  nav.setAttribute('aria-label', 'Mobile navigation');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mobile-nav-close';
  closeBtn.setAttribute('aria-label', 'Close menu');
  closeBtn.innerHTML = '<i class="ri-close-line"></i>';
  nav.appendChild(closeBtn);

  const list = document.createElement('ul');
  list.className = 'mobile-nav-links';

  const existingLinks = document.querySelectorAll('.nav-links a, .sidebar-menu a');
  const seenHrefs = new Set();
  existingLinks.forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href === '#' || seenHrefs.has(href)) return;
    seenHrefs.add(href);
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    link.className = 'nav-link';
    link.textContent = a.textContent.trim();
    li.appendChild(link);
    list.appendChild(li);
  });
  nav.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'mobile-nav-actions';
  const hasLoginBtn = Boolean(document.querySelector('.nav-actions a[href*="login.html"]'));
  if (hasLoginBtn) {
    actions.innerHTML = `
      <a href="/auth/login.html" class="btn btn-secondary btn-lg">Login</a>
      <a href="/auth/register.html" class="btn btn-primary btn-lg">Get Started</a>
    `;
  } else {
    actions.innerHTML = `
      <button type="button" onclick="logout()" class="btn btn-secondary btn-lg"><i class="ri-logout-box-line"></i> Logout</button>
    `;
  }
  nav.appendChild(actions);

  document.body.appendChild(nav);
  return nav;
}

function setupMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  if (!menuBtn) return;

  let mobileNav = document.querySelector('.mobile-nav');
  if (!mobileNav) {
    mobileNav = buildFallbackMobileNav();
  }
  const closeBtn = mobileNav.querySelector('.mobile-nav-close');

  function closeMobileNav() {
    mobileNav.classList.remove('active');
    document.body.style.overflow = '';
  }

  menuBtn.addEventListener('click', () => {
    mobileNav.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  closeBtn?.addEventListener('click', closeMobileNav);

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
      closeMobileNav();
    }
  });
}

function setupScrollEffect() {
  const header = document.querySelector('.header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

function highlightCurrentPage() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link, .sidebar-link');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '/' && href === '/')) {
      link.classList.add('active');
    }
  });
}

export function getCachedUser() {
  try {
    const userData = localStorage.getItem('nortava-user');
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
}

export async function updateNavForAuth() {
  const user = await fetchCurrentUser();
  const navActions = document.querySelector('.nav-actions');
  const mobileActions = document.querySelector('.mobile-nav-actions');
  const navLinks = document.querySelector('.nav-links');
  const mobileLinks = document.querySelector('.mobile-nav-links');

  if (!user) return;

  let role = user.role || 'tenant';
  if (role === 'admin') {
    const adminCheck = await verifyAdminSession();
    if (!adminCheck?.isAdmin) role = 'tenant';
  }

  const dashboardLink =
    role === 'admin'
      ? '/admin/index.html'
      : role === 'landlord'
      ? '/dashboard/landlord.html'
      : '/dashboard/tenant.html';

  const safeRoleLabel = escapeHtml(role.charAt(0).toUpperCase() + role.slice(1) + ' Dashboard');

  if (navActions && navActions.querySelector('a[href*="login.html"]')) {
    navActions.innerHTML = `
      <button type="button" class="theme-toggle" aria-label="Toggle theme">
        <i class="ri-moon-line"></i>
      </button>
      <div class="user-menu" style="display: flex; gap: 1rem; align-items: center;">
        <a href="${dashboardLink}" class="btn btn-ghost">
          <i class="ri-dashboard-line"></i> Dashboard
        </a>
        <button type="button" onclick="logout()" class="btn btn-outline" style="padding: 0.5rem 1rem;">
          <i class="ri-logout-box-line"></i> Logout
        </button>
      </div>
    `;
    window.nortava?.theme?.setupThemeToggle?.();
    window.nortava?.theme?.syncThemeIcons?.();
  }

  if (mobileActions && mobileActions.querySelector('a[href*="login.html"]')) {
    mobileActions.innerHTML = `
      <a href="${dashboardLink}" class="btn btn-primary btn-lg">${safeRoleLabel}</a>
      <button type="button" onclick="logout()" class="btn btn-secondary btn-lg">Logout</button>
    `;
  }

  if (navLinks && !navLinks.querySelector(`a[href="${dashboardLink}"]`) && !navLinks.querySelector('a[href*="dashboard"]')) {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${dashboardLink}" class="nav-link">Dashboard</a>`;
    navLinks.appendChild(li);
  }

  if (mobileLinks && !mobileLinks.querySelector(`a[href="${dashboardLink}"]`) && !mobileLinks.querySelector('a[href*="dashboard"]')) {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${dashboardLink}" class="nav-link">Dashboard</a>`;
    mobileLinks.appendChild(li);
  }
}
