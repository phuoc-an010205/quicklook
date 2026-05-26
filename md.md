Tôi đang gặp vấn đề giao diện bị hỏng khi tương tác với phần tải ảnh lên:

### Mô tả lỗi:
- Khi tải ảnh lên (upload), hoặc lướt (scroll) lên xuống nhiều lần trong khu vực hiển thị ảnh/thumbnail.
- Giao diện bị vỡ: thumbnail bị trùng lặp, chồng chéo, hoặc lệch vị trí, đặc biệt ở thanh bottom bar và khu vực preview ảnh.
- Có thể liên quan đến việc render lại danh sách ảnh nhiều lần mà không clean up DOM cũ.

### Yêu cầu fix:

1. **Xử lý render thumbnail an toàn**:
   - Trước khi render danh sách ảnh mới, phải **xóa sạch** container cũ (`innerHTML = ''` hoặc `replaceChildren()`).
   - Sử dụng `document.createDocumentFragment()` để render batch, tránh reflow nhiều lần.

2. **Thêm debounce/throttle** cho sự kiện scroll và upload:
   - Tránh gọi hàm render quá nhiều lần khi user scroll nhanh hoặc upload liên tục.

3. **Sử dụng key hoặc data-id** để quản lý từng thumbnail:
   - Mỗi thumbnail nên có `key` hoặc `data-id` duy nhất để React/Vanilla JS có thể update chính xác thay vì append liên tục.

4. **Thêm CSS fix**:
   - Đảm bảo container thumbnail có `overflow: hidden` hoặc `flex-wrap: nowrap` hợp lý.
   - Sử dụng `position: relative` và clear float nếu cần.
   - Thêm `scroll-behavior: smooth` và reset scroll position khi cần.

5. **Defensive programming**:
   - Kiểm tra `if (!container) return;`
   - Xóa tất cả event listeners cũ trước khi attach listener mới (đặc biệt với scroll).

### File liên quan có thể:
- File quản lý upload và render thumbnail (có thể là onboarding.js hoặc mapping.js)
- File CSS cho bottom bar và image grid
- Component render danh sách ảnh

Hãy đưa ra code sửa cụ thể cho hàm render thumbnail / render image list, kèm theo CSS gợi ý.