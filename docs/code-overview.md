# QuickLook - Code Overview

## Mục đích của ứng dụng
QuickLook là ứng dụng desktop giúp người dùng **map ID thư mục Google Drive** với ảnh thực tế trên ổ đĩa (Google Drive for Desktop). Ứng dụng hỗ trợ xem trước ảnh, tạo thumbnail nhanh, và quản lý cache.

## Kiến trúc tổng thể

Ứng dụng được xây dựng bằng **Electron** (Node.js + Chromium), gồm 2 phần chính:

- **Main Process** (`src/main/`): Chạy nền, có quyền truy cập file system, sharp, IPC.
- **Renderer Process** (`src/renderer/`): Giao diện người dùng (HTML + JS + CSS), chạy trong cửa sổ BrowserWindow.

### Cấu trúc thư mục quan trọng

```
src/
├── main/
│   ├── main.js              # Khởi tạo cửa sổ, lifecycle app, gọi prune cache
│   ├── ipc.js               # Tập trung tất cả IPC handlers (giao tiếp với renderer)
│   ├── thumbnailer.js       # Tạo thumbnail bằng sharp + quản lý cache
│   └── path-resolver.js     # Xử lý đường dẫn Google Drive (.shortcut-targets-by-id)
├── preload/
│   └── preload.js           # Cầu nối an toàn (contextBridge) giữa main và renderer
└── renderer/
    ├── index.html
    ├── js/
    │   ├── mapping.js       # Logic chính: parse link, map ID, render gallery
    │   ├── utils.js         # Hàm tiện ích (modal, toast, download...)
    │   ├── directory.js     # Chọn thư mục gốc (native dialog)
    │   └── ...
    └── styles/
```

## Các Module quan trọng

### 1. thumbnailer.js (Main Process)
- Chịu trách nhiệm tạo thumbnail từ ảnh gốc bằng thư viện **sharp**.
- Quản lý cache thumbnail để tăng tốc độ load lần sau.
- Hỗ trợ dọn cache theo kích thước (LRU) và theo thời gian.
- **Lưu ý quan trọng**: Đã được viết để hoạt động an toàn cả khi app được đóng gói ASAR.

### 2. path-resolver.js (Main Process)
- Xử lý cấu trúc đặc biệt của Google Drive shortcut:
  - `Drive:\.shortcut-targets-by-id\<ID>\<Tên thư mục thật>\`
- Tự động phát hiện ổ đĩa Google Drive.
- Kiểm tra và trả về đường dẫn ảnh thực tế.

### 3. ipc.js (Main Process)
- Tập trung tất cả các handler IPC.
- Các nhóm chính:
  - Drive root management
  - File system operations (thay thế FileSystemHandle)
  - Thumbnail requests
  - Cache management

### 4. mapping.js (Renderer)
- Logic cốt lõi của giao diện:
  - Phân tích link Drive → lấy ID
  - Map ID → lấy danh sách ảnh thực tế
  - Render gallery + lazy load thumbnail
- Tương tác chính với main process qua `window.electronAPI`

### 5. preload.js
- Sử dụng `contextBridge` để expose API an toàn cho renderer.
- Renderer không được phép gọi trực tiếp Node.js hay Electron API.

## Luồng hoạt động chính

1. Người dùng dán link Google Drive → `parseDriveLinks()`
2. Click "Map tất cả ID" → `mapAllParsedIds()`
3. Gọi IPC `drive:resolve-id` → Backend trả về danh sách ảnh + đường dẫn thực
4. Render gallery → Sử dụng IntersectionObserver để lazy load thumbnail
5. Khi cần thumbnail → Gọi `thumbnail:get` → Backend dùng sharp tạo hoặc lấy từ cache

## Lưu ý khi phát triển

- **Không dùng `__dirname`** để tạo đường dẫn cache/user data trong production (sẽ bị lỗi ASAR).
- Ưu tiên sử dụng `app.getPath('userData')` hoặc biến môi trường `QUICKLOOK_SHARED_PATH`.
- Khi build, nên dùng script `npm run build:internal` để tự động copy file portable ra thư mục chia sẻ.
- Modal ảnh đơn giản (theo yeucau.md) đã được xóa theo yêu cầu người dùng.

## Tình trạng hiện tại (cập nhật mới nhất)

- Đã loại bỏ modal ảnh đơn giản (click vào ảnh không còn mở modal nữa).
- Đã bỏ hầu hết hiệu ứng hover/click trên ảnh trong gallery.
- Đã hỗ trợ build nội bộ tự động copy file .exe.
- Đã sửa lỗi build liên quan đến ASAR + Sharp + winCodeSign.

---

*File này được tạo để hỗ trợ bảo trì và onboard người mới.*