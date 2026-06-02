function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    // Positioning is now 100% controlled by CSS (see style.css #toast-container)
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
  toast.innerHTML = `<i class="fa-solid ${icon} text-lg"></i><div class="flex-1">${message}</div>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

function isImageFileName(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','gif','webp','bmp','svg','psd'].includes(ext);
}

function downloadImage(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'image';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Modal xem ảnh full — fade-in/out, click nền / Esc để đóng.
 * Chỉ revokeObjectURL với blob: (không dùng với file://).
 */
window.previewFullImage = function(url, displayName) {
  if (!url) return;

  const name = displayName
    || url.split('/').pop().split('\\').pop()
    || 'Ảnh';

  const existing = document.querySelector('.image-preview-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'image-preview-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <img class="image-preview-modal__img" src="${url}" alt="${escapeHtml(name)}">
    <button type="button" class="image-preview-modal__close" aria-label="Đóng">&times;</button>
    <div class="image-preview-modal__caption">${escapeHtml(name)}</div>
  `;

  const imgEl = modal.querySelector('.image-preview-modal__img');
  const closeBtn = modal.querySelector('.image-preview-modal__close');

  const closeModal = () => {
    if (modal.dataset.closing === 'true') return;
    modal.dataset.closing = 'true';
    modal.classList.remove('is-open');
    modal.classList.add('is-closing');

    setTimeout(() => {
      modal.remove();
      if (typeof url === 'string' && url.startsWith('blob:')) {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
      }
    }, 300);
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  imgEl.addEventListener('click', (e) => e.stopPropagation());

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add('is-open'));
  });
};

window.openImageModal = function(url, name) {
  window.previewFullImage(url, name);
};
