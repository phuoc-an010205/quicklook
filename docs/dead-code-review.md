# Dead Code Review - QuickLook

## Mục đích
File này dùng để theo dõi các phần code JavaScript và HTML hiện tại **không còn được sử dụng**, nhằm làm sạch dự án trước khi build phân phối.

---

## Kết quả review gần nhất (2026)

### 1. src/renderer/index.html
**Đã xóa / không còn:**
- Không phát hiện đoạn HTML chết lớn.
- Script "Desktop mode detection" vẫn đang dùng (có badge và log).

**Gợi ý:**
- Có thể cân nhắc xóa script desktop detection nếu không còn muốn phân biệt dev/prod trong UI.

### 2. src/renderer/js/main.js (Renderer)
**Đã xóa:**
- Listener cho `btn-refresh` (vì nút này không còn tồn tại trong HTML và hàm `refreshCurrentImages` cũng đã bị xóa từ trước).
- Các comment legacy directory functions (renderDirectoryContents, drillIntoSubfolder, v.v.).

**Hiện tại còn:**
- Code lắng nghe 3 nút chính: `btn-parse-links`, `btn-pick-root`, `btn-map-all`, `btn-reload-previews`.

### 3. src/renderer/js/mapping.js
**Đã xóa (theo yêu cầu người dùng):**
- Toàn bộ logic modal đơn giản (openImageModal, closeImageModal, initImageModal) theo yeucau.md.
- Các hàm cũ: `resolveImageSource`, `renderMappedTable`, `showImagesInline`, `loadImagesToGrid`, `previewFullImage` (phiên bản cũ).
- `displayParsedIds` và `removeParsedId` (vì giao diện parsed IDs list đã bị bỏ).

**Hiện tại:**
- Code khá sạch. Các hàm chính đều đang được gọi.
- Không phát hiện hàm chết rõ ràng.

### 4. src/renderer/js/utils.js
**Hiện tại:**
- `openImageModal` và `previewFullImage` vẫn được giữ lại (dùng cho một số trường hợp preview).
- Các hàm `downloadImage`, `showToast` đang được dùng.

**Gợi ý:**
- Nếu sau này không còn dùng `previewFullImage` nữa thì có thể xóa.

### 5. src/renderer/js/directory.js
**Hiện tại:**
- Chỉ còn hàm `pickRootDir`.
- Đã được chuyển sang dùng native dialog của Electron.

### 6. Các file khác
- `state.js`: Giữ lại các biến legacy (`rootDirHandle`, ...) để tương thích trong quá trình chuyển đổi. Có thể xóa sau khi ổn định hoàn toàn.
- `preload.js`: Đang expose đúng các API cần thiết.

---

## Các hành động đã thực hiện

- [x] Xóa listener `btn-refresh`
- [x] Xóa comment legacy directory functions
- [x] Xóa toàn bộ modal đơn giản (yeucau.md)
- [x] Dọn comment tiếng Anh → tiếng Việt ở nhiều file
- [x] Tạo file `docs/code-overview.md`

---

## Gợi ý tiếp theo (nếu muốn dọn thêm)

1. Xóa các biến legacy trong `state.js` sau khi đã ổn định hoàn toàn sang path-based model.
2. Xóa `previewFullImage` trong `utils.js` nếu không còn dùng ở bất kỳ đâu.
3. Xóa script desktop detection trong `index.html` nếu không còn cần phân biệt môi trường.

---

*Cập nhật lần cuối: 2026*