import {
  loginUser,
  registerUser,
  logoutUser,
  getCurrentUser,
  requestPasswordReset,
  resendConfirmationEmail,
  completePasswordRecoverySession,
  updateRecoveredPassword,
  onPasswordRecoveryState,
  verifyAdminSession
} from '../api/api.js';
import { showToast } from '../utils/toast.js';
import { initListingLocationPicker } from '../locations/locationSelector.js';
import { escapeHtml } from '../utils/sanitize.js';

let kycLocationPicker = null;
const MAX_DOC_BYTES = 8 * 1024 * 1024;
const ALLOWED_DOC_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

document.addEventListener('DOMContentLoaded', () => {
  setupLoginForm();
  setupForgotPassword();
  setupResetPasswordPage();
  setupKycLocationPicker();
  setupKycFileListeners();
  setupRoleSelection();
  setupRegisterForm();
  checkAuthRedirect();
});

function showLoginBanner({ tone = 'info', title = '', message = '', actionHtml = '' }) {
  const banner = document.getElementById('loginStatusBanner');
  if (!banner) return;

  const palette = {
    error: { bg: 'rgba(239, 68, 68, 0.08)', border: 'var(--danger)', color: 'var(--danger)' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'var(--warning)', color: 'var(--warning)' },
    success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'var(--success)', color: 'var(--success)' },
    info: { bg: 'rgba(37, 99, 235, 0.08)', border: 'var(--primary)', color: 'var(--primary)' }
  }[tone] || { bg: 'var(--bg-secondary)', border: 'var(--border)', color: 'var(--primary)' };

  banner.style.display = 'block';
  banner.style.background = palette.bg;
  banner.style.borderColor = palette.border;
  banner.innerHTML = `
    <div style="font-weight: 700; color: ${palette.color}; margin-bottom: 0.25rem;">${escapeHtml(title)}</div>
    <div style="color: var(--text-secondary);">${escapeHtml(message)}</div>
    ${actionHtml ? `<div style="margin-top: 0.65rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">${actionHtml}</div>` : ''}
  `;
}

// ---------------- LOGIN ----------------
function setupLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const urlType = (hashParams.get('type') || params.get('type') || '').toLowerCase();
  if (urlType === 'recovery') {
    window.location.replace(`/auth/reset-password.html${window.location.search}${window.location.hash}`);
    return;
  }

  const prefillEmail = params.get('email');
  if (prefillEmail && document.getElementById('email')) {
    document.getElementById('email').value = prefillEmail;
  }

  const urlAuthError =
    hashParams.get('error_description') ||
    params.get('error_description') ||
    hashParams.get('error') ||
    params.get('error');

  if (urlAuthError) {
    showLoginBanner({
      tone: 'warning',
      title: 'Verification or Reset Link Issue',
      message: `${urlAuthError}. You can request a fresh confirmation email or password reset link below.`,
      actionHtml: `
        <a href="/auth/reset-password.html" class="btn btn-sm btn-outline"><i class="ri-key-line"></i> Reset Password</a>
      `
    });
  } else if (params.get('reset') === '1') {
    showLoginBanner({
      tone: 'success',
      title: 'Password Updated',
      message: 'Your new password has been saved. Sign in below with your new password.'
    });
  } else if (params.get('confirmed') === '1') {
    showLoginBanner({
      tone: 'success',
      title: 'Email Confirmed',
      message: 'Your email address is confirmed! Enter your password below to sign in.'
    });
  } else if (params.get('registered') === '1') {
    showLoginBanner({
      tone: 'info',
      title: 'Check Your Email to Confirm Your Account',
      message: 'We asked our authentication provider to send a confirmation link to your email (check Inbox and Spam). If no email arrives, click below to resend or check your password.',
      actionHtml: `<button type="button" id="bannerResendBtn" class="btn btn-sm btn-outline"><i class="ri-mail-send-line"></i> Resend Confirmation Email</button>`
    });
    document.getElementById('bannerResendBtn')?.addEventListener('click', async () => {
      const targetEmail = document.getElementById('email')?.value.trim() || prefillEmail || '';
      if (!targetEmail) {
        showToast('Email Required', 'Enter your email address above first.', 'warning');
        return;
      }
      const btn = document.getElementById('bannerResendBtn');
      if (btn) btn.disabled = true;
      const { data, error } = await resendConfirmationEmail(targetEmail);
      if (btn) btn.disabled = false;
      if (error) {
        showLoginBanner({ tone: 'warning', title: 'Could Not Resend Email', message: error.message });
      } else {
        showLoginBanner({ tone: 'success', title: 'Confirmation Requested', message: data?.message || 'Confirmation email requested.' });
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Signing in...';

    try {
      const { error } = await loginUser(email, password);
      if (error) {
        showToast('Login Failed', error.message, 'error');

        if (error.code === 'EMAIL_NOT_CONFIRMED') {
          showLoginBanner({
            tone: 'warning',
            title: 'Email Not Confirmed Yet',
            message: 'Your account exists, but your email has not been confirmed yet. Check your Inbox/Spam folder or resend the confirmation email below.',
            actionHtml: `<button type="button" id="bannerResendBtn" class="btn btn-sm btn-primary"><i class="ri-mail-send-line"></i> Resend Confirmation Email</button>`
          });
          document.getElementById('bannerResendBtn')?.addEventListener('click', async () => {
            const btn = document.getElementById('bannerResendBtn');
            if (btn) btn.disabled = true;
            const { data: rData, error: rErr } = await resendConfirmationEmail(email);
            if (btn) btn.disabled = false;
            if (rErr) {
              showLoginBanner({ tone: 'error', title: 'Resend Failed', message: rErr.message });
            } else {
              showLoginBanner({ tone: 'success', title: 'Email Sent', message: rData?.message || 'Confirmation link requested.' });
            }
          });
        } else if (error.code === 'INVALID_CREDENTIALS') {
          showLoginBanner({
            tone: 'error',
            title: 'Incorrect Email or Password',
            message: 'The email or password did not match an active confirmed account. If you already registered earlier or forgot your password, reset it below — or check your Inbox if your new account still awaits email confirmation.',
            actionHtml: `
              <button type="button" id="bannerForgotBtn" class="btn btn-sm btn-outline"><i class="ri-key-line"></i> Reset Password</button>
              <button type="button" id="bannerResendBtn" class="btn btn-sm btn-ghost"><i class="ri-mail-send-line"></i> Resend Confirmation</button>
            `
          });
          document.getElementById('bannerForgotBtn')?.addEventListener('click', () => {
            const modal = document.getElementById('forgotPasswordModal');
            const resetInput = document.getElementById('resetEmail');
            if (resetInput && email) resetInput.value = email;
            if (modal) modal.style.display = 'flex';
          });
          document.getElementById('bannerResendBtn')?.addEventListener('click', async () => {
            const { data: rData, error: rErr } = await resendConfirmationEmail(email);
            if (rErr) {
              showToast('Resend Failed', rErr.message, 'error');
            } else {
              showToast('Confirmation Requested', rData?.message || 'Confirmation email requested.', 'success');
            }
          });
        } else {
          showLoginBanner({ tone: 'error', title: 'Sign In Error', message: error.message });
        }
        return;
      }

      showToast('Welcome Back', 'Login successful!', 'success');

      const adminCheck = await verifyAdminSession();
      if (adminCheck?.isAdmin) {
        redirectByRole('admin');
        return;
      }

      const user = await getCurrentUser();
      redirectByRole(user?.role || 'tenant');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ri-login-box-line"></i> Sign In';
    }
  });
}

// ---------------- FORGOT PASSWORD ----------------
function setupForgotPassword() {
  const forgotLink = document.getElementById('forgotPasswordLink');
  const modal = document.getElementById('forgotPasswordModal');
  const closeBtn = document.getElementById('closeForgotModal');
  const forgotForm = document.getElementById('forgotPasswordForm');

  if (!forgotLink || !modal) return;

  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    modal.style.display = 'flex';
  });

  closeBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetEmail')?.value.trim();
    if (!email) {
      showToast('Error', 'Please enter your email address', 'error');
      return;
    }

    const submitBtn = forgotForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    const { data, error } = await requestPasswordReset(email);
    if (submitBtn) submitBtn.disabled = false;

    if (error) {
      showToast('Reset Unavailable', error.message, 'error');
      return;
    }

    showToast('Reset Sent', data?.message || 'If an account exists for that email, a password reset link has been sent.', 'success');
    showLoginBanner({
      tone: 'success',
      title: 'Password Reset Email Requested',
      message: data?.message || 'Check your Inbox and Spam folder for your password reset link.'
    });
    modal.style.display = 'none';
    forgotForm.reset();
  });
}

// ---------------- DEDICATED RESET PASSWORD PAGE ----------------
function showResetBanner({ tone = 'info', title = '', message = '' }) {
  const banner = document.getElementById('resetStatusBanner');
  if (!banner) return;

  const palette = {
    error: { bg: 'rgba(239, 68, 68, 0.08)', border: 'var(--danger)', color: 'var(--danger)' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'var(--warning)', color: 'var(--warning)' },
    success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'var(--success)', color: 'var(--success)' },
    info: { bg: 'rgba(37, 99, 235, 0.08)', border: 'var(--primary)', color: 'var(--primary)' }
  }[tone] || { bg: 'var(--bg-secondary)', border: 'var(--border)', color: 'var(--primary)' };

  banner.style.display = 'block';
  banner.style.background = palette.bg;
  banner.style.borderColor = palette.border;
  banner.innerHTML = `
    <div style="font-weight: 700; color: ${palette.color}; margin-bottom: 0.25rem;">${escapeHtml(title)}</div>
    <div style="color: var(--text-secondary);">${escapeHtml(message)}</div>
  `;
}

async function setupResetPasswordPage() {
  const newPasswordForm = document.getElementById('newPasswordForm');
  const requestResetForm = document.getElementById('requestResetForm');
  if (!newPasswordForm && !requestResetForm) return;

  const setNewSection = document.getElementById('setNewPasswordSection');
  const requestSection = document.getElementById('requestResetSection');
  const heading = document.getElementById('resetPageHeading');
  const subheading = document.getElementById('resetPageSubheading');

  const activateSetNewPasswordMode = () => {
    if (setNewSection) setNewSection.style.display = 'block';
    if (requestSection) requestSection.style.display = 'none';
    if (heading) heading.textContent = 'Set New Password';
    if (subheading) subheading.textContent = 'Choose a strong password for your Nortava account';
    showResetBanner({
      tone: 'info',
      title: 'Recovery Link Verified',
      message: 'Enter and confirm your new password below.'
    });
  };

  onPasswordRecoveryState((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      activateSetNewPasswordMode();
    }
  });

  const recoveryResult = await completePasswordRecoverySession();
  if (recoveryResult.error) {
    if (setNewSection) setNewSection.style.display = 'none';
    if (requestSection) requestSection.style.display = 'block';
    showResetBanner({
      tone: 'error',
      title: 'Reset Link Invalid or Expired',
      message: `${recoveryResult.error.message} Request a fresh password reset link below.`
    });
  } else if (recoveryResult.ready) {
    activateSetNewPasswordMode();
  }

  newPasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';

    if (newPassword.length < 8) {
      showResetBanner({ tone: 'error', title: 'Weak Password', message: 'Password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showResetBanner({ tone: 'error', title: 'Password Mismatch', message: 'Both password fields must match.' });
      return;
    }

    const submitBtn = newPasswordForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner"></span> Updating Password...';
    }

    try {
      const { error } = await updateRecoveredPassword(newPassword);
      if (error) {
        showResetBanner({ tone: 'error', title: 'Could Not Update Password', message: error.message });
        showToast('Update Failed', error.message, 'error');
        return;
      }

      showToast('Password Updated', 'Your password has been updated. Please sign in.', 'success');
      showResetBanner({
        tone: 'success',
        title: 'Password Updated Successfully',
        message: 'Redirecting you to the Sign In page...'
      });
      setTimeout(() => {
        window.location.href = '/auth/login.html?reset=1';
      }, 1200);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ri-check-double-line"></i> Update Password';
      }
    }
  });

  requestResetForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetRequestEmail')?.value.trim() || '';
    if (!email) {
      showToast('Email Required', 'Please enter your email address.', 'error');
      return;
    }

    const submitBtn = requestResetForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner"></span> Sending Link...';
    }

    try {
      const { data, error } = await requestPasswordReset(email);
      if (error) {
        showResetBanner({ tone: 'error', title: 'Reset Request Failed', message: error.message });
        showToast('Reset Unavailable', error.message, 'error');
        return;
      }
      showResetBanner({
        tone: 'success',
        title: 'Reset Link Sent',
        message: data?.message || 'Check your Inbox and Spam folder for your reset link.'
      });
      showToast('Reset Sent', 'Password reset email requested.', 'success');
      requestResetForm.reset();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ri-mail-send-line"></i> Send Reset Link';
      }
    }
  });
}

// ---------------- KYC LOCATION & FILE HELPERS ----------------
function setupKycLocationPicker() {
  const provinceEl = document.getElementById('kycProvince');
  const cityEl = document.getElementById('kycCity');
  const areaEl = document.getElementById('kycArea');
  if (!provinceEl || !cityEl || !areaEl) return;

  kycLocationPicker = initListingLocationPicker({
    provinceEl,
    cityEl,
    areaEl,
    defaultProvince: 'Harare',
    defaultCity: 'Harare'
  });
}

function setupKycFileListeners() {
  const pairs = [
    ['titleDeedFile', 'titleDeedStatus'],
    ['nationalIdFile', 'nationalIdStatus'],
    ['ratesBillFile', 'ratesBillStatus']
  ];
  pairs.forEach(([inputId, statusId]) => {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    input?.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        if (status) status.textContent = '';
        return;
      }
      if (!ALLOWED_DOC_TYPES.has(file.type)) {
        if (status) {
          status.textContent = 'Invalid file format. Please upload PDF, JPG, PNG, or WebP.';
          status.style.color = 'var(--danger)';
        }
        input.value = '';
        return;
      }
      if (file.size > MAX_DOC_BYTES) {
        if (status) {
          status.textContent = 'File exceeds 8MB maximum limit.';
          status.style.color = 'var(--danger)';
        }
        input.value = '';
        return;
      }
      if (status) {
        status.textContent = `Ready: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
        status.style.color = 'var(--success)';
      }
    });
  });
}

export function readDocumentAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!ALLOWED_DOC_TYPES.has(file.type)) {
      return reject(new Error(`${file.name}: Only PDF, JPG, PNG, or WebP documents are allowed.`));
    }
    if (file.size > MAX_DOC_BYTES) {
      return reject(new Error(`${file.name}: File must be under 8MB.`));
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        fileName: file.name,
        mimeType: file.type,
        dataBase64: String(reader.result || '')
      });
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function syncLandlordKycVisibility(role) {
  const kycSection = document.getElementById('landlordKycSection');
  const phoneInput = document.getElementById('phone');
  const phoneTag = document.getElementById('phoneRequiredTag');
  const isLandlord = role === 'landlord';

  if (kycSection) {
    kycSection.style.display = isLandlord ? 'block' : 'none';
  }
  if (phoneInput) {
    phoneInput.required = isLandlord;
  }
  if (phoneTag) {
    phoneTag.textContent = isLandlord
      ? '(Required for landlord verification & tenant inquiries)'
      : '(Optional for tenants, required for landlords)';
  }

  ['nationalIdNumber', 'ownershipCapacity', 'kycProvince', 'kycCity', 'kycArea', 'propertyAddress', 'titleDeedFile', 'nationalIdFile', 'antiFraudAttested']
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.required = isLandlord;
    });
}

// ---------------- REGISTER (WITH COPPA, 18+ CHECK & LANDLORD KYC) ----------------
function setupRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  const initialRole = document.querySelector('input[name="role"]:checked')?.value || 'tenant';
  syncLandlordKycVisibility(initialRole);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const birthMonth = Number(document.getElementById('birthMonth')?.value);
    const birthYear = Number(document.getElementById('birthYear')?.value);
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const roleInput = document.querySelector('input[name="role"]:checked');
    const role = roleInput ? roleInput.value : 'tenant';
    const termsAccepted = Boolean(document.getElementById('terms')?.checked);
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!birthMonth || !birthYear) {
      showToast('Age Verification Required', 'Please select your birth month and year.', 'error');
      return;
    }
    if (!termsAccepted) {
      showToast('Terms Required', 'You must agree to the Terms of Service and Privacy Policy.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Password Mismatch', 'Passwords do not match.', 'error');
      return;
    }
    if (password.length < 8) {
      showToast('Weak Password', 'Password must be at least 8 characters.', 'error');
      return;
    }

    let landlordKyc = null;
    if (role === 'landlord') {
      if (phone.length < 7) {
        showToast('Phone Required', 'Landlords must enter a valid Zimbabwe contact phone number.', 'error');
        return;
      }
      const nationalIdNumber = document.getElementById('nationalIdNumber')?.value.trim() || '';
      const ownershipCapacity = document.getElementById('ownershipCapacity')?.value || 'owner';
      const propertyProvince = document.getElementById('kycProvince')?.value || kycLocationPicker?.getValues()?.province || '';
      const propertyCity = document.getElementById('kycCity')?.value || kycLocationPicker?.getValues()?.city || '';
      const propertyArea = document.getElementById('kycArea')?.value || kycLocationPicker?.getValues()?.area || '';
      const propertyAddress = document.getElementById('propertyAddress')?.value.trim() || '';
      const antiFraudAttested = Boolean(document.getElementById('antiFraudAttested')?.checked);
      const titleDeedFile = document.getElementById('titleDeedFile')?.files?.[0] || null;
      const nationalIdFile = document.getElementById('nationalIdFile')?.files?.[0] || null;
      const ratesBillFile = document.getElementById('ratesBillFile')?.files?.[0] || null;

      if (!nationalIdNumber || !propertyProvince || !propertyCity || !propertyAddress) {
        showToast('Verification Details Missing', 'Please provide your Zimbabwe National ID and property location details.', 'error');
        return;
      }
      if (!titleDeedFile || !nationalIdFile) {
        showToast('Documents Required', 'Please upload both your Title Deed/Cession and your Zimbabwe National ID copy.', 'error');
        return;
      }
      if (!antiFraudAttested) {
        showToast('Declaration Required', 'Please affirm the anti-fraud & legal ownership declaration.', 'error');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Preparing verification documents...';
        const [titleDeedDoc, nationalIdDoc, ratesBillDoc] = await Promise.all([
          readDocumentAsBase64(titleDeedFile),
          readDocumentAsBase64(nationalIdFile),
          readDocumentAsBase64(ratesBillFile)
        ]);
        landlordKyc = {
          nationalIdNumber,
          ownershipCapacity,
          propertyProvince,
          propertyCity,
          propertyArea,
          propertyAddress,
          antiFraudAttested,
          titleDeedDoc,
          nationalIdDoc,
          ratesBillDoc
        };
      } catch (fileErr) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ri-user-add-line"></i> Create Account';
        showToast('Document Error', fileErr.message || 'Unable to read verification files.', 'error');
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = role === 'landlord'
      ? '<span class="loading-spinner"></span> Submitting & Screening Documents...'
      : '<span class="loading-spinner"></span> Creating account...';

    try {
      const { data, error } = await registerUser({
        email,
        password,
        name,
        role,
        phone,
        birthYear,
        birthMonth,
        termsAccepted,
        landlordKyc
      });

      if (error) {
        const isAgeBlock = error.code === 'COPPA_UNDER_13' || error.code === 'MINIMUM_AGE_REQUIRED';
        showToast(isAgeBlock ? 'Age Verification' : 'Registration Failed', error.message, 'error');
        return;
      }

      if (data?.requiresEmailConfirmation) {
        const msg = role === 'landlord'
          ? 'Account & ownership documents submitted! Confirm your email while AI & Admin verify your Title Deeds.'
          : 'Account created! Please check your email to confirm before signing in.';
        showToast('Verify Email', msg, 'success');
        setTimeout(() => {
          window.location.href = `/auth/login.html?registered=1&email=${encodeURIComponent(email)}`;
        }, 1800);
        return;
      }

      showToast(
        'Success',
        role === 'landlord'
          ? 'Account created! Your Title Deed & ID documents are now in AI & Admin review.'
          : 'Account created successfully!',
        'success'
      );
      redirectByRole(role);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ri-user-add-line"></i> Create Account';
    }
  });
}

// ---------------- ROLE SELECTION ----------------
function setupRoleSelection() {
  const roleOptions = document.querySelectorAll('.role-option');
  roleOptions.forEach(option => {
    option.addEventListener('click', () => {
      roleOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      const radio = option.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        syncLandlordKycVisibility(radio.value);
      }
    });
  });
}

// ---------------- REDIRECT BY ROLE ----------------
function redirectByRole(role) {
  if (!role) return;

  const roleMap = {
    landlord: '/dashboard/landlord.html',
    tenant: '/dashboard/tenant.html',
    admin: '/admin/index.html'
  };

  const target = roleMap[role] || '/';
  setTimeout(() => {
    window.location.href = target;
  }, 800);
}

// ---------------- CHECK IF LOGGED IN ----------------
async function checkAuthRedirect() {
  const path = window.location.pathname;
  if (path.endsWith('/auth/reset-password.html')) return;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  const flowType = (hashParams.get('type') || queryParams.get('type') || '').toLowerCase();
  if (flowType === 'recovery') return;

  const isAuthPage =
    path.includes('/auth/') ||
    path.endsWith('/login.html') ||
    path.endsWith('/register.html');

  if (!isAuthPage) return;

  const user = await getCurrentUser();
  if (!user) return;

  const adminCheck = await verifyAdminSession();
  const role = adminCheck?.isAdmin ? 'admin' : user.role;
  redirectByRole(role);
}

// ---------------- LOGOUT ----------------
export async function logout() {
  await logoutUser();
  showToast('Logged Out', 'You have been signed out', 'success');
  window.location.href = '/';
}

window.logout = logout;