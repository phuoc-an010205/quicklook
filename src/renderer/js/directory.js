// ==================== DIRECTORY OPERATIONS - PHASE 2 (Electron Native) ====================

/**
 * Bộ chọn thư mục gốc sử dụng dialog native của Electron.
 * Thay thế cho showDirectoryPicker cũ của trình duyệt.
 */
async function pickRootDir() {
  try {
    // Ưu tiên tự động phát hiện trước
    let root = await window.electronAPI.getCurrentDriveRoot();

    if (!root) {
      root = await window.electronAPI.autoDetectDrive();
    }

    if (root) {
      window.currentDriveRoot = root;
      showToast(`Đã tự động phát hiện: ${root}`, 'success');
      return root;
    }

    // Không tự động phát hiện được → để người dùng chọn
    const result = await window.electronAPI.pickDriveFolder();

    if (result.canceled) {
      return null;
    }

    if (result.error) {
      showToast(result.error, 'error');
      return null;
    }

    window.currentDriveRoot = result.rootPath;
    showToast(`Đã chọn thư mục gốc: ${result.rootPath}`, 'success');
    return result.rootPath;

  } catch (err) {
    console.error(err);
    showToast('Lỗi khi chọn thư mục: ' + err.message, 'error');
    return null;
  }
}

// Export để tương thích ngược (với code cũ)
window.pickRootDir = pickRootDir;