# Menu chính (header desktop + thanh tab dưới đáy trên mobile)

4 mục lớn và nút **⋯** gom các công cụ phụ. Áp dụng cho trang chủ, Product Map (VI / EN), trang thuật ngữ (VI / EN) và Hành trình.

| Mục | Nhãn desktop | Nhãn mobile | Mô tả (tooltip) | Đi tới |
| --- | --- | --- | --- | --- |
| Graph | Graph | Graph | Các thuật ngữ UI/UX nối với nhau thế nào | `/` (tab Graph, 2D mặc định, có tab 3D) |
| Từ điển | Từ điển A–Z | Từ điển | Tra nghĩa từng thuật ngữ | `/?tab=glossary` (EN: `/en/glossary`) |
| Map | Product Map | Map | Ai làm gì trong một team sản phẩm | `/team-map` (EN: `/en/team-map`) |
| Hành trình | Hành trình | Hành trình | Lộ trình học từ Newbie tới Product Designer | `/hanh-trinh-ui-ux` |
| ⋯ (Thêm) | ⋯ | Thêm | Flashcard Quiz · UI Challenge · Về dự án | menu thả xuống (desktop) / bảng nổi trên thanh tab (mobile) |

Trong **⋯**: Flashcard Quiz ("Ôn thuật ngữ bằng thẻ lật"), UI Challenge ("Bốc đề thiết kế ngẫu nhiên để luyện tay"), Về dự án ("Thư viện này là gì, ai làm"). Đang ở một trong ba tab này thì nút ⋯ sáng lên.

## Sửa menu ở đâu
- Câu chữ, link, biểu tượng: `api/_lib/nav.js` (một nơi cho mọi trang, có bản tiếng Anh).
- Kiểu dáng nút ⋯ và menu: `nav/site-nav.css`; mở / đóng, phím Esc, ↑ ↓: `nav/site-nav.js`.
- Trang thuật ngữ và Hành trình render menu lúc chạy. Trang tĩnh thì sau khi sửa `nav.js` chạy:
  ```
  node scripts/build_site_nav.js      # dán menu vào TELOS_Knowledge_Graph.html, team-map.html
  python3 scripts/build_team_map_en.py # sinh lại en/team-map.html (menu tiếng Anh)
  ```
