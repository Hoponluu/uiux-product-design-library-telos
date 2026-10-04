# Google Analytics — custom event

Cả thư viện (`/`) và Team Map (`/team-map`) dùng chung GA4 property `G-PFSCQRQZM6`. Trang admin không gắn GA.
Lượt xem trang (`page_view`) GA tự ghi nhận. Các sự kiện dưới đây đo những gì người học làm **bên trong** trang.

## Trang chủ thư viện

| Sự kiện | Khi nào | Tham số |
| --- | --- | --- |
| `tab_view` | Đổi tab (Graph, A-Z, Flashcard, UI Challenge, Về dự án), kể cả mở thẳng bằng `/?tab=…` | `tab_name` |
| `term_open` | Bấm một thuật ngữ trên Graph view | `term_name`, `term_group`, `has_article`, `click_source` |
| `article_click` | Bấm mở bài viết trên academy.telos.vn | `link_url`, `link_text`, `click_source` (`graph`, `graph_modal`, `glossary`, …) |
| `search` | Gõ tìm trong A-Z (từ 2 ký tự, sau 1,5 giây ngừng gõ) | `search_term`, `click_source` |
| `flashcard_start` / `flashcard_complete` | Bắt đầu / xong một lượt Flashcard | `score`, `total` |
| `challenge_roll` / `challenge_copy` | Random / copy đề UI Challenge | `locked` (số tiêu chí đang giữ) |

## Team Map

Mọi sự kiện Team Map tự kèm `tm_scale` (`small` · `large` · `agency`) và `tm_lang` (`vi` · `en`, bản tiếng Anh ở `/en/team-map`).

| Sự kiện | Khi nào | Tham số thêm |
| --- | --- | --- |
| `tm_start` | Bấm nút ở lời chào | `start_action` (`explore` / `quest`) |
| `tm_scale_change` | Đổi quy mô công ty | `from_scale` |
| `tm_quest_mode` | Bật / tắt nút Nhiệm vụ | `state` (`on` / `off`) |
| `tm_quest_start` | Một nhiệm vụ bắt đầu | `quest_id`, `quest_title`, `quest_index`, `quest_total` |
| `tm_quest_complete` | Trả việc xong một nhiệm vụ | `quest_id`, `quest_title`, `quest_index`, `quest_total` |
| `tm_quest_chain_complete` | Xong cả chuỗi nhiệm vụ của một quy mô | `quests`, `cards`, `met` |
| `tm_character_open` | Mở bảng thông tin nhân vật | `character_id`, `character_title`, `character_kind`, `has_article`, `room_id` |
| `tm_article_click` | Bấm link bài viết trong game | `link_url`, `link_text`, `click_source` (`panel`, `reward`, `list`, `tree`, `preview` = bấm "Đọc tiếp" trong phần xem trước) |
| `tm_article_preview` | (Mobile) Bấm link bài, mở phần xem trước trong game thay vì rời trang | `link_url`, `link_text`, `click_source` |
| `tm_article_missing` | Bấm "Bài viết sắp ra mắt" | `character_title` — gợi ý nên viết bài nào trước |
| `tm_locked_room_open` | Mở "Phòng ban khác" | |
| `tm_list_view` | Mở "Xem dạng danh sách" hoặc đổi tab trong đó | `list_tab` (`rooms` / `report`) |
| `tm_radial_open` | Bấm vào một nhân vật, menu tròn các trò chơi hiện ra | `character_id`, `actions` (số trò hợp lệ với người này), `open` (số trò đang mở), `tm_slot` |
| `tm_action_open` | Chọn một trò trong menu tròn | `action_id`, `source` (`radial`, `radial-with` = "Rủ họ nấu xói"), `tm_slot` |
| `tm_action_pick` | Đã chốt người (và người nghe, với nấu xói) | `action_id`, `character_id`, `source` (như trên, thêm `pantry` = "Chơi luôn" từ thẻ gợi ý lần đầu vào Pantry), `tm_slot` |
| `tm_hourly_start` | Một mini-game bắt đầu | `action_id`, `character_id`, `tm_slot` |
| `tm_hourly_result` | Kết thúc một mini-game | `action_id`, `character_id`, `win`, `flawless`, `fail_kind`, `tm_slot` |
| `tm_badge_unlock` | Mở khoá một huy hiệu | `badge_id`, `tm_slot` |
| `tm_pantry_intro` | Lần đầu vào Pantry, thẻ "Chơi gì bây giờ?" hiện ra | `tm_slot` |
| `tm_badge_event` | Làm một hành động đặc biệt dùng cho huy hiệu | `event` (`chain_course` = bấm "Khám phá khoá học TELOS" ở bảng tổng kết sau khi xong chuỗi quest, `author_link` = bấm link trang cá nhân trong bảng của Nhân Lưu), `tm_slot` |
| `tm_badges_open` | Mở màn hình Huy hiệu | `unlocked` (số huy hiệu đã có), `tm_slot` |
| `tm_badge_save` | Lưu ảnh huy hiệu | `badge_id`, `method` (`share` / `download`), `tm_slot` |

## Cần làm một lần trong GA

Tham số tuỳ chỉnh chỉ hiện trong báo cáo sau khi đăng ký thành **custom dimension**:

GA → Admin → Data display → **Custom definitions** → *Create custom dimension*, phạm vi **Event**, tạo lần lượt cho:
`tab_name`, `term_name`, `click_source`, `tm_scale`, `tm_lang`, `quest_id`, `quest_title`, `character_title`, `character_kind`, `has_article`, `list_tab`, `start_action`, `action_id`, `character_id`, `badge_id`, `fail_kind`, `method`, `source`, `event`.
(`link_url`, `search_term` GA đã có sẵn.) Với `score`, `quest_index` có thể tạo **custom metric** nếu cần tính trung bình.

Link sang academy.telos.vn từ phần xem trước có gắn `utm_source=uiux-library&utm_medium=product-map&utm_content=<click_source>`, xem được trong GA của trang academy.

Gợi ý báo cáo: GA → Explore → **Funnel exploration** với các bước
`page_view (/team-map)` → `tm_quest_start` → `tm_quest_complete` → `tm_article_click`.

Số liệu xuất hiện trong báo cáo chuẩn sau 24–48 giờ; xem ngay ở **Realtime** hoặc **DebugView**.
