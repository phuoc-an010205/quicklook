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
  return ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
}

function downloadImage(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'image';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openImageModal(url, name) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[999] flex items-center justify-center bg-black/85 p-6';

  // Thiết kế modal nhỏ đẹp, không chiếm toàn màn hình
  modal.innerHTML = `
    <div class="relative w-full max-w-[920px] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
      
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-slate-950/60">
        <div class="flex items-center gap-3 text-white">
          <i class="fa-solid fa-image text-emerald-400"></i>
          <span class="font-mono text-sm truncate max-w-[520px]" title="${name}">${name}</span>
        </div>
        
        <div class="flex items-center gap-2">
          <button class="px-3.5 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-2xl flex items-center gap-2 transition-all" id="btn-download-modal">
            <i class="fa-solid fa-download"></i>
            <span class="hidden sm:inline">Tải về</span>
          </button>
          
          <button class="w-9 h-9 flex items-center justify-center text-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-800 rounded-2xl transition-all" id="btn-close-modal" title="Đóng (Esc)">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      </div>

      <!-- Ảnh -->
      <div class="flex items-center justify-center p-5 bg-[#0b1220]">
        <img src="${url}" 
             alt="${name}" 
             class="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-xl border border-slate-800"
             style="image-rendering: crisp-edges;">
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const closeBtn = modal.querySelector('#btn-close-modal');
  const downloadBtn = modal.querySelector('#btn-download-modal');
  
  const closeModal = () => modal.remove();
  
  closeBtn.onclick = closeModal;
  
  // Click ra ngoài để đóng (trên lớp overlay)
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
  
  downloadBtn.onclick = () => downloadImage(url, name);
  
  // Hỗ trợ phím Esc
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler, { once: true });
}

// Expose các hàm modal hữu ích ra global để các script khác (như mapping.js) dễ sử dụng
window.openImageModal = openImageModal;

// Alias đơn giản để tương thích ngược với code cũ trong mapping.js
window.previewFullImage = function(url) {
  const filename = url.split('/').pop().split('\\').pop() || 'Ảnh';
  
  // Ưu tiên dùng modal đẹp nếu có
  if (typeof openImageModal === 'function') {
    openImageModal(url, filename);
    return;
  }

  // Fallback modal nhỏ đẹp (nếu openImageModal chưa load)
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[999] flex items-center justify-center bg-black/85 p-6';

  modal.innerHTML = `
    <div class="relative w-full max-w-[920px] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
      
      <div class="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-slate-950/60">
        <div class="flex items-center gap-3 text-white">
          <i class="fa-solid fa-image text-emerald-400"></i>
          <span class="font-mono text-sm truncate max-w-[520px]">${filename}</span>
        </div>
        <button class="w-9 h-9 flex items-center justify-center text-xl bg-slate-700 hover:bg-slate-600 rounded-2xl transition-all" id="fb-close">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>

      <div class="p-5 bg-[#0b1220] flex justify-center">
        <img src="${url}" 
             class="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-xl border border-slate-800"
             style="image-rendering: crisp-edges;">
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#fb-close').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  const esc = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', esc);
    }
  };
  document.addEventListener('keydown', esc, { once: true });
};
