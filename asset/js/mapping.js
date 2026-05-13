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

// ==================== EXPORT GLOBAL ====================
window.parseDriveLinks = parseDriveLinks;
window.mapAllParsedIds = mapAllParsedIds;
window.removeParsedId = removeParsedId;
window.renderMappedTable = renderMappedTable;
window.showImagesInline = window.showImagesInline;
window.copyToExplorer = window.copyToExplorer || function(path) {
  navigator.clipboard.writeText(path).then(() => showToast('Đã copy đường dẫn!', 'success'));
};