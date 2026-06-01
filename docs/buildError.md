Ứng dụng sau khi build thành file .exe gặp lỗi "Uncaught Exception: Error: ENOTDIR, not a directory" tại hàm mkdirSync trong file main.js khi khởi chạy. 

Nguyên nhân là do khi đóng gói ASAR, ứng dụng không thể dùng lệnh tạo thư mục (mkdirSync) hoặc ghi file với đường dẫn tương đối trỏ vào bên trong gói app.asar hoặc thư mục giải nén Temp.

Hãy sửa lại file main.js giúp tôi:
1. Tìm tất cả các lệnh `fs.mkdirSync` hoặc các logic tạo thư mục/ghi file ở đầu file main.js.
2. Chuyển đổi các đường dẫn đó sang đường dẫn an toàn bên ngoài app.asar. Cụ thể:
   - Sử dụng `app.getPath('userData')` nếu đó là thư mục lưu cache/cấu hình của app.
   - Hoặc kiểm tra xem biến môi trường `process.env.QUICKLOOK_SHARED_PATH` đã được đọc một cách an toàn chưa (tránh việc kết hợp đường dẫn sai cách với __dirname).
3. Đảm bảo ứng dụng chạy mượt mà ở cả môi trường phát triển (Development) lẫn sau khi đóng gói (Production).

Hãy lập kế hoạch và sửa file main.js giúp tôi.