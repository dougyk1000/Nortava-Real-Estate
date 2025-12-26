let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(title, message, type = 'success', duration = 4000) {
  const container = getToastContainer();
  
  const icons = {
    success: 'ri-checkbox-circle-fill',
    error: 'ri-error-warning-fill',
    warning: 'ri-alert-fill',
    info: 'ri-information-fill'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="${icons[type] || icons.info}"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close"><i class="ri-close-line"></i></button>
  `;
  
  container.appendChild(toast);
  
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));
  
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
  
  return toast;
}

function removeToast(toast) {
  toast.style.animation = 'toastOut 0.3s ease forwards';
  setTimeout(() => toast.remove(), 300);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes toastOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100%); }
  }
`;
document.head.appendChild(style);
