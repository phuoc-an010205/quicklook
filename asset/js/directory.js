
// ==================== DIRECTORY OPERATIONS ====================

async function renderDirectoryContents(dirHandle, customDisplayName = null) {
  const container = document.getElementById('image-grid');
  if (!container) return;

  currentDirHandle = dirHandle;
  container.innerHTML = '';
  container.className = 'space-y-6';

  const driveLetter = (document.getElementById('drive-letter-input') || {}).value || 'H';
  const displayEl = document.getElementById('folder-name-display');

  let displayName = customDisplayName || dirHandle.name || 'Thư mục';

  if (displayEl) {
    const fullPrettyPath = currentPathStack.length > 0 
      ? `${driveLetter}:\\.shortcut-targets-by-id\\${currentPathStack.join('\\')}`
      : `${driveLetter}:\\.shortcut-targets-by-id\\${displayName}`;
    
    displayEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-mono text-emerald-300">${fullPrettyPath}</span>
        ${currentPathStack.length > 0 ? 
          `<button onclick="goBackOneLevel()" class="ml-2 text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-2xl flex items-center gap-1">
              <i class="fa-solid fa-arrow-left text-xs"></i> <span>Back</span>
           </button>` : ''}
      </div>
    `;
  }

  const subfolders = [];
  const images = [];

  try {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === 'directory') {
        subfolders.push({ name, handle: entry });
      } else if (entry.kind === 'file' && isImageFileName(name)) {
        try {
          const file = await entry.getFile();
          const url = URL.createObjectURL(file);
          images.push({ name, url, handle: entry });
        } catch (e) {}
      }
    }
  } catch (e) {
    showToast('Không thể đọc thư mục: ' + (e.message || e), 'error');
    return;
  }

  if (subfolders.length > 0) {
    const folderSection = document.createElement('div');
    folderSection.className = 'bg-slate-900/60 border border-slate-700 rounded-3xl p-5';
    
    let html = `
      <div class="flex items-center justify-between mb-4 px-1">
        <div class="font-semibold text-emerald-300 flex items-center gap-2">
          <i class="fa-solid fa-folder-tree text-lg"></i>
          <span>Thư mục con (${subfolders.length})</span>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
    `;
    
    subfolders.forEach(sf => {
      html += `
        <div onclick="drillIntoSubfolder('${sf.name}', this)" 
             class="group flex items-center gap-3 p-4 bg-slate-950/70 border border-slate-700 hover:border-emerald-500/60 rounded-2xl cursor-pointer transition-all active:scale-[0.985]">
          <div class="w-10 h-10 flex-shrink-0 bg-amber-500/10 rounded-2xl flex items-center justify-center">
            <i class="fa-solid fa-folder text-2xl text-amber-400 group-hover:text-amber-300"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-mono text-sm text-emerald-200 truncate group-hover:text-emerald-100" title="${sf.name}">
              ${sf.name}
            </div>
            <div class="text-[10px] text-slate-500">Click để xem ảnh bên trong</div>
          </div>
          <i class="fa-solid fa-chevron-right text-slate-600 group-hover:text-emerald-400 transition-colors"></i>
        </div>
      `;
    });
    
    html += `</div>`;
    folderSection.innerHTML = html;
    container.appendChild(folderSection);
  }

  if (images.length > 0) {
    const imageSection = document.createElement('div');
    
    const header = document.createElement('div');
    header.className = 'flex items-center gap-2 px-2 mb-3';
    header.innerHTML = `
      <i class="fa-solid fa-images text-emerald-400"></i>
      <span class="font-semibold text-emerald-300">Ảnh trong thư mục (${images.length})</span>
      <span class="text-xs text-slate-500 ml-auto">Click ảnh để xem rõ nét</span>
    `;
    imageSection.appendChild(header);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns: repeat(4, 1fr); gap:20px; padding:20px; background:#020617; border-radius:20px; border:1px solid #334155; justify-content:flex-start;';
    
    images.forEach((img) => {
      const card = document.createElement('div');
      card.style.cssText = 'width:250px; height:200px; position:relative; border-radius:12px; overflow:hidden; background:#1e2937; cursor:pointer; box-shadow:0 4px 6px rgb(0 0 0 / 0.1);';
      
      card.innerHTML = `
        <img src="${img.url}" 
             alt="${img.name}" 
             style="width:250px; height:200px; object-fit: cover; transition: transform 0.3s ease;">
        
        <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,0.7), transparent); padding:8px 10px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; color:#e2e8f0; font-family:monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:65%;">${img.name}</span>
          
          <button onclick="event.stopImmediatePropagation(); downloadImage('${img.url}', '${img.name}');"
                  style="background:#10b981; color:white; border:none; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;">
            <i class="fa-solid fa-download" style="font-size:11px"></i>
          </button>
        </div>
      `;
      
      const imgEl = card.querySelector('img');
      card.addEventListener('mouseenter', () => imgEl.style.transform = 'scale(1.06)');
      card.addEventListener('mouseleave', () => imgEl.style.transform = 'scale(1)');
      
      card.addEventListener('click', () => {
        openImageModal(img.url, img.name);
      });
      
      grid.appendChild(card);
    });
    
    imageSection.appendChild(grid);
    
    const info = document.createElement('div');
    info.className = 'col-span-full mt-3 text-center text-[10px] text-slate-500 font-mono px-2';
    info.textContent = `${images.length} ảnh • Click để xem rõ nét • Hover để zoom`;
    imageSection.appendChild(info);
    
    container.appendChild(imageSection);
  }

  if (subfolders.length === 0 && images.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center bg-slate-900/60 border border-slate-700 rounded-3xl">
        <i class="fa-solid fa-folder-open text-5xl text-slate-600 mb-4"></i>
        <div class="text-slate-400">Thư mục trống hoặc không có ảnh</div>
      </div>
    `;
  }

  window.lastRenderedDirHandle = dirHandle;
}

async function drillIntoSubfolder(folderName) {
  if (!currentDirHandle) return;
  
  try {
    const subHandle = await currentDirHandle.getDirectoryHandle(folderName, { create: false });
    currentPathStack.push(folderName);
    await renderDirectoryContents(subHandle, folderName);
    showToast(`Đã vào thư mục: ${folderName}`, 'success');
  } catch (e) {
    showToast('Không thể mở thư mục con: ' + (e.message || e), 'error');
  }
}

async function goBackOneLevel() {
  if (!currentDirHandle || currentPathStack.length === 0) return;

  currentPathStack.pop();

  if (currentPathStack.length > 0) {
    try {
      let tempHandle = rootDirHandle;
      for (let i = 0; i < currentPathStack.length; i++) {
        tempHandle = await tempHandle.getDirectoryHandle(currentPathStack[i], { create: false });
      }
      await renderDirectoryContents(tempHandle, currentPathStack[currentPathStack.length - 1]);
    } catch (e) {
      showToast('Không thể quay lại thư mục cha', 'error');
    }
  } else {
    showToast('Đã quay về gốc', 'success');
    document.getElementById('image-grid').innerHTML = '';
    document.getElementById('folder-name-display').textContent = '—';
  }
}

async function showImagesFromRootForId(id) {
  if (!rootDirHandle) {
    showToast('Vui lòng chọn thư mục gốc trước', 'error');
    return;
  }
  
  try {
    let shortcutDir;
    try {
      shortcutDir = await rootDirHandle.getDirectoryHandle('.shortcut-targets-by-id', { create: false });
    } catch (e) {
      showToast('Không tìm thấy thư mục .shortcut-targets-by-id', 'error');
      return;
    }
    
    let targetDir;
    try {
      targetDir = await shortcutDir.getDirectoryHandle(id, { create: false });
    } catch (e) {
      showToast(`Không tìm thấy thư mục cho ID: ${id}`, 'error');
      return;
    }
    
    currentPathStack = [id];
    await renderDirectoryContents(targetDir, id);
    showToast(`Đã mở ID: ${id}`, 'success');
    
  } catch (e) {
    showToast('Lỗi khi đọc thư mục: ' + (e.message || e), 'error');
  }
}

async function pickRootDir() {
  if (!window.showDirectoryPicker) {
    showToast('Trình duyệt không hỗ trợ File System Access API.', 'error');
    return;
  }
  
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    rootDirHandle = dirHandle;
    document.getElementById('folder-name-display').textContent = dirHandle.name || '—';
    showToast(`Đã chọn thư mục gốc: ${dirHandle.name}`, 'success');
  } catch (e) {
    if (e.name !== 'AbortError') showToast('Lỗi khi chọn thư mục gốc: ' + e.message, 'error');
  }
}

function refreshCurrentImages() {
  if (currentDirHandle) {
    renderDirectoryContents(currentDirHandle);
  } else {
    showToast('Chưa có thư mục nào được chọn', 'error');
  }
}
window.renderDirectoryContents = renderDirectoryContents;
window.drillIntoSubfolder = drillIntoSubfolder;
window.goBackOneLevel = goBackOneLevel;
window.showImagesFromRootForId = showImagesFromRootForId;
window.pickRootDir = pickRootDir;
window.refreshCurrentImages = refreshCurrentImages;