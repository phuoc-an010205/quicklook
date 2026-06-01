const { app, BrowserWindow } = require('electron');
const path = require('path');

// Import tất cả handler IPC (đăng ký chúng)
require('./ipc');

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: 'QuickLook - Google Drive ID Mapper',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Chúng ta sẽ dần dần expose các API an toàn qua preload + contextBridge
    },
    show: false, // hiển thị sau khi ready-to-show để UX tốt hơn
    backgroundColor: '#020617',
    autoHideMenuBar: true, // cleaner look; we can add a proper menu later
  });

  // Tải renderer (giao diện web đã được làm sạch)
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(rendererPath);

  // Mở DevTools khi đang phát triển
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Bảo mật cơ bản: ngăn điều hướng đến URL bên ngoài
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Hiện tại chặn tất cả cửa sổ mới. Sau này có thể cho phép một số trường hợp cụ thể.
    return { action: 'deny' };
  });
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
  createMainWindow();

  // Tự động dọn cache thumbnail khi khởi động (chạy nền, không chặn)
  // Đây là cách ổn định lâu dài nhất để ngăn cache phình to.
  setTimeout(() => {
    const { pruneCache } = require('./thumbnailer');
    pruneCache(1024).catch(err => {
      console.warn('[Main] Cache prune failed:', err);
    });
  }, 8000); // Trì hoãn 8 giây để không làm chậm quá trình khởi động app

  // macOS: tạo lại cửa sổ khi click icon dock và không có cửa sổ nào mở
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('[Main] Tiến trình chính QuickLook Electron đã khởi động.');