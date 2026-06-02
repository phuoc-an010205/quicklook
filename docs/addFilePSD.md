# Hỗ trợ file PSD (đã triển khai)

## Vấn đề

Thẻ `<img>` không render trực tiếp `.psd` → lỗi thumbnail dù đuôi file đã được nhận diện.

## Giải pháp

| Bước | Chi tiết |
|------|----------|
| Main process | `ag-psd` + `@napi-rs/canvas` đọc composite/thumbnail PSD → PNG |
| Cache | `sharp` chuyển PNG → `.webp` trong `thumbnail-cache` (giống ảnh thường) |
| Renderer | Nhận `thumbPath` qua IPC; PSD xem lớn dùng **data URL** PNG (base64) |
| Lỗi / file quá lớn | Icon placeholder `__psd_placeholder__.webp` (tối đa 200MB/PSD) |

## File chính

- `src/main/psd-thumbnail.js` — rasterize PSD
- `src/main/thumbnailer.js` — nhánh `.psd`, placeholder, `getPsdPreviewDataUrl`
- `src/main/ipc.js` — `thumbnail:get`, `image:get-display-source`
- `src/renderer/js/mapping.js` — `resolveDisplaySrc`, hover/click PSD

## API IPC

```js
// Thumbnail gallery
electronAPI.getThumbnail(path) → { thumbPath, isPsd, isPlaceholder }

// Hover / modal
electronAPI.getImageDisplaySource(path) → { kind: 'dataUrl'|'file', src, isPsd }
```

## Ghi chú

- PSD 16-bit / PSB / CMYK có thể không đọc được (giới hạn `ag-psd`).
- Sau khi cài dependency: `npm install` và khởi động lại app Electron.