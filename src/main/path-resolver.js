const fs = require('fs-extra');
const path = require('path');

/**
 * Path Resolver cho các shortcut Google Drive
 * 
 * Xử lý:
 * - Tự động phát hiện các điểm mount Google Drive phổ biến (G:, H:, I: ...)
 * - Kiểm tra tính hợp lệ của các thư mục người dùng chọn
 * - Tìm thư mục .shortcut-targets-by-id
 */

const COMMON_DRIVE_LETTERS = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
const ALL_DRIVE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Kiểm tra xem một đường dẫn tuyệt đối có chứa thư mục shortcut Google Drive không.
 * @param {string} rootPath - ví dụ: "H:\\"
 * @returns {Promise<boolean>}
 */
async function hasShortcutTargets(rootPath) {
  try {
    const shortcutDir = path.join(rootPath, '.shortcut-targets-by-id');
    const stat = await fs.stat(shortcutDir);
    return stat.isDirectory();
  } catch (err) {
    return false;
  }
}

/**
 * Tự động quét các chữ cái ổ đĩa phổ biến để tìm mount Google Drive
 * chứa .shortcut-targets-by-id.
 * 
 * Trả về đường dẫn gốc hợp lệ đầu tiên (ví dụ: "H:\\") hoặc null.
 */
/**
 * Chuẩn hóa chữ cái ổ đĩa người dùng nhập → một ký tự A-Z hoặc null.
 */
function normalizeDriveLetter(letter) {
  if (!letter) return null;
  const m = String(letter).trim().toUpperCase().match(/^([A-Z])/);
  return m ? m[1] : null;
}

/**
 * Kiểm tra một chữ cái ổ đĩa cụ thể (ví dụ "H" → "H:\\").
 * Không quét các ổ khác — dùng khi người dùng chọn ổ trong UI.
 */
async function resolveDriveRootFromLetter(letter) {
  const normalized = normalizeDriveLetter(letter);
  if (!normalized) {
    return { valid: false, error: 'Vui lòng nhập một chữ cái ổ đĩa hợp lệ (A-Z).' };
  }

  const rootPath = `${normalized}:\\`;
  const isValid = await hasShortcutTargets(rootPath);
  if (isValid) {
    return { valid: true, rootPath };
  }

  return {
    valid: false,
    error: `Ổ ${normalized}: không tìm thấy Google Drive (.shortcut-targets-by-id). Kiểm tra lại chữ cái ổ hoặc tài khoản Drive đã mount.`
  };
}

/**
 * Liệt kê tất cả ổ (A-Z) đang có mount Google Drive shortcut.
 */
async function listAllGoogleDriveRoots() {
  const found = [];
  for (const letter of ALL_DRIVE_LETTERS) {
    const candidate = `${letter}:\\`;
    try {
      if (await hasShortcutTargets(candidate)) {
        found.push(candidate);
      }
    } catch (e) {
      // ổ không tồn tại — bỏ qua
    }
  }
  return found;
}

async function findGoogleDriveShortcutRoot() {
  for (const letter of COMMON_DRIVE_LETTERS) {
    const candidate = `${letter}:\\`;
    try {
      if (await hasShortcutTargets(candidate)) {
        console.log(`[PathResolver] Found Google Drive at ${candidate}`);
        return candidate;
      }
    } catch (e) {
      // Chữ cái ổ đĩa không tồn tại hoặc không có quyền - bỏ qua im lặng
    }
  }
  console.log('[PathResolver] Không tìm thấy thư mục gốc shortcut Google Drive tự động.');
  return null;
}

/**
 * Kiểm tra xem đường dẫn người dùng cung cấp có phải là thư mục gốc Google Drive
 * hợp lệ chứa .shortcut-targets-by-id không.
 * 
 * @param {string} selectedPath - Thư mục người dùng chọn qua hộp thoại native
 * @returns {Promise<{ valid: boolean, rootPath?: string, error?: string }>}
 */
async function validateDriveRoot(selectedPath) {
  if (!selectedPath) {
    return { valid: false, error: 'No path provided' };
  }

  try {
    // Nếu người dùng chọn chính thư mục .shortcut-targets-by-id, đi lên một cấp
    let candidate = selectedPath;
    const baseName = path.basename(selectedPath);
    if (baseName === '.shortcut-targets-by-id') {
      candidate = path.dirname(selectedPath);
    }

    const isValid = await hasShortcutTargets(candidate);
    if (isValid) {
      return { valid: true, rootPath: candidate };
    } else {
      return { 
        valid: false, 
        error: 'Thư mục này không chứa .shortcut-targets-by-id. Vui lòng chọn đúng thư mục gốc của Google Drive.' 
      };
    }
  } catch (err) {
    return { valid: false, error: err.message || 'Không thể truy cập thư mục' };
  }
}

/**
 * Lấy danh sách tất cả ID thư mục con trực tiếp dưới .shortcut-targets-by-id
 * (hữu ích cho các tính năng tương lai như "hiển thị tất cả ID đã map").
 */
async function listAllShortcutIds(driveRoot) {
  const shortcutDir = path.join(driveRoot, '.shortcut-targets-by-id');
  try {
    const entries = await fs.readdir(shortcutDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch (err) {
    console.error('[PathResolver] Không liệt kê được các ID shortcut:', err);
    return [];
  }
}

/**
 * Hàm cốt lõi cho cấu trúc shortcut Google Drive đúng.
 * 
 * Nhận driveRoot (ví dụ: "G:\") và một ID,
 * tìm thư mục con ĐẦU TIÊN bên trong .shortcut-targets-by-id\<ID>\
 * và trả về đường dẫn thư mục thật nơi ảnh thực sự nằm.
 */
async function resolveIdToRealFolder(driveRoot, id) {
  const idPath = path.join(driveRoot, '.shortcut-targets-by-id', id);

  try {
    const stat = await fs.stat(idPath);
    if (!stat.isDirectory()) {
      return { success: false, error: 'Thư mục ID không phải là thư mục' };
    }

    const entries = await fs.readdir(idPath, { withFileTypes: true });
    const subfolders = entries.filter(e => e.isDirectory());

    let targetFolderPath = idPath;
    let displayName = id;

    if (subfolders.length > 0) {
      // Đây là logic quan trọng được yêu cầu trong editError.md
      const firstRealFolder = subfolders[0].name;
      targetFolderPath = path.join(idPath, firstRealFolder);
      displayName = firstRealFolder;
    }

    // Bây giờ liệt kê ảnh bên trong thư mục đúng
    const allEntries = await fs.readdir(targetFolderPath, { withFileTypes: true });
    const imagePaths = allEntries
      .filter(e => e.isFile() && isImageFile(e.name))
      .map(e => path.join(targetFolderPath, e.name));

    const fullPrettyPath = targetFolderPath;

    return {
      success: true,
      id,
      displayName,
      imageFolderPath: targetFolderPath,
      imagePaths,
      fullPrettyPath
    };

  } catch (err) {
    return {
      success: false,
      id,
      error: err.message || 'Không thể truy cập thư mục ID'
    };
  }
}

// Hàm hỗ trợ kiểm tra đuôi file ảnh (cùng logic với renderer)
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg','.psd' , '.png','.jpeg', '.webp', '.gif', '.bmp'].includes(ext);
}

module.exports = {
  findGoogleDriveShortcutRoot,
  resolveDriveRootFromLetter,
  listAllGoogleDriveRoots,
  normalizeDriveLetter,
  validateDriveRoot,
  hasShortcutTargets,
  listAllShortcutIds,
  resolveIdToRealFolder,
  COMMON_DRIVE_LETTERS
};