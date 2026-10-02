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

## 10. Quy mô Outsource agency (SPEC-agency)

- Quy mô thứ ba `agency`: 6 phòng `A1`–`A6` (bố cục trong `team-map.layout.js`, TV ở `A4`), 5 nhân vật mới (Client, Design Director, Graphic Designer, Sales / Business Developer, Freelancer), 17 vị trí, 8 nhiệm vụ về dự án app đặt lịch cho chuỗi phòng gym.
- Báo cáo cho ai ở agency: cột `tm_characters.reports_to_agency`. Khác `reports_to_small`, ô trống ở agency nghĩa là **không báo cáo cho ai** (không lùi về `reports_to`).
- Đường "nhận việc từ Project Manager" (dotted line) cho người ngồi ở `A1`, `A2`: cấu hình trong `team-map.layout.js → dotted`.
- `tm_placements.fixed`: nhân vật ngồi yên tại ghế, không đi dạo, không bị kéo tới điểm tập hợp, không bị "đưa về chỗ" sau nhiệm vụ (dùng cho `client@A4`). Client vẫn được tính vào "Đã gặp" và có bảng thông tin thường.
- Màu thân tuỳ chỉnh: `appearance.body_color` / `appearance.outline_color` (#RRGGBB). Sửa được trong CMS và Excel.
- Nếu DB chưa có dữ liệu agency, loader bỏ qua quy mô này và nút "Outsource agency" tự hiện "Sắp ra mắt". Trang không bị lỗi.
- Tên nút giữ là **"Outsource agency"** (theo tên chủ dự án đã chốt), SPEC gọi là "Agency / Outsource".

### Thêm agency vào DB đang chạy
1. SQL Editor: chạy lại `supabase_team_map.sql` (an toàn, tự nâng cấp bảng cũ).
2. Chạy `supabase_team_map_agency_seed.sql`. File này chỉ thêm / cập nhật phần agency, không sửa nội dung nhân vật cũ. Kết quả cuối là bảng báo cáo gắn thuật ngữ / thẻ thưởng chưa khớp.

## 11. Mobile, lưu tiến độ, xem trước bài viết

- **Mobile (≤ 760px):** thanh nhiệm vụ một dòng (có nút "Đi tới"), minimap thu thành nút bản đồ, giới thiệu phòng là toast nhỏ. Mọi popup là bottom sheet cao tối đa ~1/3 màn hình, chạm ra ngoài thì đóng, mỗi lúc chỉ mở một cái. Desktop giữ nguyên.
- **Lưu tiến độ:** `localStorage['tm-progress-v1']` trên trình duyệt của người chơi (quy mô, chế độ, nhiệm vụ đã xong, người đã gặp, thẻ kiến thức). Không lưu dữ liệu cá nhân, không gửi lên server, hết hạn sau 30 ngày. Rời game giữa một nhiệm vụ thì quay lại chơi lại từ đầu nhiệm vụ đó. Có nút "Chơi lại từ đầu".
- **Xem trước bài (mobile):** link tới `academy.telos.vn` mở sheet xem trước (tiêu đề, ảnh, đoạn mở đầu) lấy từ WordPress REST API (`/wp-json/wp/v2/posts?slug=…`, thử `pages` nếu không thấy). academy.telos.vn chặn iframe (`X-Frame-Options: SAMEORIGIN`) nhưng REST API cho phép đọc từ domain này. Nếu đổi cấu hình CORS / tắt REST API trên academy thì sheet vẫn hiện nút mở bài đầy đủ.

## 12. Các bước triển khai

1. Supabase → SQL Editor: chạy `supabase_team_map.sql`.
2. Authentication → Users → **Add user** (email + mật khẩu) cho admin. Sau đó chạy:
   `insert into admin_users (email) values ('email-cua-ban@...');`
3. Authentication → Sign In / Providers: tắt **Allow new users to sign up**.
4. Chạy `supabase_team_map_seed.sql` (đầy đủ mọi quy mô, gồm cả agency). Kết quả cuối là bảng báo cáo: nhân vật nào đã gắn thuật ngữ, thẻ thưởng nào chưa khớp.
5. Deploy. Đăng nhập `/adminCMS` bằng email + mật khẩu vừa tạo.
6. **Bỏ hẳn service_role key cũ** (key này đã nằm công khai trong lịch sử git nên phải coi như đã lộ):
   1. Supabase → **Settings → API Keys** → lấy **publishable key** (`sb_publishable_...`).
   2. Dán vào `supabase.config.js` (dòng `key:`), deploy, rồi thử trang chủ, `/team-map` và đăng nhập admin.
   3. Quay lại **Settings → API Keys** → **tắt (deactivate) legacy API keys**. Thao tác này tắt cùng lúc anon và service_role cũ, và bật lại được nếu cần.

Mọi trang đọc URL + key từ một chỗ duy nhất là `supabase.config.js`. File này chỉ chứa key công khai, không bao giờ đặt secret key vào đây.

Sửa `team-map/seed.json` → chạy `python3 scripts/gen_team_map_seed.py` để sinh lại cả hai file seed. **Chạy lại seed sẽ ghi đè nội dung đã sửa trong CMS.**
