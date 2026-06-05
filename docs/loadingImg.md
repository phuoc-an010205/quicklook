# Hiệu ứng Loading (chú gấu) — đã tích hợp

## Vị trí

| Loader | Khi nào hiện |
|--------|----------------|
| `#image-loader` (toàn gallery) | Map ID, render gallery, tải lại ảnh |
| `.placeholder` (từng ô) | Chỉ chữ "Đang tải..." — không dùng gấu |
| `#modal-image-loader` | Mở modal xem ảnh full |

## Điều khiển (utils.js)

- `showImageLoader(text)` — bỏ class `hidden` khỏi `#image-loader`
- `hideImageLoader()` — thêm class `hidden`
## Logic ẩn loader

- **Card:** sau `img.onload` hoặc lỗi → ẩn placeholder (không có animation gấu)
- **Modal:** `img.load` / `img.error` trên `.image-preview-modal__img`
- **Global:** `finally` sau `mapAllParsedIds` / `renderAllPreviewsBulk`

## File

- `index.html` — `#image-loader` trong `.all-previews-wrap`
- `style.css` — toàn bộ animation chú gấu + biến thể `--card`, `--modal`
- `utils.js`, `mapping.js` — gọi show/hide