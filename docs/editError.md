✅ ĐÃ SỬA XONG (cập nhật 2026)

Logic tìm kiếm đường dẫn đã được sửa theo đúng yêu cầu:

- Backend (path-resolver.js + ipc.js) giờ có hàm `resolveIdToRealFolder`
- Khi nhận ID, backend sẽ tự động:
  1. Vào `driveRoot\.shortcut-targets-by-id\<ID>`
  2. Quét và lấy tên thư mục con đầu tiên
  3. Dùng đường dẫn đầy đủ `<ID>\<Tên_Thư_Mục_Thật>` để liệt kê ảnh
  4. Trả về `displayName` + `imagePaths` + `fullPrettyPath` đúng

- Frontend (mapping.js) đã được cập nhật để gọi `electronAPI.resolveDriveId()`

Dưới đây là nội dung gốc của yêu cầu (đã xử lý):

1. ĐẶC TÍNH ĐƯỜNG DẪN GOOGLE DRIVE:
Cấu trúc chuẩn để vào đến nơi chứa ảnh của một shortcut ID luôn là:
"G:\.shortcut-targets-by-id\<ID_Thư_mục>\<Tên_Thư_Mục_Thật_Bên_Trong>\"

2. LOGIC CẦN CHỈNH SỬA Ở BACKEND (Node.js):
- Khi frontend gửi lên một ID (ví dụ: 1lx09XH09yMph1y_V_BcfdCYZRrDcK9uY), backend KHÔNG ĐƯỢC đọc ảnh trực tiếp từ đường dẫn "G:\.shortcut-targets-by-id\" + ID.
- Hãy bổ sung một bước: Sử dụng `fs.readdirSync` để quét kiểm tra bên trong thư mục "G:\.shortcut-targets-by-id\<ID>\". 
- Lấy ra tên của thư mục con đầu tiên xuất hiện bên trong đó (đó chính là Tên Thư Mục Thật).
- Nối chuỗi lại để có đường dẫn hoàn chỉnh: "G:\.shortcut-targets-by-id\<ID>\<Tên_Thư_Mục_Thật>".
- Sau đó, dùng đường dẫn hoàn chỉnh này để quét và trả về danh sách các file ảnh, đồng thời gửi ngược lại cái tên thư mục thật đó lên Frontend để hiển thị thay vì hiển thị lặp lại chuỗi ID.

Hãy cập nhật lại code ở cả file xử lý Backend (main.js / index.js của Electron) và Frontend (mapping.js) để đồng bộ luồng dữ liệu này nhé.