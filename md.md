Tôi đang gặp lỗi trong dự án JavaScript/React:

1. ReferenceError: renderDirectoryContents is not defined tại main.js:42
2. TypeError: Cannot read properties of undefined (reading 'getImageNode') trong onboarding.js
3. TypeError: Cannot set properties of null (setting 'innerHTML') tại renderMappedTable trong mapping.js:220 và mapAllParsedIds:146

Hãy giúp tôi sửa theo thứ tự ưu tiên:

- Kiểm tra và import/define hàm renderDirectoryContents
- Thêm null check / optional chaining cho các chỗ truy cập .getImageNode và .innerHTML
- Sửa logic renderMappedTable để tránh set innerHTML khi element là null
- Thêm defensive programming (early return nếu data undefined)

Cung cấp code sửa cụ thể cho các file: main.js, onboarding.js, mapping.js