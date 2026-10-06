# Trang thuật ngữ (SEO)

Mỗi thuật ngữ có một trang riêng, render phía server để Google đọc được:

| URL | Nội dung |
| --- | --- |
| `/thuat-ngu` · `/en/glossary` | Mục lục A–Z theo nhóm |
| `/thuat-ngu/<slug>` · `/en/glossary/<slug>` | Trang thuật ngữ (vi / en) |
| `/sitemap.xml` | Sitemap gồm trang tĩnh + mọi trang thuật ngữ, có hreflang vi/en |

- **Code:** `api/term.js`, `api/sitemap.js` (Vercel Function), phần dựng HTML ở `api/_lib/glossary.js`, CSS ở `glossary/glossary.css` (header giống trang chủ / Product Map). Rewrite trong `vercel.json`.
- **Dữ liệu:** đọc thẳng từ Supabase bằng key công khai (`categories`, `concepts`, `tm_characters`). Sửa trong CMS là trang tự cập nhật sau tối đa ~10 phút (CDN cache `s-maxage=600`, hết hạn vẫn trả bản cũ trong lúc làm mới). Thuật ngữ mới thêm trong CMS có trang ngay, slug là URL — **đổi slug sẽ đổi URL**.
- **Nội dung một trang:** nhóm, tiêu đề "X là gì?" (vai trò: "X là ai?"), mô tả, nút "Đọc bài viết đầy đủ" (academy.telos.vn; chưa có link thì "Sắp có bài viết"), "Xem trên đồ thị 3D" (`/?term=<slug>`), thuật ngữ liên quan, cùng nhóm, trước / sau theo A–Z, CTA khoá học TELOS. JSON-LD `DefinedTerm` + `BreadcrumbList`.
- **Vai trò:** lấy thêm nội dung từ modal nhân vật Product Map (nhân vật có `term_id` trỏ tới thuật ngữ): đang làm, làm việc với UI/UX Designer thế nào, báo cáo cho ai, ai báo cáo cho họ, thuật ngữ liên quan (`related_term_ids`). Bản tiếng Anh dùng `tm_characters.i18n.en`.
- **Thuật ngữ thường:** liệt kê "Vai trò hay dùng X" = các nhân vật có X trong `related_term_ids`.
- **Bản tiếng Anh:** `concepts.name_en`, `concepts.description_en`, `categories.name_en` (sửa trong CMS → Khái niệm / Category). Ô trống thì dùng tiếng Việt.
- **Đường ra:** thanh tab giống trang chủ (Graph view, A–Z, Product Map…), breadcrumb, nút A–Z, trước / sau, "Về thư viện thuật ngữ", đổi ngôn ngữ.
- **Từ thư viện vào trang thuật ngữ:** thẻ A–Z có link "Chi tiết →"; trên đồ thị, nút chưa có bài viết mở trang thuật ngữ (desktop), modal mobile có "Xem chi tiết thuật ngữ →". `/?term=<slug>` bay tới nút đó trên đồ thị.

## Triển khai lần đầu

1. Supabase → SQL Editor: chạy `supabase_library_terms.sql` (chạy lại nhiều lần vẫn an toàn). File này:
   - thêm cột tiếng Anh;
   - thêm nhóm vai trò **Data** và **Delivery**;
   - tạo thuật ngữ cho mọi vai trò trong Product Map chưa có thuật ngữ (mô tả lấy từ modal nhân vật) rồi nối `term_id`;
   - điền bản dịch tiếng Anh cho các thuật ngữ đang có (không ghi đè bản đã sửa).
2. Deploy. Vercel tự nhận thư mục `api/` (Node.js), không cần cấu hình thêm.
3. Google Search Console → Sitemaps: gửi lại `https://uiux-library.nhanluu.com/sitemap.xml`.
