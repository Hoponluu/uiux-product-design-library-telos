-- ════════════════════════════════════════════════════════════════════
-- Trang Hành trình UI/UX (/hanh-trinh-ui-ux) — docs/SPEC-journey.md
-- File này sinh từ team-map/seed-journey.json bằng scripts/gen_team_map_journey_seed.py.
-- Chạy lại nhiều lần an toàn: chỉ chèn dòng còn thiếu, không ghi đè nội dung đã sửa trong CMS.
-- ════════════════════════════════════════════════════════════════════

create table if not exists tm_journey_checkpoints (
  id                 text primary key check (id in ('start', 'figma', 'ui', 'ux', 'ds', 'ai', 'pdm', 'web', 'code', 'finish')),
  kind               text not null check (kind in ('start', 'main', 'branch', 'finish')),
  sort_order         int  not null default 0,
  branch_after       text check (branch_after is null or branch_after in ('ui', 'ds')),
  name               text not null,
  course_title       text,
  course_url         text,
  sessions           int check (sessions is null or sessions between 1 and 200),
  form_title         text not null,
  form_description   text not null default '',
  form_props         jsonb not null default '[]'::jsonb check (jsonb_typeof(form_props) = 'array'),
  is_milestone       boolean not null default false,
  description        text not null default '',
  knowledge          jsonb not null default '[]'::jsonb check (jsonb_typeof(knowledge) = 'array'),
  outcome            text,
  require_challenge  boolean not null default false,
  challenge_term_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(challenge_term_ids) = 'array'),
  is_active          boolean not null default true,
  role_summary       text,
  role_skills        jsonb not null default '[]'::jsonb check (jsonb_typeof(role_skills) = 'array'),
  role_link          text,
  course_image_url   text,
  updated_at         timestamptz not null default now()
);
-- bản 2 (game 2D, hai bảng Vai trò / Khóa học): thêm cột cho DB đã tạo bảng trước đó
alter table tm_journey_checkpoints add column if not exists role_summary text;
alter table tm_journey_checkpoints add column if not exists role_skills jsonb not null default '[]'::jsonb;
alter table tm_journey_checkpoints add column if not exists role_link text;
alter table tm_journey_checkpoints add column if not exists course_image_url text;
-- trạm chính / xuất phát / đích không tắt được
alter table tm_journey_checkpoints drop constraint if exists tm_journey_main_active;
alter table tm_journey_checkpoints add constraint tm_journey_main_active check (kind = 'branch' or is_active);

create table if not exists tm_journey_settings (
  id              int primary key default 1 check (id = 1),
  seo_title       text not null default '',
  seo_description text not null default '',
  og_image_url    text,
  intro_text      text not null default '',
  workplaces      jsonb not null default '[]'::jsonb check (jsonb_typeof(workplaces) = 'array'),
  updated_at      timestamptz not null default now()
);

drop trigger if exists tm_journey_checkpoints_touch on tm_journey_checkpoints;
create trigger tm_journey_checkpoints_touch before update on tm_journey_checkpoints for each row execute function tm_touch();
drop trigger if exists tm_journey_settings_touch on tm_journey_settings;
create trigger tm_journey_settings_touch before update on tm_journey_settings for each row execute function tm_touch();

do $$
declare t text;
begin
  foreach t in array array['tm_journey_checkpoints', 'tm_journey_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read %s" on %I', t, t);
    execute format('drop policy if exists "admin write %s" on %I', t, t);
    execute format('create policy "public read %s" on %I for select using (true)', t, t);
    execute format('create policy "admin write %s" on %I for all to authenticated using (is_admin()) with check (is_admin())', t, t);
  end loop;
end $$;

insert into tm_journey_checkpoints (id, kind, sort_order, branch_after, name, course_title, course_url, sessions, form_title, form_description,
  form_props, is_milestone, description, knowledge, outcome, require_challenge, challenge_term_ids, is_active)
values
  ('start', 'start', 0, null, 'Xuất phát', null, null, null, 'Newbie', 'Chưa biết gì, nhưng có ba lô và một tấm bản đồ.', '["backpack"]'::jsonb, false, 'Ai cũng bắt đầu từ đây. Bạn chưa cần biết vẽ, chưa cần biết code, chỉ cần tò mò vì sao có app dùng sướng và có app dùng muốn ném điện thoại.', '[]'::jsonb, 'Đi theo con đường trước mặt. Mỗi trạm là một lớp học, đi qua là bạn lên đời.', false, '[]'::jsonb, true),
  ('figma', 'main', 1, null, 'Làm quen công cụ', 'Khóa Học Figma Dành Cho Designer/Developer', 'https://academy.telos.vn/khoa-hoc-thiet-ke-giao-dien-voi-figma/', 8, 'Tập sự Figma', 'Đã cầm được cây bút, biết frame với autolayout là gì.', '["backpack", "pencil"]'::jsonb, false, 'Figma là bàn làm việc của designer. Trạm đầu tiên giúp bạn dùng công cụ cho nhanh và gọn, để những trạm sau chỉ còn phải lo chuyện thiết kế.', '["Giao diện Figma, frame, constraint, màu, effect và xử lý ảnh", "Component, instance, variants và properties", "Autolayout: thứ tự, hug và fill, dựng bảng và khung chat", "Style màu và chữ, Light/Dark mode, làm quen Variable", "Sitemap, flow, wireframe và dựng một màn hình hoàn chỉnh", "Prototype, interaction, overlay và dùng AI hỗ trợ trong Figma"]'::jsonb, 'Dựng được giao diện và prototype bằng Figma, có bài thực hành đầu tiên cho portfolio.', false, '[]'::jsonb, true),
  ('ui', 'main', 2, null, 'Nhìn ra cái đẹp', 'Khóa Học Nền Tảng Về UI Design', 'https://academy.telos.vn/khoa-hoc-nen-tang-ve-ui-design/', 8, 'UI Designer tập sự', 'Có bảng màu trên tay và bắt đầu thấy lệch 2 pixel là khó chịu.', '["palette", "tablet"]'::jsonb, false, 'Biết dùng Figma chưa có nghĩa là thiết kế đẹp. Trạm này dạy nguyên lý thị giác đằng sau một giao diện chỉn chu, để bạn giải thích được vì sao mình chọn màu này, cỡ chữ kia.', '["Typography: cỡ chữ, line height, độ dài dòng, cách chọn và ghép font", "Màu sắc: các hệ màu, contrast, tạo palette, semantic color, dark mode", "Box model, grid, alignment và hệ thống khoảng cách", "Component thường gặp: button, form, card, modal, menu", "Xây UI Library và viết tài liệu ngay trong Figma", "Làm việc với developer, kiểm tra layout bằng Chrome DevTools"]'::jsonb, 'Áp dụng màu, chữ, lưới và khoảng cách có lý do, bàn giao được cho developer.', false, '[]'::jsonb, true),
  ('ux', 'main', 3, null, 'Hiểu người dùng', 'Khóa Học Nhập Môn Về UX Design', 'https://academy.telos.vn/khoa-hoc-nhap-mon-ve-ux-design/', 8, 'UI/UX Designer Junior', 'Mốc nghề đầu tiên: đội mũ, cầm kính lúp, túi đầy sticky note.', '["cap", "magnifier"]'::jsonb, true, 'Đẹp mà khó dùng thì vẫn hỏng. Trạm này dạy bạn đi tìm vấn đề thật của người dùng trước khi vẽ, và kiểm chứng giải pháp sau khi vẽ.', '["Design Thinking, Double Diamond, Lean UX và MVP", "Lên kế hoạch và phỏng vấn người dùng", "Persona, Empathy Map, User Journey Map và Jobs-to-be-Done", "10 nguyên lý Heuristics của Nielsen", "Problem Statement, How Might We, RICE và MoSCoW", "Kiến trúc thông tin, user flow, wireframe, Usability Testing và A/B Testing"]'::jsonb, 'Đi trọn một quy trình UX cơ bản và bảo vệ được quyết định thiết kế bằng lý lẽ.', false, '[]'::jsonb, true),
  ('ds', 'main', 4, null, 'Làm việc có hệ thống', 'Khóa Học UI Design System', 'https://academy.telos.vn/khoa-hoc-ui-design-system/', 12, 'UI/UX Designer', 'Mang theo hộp component, đi tới đâu dựng tới đó, không vẽ lại từ đầu nữa.', '["cap", "blocks"]'::jsonb, true, 'Sản phẩm càng lớn thì thiết kế càng dễ rời rạc. Trạm này dạy bạn dựng một hệ thống dùng chung để cả team thiết kế và code nói cùng một ngôn ngữ.', '["Tư duy hệ thống, phân biệt UI Kit, Style Guide và Design System", "Foundation: màu, typography, spacing, layout, icon, radius, elevation", "Token và cách đặt tên", "Kiến trúc thư viện Figma: foundation, component, pattern, template", "Component phức tạp, slot, pattern và product rules", "Viết guideline, bàn giao, quản lý phiên bản và Design System cho AI đọc được"]'::jsonb, 'Có một bộ Design System trên Figma kèm tài liệu, đủ để đưa vào portfolio.', false, '[]'::jsonb, true),
  ('ai', 'main', 5, null, 'Có trợ lý AI', 'Khóa Học A.I. Dành Cho UI/UX Designer', 'https://academy.telos.vn/khoa-hoc-a-i-danh-cho-ui-ux-designer/', 8, 'AI-powered Designer', 'Có một con robot nhỏ bay theo, làm phụ những việc lặt vặt.', '["cap", "blocks", "robot"]'::jsonb, false, 'AI không thay designer, nhưng designer biết dùng AI sẽ đi nhanh hơn. Trạm này dạy bạn đưa AI vào từng bước của quy trình và biết khi nào không nên tin nó.', '["AI Literacy: AI làm được gì và không làm được gì trong UX", "Phân tích phỏng vấn và tổng hợp insight bằng AI, kiểm soát hallucination", "Viết prompt, tạo prototype và concept bằng AI", "Testing và lấy feedback cùng AI", "Dùng AI để audit Design System và accessibility", "Nguyên tắc dùng AI có trách nhiệm"]'::jsonb, 'Dùng AI làm trợ lý xuyên suốt quy trình, có thêm một case study cho portfolio.', false, '[]'::jsonb, true),
  ('pdm', 'main', 6, null, 'Nghĩ như người làm sản phẩm', 'Khóa Học Product Design & Manage', 'https://academy.telos.vn/khoa-hoc-product-design-va-manage/', 12, 'Product Designer', 'Hình thái cuối: áo blazer, biểu đồ trong tay, cắm cờ ở đích.', '["blazer", "chart", "flag"]'::jsonb, true, 'Product Designer không chỉ trả lời câu hỏi thiết kế thế nào, mà cả câu hỏi có nên làm không và làm xong thì đo bằng gì. Trạm cuối nối thiết kế với kinh doanh.', '["Tư duy sản phẩm và vai trò PM, PO, Designer", "Nghiên cứu thị trường, đối thủ, Product-Market Fit", "Story Mapping và các khung ưu tiên Kano, MoSCoW, RICE", "Prototype, kiểm thử và xử lý trạng thái ngoại lệ", "Business Model Canvas, Go-to-Market, AARRR và North Star Metric", "Viết PRD, User Story, Acceptance Criteria và bàn giao cho dev"]'::jsonb, 'Có một case study sản phẩm hoàn chỉnh, từ nghiên cứu tới chiến lược ra mắt.', false, '[]'::jsonb, true),
  ('web', 'branch', 1, 'ui', 'Rẽ trái: làm web', 'Khóa Học Web Design Chuyên Sâu', 'https://academy.telos.vn/khoa-hoc-web-design-chuyen-sau/', 8, 'Web Designer', 'Đeo thêm một khung trình duyệt bên cạnh.', '["browser"]'::jsonb, false, 'Ngã rẽ cho bạn nào muốn nhận dự án website, landing page hay làm ở agency. Đi xong thì quay lại đường chính.', '["Các loại website và quy trình thiết kế, lập trình web", "Sitemap, user flow và information architecture cho web", "HTML, CSS, JS mà web designer cần biết, nguyên lý responsive", "Landing page và các trang thông tin", "Khối thương mại điện tử: danh sách, chi tiết sản phẩm, giỏ hàng, thanh toán", "Khối tài khoản người dùng và bàn giao file cho developer"]'::jsonb, 'Có một dự án website thực tế cho portfolio.', false, '[]'::jsonb, true),
  ('code', 'branch', 2, 'ds', 'Rẽ phải: biết code', 'Khóa Học Code For Designer', 'https://academy.telos.vn/khoa-hoc-code-for-designer/', 8, 'Designer biết code', 'Kẹp thêm cái laptop có dấu </>.', '["codeLaptop"]'::jsonb, false, 'Ngã rẽ cho bạn muốn tự dựng được thứ mình vẽ, và nói chuyện với developer không bị lạc. Học sau Design System thì component trong Figma khớp ngay với component trong code.', '["HTML và cách trình duyệt hiển thị một trang", "Git cơ bản", "CSS: selector, layout, responsive", "TailwindCSS và cấu hình theo design system", "CSS animation và JavaScript cơ bản", "Chuyển Figma sang HTML, tên miền, hosting và deploy"]'::jsonb, 'Tự dựng và đưa lên mạng một trang web cá nhân có responsive và animation.', false, '[]'::jsonb, true),
  ('finish', 'finish', 7, null, 'Đi làm', null, null, null, 'Product Designer', 'Tới cửa văn phòng. Ngày đầu đi làm bắt đầu.', '[]'::jsonb, false, 'Bạn đã đi hết con đường. Chọn nơi làm việc đầu tiên rồi bước vào văn phòng.', '[]'::jsonb, null, false, '[]'::jsonb, true)
on conflict (id) do nothing;

-- nội dung bảng Vai trò + ảnh khoá học: chỉ điền ô còn trống (không ghi đè bản đã sửa trong CMS)
update tm_journey_checkpoints c set
  role_summary     = coalesce(c.role_summary, v.role_summary),
  role_skills      = case when c.role_skills is null or c.role_skills = '[]'::jsonb then v.role_skills else c.role_skills end,
  role_link        = coalesce(c.role_link, v.role_link),
  course_image_url = coalesce(c.course_image_url, v.course_image_url)
from (values
  ('start', 'Người mới tò mò về UI/UX. Chưa cần biết vẽ hay biết code, chỉ cần muốn hiểu vì sao có app dùng sướng còn có app dùng muốn ném điện thoại.', '["Tò mò về cách mọi người dùng sản phẩm số", "Dùng máy tính thành thạo, tự tìm được tài liệu", "Sẵn sàng làm bài tập và nhận góp ý"]'::jsonb, null, null),
  ('figma', 'Dùng Figma nhanh và gọn: dựng được giao diện, tổ chức file sạch và làm prototype để người khác bấm thử.', '["Frame, constraint và cách tổ chức layer, page", "Component, instance, variants và properties", "Autolayout để dựng layout co giãn", "Style màu, chữ và Variable cơ bản", "Prototype và các tương tác thường gặp"]'::jsonb, null, 'https://academy.telos.vn/wp-content/uploads/2025/05/Thumb-figma.png'),
  ('ui', 'Thiết kế giao diện đẹp, nhất quán và giải thích được vì sao chọn màu này, cỡ chữ kia.', '["Typography: cỡ chữ, line height, ghép font", "Màu sắc: hệ màu, contrast, palette, dark mode", "Grid, alignment và hệ thống khoảng cách", "Component phổ biến: button, form, card, modal", "Bàn giao giao diện cho developer"]'::jsonb, '/thuat-ngu/ui-designer', 'https://academy.telos.vn/wp-content/uploads/2025/05/Thumb-ui.png'),
  ('ux', 'Mốc nghề đầu tiên: đi tìm vấn đề thật của người dùng trước khi vẽ, và kiểm chứng giải pháp sau khi vẽ.', '["Phỏng vấn và quan sát người dùng", "Persona, Journey Map, Jobs-to-be-Done", "10 nguyên lý Heuristic của Nielsen", "Kiến trúc thông tin, user flow, wireframe", "Usability Testing và A/B Testing"]'::jsonb, '/thuat-ngu/uiux-designer', 'https://academy.telos.vn/wp-content/uploads/2025/05/Thumb-ux.jpg'),
  ('ds', 'Làm việc có hệ thống trong sản phẩm lớn: dựng và dùng Design System để team thiết kế và code nói cùng một ngôn ngữ.', '["Tư duy hệ thống, phân biệt UI Kit, Style Guide, Design System", "Design token và cách đặt tên", "Thư viện component có variants, slot, pattern", "Viết guideline, quản lý phiên bản", "Phối hợp với developer khi đưa vào code"]'::jsonb, '/thuat-ngu/design-system-designer', 'https://academy.telos.vn/wp-content/uploads/2025/05/Quangcao04-1.png'),
  ('ai', 'Dùng AI làm trợ lý trong từng bước của quy trình mà vẫn giữ phán đoán của designer.', '["AI làm được gì và không làm được gì trong UX", "Viết prompt cho research, ý tưởng và prototype", "Kiểm soát hallucination khi tổng hợp insight", "Dùng AI để audit accessibility và Design System", "Dùng AI có trách nhiệm"]'::jsonb, null, 'https://academy.telos.vn/wp-content/uploads/2026/02/Screenshot-2026-07-01-173738.png'),
  ('pdm', 'Trả lời được cả câu hỏi có nên làm không và làm xong đo bằng gì, không chỉ là thiết kế thế nào. Nối thiết kế với kinh doanh.', '["Tư duy sản phẩm và vai trò PM, PO, Designer", "Nghiên cứu thị trường, đối thủ, Product-Market Fit", "Ưu tiên tính năng: Kano, MoSCoW, RICE", "Business Model, Go-to-Market, AARRR, North Star Metric", "Viết PRD, User Story, Acceptance Criteria"]'::jsonb, '/thuat-ngu/product-designer', 'https://academy.telos.vn/wp-content/uploads/2025/10/SocialIMage.png'),
  ('web', 'Nhận được dự án website, landing page và làm tốt ở agency.', '["Các loại website và quy trình làm web", "Responsive và HTML, CSS cơ bản", "Landing page và các trang thông tin", "Luồng thương mại điện tử: sản phẩm, giỏ hàng, thanh toán", "Bàn giao file web cho developer"]'::jsonb, null, 'https://academy.telos.vn/wp-content/uploads/2025/05/Thumb-web.png'),
  ('code', 'Tự dựng được thứ mình vẽ và nói chuyện với developer không bị lạc.', '["HTML và cách trình duyệt hiển thị một trang", "CSS, responsive, TailwindCSS theo design system", "JavaScript và animation cơ bản", "Git cơ bản", "Chuyển Figma sang HTML và deploy lên mạng"]'::jsonb, '/thuat-ngu/design-engineer', 'https://academy.telos.vn/wp-content/uploads/2025/05/Thumb-code.png'),
  ('finish', 'Đi hết con đường: sẵn sàng cho ngày đầu đi làm ở vị trí Product Designer.', '[]'::jsonb, '/thuat-ngu/product-designer', null)
) as v(id, role_summary, role_skills, role_link, course_image_url)
where c.id = v.id;

insert into tm_journey_settings (id, seo_title, seo_description, intro_text, workplaces)
values (1, 'Lộ trình học UI/UX Designer và Product Designer | TELOS Academy', 'Lộ trình từ con số 0 tới Product Designer tại TELOS Academy: Figma, UI, UX, Design System, A.I. và Product Design & Manage, cùng hai nhánh Web Design và Code for Designer. Chơi thử dạng game 3D hoặc đọc từng chặng.', 'Sáu trạm chính và hai nhánh tuỳ chọn, mỗi trạm là một khoá học tại TELOS Academy. Đi qua trạm nào, bạn biết mình sẽ học gì, học xong làm được gì, và lên đời thành phiên bản nào của một designer.', '[{"scale": "small", "label": "Startup", "note": "Ít người, làm đủ thứ, học nhanh nhất."}, {"scale": "large", "label": "Công ty sản phẩm", "note": "Vài trăm người, có squad và chapter, quy trình rõ."}, {"scale": "agency", "label": "Agency", "note": "Làm cho khách hàng, nhiều dự án, nhiều deadline.", "suggest_if": "web"}]'::jsonb)
on conflict (id) do nothing;

-- Import Excel (sheet "Hanh trinh" trong CMS → Team Map → Import / Export): chỉ cập nhật 10 id có sẵn, id lạ là lỗi.
-- Mỗi dòng chỉ ghi các cột có trong file (khoá có mặt trong object).
create or replace function tm_import_journey(p jsonb) returns jsonb language plpgsql as $f$
declare r jsonb; cnt int; n int := 0;
begin
  perform tm_require_admin();
  for r in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    update tm_journey_checkpoints set
      name               = case when r ? 'name'               then r ->> 'name'               else name end,
      course_title       = case when r ? 'course_title'       then r ->> 'course_title'       else course_title end,
      course_url         = case when r ? 'course_url'         then r ->> 'course_url'         else course_url end,
      sessions           = case when r ? 'sessions'           then (r ->> 'sessions')::int    else sessions end,
      form_title         = case when r ? 'form_title'         then r ->> 'form_title'         else form_title end,
      form_description   = case when r ? 'form_description'   then coalesce(r ->> 'form_description', '') else form_description end,
      form_props         = case when r ? 'form_props'         then coalesce(r -> 'form_props', '[]'::jsonb) else form_props end,
      is_milestone       = case when r ? 'is_milestone'       then (r ->> 'is_milestone')::boolean else is_milestone end,
      description        = case when r ? 'description'        then coalesce(r ->> 'description', '') else description end,
      knowledge          = case when r ? 'knowledge'          then coalesce(r -> 'knowledge', '[]'::jsonb) else knowledge end,
      outcome            = case when r ? 'outcome'            then r ->> 'outcome'            else outcome end,
      require_challenge  = case when r ? 'require_challenge'  then (r ->> 'require_challenge')::boolean else require_challenge end,
      challenge_term_ids = case when r ? 'challenge_term_ids' then coalesce(r -> 'challenge_term_ids', '[]'::jsonb) else challenge_term_ids end,
      is_active          = case when r ? 'is_active'          then (r ->> 'is_active')::boolean else is_active end,
      role_summary       = case when r ? 'role_summary'       then r ->> 'role_summary'       else role_summary end,
      role_skills        = case when r ? 'role_skills'        then coalesce(r -> 'role_skills', '[]'::jsonb) else role_skills end,
      role_link          = case when r ? 'role_link'          then r ->> 'role_link'          else role_link end,
      course_image_url   = case when r ? 'course_image_url'   then r ->> 'course_image_url'   else course_image_url end
    where id = r ->> 'id';
    get diagnostics cnt = row_count;
    if cnt = 0 then raise exception 'Checkpoint % không tồn tại (chỉ có 10 checkpoint cố định)', r ->> 'id'; end if;
    n := n + 1;
  end loop;
  return jsonb_build_object('journey', n);
end $f$;

notify pgrst, 'reload schema';
