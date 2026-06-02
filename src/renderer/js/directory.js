// ==================== DIRECTORY OPERATIONS - PHASE 2 (Electron Native) ====================

/**
 * Lấy chữ cái ổ đĩa từ ô #drive-letter-input (một ký tự A-Z).
 */
function getDriveLetterFromInput() {
  const el = document.getElementById('drive-letter-input');
  if (!el || !el.value) return '';
  return el.value.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
}

/**
 * Đồng bộ ô nhập ổ đĩa từ đường dẫn gốc đã lưu (ví dụ "H:\\" → "H").
 */
function syncDriveLetterInputFromRoot(rootPath) {
  if (!rootPath) return;
  const m = String(rootPath).match(/^([A-Za-z]):/);
  if (!m) return;
  const el = document.getElementById('drive-letter-input');
  if (el) el.value = m[1].toUpperCase();
}

/**
 * Xác định thư mục gốc Google Drive theo chữ cái ổ người dùng nhập.
 * Không dùng auto-detect quét G: trước — tránh nhầm khi máy có nhiều ổ Drive.
 */
async function resolveDriveRootFromUI() {
  const letter = getDriveLetterFromInput();
  if (!letter) {
    showToast('Vui lòng nhập chữ cái ổ đĩa (A-Z)', 'error');
    return null;
  }

  if (!window.electronAPI || typeof window.electronAPI.resolveDriveFromLetter !== 'function') {
    const fallback = `${letter}:\\`;
    window.currentDriveRoot = fallback;
    return fallback;
  }

  const result = await window.electronAPI.resolveDriveFromLetter(letter);
  if (result && result.valid && result.rootPath) {
    window.currentDriveRoot = result.rootPath;
    syncDriveLetterInputFromRoot(result.rootPath);
    return result.rootPath;
  }

  let hint = result?.error || `Ổ ${letter}: không hợp lệ`;
  try {
    const mounts = await window.electronAPI.listDriveMounts();
    if (mounts && mounts.length > 0) {
      hint += `. Các ổ Drive đang có: ${mounts.join(', ')}`;
    }
  } catch (e) {
    // bỏ qua
  }

  showToast(hint, 'error');
  return null;
}

/**
 * Khởi tạo: không ghi đè ô drive-letter-input bằng ổ auto-detect cũ (ví dụ G:).
 * Map luôn đọc chữ cái từ ô nhập khi bấm "Map tất cả ID".
 */
async function initDriveLetterFromStore() {
  window.currentDriveRoot = null;
}

/**
 * Bộ chọn thư mục gốc — ưu tiên ô drive-letter-input, sau đó hộp thoại native.
 */
async function pickRootDir() {
  try {
    const fromInput = await resolveDriveRootFromUI();
    if (fromInput) {
      showToast(`Đã dùng ổ đĩa: ${fromInput}`, 'success');
      return fromInput;
    }

    if (!window.electronAPI) {
      showToast('Chỉ hỗ trợ chọn ổ trong chế độ Desktop', 'error');
      return null;
    }

    const result = await window.electronAPI.pickDriveFolder();

    if (result.canceled) {
      return null;
    }

    if (result.error) {
      showToast(result.error, 'error');
      return null;
    }

    window.currentDriveRoot = result.rootPath;
    syncDriveLetterInputFromRoot(result.rootPath);
    showToast(`Đã chọn thư mục gốc: ${result.rootPath}`, 'success');
    return result.rootPath;

  } catch (err) {
    console.error(err);
    showToast('Lỗi khi chọn thư mục: ' + err.message, 'error');
    return null;
  }
}

window.getDriveLetterFromInput = getDriveLetterFromInput;
window.resolveDriveRootFromUI = resolveDriveRootFromUI;
window.initDriveLetterFromStore = initDriveLetterFromStore;
window.pickRootDir = pickRootDir;