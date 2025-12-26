import { loginUser, registerUser, logoutUser, getCurrentUser } from '../api/api.js';
import { showToast } from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  setupLoginForm();
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
      const { data, error } = await loginUser(email, password);
      if (error) return showToast('Login Failed', error.message, 'error');
      
      showToast('Welcome Back', 'Login successful!', 'success');
      
      const user = await getCurrentUser();
      // Check if user is admin
      const adminEmail = 'douglasnkowo3036@gmail.com';
      const role = email === adminEmail ? 'admin' : user?.role;
      redirectByRole(role);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ri-login-box-line"></i> Sign In';
    }
  });
}

// ---------------- REGISTER ----------------
function setupRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const roleInput = document.querySelector('input[name="role"]:checked');
    const role = roleInput ? roleInput.value : null;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (!role) return showToast('Error', 'Please select a role', 'error');
    if (!document.getElementById('terms').checked) return showToast('Error', 'You must agree to the Terms and Privacy Policy', 'error');
    if (password !== confirmPassword) return showToast('Error', 'Passwords do not match', 'error');
    if (password.length < 8) return showToast('Error', 'Password must be at least 8 characters', 'error');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating account...';
    
    try {
      const { data, error } = await registerUser(email, password, name, role, phone);
      if (error) return showToast('Registration Failed', error.message, 'error');
      
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
    admin: '/admin/dashboard.html'
  };
  
  const target = roleMap[role] || '/';
  setTimeout(() => window.location.href = target, 800);
}

// ---------------- CHECK IF LOGGED IN ----------------
async function checkAuthRedirect() {
  const user = await getCurrentUser();
  const isAuthPage = window.location.pathname.includes('/auth/') || 
                     window.location.pathname.endsWith('/login.html') || 
                     window.location.pathname.endsWith('/register.html') ||
                     window.location.pathname === '/' ||
                     window.location.pathname === '/index.html';
  
  if (user) {
    // Check if user is admin
    const adminEmail = 'douglasnkowo3036@gmail.com';
    const role = user.email === adminEmail ? 'admin' : user.role;
    
    // If on auth page or homepage and logged in, redirect to dashboard
    if (isAuthPage) {
      redirectByRole(role);
    }
  }
}

// ---------------- LOGOUT ----------------
export async function logout() {
  await logoutUser();
  showToast('Logged Out', 'You have been signed out', 'success');
  window.location.href = '/';
}

window.logout = logout;