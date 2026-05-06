function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-x-3 px-5 py-3.5 rounded-3xl shadow-xl text-sm max-w-xs border ${
    type === 'success' ? 'bg-emerald-900 border-emerald-700 text-emerald-200' : 
    type === 'error' ? 'bg-rose-900 border-rose-700 text-rose-200' : 
    'bg-blue-900 border-blue-700 text-blue-200'
  }`;
  
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
  modal.className = 'fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-4';
  modal.innerHTML = `
    <div class="relative max-w-[95vw] max-h-[95vh] w-full flex flex-col">
      <div class="flex items-center justify-between mb-3 px-1">
        <div class="text-white font-medium flex items-center gap-3">
          <i class="fa-solid fa-image text-emerald-400"></i>
          <span class="font-mono text-sm">${name}</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center gap-2 transition-colors" id="btn-download-modal">
            <i class="fa-solid fa-download"></i>
            <span>Tải về</span>
          </button>
          <button class="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-2xl flex items-center gap-2 transition-colors" id="btn-close-modal">
            <i class="fa-solid fa-times"></i>
            <span>Đóng</span>
          </button>
        </div>
      </div>
      
      <div class="flex-1 flex items-center justify-center overflow-hidden rounded-3xl bg-slate-950 border border-slate-800">
        <img src="${url}" 
             alt="${name}" 
             class="max-w-full max-h-[82vh] object-contain shadow-2xl rounded-2xl"
             style="image-rendering: crisp-edges;">
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const closeBtn = modal.querySelector('#btn-close-modal');
  const downloadBtn = modal.querySelector('#btn-download-modal');
  
  const closeModal = () => modal.remove();
  
  closeBtn.onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  downloadBtn.onclick = () => downloadImage(url, name);
  
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler, { once: true });
}
// utils.js