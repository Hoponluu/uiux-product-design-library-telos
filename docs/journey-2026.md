# Trang Hành trình theo chuỗi AI-Driven Product Designer 2026

Nguồn nội dung: phần 0 của "Giáo trình Product Design - 2026" (bản 04/11/2026), đối chiếu với các trang khóa đang chạy trên academy.telos.vn.

## Định hướng thay đổi
- **Tinh thần chuỗi:** "AI làm nhanh hơn. Designer quyết định cái gì đáng làm." Chuỗi dạy làm sản phẩm cùng AI, không dạy thêm tool. Câu này nằm ngay dưới tiêu đề trang, kèm link tới trang tổng của lộ trình.
- **Từ 6 trạm + 2 nhánh tuỳ chọn thành 8 trạm đi thẳng** 01 → 08, đúng thứ tự trong chuỗi. Không còn nhánh rẽ: Code 4 Designer vào đường chính; Web Design không còn trong chuỗi nên bỏ; thêm trạm Portfolio.
- **Tên trạm là vai trò của khóa trong chuỗi:** Công cụ · Thẩm mỹ · Trải nghiệm · Hệ thống · Dự án · Code · Portfolio · Chiến lược.
- **Màu trạm theo 4 tầng:** Căn bản 01–03 (xanh TELOS, vàng, vàng) · Hệ thống hóa 04–05 (trắng viền xanh) · Mở rộng & ra mắt 06–07 (hồng) · Đóng chuỗi 08 (xanh TELOS).
- **Nhân vật có robot AI đi cùng từ trạm đầu** (AI là cộng sự xuyên suốt), các mốc nghề là UI/UX Designer (03), AI-Driven Designer (05) và AI-Driven Product Designer (08).
- **Bảng Khóa học** lấy đúng tên khóa, số buổi, định hướng, 4 ưu điểm và bài cuối khóa từ landing đã duyệt; **bảng Vai trò** nói vai trò của khóa trong chuỗi và kỹ năng có được.
- **Trạm xuất phát** nói tổng quan chuỗi (8 khóa, 68 buổi) và điểm bắt đầu theo trình độ; **trạm đích** liệt kê 8 đầu ra cộng dồn.

## Mapping trạm ↔ khóa
| id | Trạm | Khóa | Buổi |
| --- | --- | --- | --- |
| figma | Công cụ | L01 AI & Tools Foundation in Product Design | 8 |
| ui | Thẩm mỹ | L02 UI Foundation for AI-Driven Design | 8 |
| ux | Trải nghiệm | L03 UX Foundation for AI-Driven Design | 8 |
| ds | Hệ thống | L04 Design System for AI-Driven Design | 12 |
| ai | Dự án | L05 AI Process & Project Apply | 8 |
| code | Code | L06 Code 4 Designer | 8 |
| portfolio | Portfolio | L07 Designer's Portfolio With AI | 4 |
| pdm | Chiến lược | L08 Product Design & Manage | 12 |

id giữ nguyên để không vỡ link Team Map (`?hinh-thai=`), trừ `web` đổi thành `portfolio`.

## Triển khai
1. Supabase → SQL Editor: chạy `supabase_team_map_journey.sql` (đổi id `web` → `portfolio`, cập nhật danh sách id hợp lệ).
2. Chạy `supabase_team_map_journey_2026.sql`: **ghi đè** nội dung 10 trạm và phần SEO bằng nội dung chuỗi 2026 (giữ cài đặt thử thách flashcard).
3. Merge PR.

## Còn chờ
- Thumbnail khóa Portfolio: og:image của trang khóa hiện là ảnh giảng viên (`gv-khue.png`). Có ảnh khóa chính thức thì sửa ở CMS → Hành trình → Portfolio.
