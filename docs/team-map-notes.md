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

- **Mobile (≤ 760px):** thanh nhiệm vụ một dòng (có nút "Tới đó"), minimap thu thành nút bản đồ, giới thiệu phòng là toast nhỏ. Mọi popup là bottom sheet cao tối đa ~1/3 màn hình, chạm ra ngoài thì đóng, mỗi lúc chỉ mở một cái. Desktop giữ nguyên.
- **Lưu tiến độ:** `localStorage['tm-progress-v1']` trên trình duyệt của người chơi (quy mô, chế độ, nhiệm vụ đã xong, người đã gặp, thẻ kiến thức). Không lưu dữ liệu cá nhân, không gửi lên server, hết hạn sau 30 ngày. Rời game giữa một nhiệm vụ thì quay lại chơi lại từ đầu nhiệm vụ đó. Có nút "Chơi lại từ đầu".
- **Xem trước bài (mobile):** link tới `academy.telos.vn` mở sheet xem trước (tiêu đề, ảnh, đoạn mở đầu) lấy từ WordPress REST API (`/wp-json/wp/v2/posts?slug=…`, thử `pages` nếu không thấy). academy.telos.vn chặn iframe (`X-Frame-Options: SAMEORIGIN`) nhưng REST API cho phép đọc từ domain này. Nếu đổi cấu hình CORS / tắt REST API trên academy thì sheet vẫn hiện nút mở bài đầy đủ.

## 12. Bản tiếng Anh (/en/team-map)

- **Đường dẫn:** `/en/team-map` (file `en/team-map.html`, rewrite trong `vercel.json`). Nút **EN / VI** ở góc phải thanh trên cùng chuyển qua lại; tiến độ chơi dùng chung giữa hai bản. Có `hreflang` + sitemap cho cả hai.
- **Nội dung** (nhân vật, phòng, nhiệm vụ, bước): cột `i18n` (jsonb) trên `tm_characters`, `tm_rooms`, `tm_quests`, `tm_quest_steps`, dạng `{"en": {"<tên cột>": "..."}}`. Ô nào chưa dịch thì trang EN hiện tiếng Việt.
  - nhân vật: `title`, `summary`, `doing`, `with_designer`, `tag`, `cta` (mảng nhãn nút, cùng thứ tự với `cta`)
  - phòng: `code`, `name`, `intro` · nhiệm vụ: `title`, `offer_text`, `done_text` · bước: `task_text`, `line_text`
- **Bản dịch gốc** nằm ở `team-map/i18n-en.json`. `scripts/gen_team_map_seed.py` ghép nó vào `seed.json` và sinh `supabase_team_map_en.sql` (chỉ ghi phần tiếng Anh, không đụng tiếng Việt).
- **CMS:** mỗi form có khối "Tiếng Anh · trang /en/team-map"; danh sách có huy hiệu EN / EN một phần / Chưa có EN. File Excel có các cột `(EN)` ở cuối mỗi sheet; xoá chữ trong ô EN rồi import = bỏ bản dịch đó.
- **Chữ giao diện** (nút, hướng dẫn, thông báo) nằm trong code: `L('tiếng Việt', 'English')` trong `team-map.engine.js` và `team-map.layout.js`. Chữ cố định trong HTML (meta, lời chào, nhãn nút): `scripts/build_team_map_en.py` sinh `en/team-map.html` từ `team-map.html`. **Sửa `team-map.html` xong phải chạy lại script này**; script báo lỗi nếu một chuỗi cần dịch đã đổi.
- **Bài viết** vẫn là bài tiếng Việt trên academy.telos.vn; nút ghi rõ "(Vietnamese)".
- **Thuật ngữ** trên thẻ thưởng lấy tên từ bảng `concepts` của thư viện (đa số đã là tiếng Anh: Agile, MVP, Wireframe…).
- GA: mọi sự kiện Team Map có thêm `tm_lang` (`vi` / `en`).

### Bật bản tiếng Anh trên DB đang chạy
1. SQL Editor: chạy lại `supabase_team_map.sql` (thêm cột `i18n`, cập nhật các hàm lưu / import).
2. Chạy `supabase_team_map_en.sql`. Bảng kết quả cuối cho biết bao nhiêu dòng đã có tiếng Anh.
3. Deploy. Mở `/en/team-map`.

Lưu ý: bản dịch dựa trên nội dung seed gốc. Nếu đã sửa nội dung tiếng Việt trong CMS sau khi seed, nên xem lại bản tiếng Anh của các dòng đó trong CMS.

## 13. Hành động tự do, mini-game & huy hiệu (SPEC-hourly, bản chơi tự do)

- **Chơi tự do (thay cho "mỗi giờ một nhiệm vụ"):** bấm vào một nhân vật (hoặc đứng gần và nhấn F) → **menu tròn** hiện quanh người đó: "💬 Nói chuyện" (mở bảng thông tin như cũ) + các trò chơi được với người này (chỉ trò hợp lệ; trò đang khoá có ổ khoá và đồng hồ "lượt mới sau"). Desktop chọn được bằng phím số. Chạm / bấm ra ngoài, nhấn Esc hoặc đi xa thì menu đóng. Nhiệm vụ chính vẫn được ưu tiên: nói chuyện đúng người của bước nhiệm vụ thì nhiệm vụ chạy như cũ. **Đọc bài** và **Lật thẻ** luôn mở; mỗi lượt (mặc định **30 phút**) mở thêm **4 trong 6** trò vui, chọn theo trọng số, cố định theo thời gian (mọi người chơi thấy giống nhau), hai lượt liền nhau không trùng y hệt. Hết lượt thì trò đang chờ bị huỷ, trò đang chơi vẫn chơi tiếp tới hết. **Lần thắng nào cũng được tính** vào huy hiệu. Lần đầu vào game có mẹo "bấm vào một đồng nghiệp…".
- **Nấu xói:** "Nấu xói về họ" → người nghe chọn sẵn là người hợp lệ gần nhất (không bao giờ là sếp trực tiếp của người bị nấu xói), có chip để đổi, bấm "Bắt đầu". "Rủ họ nấu xói" (người này làm người nghe) → chọn người bị nấu xói trong danh sách hoặc bấm trên bản đồ.
- **Nhân Lưu** không giao việc nữa: bảng của ổng giải thích cách chơi và gợi ý một cặp (cố định trong lượt), có nút "Chơi luôn". Ổng chỉ đi tới khen khi bạn mở được huy hiệu.
- **Ném pop-task (đã làm dễ hơn):** 10 tờ, cần trúng 3; Space / nút "Ném" (hoặc bấm vào người, hoặc bấm sàn trong vòng `aim_assist` m quanh người) là tự nhắm đón đầu theo hướng đi; tờ giấy trúng khi bay ngang qua người ở nửa sau đường bay (bán kính 1 m); nhân vật đi chậm hơn (×0,7), đứng lại giữa các lần đi, trúng thì khựng lại; có vòng vàng = tầm ném, vòng xanh dưới chân người = đang trong tầm. Thử nghiệm: trúng 3/3 khi nhân vật vẫn đi lại.
- **Nguồn dữ liệu:** `team-map/seed-hourly.json` + `team-map/i18n-hourly-en.json`. `python3 scripts/gen_team_map_hourly_seed.py` sinh `supabase_team_map_hourly_seed.sql` và ghép phần `hourly` vào `seed.json`. **Khác bản gốc của SPEC:** `config.slot_minutes` = 30, thêm `config.open_count` = 4, tham số mới của poptask.
- **Bảng:** `tm_hourly_config` (thêm cột `open_count`; `no_repeat_slots`, `counted_wins_per_slot` không còn dùng), `tm_hourly_actions`, `tm_hourly_lines`, `tm_quiz_questions`, `tm_badges`. Cột ở `tm_characters`: `rank`, `related_term_ids`, `gossip_partner_ids`, `hourly_exclude`.
- **Code:** logic thuần `team-map/team-map.hourly.js` (`openAt`, `targets`, `suggest`, `whyNot`…), giao diện + 8 game `team-map/team-map.hourly-games.js`, đồng xu 3D `team-map/team-map.coin.js`.
- **Tiến độ:** `localStorage['tm_hourly_v1']` (thống kê thắng/thua, huy hiệu). Trình duyệt chặn lưu trữ thì vẫn chơi được, màn hình Huy hiệu báo là sẽ không giữ lại.
- **Ảnh huy hiệu:** Storage bucket công khai `tm-badges` (do `supabase_team_map.sql` tạo, tối đa 1 MB, png/webp/jpeg). Tải lên trong CMS → tab Huy hiệu; nên dùng ảnh vuông. Chưa có ảnh thì đồng xu dùng logo Telos.
- **CMS:** tab **Hành động** (bật/tắt, độ dài lượt, số hành động vui mở mỗi lượt, bảng 8 lượt sắp tới, số người chọn được cho từng hành động ở từng quy mô; 8 hành động với tham số mini-game), "Câu hỏi và lời thoại", "Huy hiệu". Form nhân vật có nhóm "Hành động & mini-game": cấp bậc, thuật ngữ liên quan, người nấu xói cùng, loại trừ hành động, và dòng giải thích vì sao đủ / chưa đủ điều kiện. Excel: sheet `Hanh dong`, `Cau hoi`, `Loi thoai`, `Huy hieu` + các cột mới ở `Nhan vat`.
- **Nhiệm vụ hằng ngày cũ** (`type = daily`) được ẩn khỏi CMS và game.
- **Khác SPEC:** nhân vật còn dưới 4 thuật ngữ liên quan được bù theo nhóm vai trò (`GROUP_TERMS` trong script seed). Game Lật thẻ dùng mô tả trong `concepts` (tên được che); thuật ngữ chưa có mô tả hiện gợi ý 2 chữ cái đầu.
- **Cần chủ dự án xem lại:** 12 câu hỏi trắc nghiệm và ảnh cho 10 huy hiệu.
- **Debug:** `localhost:.../team-map.html#debug` có `window.__tmHX` (chỉ trên localhost).

### Chuyển sang chơi tự do trên DB đang chạy
1. SQL Editor: chạy lại `supabase_team_map.sql` (thêm cột `open_count`).
2. Chạy `supabase_team_map_free_play.sql`: đặt lượt 30 phút, mở 4 hành động vui, cập nhật tham số Ném pop-task. Không đụng nội dung khác đã sửa trong CMS.
3. Deploy.

### Cài mới phần hành động trên DB chưa có
1. SQL Editor: chạy lại `supabase_team_map.sql` (thêm cột, bảng, bucket `tm-badges`, cập nhật hàm lưu / import).
2. Chạy `supabase_team_map_hourly_seed.sql`. Chạy lại an toàn: không ghi đè `rank` đã đặt, giữ ảnh huy hiệu đã tải lên. Bảng cuối liệt kê id bị bỏ qua và nhân vật còn dưới 4 thuật ngữ liên quan. Xem nhân vật nào đủ điều kiện cho từng hành động trong CMS (form nhân vật, tab "Nhiệm vụ theo giờ" → Đang chạy).
3. Deploy.

## 14. Các bước triển khai

1. Supabase → SQL Editor: chạy `supabase_team_map.sql`.
2. Authentication → Users → **Add user** (email + mật khẩu) cho admin. Sau đó chạy:
   `insert into admin_users (email) values ('email-cua-ban@...');`
3. Authentication → Sign In / Providers: tắt **Allow new users to sign up**.
4. Chạy `supabase_team_map_seed.sql` (đầy đủ mọi quy mô, gồm cả agency và bản tiếng Anh), rồi `supabase_team_map_hourly_seed.sql` (nhiệm vụ theo giờ & huy hiệu). Kết quả cuối là bảng báo cáo: nhân vật nào đã gắn thuật ngữ, thẻ thưởng nào chưa khớp.
5. Deploy. Đăng nhập `/adminCMS` bằng email + mật khẩu vừa tạo.
6. **Bỏ hẳn service_role key cũ** (key này đã nằm công khai trong lịch sử git nên phải coi như đã lộ):
   1. Supabase → **Settings → API Keys** → lấy **publishable key** (`sb_publishable_...`).
   2. Dán vào `supabase.config.js` (dòng `key:`), deploy, rồi thử trang chủ, `/team-map` và đăng nhập admin.
   3. Quay lại **Settings → API Keys** → **tắt (deactivate) legacy API keys**. Thao tác này tắt cùng lúc anon và service_role cũ, và bật lại được nếu cần.

Mọi trang đọc URL + key từ một chỗ duy nhất là `supabase.config.js`. File này chỉ chứa key công khai, không bao giờ đặt secret key vào đây.

Sửa `team-map/seed.json` hoặc `team-map/i18n-en.json` → chạy `python3 scripts/gen_team_map_seed.py` để sinh lại các file seed. **Chạy lại seed sẽ ghi đè nội dung đã sửa trong CMS.**
