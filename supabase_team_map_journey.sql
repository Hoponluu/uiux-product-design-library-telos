-- ════════════════════════════════════════════════════════════════════
-- Trang Hành trình UI/UX (/hanh-trinh-ui-ux) — docs/SPEC-journey.md
-- File này sinh từ team-map/seed-journey.json bằng scripts/gen_team_map_journey_seed.py.
-- Chạy lại nhiều lần an toàn: chỉ chèn dòng còn thiếu, không ghi đè nội dung đã sửa trong CMS.
-- ════════════════════════════════════════════════════════════════════

create table if not exists tm_journey_checkpoints (
  id                 text primary key check (id in ('start', 'figma', 'ui', 'ux', 'ds', 'ai', 'code', 'portfolio', 'pdm', 'finish')),
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
  role_tagline       text,
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
-- câu lý giải kỹ năng (hiện ngay dưới tên vai trò trong bảng Vai trò)
alter table tm_journey_checkpoints add column if not exists role_tagline text;
-- chuỗi 2026: id "web" (nhánh Web Design cũ) đổi thành "portfolio"; danh sách id hợp lệ cập nhật theo
alter table tm_journey_checkpoints drop constraint if exists tm_journey_checkpoints_id_check;
update tm_journey_checkpoints set id = 'portfolio' where id = 'web' and not exists (select 1 from tm_journey_checkpoints where id = 'portfolio');
delete from tm_journey_checkpoints where id = 'web';
alter table tm_journey_checkpoints add constraint tm_journey_checkpoints_id_check check (id in ('start', 'figma', 'ui', 'ux', 'ds', 'ai', 'code', 'portfolio', 'pdm', 'finish'));
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
  ('start', 'start', 0, null, 'Xuất phát', null, null, null, 'Newbie', 'Ba lô và một tấm bản đồ.', '["backpack"]'::jsonb, false, 'Lộ trình AI-Driven Product Designer: 8 khóa, 68 buổi, 6 giảng viên. Chuỗi dạy cách làm sản phẩm cùng AI chứ không dạy thêm tool. Mỗi khóa có một đầu ra, và đầu ra đó được làm tiếp ở các khóa sau. Người mới đi từ trạm 1; đã vững công cụ có thể vào thẳng Trải nghiệm và Hệ thống.', '[]'::jsonb, 'AI làm nhanh hơn. Designer quyết định cái gì đáng làm.', false, '[]'::jsonb, true),
  ('figma', 'main', 1, null, 'Công cụ', 'AI & Tools Foundation in Product Design', 'https://academy.telos.vn/khoa-hoc-ai-foundation-tool-in-product-design/', 8, 'Designer tập sự', 'Cây bút Figma trên tay, một con robot nhỏ bay theo.', '["backpack", "pencil", "robot"]'::jsonb, false, 'Nhập môn của chuỗi. Học Figma như công cụ cơ bản của nghề, rồi hiểu và dùng AI để chuẩn bị cho hành trình phía sau.', '["Dùng Figma có hệ thống: component, variants, auto layout, style, variable; file sạch và mở rộng được", "Cái nhìn tổng thể về AI: tool nào dùng cho việc gì, nguyên tắc human in the loop", "Tư duy cấu trúc sản phẩm: thiết kế hướng đối tượng, draft idea theo cấu trúc, vẽ sitemap", "Làm prototype, dùng tool kết nối hai chiều, thử chức năng dạng HTML/CSS"]'::jsonb, 'Một giao diện hoàn chỉnh trên Figma, đề tài tự chọn từ buổi 4 và làm đến hết khóa.', false, '[]'::jsonb, true),
  ('ui', 'main', 2, null, 'Thẩm mỹ', 'UI Foundation for AI-Driven Design', 'https://academy.telos.vn/khoa-hoc-ui-foundation-for-ai-driven-design/', 8, 'UI Designer', 'Bảng màu và cây bút trong tay.', '["backpack", "palette", "pencil", "robot"]'::jsonb, false, 'AI dựng được một giao diện "trung bình" trong vài giây. Trạm này luyện con mắt để bạn định hướng, chọn lọc và giải thích được vì sao một giao diện đẹp.', '["Typography có hệ thống: type scale, cặp font, line height", "Bảng màu light và dark, semantic color, kiểm tra contrast", "Layout và component chuẩn: box model, grid, space system, slot technique", "Dùng AI mở rộng moodboard và phương án màn hình; bạn là người chọn và giải thích lựa chọn"]'::jsonb, 'Visual direction có lập luận kèm UI library, đủ để đưa vào portfolio.', false, '[]'::jsonb, true),
  ('ux', 'main', 3, null, 'Trải nghiệm', 'UX Foundation for AI-Driven Design', 'https://academy.telos.vn/khoa-hoc-ux-foundation-for-ai-driven-design/', 8, 'UI/UX Designer', 'Mốc nghề đầu tiên: đội mũ, cầm kính lúp.', '["backpack", "cap", "magnifier", "palette", "robot"]'::jsonb, true, 'Đi trọn một vòng Double Diamond, AI làm trợ lý ở từng bước. Dữ liệu và quyết định vẫn đến từ người thật.', '["Hiểu người dùng có phương pháp: empathy map, persona, CJM dựng từ dữ liệu thật", "Đặt đúng vấn đề: problem statement, assumption map, How Might We", "Dùng AI làm trợ lý nghiên cứu: soát câu hỏi, cluster dữ liệu, phản biện; nhận ra lúc AI đang bịa", "Usability test, 10 heuristics, đo lường bằng metric"]'::jsonb, 'Case study UX hoàn chỉnh, đi từ phỏng vấn người thật đến prototype đã test.', false, '[]'::jsonb, true),
  ('ds', 'main', 4, null, 'Hệ thống', 'Design System for AI-Driven Design', 'https://academy.telos.vn/khoa-hoc-design-system-for-ai-driven-design/', 12, 'Designer hệ thống', 'Hộp component trong tay, robot bay theo đọc cùng một bộ luật.', '["backpack", "cap", "blocks", "magnifier", "robot"]'::jsonb, false, 'Design System giờ có hai người dùng là con người và AI. Trạm này dạy cách đặt luật cho cả hai, từ token, component đến tài liệu mà AI đọc được.', '["Token system có cấu trúc: Global, Alias, Component token; Variables, Modes; xuất ra JSON", "Component đủ state, kiểm tra chuẩn AA bằng Stark", "Viết tài liệu cho cả người và AI", "Cho AI dùng Design System của bạn qua Figma Make, Figma MCP, Code Connect"]'::jsonb, 'Design System gồm foundation, token, 5 component hoặc pattern và guideline.', false, '[]'::jsonb, true),
  ('ai', 'main', 5, null, 'Dự án', 'AI Process & Project Apply', 'https://academy.telos.vn/khoa-hoc-ai-process-project-apply/', 8, 'AI-Driven Designer', 'Mốc nghề: cầm bảng kế hoạch dự án, robot thành trợ lý chính.', '["backpack", "cap", "blocks", "clipboard", "robot"]'::jsonb, true, 'Trọng tâm của chuỗi. Các trạm trước cho tư duy chuyên môn và cách dùng từng công cụ; trạm này ghép tất cả thành một quy trình và đi trọn end-to-end một dự án cùng AI.', '["Năng lực quản lý AI: vận hành dự án như một PM có AI bên cạnh, hiểu AI mạnh và yếu ở đâu", "Research và develop cùng AI, dựng nhiều phiên bản để kiểm thử", "Cấu trúc input và thiết kế outcome thay vì chỉ viết prompt", "Hình thành quy trình dùng AI của riêng mình"]'::jsonb, 'Product thành phẩm làm theo full AI Process.', false, '[]'::jsonb, true),
  ('code', 'main', 6, null, 'Code', 'Code 4 Designer', 'https://academy.telos.vn/khoa-hoc-code-for-designer/', 8, 'Designer biết code', 'Kẹp cái laptop có dấu </>.', '["backpack", "cap", "codeLaptop", "blocks", "robot"]'::jsonb, false, '"AI viết code. Bạn làm chủ kết quả." Không cần trở thành developer: hiểu web hoạt động thế nào để thiết kế sát thực tế, làm việc với dev dễ hơn và tự sửa khi AI làm sai.', '["HTML và CSS vững: selector, độ ưu tiên, layout, responsive", "Cấu hình Tailwind theo design system", "Git và GitHub", "CSS animation và JavaScript cơ bản"]'::jsonb, 'Website tự code, responsive, deploy lên GitHub.', false, '[]'::jsonb, true),
  ('portfolio', 'main', 7, null, 'Portfolio', 'Designer''s Portfolio With AI', 'https://academy.telos.vn/khoa-hoc-designer-portfolio-with-ai/', 4, 'Designer sẵn sàng ứng tuyển', 'Khung trình duyệt sau lưng, cặp hồ sơ trong tay.', '["browser", "cap", "briefcase", "codeLaptop", "robot"]'::jsonb, false, 'AI lo phần kỹ thuật: dựng code, sửa lỗi, deploy. Bạn tập trung vào giá trị cốt lõi: chọn project nào, trình bày ra sao và kể câu chuyện gì.', '["Viết lại 2–3 case study theo khung vấn đề → quy trình → kết quả", "Vibecode có kiểm soát với Claude Code, Cursor, Lovable hoặc v0", "Đưa lên GitHub và deploy lên Vercel, Netlify hoặc Cloudflare Pages", "Biết khi nào nên dùng Framer hoặc no-code thay vì vibecode"]'::jsonb, 'Portfolio online sẵn sàng xin việc, có tên miền riêng, SEO cơ bản và analytics.', false, '[]'::jsonb, true),
  ('pdm', 'main', 8, null, 'Chiến lược', 'Product Design & Manage', 'https://academy.telos.vn/khoa-hoc-product-design-va-manage/', 12, 'AI-Driven Product Designer', 'Hình thái cuối: áo blazer, biểu đồ trong tay, cắm cờ ở đích.', '["blazer", "chart", "flag", "robot"]'::jsonb, true, 'Khóa đóng chuỗi, đưa bạn lên tầng chiến lược: thị trường, discovery, metrics, monetization, Agile và launch. Hiểu cách PM, PO, DA suy nghĩ để ngồi chung bàn ra quyết định.', '["Discovery có phương pháp: market intelligence, market sizing, phân tích đối thủ", "Đọc được metric, A/B test, mô hình doanh thu và pricing", "Làm việc trong Agile: Scrum, user story, tạo ảnh hưởng", "Hiểu khi nào nên đưa AI vào sản phẩm"]'::jsonb, 'Business case và buổi pitch, kèm prototype dựng thật. Làm theo nhóm 2–3 người.', false, '[]'::jsonb, true),
  ('finish', 'finish', 9, null, 'Đi làm', null, null, null, 'AI-Driven Product Designer', 'Tới cửa văn phòng. Ngày đầu đi làm bắt đầu.', '[]'::jsonb, false, 'Đi hết 8 trạm, bạn có 8 đầu ra cộng dồn: giao diện Figma, visual direction và UI library, case study UX, Design System, product làm theo AI Process, website tự code, portfolio online, business case và pitch. Đủ nền để ứng tuyển Product Designer hoặc PM.', '[]'::jsonb, null, false, '[]'::jsonb, true)
on conflict (id) do nothing;

-- nội dung bảng Vai trò + ảnh khoá học: chỉ điền ô còn trống (không ghi đè bản đã sửa trong CMS)
update tm_journey_checkpoints c set
  role_tagline     = coalesce(nullif(c.role_tagline, ''), v.role_tagline),
  role_summary     = coalesce(c.role_summary, v.role_summary),
  role_skills      = case when c.role_skills is null or c.role_skills = '[]'::jsonb then v.role_skills else c.role_skills end,
  role_link        = coalesce(c.role_link, v.role_link),
  course_image_url = coalesce(c.course_image_url, v.course_image_url)
from (values
  ('start', 'Chưa cần biết gì, chỉ cần muốn tự làm và hiểu nguyên lý trước khi giao việc cho AI.', 'Người mới tò mò về UI/UX hoặc đang chuyển ngành. Chưa cần biết vẽ hay biết code, chỉ cần muốn hiểu vì sao có sản phẩm dùng sướng, có sản phẩm khiến người ta bực.', '["Tò mò về cách mọi người dùng sản phẩm số", "Dùng máy tính thành thạo, tự tìm được tài liệu", "Sẵn sàng tự làm trước rồi mới nhờ AI"]'::jsonb, null, null),
  ('figma', 'Dùng Figma có hệ thống và biết AI giúp được việc gì, nên ý tưởng nào cũng dựng được thành giao diện và prototype.', 'Dựng giao diện và prototype trên Figma với file sạch, mở rộng được; biết chọn tool AI cho đúng việc và luôn là người kiểm duyệt kết quả.', '["Component, variants, auto layout, style và variable", "Sitemap và cấu trúc một sản phẩm số", "Bản đồ tool AI và nguyên tắc human in the loop", "Prototype và thử chức năng dạng HTML/CSS"]'::jsonb, null, 'https://academy.telos.vn/wp-content/uploads/2025/05/Thumb-figma.png'),
  ('ui', 'Có gu và nắm nguyên lý thị giác, phần AI không thay được: chọn và giải thích được vì sao giao diện này đẹp.', 'Định hướng thẩm mỹ cho sản phẩm: để AI mở rộng phương án, còn mình chọn, chỉnh và bảo vệ được lựa chọn trước team.', '["Type scale và cách ghép font", "Màu light/dark, semantic color, contrast", "Grid, box model, space system", "UI library và component chuẩn"]'::jsonb, '/thuat-ngu/ui-designer', 'https://academy.telos.vn/wp-content/uploads/2025/05/Thumb-ui.png'),
  ('ux', 'Hiểu người dùng bằng dữ liệu thật và đặt đúng vấn đề, rồi mới dùng AI để tăng tốc.', 'Mốc nghề đầu tiên: nghiên cứu người dùng, định nghĩa vấn đề và kiểm chứng giải pháp; biết lúc nào AI đang bịa để không đưa nó vào quyết định.', '["Phỏng vấn, empathy map, persona, CJM", "Problem statement, assumption map, How Might We", "Usability test và 10 heuristics", "Đọc metric để đánh giá giải pháp"]'::jsonb, '/thuat-ngu/uiux-designer', 'https://academy.telos.vn/wp-content/uploads/2025/05/Thumb-ux.jpg'),
  ('ds', 'Đặt luật cho cả team lẫn AI: token, component và tài liệu đủ rõ để ai dùng cũng ra cùng một kết quả.', 'Dựng và duy trì Design System mà cả người lẫn AI đọc được, để thiết kế và code đi nhanh mà không lệch nhau.', '["Token Global, Alias, Component; Variables và Modes", "Component đủ state, đạt chuẩn AA", "Guideline viết cho người và AI", "Figma Make, Figma MCP, Code Connect"]'::jsonb, '/thuat-ngu/design-system-designer', 'https://academy.telos.vn/wp-content/uploads/2025/05/Quangcao04-1.png'),
  ('ai', 'Vận hành cả một dự án với AI bên cạnh: biết AI mạnh, yếu ở đâu và tự quyết bước tiếp theo.', 'Mốc nghề: quản lý AI như một PM, cấu trúc input và thiết kế outcome, dựng nhiều phiên bản để test, và có quy trình dùng AI của riêng mình.', '["Lập kế hoạch dự án có AI tham gia", "Cấu trúc input, thiết kế outcome", "Dựng và kiểm thử nhiều phiên bản", "Quy trình dùng AI của riêng mình"]'::jsonb, null, 'https://academy.telos.vn/wp-content/uploads/2026/02/Screenshot-2026-07-01-173738.png'),
  ('code', 'Đọc và kiểm soát được code AI viết, nên thiết kế sát thực tế và cộng tác trơn tru với engineer.', 'Hiểu engineer và làm việc tốt với họ: đọc được code, tự sửa khi AI viết sai, đưa thiết kế lên web thật.', '["HTML, CSS, layout và responsive", "Tailwind cấu hình theo design system", "Git và GitHub", "CSS animation, JavaScript cơ bản"]'::jsonb, '/thuat-ngu/design-engineer', 'https://academy.telos.vn/wp-content/uploads/2025/05/Thumb-code.png'),
  ('portfolio', 'Biết kể câu chuyện của mình: chọn đúng project, trình bày vấn đề, quy trình và kết quả cho nhà tuyển dụng.', 'Đóng gói các bài đã làm thành portfolio online, để AI lo phần kỹ thuật và tập trung vào câu chuyện mỗi case study.', '["Case study theo khung vấn đề → quy trình → kết quả", "Vibecode có kiểm soát", "Deploy, tên miền, SEO cơ bản, analytics", "Chọn đúng công cụ: vibecode, Framer hay no-code"]'::jsonb, null, 'https://academy.telos.vn/wp-content/uploads/2026/11/gv-khue.png'),
  ('pdm', 'Ngồi chung bàn với PM, PO, DA: chọn làm gì trước, đo bằng metric nào và khi nào nên đưa AI vào sản phẩm.', 'Hiểu sản phẩm và mô hình kinh doanh: từ discovery, metric, doanh thu đến launch, đủ để ra quyết định cùng team sản phẩm.', '["Discovery, market sizing, phân tích đối thủ", "Metric, A/B test, pricing và mô hình doanh thu", "Agile, Scrum, user story", "Đưa AI vào sản phẩm đúng lúc"]'::jsonb, '/thuat-ngu/product-designer', 'https://academy.telos.vn/wp-content/uploads/2025/10/SocialIMage.png'),
  ('finish', 'Sẵn sàng làm sản phẩm cùng AI: AI làm nhanh hơn, bạn quyết định cái gì đáng làm.', 'Đi hết lộ trình: sẵn sàng cho ngày đầu đi làm ở vị trí Product Designer, làm việc cùng AI mà vẫn là người ra quyết định.', '[]'::jsonb, '/thuat-ngu/product-designer', null)
) as v(id, role_tagline, role_summary, role_skills, role_link, course_image_url)
where c.id = v.id;

-- bản 3: tên nhánh bỏ chữ "Rẽ trái: / Rẽ phải:" (chỉ đổi khi vẫn còn tên cũ, tên đã sửa trong CMS giữ nguyên)
update tm_journey_checkpoints set name = 'Biết code' where id = 'code' and name = 'Rẽ phải: biết code';

insert into tm_journey_settings (id, seo_title, seo_description, intro_text, workplaces)
values (1, 'Lộ trình AI-Driven Product Designer: 8 khóa từ Newbie tới Product Designer | TELOS Academy', 'Hành trình 8 khóa, 68 buổi tại TELOS Academy: Công cụ, Thẩm mỹ, Trải nghiệm, Hệ thống, Dự án, Code, Portfolio, Chiến lược. Học làm sản phẩm cùng AI: AI làm nhanh hơn, designer quyết định cái gì đáng làm. Chơi thử dạng game.', '8 trạm, mỗi trạm là một khóa trong chuỗi AI-Driven Product Designer. Đi qua trạm nào, bạn biết mình học gì, làm ra đầu ra gì, và lên đời thành phiên bản nào của một designer.', '[{"scale": "small", "label": "Startup", "note": "Ít người, làm đủ thứ, học nhanh nhất."}, {"scale": "large", "label": "Công ty sản phẩm", "note": "Vài trăm người, có squad và chapter, quy trình rõ."}, {"scale": "agency", "label": "Agency", "note": "Làm cho khách hàng, nhiều dự án, nhiều deadline."}]'::jsonb)
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
      role_tagline       = case when r ? 'role_tagline'       then r ->> 'role_tagline'       else role_tagline end,
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
