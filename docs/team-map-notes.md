# Team Map — ghi chú khảo sát repo & hướng dẫn triển khai

Cập nhật: 02/10/2026. Trả lời các câu hỏi ở "Bước 0" trong SPEC, kèm các quyết định đã chốt với chủ dự án.

## 1. Cấu trúc repo

- Không framework, không bước build. Mỗi trang là **một file HTML tự chứa** (CSS + JS inline), deploy tĩnh trên Vercel.
  - `TELOS_Knowledge_Graph.html` — trang public, phục vụ ở `/` (rewrite trong `vercel.json`).
  - `adminCMS.html` — trang admin, phục vụ ở `/adminCMS`.
- Schema Supabase được quản lý bằng các file SQL ở thư mục gốc (`supabase_setup.sql`, `supabase_update_v2.sql`), chạy tay trong SQL Editor.
- Team Map theo đúng cách đó:
  - `team-map.html` — trang con, phục vụ ở `/team-map`.
  - `team-map/` — `team-map.css`, `team-map.layout.js`, `team-map.loader.js`, `team-map.engine.js`, `team-map.admin.js`, `seed.json` (dữ liệu dự phòng).
  - `supabase_team_map.sql` (migration) và `supabase_team_map_seed.sql` (seed, sinh bởi `scripts/gen_team_map_seed.py`).

## 2. Menu chính

Menu là dãy tab `#tab-pill` trong `TELOS_Knowledge_Graph.html` (Graph view, A-Z, Flashcard Quiz, UI Challenge, Về dự án), chuyển tab bằng `switchTab()` trong cùng trang.

- Thêm tab **Team Map** dạng link `<a href="/team-map">`, đặt sau UI Challenge.
- Trang chủ hiểu thêm `/?tab=glossary|flashcard|challenge|about` để từ trang Team Map bấm tab khác sẽ mở đúng tab.
- `team-map.html` dùng lại header (logo, dãy tab, menu nhanluu.com, chế độ tối) của trang chủ.

## 3. Supabase client

- Không dùng `supabase-js`; gọi thẳng REST (`/rest/v1/...`) bằng `fetch`.
- Trang public dùng **anon key** (an toàn khi để ở client).
- Trước đợt này `adminCMS.html` chứa **service_role key** ngay trong mã nguồn, repo lại public → ai cũng có toàn quyền DB. Đợt này đã bỏ key đó (xem mục 4).

## 4. Xác thực admin (đã đổi)

| Trước | Sau |
| --- | --- |
| Mật khẩu so khớp SHA-256 ngay trên trình duyệt + service_role key trong HTML | **Supabase Auth** (email + mật khẩu). Client chỉ giữ anon key + access token của người đăng nhập. |
| RLS không có policy ghi (service key bỏ qua RLS) | Policy ghi `for all to authenticated using (is_admin())` trên `categories`, `concepts` và 5 bảng `tm_*`. `is_admin()` kiểm email trong JWT có nằm trong bảng `admin_users` không. |

## 5. Bảng thuật ngữ

- Tên bảng: `concepts`. Khoá chính `id` (kiểu do DB quyết định; migration tự dò kiểu khi tạo `tm_characters.term_id`). Các cột: `slug`, `name`, `category_id`, `description`, `url`, `node_size`, `is_published`.
- Nhóm nằm ở bảng `categories` (`id`, `slug`, `name`, `parent_id`, `depth`, `color`, `sort_order`).
- Nhóm "Vai trò" = category `slug = 'vai-tro'` cùng các nhóm con: `vt-design`, `vt-product`, `vt-engineering`, `vt-business`, `vt-cross`.
- Tạo thuật ngữ từ form nhân vật: chọn nhóm con, chọn sẵn theo nhóm nghề (design→vt-design, product→vt-product, engineering→vt-engineering, business→vt-business, data/delivery→vt-cross), `is_published = true`.

## 6. CSS / token

- Admin: font hệ thống, màu chính `#241775`, các class `.btn-add`, `.btn-export`, `.form-control`, `.modal`, `.table-wrap`, `.badge`… CMS Team Map dùng lại đúng các class này.
- Trang public: header `#tabs` / `#tab-pill` / `.tab-btn`, chế độ tối bằng `body.dark` + `localStorage['telos-theme']`. Trang Team Map đọc cùng khoá và đặt `data-theme` cho game.
- CSS của game dùng token riêng (TELOS brand, Be Vietnam Pro). Vì mỗi trang là một file riêng, không có CSS dùng chung để xung đột; header được chép sang với id riêng (`#tabs`, `#tab-pill`).

## 7. Thư viện CDN

- Trang chủ: `3d-force-graph@1.73.4` (unpkg, có Three.js đóng gói bên trong).
- Team Map nạp riêng **Three.js r128** (cdnjs) như bản demo, không dùng chung.
- Admin nạp **ExcelJS 4.4.0** (cdnjs) khi bấm Xuất/Nhập file, chạy hoàn toàn trên trình duyệt. SPEC đề xuất SheetJS, nhưng bản SheetJS miễn phí không ghi được định dạng ô (nền xám cho cột chỉ đọc, chữ xám dòng khoá, cố định dòng tiêu đề, wrap text), nên dùng ExcelJS.

## 8. Khác biệt so với SPEC (có chủ đích)

- **Mã vị trí luôn đầy đủ** (`role@ROOM`) trong `tm_quests.giver/gather` và `tm_quest_steps.target`. Seed gốc có chỗ viết tắt (`tech-lead`); đã chuẩn hoá vì mỗi chỗ chỉ khớp đúng một vị trí.
- **Ràng buộc nằm cả trong DB** (trigger): đổi `tm_placements.id` tự thay mã trong nhiệm vụ; không xoá được vị trí/nhân vật đang được nhiệm vụ dùng; kiểm tra quy mô và phòng có TV cho bước `present`.
- **"Phòng ban khác"** giờ tính tự động theo SPEC 5.6 (mọi `role` đang bật, có ghế ở quy mô lớn nhưng không có ở quy mô nhỏ), nên danh sách dài hơn 16 vai trò hard-code trước đây.
- **Khớp thẻ thưởng khi seed**: ưu tiên khớp cả tên lẫn URL, rồi theo tên, rồi theo URL (Agile và Waterfall dùng chung một bài viết).
- **Thẻ thưởng chưa khớp thuật ngữ** (Viability, Desirability, Usability…: chưa có trong `concepts`) được giữ dạng `{type:'term', name, url}` để game vẫn hiện đúng. CMS đánh dấu "chưa gắn thuật ngữ" để xử lý tay.
- Nhân vật `author` / `guest`: các nút trong bảng thông tin lấy từ `cta` (nhãn, URL, nút chính), không còn hard-code.

## 9. Định dạng file Excel

- Dòng 1: tiêu đề tiếng Việt. Dòng 2: khoá kỹ thuật (chữ xám, đừng sửa). Dữ liệu từ dòng 3.
- Cột có khoá bắt đầu bằng `_` là cột chỉ đọc (nền xám, chữ nghiêng), import bỏ qua. Ngoài các cột chỉ đọc mà SPEC đã liệt kê, cột "Quy mô" ở sheet `Vi tri` và `Phong ban` cũng là chỉ đọc, vì giá trị này suy ra từ phòng.
- Thẻ thưởng: `term:<id>` · `character:<id>` · `link:<tên>|<url>` (dạng cuối dành cho thẻ chưa có trong thư viện).
- Nút của tác giả / khách: tối đa 2 nút (`Nút 1` là nút chính).
- Ở sheet `Vi tri`, đổi phòng của một dòng sẽ tạo chỗ ngồi mới (vì id chứa mã phòng, mà import không xoá). Muốn đổi phòng thì làm trong CMS để nhiệm vụ tự cập nhật theo.

## 10. Các bước triển khai

1. Supabase → SQL Editor: chạy `supabase_team_map.sql`.
2. Authentication → Users → **Add user** (email + mật khẩu) cho admin. Sau đó chạy:
   `insert into admin_users (email) values ('email-cua-ban@...');`
3. Authentication → Sign In / Providers: tắt **Allow new users to sign up**.
4. Chạy `supabase_team_map_seed.sql`. Kết quả cuối là bảng báo cáo: nhân vật nào đã gắn thuật ngữ, thẻ thưởng nào chưa khớp.
5. **Đổi service_role key** (Settings → API → JWT Keys / API Keys). Key cũ đã nằm công khai trong lịch sử git nên phải coi như đã lộ.
6. Deploy. Đăng nhập `/adminCMS` bằng email + mật khẩu vừa tạo.

Sửa `team-map/seed.json` → chạy `python3 scripts/gen_team_map_seed.py` để sinh lại file seed. **Chạy lại seed sẽ ghi đè nội dung đã sửa trong CMS.**
