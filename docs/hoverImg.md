# Hiệu ứng hover & xem ảnh (QuickLook)

## Hover trên thumbnail (gallery)

| Hành vi | Chi tiết |
|---------|----------|
| Di chuột vào | Zoom nhẹ + viền xanh + overlay tên file |
| Giữ ~320ms (đã load ảnh) | Khung `#image-hover-preview` hiện **ảnh gốc** `file://`, fade-in, theo con trỏ |
| Di chuyển chuột | Preview di chuyển theo, không nhảy góc (0,0) |
| Rời thẻ | Fade-out preview, bỏ highlight |
| Click | `previewFullImage` — modal fade-in/out |

## Click — `previewFullImage` (utils.js)

- Nền mờ `backdrop-filter`, fade-in/out 300ms
- Ảnh scale 0.95 → 1 khi mở
- Đóng: nút ×, click nền, phím Esc
- Chỉ `URL.revokeObjectURL` khi URL là `blob:` (không áp dụng `file://`)

## File

- `mapping.js` — hover + gọi preview
- `utils.js` — `previewFullImage`
- `style.css` — `.image-preview-modal`, `#image-hover-preview`