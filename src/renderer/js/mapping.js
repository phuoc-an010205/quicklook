// ==================== PHÂN TÍCH LINK & MAP ID ====================

function parseDriveIdsFromText(text) {
  if (!text) return [];
  const results = [];
  try {
    const re = /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]{8,})/g;
    let m;
    while ((m = re.exec(text)) !== null) results.push(m[1]);
    const re2 = /folders\/([a-zA-Z0-9_-]{8,})/g;
    while ((m = re2.exec(text)) !== null) {
      if (!results.includes(m[1])) results.push(m[1]);
    }
  } catch (e) { /* ignore */ }
  return results;
}

function parseDriveLinks() {
  const txt = (document.getElementById('folder-links-multiple') || {}).value || '';
  const ids = txt
    .split(/\r?\n/)
    .flatMap((line) => parseDriveIdsFromText(line.trim()))
    .filter(Boolean);

  windowParsedDriveIds = [...new Set(ids)];
  showToast(`Đã phát hiện ${windowParsedDriveIds.length} ID`, 'success');
}

async function mapAllParsedIds() {
  if (!windowParsedDriveIds?.length) {
    showToast('Vui lòng phân tích link trước', 'error');
    return;
  }

  const driveRoot = typeof window.resolveDriveRootFromUI === 'function'
    ? await window.resolveDriveRootFromUI()
    : null;

  if (!driveRoot) {
    showToast('Không map được: kiểm tra chữ cái ổ đĩa hoặc bấm "Chọn thư mục gốc"', 'error');
    return;
  }

  window.currentDriveRoot = driveRoot;
  resetAllPreviewsState();
  mappedFolders = [];

  try {
    await withImageLoader('Chờ chíu băng đang tan...', async () => {
      for (const id of windowParsedDriveIds) {
        try {
          const result = await window.electronAPI.resolveDriveId(driveRoot, id);
          if (!result?.success) {
            console.warn('[Map] Could not resolve ID:', id, result?.error);
            continue;
          }
          mappedFolders.push({
            id,
            name: result.displayName || id,
            imageCount: result.imagePaths.length,
            fullPrettyPath: result.fullPrettyPath,
            imagePaths: result.imagePaths,
            driveRoot,
          });
        } catch (e) {
          console.warn('[Map] IPC error resolving ID', id, e);
        }
      }

      window.mappedFolders = mappedFolders;
      showToast(`Đã map ${mappedFolders.length} ID`, 'success');

      if (typeof window.renderAllPreviewsBulk === 'function') {
        await window.renderAllPreviewsBulk(mappedFolders, { reset: false, loader: false });
      }
    });
  } catch (err) {
    console.error('Map/render failed:', err);
    showToast('Lỗi khi hiển thị ảnh', 'error');
  }
}

// ==================== TIỆN ÍCH CHUNG ====================

const basename = (p) => (p || '').split(/[/\\]/).pop() || 'Ảnh';
const isPsdPath = (p) => /\.psd$/i.test(p || '');
const toFileUrl = (p) => (p ? `file://${p.replace(/\\/g, '/')}` : '');

function escapeHtmlAttr(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

async function withImageLoader(message, fn) {
  if (typeof showImageLoader === 'function') showImageLoader(message);
  try {
    return await fn();
  } finally {
    if (typeof hideImageLoader === 'function') hideImageLoader();
  }
}

function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function createSemaphore(maxConcurrent) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < maxConcurrent && queue.length) {
      active++;
      queue.shift()().finally(() => { active--; pump(); });
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push(() => fn().then(resolve, reject));
    pump();
  });
}

const imageLoadSemaphore = createSemaphore(5);

function parseThumbnailResult(result) {
  if (typeof result === 'string') {
    return { thumbPath: result, isPsd: false, isPlaceholder: false };
  }
  return {
    thumbPath: result?.thumbPath,
    isPsd: !!result?.isPsd,
    isPlaceholder: !!result?.isPlaceholder,
  };
}

function waitForImageLoad(img, src) {
  return new Promise((resolve, reject) => {
    const done = () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };
    const onLoad = () => { done(); resolve(); };
    const onError = () => { done(); reject(new Error('img load failed')); };
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
    img.src = src;
    if (img.complete && img.naturalWidth > 0) { done(); resolve(); }
  });
}

// ==================== HOVER PREVIEW (docs/hoverImg.md) ====================

let hoverPreviewEl = null;
let hoverPreviewTimer = null;
let hoverPreviewHideTimer = null;
let hoverPreviewActiveCard = null;
const hoverPointer = { x: 0, y: 0 };
const HOVER_PREVIEW_DELAY_MS = 320;
const HOVER_PREVIEW_HIDE_MS = 120;

async function resolveDisplaySrc(fullPath, card) {
  if (!fullPath) return '';
  if (card?.dataset.displaySrc) return card.dataset.displaySrc;

  if (window.electronAPI?.getImageDisplaySource) {
    try {
      const result = await window.electronAPI.getImageDisplaySource(fullPath);
      if (result?.kind === 'dataUrl' && result.src) {
        if (card) card.dataset.displaySrc = result.src;
        return result.src;
      }
      if (result?.kind === 'file' && result.src) {
        const url = toFileUrl(result.src);
        if (card) card.dataset.displaySrc = url;
        return url;
      }
    } catch (e) {
      console.warn('[Display] getImageDisplaySource failed', fullPath, e);
    }
  }

  if (isPsdPath(fullPath) && card?.dataset.thumbSrc) return card.dataset.thumbSrc;
  return toFileUrl(fullPath);
}

function ensureHoverPreviewElement() {
  if (hoverPreviewEl) return hoverPreviewEl;
  hoverPreviewEl = document.createElement('div');
  hoverPreviewEl.id = 'image-hover-preview';
  hoverPreviewEl.setAttribute('aria-hidden', 'true');
  hoverPreviewEl.innerHTML = `
    <div class="hover-preview-img-wrap"><img alt="" /></div>
    <div class="hover-preview-caption"></div>
  `;
  document.body.appendChild(hoverPreviewEl);
  return hoverPreviewEl;
}

function hideHoverPreview(immediate) {
  clearTimeout(hoverPreviewTimer);
  hoverPreviewTimer = null;
  hoverPreviewActiveCard = null;
  if (!hoverPreviewEl) return;

  const finish = () => {
    hoverPreviewEl.classList.remove('is-visible', 'is-hiding');
    hoverPreviewEl.setAttribute('aria-hidden', 'true');
    hoverPreviewEl.querySelector('img')?.removeAttribute('src');
  };

  if (immediate) {
    clearTimeout(hoverPreviewHideTimer);
    finish();
    return;
  }

  hoverPreviewEl.classList.remove('is-visible');
  hoverPreviewEl.classList.add('is-hiding');
  hoverPreviewEl.setAttribute('aria-hidden', 'true');
  hoverPreviewHideTimer = setTimeout(finish, HOVER_PREVIEW_HIDE_MS);
}

function positionHoverPreview(clientX, clientY) {
  const el = hoverPreviewEl;
  if (!el?.classList.contains('is-visible')) return;

  const margin = 20;
  const gap = 14;
  const { width: w, height: h } = el.getBoundingClientRect();
  let left = clientX + gap;
  let top = clientY + gap;

  if (left + w > window.innerWidth - margin) left = clientX - w - gap;
  if (top + h > window.innerHeight - margin) top = clientY - h - gap;

  el.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - w - margin))}px`;
  el.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - h - margin))}px`;
}

async function showHoverPreview(card) {
  const thumbImg = card.querySelector('img');
  if (!thumbImg || thumbImg.style.display === 'none') return;

  const fullPath = card.dataset.fullPath;
  const fileName = basename(fullPath) || thumbImg.alt;
  const previewUrl = isPsdPath(fullPath)
    ? await resolveDisplaySrc(fullPath, card)
    : (fullPath ? toFileUrl(fullPath) : thumbImg.src);

  if (!previewUrl) return;

  const el = ensureHoverPreviewElement();
  const previewImg = el.querySelector('img');
  const caption = el.querySelector('.hover-preview-caption');

  clearTimeout(hoverPreviewHideTimer);
  el.classList.remove('is-hiding');
  if (caption) caption.textContent = fileName;

  const reveal = () => {
    if (hoverPreviewActiveCard !== card) return;
    el.classList.add('is-visible');
    el.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => positionHoverPreview(hoverPointer.x, hoverPointer.y));
  };

  if (previewImg.src === previewUrl && previewImg.complete) {
    reveal();
    return;
  }

  previewImg.onload = () => { previewImg.onload = null; reveal(); };
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

  const fileName = basename(card.dataset.fullPath);

  card.addEventListener('mouseenter', () => {
    card.classList.add('is-hovered');
    if (card.dataset.loaded !== 'true') return;

    clearTimeout(hoverPreviewTimer);
    hoverPreviewActiveCard = card;
    hoverPreviewTimer = setTimeout(() => {
      if (hoverPreviewActiveCard === card) {
        showHoverPreview(card).catch((err) => console.warn('[Hover]', err));
      }
    }, HOVER_PREVIEW_DELAY_MS);
  });

  card.addEventListener('mousemove', (e) => {
    hoverPointer.x = e.clientX;
    hoverPointer.y = e.clientY;
    if (hoverPreviewEl?.classList.contains('is-visible') && hoverPreviewActiveCard === card) {
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
    const src = await resolveDisplaySrc(fullPath, card);
    if (src && typeof window.previewFullImage === 'function') {
      window.previewFullImage(src, fileName);
    }
  });
}

// ==================== GALLERY & THUMBNAIL ====================

let allPreviewsObserver = null;

function resetAllPreviewsState() {
  document.getElementById('all-previews-container')?.replaceChildren();
  allPreviewsObserver?.disconnect();
  allPreviewsObserver = null;
  hideHoverPreview(true);
  window.mappedFolders = [];
}

window.renderAllPreviewsBulk = async function (dataList, options = {}) {
  const container = document.getElementById('all-previews-container');
  if (!container) return;

  const render = async () => {
    if (options.reset !== false) resetAllPreviewsState();
    if (!dataList?.length) return;

    for (const item of dataList) {
      const gallery = createGalleryForId(item);
      if (gallery) container.appendChild(gallery);
    }
  };

  if (options.loader === false) return render();
  return withImageLoader('ĐANG TẢI ẢNH...', render);
};

function createGalleryForId(item) {
  const imagePaths = item.imagePaths || [];
  const wrap = document.createElement('div');
  wrap.className = 'gallery-group';
  wrap.dataset.id = item.id;

  const header = document.createElement('div');
  header.className = 'gallery-header';
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <span style="font-family:monospace; color:#60a5fa; font-size:12px;">${item.id}</span>
      <span style="color:#e2e8f0; font-weight:600; font-size:14px;">${item.name}</span>
      <span style="background:#166534;color:#86efac;padding:1px 8px;border-radius:999px;font-size:11px; font-weight:bold;">
        ${imagePaths.length} ảnh
      </span>
      <span class="gallery-status" style="color:#64748b; font-size:11px;">Đang tải...</span>
    </div>
    <div style="margin-top:2px; font-size:10px; color:#64748b; font-family:monospace; word-break:break-all; opacity:0.8;">
      ${item.fullPrettyPath || ''}
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'image-grid';
  grid.dataset.id = item.id;

  // Áp dụng zoom hiện tại (nếu có) cho grid mới (kết hợp yeucau1.md)
  const wrapEl = document.querySelector('.all-previews-wrap');
  if (wrapEl) {
    const curZ = wrapEl.style.getPropertyValue('--zoom') || '1';
    grid.style.setProperty('--zoom', curZ);
  }

  if (!imagePaths.length) {
    grid.innerHTML = '<div style="padding:30px;color:#64748b;text-align:center;width:100%;font-size:13px;">Không có ảnh</div>';
    wrap.append(header, grid);
    return wrap;
  }

  const fragment = document.createDocumentFragment();
  imagePaths.forEach((fullPath, index) => {
    const card = document.createElement('div');
    card.className = 'image-item';
    card.dataset.loaded = 'false';
    card.dataset.index = String(index);
    card.dataset.fullPath = fullPath;

    const safeName = escapeHtmlAttr(basename(fullPath));
    card.innerHTML = `
      <div class="placeholder"><span class="placeholder-text">Đang tải...</span></div>
      <img style="display:none;width:100%;height:100%;object-fit:cover;border-radius:6px;cursor:pointer;" alt="${safeName}" />
      <div class="image-hover-overlay" title="${safeName}">${safeName}</div>
    `;
    attachImageCardEffects(card);
    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
  wrap.append(header, grid);
  setupLazyThumbnailLoading(grid);

  const statusEl = header.querySelector('.gallery-status');
  if (statusEl) statusEl.textContent = `Sẵn sàng (${imagePaths.length} ảnh)`;
  return wrap;
}

function setupLazyThumbnailLoading(grid) {
  if (!allPreviewsObserver) {
    allPreviewsObserver = new IntersectionObserver((entries) => {
      for (const { isIntersecting, target: card } of entries) {
        if (!isIntersecting || card.dataset.loaded === 'true') continue;
        allPreviewsObserver.unobserve(card);
        if (card.dataset.fullPath) loadThumbnailIntoCard(card, card.dataset.fullPath);
      }
    }, { rootMargin: '300px 0px', threshold: 0.05 });
  }

  for (const card of grid.children) {
    if (card.dataset.loaded !== 'true' && card.dataset.fullPath) {
      allPreviewsObserver.observe(card);
    }
  }
}

function markThumbnailError(placeholder, fullImagePath) {
  placeholder.classList.remove('hidden');
  placeholder.style.display = 'flex';
  placeholder.innerHTML = isPsdPath(fullImagePath)
    ? '<span style="color:#fbbf24;font-size:11px;">PSD — lỗi preview</span>'
    : '<span style="color:#f87171;font-size:11px;">Lỗi thumbnail</span>';
}

async function loadThumbnailIntoCard(card, fullImagePath) {
  const placeholder = card.querySelector('.placeholder');
  const img = card.querySelector('img');
  if (!placeholder || !img) return;

  // Bắt đầu loader bar + % cho placeholder cá nhân
  const loader = placeholder.querySelector('.loader');
  const pctEl = placeholder.querySelector('.pct');
  if (loader) loader.style.setProperty('--progress', '0%');
  if (pctEl) pctEl.textContent = '0%';

  let fakeP = 0;
  const fakeIv = setInterval(() => {
    if (!placeholder || placeholder.classList.contains('hidden')) {
      clearInterval(fakeIv);
      return;
    }
    fakeP += Math.random() * 18 + 6;
    if (fakeP > 92) fakeP = 92;
    if (loader) loader.style.setProperty('--progress', `${fakeP}%`);
    if (pctEl) pctEl.textContent = `${Math.floor(fakeP)}%`;
  }, 90);

  await imageLoadSemaphore(async () => {
    try {
      const { thumbPath, isPsd, isPlaceholder } = parseThumbnailResult(
        await window.electronAPI.getThumbnail(fullImagePath)
      );
      const thumbUrl = toFileUrl(thumbPath);
      img.alt = basename(fullImagePath);

      await waitForImageLoad(img, thumbUrl);

      clearInterval(fakeIv);
      if (loader) loader.style.setProperty('--progress', '100%');
      if (pctEl) pctEl.textContent = '100%';

      // Ẩn placeholder sau chút delay để thấy 100%
      setTimeout(() => {
        img.style.display = 'block';
        placeholder.style.display = 'none';
        placeholder.classList.add('hidden');
      }, 120);

      card.dataset.loaded = 'true';
      card.dataset.thumbSrc = thumbUrl;
      if (isPsd) card.dataset.isPsd = 'true';
      if (isPlaceholder) card.dataset.psdPlaceholder = 'true';

      card.title = isPsd
        ? (isPlaceholder ? 'PSD — không đọc được preview' : 'PSD — click xem preview')
        : 'Click để xem ảnh gốc';
    } catch (e) {
      clearInterval(fakeIv);
      markThumbnailError(placeholder, fullImagePath);
      card.dataset.loaded = 'true';
      console.warn('[Thumbnail]', fullImagePath, e);
    }
  });
}

// ==================== EXPORT ====================

window.reloadAllPreviews = debounce(async () => {
  if (!window.mappedFolders?.length) {
    showToast('Chưa có dữ liệu để tải lại', 'error');
    return;
  }
  showToast('Đang tải lại ảnh...', 'info');
  try {
    await window.renderAllPreviewsBulk(window.mappedFolders);
    showToast('Đã tải lại ảnh', 'success');
  } catch (err) {
    console.error(err);
    showToast('Lỗi khi tải lại ảnh', 'error');
  }
});

window.parseDriveLinks = parseDriveLinks;
window.mapAllParsedIds = mapAllParsedIds;
window.copyToExplorer = window.copyToExplorer || ((path) => {
  navigator.clipboard.writeText(path).then(() => showToast('Đã copy đường dẫn!', 'success'));
});

// ==================== ZOOM GALLERY (Ctrl + Wheel) ====================
// Khi nhấn Ctrl + lăn chuột trên vùng gallery, phóng to/thu nhỏ ảnh theo yêu cầu yeucau1.md
// Base size 210x210 cho .image-item img
(function initGalleryZoom() {
  const wrap = document.querySelector('.all-previews-wrap') || document.getElementById('all-previews-container');
  if (!wrap) return;

  const grids = () => document.querySelectorAll('.image-grid');
  const setZoom = (z) => {
    wrap.style.setProperty('--zoom', z);
    grids().forEach(g => g.style.setProperty('--zoom', z));
  };

  let currentZoom = parseFloat(wrap.style.getPropertyValue('--zoom') || '1');
  setZoom(currentZoom);

  // Lắng nghe trên container để zoom khi Ctrl + wheel
  const target = document.getElementById('all-previews-container') || wrap;
  target.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();

    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    currentZoom = Math.max(0.4, Math.min(4.0, currentZoom + delta));

    setZoom(currentZoom);
  }, { passive: false });
})();