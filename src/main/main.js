const { app, BrowserWindow } = require('electron');
const path = require('path');

process.on('uncaughtException', (err) => {
  console.error('[Main] UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] UNHANDLED REJECTION:', reason);
});

// Single instance lock - rất quan trọng để tránh nhiều cửa sổ ẩn hoặc "treo"
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main] Another instance is running, quitting this one.');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('[Main] Second instance detected, focusing existing window.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
    }
  });
}

// Import tất cả handler IPC (đăng ký chúng)
require('./ipc');

let mainWindow = null;

function createMainWindow() {
  console.log('[Main] createMainWindow called');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    center: true,
    title: 'QuickLook - Google Drive ID Mapper',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#020617',
    autoHideMenuBar: true,
  });

  const rendererPath = path.join(__dirname, '../renderer/index.html');
  console.log('[Main] loadFile path =', rendererPath);

  mainWindow.loadFile(rendererPath)
    .then(() => {
      console.log('[Main] loadFile resolved successfully');
    })
    .catch((err) => {
      console.error('[Main] loadFile failed with error:', err);
    });

  // Robust show logic for Windows
  const forceShowWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    console.log('[Main] Attempting to show window...');

    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }

    mainWindow.center();
    mainWindow.focus();

    // Windows trick to bring to front reliably
    if (process.platform === 'win32') {
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setAlwaysOnTop(false);
    }

    console.log('[Main] Window should now be visible');
  };

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] did-finish-load');
    // Small delay to ensure painting
    setTimeout(forceShowWindow, 100);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] did-fail-load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Main] render-process-gone', details);
  });

  // Multiple fallbacks
  setTimeout(forceShowWindow, 800);
  setTimeout(forceShowWindow, 2000);
  setTimeout(forceShowWindow, 5000);

  mainWindow.once('ready-to-show', () => {
    console.log('[Main] ready-to-show event');
    forceShowWindow();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // For debugging: uncomment to open DevTools automatically in dev
  // if (!app.isPackaged) {
  //   mainWindow.webContents.openDevTools({ mode: 'detach' });
  // }
}

function getIconPath() {
  // Placeholder - sau này sẽ thêm icon thật vào assets/icons
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, '../../assets/icons', iconName);

  // Trả về mặc định nếu chưa có icon (Electron sẽ dùng icon của nó)
  try {
    require('fs').accessSync(iconPath);
    return iconPath;
  } catch {
    return undefined;
  }
}

// ==================== APP LIFECYCLE ====================

app.whenReady().then(() => {
  console.log('[Main] app.whenReady fired - creating window');

  createMainWindow();

  // Auto prune (background)
  setTimeout(() => {
    try {
      const { pruneCache } = require('./thumbnailer');
      pruneCache(1024).catch(err => console.warn('[Main] prune failed', err));
    } catch (e) {
      console.warn('[Main] prune require failed', e);
    }
  }, 8000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}).catch(err => {
  console.error('[Main] FATAL: app.whenReady rejected', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('[Main] Tiến trình chính QuickLook Electron đã khởi động.');