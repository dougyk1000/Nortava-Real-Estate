const CONSENT_STORAGE_KEY = 'nortava-consent';
const CONSENT_VERSION = '2026-11';

const DEFAULT_CONSENT = {
  essential: true,
  preferences: false,
  analytics: false,
  version: CONSENT_VERSION,
  updatedAt: null
};

let memoryConsent = null;

export function getConsent() {
  if (memoryConsent) return { ...memoryConsent };
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      essential: true,
      preferences: Boolean(parsed.preferences),
      analytics: Boolean(parsed.analytics),
      version: parsed.version || CONSENT_VERSION,
      updatedAt: parsed.updatedAt || null
    };
  } catch {
    return null;
  }
}

export function hasConsent(category) {
  if (category === 'essential') return true;
  const current = getConsent();
  if (!current) return false;
  return Boolean(current[category]);
}

export function saveConsent({ preferences = false, analytics = false }) {
  const next = {
    essential: true,
    preferences: Boolean(preferences),
    analytics: Boolean(analytics),
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString()
  };
  memoryConsent = next;

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    if (!next.preferences) {
      localStorage.removeItem('nortava-theme');
    }
  } catch {
    // Ignore storage quota / privacy mode errors; memoryConsent preserves choice for session
  }

  window.dispatchEvent(new CustomEvent('nortava:consentChanged', { detail: next }));
  return next;
}

export function resetConsent() {
  memoryConsent = null;
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    localStorage.removeItem('nortava-theme');
  } catch {
    // Ignore
  }
  window.dispatchEvent(new CustomEvent('nortava:consentChanged', { detail: { ...DEFAULT_CONSENT } }));
}

function removeBanner() {
  document.getElementById('nortavaConsentBanner')?.remove();
}

function removeModal() {
  document.getElementById('nortavaConsentModal')?.remove();
}

export function showConsentBanner() {
  if (document.getElementById('nortavaConsentBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'nortavaConsentBanner';
  banner.className = 'consent-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie and Privacy Preferences');

  banner.innerHTML = `
    <div class="consent-banner-text">
      <strong>Your Privacy Choices</strong>
      <span>
        We use essential storage for authentication and security. Optional preference storage (theme) and
        non-essential view analytics remain disabled unless you opt in. Session replay is disabled.
        See our <a href="/legal/cookies.html" style="color: var(--primary); text-decoration: underline;">Cookie Policy</a>
        and <a href="/legal/privacy.html" style="color: var(--primary); text-decoration: underline;">Privacy Policy</a>.
      </span>
    </div>
    <div class="consent-banner-actions">
      <button type="button" class="btn btn-outline btn-sm" id="consentCustomizeBtn">Customize</button>
      <button type="button" class="btn btn-secondary btn-sm" id="consentRejectBtn">Reject Non-Essential</button>
      <button type="button" class="btn btn-primary btn-sm" id="consentAcceptBtn">Accept All</button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('consentAcceptBtn')?.addEventListener('click', () => {
    saveConsent({ preferences: true, analytics: true });
    removeBanner();
  });

  document.getElementById('consentRejectBtn')?.addEventListener('click', () => {
    saveConsent({ preferences: false, analytics: false });
    removeBanner();
  });

  document.getElementById('consentCustomizeBtn')?.addEventListener('click', () => {
    openConsentModal();
  });
}

export function openConsentModal() {
  removeModal();
  const current = getConsent() || DEFAULT_CONSENT;

  const backdrop = document.createElement('div');
  backdrop.id = 'nortavaConsentModal';
  backdrop.className = 'consent-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Manage Privacy and Cookie Preferences');

  backdrop.innerHTML = `
    <div class="consent-modal">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0;">Privacy &amp; Cookie Settings</h3>
        <button type="button" id="consentModalClose" aria-label="Close" style="background: none; font-size: 1.5rem; color: var(--text-secondary);">
          <i class="ri-close-line"></i>
        </button>
      </div>
      <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
        Manage your consent preferences below. Non-essential tracking and session replay are disabled by default.
      </p>

      <div class="consent-option">
        <div>
          <h4>Essential Storage (Always Active)</h4>
          <p>Required for sign-in sessions, security controls, and remembering your consent choice.</p>
        </div>
        <input type="checkbox" checked disabled aria-label="Essential Storage always active">
      </div>

      <label class="consent-option" style="cursor: pointer;">
        <div>
          <h4>Preference Storage</h4>
          <p>Saves your light/dark theme choice across visits in browser storage.</p>
        </div>
        <input type="checkbox" id="consentPrefToggle" ${current.preferences ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary);">
      </label>

      <label class="consent-option" style="cursor: pointer;">
        <div>
          <h4>Optional Listing Analytics</h4>
          <p>Allows aggregated property view counting on listing detail pages. No session replay or ad tracking is used.</p>
        </div>
        <input type="checkbox" id="consentAnalyticsToggle" ${current.analytics ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary);">
      </label>

      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
        <button type="button" class="btn btn-secondary btn-sm" id="consentModalRejectAll">Reject Non-Essential</button>
        <button type="button" class="btn btn-primary btn-sm" id="consentModalSave">Save Preferences</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  document.getElementById('consentModalClose')?.addEventListener('click', removeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) removeModal();
  });

  document.getElementById('consentModalRejectAll')?.addEventListener('click', () => {
    saveConsent({ preferences: false, analytics: false });
    removeModal();
    removeBanner();
  });

  document.getElementById('consentModalSave')?.addEventListener('click', () => {
    const preferences = Boolean(document.getElementById('consentPrefToggle')?.checked);
    const analytics = Boolean(document.getElementById('consentAnalyticsToggle')?.checked);
    saveConsent({ preferences, analytics });
    removeModal();
    removeBanner();
  });
}

function ensureFooterLegalLinks() {
  document.querySelectorAll('.footer-legal').forEach(footerLegal => {
    if (!footerLegal.querySelector('a[href*="dmca.html"]')) {
      const dmcaLink = document.createElement('a');
      dmcaLink.href = '/legal/dmca.html';
      dmcaLink.textContent = 'DMCA';
      footerLegal.appendChild(dmcaLink);
    }

    if (!footerLegal.querySelector('.cookie-settings-trigger')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cookie-settings-trigger';
      btn.textContent = 'Cookie Settings';
      btn.style.cssText = 'background: none; border: none; padding: 0; color: inherit; font: inherit; cursor: pointer;';
      btn.addEventListener('click', openConsentModal);
      footerLegal.appendChild(btn);
    }
  });
}

export function initConsentManager() {
  ensureFooterLegalLinks();
  if (!getConsent()) {
    showConsentBanner();
  }
}

window.nortavaConsent = {
  getConsent,
  hasConsent,
  saveConsent,
  resetConsent,
  openSettings: openConsentModal
};
