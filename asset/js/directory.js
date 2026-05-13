// ==================== DIRECTORY OPERATIONS (PHIÊN BẢN TINH GỌN) ====================

// Chỉ giữ lại hàm chọn thư mục gốc (vẫn đang được dùng)
async function pickRootDir() {
  if (!window.showDirectoryPicker) {
    showToast('Trình duyệt không hỗ trợ File System Access API.', 'error');
    return;
  }
  
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    rootDirHandle = dirHandle;
    showToast(`Đã chọn thư mục gốc: ${dirHandle.name}`, 'success');
    
    // Reset các biến trạng thái (nếu có)
    currentDirHandle = null;
    currentPathStack = [];
  } catch (e) {
    if (e.name !== 'AbortError') {
      showToast('Lỗi khi chọn thư mục gốc: ' + e.message, 'error');
    }
  }
}

// ==================== XUẤT HÀM RA TOÀN CỤC ====================
// Chỉ export những gì còn thực sự dùng
window.pickRootDir = pickRootDir;