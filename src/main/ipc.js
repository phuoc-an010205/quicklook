const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const Store = require('electron-store');

const pathResolver = require('./path-resolver');
const thumbnailer = require('./thumbnailer');

const store = new Store();

/**
 * Tập trung các handler IPC cho QuickLook Phase 2+
 * 
 * Tất cả giao tiếp giữa renderer và main đều đi qua đây.
 * Giúp main.js gọn gàng và API rõ ràng.
 */

// ==================== APP / SYSTEM ====================

ipcMain.handle('app:get-version', () => {
  return require('../../package.json').version;
});

// ==================== DRIVE ROOT MANAGEMENT ====================

ipcMain.handle('drive:auto-detect', async () => {
  const found = await pathResolver.findGoogleDriveShortcutRoot();
  if (found) {
    store.set('driveRoot', found);
  }
  return found;
});

ipcMain.handle('drive:pick-folder', async (event) => {
  const win = event.sender.getOwnerBrowserWindow();
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Chọn thư mục gốc Google Drive',
    message: 'Chọn thư mục chứa .shortcut-targets-by-id (thường là thư mục gốc của ổ Google Drive)'
  });

  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true };
  }

  const selected = result.filePaths[0];
  const validation = await pathResolver.validateDriveRoot(selected);

  if (validation.valid) {
    store.set('driveRoot', validation.rootPath);
    return { canceled: false, rootPath: validation.rootPath };
  } else {
    return { canceled: false, error: validation.error };
  }
});

ipcMain.handle('drive:get-current-root', () => {
  return store.get('driveRoot') || null;
});

ipcMain.handle('drive:set-root', (event, newRoot) => {
  store.set('driveRoot', newRoot);
  return true;
});

// ==================== FILE SYSTEM (replaces FileSystemHandle) ====================

ipcMain.handle('fs:list-images-in-folder', async (event, folderPath) => {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const images = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.jpg','.psd' ,'.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) {
          images.push(path.join(folderPath, entry.name));
        }
      }
    }
    return images;
  } catch (err) {
    console.error('[IPC] list-images-in-folder error:', err);
    throw err;
  }
});

ipcMain.handle('fs:get-folder-info', async (event, folderPath) => {
  try {
    const stat = await fs.stat(folderPath);
    const entries = await fs.readdir(folderPath);
    return {
      name: path.basename(folderPath),
      path: folderPath,
      itemCount: entries.length,
      lastModified: stat.mtime
    };
  } catch (err) {
    return null;
  }
});

// Mới - Giải quyết đúng cấu trúc thư mục con của Google Drive ID
ipcMain.handle('drive:resolve-id', async (event, driveRoot, id) => {
  const pathResolver = require('./path-resolver');
  return pathResolver.resolveIdToRealFolder(driveRoot, id);
});

// ==================== THUMBNAILS ====================

ipcMain.handle('thumbnail:get', async (event, fullImagePath) => {
  return thumbnailer.getOrCreateThumbnail(fullImagePath);
});

ipcMain.handle('thumbnail:get-batch', async (event, imagePaths) => {
  // Giới hạn số lượng đồng thời bên trong thumbnailer
  return thumbnailer.getThumbnailsForPaths(imagePaths, 5);
});

ipcMain.handle('thumbnail:clear-cache', async () => {
  await thumbnailer.clearThumbnailCache();
  return true;
});

// Các API quản lý cache mới
ipcMain.handle('thumbnail:get-cache-stats', async () => {
  return thumbnailer.getCacheStats();
});

ipcMain.handle('thumbnail:prune-cache', async (event, maxSizeMB) => {
  return thumbnailer.pruneCache(maxSizeMB);
});

// ==================== UTILITIES ====================

ipcMain.handle('utils:open-in-explorer', async (event, targetPath) => {
  const { shell } = require('electron');
  await shell.showItemInFolder(targetPath);
});

console.log('[IPC] Đã đăng ký tất cả handler IPC của QuickLook.');