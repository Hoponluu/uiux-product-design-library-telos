-- ════════════════════════════════════════════════════════
-- TEAM MAP — seed quy mô Agency / Outsource (sinh tự động bởi scripts/gen_team_map_seed.py, đừng sửa tay)
-- Chạy sau supabase_team_map.sql trên DB ĐÃ CÓ dữ liệu Team Map. Chỉ thêm / cập nhật phần agency:
-- 6 phòng A1–A6, 5 nhân vật mới, 17 vị trí, 8 nhiệm vụ, cột reports_to_agency. Không sửa nội dung nhân vật cũ.
-- Chạy lại nhiều lần không tạo trùng (upsert theo id), nhưng sẽ ghi đè phần agency đã sửa trong CMS.
-- ════════════════════════════════════════════════════════
begin;

-- 1. Phòng ban (chỉ nội dung; hình học nằm trong team-map/team-map.layout.js)
insert into tm_rooms (id, scale, code, name, intro, sort_order) values
  ('A1', 'agency', 'Team 1', 'Design team', 'Ở agency bạn làm nhiều dự án cùng lúc, mỗi dự án một ngành khác nhau. Học nhanh và rộng, nhưng ít khi theo một sản phẩm đủ lâu để thấy kết quả. Người duyệt thiết kế của bạn là Design Director.', 0),
  ('A2', 'agency', 'Team 2', 'Dev team', 'Một dev ở đây có thể chạy 2–3 dự án cùng lúc và thường không dự các buổi họp với khách. File thiết kế của bạn phải tự nói được mọi thứ.', 1),
  ('A3', 'agency', 'Team 3', 'Account & Project', 'Mọi yêu cầu của khách hàng đi qua đây. Account Manager giữ quan hệ, Project Manager giữ phạm vi, tiến độ và ngân sách. Đừng tự hứa gì với khách khi chưa hỏi Project Manager.', 2),
  ('A4', 'agency', 'Họp', 'Phòng họp khách hàng', 'Nơi trình bày concept và nghe phản hồi của khách. Thiết kế tốt mà trình bày không rõ thì vẫn bị bác: ở agency, kỹ năng thuyết trình quan trọng ngang kỹ năng vẽ.', 3),
  ('A5', 'agency', 'Chung', 'Pantry', 'Khu chung để nghỉ và gặp gỡ. Người dùng được mời tới dùng thử sản phẩm của khách cũng ngồi chờ ở đây.', 4),
  ('A6', 'agency', 'Team 4', 'Sales', 'Nơi mang dự án về cho công ty. Designer hay được nhờ dựng nhanh một bản demo để Sales đi thuyết phục khách ký hợp đồng.', 5)
on conflict (id) do update set scale = excluded.scale, code = excluded.code, name = excluded.name, intro = excluded.intro, sort_order = excluded.sort_order;

-- 2. Nhân vật (lượt 1: chưa gắn báo cáo cho ai)
insert into tm_characters (id, title, kind, "group", article_url, summary, doing, with_designer, props, appearance, tag, cta, is_active) values
  ('client', 'Client', 'role', 'business', null, 'Khách hàng thuê agency làm sản phẩm. Họ trả tiền, đặt mục tiêu và là người quyết định cuối cùng, nhưng họ không phải người dùng của sản phẩm.', 'Đang ngồi chờ buổi họp, tranh thủ trả lời tin nhắn công việc.', 'Bạn trình bày thiết kế cho họ và nghe phản hồi. Mọi yêu cầu mới của họ phải đi qua Account Manager và Project Manager.', '["briefcase"]'::jsonb, '{"dark": false, "outfit": null, "body_color": "#FFC53D", "outline_color": "#8A5D00"}'::jsonb, 'Khách hàng của agency', null, true),
  ('design-director', 'Design Director', 'role', 'design', null, 'Người chịu trách nhiệm về chất lượng thiết kế của cả agency. Mọi bản thiết kế phải qua Design Director trước khi gửi khách.', 'Đang xem lại concept của ba dự án khác nhau.', 'Quản lý chuyên môn trực tiếp của bạn. Duyệt thiết kế, góp ý và quyết định bản nào đủ tốt để gửi khách.', '["glasses", "pointer"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('graphic-designer', 'Graphic Designer', 'role', 'design', null, 'Designer làm nhận diện thương hiệu, banner, hình minh hoạ và ấn phẩm truyền thông.', 'Đang chỉnh bộ banner cho chiến dịch khai trương của khách.', 'Cho bạn biết màu, font và hình ảnh thương hiệu của khách để giao diện không lệch nhận diện.', '["palette"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('sales', 'Sales / Business Developer', 'role', 'business', null, 'Người đi tìm khách hàng và mang dự án về cho agency.', 'Đang chuẩn bị slide cho buổi gặp khách chiều nay.', 'Hay nhờ bạn dựng nhanh một bản demo để khách dễ hình dung trước khi ký hợp đồng.', '["megaphone"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('freelancer', 'Freelancer', 'role', 'design', 'https://academy.telos.vn/cach-lam-freelance-thiet-ke-giao-dien/', 'Designer làm việc độc lập, được agency thuê theo từng dự án khi team thiếu người.', 'Đang làm bộ icon cho một dự án cần gấp trong tuần này.', 'Làm cùng bạn trong vài tuần rồi rời đi. Bạn cần bàn giao file gọn gàng để họ vào việc nhanh.', '["laptop", "backpack"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true)
on conflict (id) do update set title = excluded.title, kind = excluded.kind, "group" = excluded."group", article_url = excluded.article_url, summary = excluded.summary, doing = excluded.doing, with_designer = excluded.with_designer, props = excluded.props, appearance = excluded.appearance, tag = excluded.tag, cta = excluded.cta, is_active = excluded.is_active;

-- lượt 2: báo cáo cho ai ở agency (chỉ cột reports_to_agency, kể cả với nhân vật cũ)
update tm_characters c set reports_to_agency = v.rta from (values
  ('ui-ux-designer', 'design-director'),
  ('intern', 'ui-ux-designer'),
  ('tech-lead', 'ceo'),
  ('frontend-developer', 'tech-lead'),
  ('backend-developer', 'tech-lead'),
  ('qa-engineer', 'tech-lead'),
  ('project-manager', 'ceo'),
  ('account-manager', 'ceo'),
  ('business-analyst', 'project-manager'),
  ('design-director', 'ceo'),
  ('graphic-designer', 'design-director'),
  ('sales', 'ceo'),
  ('freelancer', 'design-director')
) as v(id, rta) where c.id = v.id;

-- 3. Vị trí (fixed = ngồi cố định, không đi dạo, không tới điểm tập hợp)
insert into tm_placements (id, character_id, scale, room_id, seat_order, fixed) values
  ('design-director@A1', 'design-director', 'agency', 'A1', 0, false),
  ('ui-ux-designer@A1', 'ui-ux-designer', 'agency', 'A1', 1, false),
  ('graphic-designer@A1', 'graphic-designer', 'agency', 'A1', 2, false),
  ('intern@A1', 'intern', 'agency', 'A1', 3, false),
  ('freelancer@A1', 'freelancer', 'agency', 'A1', 4, false),
  ('tech-lead@A2', 'tech-lead', 'agency', 'A2', 0, false),
  ('frontend-developer@A2', 'frontend-developer', 'agency', 'A2', 1, false),
  ('backend-developer@A2', 'backend-developer', 'agency', 'A2', 2, false),
  ('qa-engineer@A2', 'qa-engineer', 'agency', 'A2', 3, false),
  ('account-manager@A3', 'account-manager', 'agency', 'A3', 0, false),
  ('project-manager@A3', 'project-manager', 'agency', 'A3', 1, false),
  ('business-analyst@A3', 'business-analyst', 'agency', 'A3', 2, false),
  ('client@A4', 'client', 'agency', 'A4', 0, true),
  ('sales@A6', 'sales', 'agency', 'A6', 0, false),
  ('ceo@A6', 'ceo', 'agency', 'A6', 1, false),
  ('user@A5', 'user', 'agency', 'A5', 0, true),
  ('nhan-luu@A5', 'nhan-luu', 'agency', 'A5', null, false)
on conflict (id) do update set character_id = excluded.character_id, scale = excluded.scale, room_id = excluded.room_id, seat_order = excluded.seat_order, fixed = excluded.fixed;

-- 4. Nhiệm vụ
insert into tm_quests (id, type, scale, sort_order, title, room_id, giver, gather, offer_text, done_text, rewards, is_active, daily_date) values
  ('agency-01', 'main', 'agency', 1, 'Làm demo để chốt hợp đồng', 'A6', 'sales@A6', '["ceo@A6"]'::jsonb, 'Chiều nay mình đi gặp một chuỗi phòng gym, họ muốn làm app đặt lịch tập. Bạn dựng giúp mình một màn hình demo nhé. Không cần hoàn chỉnh, miễn là khách hình dung được.', 'Chốt được rồi! Khách ký hợp đồng 8 tuần. Tuần sau kickoff, bạn vào dự án này nhé.', '[{"type": "term", "name": "Mockup", "url": "https://academy.telos.vn/mockup-la-gi-huong-dan-toan-tap-cho-nguoi-moi/"}, {"type": "term", "name": "Portfolio", "url": "https://academy.telos.vn/product-designer-portfolio-gom-gi/"}]'::jsonb, true, null),
  ('agency-02', 'main', 'agency', 2, 'Kickoff và nhận brief', 'A4', 'account-manager@A3', '["project-manager@A3"]'::jsonb, 'Hôm nay kickoff với khách. Bạn đừng vội nói về giao diện. Hãy hỏi xem họ muốn đạt điều gì và hội viên của họ là ai.', 'Hỏi hay lắm. Biết mục tiêu của khách rồi thì sau này mình có cơ sở để từ chối những yêu cầu lạc đề.', '[{"type": "character", "id": "stakeholder"}, {"type": "term", "name": "Problem Statement", "url": "https://academy.telos.vn/problem-statement-cach-xac-dinh-cho-nguoi-moi-hoc-ui-ux/"}]'::jsonb, true, null),
  ('agency-03', 'main', 'agency', 3, 'Chốt phạm vi dự án', 'A3', 'project-manager@A3', '["business-analyst@A3"]'::jsonb, 'Hợp đồng là 8 tuần với ngân sách cố định. Bạn hỏi BA danh sách màn hình, rồi sang hỏi Tech Lead xem làm kịp không.', 'Vậy giai đoạn 1 là 9 màn hình, chưa có thanh toán. Mình ghi rõ vào biên bản để sau này không ai tranh cãi.', '[{"type": "character", "id": "business-analyst"}, {"type": "term", "name": "MVP", "url": "https://academy.telos.vn/mo-hinh-mvp-trong-hoc-ui-ux-hoc-cach-hoan-thanh/"}, {"type": "term", "name": "Feasibility", "url": "https://academy.telos.vn/feasibility-la-gi-product-design/"}]'::jsonb, true, null),
  ('agency-04', 'main', 'agency', 4, 'Duyệt nội bộ', 'A1', 'design-director@A1', '["graphic-designer@A1"]'::jsonb, 'Trước khi gửi khách, mọi thứ phải qua mình. Bạn làm concept cho luồng đặt lịch rồi mang lại đây.', 'Luồng 3 bước rõ ràng. Sửa lại độ tương phản chữ trên nền cam rồi gửi khách được. Nhớ nhé: khách chỉ nên thấy bản đã duyệt nội bộ.', '[{"type": "term", "name": "Wireframe", "url": "https://academy.telos.vn/wireframe-khung-xuong-cua-thiet-ke/"}, {"type": "term", "name": "Heuristic Evaluation", "url": "https://academy.telos.vn/phuong-phap-heuristic-evaluation/"}]'::jsonb, true, null),
  ('agency-05', 'main', 'agency', 5, 'Trình bày cho khách hàng', 'A4', 'account-manager@A3', '["design-director@A1", "project-manager@A3"]'::jsonb, 'Khách tới rồi. Bạn trình bày concept nhé. Nhớ bắt đầu từ mục tiêu của họ, đừng bắt đầu từ màu sắc.', 'Khách thích luồng chính là thắng lớn rồi. Mấy thứ khách đòi thêm thì đừng gật ngay, để mình và PM xem lại hợp đồng đã.', '[{"type": "term", "name": "Prototype", "url": "https://academy.telos.vn/prototype-la-gi-video-huong-dan/"}, {"type": "term", "name": "Desirability", "url": "https://academy.telos.vn/desirability-la-gi/"}]'::jsonb, true, null),
  ('agency-06', 'main', 'agency', 6, 'Khách hàng đổi ý', 'A4', 'client@A4', '[]'::jsonb, 'À em ơi, tiện thể làm luôn cho anh phần bán gói tập online với tích điểm đổi quà nhé. Chắc thêm vài màn hình thôi mà.', 'Ừ, anh hiểu rồi. Vậy cứ làm xong giai đoạn 1 đã, phần kia bên em báo giá sau nhé.', '[{"type": "term", "name": "Viability", "url": "https://academy.telos.vn/viability-la-gi-product-design/"}, {"type": "term", "name": "Agile", "url": "https://academy.telos.vn/waterfall-va-agile-la-gi/"}]'::jsonb, true, null),
  ('agency-07', 'main', 'agency', 7, 'Thuyết phục bằng người dùng', 'A3', 'project-manager@A3', '["account-manager@A3"]'::jsonb, 'Khách vẫn muốn nhồi banner lên trang chủ. Cãi bằng ý kiến cá nhân thì mình thua. Bạn ra Pantry cho một hội viên dùng thử rồi mang kết quả về.', 'Thấy chưa, khách không nghe designer nhưng nghe người dùng của họ. Lần sau cứ test trước khi tranh luận.', '[{"type": "term", "name": "Usability Testing", "url": "https://academy.telos.vn/usability-testing-la-gi-ux-design/"}, {"type": "term", "name": "User Persona", "url": "https://academy.telos.vn/user-persona-la-gi-cach-tao-ra-1-user-persona/"}]'::jsonb, true, null),
  ('agency-08', 'main', 'agency', 8, 'Handoff và nghiệm thu', 'A2', 'tech-lead@A2', '["frontend-developer@A2", "qa-engineer@A2"]'::jsonb, 'Dev bên mình đang chạy 3 dự án cùng lúc, không ai nhớ hết các buổi họp đâu. File của bạn phải tự nói được mọi thứ.', 'Dự án đầu tiên của bạn ở agency xong rồi. Tuần sau có dự án mới, ngành khác hẳn. Quen dần đi nhé!', '[{"type": "character", "id": "frontend-developer"}, {"type": "term", "name": "Design System", "url": "https://academy.telos.vn/design-system-la-gi/"}]'::jsonb, true, null)
on conflict (id) do update set type = excluded.type, scale = excluded.scale, sort_order = excluded.sort_order, title = excluded.title, room_id = excluded.room_id, giver = excluded.giver, gather = excluded.gather, offer_text = excluded.offer_text, done_text = excluded.done_text, rewards = excluded.rewards, is_active = excluded.is_active, daily_date = excluded.daily_date;

-- 5. Bước nhiệm vụ
insert into tm_quest_steps (id, quest_id, sort_order, type, target, task_text, line_text, secs) values
  ('agency-01-s1', 'agency-01', 1, 'work', null, 'Về máy dựng nhanh mockup màn hình đặt lịch', 'Nhìn được đó! Có hình thật thì khách dễ hình dung hơn hẳn slide toàn chữ.', 5),
  ('agency-01-s2', 'agency-01', 2, 'talk', 'ceo@A6', 'Hỏi Founder nên nhấn điểm gì khi gặp khách', 'Đừng khoe nhiều tính năng. Cho họ thấy hội viên đặt được lịch trong 3 bước là đủ.', null),
  ('agency-02-s1', 'agency-02', 1, 'talk', 'client@A4', 'Hỏi Client mục tiêu của dự án', 'Bên anh có 12 phòng tập. Hội viên toàn gọi điện đặt lịch nên lễ tân quá tải. Anh muốn sau 3 tháng, 70% lượt đặt lịch đi qua app.', null),
  ('agency-02-s2', 'agency-02', 2, 'talk', 'project-manager@A3', 'Chốt lại ghi chú với Project Manager', 'Mình ghi nhận: mục tiêu là giảm cuộc gọi đặt lịch. Mọi màn hình sau này phải phục vụ điều đó.', null),
  ('agency-03-s1', 'agency-03', 1, 'talk', 'business-analyst@A3', 'Hỏi Business Analyst danh sách màn hình', 'Khách liệt kê 24 màn hình. Nhưng để hội viên đặt được lịch thì chỉ cần 9 màn hình là chạy được.', null),
  ('agency-03-s2', 'agency-03', 2, 'talk', 'tech-lead@A2', 'Sang Dev team hỏi Tech Lead cái nào làm kịp', '9 màn hình thì kịp 8 tuần. Riêng thanh toán online nên để giai đoạn 2, tích hợp cổng thanh toán mất ít nhất 3 tuần.', null),
  ('agency-04-s1', 'agency-04', 1, 'work', null, 'Về máy làm concept luồng đặt lịch', 'Xong concept rồi à? Trước khi mình xem, bạn hỏi Graphic Designer về nhận diện của khách đã.', 5),
  ('agency-04-s2', 'agency-04', 2, 'talk', 'graphic-designer@A1', 'Hỏi Graphic Designer về màu thương hiệu của khách', 'Logo khách màu cam đậm. Bạn chỉ dùng cam cho nút chính thôi, đừng phủ cả màn hình, chói lắm.', null),
  ('agency-05-s1', 'agency-05', 1, 'present', null, 'Trình bày concept trên TV phòng họp', 'Bạn vừa trình bày xong. Khách gật gù, nhưng có vẻ còn muốn nói gì đó.', 6),
  ('agency-05-s2', 'agency-05', 2, 'talk', 'client@A4', 'Nghe phản hồi của Client', 'Luồng đặt lịch thì anh thích. Nhưng trang chủ trống quá. Em thêm banner khuyến mãi, tin tức, rồi bảng xếp hạng hội viên nữa nhé.', null),
  ('agency-06-s1', 'agency-06', 1, 'talk', 'project-manager@A3', 'Đừng nhận lời vội. Về hỏi Project Manager', 'Hai phần đó nằm ngoài hợp đồng, cộng lại khoảng 4 tuần nữa. Mình sẽ báo giá bổ sung. Khách đồng ý thì mới làm.', null),
  ('agency-06-s2', 'agency-06', 2, 'talk', 'account-manager@A3', 'Nhờ Account Manager nói lại với khách', 'Để mình nói. Bạn cứ giữ thái độ vui vẻ: đừng từ chối thẳng, mà cũng đừng hứa.', null),
  ('agency-07-s1', 'agency-07', 1, 'talk', 'user@A5', 'Ra Pantry nhờ User dùng thử trang chủ', 'Mình mở app là muốn đặt lịch ngay. Mấy cái banner này che mất nút, mình tưởng quảng cáo nên lướt qua luôn.', null),
  ('agency-07-s2', 'agency-07', 2, 'talk', 'client@A4', 'Mang kết quả cho Client xem', 'Hội viên nói vậy thật à? Thôi được, banner cho xuống dưới, nút đặt lịch để trên cùng.', null),
  ('agency-08-s1', 'agency-08', 1, 'work', null, 'Về máy chuẩn bị spec và prototype', 'Spec đủ các trạng thái rồi. Giờ bạn giải thích cho Frontend nhé.', 5),
  ('agency-08-s2', 'agency-08', 2, 'talk', 'frontend-developer@A2', 'Giải thích spec cho Frontend Developer', 'Rõ rồi. Mình dùng lại bộ component của dự án trước, chỉ đổi màu theo thương hiệu khách.', null),
  ('agency-08-s3', 'agency-08', 3, 'talk', 'client@A4', 'Mời Client nghiệm thu sản phẩm', 'App chạy đúng như bản thiết kế. Anh ký nghiệm thu. Giai đoạn 2 anh làm tiếp với bên em.', null)
on conflict (id) do update set quest_id = excluded.quest_id, sort_order = excluded.sort_order, type = excluded.type, target = excluded.target, task_text = excluded.task_text, line_text = excluded.line_text, secs = excluded.secs;

-- 6. Gắn nhân vật với thuật ngữ nhóm "Vai trò": theo URL bài viết (bỏ dấu / cuối khi so sánh),
--    hoặc theo tên thuật ngữ gợi ý (term_search). Khớp → đặt term_id và xoá article_url (game lấy URL của thuật ngữ).
--    Không khớp → giữ article_url.
with recursive vt as (
  select id from categories where slug = 'vai-tro'
  union all
  select c.id from categories c join vt on c.parent_id = vt.id
), hint(cid, name) as (values ('graphic-designer', 'Graphic Designer'), ('freelancer', 'Freelancer')
), m as (
  select distinct on (ch.id) ch.id as cid, t.id as tid
  from tm_characters ch
  left join hint h on h.cid = ch.id
  join concepts t on t.category_id in (select id from vt)
                 and ((t.url is not null and ch.article_url is not null and rtrim(lower(t.url), '/') = rtrim(lower(ch.article_url), '/'))
                      or (h.name is not null and lower(t.name) = lower(h.name)))
  where ch.id in ('client', 'design-director', 'graphic-designer', 'sales', 'freelancer') and ch.term_id is null
  order by ch.id, t.is_published desc
)
update tm_characters ch set term_id = m.tid, article_url = null from m where ch.id = m.cid;

-- 7. Thẻ thưởng: {type:'term', name, url} → {type:'term', term_id}.
--    Ưu tiên khớp cả tên lẫn URL (vd Agile và Waterfall dùng chung một bài), rồi theo tên, rồi theo URL.
--    Không khớp thì giữ nguyên dạng cũ (game vẫn hiện tên + link) và liệt kê ở báo cáo bên dưới.
update tm_quests q set rewards = (
  select coalesce(jsonb_agg(
    case when r ->> 'type' = 'term' and not (r ? 'term_id') then coalesce(
      (select jsonb_build_object('type', 'term', 'term_id', t.id) from concepts t
        where lower(t.name) = lower(r ->> 'name')
        order by (t.url is not null and rtrim(lower(t.url), '/') = rtrim(lower(r ->> 'url'), '/')) desc, t.is_published desc limit 1),
      (select jsonb_build_object('type', 'term', 'term_id', t.id) from concepts t
        where t.url is not null and rtrim(lower(t.url), '/') = rtrim(lower(r ->> 'url'), '/')
        order by t.is_published desc limit 1),
      r)
    else r end order by n), '[]'::jsonb)
  from jsonb_array_elements(q.rewards) with ordinality as e(r, n)
) where q.scale = 'agency';

commit;

-- 8. BÁO CÁO — nhân vật nào đã gắn thuật ngữ, thẻ thưởng nào chưa khớp thuật ngữ (cần xử lý tay trong CMS)
select 'Nhân vật đã gắn thuật ngữ' as loai, ch.id as ma, ch.title || ' → ' || t.name as chi_tiet
from tm_characters ch join concepts t on t.id = ch.term_id where ch.id in ('client', 'design-director', 'graphic-designer', 'sales', 'freelancer')
union all
select 'Nhân vật có link riêng, chưa gắn thuật ngữ', ch.id, ch.article_url
from tm_characters ch where ch.id in ('client', 'design-director', 'graphic-designer', 'sales', 'freelancer') and ch.term_id is null and ch.article_url is not null
union all
select 'Nhân vật chưa có bài', ch.id, ch.title
from tm_characters ch where ch.id in ('client', 'design-director', 'graphic-designer', 'sales', 'freelancer') and ch.term_id is null and ch.article_url is null and ch.kind = 'role'
union all
select 'Thẻ thưởng CHƯA khớp thuật ngữ', q.id, (r ->> 'name') || ' · ' || coalesce(r ->> 'url', '')
from tm_quests q, jsonb_array_elements(q.rewards) r
where q.scale = 'agency' and r ->> 'type' = 'term' and not (r ? 'term_id')
order by 1, 2;
