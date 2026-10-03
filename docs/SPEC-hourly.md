# SPEC — Nhiệm vụ theo giờ của Nhân Lưu, 8 mini-game và huy hiệu ẩn

Tài liệu này dành cho Claude Code trong repo **uiux-library**, nơi hệ thống Team Map (trang game + CMS + các bảng `tm_*`) đã chạy theo `SPEC.md` và `SPEC-agency.md`.

Việc cần làm: thêm một loại nhiệm vụ ngắn do nhân vật **Nhân Lưu** giao, mỗi giờ đổi một lần, có dạng "**làm [hành động] với [nhân vật]**". Hoàn thành nhiệm vụ giúp người chơi mở **huy hiệu ẩn** dạng đồng xu 3D, chụp hình lại để khoe.

File đi kèm: **`seed-hourly.json`** chứa cấu hình, cấp bậc nhân vật, 8 hành động, lời thoại, câu hỏi trắc nghiệm và 10 huy hiệu mẫu. Nếu tài liệu và JSON lệch nhau thì **JSON là chuẩn**.

Tên bảng, tên cột theo `SPEC.md` gốc. Nếu repo đã đặt tên khác thì ánh xạ sang tên thật, không đổi schema hiện có để khớp tài liệu. Chỗ nào ghi **[XÁC NHẬN TRONG REPO]** là chỗ cần đọc code hiện có trước khi làm.

## 1. Các quyết định đã chốt với chủ dự án

| Chủ đề | Quyết định |
| --- | --- |
| Tên gọi | Trong game gọi là "Nhiệm vụ giờ này". Trong CMS gọi là "Nhiệm vụ theo giờ". |
| Xoay vòng | Mỗi 60 phút đổi một cặp hành động + nhân vật. Mọi người chơi cùng quy mô thấy cùng một nhiệm vụ. |
| Đăng nhập | **Không có.** Tiến độ và huy hiệu lưu trên trình duyệt (localStorage). |
| Đổi quà | Chưa làm. CMS chỉ chừa sẵn các trường quà để team ngoài nhập sau. |
| Khoe huy hiệu | Nút "Lưu ảnh" xuất một thẻ ảnh PNG để người chơi tự đăng. |
| Huy hiệu | Đồng xu 3D xoay được, hình do admin upload dán lên mặt đồng xu. |
| Số hành động | 8 (mục 5). Đã bỏ "oẳn tù tì" và "nhại theo". |
| Từ ngữ | Hành động nói xấu gọi là **"nấu xói"** ở mọi chỗ người chơi nhìn thấy. |
| Daily quest cũ | Loại `daily` trong `tm_quests` không dùng nữa. Ẩn lựa chọn này khỏi CMS, giữ nguyên cột. |

## 2. Thay đổi cần làm, theo thứ tự

1. Migration: thêm cột vào `tm_characters`, tạo 5 bảng mới + RLS (mục 3).
2. Seed từ `seed-hourly.json` (mục 9).
3. Engine: bộ chọn nhiệm vụ theo giờ, luồng nhận và trả với Nhân Lưu (mục 4).
4. Engine: 8 mini-game (mục 5).
5. Engine: lưu tiến độ, chấm huy hiệu, màn huy hiệu 3D, xuất ảnh (mục 6 và 7).
6. CMS: 4 tab mới, thêm trường trong form nhân vật, thêm sheet Excel (mục 8).
7. Chạy danh sách nghiệm thu (mục 11).

## 3. Mô hình dữ liệu

### 3.1 Cột thêm vào `tm_characters`

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `rank` | int, 1–8, nullable | Cấp bậc. Quyết định lực khi đánh nhau và tốc độ khi chạy đua. Trống thì coi là 2. |
| `related_term_ids` | jsonb (mảng id thuật ngữ) | Thuật ngữ gắn với nhân vật, dùng cho flashcard. |
| `gossip_partner_ids` | jsonb (mảng `tm_characters.id`), nullable | Người để nấu xói cùng. Trống thì tính tự động (mục 5.8). |
| `hourly_exclude` | jsonb (mảng `action_id`) | Các hành động **không** ghép với nhân vật này. Mặc định `[]`. |

Thang cấp bậc (giá trị từng nhân vật nằm trong `seed-hourly.json → character_rank`):

| Cấp | Ai | Ví dụ |
| --- | --- | --- |
| 1 | Thực tập | Intern |
| 2 | Nhân viên | Designer, Developer, QA, Analyst, BA, Sales, Freelancer |
| 3 | Lead và PM | Tech Lead, Product Manager, Product Owner, Scrum Master, Project Manager |
| 4 | Manager | Design Manager, Delivery Manager, Growth Manager |
| 5 | Head, Director | Head of Design, Head of Engineering, Design Director |
| 6 | C-level và Stakeholder | CEO, CPO, CTO, Stakeholder |
| 7 | Client | Client |
| 8 | User | User (mạnh nhất) |

### 3.2 `tm_hourly_actions` — 8 hành động

Mã `id` là cố định trong code (mỗi mã ứng với một mini-game). CMS sửa nội dung và tham số, **không** thêm hay xoá dòng.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | text PK | `read` · `fight` · `poptask` · `flashcard` · `coffee` · `hide` · `race` · `gossip` |
| `sort_order` | int | |
| `name` | text | Tên hiển thị, ví dụ "Nấu xói". |
| `title_template` | text | Tên nhiệm vụ, có biến `{target}` và (riêng `gossip`) `{partner}`. |
| `offer_text` | text | Lời Nhân Lưu khi giao. Dùng được `{target}`, `{partner}`. |
| `win_text` | text | Lời Nhân Lưu khi người chơi thắng. |
| `lose_text` | text | Lời Nhân Lưu khi người chơi thua. |
| `weight` | int ≥ 1 | Trọng số xuất hiện trong vòng xoay. |
| `config` | jsonb | Tham số mini-game, khoá và giá trị mặc định ở mục 5. |
| `is_active` | bool | Tắt thì hành động không vào vòng xoay. |

### 3.3 `tm_hourly_lines` — lời thoại trong mini-game

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | text PK | |
| `action_id` | FK → `tm_hourly_actions` | |
| `kind` | text | Xem bảng dưới. |
| `character_id` | FK → `tm_characters`, nullable | Trống = câu dùng chung. Có giá trị = câu riêng của nhân vật đó. |
| `text` | text | |
| `is_active` | bool | |

Quy tắc chọn câu: ưu tiên câu riêng của nhân vật, không có thì lấy ngẫu nhiên trong các câu chung cùng `action_id` + `kind`.

| `action_id` | `kind` | Ai nói, lúc nào |
| --- | --- | --- |
| `poptask` | `task` | Chữ trên tờ pop-task khi dính vào nhân vật |
| `poptask` | `react` | Nhân vật bị ném trúng |
| `fight` | `start` | Nhân vật, lúc bắt đầu đánh |
| `coffee` | `spill` | NPC bị va làm đổ cà phê |
| `coffee` | `thanks` | Nhân vật nhận cà phê |
| `hide` | `hint` | NPC khác khi được hỏi. Biến `{room}` = tên phòng nhân vật đang trốn |
| `hide` | `found` | Nhân vật khi bị tìm ra |
| `race` | `start` | Nhân vật trước khi chạy |
| `gossip` | `say` | Câu người chơi nấu xói. `character_id` ở đây là **người bị nấu xói** |
| `gossip` | `caught` | Người bị nấu xói khi bắt quả tang |

### 3.4 `tm_quiz_questions` — câu hỏi trắc nghiệm

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | text PK | |
| `character_id` | FK → `tm_characters` | Hỏi về bài viết của nhân vật này. |
| `question` | text | |
| `options` | jsonb (mảng 3 text) | |
| `correct_index` | int 0–2 | |
| `is_active` | bool | |

### 3.5 `tm_badges` — huy hiệu

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | text PK | slug |
| `sort_order` | int | |
| `name` | text | |
| `description` | text | Câu hiện trên thẻ. |
| `image_url` | text, nullable | Hình mặt đồng xu, admin upload (mục 8.4). Trống thì dùng logo TELOS. |
| `rim_color` | text | Màu viền và mặt lưng đồng xu. Mặc định `#FFC53D`. |
| `condition_type` | text | Xem mục 6.3. |
| `action_id` | FK → `tm_hourly_actions`, nullable | |
| `threshold` | int, nullable | |
| `params` | jsonb | Tham số phụ của điều kiện. |
| `is_hidden` | bool | true: chưa mở thì chỉ hiện bóng đen và "???". false: hiện tên và điều kiện ngay. |
| `is_active` | bool | |
| `reward_title`, `reward_note`, `reward_url` | text, nullable | **Chừa sẵn** cho team đổi quà. |
| `reward_status` | text | `none` (mặc định) · `coming` · `open`. Đợt này game chỉ hiện nhãn "Quà: sắp có" khi là `coming`, và nút mở `reward_url` khi là `open`. |

### 3.6 `tm_hourly_config` — một dòng duy nhất

| Cột | Mặc định | Ghi chú |
| --- | --- | --- |
| `slot_minutes` | 60 | Độ dài một lượt xoay. |
| `no_repeat_slots` | 3 | Không lặp lại cặp của N lượt gần nhất. |
| `counted_wins_per_slot` | 1 | Mỗi lượt, tối đa bao nhiêu lần thắng được tính vào huy hiệu. |
| `is_enabled` | true | Tắt toàn bộ tính năng. |

### 3.7 Quyền

`select` cho `anon`, ghi chỉ cho admin, đúng cơ chế các bảng `tm_*` đang dùng.

## 4. Vòng xoay và luồng chơi

### 4.1 Cặp hợp lệ

Tập cặp được tính riêng cho từng quy mô (`small` / `large` / `agency`). Một cặp `(action, character)` hợp lệ khi **tất cả** đúng:

- Hành động `is_active`; nhân vật `is_active` và có vị trí ngồi (placement) trong quy mô đó.
- Nhân vật không phải `kind = player` và không phải `kind = author`.
- `action.id` không nằm trong `hourly_exclude` của nhân vật.
- Điều kiện riêng theo hành động:

| Hành động | Điều kiện thêm |
| --- | --- |
| `read` | Nhân vật có bài đã xuất bản (URL bài sau khi phân giải khác rỗng) **và** có ít nhất 1 câu hỏi đang bật. |
| `flashcard` | Nhân vật có ít nhất `config.min_terms` thuật ngữ trong `related_term_ids`. |
| `coffee`, `race` | Nhân vật **không** ngồi ở phòng Pantry của quy mô đó. |
| `gossip` | Tìm được ít nhất 1 người để nấu xói cùng (mục 5.8). |

Nhân vật có nhiều vị trí trong một quy mô thì dùng vị trí có `id` nhỏ nhất theo thứ tự chữ cái.

### 4.2 Chọn cặp theo giờ

Không có server, nên mọi trình duyệt phải tự tính ra **cùng một kết quả** từ đồng hồ:

1. `slot = floor(Date.now() / (slot_minutes × 60000))`.
2. Sắp danh sách cặp hợp lệ theo `action_id`, rồi `character_id`. Nhân bản mỗi cặp theo `weight` của hành động.
3. `cycle = floor(slot / N)`, với N là độ dài danh sách. Xáo danh sách bằng bộ sinh số ngẫu nhiên có seed = `cycle` (ví dụ mulberry32), lấy phần tử thứ `slot mod N`.
4. Nếu cặp chọn ra trùng với một trong `no_repeat_slots` lượt liền trước (tính lại bằng chính hàm này), lấy phần tử kế tiếp trong danh sách đã xáo, lặp tới khi không trùng.
5. Nên tránh hai lượt liên tiếp cùng một hành động: nếu trùng hành động với lượt trước và còn cặp khác hành động, cũng nhảy sang phần tử kế tiếp.

Giờ lấy từ máy người chơi. Người chỉnh đồng hồ máy sẽ thấy nhiệm vụ khác; chấp nhận, không chống gian lận.

Nếu admin sửa dữ liệu làm danh sách cặp thay đổi thì nhiệm vụ của lượt hiện tại có thể đổi theo. Người đã nhận nhiệm vụ vẫn giữ bản đã nhận.

### 4.3 Nhận nhiệm vụ

- Chỉ có ở chế độ **Khám phá** và **Quest**. Không có ở "Báo cáo cho ai".
- Trên HUD thêm một chip "Nhiệm vụ giờ này" có đồng hồ đếm ngược tới lượt kế. Bấm vào chip thì camera chỉ hướng tới Nhân Lưu (mũi tên hoặc đánh dấu `!` trên đầu ổng).
- Nói chuyện với Nhân Lưu: bảng thông tin của ổng có thêm thẻ nhiệm vụ gồm tên (từ `title_template`), lời giao (`offer_text`), đếm ngược, nút **"Nhận"**. Hai nút "Tìm hiểu thêm" và "Nhận quà" giữ nguyên.
- Đang làm dở một nhiệm vụ chính (`main`) thì nút "Nhận" bị khoá, ghi "Làm xong nhiệm vụ đang dở đã". Ngược lại cũng vậy: đang làm nhiệm vụ giờ thì không nhận nhiệm vụ chính.
- Nhận xong: lưu bản chụp `{slot, scale, action_id, character_id, partner_id}` vào localStorage. Thẻ quest trên HUD hiện mục tiêu, có nút "Bỏ".
- Hết giờ khi đang làm dở: vẫn được làm tiếp bản đã nhận. Xong hoặc bỏ thì mới thấy nhiệm vụ của lượt mới.

### 4.4 Chơi và trả nhiệm vụ

- Nhân vật mục tiêu có dấu ◆ trên đầu. Người chơi tới nói chuyện với nhân vật đó để bắt đầu mini-game. Ngoại lệ: `coffee` bắt đầu ở Pantry, `gossip` bắt đầu ở người nấu xói cùng.
- Trong lúc chơi mini-game: khoá mở bảng thông tin nhân vật, khoá đổi quy mô và đổi chế độ, phím Esc hoặc nút "Thoát" để bỏ lượt chơi (tính là thua).
- **Thắng**: Nhân Lưu tự đi tới chỗ người chơi (dùng trạng thái NPC `quest` có sẵn), nói `win_text`, rồi hiện bảng kết quả. Người chơi không phải đi tìm ổng.
- **Thua**: hiện `lose_text` ngay tại chỗ, có nút "Chơi lại". Chơi lại không giới hạn số lần.
- Sau khi thắng, trong cùng lượt vẫn chơi lại được cho vui, nhưng chỉ `counted_wins_per_slot` lần thắng đầu được tính vào huy hiệu. Số lần **thua** luôn được tính (cần cho huy hiệu "Quả báo tới sớm").
- Bảng kết quả: tên nhiệm vụ, kết quả, huy hiệu vừa mở (nếu có) với đồng xu 3D xoay ra, nút "Xem huy hiệu".

## 5. Tám mini-game

Quy ước chung:

- Mỗi mini-game có một thanh HUD riêng ở giữa phía trên, dùng token màu TELOS đang có.
- Mọi thao tác phải làm được bằng **cả bàn phím lẫn chạm**: phím Space tương đương một nút to trên màn hình.
- Các con số bên dưới là giá trị mặc định, lưu trong `config` của hành động, CMS sửa được.
- Kết thúc mini-game, engine phát một sự kiện kết quả:
  `{ action_id, character_id, rank, scale, slot, win, flawless, secs, fail_kind }` — đầu vào cho mục 6.

### 5.1 `read` — Đọc bài và trả lời

1. Nói chuyện với nhân vật → bảng thông tin như thường lệ, thêm nút **"Đọc xong rồi, hỏi đi"**. Nút này chỉ bật sau khi người chơi đã bấm "Đọc bài đầy đủ" (bài mở ở tab mới).
2. Hiện 1 câu hỏi ngẫu nhiên của nhân vật đó, 3 đáp án, thứ tự đáp án xáo mỗi lần.
3. Đúng → thắng. Sai → thua; phải đợi `retry_wait_secs` (10) mới chơi lại, ưu tiên đổi sang câu khác nếu có.

`flawless`: đúng ngay lần đầu trong lượt.

### 5.2 `fight` — Đánh nhau

Kéo co bằng thanh lực, không có hình ảnh bạo lực: hai nhân vật đứng đối mặt, đẩy nhau, mặt nhăn, có bụi bay.

- Thanh lực bắt đầu ở `start_percent` (50). Trận kéo dài `duration_secs` (10).
- Mỗi lần bấm Space hoặc chạm: thanh tăng `tap_gain` (2,5). Bỏ qua sự kiện giữ phím (`event.repeat`), tối đa `max_taps_per_sec` (15).
- Đối thủ đẩy ngược liên tục: `npc_base + npc_per_rank × rank` điểm mỗi giây (5 + 1,9 × cấp).
- Thanh chạm 100 → thắng ngay. Chạm 0 → thua ngay. Hết giờ: trên 50 là thắng.

Với mặc định, người chơi cần khoảng 2,8 lần bấm mỗi giây để hoà với Intern, 6,6 với C-level và Stakeholder, 7,3 với Client, 8,1 với User.

`flawless`: thanh lực chưa lần nào xuống dưới 50.

### 5.3 `poptask` — Ném pop-task

- Bắt đầu: nhân vật rời ghế, đi lại trong phòng mình với tốc độ nhân `target_speed_factor` (1,25).
- Người chơi có `ammo` (6) tờ pop-task. Bấm hoặc chạm vào một điểm trên sàn để ném tới điểm đó; tờ giấy bay theo đường cong trong `flight_secs` (0,45 giây), tầm xa tối đa `max_range` (6).
- Lúc tờ giấy chạm đất, nhân vật nằm trong bán kính `hit_radius` (0,6) thì tính là trúng: giấy dính lên người, hiện một câu `task`, nhân vật đổi mặt và nói một câu `react`.
- Trong mini-game này, bấm sàn là ném chứ không phải di chuyển. Di chuyển bằng WASD.
- Trúng đủ `hits_needed` (3) → thắng. Hết giấy → thua.

`flawless`: ba phát đầu tiên đều trúng.

### 5.4 `flashcard` — Lật flashcard

Tận dụng game flashcard đã có trong kho thuật ngữ **[XÁC NHẬN TRONG REPO: tên module, cách gọi, có nhận danh sách thuật ngữ đầu vào và trả kết quả về được không]**.

- Đầu vào: `cards` (4) thuật ngữ lấy ngẫu nhiên từ `related_term_ids` của nhân vật.
- Mở game flashcard dạng lớp phủ trên trang game, không rời trang.
- Đúng từ `pass_correct` (3) thẻ trở lên → thắng.
- Nếu game flashcard hiện tại không nhúng được hoặc không trả kết quả, làm bản rút gọn ngay trong engine: hiện định nghĩa của thuật ngữ, chọn đúng tên trong 3 lựa chọn (2 lựa chọn sai lấy từ thuật ngữ khác cùng nhóm).

`flawless`: đúng tất cả các thẻ.

### 5.5 `coffee` — Mang cà phê

- Tới điểm lấy cà phê trong Pantry (vòng hồng trên sàn, cùng kiểu điểm `present`), đứng 1 giây để nhận ly. Ly cà phê hiện trên tay người chơi.
- Mang tới nhân vật trong `secs_per_cup` (30 giây).
- **Va chạm**: không dựng lại vật lý, các nhân vật vẫn đi xuyên nhau như cũ. Chỉ trong lúc đang cầm ly, mỗi khung hình đo khoảng cách từ người chơi tới từng NPC (trừ nhân vật nhận cà phê); nhỏ hơn `spill_radius` (0,7) thì đổ: ly rơi, có vệt nước trên sàn vài giây, NPC đó nói một câu `spill`.
- Đổ hoặc hết giờ thì phải quay lại Pantry lấy ly mới, đồng hồ đếm lại. Tối đa `max_cups` (3) ly, hết thì thua.
- Tới nơi: nhân vật nói một câu `thanks` → thắng.

`flawless`: không đổ ly nào.

### 5.6 `hide` — Trốn tìm

- Nói chuyện với Nhân Lưu và bấm "Nhận" xong là nhân vật bỏ trốn luôn (hành động này không cần tới gặp nhân vật trước).
- Màn hình tối lại, đếm `countdown_secs` (3-2-1). Trong lúc đó nhân vật được đặt vào một điểm nấp ở **phòng khác** phòng của họ và khác phòng người chơi đang đứng.
- **Điểm nấp** tính tự động từ đồ đạc có sẵn của mỗi phòng: cạnh chậu cây, sau beanbag, sau TV, sau đầu bàn. Mỗi phòng 2–3 điểm, phải là ô đi tới được trên lưới tìm đường. Không cần nhập trong CMS.
- Khi đang trốn: nhân vật ngồi thụp (co chiều cao còn khoảng 60%), ẩn nhãn tên và dấu ◆, thỉnh thoảng nhô đầu lên.
- Người chơi có `secs` (60 giây). Tới gần và bấm nói chuyện là tìm ra → nhân vật nói câu `found` → thắng. Hết giờ → thua, nhân vật tự đi về ghế.
- Hỏi bất kỳ NPC nào khác trong lúc đang tìm: họ trả lời một câu `hint` có tên phòng đúng, không mở bảng thông tin.

`flawless`: tìm ra mà không hỏi gợi ý lần nào.

### 5.7 `race` — Chạy đua

- Vạch xuất phát: ghế của nhân vật. Đích: điểm giữa Pantry của quy mô (vòng hồng).
- Đếm 3-2-1. Người chơi di chuyển trước khi có hiệu lệnh thì bị đứng yên `false_start_penalty_secs` (1 giây).
- Nhân vật xuất phát trễ `npc_delay_secs` (0,5 giây), chạy theo đường tìm được bằng A*, tốc độ = tốc độ người chơi × `speed_top − speed_step × (rank − 1)`, tức 0,97 với Intern và giảm 0,055 mỗi cấp (User còn khoảng 0,59).
- Ai vào vòng đích trước thì thắng.

`flawless`: thắng mà không phạm lỗi xuất phát sớm.

### 5.8 `gossip` — Nấu xói

Nhiệm vụ có hai nhân vật: **người bị nấu xói** (`{target}`) và **người nấu xói cùng** (`{partner}`).

Chọn người nấu xói cùng:

- Nếu `gossip_partner_ids` của target có giá trị: lấy những người trong danh sách có vị trí ở quy mô hiện tại.
- Nếu trống: lấy những nhân vật ngồi **cùng phòng** với target, loại trừ chính target, người chơi, Nhân Lưu và **sếp trực tiếp** của target (người mà target báo cáo ở quy mô đó).
- Trong các ứng viên, chọn một người theo cùng seed của lượt (để mọi người chơi thấy cùng một cặp).

Cách chơi:

1. Người chơi tới chỗ partner (dấu ◆) và bấm nói chuyện để bắt đầu. Đồng hồ `time_limit_secs` (45 giây) chạy.
2. **Giữ** Space hoặc giữ ngón tay trên nút "Nấu xói" để thì thầm. Thanh "độ hả dạ" đầy dần, cần tổng cộng `fill_secs` (8 giây) giữ. Trong lúc giữ, bong bóng thoại hiện câu `say` của target, mỗi 2–3 giây đổi câu.
3. Target rời ghế, đi tuần quanh hai người theo chu kỳ: lại gần và đứng 1,5–3 giây, rồi lảng ra xa 2–4 giây. Quanh target có vòng tròn "tầm nghe" bán kính `hear_radius` (2,2) vẽ trên sàn.
4. Trước mỗi lần quay lại gần, trên đầu target hiện dấu "?" trong `warn_secs` (0,6 giây) để người chơi kịp thả tay.
5. Người chơi đang giữ mà nằm trong tầm nghe quá `grace_secs` (0,25 giây) → bị bắt quả tang: target nói câu `caught`, thua với `fail_kind = "caught"`.
6. Thả tay thì thanh đứng yên, không tụt. Đầy thanh → thắng. Hết giờ mà chưa đầy → thua với `fail_kind = "timeout"`.

`flawless`: thắng mà target chưa lần nào lọt vào tầm nghe lúc đang giữ (kể cả trong khoảng `grace_secs`).

## 6. Tiến độ và huy hiệu

### 6.1 Lưu ở đâu

Một khoá localStorage, ví dụ `tm_hourly_v1`, bọc mọi thao tác đọc ghi trong try/catch. Không đọc được thì game vẫn chạy, chỉ không lưu.

```json
{
  "accepted": { "slot": 493211, "scale": "large", "action_id": "gossip", "character_id": "qa-engineer", "partner_id": "frontend-developer" },
  "slots": { "493211:large": { "wins": 1 } },
  "stats": {
    "gossip": { "wins": 3, "flawless": 2, "streak": 3, "best_secs": 12.4,
                "characters": ["qa-engineer"], "fails": { "caught": 1, "timeout": 0 } }
  },
  "badges": { "qua-bao-toi-som": "2026-10-03T09:12:00Z" }
}
```

`slots` chỉ giữ 48 lượt gần nhất.

Màn huy hiệu ghi rõ một dòng: "Huy hiệu lưu trên trình duyệt này. Đổi máy hoặc xoá dữ liệu trình duyệt là mất."

### 6.2 Cập nhật sau mỗi sự kiện kết quả

- Thắng và còn trong hạn mức `counted_wins_per_slot` của lượt: `wins + 1`; nếu `flawless` thì `flawless + 1`; `streak + 1`; thêm `character_id` vào `characters` nếu chưa có; cập nhật `best_secs` nếu nhanh hơn. Ghi thêm `win_vs`: danh sách `{character_id, rank}` đã thắng.
- Thua (luôn tính): `fails[fail_kind] + 1`; `streak = 0`.
- Sau đó chấm lại toàn bộ huy hiệu đang bật mà người chơi chưa có.

### 6.3 Loại điều kiện (`condition_type`)

| Loại | Mở khi | Tham số |
| --- | --- | --- |
| `wins` | Số lần thắng hành động ≥ `threshold` | `action_id` |
| `distinct_characters` | Thắng hành động với ≥ `threshold` nhân vật khác nhau | `action_id` |
| `flawless_wins` | Số lần thắng "sạch" ≥ `threshold` | `action_id` |
| `win_streak` | Chuỗi thắng liên tiếp hiện tại ≥ `threshold` | `action_id` |
| `win_under_secs` | Có lần thắng với thời gian ≤ `params.secs` | `action_id`, `params.secs` |
| `win_vs` | Đã thắng nhân vật `params.character_id`, hoặc nhân vật có cấp trong khoảng `params.rank_min`…`params.rank_max` | `action_id`, `params` |
| `fail_count` | Số lần thua kiểu `params.fail_kind` ≥ `threshold` | `action_id`, `params.fail_kind` |
| `all_actions` | Đã thắng ít nhất 1 lần ở **mọi hành động đang bật** | — |

Loại điều kiện là danh sách cố định trong code. CMS chọn loại, hành động, ngưỡng và tham số.

### 6.4 Mười huy hiệu mẫu

| # | Tên | Mô tả trên thẻ | Điều kiện |
| --- | --- | --- | --- |
| 1 | Kiệt gì cũng bắc | Giờ ai làm gì mình cũng biết hết rồi, chỉ không biết làm sao để tăng lương thôi | `distinct_characters` · `read` · 5 |
| 2 | Khách hàng không phải thượng đế | Hạ được người mạnh nhất công ty: người dùng. | `win_vs` · `fight` · `character_id = user` |
| 3 | Trùm giao việc | Việc gấp nha, chiều nay gửi anh. | `flawless_wins` · `poptask` · 1 |
| 4 | Từ điển sống | Nói chuyện toàn jargon, không ai hiểu nhưng ai cũng nể. | `flawless_wins` · `flashcard` · 3 |
| 5 | Barista không lương | Kỹ năng không ghi trong JD nhưng dùng nhiều nhất. | `flawless_wins` · `coffee` · 5 |
| 6 | Mày thích trốn hong? | Trốn họp kiểu gì cũng bị tìm ra. | `win_under_secs` · `hide` · 15 giây |
| 7 | Trùm chạy chọt | Nhanh hơn cả intern lúc 6 giờ chiều. | `win_vs` · `race` · `rank_max = 1` |
| 8 | Rắn độc văn phòng | Skrrrr | `win_streak` · `gossip` · 5 |
| 9 | Quả báo tới sớm | Hồi nãy em nói gì chị đó Mai? | `fail_count` · `gossip` · `caught` · 3 |
| 10 | Nhân viên của tháng | Phần thưởng: thêm việc. | `all_actions` |

Huy hiệu 8 dùng **chuỗi thắng liên tiếp** chứ không phải "chưa từng bị bắt", để người chơi vẫn lấy được cả 8 lẫn 9.

## 7. Màn huy hiệu và đồng xu 3D

### 7.1 Bộ sưu tập

- HUD có nút **"Huy hiệu"** kèm số đã mở trên tổng số, ví dụ "3/10".
- Mở ra một lưới các huy hiệu. Ở lưới dùng ảnh 2D tròn (thẻ `<img>`), không dựng 3D cho từng ô.
- Huy hiệu chưa mở và `is_hidden = true`: hình tròn đen, tên "???", không hiện điều kiện. Chưa mở và `is_hidden = false`: hình mờ, hiện tên và điều kiện.
- Bấm vào huy hiệu đã mở → mở trình xem 3D.

### 7.2 Trình xem 3D

- Một canvas Three.js riêng (cùng bản r128 đang dùng), chỉ tạo khi mở, huỷ khi đóng.
- Đồng xu: `CylinderGeometry` bán kính 1, dày 0,12, 64 cạnh, đặt đứng. Ba vật liệu: viền dùng `rim_color` có độ bóng kim loại; mặt trước dán `image_url`; mặt sau là nền `rim_color` với logo TELOS và ngày đạt được.
- Hình mặt trước được cắt tròn bằng UV của nắp trụ, nên admin chỉ cần up hình vuông.
- Tự xoay chậm quanh trục đứng. Kéo chuột hoặc vuốt để xoay theo tay, thả ra có quán tính rồi về lại tự xoay. Tôn trọng `prefers-reduced-motion`: không tự xoay.
- Lần đầu mở huy hiệu (ngay sau khi đạt): đồng xu bay vào, xoay nhanh rồi chậm dần.
- Tải texture với `crossOrigin = 'anonymous'`. Bucket lưu hình phải cho phép CORS, nếu không sẽ không xuất được ảnh.

### 7.3 Nút "Lưu ảnh"

- Xuất một thẻ PNG 1080 × 1350, vẽ bằng canvas 2D: nền theo token TELOS, đồng xu ở **đúng góc đang xoay** (render một khung rồi `drawImage` từ canvas 3D), tên huy hiệu, câu mô tả, ngày đạt, logo TELOS và địa chỉ `uiux-library.nhanluu.com`.
- Trên điện thoại: nếu trình duyệt hỗ trợ `navigator.share` với file thì mở bảng chia sẻ; không thì tải file về.
- Tên file: `telos-huy-hieu-<id>.png`.
- Chỉ dùng được với huy hiệu đã mở.

## 8. CMS

Thêm vào khu "Team Map" trong trang admin. Lưu là có hiệu lực ngay, như các tab hiện có.

### 8.1 Form nhân vật (tab Nhân vật có sẵn)

Thêm nhóm trường "Nhiệm vụ theo giờ":

- **Cấp bậc** (1–8), có chú thích thang cấp.
- **Thuật ngữ liên quan**: chọn nhiều từ kho thuật ngữ, có ô tìm kiếm.
- **Người nấu xói cùng**: chọn nhiều nhân vật; để trống = tự động.
- **Không tham gia hành động**: 8 ô tick.
- Một dòng chỉ đọc cho biết nhân vật đang hợp lệ với những hành động nào và vì sao không (ví dụ "Đọc bài: chưa có bài viết", "Flashcard: mới có 2/4 thuật ngữ").

### 8.2 Tab "Nhiệm vụ theo giờ"

- Công tắc bật tắt toàn bộ, độ dài lượt, số lượt không lặp, số lần thắng được tính mỗi lượt.
- Danh sách 8 hành động: bật tắt, tên, mẫu tên nhiệm vụ, ba câu thoại của Nhân Lưu, trọng số, và các tham số trong `config` dưới dạng ô nhập số có nhãn tiếng Việt.
- Khối **"Đang chạy"**: nhiệm vụ của lượt hiện tại và 5 lượt kế tiếp cho từng quy mô, tính bằng đúng hàm mà game dùng. Kèm số cặp hợp lệ của mỗi quy mô.

### 8.3 Tab "Câu hỏi và lời thoại"

- **Câu hỏi**: lọc theo nhân vật; thêm, sửa, xoá, bật tắt; 3 đáp án, chọn đáp án đúng.
- **Lời thoại**: lọc theo hành động và loại câu; ô nhân vật để trống nghĩa là câu chung.

### 8.4 Tab "Huy hiệu"

- Danh sách kéo thả đổi thứ tự; thêm, sửa, xoá, bật tắt.
- Form: tên, mô tả, **upload hình**, màu viền, loại điều kiện, hành động, ngưỡng, tham số (hiện đúng ô cần cho loại điều kiện đã chọn), ẩn hay hiện, và nhóm "Quà" (tiêu đề, ghi chú, link, trạng thái).
- Upload: PNG hoặc WebP vuông, khuyến nghị 1024 × 1024, tối đa 1 MB, nội dung chính nằm trong hình tròn nội tiếp. Lưu vào Supabase Storage theo cách repo đang upload hình **[XÁC NHẬN TRONG REPO]**; bucket đọc công khai và bật CORS.
- Bên cạnh form có **bản xem trước đồng xu 3D** dùng chính trình xem ở mục 7.2.
- Xoá huy hiệu: người chơi đã có huy hiệu đó sẽ không còn thấy nó. Cảnh báo trước khi xoá, khuyên tắt thay vì xoá.

### 8.5 Excel

Thêm vào file export/import hiện có, theo đúng quy ước cũ (dòng 2 là khoá kỹ thuật, upsert theo `id`, có màn xem trước, import không xoá):

| Sheet | Cột |
| --- | --- |
| `Nhan vat` (có sẵn) | Thêm: Cấp bậc · Thuật ngữ liên quan · Người nấu xói cùng · Không tham gia hành động |
| `Hanh dong` | id · Tên · Mẫu tên nhiệm vụ · Lời giao · Lời khi thắng · Lời khi thua · Trọng số · Tham số (JSON) · Hiển thị. Chỉ cập nhật 8 id có sẵn; id lạ là lỗi. |
| `Cau hoi` | id · Nhân vật (id) · *Chức danh* · Câu hỏi · Đáp án 1 · Đáp án 2 · Đáp án 3 · Đáp án đúng (1–3) · Hiển thị |
| `Loi thoai` | id · Hành động · Loại câu · Nhân vật (id) · *Chức danh* · Câu thoại · Hiển thị |
| `Huy hieu` | id · Thứ tự · Tên · Mô tả · Link hình · Màu viền · Loại điều kiện · Hành động · Ngưỡng · Tham số (JSON) · Ẩn · Hiển thị · Quà: tiêu đề · Quà: ghi chú · Quà: link · Quà: trạng thái |

Hình huy hiệu không đi qua Excel; cột "Link hình" chỉ nhận URL đã upload.

## 9. Seed

Đọc `seed-hourly.json`, upsert theo `id`, chạy lại nhiều lần không tạo trùng:

1. `config` → `tm_hourly_config`.
2. `character_rank` → cột `rank` của `tm_characters`. Id không tồn tại thì bỏ qua và in ra.
3. `actions` → `tm_hourly_actions`.
4. `lines` → `tm_hourly_lines`. Câu có `character_id` không tồn tại (ví dụ nhân vật agency chưa được seed) thì bỏ qua và in ra.
5. `quiz_questions` → `tm_quiz_questions`. Có 12 câu cho 12 nhân vật đang có bài.
6. `badges` → `tm_badges`. `image_url` để trống, admin upload sau.
7. **Thuật ngữ liên quan**: với mỗi nhân vật chưa có `related_term_ids`, tự điền bằng các thuật ngữ trong thẻ thưởng của những nhiệm vụ chính mà nhân vật đó tham gia (là người giao, người được gọi họp, hoặc người cần gặp ở một bước). In báo cáo nhân vật nào có dưới 4 thuật ngữ để chủ dự án bổ sung tay.

12 câu hỏi trong seed viết theo kiến thức chung về vai trò, chưa đối chiếu với từng bài viết. Chủ dự án sẽ rà lại trong CMS.

## 10. Ngoài phạm vi đợt này

- Đăng nhập, đồng bộ tiến độ giữa các máy, bảng xếp hạng.
- Luồng đổi quà (chỉ có trường dữ liệu và nhãn hiển thị).
- Chống gian lận (sửa đồng hồ máy, sửa localStorage).
- Thêm loại hành động hoặc loại điều kiện mới từ CMS (cần sửa engine).
- Va chạm vật lý giữa các nhân vật ngoài mini-game cà phê.
- Âm thanh.

## 11. Tiêu chí nghiệm thu

1. Mở game ở hai trình duyệt khác nhau, cùng quy mô, cùng giờ → thấy cùng một nhiệm vụ. Đổi quy mô → nhiệm vụ đổi theo nhân vật của quy mô đó.
2. Giả lập 200 lượt liên tiếp bằng hàm chọn cặp: không cặp nào lặp lại trong 3 lượt liền kề; mọi cặp đều hợp lệ theo mục 4.1.
3. Nhân vật chưa có bài không bao giờ xuất hiện với hành động `read`. Nhân vật ngồi ở Pantry không xuất hiện với `coffee` và `race`.
4. Đang làm nhiệm vụ chính thì không nhận được nhiệm vụ giờ, và ngược lại.
5. Cả 8 mini-game chơi được từ đầu tới lúc thắng và tới lúc thua, bằng bàn phím và bằng chạm.
6. `fight`: thắng Intern dễ, thắng User cần bấm rất nhanh; giữ phím Space không làm thanh tăng.
7. `coffee`: đi sát một NPC thì đổ ly; ngoài mini-game này các nhân vật vẫn đi xuyên nhau như cũ.
8. `hide`: nhân vật không bao giờ trốn trong phòng của chính họ hoặc ở ô không đi tới được; câu gợi ý nêu đúng phòng.
9. `gossip`: người nấu xói cùng không bao giờ là sếp trực tiếp của target; giữ Space khi target trong tầm nghe thì bị bắt; thả tay thì không bị.
10. Thắng xong, Nhân Lưu tự đi tới chỗ người chơi và nói câu thắng.
11. Thắng lần hai trong cùng lượt không làm tăng số liệu huy hiệu; thua thì vẫn tăng số lần thua.
12. Bị bắt quả tang nấu xói 3 lần → mở "Quả báo tới sớm". Tải lại trang, huy hiệu vẫn còn.
13. Huy hiệu ẩn chưa mở chỉ hiện bóng đen và "???".
14. Đồng xu 3D tự xoay, kéo để xoay được bằng chuột và bằng ngón tay, hình admin upload hiện đúng trên mặt trước.
15. "Lưu ảnh" tải về PNG 1080 × 1350 có đồng xu, tên, mô tả, ngày, logo TELOS.
16. CMS: upload hình huy hiệu → bản xem trước 3D cập nhật → mở game thấy hình mới. Tắt một hành động → nó biến mất khỏi khối "Đang chạy".
17. Excel: export rồi import lại ngay ra "0 thêm · 0 cập nhật · 0 lỗi" trên cả các sheet mới.
18. Chặn localStorage (chế độ riêng tư) → game và mini-game vẫn chạy, chỉ không lưu huy hiệu, không có lỗi trên console.
19. Tìm toàn bộ chuỗi hiển thị cho người chơi: không còn chữ "nói xấu", chỉ có "nấu xói".
