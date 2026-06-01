/**
 * Trạng thái ứng dụng - Phase 2
 * Chúng ta đã chuyển từ FileSystemHandle sang mô hình dựa trên đường dẫn.
 */

let currentDriveRoot = null;          // e.g. "H:\\"
let mappedFolders = [];               // [{ id, name, fullPrettyPath, imageCount, imagePaths: [] }]
let windowParsedDriveIds = [];        // raw Drive IDs from textarea

// Các biến legacy được giữ tạm thời để tương thích trong quá trình chuyển đổi
let rootDirHandle = null;
let currentDirHandle = null;
let currentPathStack = [];