// ==================== PHÂN TÍCH LINK VÀ MAPPING DỮ LIỆU ====================

function parseDriveLinks() {
  const txt = (document.getElementById('folder-links-multiple') || {}).value || '';
  const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const ids = [];
  
  lines.forEach(l => {
    const p = parseDriveIdsFromText(l);
    if (p && p.length) ids.push(...p);
  });
  
  const uniq = Array.from(new Set(ids));
  windowParsedDriveIds = uniq;
  
  showToast(`Đã phát hiện ${uniq.length} ID`, 'success');
}

function parseDriveIdsFromText(text) {
  if (!text) return [];
  const results = [];
  try {
    const re = /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]{8,})/g;
    let m;
    while ((m = re.exec(text)) !== null) results.push(m[1]);
    const re2 = /folders\/([a-zA-Z0-9_-]{8,})/g;
    while ((m = re2.exec(text)) !== null) if (!results.includes(m[1])) results.push(m[1]);
  } catch (e) {}
  return results;
}

// ==================== MAP TẤT CẢ ID (PHIÊN BẢN PHASE 2 - DÙNG ĐƯỜNG DẪN) ====================

async function mapAllParsedIds() {
  if (!windowParsedDriveIds || windowParsedDriveIds.length === 0) {
    showToast('Vui lòng phân tích link trước', 'error');
    return;
  }

  // Luôn ưu tiên chữ cái ổ trong #drive-letter-input (không auto-detect G: mặc định)
  let driveRoot = null;
  if (typeof window.resolveDriveRootFromUI === 'function') {
    driveRoot = await window.resolveDriveRootFromUI();
  }

  if (!driveRoot) {
    showToast('Không map được: kiểm tra chữ cái ổ đĩa hoặc bấm "Chọn thư mục gốc"', 'error');
    return;
  }

  window.currentDriveRoot = driveRoot;

  // Reset toàn bộ để tránh trùng lặp dữ liệu
  resetAllPreviewsState();
  mappedFolders = [];

  // Sử dụng logic resolve đúng từ backend (đã xử lý subfolder)
  for (const id of windowParsedDriveIds) {
    let result;

    try {
      result = await window.electronAPI.resolveDriveId(driveRoot, id);
    } catch (e) {
      console.warn('[Map] IPC error resolving ID', id, e);
      continue;
    }

    if (!result || !result.success) {
      console.warn('[Map] Could not resolve ID:', id, result?.error);
      continue;
    }

    mappedFolders.push({
      id,
      name: result.displayName || id,           // Real folder name (or fallback to ID)
      imageCount: result.imagePaths.length,
      fullPrettyPath: result.fullPrettyPath,
      imagePaths: result.imagePaths,            // Correct list of images
      driveRoot
    });
  }

  window.mappedFolders = mappedFolders;

  showToast(`Đã map ${mappedFolders.length} ID`, 'success');

  if (typeof window.renderAllPreviewsBulk === 'function') {
    window.renderAllPreviewsBulk(mappedFolders).catch(err => {
      console.error('Bulk preview failed:', err);
    });
  }
}

// Logic phát hiện thư mục con đã được xử lý đúng ở backend qua resolveDriveId.

// ==================== PHẦN RENDER ẢNH (PHASE 2 - DÙNG THUMBNAIL QUA IPC) ====================
//
// Cách hoạt động hiện tại:
// - Sau khi map, mỗi item có `imagePaths` (mảng đường dẫn ảnh thật trên ổ đĩa).
// - Khi tạo gallery, chúng ta chỉ tạo placeholder + thẻ <img>.
// - Sử dụng IntersectionObserver để lazy load.
// - Khi card xuất hiện trong viewport → gọi `electronAPI.getThumbnail(fullPath)`.
// - Backend (thumbnailer.js) sẽ dùng sharp tạo thumbnail nhỏ (~320px, WebP) và cache lại.
// - Ảnh được load từ file:// thay vì blob URL như phiên bản cũ.
//
// Ưu điểm: Nhẹ, nhanh, tiết kiệm RAM, thumbnail chỉ generate 1 lần.
//


// (Hàm resolveImageSource cũ đã bị xóa hoàn toàn ở Phase 2)
// Toàn bộ truy cập ảnh giờ đều đi qua electronAPI + đường dẫn tuyệt đối.

// ==================== CÁC HÀM HỖ TRỢ RENDER ====================

// Debounce đơn giản để tránh re-render liên tục khi cuộn hoặc bấm nút nhiều lần
function debounce(fn, delay = 150) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Giới hạn số lượng request đồng thời (tránh overload khi load nhiều thumbnail cùng lúc)
function createSemaphore(maxConcurrent) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (queue.length === 0 || active >= maxConcurrent) return;
    active++;
    const fn = queue.shift();
    fn().finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push(() => fn().then(resolve).catch(reject));
    next();
  });
}
// Semaphore dùng để giới hạn tối đa 5 thumbnail được load cùng lúc
const imageLoadSemaphore = createSemaphore(5);

// Observer dùng cho lazy loading toàn bộ gallery
let allPreviewsObserver = null;

// ==================== HIỆU ỨNG HOVER ẢNH (xem docs/hoverImg.md) ====================

let hoverPreviewEl = null;
let hoverPreviewTimer = null;
let hoverPreviewHideTimer = null;
let hoverPreviewActiveCard = null;
const hoverPointer = { x: 0, y: 0 };
const HOVER_PREVIEW_DELAY_MS = 320;
const HOVER_PREVIEW_HIDE_MS = 120;

function escapeHtmlAttr(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function toFileUrl(fullPath) {
  if (!fullPath) return '';
  return 'file://' + fullPath.replace(/\\/g, '/');
}

function isPsdPath(fullPath) {
  return /\.psd$/i.test(fullPath || '');
}

/**
 * URL có thể hiển thị trên thẻ img (PSD → data URL hoặc thumbnail webp).
 */
async function resolveDisplaySrc(fullPath, card) {
  if (!fullPath) return '';

  if (card && card.dataset.displaySrc) {
    return card.dataset.displaySrc;
  }

  if (window.electronAPI && typeof window.electronAPI.getImageDisplaySource === 'function') {
    try {
      const result = await window.electronAPI.getImageDisplaySource(fullPath);
      if (result && result.kind === 'dataUrl' && result.src) {
        if (card) card.dataset.displaySrc = result.src;
        return result.src;
      }
      if (result && result.kind === 'file' && result.src) {
        const url = toFileUrl(result.src);
        if (card) card.dataset.displaySrc = url;
        return url;
      }
    } catch (e) {
      console.warn('[Display] getImageDisplaySource failed', fullPath, e);
    }
  }

  if (isPsdPath(fullPath) && card && card.dataset.thumbSrc) {
    return card.dataset.thumbSrc;
  }

  return toFileUrl(fullPath);
}

function ensureHoverPreviewElement() {
  if (hoverPreviewEl) return hoverPreviewEl;

  hoverPreviewEl = document.createElement('div');
  hoverPreviewEl.id = 'image-hover-preview';
  hoverPreviewEl.setAttribute('aria-hidden', 'true');
  hoverPreviewEl.innerHTML = `
    <div class="hover-preview-img-wrap">
      <img alt="" />
    </div>
    <div class="hover-preview-caption"></div>
  `;
  document.body.appendChild(hoverPreviewEl);
  return hoverPreviewEl;
}

function hideHoverPreview(immediate) {
  if (hoverPreviewTimer) {
    clearTimeout(hoverPreviewTimer);
    hoverPreviewTimer = null;
  }
  hoverPreviewActiveCard = null;

  if (!hoverPreviewEl) return;

  const el = hoverPreviewEl;
  const finish = () => {
    el.classList.remove('is-visible', 'is-hiding');
    el.setAttribute('aria-hidden', 'true');
    const previewImg = el.querySelector('img');
    if (previewImg) previewImg.removeAttribute('src');
  };

  if (immediate) {
    if (hoverPreviewHideTimer) clearTimeout(hoverPreviewHideTimer);
    finish();
    return;
  }

  el.classList.remove('is-visible');
  el.classList.add('is-hiding');
  el.setAttribute('aria-hidden', 'true');

  if (hoverPreviewHideTimer) clearTimeout(hoverPreviewHideTimer);
  hoverPreviewHideTimer = setTimeout(finish, HOVER_PREVIEW_HIDE_MS);
}

function positionHoverPreview(clientX, clientY) {
  const el = hoverPreviewEl;
  if (!el || !el.classList.contains('is-visible')) return;

  const margin = 20;
  const gap = 14;
  const rect = el.getBoundingClientRect();
  const w = rect.width || el.offsetWidth || 280;
  const h = rect.height || el.offsetHeight || 280;

  let left = clientX + gap;
  let top = clientY + gap;

  if (left + w > window.innerWidth - margin) {
    left = clientX - w - gap;
  }
  if (top + h > window.innerHeight - margin) {
    top = clientY - h - gap;
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - h - margin));

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

async function showHoverPreview(card) {
  const thumbImg = card.querySelector('img');
  if (!thumbImg || thumbImg.style.display === 'none') return;

  const fullPath = card.dataset.fullPath;
  const fileName = (fullPath || '').split(/[/\\]/).pop() || thumbImg.alt || 'Ảnh';

  let previewUrl;
  if (isPsdPath(fullPath)) {
    previewUrl = await resolveDisplaySrc(fullPath, card);
  } else {
    previewUrl = fullPath ? toFileUrl(fullPath) : thumbImg.src;
  }

  if (!previewUrl) return;

  const el = ensureHoverPreviewElement();
  const previewImg = el.querySelector('img');
  const caption = el.querySelector('.hover-preview-caption');

  if (hoverPreviewHideTimer) {
    clearTimeout(hoverPreviewHideTimer);
    hoverPreviewHideTimer = null;
  }

  el.classList.remove('is-hiding');
  if (caption) caption.textContent = fileName;

  const reveal = () => {
    if (hoverPreviewActiveCard !== card) return;
    el.classList.add('is-visible');
    el.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      positionHoverPreview(hoverPointer.x, hoverPointer.y);
    });
  };

  if (previewImg.src === previewUrl && previewImg.complete) {
    reveal();
    return;
  }

  previewImg.onload = () => {
    previewImg.onload = null;
    reveal();
  };
  previewImg.onerror = () => {
    previewImg.onerror = null;
    previewImg.src = thumbImg.src;
    reveal();
  };
  previewImg.src = previewUrl;
  previewImg.alt = fileName;
}

function attachImageCardEffects(card) {
  if (!card || card.dataset.effectsBound === 'true') return;
  card.dataset.effectsBound = 'true';

  const fileName = (card.dataset.fullPath || '').split(/[/\\]/).pop() || 'Ảnh';

  card.addEventListener('mouseenter', () => {
    card.classList.add('is-hovered');
    if (card.dataset.loaded !== 'true') return;

    if (hoverPreviewTimer) clearTimeout(hoverPreviewTimer);
    hoverPreviewActiveCard = card;

    hoverPreviewTimer = setTimeout(() => {
      if (hoverPreviewActiveCard !== card) return;
      showHoverPreview(card).catch((err) => console.warn('[Hover] preview failed', err));
    }, HOVER_PREVIEW_DELAY_MS);
  });

  card.addEventListener('mousemove', (e) => {
    hoverPointer.x = e.clientX;
    hoverPointer.y = e.clientY;
    if (hoverPreviewEl && hoverPreviewEl.classList.contains('is-visible') && hoverPreviewActiveCard === card) {
      positionHoverPreview(e.clientX, e.clientY);
    }
  });

  card.addEventListener('mouseleave', () => {
    card.classList.remove('is-hovered');
    if (hoverPreviewActiveCard === card) hideHoverPreview(false);
  });

  card.addEventListener('click', async (e) => {
    e.stopPropagation();
    hideHoverPreview(true);

    const fullPath = card.dataset.fullPath;
    if (!fullPath) return;

    const displaySrc = await resolveDisplaySrc(fullPath, card);
    if (typeof window.previewFullImage === 'function' && displaySrc) {
      window.previewFullImage(displaySrc, fileName);
    }
  });
}

/**
 * RESET TOÀN BỘ GALLERY
 * Được gọi trước mỗi lần "Map tất cả ID" hoặc "Tải lại ảnh".
 * Đảm bảo không bị trùng lặp gallery, observer, hoặc dữ liệu cũ.
 */
function resetAllPreviewsState() {
  const container = document.getElementById('all-previews-container');
  if (container) {
    // Remove all DOM nodes
    container.replaceChildren();
  }

  // Fully disconnect and null the observer so no stale callbacks fire
  if (allPreviewsObserver) {
    allPreviewsObserver.disconnect();
    allPreviewsObserver = null;
  }

  hideHoverPreview();

  // Clear any global references that could cause re-use of old data
  if (window.mappedFolders) {
    window.mappedFolders = [];
  }
}

/**
 * Hàm chính để render toàn bộ gallery sau khi map xong.
 * Render từng nhóm ảnh theo từng Drive ID, sử dụng thumbnail đã được xử lý ở backend.
 */
window.renderAllPreviewsBulk = async function(dataList) {
  const container = document.getElementById('all-previews-container');
  if (!container) return;

  // Luôn reset DOM và observer trước khi render mới để tránh trùng lặp
  resetAllPreviewsState();

  if (!dataList || !Array.isArray(dataList) || dataList.length === 0) return;

  for (const item of dataList) {
    const gallery = await createGalleryForId(item);
    if (gallery) container.appendChild(gallery);
  }
};

/**
 * Tạo một block gallery cho một Drive ID (Phiên bản Phase 2)
 * Sử dụng danh sách đường dẫn ảnh (imagePaths) và tải thumbnail qua IPC.
 */
async function createGalleryForId(item) {
  const imagePaths = item.imagePaths || [];
  const displayName = item.name;
  let statusText = 'Đang tải...';

  const wrap = document.createElement('div');
  wrap.className = 'gallery-group';
  wrap.dataset.id = item.id;

  const header = document.createElement('div');
  header.className = 'gallery-header';
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <span style="font-family:monospace; color:#60a5fa; font-size:12px;">${item.id}</span>
      <span style="color:#e2e8f0; font-weight:600; font-size:14px;">${displayName}</span>
      <span style="background:#166534;color:#86efac;padding:1px 8px;border-radius:999px;font-size:11px; font-weight:bold;">
        ${imagePaths.length} ảnh
      </span>
      <span class="gallery-status" style="color:#64748b; font-size:11px;">${statusText}</span>
    </div>
    <div style="margin-top:2px; font-size:10px; color:#64748b; font-family:monospace; word-break:break-all; opacity:0.8;">
      ${item.fullPrettyPath || ''}
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'image-grid';
  grid.dataset.id = item.id;

  if (imagePaths.length === 0) {
    grid.innerHTML = `<div style="padding:30px;color:#64748b;text-align:center;width:100%; font-size:13px;">Không có ảnh</div>`;
    wrap.appendChild(header);
    wrap.appendChild(grid);
    return wrap;
  }

  const fragment = document.createDocumentFragment();

  imagePaths.forEach((fullPath, index) => {
    const card = document.createElement('div');
    card.className = 'image-item';
    card.dataset.loaded = 'false';
    card.dataset.index = index;
    card.dataset.fullPath = fullPath;   // Lưu đường dẫn để lazy load thumbnail sau này

    const fileName = fullPath.split(/[/\\]/).pop() || 'Ảnh';

    const safeName = escapeHtmlAttr(fileName);
    card.innerHTML = `
      <div class="placeholder" style="width:100%;height:100%;background:#1e2937;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:11px;">
        Đang tải...
      </div>
      <img style="display:none; width:100%; height:100%; object-fit:cover; border-radius:6px; cursor:pointer;" alt="${safeName}" />
      <div class="image-hover-overlay" title="${safeName}">${safeName}</div>
    `;

    attachImageCardEffects(card);

    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
  wrap.appendChild(header);
  wrap.appendChild(grid);

  // Kích hoạt lazy load thumbnail qua IPC
  setupLazyThumbnailLoading(grid);

  const statusEl = header.querySelector('.gallery-status');
  if (statusEl) statusEl.textContent = `Sẵn sàng (${imagePaths.length} ảnh)`;

  return wrap;
}

// ==================== LAZY LOADING THUMBNAIL (PHASE 2) ====================

function setupLazyThumbnailLoading(grid) {
  if (!allPreviewsObserver) {
    allPreviewsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          if (card.dataset.loaded === 'true') {
            allPreviewsObserver.unobserve(card);
            return;
          }
          allPreviewsObserver.unobserve(card);

          const fullPath = card.dataset.fullPath;
          if (fullPath) {
            loadThumbnailIntoCard(card, fullPath);
          }
        }
      });
    }, {
      rootMargin: '300px 0px',
      threshold: 0.05
    });
  }

  // Quan sát tất cả các card chưa được load
  Array.from(grid.children).forEach(card => {
    if (card.dataset.loaded !== 'true' && card.dataset.fullPath) {
      allPreviewsObserver.observe(card);
    }
  });
}

/**
 * Tải thumbnail vào card (lazy)
 * Gọi backend qua IPC để lấy thumbnail (tự động generate nếu chưa có).
 */
async function loadThumbnailIntoCard(card, fullImagePath) {
  if (!card) return;

  const placeholder = card.querySelector('.placeholder');
  const img = card.querySelector('img');
  if (!placeholder || !img) return;

  await imageLoadSemaphore(async () => {
    try {
      const thumbResult = await window.electronAPI.getThumbnail(fullImagePath);
      const thumbPath = typeof thumbResult === 'string' ? thumbResult : thumbResult.thumbPath;
      const isPsd = typeof thumbResult === 'object' && thumbResult.isPsd;
      const isPlaceholder = typeof thumbResult === 'object' && thumbResult.isPlaceholder;

      const thumbUrl = toFileUrl(thumbPath);
      img.src = thumbUrl;
      img.alt = fullImagePath.split(/[/\\]/).pop();

      img.style.display = 'block';
      placeholder.style.display = 'none';

      card.dataset.loaded = 'true';
      card.dataset.thumbSrc = thumbUrl;
      if (isPsd) card.dataset.isPsd = 'true';
      if (isPlaceholder) card.dataset.psdPlaceholder = 'true';

      const title = isPsd
        ? (isPlaceholder ? 'PSD — không đọc được preview' : 'PSD — click xem preview')
        : 'Click để xem ảnh gốc';
      card.setAttribute('title', title);
    } catch (e) {
      if (placeholder) {
        const label = isPsdPath(fullImagePath)
          ? '<span style="color:#fbbf24;font-size:11px;">PSD — lỗi preview</span>'
          : '<span style="color:#f87171;font-size:11px;">Lỗi thumbnail</span>';
        placeholder.innerHTML = label;
      }
      console.warn('[Thumbnail] Lỗi khi tải thumbnail cho', fullImagePath, e);
    }
  });
}

// Xử lý nút "Tải lại ảnh" (được export toàn cục) - có debounce để tránh spam
const debouncedReload = debounce(async function() {
  const container = document.getElementById('all-previews-container');
  if (!container || !window.mappedFolders || window.mappedFolders.length === 0) {
    showToast('Chưa có dữ liệu để tải lại', 'error');
    return;
  }
  showToast('Đang tải lại ảnh...', 'info');
  // Dùng cùng cơ chế reset để đảm bảo không bị trùng khi tải lại
  await window.renderAllPreviewsBulk(window.mappedFolders);
  showToast('Đã tải lại ảnh', 'success');
});

window.reloadAllPreviews = debouncedReload;

// ==================== EXPORT CÁC HÀM RA GLOBAL (chỉ những gì UI hiện tại cần dùng) ====================
window.parseDriveLinks = parseDriveLinks;
window.mapAllParsedIds = mapAllParsedIds;
window.copyToExplorer = window.copyToExplorer || function(path) {
  navigator.clipboard.writeText(path).then(() => showToast('Đã copy đường dẫn!', 'success'));
};