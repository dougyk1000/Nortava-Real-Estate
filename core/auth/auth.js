import { loginUser, registerUser, logoutUser, getCurrentUser, requestPasswordReset, verifyAdminSession } from '../api/api.js';
import { showToast } from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  setupLoginForm();
  setupForgotPassword();
  setupRegisterForm();
  setupRoleSelection();
  checkAuthRedirect();
});

// ---------------- LOGIN ----------------
function setupLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

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

    const { error } = await requestPasswordReset(email);
    if (error) {
      showToast('Reset Unavailable', error.message, 'error');
      return;
    }

    showToast('Reset Sent', 'If an account exists for that email, a password reset link has been sent.', 'success');
    modal.style.display = 'none';
    forgotForm.reset();
  });
}

// ---------------- REGISTER (WITH SERVER-SIDE COPPA & 18+ CHECK) ----------------
function setupRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

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
      showToast('Error', 'You must agree to the Terms of Service and Privacy Policy', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Error', 'Passwords do not match', 'error');
      return;
    }
    if (password.length < 8) {
      showToast('Error', 'Password must be at least 8 characters', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating account...';

    try {
      const { data, error } = await registerUser({
        email,
        password,
        name,
        role,
        phone,
        birthYear,
        birthMonth,
        termsAccepted
      });

      if (error) {
        showToast('Registration Blocked', error.message, 'error');
        return;
      }

      if (data?.requiresEmailConfirmation) {
        showToast('Verify Email', 'Account created! Please check your email to confirm before signing in.', 'success');
        setTimeout(() => {
          window.location.href = '/auth/login.html';
        }, 1500);
        return;
      }

      showToast('Success', 'Account created successfully!', 'success');
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
      if (radio) radio.checked = true;
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
  const isAuthPage =
    window.location.pathname.includes('/auth/') ||
    window.location.pathname.endsWith('/login.html') ||
    window.location.pathname.endsWith('/register.html');

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