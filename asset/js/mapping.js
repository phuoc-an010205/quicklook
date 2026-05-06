// mapping.js
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
        <button class="text-xs px-2 py-1 bg-slate-800/40 rounded" onclick="window.showImagesFromRootForId('${id}')">Mở mapped</button>
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

async function mapAllParsedIds() {
  if (!windowParsedDriveIds || windowParsedDriveIds.length === 0) {
    showToast('Vui lòng phân tích link trước', 'error');
    return;
  }
  if (!rootDirHandle) {
    showToast('Vui lòng chọn thư mục gốc trước', 'error');
    return;
  }

  mappedFolders = [];
  let shortcutDir = null;
  try {
    shortcutDir = await rootDirHandle.getDirectoryHandle('.shortcut-targets-by-id', { create: false });
  } catch (e) {}

  for (const id of windowParsedDriveIds) {
    let imageCount = 0;
    if (shortcutDir) {
      try {
        const target = await shortcutDir.getDirectoryHandle(id, { create: false });
        for await (const [name, entry] of target.entries()) {
          if (entry.kind === 'file' && isImageFileName(name)) imageCount++;
        }
      } catch (e) {}
    }

    mappedFolders.push({ id, name: id, imageCount });
  }

  renderMappedTable();
  showToast(`Đã map ${mappedFolders.length} ID`, 'success');
}

function renderMappedTable() {
  const tbody = document.getElementById('shortcuts-table');
  tbody.innerHTML = '';

  if (mappedFolders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:#64748b;">Chưa có folder nào được map</td></tr>`;
    return;
  }

  // Đã sửa lại việc gọi item.id thay vì sf.id cho an toàn (hoặc dùng sf cho cả vòng lặp)
  mappedFolders.forEach(sf => { 
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-family:monospace;color:#60a5fa;">${sf.id}</td>
      <td style="font-family:monospace; color:#e2e8f0;">
        ${sf.name}
      </td>
      <td style="text-align:center;">
        <span style="background:#166534;color:#86efac;padding:2px 10px;border-radius:999px;font-size:12px;">
          ${sf.imageCount || 0} ảnh
        </span>
      </td>
      <td style="text-align:center;">
        <button onclick="window.showImagesFromRootForId('${sf.id}')" 
                style="background:#166534;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:13px;cursor:pointer;">
          Xem ảnh
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ==================== XUẤT HÀM RA TOÀN CỤC (GLOBAL) ====================
// Đoạn này cực kỳ quan trọng để main.js và các nút HTML có thể gọi được các hàm này
window.renderDirectoryContents = renderDirectoryContents;
window.drillIntoSubfolder = drillIntoSubfolder;
window.goBackOneLevel = goBackOneLevel;
window.showImagesFromRootForId = showImagesFromRootForId;
window.pickRootDir = pickRootDir;
window.refreshCurrentImages = refreshCurrentImages;