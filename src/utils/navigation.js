export function initNavigation() {
  setupMobileMenu();
  setupScrollEffect();
  highlightCurrentPage();
}

function setupMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const mobileNav = document.querySelector('.mobile-nav');
  const closeBtn = document.querySelector('.mobile-nav-close');
  
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      mobileNav.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
    
    if (closeBtn) {
      closeBtn.addEventListener('click', closeMobileNav);
    }
    
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMobileNav);
    });
  }
  
  function closeMobileNav() {
    mobileNav.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function setupScrollEffect() {
  const header = document.querySelector('.header');
  if (!header) return;
  
  let lastScroll = 0;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    
    if (currentScroll > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
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

export function getCurrentUser() {
  const userData = localStorage.getItem('nortava-user');
  return userData ? JSON.parse(userData) : null;
}

export function updateNavForAuth() {
  const user = getCurrentUser();
  const authButtons = document.querySelector('.auth-buttons');
  const userMenu = document.querySelector('.user-menu');
  
  if (user && authButtons && userMenu) {
    authButtons.style.display = 'none';
    userMenu.style.display = 'flex';
    
    const userName = userMenu.querySelector('.user-name');
    if (userName) {
      userName.textContent = user.name || user.email;
    }
  }
}
