const { contextBridge, ipcRenderer } = require('electron');

/**
 * QuickLook Preload - Phase 2
 * Cầu nối an toàn giữa renderer và main process.
 */

const electronAPI = {
  // === App ===
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  // === Quản lý Drive Root (MỚI trong Phase 2) ===
  autoDetectDrive: () => ipcRenderer.invoke('drive:auto-detect'),
  resolveDriveFromLetter: (letter) => ipcRenderer.invoke('drive:resolve-from-letter', letter),
  listDriveMounts: () => ipcRenderer.invoke('drive:list-mounts'),
  pickDriveFolder: () => ipcRenderer.invoke('drive:pick-folder'),
  getCurrentDriveRoot: () => ipcRenderer.invoke('drive:get-current-root'),
  setDriveRoot: (rootPath) => ipcRenderer.invoke('drive:set-root', rootPath),

  // === File System (replaces FileSystemHandle) ===
  listImagesInFolder: (folderPath) => ipcRenderer.invoke('fs:list-images-in-folder', folderPath),
  getFolderInfo: (folderPath) => ipcRenderer.invoke('fs:get-folder-info', folderPath),

  // MỚI: Giải quyết đúng shortcut Google Drive (xác định thư mục con thực dưới ID)
  resolveDriveId: (driveRoot, id) => ipcRenderer.invoke('drive:resolve-id', driveRoot, id),

  // === Thumbnails (phần cốt lõi của Phase 2) ===
  getThumbnail: (fullImagePath) => ipcRenderer.invoke('thumbnail:get', fullImagePath),
  getImageDisplaySource: (fullImagePath) => ipcRenderer.invoke('image:get-display-source', fullImagePath),
  getThumbnailsBatch: (imagePaths) => ipcRenderer.invoke('thumbnail:get-batch', imagePaths),
  clearThumbnailCache: () => ipcRenderer.invoke('thumbnail:clear-cache'),

  // Quản lý cache (mới)
  getCacheStats: () => ipcRenderer.invoke('thumbnail:get-cache-stats'),
  pruneCache: (maxSizeMB) => ipcRenderer.invoke('thumbnail:prune-cache', maxSizeMB),

  // === Tiện ích ===
  openInExplorer: (targetPath) => ipcRenderer.invoke('utils:open-in-explorer', targetPath),

  // Nền tảng
  platform: process.platform,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

console.log('%c[Preload] QuickLook Phase 2 API đã sẵn sàng', 'color:#34d399');