# Memory Atlas Gallery

Trang web trưng bày ảnh và video theo phong cách Unsplash, có thông tin thời gian và địa điểm trên từng thẻ nội dung.

## Tính năng

- Gallery kiểu masonry (column layout) giống Unsplash.
- Bỏ phần tìm kiếm, tập trung trải nghiệm xem nội dung.
- Mỗi mục hiển thị: tiêu đề, mô tả, loại nội dung, địa điểm, ngày, tags.
- Khu vực quản lý dữ liệu yêu cầu đăng nhập mới được thêm, sửa, xóa.
- Dữ liệu lưu vào database Supabase (không dùng localStorage cho CRUD).
- Hỗ trợ upload ảnh/video trực tiếp lên Supabase Storage trong form quản lý.
- Có preview file trước khi upload và thanh tiến trình upload trực quan.
- Khi thay file mới hoặc xóa mục, hệ thống tự dọn file cũ trên Storage.
- Có nút kiểm tra database trong khu vực admin để test bảng media_items và bucket Storage.
- Hỗ trợ animation nhẹ và responsive desktop/mobile.

## Cấu hình database

1. Tạo project Supabase.
2. Mở file config.js và điền:
	 - supabaseUrl
	 - supabaseAnonKey
3. Chạy file SQL [supabase/setup.sql](supabase/setup.sql) trong SQL Editor của Supabase.
4. Script đã bao gồm:
- Tạo bảng media_items
- Cột owner_id để gắn dữ liệu theo tài khoản đăng nhập
- Trigger updated_at
- Bật RLS
- Policy: ai cũng xem được, chỉ user đăng nhập mới thêm/sửa/xóa dữ liệu của chính họ
- Tạo bucket Storage public tên gallery-media
- Policy Storage: ai cũng xem được, chỉ owner upload/sửa/xóa file trong thư mục của mình
5. Vào Authentication > Providers để bật Email đăng nhập.
6. Trong config.js có thể đổi tên bucket qua storageBucket nếu bạn không dùng gallery-media.

Lưu ý:
- Nếu bật email confirmation, tài khoản mới cần xác thực email trước khi đăng nhập.
- Nếu muốn test nhanh nội bộ, có thể tắt confirmation trong phần Auth settings.
- Trong form admin: bạn có thể dán URL trực tiếp hoặc chọn file và bấm "Tải file lên" để tự điền URL.
- Trường storage_path được dùng nội bộ để quản lý file trên Storage, không cần nhập tay.

## Chạy dự án

Mở trực tiếp index.html hoặc chạy server tĩnh:

```bash
npx serve .
```

## Khac phuc loi thuong gap

- Loi: "Could not find the table 'public.media_items' in the schema cache"
1. Mo dung project Supabase dang dung trong config.js.
2. Chay lai file [supabase/setup.sql](supabase/setup.sql) trong SQL Editor.
3. Neu van loi, chay lenh sau trong SQL Editor:

```sql
notify pgrst, 'reload schema';
```

4. Tai lai trang web bang Ctrl+F5.
5. Neu can, dang nhap vao admin va bam nut "Kiem tra database" de xem chi tiet dang loi o bang hay bucket.

## Cấu trúc

- index.html: bố cục gallery masonry + khu vực đăng nhập/admin.
- styles.css: giao diện Unsplash-like, animation, responsive.
- app.js: render gallery, đăng nhập Supabase Auth, CRUD Supabase.
- config.js: cấu hình supabaseUrl và supabaseAnonKey.
- supabase/setup.sql: schema + RLS policy cho database.
# Static_Gallery_Supabase
