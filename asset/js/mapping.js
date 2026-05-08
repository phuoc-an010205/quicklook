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

  // Lấy tên ổ đĩa (mặc định là H nếu không nhập)
  const driveLetter = (document.getElementById('drive-letter-input') || {}).value || 'H';
  
  mappedFolders = [];
  let shortcutDir = null;
  try {
    shortcutDir = await rootDirHandle.getDirectoryHandle('.shortcut-targets-by-id', { create: false });
  } catch (e) {}

  for (const id of windowParsedDriveIds) {
    let finalImageCount = 0;
    let finalFolderName = id; 
    let fullPath = `${driveLetter}:\\.shortcut-targets-by-id\\${id}`; // Đường dẫn mặc định

    if (shortcutDir) {
      try {
        const target = await shortcutDir.getDirectoryHandle(id, { create: false });
        
        const subfolders = [];
        let rootImagesCount = 0;

        // Quét thư mục gốc của ID
        for await (const [name, entry] of target.entries()) {
          if (entry.kind === 'directory') {
            subfolders.push({ name: name, handle: entry });
          } else if (entry.kind === 'file' && isImageFileName(name)) {
            rootImagesCount++;
          }
        }

        // Nếu phát hiện có thư mục con, tự động đào sâu vào thư mục con đầu tiên để đếm ảnh
        if (subfolders.length > 0) {
          finalFolderName = subfolders[0].name;
          fullPath += `\\${finalFolderName}`; // Cộng thêm tên thư mục con vào đường dẫn
          
          try {
            const subHandle = subfolders[0].handle;
            let subImageCount = 0;
            // Đếm ảnh bên trong folder con
            for await (const [subName, subEntry] of subHandle.entries()) {
              if (subEntry.kind === 'file' && isImageFileName(subName)) {
                subImageCount++;
              }
            }
            finalImageCount = rootImagesCount + subImageCount; // Tổng ảnh gốc + ảnh trong folder con
          } catch(e) {}
        } else {
          // Nếu không có folder con
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
      fullPath: fullPath // Lưu lại đường dẫn để lát copy
    });
  }

  renderMappedTable(mappedFolders);
  showToast(`Đã map ${mappedFolders.length} ID`, 'success');
}

// function renderMappedTable() {
//   const tbody = document.getElementById('shortcuts-table');
//   tbody.innerHTML = '';

//   if (mappedFolders.length === 0) {
//     tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:#64748b;">Chưa có folder nào được map</td></tr>`;
//     return;
//   }

//   // Đã sửa lại việc gọi item.id thay vì sf.id cho an toàn (hoặc dùng sf cho cả vòng lặp)
//   mappedFolders.forEach(sf => { 
//     const row = document.createElement('tr');
//     row.innerHTML = `
//       <td style="font-family:monospace;color:#60a5fa;">${sf.id}</td>
//       <td style="font-family:monospace; color:#e2e8f0;">
//         ${sf.name}
//       </td>
//       <td style="text-align:center;">
//         <span style="background:#166534;color:#86efac;padding:2px 10px;border-radius:999px;font-size:12px;">
//           ${sf.imageCount || 0} ảnh
//         </span>
//       </td>
//       <td style="text-align:center;">
//         <button onclick="window.showImagesFromRootForId('${sf.id}')" 
//                 style="background:#166534;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:13px;cursor:pointer;">
//           Xem ảnh
//         </button>
//       </td>
//     `;
//     tbody.appendChild(row);
//   });
// }
// Hàm phụ trợ giúp copy đường dẫn
window.copyToExplorer = function(path) {
  navigator.clipboard.writeText(path).then(() => {
    showToast('Đã copy đường dẫn! Mở This PC và dán (Ctrl+V) để vào folder.', 'success');
  }).catch(err => {
    showToast('Lỗi khi copy đường dẫn', 'error');
  });
};

function renderMappedTable(dataList) {
  if (!dataList || !Array.isArray(dataList)) return; 

  const tbody = document.getElementById('shortcuts-table');
  const previewRow = document.getElementById('preview-row');

  const oldRows = tbody.querySelectorAll('tr:not(#preview-row)');
  oldRows.forEach(row => row.remove());

  dataList.forEach(data => {
    const tr = document.createElement('tr');
    
    // Xử lý escape dấu \ trong đường dẫn Windows để không bị lỗi JS
    const safePath = data.fullPath.replace(/\\/g, '\\\\');

    tr.innerHTML = `
      <td style="font-family:monospace; color:#60a5fa;">
        ${data.id}
      </td>
      <td style="font-family:monospace; color:#e2e8f0; font-weight: 500;">
        <a href="" onclick="event.preventDefault(); copyToExplorer('${safePath}')" 
           style="color: #34d399; text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 4px; cursor: pointer; transition: color 0.2s;"
           onmouseover="this.style.color='#10b981'" 
           onmouseout="this.style.color='#34d399'"
           title="Click để Copy đường dẫn tới thư mục này">
          <i class="fa-regular fa-copy" style="margin-right: 4px;"></i>${data.name}
        </a>
      </td>
      <td style="text-align:center;">
        <span style="background:#166534;color:#86efac;padding:4px 12px;border-radius:999px;font-size:12px; font-weight: bold;">
          ${data.imageCount} ảnh
        </span>
      </td>
      <td style="text-align:center;">
         <button onclick="window.showImagesFromRootForId('${data.id}')" 
                 style="background:#10b981;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:13px;cursor:pointer;">
            <i class="fa-solid fa-eye"></i> Xem ảnh
         </button>
      </td>
    `;
    
    tbody.insertBefore(tr, previewRow); 
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