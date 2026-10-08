# SPEC — Trang "Hành trình UI/UX" (từ Newbie tới Product Designer)

Tài liệu này dành cho Claude Code trong repo **uiux-library**, nơi Team Map (trang game, CMS, các bảng `tm_*`) đã chạy theo `SPEC.md`, `SPEC-agency.md` và `SPEC-hourly.md`.

Việc cần làm: thêm **một trang riêng, URL riêng** mô phỏng lộ trình học tại TELOS Academy. Nhân vật chính đi trên một con đường qua các checkpoint, mỗi checkpoint là một lớp học. Tới checkpoint thì đọc thông tin lớp và **biến hình** thành phiên bản cao cấp hơn. Đi hết đường thì bước vào cửa văn phòng và được dẫn sang Team Map, nghĩa là bắt đầu đi làm.

File đi kèm: **`seed-journey.json`**. Nếu tài liệu và JSON lệch nhau thì **JSON là chuẩn**. Nội dung lớp học trong seed lấy từ trang khóa học trên academy.telos.vn (tháng 10/2026).

Chỗ nào ghi **[XÁC NHẬN TRONG REPO]** là chỗ cần đọc code hiện có trước khi làm.

## 1. Các quyết định đã chốt với chủ dự án

| Chủ đề | Quyết định |
| --- | --- |
| Trang | Trang riêng, không nằm trong URL Team Map. Mục đích: SEO tốt và gửi riêng được module này. |
| Lộ trình chính | Figma → UI Căn bản → UX Căn bản → Design System → A.I. → Product Design & Manage. |
| Nhánh rẽ | Web Design (rẽ sau UI Căn bản) và Code for Designer (rẽ sau Design System). Không bắt buộc. |
| Kết thúc | Đi hết đường, bấm vào cửa văn phòng → sang Team Map. |
| Đăng nhập | Không có. Tiến độ lưu trên trình duyệt. |
| CMS sửa được | Tên checkpoint, khóa học tương ứng, nhân vật biến thành gì, mô tả checkpoint, kiến thức sẽ học. Chi tiết ở mục 7. |

Ba quyết định mình đặt mặc định, chủ dự án có thể đổi sau:

- **Thử thách ở checkpoint:** mặc định tới nơi là biến hình luôn. CMS có công tắc "Bắt buộc vượt thử thách" cho từng checkpoint, mặc định tắt.
- **Nơi làm việc đầu tiên:** ở cửa văn phòng, người chơi tự chọn Startup, Công ty sản phẩm hoặc Agency. Ai đã đi nhánh Web thì Agency được gợi ý sẵn.
- **Hình nhánh rẽ:** nhánh là một **vòng rẽ** tách khỏi đường chính rồi nhập lại ngay đoạn đó, nên không bỏ sót checkpoint chính nào.

## 2. Thay đổi cần làm, theo thứ tự

1. **Tách phần dựng nhân vật** khỏi engine Team Map ra một file dùng chung (mục 3). Kiểm tra Team Map vẫn chạy y như cũ trước khi làm tiếp.
2. Migration bảng `tm_journey_checkpoints` + RLS, seed từ `seed-journey.json` (mục 6, 9).
3. Dựng trang hành trình: URL, HTML nội dung cho SEO, cảnh 3D, điều khiển (mục 4, 5).
4. Thêm 4 đồ nghề mới vào danh sách props (mục 3.2).
5. Nối sang Team Map (mục 5.6).
6. CMS tab "Hành trình" và sheet Excel (mục 7).
7. Chạy danh sách nghiệm thu (mục 11).

## 3. Phần dùng chung giữa hai trang

### 3.1 Tách module nhân vật

Hai trang phải dùng **chung một nguồn** để dựng mascot. Không chép code sang trang mới.

- Tách từ engine Team Map ra một file, ví dụ `src/team-map.mascot.js`. File này gồm: dựng thân, mắt, miệng, tay chân, viền; bộ `PROPS`; màu theo nhóm; trạng thái thân tối (`dark`), màu thân tuỳ chỉnh, `outfit`; hàm vẽ mặt bằng CanvasTexture.
- Xuất ra một hàm kiểu `buildMascot(options) → THREE.Group` và hàm `setProps(group, props)` để thay đồ nghề khi biến hình mà không dựng lại cả nhân vật.
- Engine Team Map chuyển sang import file này. **Không đổi hành vi**: so ảnh chụp màn hình Team Map trước và sau khi tách ở cả ba quy mô, phải giống nhau.
- Cách nạp file theo đúng cách repo đang nạp script **[XÁC NHẬN TRONG REPO]** (thẻ script thường hay ES module).

### 3.2 Đồ nghề mới

Thêm vào `PROPS` (và vào danh sách hợp lệ ở mục 5.6 của `SPEC.md`):

| Mã | Hình | Vị trí |
| --- | --- | --- |
| `blocks` | Ba khối lego nhỏ màu hồng, cyan, vàng chồng lên nhau | Một tay |
| `robot` | Robot tròn nhỏ có một mắt sáng, bay lơ lửng cạnh vai, nhấp nhô chậm | Cạnh vai, không gắn tay |
| `browser` | Khung cửa sổ trình duyệt có ba chấm màu, nổi phía sau lưng | Sau lưng |
| `codeLaptop` | Laptop mở, màn hình có chữ `</>` | Kẹp nách hoặc tay còn lại |

Team Map cũng dùng được các đồ nghề này (CMS nhân vật chọn được).

### 3.3 Lưu tiến độ

Một khoá localStorage `tm_journey_v1`, bọc try/catch:

```json
{
  "visited": ["start", "figma", "ui", "web"],
  "challenge_passed": ["figma"],
  "finished_at": null,
  "workplace": null
}
```

Hai trang cùng tên miền nên Team Map đọc được khoá này.

## 4. Trang và SEO

### 4.1 Đường dẫn và menu

- URL đề xuất: `/hanh-trinh-ui-ux`. Theo cách đặt route hiện có của repo **[XÁC NHẬN TRONG REPO]**.
- Thêm mục menu "Hành trình" cạnh "Team Map".
- Trong Team Map, bảng thông tin của Nhân Lưu thêm nút **"Xem lộ trình học"** dẫn sang trang này.

### 4.2 Nội dung phải có sẵn trong HTML

Nội dung vẽ trong canvas 3D thì công cụ tìm kiếm không đọc được. Vì vậy trang có **hai lớp**:

1. **Khung game 3D** ở trên cùng, cao khoảng một màn hình.
2. **Phần lộ trình dạng chữ** ngay bên dưới, là HTML thật, đọc được cả khi không chạy JavaScript:
   - `h1`: "Lộ trình trở thành UI/UX Designer và Product Designer".
   - Mỗi checkpoint một `section` có `id` = mã checkpoint, gồm: `h2` tên checkpoint, tên khóa học (link về trang khóa), số buổi, mô tả, danh sách kiến thức (`ul`), dòng "Học xong bạn sẽ" và chức danh nhân vật đạt được.
   - Hai nhánh rẽ đặt ngay sau checkpoint mà chúng rẽ ra, có nhãn "Nhánh tuỳ chọn".
   - Bấm vào một checkpoint trong phần chữ thì cuộn lên khung game và camera bay tới checkpoint đó (nhân vật không dịch chuyển).

**Cách giữ phần HTML này khớp với CMS:** dữ liệu nằm ở Supabase, nhưng phần chữ phải có trong HTML ban đầu. Khảo sát repo để chọn một trong các cách sau, theo thứ tự ưu tiên **[XÁC NHẬN TRONG REPO]**:

- (a) Repo có bước build hoặc deploy (ví dụ Vercel, Netlify): viết script đọc `tm_journey_checkpoints` lúc build và sinh HTML tĩnh. CMS có nút "Xuất bản lại" gọi deploy hook.
- (b) Repo có server hoặc hàm serverless: render phần chữ ở server cho mỗi request.
- (c) Không có cả hai: HTML chứa sẵn nội dung từ seed, JavaScript thay bằng dữ liệu mới từ Supabase khi tải. Ghi rõ trong CMS: "Sửa nội dung xong cần cập nhật bản HTML để Google thấy", và cung cấp nút "Tải HTML phần lộ trình" để chủ dự án dán vào file.

Báo lại chủ dự án đã chọn cách nào và vì sao.

### 4.3 Meta và dữ liệu cấu trúc

- `title`: "Lộ trình học UI/UX Designer và Product Designer | TELOS Academy" (sửa được trong CMS, mục 7.2).
- `meta description`, `link rel=canonical`.
- Open Graph và Twitter card: tiêu đề, mô tả, ảnh 1200 × 630 (admin upload, mục 7.2).
- JSON-LD:
  - Một `ItemList` theo thứ tự lộ trình chính, mỗi phần tử là một `Course` (`name`, `description`, `url` = link khóa, `provider` = TELOS Academy với `sameAs` academy.telos.vn).
  - Nhánh rẽ đưa vào cùng danh sách, sau checkpoint rẽ ra.

### 4.4 Gửi riêng và nhúng

- Thêm tham số `?embed=1`: ẩn header, footer, menu của thư viện, chỉ còn khung game và phần chữ. Dùng được trong iframe ở trang khác như academy.telos.vn.
- Ở chế độ nhúng, mọi link ra ngoài mở tab mới.

## 5. Cảnh 3D và luồng chơi

### 5.1 Bản đồ

Dùng lại cách dựng sàn, ánh sáng, camera và điều khiển của Team Map (camera bám nhân vật, góc 3/4, kéo hoặc Q/E để xoay, WASD hoặc bấm sàn để đi, A* trên lưới).

- Một con đường uốn khúc chạy từ **Nhà** (điểm xuất phát) tới **tòa văn phòng** (đích). Hai bên đường có cỏ, cây và đèn đường tối giản theo màu TELOS. Lề đường là ô chặn trên lưới tìm đường.
- Mỗi checkpoint là một **trạm**: một vòng tròn trên đường, một cổng chữ U có biển tên trạm (vẽ bằng CanvasTexture), một bục nhỏ ghi số buổi.
- Hai **ngã ba** có biển chỉ đường. Nhánh là một vòng đường rẽ ra rồi nhập lại vào chính đoạn đường đó:
  - Ngã ba 1 ngay sau trạm UI: nhánh "Web Design".
  - Ngã ba 2 ngay sau trạm Design System: nhánh "Code for Designer".
- Hình học (vị trí trạm, đường cong, ngã ba) đặt trong code, không sửa từ CMS.

### 5.2 Cổng giữa các trạm

- Cổng của trạm kế tiếp chỉ mở khi đã ghé trạm trước nó trên đường chính. Cổng đóng có biển "Ghé trạm trước đã".
- Trạm nhánh luôn mở, không chặn đường chính.
- Người đã ghé trạm thì lần sau đi qua lại tự do.

### 5.3 Tới một trạm

1. Bước vào vòng tròn của trạm → mở **bảng thông tin** (dùng lại kiểu bảng thông tin nhân vật của Team Map):
   - Tên checkpoint và tên khóa học
   - Số buổi
   - Mô tả
   - "Bạn sẽ học" (danh sách kiến thức)
   - "Học xong bạn sẽ"
   - Hình thái sẽ đạt: chức danh và câu mô tả
   - Nút **"Xem khóa học"** mở link khóa ở tab mới
   - Nút **"Biến hình"**
2. Nếu trạm bật "Bắt buộc vượt thử thách": nút "Biến hình" đổi thành "Làm thử thách". Thử thách dùng lại flashcard của `SPEC-hourly.md` (mục 5.4) với `challenge_term_ids` của trạm, đúng 3/4 là qua.
3. Bấm "Biến hình" → **cảnh biến hình** (mục 5.4) → ghi `visited`.

Trạm đã ghé: bước vào chỉ mở lại bảng thông tin, không biến hình lại.

### 5.4 Cảnh biến hình

- Camera tiến gần, nền tối nhẹ.
- Nhân vật xoay nhanh trên chỗ, có vệt sáng xoắn quanh người theo màu hồng và cyan của TELOS, khoảng 1,5 giây.
- Chớp sáng, đồ nghề cũ biến mất và đồ nghề mới hiện ra (`setProps`).
- Nhãn chức danh mới bật lên trên đầu.
- Trạm là **mốc nghề** (`is_milestone`): thêm pháo giấy và dòng "Lên cấp: <chức danh>".
- Trạm cuối Product Designer: thêm hào quang quanh chân nhân vật, giữ lại từ đó về sau.
- Sau cảnh này có nút **"Lưu ảnh trước và sau"**: thẻ PNG 1080 × 1350 gồm nhân vật ở hình thái trước và sau đặt cạnh nhau, chức danh, tên khóa học, logo TELOS và URL trang. Dùng lại cách xuất ảnh của huy hiệu trong `SPEC-hourly.md` (mục 7.3).
- Tôn trọng `prefers-reduced-motion`: bỏ xoay và pháo giấy, chỉ đổi đồ nghề và hiện chức danh.

### 5.5 Hình thái đang hiển thị

- **Đồ nghề và chức danh chính** = của trạm chính có `sort_order` cao nhất đã ghé.
- **Nhánh đã ghé** cộng thêm đồ nghề của nhánh vào, và thêm phụ đề dưới chức danh, ví dụ "UI/UX Designer · Web Designer".
- Ghé cả hai nhánh: phụ đề thành **"Web Designer full"** (lấy từ `branch_combos` trong seed).
- HUD góc trên hiện chức danh hiện tại và thanh tiến độ "Đã qua 4/6 trạm · 1/2 nhánh".
- Mascot nhiều nhất 2 món trên tay, 1 món trên đầu, 1 món sau lưng, 1 món bay. Gặp trùng vị trí thì món của trạm mới hơn được hiện.

### 5.6 Đích: đi làm

- Tới cửa văn phòng khi đã qua đủ 6 trạm chính → cửa sáng lên, có chữ "Ngày đầu đi làm". Chưa đủ thì cửa khoá, ghi còn thiếu trạm nào.
- Bấm vào cửa (hoặc bước vào vòng trước cửa) → bảng **"Chọn nơi làm việc đầu tiên"** gồm ba thẻ lấy từ `workplaces` trong seed: Startup (`small`), Công ty sản phẩm (`large`), Agency (`agency`). Ai đã ghé nhánh Web thì thẻ Agency có nhãn "Hợp với bạn".
- Chọn xong → ghi `finished_at`, `workplace` → cửa mở, nhân vật bước vào, màn hình mờ dần → chuyển trang tới Team Map:

  `/team-map?tu=hanh-trinh&quy-mo=<scale>&hinh-thai=<id trạm chính cao nhất>&nhanh=web,code`

  (Đường dẫn Team Map theo route thật trong repo.)

### 5.7 Team Map nhận người từ hành trình

- Đọc tham số URL. Không có thì đọc `tm_journey_v1`.
- Mở đúng quy mô ở tham số `quy-mo`.
- Nhân vật chính (`ui-ux-designer`) dùng đồ nghề và chức danh của hình thái, thay cho mặc định. Hào quang Product Designer giữ nguyên.
- Hiện một lời chào một lần: "Chào mừng ngày đầu đi làm, <chức danh>. Đi một vòng làm quen mọi người đi." Nhân Lưu đi tới chỗ người chơi.
- Thêm lựa chọn "Dùng lại nhân vật mặc định" trong menu để bỏ hình thái.

## 6. Mô hình dữ liệu

### 6.1 `tm_journey_checkpoints`

| Cột | Kiểu | CMS | Ghi chú |
| --- | --- | --- | --- |
| `id` | text PK | không | Cố định: `start`, `figma`, `ui`, `ux`, `ds`, `ai`, `pdm`, `web`, `code`, `finish`. Mỗi mã gắn với một vị trí trên bản đồ trong code. |
| `kind` | text | không | `start` · `main` · `branch` · `finish`. |
| `sort_order` | int | không | Thứ tự trên đường chính, hoặc thứ tự nhánh. |
| `branch_after` | text, nullable | không | Nhánh rẽ ra sau trạm nào (`ui`, `ds`). |
| `name` | text | **có** | Tên checkpoint, ví dụ "Hiểu người dùng". |
| `course_title` | text, nullable | **có** | Tên khóa học tương ứng. |
| `course_url` | text, nullable | **có** | Link trang khóa học. |
| `sessions` | int, nullable | có | Số buổi. |
| `form_title` | text | **có** | Nhân vật biến thành, ví dụ "UI/UX Designer Junior". |
| `form_description` | text | **có** | Câu mô tả hình thái. |
| `form_props` | jsonb (mảng mã đồ nghề) | **có** | Đồ nghề của hình thái. Trạm chính: bộ đồ đầy đủ. Trạm nhánh: đồ thêm vào. |
| `is_milestone` | bool | có | Mốc nghề: có pháo giấy và dòng "Lên cấp". |
| `description` | text | **có** | Mô tả nội dung checkpoint. |
| `knowledge` | jsonb (mảng text) | **có** | Những kiến thức sẽ được học, mỗi phần tử một dòng. |
| `outcome` | text, nullable | có | Dòng "Học xong bạn sẽ". |
| `require_challenge` | bool | có | Mặc định false. |
| `challenge_term_ids` | jsonb (mảng id thuật ngữ) | có | Thuật ngữ cho thử thách flashcard. |
| `is_active` | bool | có | Chỉ dùng cho trạm nhánh. Tắt thì nhánh biến khỏi bản đồ và khỏi phần chữ. Trạm chính không tắt được. |
| `updated_at` | timestamptz | không | |

Các cột in đậm "có" là những trường chủ dự án yêu cầu sửa được. Các cột "có" thường là trường phụ.

### 6.2 `tm_journey_settings` — một dòng

| Cột | Ghi chú |
| --- | --- |
| `seo_title`, `seo_description` | Thẻ title và meta description. |
| `og_image_url` | Ảnh chia sẻ 1200 × 630. |
| `intro_text` | Đoạn mở đầu dưới `h1` ở phần chữ. |
| `workplaces` | jsonb: ba thẻ nơi làm việc (nhãn, ghi chú). `scale` không sửa được. |

### 6.3 Quyền

`select` cho `anon`, ghi chỉ cho admin, như các bảng `tm_*` khác.

## 7. CMS

### 7.1 Tab "Hành trình"

- Danh sách checkpoint theo đúng thứ tự trên bản đồ, nhánh thụt vào dưới trạm rẽ ra. Không kéo thả đổi thứ tự, không thêm, không xoá.
- Form một checkpoint, chia ba nhóm:

| Nhóm | Trường |
| --- | --- |
| **Checkpoint** | Tên checkpoint · Khóa học tương ứng (tên + link) · Số buổi · Mô tả nội dung · Kiến thức sẽ học · Học xong bạn sẽ |
| **Biến hình** | Nhân vật biến thành (chức danh) · Câu mô tả hình thái · Đồ nghề (chọn nhiều từ danh sách props) · Mốc nghề |
| **Thử thách** | Bắt buộc vượt thử thách · Thuật ngữ cho thử thách |

- **Kiến thức sẽ học** là danh sách: mỗi dòng một ô, thêm, xoá, kéo đổi thứ tự trong danh sách.
- Bên phải form có **xem trước nhân vật 3D** ở hình thái của trạm đó (dùng module mục 3.1), xoay được, để kiểm tra đồ nghề có bị chồng nhau không.
- Trạm `start` và `finish` chỉ hiện các trường có nghĩa với chúng (không có khóa học, không có kiến thức).

### 7.2 Tab con "Cài đặt trang"

Các trường của `tm_journey_settings`, có upload ảnh OG (cùng cơ chế upload hình huy hiệu).

Nếu chọn cách (a) ở mục 4.2: thêm nút "Xuất bản lại trang", hiện thời điểm xuất bản gần nhất và cảnh báo khi có chỉnh sửa sau thời điểm đó.

### 7.3 Excel

Thêm sheet `Hanh trinh` vào file export/import hiện có, cùng quy ước:

id · *Loại* · *Thứ tự* · Tên checkpoint · Tên khóa học · Link khóa học · Số buổi · Nhân vật biến thành · Mô tả hình thái · Đồ nghề · Mốc nghề · Mô tả · Kiến thức (mỗi dòng một ý, ngăn bằng xuống dòng trong ô) · Học xong bạn sẽ · Bắt buộc thử thách · Thuật ngữ thử thách · Hiển thị

Chỉ cập nhật 10 id có sẵn, id lạ là lỗi.

## 8. Điều khiển, hiệu năng, khả năng truy cập

- Điều khiển giống Team Map, kể cả trên điện thoại.
- Có nút **"Bỏ qua game, đọc lộ trình"** trên khung 3D, cuộn xuống phần chữ.
- Máy không chạy được WebGL: ẩn khung game, chỉ hiện phần chữ, không báo lỗi.
- Khung 3D chỉ khởi tạo khi cuộn tới và tạm dừng render khi cuộn ra khỏi màn hình, để trang nhẹ và điểm Core Web Vitals tốt.
- Three.js r128 từ CDN, cùng bản Team Map đang dùng để trình duyệt dùng lại cache.

## 9. Seed

Đọc `seed-journey.json`, upsert theo `id`, chạy lại nhiều lần không tạo trùng:

1. `checkpoints` → `tm_journey_checkpoints`.
2. `workplaces` → `tm_journey_settings.workplaces`. Các trường SEO còn lại điền theo mục 4.3.
3. `branch_combos` để trong code (hiện chỉ có một luật "Web Designer full").

Nội dung kiến thức trong seed rút từ đề cương trên trang khóa học, mỗi khóa 6 ý. Chủ dự án rà lại trong CMS.

## 10. Ngoài phạm vi đợt này

- Thêm hoặc xoá checkpoint, sửa bản đồ từ CMS.
- Trạm cho lớp Portfolio với Framer và Bootcamp A.I. cho Web Design.
- Đăng nhập, đồng bộ tiến độ giữa các máy.
- Đa ngôn ngữ.

## 11. Tiêu chí nghiệm thu

1. Team Map sau khi tách module nhân vật: ảnh chụp ba quy mô giống trước khi tách, quest và nhiệm vụ theo giờ vẫn chạy.
2. Tắt JavaScript, mở trang hành trình: thấy đủ `h1`, 6 trạm chính, 2 nhánh, mô tả, danh sách kiến thức và link khóa học.
3. Công cụ kiểm tra dữ liệu cấu trúc của Google không báo lỗi cho JSON-LD.
4. Dán link trang vào Facebook hoặc Zalo: hiện đúng tiêu đề, mô tả và ảnh OG.
5. Cổng trạm kế không mở khi chưa ghé trạm trước. Nhánh rẽ không chặn đường chính.
6. Ghé từng trạm: bảng thông tin đúng nội dung CMS, biến hình đúng đồ nghề và chức danh. Mốc nghề có pháo giấy.
7. Ghé nhánh Web rồi Code: phụ đề thành "Web Designer full", đồ nghề nhánh cộng thêm đúng.
8. Bật "Bắt buộc vượt thử thách" cho một trạm: phải qua flashcard mới biến hình được.
9. "Lưu ảnh trước và sau" tải về PNG có hai hình thái cạnh nhau.
10. Tải lại trang: tiến độ và hình thái còn nguyên. Chặn localStorage: trang vẫn chạy, chỉ không lưu.
11. Cửa văn phòng khoá khi chưa đủ 6 trạm chính. Đủ rồi: chọn nơi làm việc → sang Team Map đúng quy mô, nhân vật chính giữ hình thái, có lời chào ngày đầu đi làm.
12. Mở Team Map trực tiếp bằng link có tham số `tu=hanh-trinh` trên trình duyệt chưa từng chơi: vẫn nhận đúng hình thái từ URL.
13. Trong Team Map, nút "Xem lộ trình học" ở Nhân Lưu mở trang hành trình.
14. `?embed=1` ẩn khung thư viện; nhúng iframe chạy được.
15. Sửa tên checkpoint, kiến thức và hình thái trong CMS → game cập nhật ngay; phần chữ HTML cập nhật theo cách đã chọn ở mục 4.2.
16. Excel: export rồi import lại ngay ra "0 thêm · 0 cập nhật · 0 lỗi" trên sheet `Hanh trinh`.
17. Máy không có WebGL: chỉ hiện phần chữ, không có lỗi trên console.
