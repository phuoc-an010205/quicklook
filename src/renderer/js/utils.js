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

function showImageLoader(text) {
  const el = document.getElementById('image-loader');
  if (!el) return;

  const label = el.querySelector('.loading-text');
  const baseText = text || 'ĐANG TẢI ẢNH...';

  if (label) {
    label.innerHTML = `${baseText} <span class="percent">0%</span>`;
  }

  el.classList.remove('hidden');
  el.setAttribute('aria-busy', 'true');

  // Simulate % text for global loading (per yeucau1 + loadingImg)
  if (el._progressInterval) clearInterval(el._progressInterval);

  let progress = 0;
  el._progressInterval = setInterval(() => {
    progress += Math.random() * 15 + 5;
    if (progress > 95) progress = 95;
    if (label) {
      const pct = label.querySelector('.percent');
      if (pct) pct.textContent = `${Math.floor(progress)}%`;
    }
  }, 150);
}

function hideImageLoader() {
  const el = document.getElementById('image-loader');
  if (!el) return;

  const label = el.querySelector('.loading-text');

  // Set to 100%
  if (label) {
    const pct = label.querySelector('.percent');
    if (pct) pct.textContent = '100%';
  }

  if (el._progressInterval) {
    clearInterval(el._progressInterval);
    el._progressInterval = null;
  }

  // Short delay to see 100%
  setTimeout(() => {
    el.classList.add('hidden');
    el.setAttribute('aria-busy', 'false');
    if (label) label.innerHTML = 'ĐANG TẢI ẢNH...';
  }, 300);
}

window.showImageLoader = showImageLoader;
window.hideImageLoader = hideImageLoader;

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
    <div class="loader-container loader-container--modal" id="modal-image-loader">
      <span class="loader" aria-hidden="true"></span>
      <p class="loading-text">ĐANG TẢI ẢNH...</p>
    </div>
    <img class="image-preview-modal__img is-loading" src="${url}" alt="${escapeHtml(name)}">
    <button type="button" class="image-preview-modal__close" aria-label="Đóng">&times;</button>
    <div class="image-preview-modal__caption">${escapeHtml(name)}</div>
  `;

  const imgEl = modal.querySelector('.image-preview-modal__img');
  const modalLoader = modal.querySelector('#modal-image-loader');
  const closeBtn = modal.querySelector('.image-preview-modal__close');

  const hideModalLoader = () => {
    if (modalLoader) modalLoader.classList.add('hidden');
    imgEl.classList.remove('is-loading');
  };

  imgEl.addEventListener('load', () => {
    hideModalLoader();
    if (!modal.classList.contains('is-open')) {
      requestAnimationFrame(() => modal.classList.add('is-open'));
    }
  });

  imgEl.addEventListener('error', () => {
    hideModalLoader();
    if (modalLoader) {
      const t = modalLoader.querySelector('.loading-text');
      if (t) t.textContent = 'KHÔNG TẢI ĐƯỢC ẢNH';
      modalLoader.classList.remove('hidden');
    }
  });

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

  if (imgEl.complete && imgEl.naturalWidth > 0) {
    hideModalLoader();
    requestAnimationFrame(() => modal.classList.add('is-open'));
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!imgEl.classList.contains('is-loading')) {
          modal.classList.add('is-open');
        }
      });
    });
  }
};

window.openImageModal = function(url, name) {
  window.previewFullImage(url, name);
};
