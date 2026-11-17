import { createPayment, verifyPayment, getCurrentUser } from '../api/api.js';
import { showToast } from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  setupPaymentForm();
  setupPaymentOptions();
  checkGatewayStatus();
});

async function checkGatewayStatus() {
  const notice = document.getElementById('gatewayStatusNotice');
  if (!notice) return;
  try {
    const res = await fetch('/api/public-config');
    if (!res.ok) return;
    const cfg = await res.json();
    if (!cfg.paymentsConfigured && !cfg.paymentsSandbox) {
      notice.style.display = 'block';
    }
  } catch {
    // Ignore
  }
}

function setupPaymentOptions() {
  const options = document.querySelectorAll('.payment-option');
  options.forEach(option => {
    option.addEventListener('click', () => {
      options.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
    });
  });
}

function setupPaymentForm() {
  const form = document.getElementById('paymentForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = await getCurrentUser();
    if (!user) {
      showToast('Login Required', 'Please login to make a payment', 'warning');
      setTimeout(() => {
        window.location.href = '/auth/login.html';
      }, 1500);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const listingId = params.get('listing');
    const method = document.querySelector('input[name="method"]:checked')?.value;
    const phone = document.getElementById('phone')?.value.trim();
    const oneTimeAcknowledged = Boolean(document.getElementById('oneTimeConsent')?.checked);

    if (!oneTimeAcknowledged) {
      showToast('Confirmation Required', 'Please confirm you understand this is a one-time, non-recurring $2.50 fee.', 'warning');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Processing...';

    try {
      const { data: payment, error } = await createPayment(listingId, method, phone, oneTimeAcknowledged);

      if (error || !payment) {
        showToast('Payment Unavailable', error?.message || 'Unable to initiate payment', 'error');
        return;
      }

      showToast('Verifying', 'Confirming payment status with server...', 'info');
      const { data: verified, error: verifyError } = await verifyPayment(payment.reference);

      if (verifyError || !verified) {
        window.location.href = '/payment/problem.html';
        return;
      }

      window.location.href = `/payment/success.html?ref=${encodeURIComponent(payment.reference)}`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ri-secure-payment-line"></i> Complete Payment $2.50';
    }
  });
}
