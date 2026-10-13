# Hướng dẫn cho Claude trong repo này

## Kiểm thử: mức 1, hỏi trước khi chạy
Chủ dự án chọn cách kiểm thử tiết kiệm. Áp dụng cho mọi phiên làm việc:

- **Mặc định mức 1.** Sửa xong chỉ kiểm tra cú pháp (ví dụ `node --check`, `python3 -m py_compile`). Không tự chạy test trình duyệt, không tự chụp màn hình.
- **Hỏi trước khi chạy bất kỳ test nào.** Nói rõ sẽ kiểm tra gì và ước tốn bao lâu, ví dụ: "Mở trang Hành trình ở mobile, kiểm tra không lỗi JS, chụp 1 ảnh chỗ vừa sửa, khoảng 1–2 phút." Chờ chủ dự án đồng ý, thu hẹp hoặc bỏ qua.
- **Chỉ test trong phạm vi được yêu cầu.** Không tự chạy lại toàn bộ test cũ (hồi quy).
- **Sửa phần dùng chung thì cảnh báo, không tự test.** Phần dùng chung gồm menu (`api/_lib/nav.js`, `nav/`), engine Product Map (`team-map/team-map.engine.js`), SQL / schema Supabase. Khi sửa các phần này, nêu vùng có thể bị ảnh hưởng để chủ dự án quyết định có test hay không.
- **Không đụng production khi test.** Dùng DB local, chặn GA.

## Quy ước khác
- Trả lời bằng tiếng Việt.
- Chủ dự án tự merge PR.
