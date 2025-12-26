import { createPayment, verifyPayment, getCurrentUser } from '../api/api.js';
import { showToast } from '../utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  setupPaymentForm();
  setupPaymentOptions();
});

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
    const method = document.querySelector('input[name="method"]:checked').value;
    const phone = document.getElementById('phone').value;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Processing...';

    const { data: payment, error } = await createPayment(listingId, 2.50, method);

    if (error) {
      showToast('Error', error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ri-secure-payment-line"></i> Pay $2.50';
      return;
    }

    showToast('Processing', 'Please confirm payment on your phone...', 'info');

    setTimeout(async () => {
      const { data: verified, error: verifyError } = await verifyPayment(payment.reference);
      
      if (verifyError) {
        window.location.href = '/payment/problem.html';
        return;
      }

      window.location.href = '/payment/success.html?ref=' + payment.reference;
    }, 3000);
  });
}
