// ==================== PARSE & MAPPING DATA ====================

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
  
  displayParsedIds(uniq);
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

function displayParsedIds(ids) {
  const container = document.getElementById('parsed-ids-list');
  if (!container) return;
  container.innerHTML = '';
  
  if (!ids || ids.length === 0) {
    container.innerHTML = `<div class="text-slate-500">Chưa có ID nào được phân tích.</div>`;
    return;
  }
  
  ids.forEach(id => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2 mb-2';
    const driveLetter = (document.getElementById('drive-letter-input') || {}).value || 'H';
    const suggestedPath = `${driveLetter}:\\.shortcut-targets-by-id\\${id}`;
    
    row.innerHTML = `
      <div>
        <div class="font-mono text-xs text-emerald-300">${id}</div>
        <div class="text-[10px] text-slate-400">${suggestedPath}</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="text-xs px-2 py-1 bg-slate-800/40 rounded" onclick="window.showImagesInline(null, '${id}')">Mở mapped</button>
        <button class="text-xs px-2 py-1 bg-rose-700/30 rounded" onclick="window.removeParsedId('${id}')">Xóa</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function removeParsedId(id) {
  const ta = document.getElementById('folder-links-multiple');
  if (!ta) return;
  const lines = (ta.value || '').split(/\r?\n/).filter(Boolean);
  const newLines = lines.filter(l => !l.includes(id));
  ta.value = newLines.join('\n');
  parseDriveLinks();
}

// ==================== MAP TẤT CẢ ID + fullPrettyPath ====================
async function mapAllParsedIds() {
  if (!windowParsedDriveIds || windowParsedDriveIds.length === 0) {
    showToast('Vui lòng phân tích link trước', 'error');
    return;
  }
  if (!rootDirHandle) {
    showToast('Vui lòng chọn thư mục gốc trước', 'error');
    return;
  }

  const driveLetter = (document.getElementById('drive-letter-input') || {}).value || 'H';
  
  mappedFolders = [];
  let shortcutDir = null;
  try {
    shortcutDir = await rootDirHandle.getDirectoryHandle('.shortcut-targets-by-id', { create: false });
  } catch (e) {}

  for (const id of windowParsedDriveIds) {
    let finalImageCount = 0;
    let finalFolderName = id;
    let fullPath = `${driveLetter}:\\.shortcut-targets-by-id\\${id}`;
    let fullPrettyPath = fullPath; // fullPrettyPath mặc định

    if (shortcutDir) {
      try {
        const target = await shortcutDir.getDirectoryHandle(id, { create: false });
        
        const subfolders = [];
        let rootImagesCount = 0;

        for await (const [name, entry] of target.entries()) {
          if (entry.kind === 'directory') {
            subfolders.push({ name: name, handle: entry });
          } else if (entry.kind === 'file' && isImageFileName(name)) {
            rootImagesCount++;
          }
        }

        if (subfolders.length > 0) {
          finalFolderName = subfolders[0].name;
          fullPath += `\\${finalFolderName}`;
          fullPrettyPath = `${driveLetter}:\\.shortcut-targets-by-id\\${id}\\${finalFolderName}`;
          
          try {
            const subHandle = subfolders[0].handle;
            let subImageCount = 0;
            for await (const [subName, subEntry] of subHandle.entries()) {
              if (subEntry.kind === 'file' && isImageFileName(subName)) {
                subImageCount++;
              }
            }
            finalImageCount = rootImagesCount + subImageCount;
          } catch(e) {}
        } else {
          finalFolderName = target.name;
          finalImageCount = rootImagesCount;
        }

      } catch (e) {
        console.log("Lỗi không đọc được ID:", id);
      }
    }

    mappedFolders.push({ 
      id: id, 
      name: finalFolderName, 
      imageCount: finalImageCount,
      fullPath: fullPath,
      fullPrettyPath: fullPrettyPath   // ← ĐÃ THÊM THEO YÊU CẦU
    });
  }

  renderMappedTable(mappedFolders);
  showToast(`Đã map ${mappedFolders.length} ID`, 'success');

  // === NEW: Auto-load image previews for ALL mapped IDs (no click required) ===
  // This satisfies the request: images from every Drive link appear immediately.
  if (typeof window.renderAllPreviewsBulk === 'function') {
    // Expose current data for reload button / console
    window.mappedFolders = mappedFolders;
    window.renderAllPreviewsBulk(mappedFolders).catch(err => {
      console.error('Bulk preview failed:', err);
    });
  }
}

// ==================== CENTRALIZED IMAGE SOURCE RESOLUTION ====================
/**
 * Resolve the correct directory handle that actually contains the images for a Drive ID.
 * Mirrors the exact logic previously duplicated in mapAllParsedIds and loadImagesToGrid:
 * - If the ID folder has subfolders, use the first subfolder (typical Drive shortcut structure).
 * - Otherwise use the ID folder root.
 *
 * Returns data needed for both counting (already done) and lazy display.
 */
async function resolveImageSource(id) {
  if (!rootDirHandle) {
    throw new Error('Chưa chọn thư mục gốc');
  }

  const shortcutDir = await rootDirHandle.getDirectoryHandle('.shortcut-targets-by-id', { create: false });
  const idDir = await shortcutDir.getDirectoryHandle(id, { create: false });

  // Scan for immediate subfolders + root-level images
  const subfolders = [];
  const rootImages = [];

  for await (const [name, entry] of idDir.entries()) {
    if (entry.kind === 'directory') {
      subfolders.push({ name, handle: entry });
    } else if (entry.kind === 'file' && isImageFileName(name)) {
      rootImages.push(entry);
    }
  }

  if (subfolders.length > 0) {
    const firstSub = subfolders[0];
    const subImages = [];
    for await (const [name, entry] of firstSub.handle.entries()) {
      if (entry.kind === 'file' && isImageFileName(name)) {
        subImages.push(entry);
      }
    }
    return {
      targetDirHandle: firstSub.handle,
      displayName: firstSub.name,
      imageHandles: subImages,
      source: 'subfolder'
    };
  }

  // No subfolder → images are directly in the ID folder
  return {
    targetDirHandle: idDir,
    displayName: id,
    imageHandles: rootImages,
    source: 'root'
  };
}

// ==================== RENDER BẢNG + PREVIEW INLINE ====================

function renderMappedTable(dataList) {
  if (!dataList || !Array.isArray(dataList)) return;

  const tbody = document.getElementById('shortcuts-table');
  tbody.innerHTML = '';

  if (dataList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:#64748b;">Chưa có folder nào được map</td></tr>`;
    return;
  }

  dataList.forEach(data => {
    const tr = document.createElement('tr');
    tr.dataset.id = data.id;
    
    const safePath = (data.fullPrettyPath || data.fullPath).replace(/\\/g, '\\\\');

    tr.innerHTML = `
      <td style="font-family:monospace; color:#60a5fa;">${data.id}</td>
      <td style="font-family:monospace; color:#e2e8f0; font-weight: 500;">
        <a href="" onclick="event.preventDefault(); copyToExplorer('${safePath}')" 
           style="color: #34d399; text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 4px; cursor: pointer;"
           onmouseover="this.style.color='#10b981'" 
           onmouseout="this.style.color='#34d399'">
          <i class="fa-regular fa-copy" style="margin-right: 4px;"></i>${data.name}
        </a>
      </td>
      <td style="text-align:center;">
        <span style="background:#166534;color:#86efac;padding:4px 12px;border-radius:999px;font-size:12px; font-weight: bold;">
          ${data.imageCount} ảnh
        </span>
      </td>
      <td style="text-align:center;">
   <button onclick="window.showImagesInline(this.closest('tr'), '${data.id}', '${(data.fullPrettyPath || data.fullPath || data.id).replace(/\\/g, '\\\\')}')" 
           style="background:#10b981;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:13px;cursor:pointer;">
      <i class="fa-solid fa-eye"></i> Xem ảnh
   </button>
   </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==================== HIỂN THỊ ẢNH INLINE (KHÔNG DRILL) ====================

window.showImagesInline = async function(clickedRow, id, fullPrettyPath = null) {
  // Đóng tất cả preview đang mở
  document.querySelectorAll('.preview-inline-row').forEach(r => r.remove());

  const tbody = document.getElementById('shortcuts-table');
  const previewTr = document.createElement('tr');
  previewTr.className = 'preview-inline-row';
  previewTr.style.background = '#0f172a';

  // Hiển thị fullPrettyPath nếu có, nếu không thì fallback về ID
  const titleText = fullPrettyPath 
    ? `Preview ảnh — ${fullPrettyPath}` 
    : `Preview ảnh — ID: ${id}`;

  previewTr.innerHTML = `
    <td colspan="4" style="padding:0; border:none;">
      <div style="padding:20px 16px 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-weight:600; color:#e2e8f0; font-size:15px;">${titleText}</span>
          <button onclick="this.closest('.preview-inline-row').remove()" 
                  class="btn btn-secondary" style="padding:5px 14px; font-size:13px;">
            <i class="fa-solid fa-times"></i> Đóng
          </button>
        </div>
        <div id="image-grid-${id}" class="image-grid"></div>
      </div>
    </td>
  `;

  if (clickedRow) {
    clickedRow.after(previewTr);
  } else {
    tbody.appendChild(previewTr);
  }

  await loadImagesToGrid(id, `image-grid-${id}`);
};

async function loadImagesToGrid(id, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  grid.innerHTML = `<div style="text-align:center; padding:60px 20px; color:#64748b;">
    <i class="fa-solid fa-spinner fa-spin"></i><br>Đang tải ảnh...
  </div>`;

  if (!rootDirHandle) {
    grid.innerHTML = `<div style="text-align:center; padding:60px; color:#f87171;">Chưa chọn thư mục gốc!</div>`;
    return;
  }

  try {
    const shortcutDir = await rootDirHandle.getDirectoryHandle('.shortcut-targets-by-id', { create: false });
    const idDir = await shortcutDir.getDirectoryHandle(id, { create: false });

    let targetDir = idDir;
    let targetName = id;
    let images = [];

    // === GIỐNG HỆT LOGIC ĐẾM ẢNH TRONG mapAllParsedIds ===
    const subfolders = [];
    let rootImagesCount = 0;

    for await (const [name, entry] of idDir.entries()) {
      if (entry.kind === 'directory') {
        subfolders.push({ name, handle: entry });
      } else if (entry.kind === 'file' && isImageFileName(name)) {
        rootImagesCount++;
        images.push({ name, handle: entry });   // backup root images
      }
    }

    // Nếu có thư mục con → vào thư mục con đầu tiên (đây là nơi có ảnh thật)
    if (subfolders.length > 0) {
      targetDir = subfolders[0].handle;
      targetName = subfolders[0].name;
      console.log(`[DEBUG] Tự động vào subfolder: ${targetName}`);

      // Load ảnh từ subfolder
      images = [];
      for await (const [name, entry] of targetDir.entries()) {
        if (entry.kind === 'file' && isImageFileName(name)) {
          images.push({ name, handle: entry });
        }
      }
    }

    // Fallback: nếu subfolder không có ảnh thì lấy ảnh ở root
    if (images.length === 0 && rootImagesCount > 0) {
      images = []; // reset
      for await (const [name, entry] of idDir.entries()) {
        if (entry.kind === 'file' && isImageFileName(name)) {
          images.push({ name, handle: entry });
        }
      }
    }

    if (images.length === 0) {
      grid.innerHTML = `<div style="text-align:center; padding:60px; color:#f87171;">
        Không tìm thấy ảnh nào.<br>
        <small>Đã kiểm tra cả folder ID và subfolder con đầu tiên.</small><br>
        <span style="font-size:13px">Số ảnh được đếm: ${rootImagesCount} (có thể ảnh nằm sâu hơn 1 cấp)</span>
      </div>`;
      return;
    }

    // === Render ảnh ===
    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const img of images.slice(0, 30)) {
      const div = document.createElement('div');
      div.className = 'image-item';
      div.innerHTML = `
        <img src="" alt="${img.name}" loading="lazy" style="width:100%; height:100%; object-fit:cover; border-radius:6px; cursor:pointer;">
        <div class="image-name">${img.name}</div>
      `;

      img.handle.getFile().then(file => {
        const url = URL.createObjectURL(file);
        const imgEl = div.querySelector('img');
        imgEl.src = url;
        imgEl.onclick = () => previewFullImage(url);
      }).catch(e => console.log("Lỗi load:", img.name));

      fragment.appendChild(div);
    }

    grid.appendChild(fragment);

  } catch (e) {
    console.error("loadImagesToGrid error:", e);
    grid.innerHTML = `<div style="color:#f87171; padding:40px; text-align:center;">
      Không thể truy cập folder ID: ${id}<br>
      <small>${e.message || e}</small>
    </div>`;
  }
}
window.previewFullImage = function(url) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:99999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <img src="${url}" style="max-width:92%; max-height:92vh; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.6);">
    <button onclick="this.parentElement.remove()" style="position:absolute;top:30px;right:30px;background:#fff;color:#111;width:50px;height:50px;border-radius:50%;font-size:28px;border:none;cursor:pointer;">×</button>
  `;
  document.body.appendChild(modal);
};

// ==================== BULK AUTO PREVIEW (LIGHTWEIGHT + FAST) ====================

// Simple concurrency limiter for getFile() + ObjectURL creation
function createSemaphore(maxConcurrent) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (queue.length === 0 || active >= maxConcurrent) return;
    active++;
    const fn = queue.shift();
    fn().finally(() => {
      active--;
      next();
    });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push(() => fn().then(resolve).catch(reject));
    next();
  });
}

const imageLoadSemaphore = createSemaphore(6); // tune: 4-8 is usually sweet spot for local FS

let allPreviewsObserver = null;

/**
 * Main entry: automatically render image galleries for every mapped item.
 * Called after a successful mapAllParsedIds.
 */
window.renderAllPreviewsBulk = async function(dataList) {
  const container = document.getElementById('all-previews-container');
  if (!container) {
    console.warn('[Previews] #all-previews-container not found in DOM');
    return;
  }

  container.innerHTML = '';
  if (!dataList || dataList.length === 0) return;

  // Update total count badge if present
  const countEl = document.getElementById('total-images-count');
  if (countEl) {
    const total = dataList.reduce((sum, d) => sum + (d.imageCount || 0), 0);
    countEl.textContent = total;
  }

  // Create one gallery per mapped ID (skeletons first for instant UI)
  for (const item of dataList) {
    const gallery = createGalleryShell(item);
    container.appendChild(gallery);

    // Kick off lazy loading for this gallery (non-blocking)
    loadGalleryImagesLazily(gallery, item).catch(e => {
      console.warn('Lazy load failed for', item.id, e);
    });
  }
};

function createGalleryShell(item) {
  const wrap = document.createElement('div');
  wrap.className = 'gallery-group';
  wrap.dataset.id = item.id;

  const header = document.createElement('div');
  header.className = 'gallery-header';
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <span style="font-family:monospace; color:#60a5fa; font-size:13px;">${item.id}</span>
      <span style="color:#e2e8f0; font-weight:600;">${item.name}</span>
      <span style="background:#166534;color:#86efac;padding:2px 10px;border-radius:999px;font-size:12px; font-weight:bold;">
        ${item.imageCount || 0} ảnh
      </span>
      <span class="gallery-status" style="color:#64748b; font-size:12px;">Đang tải...</span>
    </div>
    <div style="margin-top:4px; font-size:11px; color:#64748b; font-family:monospace; word-break:break-all;">
      ${item.fullPrettyPath || item.fullPath || ''}
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'image-grid';
  grid.dataset.id = item.id;

  // Create skeleton cards immediately (instant perceived performance)
  const count = Math.min(item.imageCount || 24, 400); // cap skeletons for extreme cases
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'image-item skeleton';
    sk.innerHTML = `
      <div style="width:100%;height:100%;background:#1e2937;border-radius:6px;"></div>
      <div class="image-name" style="color:#64748b;">Đang tải...</div>
    `;
    grid.appendChild(sk);
  }

  if ((item.imageCount || 0) === 0) {
    grid.innerHTML = `<div style="padding:40px;color:#64748b;text-align:center;width:100%;">Không có ảnh</div>`;
  }

  wrap.appendChild(header);
  wrap.appendChild(grid);
  return wrap;
}

async function loadGalleryImagesLazily(galleryEl, item) {
  const grid = galleryEl.querySelector('.image-grid');
  const statusEl = galleryEl.querySelector('.gallery-status');
  if (!grid) return;

  let imageHandles;
  try {
    const src = await resolveImageSource(item.id);
    imageHandles = src.imageHandles || [];
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Lỗi truy cập';
    grid.innerHTML = `<div style="color:#f87171;padding:30px;text-align:center;">Không thể đọc thư mục: ${e.message || e}</div>`;
    return;
  }

  if (imageHandles.length === 0) {
    if (statusEl) statusEl.textContent = '0 ảnh';
    return;
  }

  if (statusEl) statusEl.textContent = `Đang tải ${imageHandles.length} ảnh...`;

  // Prepare real cards (we will swap skeletons)
  const skeletons = Array.from(grid.querySelectorAll('.image-item.skeleton'));
  const realCount = imageHandles.length;

  // If we created fewer skeletons than actual files, add the missing ones (progressive)
  while (skeletons.length < realCount && skeletons.length < 500) {
    const sk = document.createElement('div');
    sk.className = 'image-item skeleton';
    sk.innerHTML = `
      <div style="width:100%;height:100%;background:#1e2937;border-radius:6px;"></div>
      <div class="image-name" style="color:#64748b;">Đang tải...</div>
    `;
    grid.appendChild(sk);
    skeletons.push(sk);
  }

  // Set up (or reuse) the observer
  if (!allPreviewsObserver) {
    allPreviewsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          allPreviewsObserver.unobserve(card);
          const handle = card._fileHandle;
          if (handle) {
            loadSingleImageCard(card, handle);
          }
        }
      });
    }, {
      rootMargin: '300px 0px', // start loading a bit before visible
      threshold: 0.01
    });
  }

  // Attach handles to skeletons and start observing
  imageHandles.forEach((handle, idx) => {
    const card = skeletons[idx];
    if (!card) return;
    card._fileHandle = handle;
    // Give each card a filename hint if possible (we don't have the name yet without getFile, so keep generic or fetch tiny metadata later)
    allPreviewsObserver.observe(card);
  });

  if (statusEl) {
    statusEl.textContent = `Sẵn sàng (${realCount} ảnh)`;
  }
}

async function loadSingleImageCard(card, fileHandle) {
  // Use semaphore so we don't hammer the disk with hundreds of getFile() at once
  await imageLoadSemaphore(async () => {
    try {
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);

      // Replace skeleton content
      card.classList.remove('skeleton');
      card.innerHTML = `
        <img src="${url}" alt="${file.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:6px;cursor:pointer;">
        <div class="image-name">${file.name}</div>
      `;

      const img = card.querySelector('img');
      img.onclick = () => window.previewFullImage(url);

      // Optional: revoke when the card is no longer visible for a long time (memory hygiene)
      // For simplicity we keep the URL for the lifetime of the page in v1.
      // Advanced: attach a second observer that revokes after leaving viewport for 30s.
    } catch (e) {
      card.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1e2937;color:#f87171;font-size:12px;">
          Lỗi tải
        </div>
        <div class="image-name" style="color:#64748b;">${fileHandle.name || 'ảnh'}</div>
      `;
    }
  });
}

// Convenience: allow manual reload from console or future button
window.reloadAllPreviews = async function() {
  const container = document.getElementById('all-previews-container');
  if (!container || !window.mappedFolders || !window.mappedFolders.length) {
    showToast('Chưa có dữ liệu để tải lại', 'error');
    return;
  }
  showToast('Đang tải lại ảnh...', 'info');
  await window.renderAllPreviewsBulk(window.mappedFolders);
  showToast('Đã tải lại ảnh', 'success');
};

// ==================== EXPORT GLOBAL ====================
window.parseDriveLinks = parseDriveLinks;
window.mapAllParsedIds = mapAllParsedIds;
window.removeParsedId = removeParsedId;
window.renderMappedTable = renderMappedTable;
window.showImagesInline = window.showImagesInline;
window.copyToExplorer = window.copyToExplorer || function(path) {
  navigator.clipboard.writeText(path).then(() => showToast('Đã copy đường dẫn!', 'success'));
};