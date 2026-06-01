Hãy nâng cấp toàn diện dự án này thành một ứng dụng Desktop hoàn chỉnh và sửa các lỗi giao diện hiện tại theo các yêu cầu chi tiết sau:

1. KIẾN TRÚC ĐỨNG ĐỘC LẬP (KHÔNG CẦN CÀI NODE.JS):
- Hãy cấu hình và tích hợp Electron (hoặc sử dụng thư viện `pkg` để đóng gói một server Node.js nội bộ) để biến dự án này thành một ứng dụng Windows (.exe) chạy độc lập. Người dùng cuối chỉ cần mở ứng dụng là dùng được ngay, hoàn toàn không cần cài đặt môi trường Node.js trên máy tính của họ.
- Viết phần Backend bằng Node.js để thay thế cho showDirectoryPicker của trình duyệt. Sử dụng thư viện `fs` để đọc trực tiếp dữ liệu từ ổ đĩa ảo "G:\.shortcut-targets-by-id\...".
- Tích hợp thư viện xử lý ảnh (như `sharp`) ở backend để tự động nén, tạo ảnh thu nhỏ (Thumbnail) khoảng 30KB - 50KB từ ảnh gốc nặng trên ổ G, sau đó lưu tạm thời (Cache) vào một thư mục local trên máy để tối ưu hóa tốc độ tải hình ở lần chạy sau lên mức tối đa.

2. FIX LỖI TRÙNG LẶP DỮ LIỆU (DUPLICATION BUG):
- Hiện tại, mỗi khi người dùng bấm nút "Map tất cả ID" lần thứ 2 hoặc nhiều lần tiếp theo, các hàng dữ liệu và hình ảnh của các link Drive cũ không được xóa đi mà bị lặp đi lặp lại nhiều lần bên dưới giao diện.
- Hãy chỉnh sửa logic code sao cho: Ngay khi bấm nút "Map tất cả ID", hệ thống phải tự động xóa sạch (clear/reset) toàn bộ dữ liệu, mảng lưu trữ tạm và các phần tử HTML cũ trong khu vực hiển thị trước khi tiến hành nạp và vẽ luồng dữ liệu mới.

3. FIX LỖI ĐẨY KHUNG GIAO DIỆN (UI LAYOUT SHIFT):
- Hiện tại, khi có thông báo hệ thống xuất hiện (ví dụ dòng chữ "Đã phát hiện 68 ID" ở góc trên bên trái), nó đang chiếm diện tích và đẩy toàn bộ khối giao diện chính (Form nhập liệu, các nút bấm, khung hình) bị sụt xuống dưới hoặc lệch sang bên, làm mất thẩm mỹ.
- Hãy chỉnh sửa lại CSS cho phần thông báo này, chuyển sang dạng position: fixed hoặc position: absolute (overlay) trôi nổi trên bề mặt giao diện để khi nó ẩn/hiện, cấu trúc cố định của các thành phần chính bên dưới hoàn toàn không bị ảnh hưởng hay dịch chuyển.

Hãy lập kế hoạch chi tiết cho các file cần tạo mới (như main.js của Electron hoặc server.js) và các file cần chỉnh sửa (index.html, CSS, mapping.js) rồi hiển thị cho tôi duyệt.