Hãy thêm một tính năng modal (popup) ảnh khi người dùng click vào bất kỳ hình ảnh nào trong lưới ảnh dự án:

1. CẤU TRÚC HTML: Thêm một phần tử modal ẩn vào cuối file index.html. Cấu trúc gồm:
   - Một container modal (#imageModal) che toàn màn hình.
   - Một container nội dung modal (.modal-content) để căn giữa.
   - Một phần tử ảnh modal (.modal-image).
   - Một nút đóng modal (.close-button) ở góc trên bên phải.

2. KIỂU CSS: Tạo kiểu trong style.css cho modal:
   - #imageModal: `position: fixed`, che toàn bộ 100% chiều rộng và chiều cao, nền mờ đơn sắc `rgba(0, 0, 0, 0.7)` để che giao diện phía dưới. Mặc định ẩn (`display: none`). Căn giữa nội dung bên trong bằng Flexbox.
   - .modal-content: `position: relative`, có nền (ví dụ: trắng hoặc đen mờ), padding, border-radius.
   - .modal-image: Cố định kích thước `width: 250px` và `height: 200px`. Sử dụng `object-fit: cover` để ảnh không bị méo.
   - .close-button: `position: absolute`, top và right nhỏ, cursor là pointer để người dùng biết click được.

3. LOGIC JAVASCRIPT: Trong file mapping.js (hoặc file render ảnh), thêm logic:
   - Thêm sự kiện click cho mỗi ảnh được tạo ra trong lưới.
   - Khi click vào ảnh, lấy URL của ảnh đó và gán vào phần tử .modal-image, sau đó hiển thị modal (#imageModal) bằng cách đổi `display` thành `flex`.
   - Thêm sự kiện click cho nút đóng (.close-button) để ẩn modal.
   - (Tùy chọn) Thêm sự kiện click vào lớp nền mờ bên ngoài .modal-content để đóng modal.

Hãy lập kế hoạch chi tiết các thay đổi trong index.html, style.css và mapping.js rồi hiển thị cho tôi duyệt.