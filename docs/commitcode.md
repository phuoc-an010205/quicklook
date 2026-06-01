# Commit & Changelog - QuickLook

## Mục đích
File này dùng để ghi lại tóm tắt các thay đổi quan trọng trong quá trình phát triển, giúp dễ dàng viết commit message và theo dõi lịch sử dự án.

---

## Lịch sử thay đổi gần đây

### 2026-06
- **Refactor & Dọn dẹp code lớn**
  - Di chuyển toàn bộ code frontend sang cấu trúc `src/renderer/`
  - Xóa hoàn toàn thư mục `asset/` cũ (bao gồm `asset/js/mapping.js` và các file legacy)
  - Loại bỏ toàn bộ code chết (dead code) liên quan đến modal đơn giản, các hàm legacy directory, render bảng cũ...
  - Sửa lỗi merge conflict còn sót trong `src/renderer/js/main.js`

- **Dịch toàn bộ comment sang tiếng Việt**
  - Đã dịch sạch comment (// và /* */) ở tất cả các file code chính sang tiếng Việt tự nhiên và chuyên nghiệp.
  - Các file đã được dịch: `thumbnailer.js`, `ipc.js`, `path-resolver.js`, `main.js`, `preload.js`, `utils.js`, `mapping.js`, `directory.js`, `state.js`...

- **Cải thiện trải nghiệm người dùng cuối**
  - Bỏ hoàn toàn chức năng click vào ảnh để mở modal (theo yêu cầu)
  - Bỏ các hiệu ứng hover và click visual trên ảnh trong gallery
  - Giữ lại chức năng cơ bản: xem danh sách ảnh, tải lại, chọn thư mục gốc

- **Cải thiện quy trình Build & Phân phối nội bộ**
  - Tạo script `npm run build:internal` hỗ trợ build tự động + copy file portable ra thư mục chia sẻ
  - Cập nhật `electron-builder.yml` để build ổn định hơn (xử lý Sharp, tắt forceCodeSigning cho build nội bộ)
  - Sửa nhiều lỗi build liên quan đến ASAR, winCodeSign, JSON syntax

- **Tài liệu hóa dự án**
  - Tạo `docs/code-overview.md` - giải thích kiến trúc và các module quan trọng
  - Tạo `docs/dead-code-review.md` - theo dõi và review code không còn sử dụng
  - Tạo `docs/commitcode.md` (file này) - hỗ trợ viết commit và changelog

### Trước đó
- Hoàn thiện Phase 2: Tích hợp backend Node.js + Sharp thumbnail
- Sửa lỗi ASAR khi chạy file .exe (ENOTDIR khi tạo cache)
- Thêm cơ chế quản lý cache thumbnail thông minh (theo kích thước + thời gian)

---

## Hướng dẫn viết Commit Message

Khi commit, nên dùng format sau (tiếng Việt hoặc tiếng Anh đều được):

```
<type>: <mô tả ngắn gọn>

[Chi tiết thay đổi nếu cần]

Ví dụ:
- feat: thêm chức năng xóa cache thủ công
- fix: sửa lỗi build do winCodeSign trên Windows
- refactor: dọn dead code và dịch comment sang tiếng Việt
- docs: cập nhật code-overview.md
- chore: cập nhật script build-internal
```

**Các type phổ biến:**
- `feat`: Tính năng mới
- `fix`: Sửa lỗi
- `refactor`: Thay đổi code nhưng không thêm tính năng mới
- `chore`: Các thay đổi không liên quan code (build, config, script...)
- `docs`: Cập nhật tài liệu
- `style`: Format code, không thay đổi logic

---

## Lưu ý khi làm việc

- Luôn kiểm tra file `docs/dead-code-review.md` trước khi xóa code.
- Tránh để lại merge conflict trong code.
- Khi build nội bộ, ưu tiên dùng `npm run build:internal`.
- Luôn test file .exe sau khi build thay vì chỉ test bằng `npm start`.

---

*Cập nhật lần cuối: 2026*