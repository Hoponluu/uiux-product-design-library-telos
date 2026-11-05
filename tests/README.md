# Kiểm thử: hướng dẫn cho agent

Đọc `CLAUDE.md` trước. Tóm tắt quy tắc của chủ dự án:
- **Mặc định mức 1:** sửa xong chỉ kiểm tra cú pháp. Không tự chạy test trình duyệt, không tự chụp ảnh.
- **Hỏi trước khi chạy test**, nói rõ kiểm tra gì và mất bao lâu. Chủ dự án chọn phạm vi; không tự chạy lại toàn bộ test cũ.
- **Sửa phần dùng chung thì cảnh báo vùng ảnh hưởng**, không tự test. Phần dùng chung gồm menu (`api/_lib/nav.js`, `nav/`), engine Product Map (`team-map/team-map.engine.js`), SQL / schema Supabase.
- **Không đụng production:** dùng dữ liệu mẫu hoặc DB local, chặn Supabase thật và Google Analytics.

## Các mức
| Mức | Khi nào | Làm gì |
| --- | --- | --- |
| 0 | Đổi chữ, màu, khoảng cách nhỏ | Không test |
| 1 (mặc định) | Mọi thay đổi | Kiểm tra cú pháp (bảng dưới) |
| 2 | Chủ dự án đồng ý | Smoke test các trang liên quan, 1–2 ảnh chụp chỗ thay đổi |
| 3 | Chủ dự án yêu cầu | Kịch bản riêng cho tính năng / thử SQL trên DB local / hồi quy có giới hạn |

Khi hỏi, đề xuất cụ thể, ví dụ: *"Gọn (khoảng 3 phút): chạy 2 file SQL trên DB local, mở trang Hành trình ở desktop và mobile, chụp 2 ảnh."*

## Mức 1: kiểm tra cú pháp
| Loại file | Lệnh |
| --- | --- |
| JS (`api/`, `journey/`, `team-map/`, `nav/`, `scripts/*.js`) | `node --check <file>` |
| Python (`scripts/*.py`) | `python3 -m py_compile <file>` |
| JSON (`team-map/*.json`) | `python3 -c "import json;json.load(open('<file>'))"` |
| Shell | `bash -n <file>` |
| Trang render phía server | `node -e "require('./api/_lib/journey.js')"` (nạp được là không lỗi cú pháp) |
| File sinh tự động | Chạy lại script sinh rồi xem `git diff`: `python3 scripts/gen_team_map_journey_seed.py`, `node scripts/build_site_nav.js`, `python3 scripts/build_team_map_en.py`, `python3 scripts/gen_team_map_seed.py` |
| JS nhúng trong HTML (`TELOS_Knowledge_Graph.html`, `team-map.html`, `adminCMS.html`) | Không có lệnh nhanh; muốn chắc thì đề xuất smoke test (mức 2) |

## Công cụ trong thư mục này
- `tests/local-server.js`: server local mô phỏng Vercel (đọc `vercel.json`, chạy `api/`, trả file tĩnh). Mặc định tắt Supabase, nên trang thuật ngữ và Hành trình dùng dữ liệu mẫu trong repo.
- `tests/smoke.js`: mở trang ở nhiều cỡ màn hình, báo lỗi JS, chụp ảnh tuỳ chọn. Tự chặn Supabase và GA.
- `tests/db-local.sh`: Postgres local để thử file SQL (migration, seed) với stub các hàm của Supabase.

### Chạy nhanh
```bash
# 1. server (chạy nền)
(setsid nohup node tests/local-server.js 8799 > /tmp/telos-server.log 2>&1 &)
# 2. smoke test: chỉ các trang được yêu cầu
NP=/opt/node22/lib/node_modules node tests/smoke.js --paths /hanh-trinh-ui-ux --sizes 1440x900,390x844 --shots <thư mục nháp>/shots
# 3. thử SQL: dựng trạng thái cũ rồi chạy bản mới
bash tests/db-local.sh start
git show origin/<nhánh chính>:supabase_team_map_journey.sql > <thư mục nháp>/old.sql
bash tests/db-local.sh sql <thư mục nháp>/old.sql supabase_team_map_journey.sql supabase_team_map_journey_2026.sql
bash tests/db-local.sh psql "select id, kind, name from tm_journey_checkpoints order by sort_order"
bash tests/db-local.sh stop
```
Viết kịch bản riêng (mức 3) thì đặt ở thư mục nháp của phiên, dùng Playwright như `smoke.js`. Chỉ đưa vào repo khi chủ dự án yêu cầu.

## Lỗi môi trường đã gặp (đừng nhầm là lỗi code)
- **Container khởi động lại** sẽ tắt mọi server và DB, thư mục `/tmp` có thể mất. Chạy lại bước 1 và bước 3. Thư mục nháp của phiên cũng có thể mất khi đổi container.
- **Postgres không vào được thư mục nháp của agent** (chạy bằng user `postgres`), nên `db-local.sh` dùng `/tmp/telos-pg`.
- **Playwright:** có sẵn ở `/opt/node22/lib/node_modules`, Chromium ở `/opt/pw-browsers`. Đừng chạy `playwright install`. Graph 3D và Product Map cần cờ `--use-gl=swiftshader --enable-unsafe-swiftshader`.
- **Ảnh từ academy.telos.vn** đôi khi tải lỗi trong trình duyệt sandbox (`ERR_TOO_MANY_RETRIES`) dù `curl` vẫn lấy được. Đây là lỗi mạng của môi trường; đừng kết luận code hỏng.
- **Đừng dùng `pkill -f` / `pgrep -f`** với tên script: lệnh có thể tự diệt shell đang chạy. Tìm PID bằng `ps -eo pid,args | awk ...` rồi `kill`.
- **Toạ độ trên canvas:** khung Graph và Product Map nằm dưới header 80px (mobile 56px). Muốn bấm theo toạ độ thì lấy `getBoundingClientRect()` của canvas.
- **Animation:** chờ chuyển động xong (`busy`, transition, sheet trượt lên) rồi mới đo vị trí.
- **Bảng chào mừng của Product Map** mở sẵn khi vào trang; đóng nó trước khi thao tác.
- **Biến debug:** trang Hành trình có `window.__jx`; Product Map thêm `#debug` vào URL thì có `window.__tmE` (`openPanel`, `chars`, `player`). Graph có `graphInstance` (3D), `graph2d` (2D), `gView`, `focusCluster()`.
- **Kiểm tra nhánh chính trước khi làm:** ngày 9/10 nhánh chính từng bị force-push từ một phiên khác làm mất 2 PR đã merge. Chạy `git log origin/<nhánh chính>` và đối chiếu với các PR đã merge.
- **Test cũ sai sẵn:** bước "list behind is locked" (khoá cuộn danh sách phía sau hộp huy hiệu trên desktop) đã sai từ trước, chưa sửa.

## Danh mục kịch bản đã từng test (dựng lại khi chủ dự án yêu cầu)
| Khu vực | Kịch bản chính |
| --- | --- |
| Graph (`/`) | 2D mặc định, canh vừa đủ mọi nút; cuộn zoom về phía con trỏ; zoom vào cụm qua chú thích / nút nhóm (cụm khác mờ); +/−, "Toàn cảnh", Esc; tab 3D dựng lần đầu, nhớ lựa chọn, `?view=`; `?term=`; chế độ tối |
| Menu (mọi trang) | 4 mục + "⋯", mục đang ở sáng đúng; "⋯" mở / đóng, Esc, ↑ ↓; mobile: thanh tab dưới đáy, bảng "Thêm" nằm trên thanh; header không đè logo ở 1440 / 720 / 390px |
| Trang thuật ngữ (`/thuat-ngu/...`, `/en/glossary/...`) | Render đủ, breadcrumb, link về thư viện, bản EN, sitemap |
| Hành trình (`/hanh-trinh-ui-ux`) | 10 trạm đúng thứ tự; bấm trạm kế tiếp để đi, tự biến hình; bảng Vai trò / Khóa học đúng dữ liệu; xem trước trạm khác; thử thách flashcard đạt / trượt; tới đích chọn nơi làm việc sang Product Map đúng hình thái; mobile dọc; không WebGL thì dùng emoji |
| Product Map (`/team-map`, `/en/team-map`) | Vào văn phòng, đi lại, mở bảng nhân vật; đổi quy mô; quest; nhiệm vụ theo giờ và 8 mini-game; huy hiệu; mobile: bottom sheet nằm trên thanh tab, thanh tab luôn bấm được |
| CMS (`/adminCMS`) | Sửa và lưu từng tab; xuất Excel rồi nhập lại ra 0 thay đổi, 0 lỗi |
| SQL | Chạy file mới trên trạng thái cũ, chạy lại lần 2 không lỗi, chạy trên DB trống; hàm import nhận đúng id |
| GA | Sự kiện trong `docs/analytics-events.md` bắn đúng tham số (chặn gửi thật, đọc `window.dataLayer`) |
