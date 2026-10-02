-- ════════════════════════════════════════════════════════
-- TEAM MAP — seed (sinh tự động bởi scripts/gen_team_map_seed.py, đừng sửa tay)
-- Chạy sau supabase_team_map.sql. Upsert theo id: chạy lại sẽ ghi đè nội dung đã sửa trong CMS.
-- ════════════════════════════════════════════════════════
begin;

-- 1. Phòng ban (chỉ nội dung)
insert into tm_rooms (id, scale, code, name, intro, sort_order) values
  ('P1', 'small', 'Team 1', 'Product team', 'Đây là chỗ của bạn. Product Manager quyết định làm gì và theo thứ tự nào, bạn thiết kế, Intern học cùng bạn. Ở công ty nhỏ, designer thường kiêm luôn research và viết nội dung giao diện.', 0),
  ('P2', 'small', 'Team 2', 'Dev team', 'Tech Lead, Frontend, Backend, Mobile và QA biến thiết kế thành sản phẩm chạy được. Bạn sẽ sang đây để handoff, trả lời câu hỏi và review bản build.', 1),
  ('P3', 'small', 'Team 3', 'Business team', 'CEO, Marketing, Sales, Customer Support và Business Analyst. Nơi đặt mục tiêu kinh doanh và nghe tiếng nói khách hàng, nguồn insight quý cho thiết kế.', 2),
  ('P4', 'small', 'Họp', 'Phòng họp', 'Phòng dùng cho Sprint Planning, demo cuối sprint và các buổi họp cả công ty. TV để trình bày thiết kế.', 3),
  ('P5', 'small', 'Chung', 'Pantry', 'Khu chung để nghỉ, gặp gỡ ngẫu nhiên và sinh hoạt guild. Nhiều ý tưởng hay bắt đầu từ một cuộc nói chuyện ở đây.', 4),
  ('P6', 'small', 'Đóng', 'Phòng ban khác', null, 5),
  ('R01', 'large', 'R01', 'Leadership', 'CEO, CPO, CTO và các Head. Đặt chiến lược và OKR cho cả công ty. Head of Design là quản lý chuyên môn cao nhất của bạn.', 0),
  ('R07', 'large', 'R07', 'Data & Analytics', 'Data Analyst, BI Analyst, Data Scientist và Data Engineer. Ghé đây khi cần số liệu funnel hay kết quả A/B test.', 1),
  ('R08', 'large', 'R08', 'Phòng họp', 'Sprint Planning và Sprint Review diễn ra ở đây. Stakeholder thường tới dự buổi demo.', 2),
  ('R02', 'large', 'R02', 'Tribe Growth', 'Các squad lo onboarding, kích hoạt và giới thiệu bạn bè. Designer ở đây làm việc nhiều với A/B test và số liệu tăng trưởng.', 3),
  ('R03', 'large', 'R03', 'Core Experience', 'Squad của bạn: PM, designer, Tech Lead, dev và QA ngồi chung một bàn. Đây là nơi bạn làm việc hằng ngày.', 4),
  ('R04', 'large', 'R04', 'Monetization', 'Squad lo thanh toán và gói dịch vụ. Designer ở đây làm việc sát với các ràng buộc về giá và pháp lý.', 5),
  ('R05', 'large', 'R05', 'Platform', 'DevOps, Software Architect và team Design System. Hỏi team Design System trước khi vẽ một component mới.', 6),
  ('R06', 'large', 'R06', 'Design Studio', 'Ngôi nhà chuyên môn của designer: Design Manager, UX Researcher, UX Writer, Motion Designer. Buổi Design Critique diễn ra hằng tuần ở đây.', 7),
  ('R09', 'large', 'R09', 'Delivery Hub', 'Scrum Master, Delivery Manager và Project Manager giữ nhịp sprint và hạn chót phát hành.', 8),
  ('R11', 'large', 'Chung', 'Pantry', 'Khu chung để nghỉ, gặp gỡ ngẫu nhiên và sinh hoạt guild. Người dùng được mời tới phỏng vấn cũng hay ngồi chờ ở đây.', 9),
  ('R10', 'large', 'R10', 'Hàng xóm · ngoài vách kính', 'Marketing, Customer Success, Sales và Business Analyst ngồi ngoài vách kính. Họ là những stakeholder bạn làm việc cùng thường xuyên.', 10)
on conflict (id) do update set scale = excluded.scale, code = excluded.code, name = excluded.name, intro = excluded.intro, sort_order = excluded.sort_order;

-- 2. Nhân vật (lượt 1: chưa gắn báo cáo cho ai)
insert into tm_characters (id, title, kind, "group", article_url, summary, doing, with_designer, props, appearance, tag, cta, is_active) values
  ('ceo', 'Chief Executive Officer', 'role', 'business', null, 'Người chịu trách nhiệm cao nhất về tầm nhìn và kết quả kinh doanh của công ty.', 'Đang xem lại OKR quý này với ban lãnh đạo.', 'Ít làm việc trực tiếp với designer, nhưng mục tiêu công ty do CEO đặt ra quyết định bạn thiết kế cho điều gì.', '["briefcase"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('cpo', 'Chief Product Officer', 'role', 'product', null, 'Chịu trách nhiệm chiến lược sản phẩm và quản lý đội ngũ Product Manager.', 'Đang chốt roadmap cho hai quý tới.', 'Duyệt các hướng sản phẩm lớn. Bạn sẽ trình bày với CPO ở các buổi review chiến lược.', '["flag"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('cto', 'Chief Technology Officer', 'role', 'engineering', null, 'Chịu trách nhiệm công nghệ, kiến trúc hệ thống và đội ngũ kỹ sư.', 'Đang rà soát chi phí hạ tầng tháng này.', 'Quyết định các giới hạn kỹ thuật, ảnh hưởng tới những gì designer có thể đề xuất.', '["laptop"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('head-of-design', 'Head of Design', 'role', 'design', null, 'Lãnh đạo toàn bộ chapter Design: tuyển dụng, chất lượng thiết kế và lộ trình phát triển của designer.', 'Đang xây khung năng lực cho các cấp designer.', 'Quản lý chuyên môn cao nhất của bạn (solid line). Bạn gặp ở các buổi all-hands của Design.', '["glasses", "pointer"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('head-of-data', 'Head of Data', 'role', 'data', null, 'Lãnh đạo đội Data & Analytics và chuẩn hoá cách công ty đo lường.', 'Đang chuẩn hoá bộ chỉ số North Star.', 'Cung cấp số liệu để đánh giá một thiết kế có hiệu quả hay không.', '["chart"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('head-of-eng', 'Head of Engineering', 'role', 'engineering', null, 'Quản lý các Engineering Manager, QA Lead và chất lượng kỹ thuật chung.', 'Đang sắp xếp nhân sự cho squad mới.', 'Ít làm trực tiếp, nhưng quyết định tốc độ và cách các dev làm việc với bạn.', '["headset"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('product-manager', 'Product Manager', 'role', 'product', 'https://academy.telos.vn/product-manager-pm-la-gi-product-team/', 'Người chịu trách nhiệm về định hướng và kết quả sản phẩm: cần làm gì, tại sao, và theo thứ tự nào.', 'Đang viết user story cho luồng onboarding.', 'Đặt ưu tiên công việc cho bạn mỗi sprint (dotted line). Là người bạn trao đổi nhiều nhất mỗi ngày.', '["clipboard"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('product-owner', 'Product Owner', 'role', 'product', 'https://academy.telos.vn/product-owner-po-la-gi/', 'Vai trò Scrum quản lý product backlog và quyết định ưu tiên cho từng sprint.', 'Đang sắp xếp backlog cho sprint sau.', 'Làm rõ tiêu chí chấp nhận (acceptance criteria) cho từng thiết kế của bạn.', '["cards"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('growth-pm', 'Growth Product Manager', 'role', 'product', null, 'PM tập trung vào chỉ số tăng trưởng: kích hoạt, giữ chân, giới thiệu.', 'Đang đọc kết quả A/B test màn hình đăng ký.', 'Cùng bạn thiết kế thí nghiệm và đọc kết quả A/B test.', '["chart"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('data-pm', 'Data Product Manager', 'role', 'product', null, 'PM cho các sản phẩm dữ liệu nội bộ như dashboard và hệ thống tracking.', 'Đang định nghĩa event tracking cho tính năng mới.', 'Giúp bạn gắn tracking đúng để đo hiệu quả thiết kế.', '["clipboard"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('ui-ux-designer', 'UI/UX Designer', 'player', 'design', 'https://academy.telos.vn/cong-viec-cua-ui-ux-designer/', 'Vai trò thiết kế giao diện và trải nghiệm người dùng: kết hợp tư duy UX và kỹ năng UI.', 'Đây là bạn. Bạn đang thiết kế luồng onboarding mới.', 'Ngồi trong squad, nhận ưu tiên từ PM, báo cáo chuyên môn cho Design Manager.', '["cap", "tablet"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('product-designer', 'Product Designer', 'role', 'design', 'https://academy.telos.vn/product-designer-la-gi-va-3-tu-duy/', 'Vai trò thiết kế toàn diện, từ research, UX đến UI, gắn liền với mục tiêu sản phẩm.', 'Đang vẽ user flow cho tính năng mời bạn bè.', 'Đồng nghiệp cùng chapter. Hai bạn hay gặp nhau ở buổi Design Critique.', '["tablet"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('ui-designer', 'UI Designer', 'role', 'design', null, 'Tập trung vào giao diện: bố cục, màu sắc, chữ và component.', 'Đang hoàn thiện màn hình hồ sơ theo Design System.', 'Cùng chapter. Hay trao đổi với bạn về cách dùng component cho đúng.', '["palette"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('ux-designer', 'UX Designer', 'role', 'design', null, 'Tập trung vào trải nghiệm: luồng, cấu trúc thông tin và tương tác.', 'Đang vẽ lại luồng thanh toán còn 3 bước.', 'Cùng chapter. Hay cùng bạn review user flow trước khi lên UI.', '["pencil"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('intern', 'Intern UI/UX', 'role', 'design', 'https://academy.telos.vn/intern-ui-ux-nhung-cam-nang-khi-di-thuc-tap/', 'Thực tập sinh UI/UX, học bằng cách làm cùng designer chính.', 'Đang tập vẽ wireframe theo hướng dẫn của bạn.', 'Bạn là người hướng dẫn trực tiếp. Intern hỏi bạn mọi thứ, từ file Figma đến cách họp.', '["backpack"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('ds-designer', 'Design System Designer', 'role', 'design', 'https://academy.telos.vn/design-system-designer-la-ai-product-design/', 'Xây và duy trì Design System: component library, token và guideline cho toàn sản phẩm.', 'Đang thêm biến thể mới cho component Button.', 'Hỏi họ trước khi vẽ một component mới. Có thể nó đã tồn tại.', '["palette"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('ux-design-engineer', 'UX Design Engineer', 'role', 'design', 'https://academy.telos.vn/ux-design-engineer-la-gi/', 'Kết hợp tư duy UX, thiết kế và code để tự triển khai trải nghiệm chất lượng cao.', 'Đang chuyển token màu từ Figma sang CSS.', 'Cầu nối giữa file Figma của bạn và code thật.', '["laptop"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('design-manager', 'Design Manager', 'role', 'design', null, 'Quản lý trực tiếp các designer: review chất lượng, 1-on-1, phát triển nghề.', 'Đang chuẩn bị buổi Design Critique chiều nay.', 'Quản lý chuyên môn trực tiếp của bạn (solid line). Gặp 1-on-1 hai tuần một lần.', '["glasses", "pointer"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('ux-researcher', 'UX Researcher', 'role', 'design', null, 'Lên kế hoạch và thực hiện nghiên cứu người dùng.', 'Đang viết kịch bản cho buổi Usability Test.', 'Giúp bạn kiểm chứng thiết kế với người dùng thật trước khi build.', '["monocle", "clipboard"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('ux-writer', 'UX Writer & Content Designer', 'role', 'design', null, 'Viết chữ trong giao diện: nút, thông báo, hướng dẫn, trạng thái lỗi.', 'Đang viết lại thông báo lỗi đăng nhập.', 'Cùng bạn hoàn thiện câu chữ trên từng màn hình.', '["pencil"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('motion-designer', 'Motion Designer', 'role', 'design', 'https://academy.telos.vn/motion-designer-la-ai-product-design/', 'Tạo chuyển động và animation trong sản phẩm, từ micro-interaction đến transition.', 'Đang làm animation chuyển cảnh cho onboarding.', 'Biến các tương tác bạn thiết kế thành chuyển động mượt.', '["play"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('tech-lead', 'Tech Lead', 'role', 'engineering', null, 'Kỹ sư dẫn dắt kỹ thuật trong squad, chịu trách nhiệm giải pháp và chất lượng code.', 'Đang ước lượng effort cho story mới.', 'Cùng bạn và PM tạo thành product trio. Trả lời câu hỏi: làm được không, tốn bao lâu.', '["headset"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('frontend-developer', 'Frontend Developer', 'role', 'engineering', 'https://academy.telos.vn/frontend-developer-la-ai-product/', 'Developer phụ trách giao diện người dùng, người biến file Figma thành sản phẩm chạy trên trình duyệt.', 'Đang dựng component Card theo file Figma của bạn.', 'Nhận handoff từ bạn. Sẽ hỏi về spacing, trạng thái và responsive.', '["laptop"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('backend-developer', 'Backend Developer', 'role', 'engineering', 'https://academy.telos.vn/backend-developer-la-ai-product/', 'Developer phụ trách logic, dữ liệu và API phía server.', 'Đang viết API lưu tiến độ onboarding.', 'Cho bạn biết dữ liệu nào có sẵn và hệ thống phản hồi nhanh tới đâu.', '["database"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('fullstack-developer', 'Full-stack Developer', 'role', 'engineering', 'https://academy.telos.vn/full-stack-developer-la-ai-product/', 'Developer làm cả Frontend lẫn Backend, linh hoạt cho team cần tốc độ.', 'Đang làm landing page SEO từ đầu đến cuối.', 'Hay cùng bạn thử nhanh một ý tưởng trong vài ngày.', '["laptop"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('mobile-developer', 'Mobile Developer', 'role', 'engineering', null, 'Developer làm ứng dụng iOS và Android.', 'Đang sửa lỗi cử chỉ vuốt trên Android.', 'Hỏi bạn về khác biệt pattern giữa iOS và Android.', '["phone"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('qa-engineer', 'QA Engineer', 'role', 'engineering', null, 'Kỹ sư kiểm thử, đảm bảo sản phẩm chạy đúng trước khi ra mắt.', 'Đang viết test case cho luồng thanh toán.', 'So bản build với thiết kế của bạn và báo lại khi có chỗ lệch.', '["magnifier"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('software-architect', 'Software Architect', 'role', 'engineering', null, 'Người thiết kế kiến trúc tổng thể của hệ thống.', 'Đang vẽ sơ đồ tách dịch vụ thanh toán.', 'Ít làm trực tiếp, nhưng quyết định của họ ảnh hưởng tốc độ và giới hạn tính năng.', '["scroll"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('devops', 'DevOps & Platform Engineer', 'role', 'engineering', null, 'Xây hạ tầng và pipeline deploy, giữ hệ thống chạy ổn định.', 'Đang theo dõi bản deploy chiều nay.', 'Khi sản phẩm chậm hay sập, họ là người xử lý đầu tiên.', '["gear"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('data-analyst', 'Data Analyst', 'role', 'data', null, 'Phân tích dữ liệu để trả lời câu hỏi về sản phẩm và kinh doanh.', 'Đang dựng funnel đăng ký của tuần này.', 'Cho bạn biết người dùng rời đi ở bước nào của luồng.', '["chart"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('bi-analyst', 'Business Intelligence Analyst', 'role', 'data', null, 'Xây dashboard và báo cáo định kỳ cho các phòng ban.', 'Đang cập nhật dashboard doanh thu.', 'Dashboard của họ là nơi bạn tìm số liệu nhanh nhất.', '["pie"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('data-scientist', 'Data Scientist', 'role', 'data', null, 'Xây mô hình dự đoán và gợi ý từ dữ liệu.', 'Đang huấn luyện mô hình gợi ý khoá học.', 'Cùng bạn thiết kế cách hiển thị gợi ý do AI tạo ra.', '["flask"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('data-engineer', 'Data Engineer', 'role', 'data', null, 'Xây đường ống dữ liệu để các nhóm khác dùng được dữ liệu.', 'Đang sửa pipeline đồng bộ dữ liệu đêm qua.', 'Ít làm trực tiếp, nhưng tracking bạn đề xuất cần họ để chạy.', '["database"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('scrum-master', 'Scrum Master', 'role', 'delivery', null, 'Giữ nhịp Scrum: điều phối các buổi họp và gỡ vướng mắc cho team.', 'Đang chuẩn bị buổi Retro cuối sprint.', 'Giúp bạn gỡ những việc đang bị chặn trong sprint.', '["timer"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('delivery-manager', 'Delivery Manager', 'role', 'delivery', null, 'Đảm bảo các team giao sản phẩm đúng hạn và phối hợp tốt với nhau.', 'Đang cập nhật kế hoạch phát hành.', 'Cho bạn biết hạn chót thật sự của một tính năng.', '["calendar"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('project-manager', 'Project Manager', 'role', 'delivery', null, 'Quản lý dự án theo phạm vi, thời gian và nguồn lực.', 'Đang theo dõi tiến độ dự án tích hợp đối tác.', 'Cần bạn ước lượng thời gian thiết kế cho từng hạng mục.', '["calendar"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('growth-manager', 'Growth Manager', 'role', 'business', null, 'Phụ trách tăng trưởng người dùng qua nhiều kênh marketing.', 'Đang lên chiến dịch giới thiệu bạn bè.', 'Cần bạn thiết kế landing page và luồng mời bạn bè.', '["megaphone"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('performance-marketer', 'Performance Marketing Manager', 'role', 'business', null, 'Chạy quảng cáo trả phí và tối ưu chi phí trên mỗi người dùng.', 'Đang so sánh 3 mẫu banner quảng cáo.', 'Hay nhờ bạn làm biến thể banner và trang đích.', '["megaphone"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('brand-manager', 'Brand Manager', 'role', 'business', null, 'Giữ gìn hình ảnh và giọng nói của thương hiệu.', 'Đang duyệt bộ nhận diện cho chiến dịch mới.', 'Bạn cần tuân theo guideline thương hiệu họ đặt ra.', '["flag"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('content-marketer', 'Content Marketer', 'role', 'business', null, 'Viết nội dung cho blog, mạng xã hội và email.', 'Đang viết bài blog ra mắt tính năng.', 'Cần ảnh minh hoạ tính năng từ bạn.', '["pencil"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('crm-manager', 'CRM Manager', 'role', 'business', null, 'Quản lý email, thông báo và chương trình giữ chân khách hàng.', 'Đang thiết lập chuỗi email chào mừng.', 'Cùng bạn thiết kế email và thông báo trong app.', '["cards"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('seo-specialist', 'SEO Specialist', 'role', 'business', null, 'Tối ưu website để xuất hiện tốt trên Google.', 'Đang kiểm tra tốc độ tải trang.', 'Góp ý cấu trúc trang và tiêu đề khi bạn làm landing page.', '["magnifier"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('csm', 'Customer Success Manager', 'role', 'business', null, 'Giúp khách hàng dùng sản phẩm thành công và gia hạn.', 'Đang gọi cho khách hàng sắp hết hạn.', 'Mang về phản hồi thật từ khách hàng cho bạn.', '["headset"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('customer-support', 'Customer Support', 'role', 'business', null, 'Trả lời câu hỏi và xử lý sự cố của khách hàng.', 'Đang trả lời 12 ticket về quên mật khẩu.', 'Nguồn insight quý: lỗi nào người dùng hỏi nhiều nhất.', '["headset"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('account-manager', 'Account Manager', 'role', 'business', null, 'Quản lý quan hệ và hợp đồng với khách hàng lớn.', 'Đang chuẩn bị buổi demo cho khách hàng doanh nghiệp.', 'Cần bạn làm bản demo đẹp cho khách hàng lớn.', '["briefcase"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('business-analyst', 'Business Analyst', 'role', 'business', 'https://academy.telos.vn/business-analyst-ba-la-gi-product-team/', 'Phân tích yêu cầu kinh doanh và dịch chúng thành đặc tả cho design và engineering.', 'Đang viết đặc tả yêu cầu cho tính năng hoá đơn.', 'Dịch yêu cầu kinh doanh thành đặc tả để bạn thiết kế.', '["clipboard"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('stakeholder', 'Stakeholder', 'role', 'business', 'https://academy.telos.vn/stakeholder-la-ai-product/', 'Những người có lợi ích liên quan tới sản phẩm, có thể ảnh hưởng hoặc bị ảnh hưởng bởi quyết định thiết kế.', 'Đang chờ buổi Sprint Review để xem demo.', 'Bạn cần thuyết phục họ bằng lý do, dữ liệu và bản demo rõ ràng.', '["briefcase"]'::jsonb, '{"dark": false, "outfit": null}'::jsonb, null, null, true),
  ('nhan-luu', 'Nhân Lưu', 'author', 'design', null, 'Cha nội này là Academic Director tại TELOS Academy và là tác giả của trò chơi này. Ổng đi khắp các phòng để kể chuyện cười không vui làm giảm năng suất làm việc của mọi người.', 'Đang đi một vòng văn phòng, hỏi thăm từng team.', 'Ổng có thể chỉ cho bạn lộ trình học UI/UX và hướng phát triển trong lĩnh vực này.', '["blazer", "glasses", "necklace", "laptopCarry"]'::jsonb, '{"dark": false, "outfit": {"legs": "#C9BA95", "feet": "#B48D5C"}}'::jsonb, 'Academic Director · TELOS Academy', '[{"label": "Nhận quà", "url": "https://nhanluu.com/contact/", "primary": true}, {"label": "Tìm hiểu thêm", "url": "https://nhanluu.com"}]'::jsonb, true),
  ('user', 'User', 'guest', 'business', null, 'Người dùng thật của sản phẩm. Bạn ấy không quan tâm team làm việc ra sao, chỉ quan tâm sản phẩm có dễ dùng hay không.', 'Đang ngồi bấm điện thoại, lướt thử ứng dụng.', 'Hỏi và quan sát người dùng thật là cách nhanh nhất để biết thiết kế của bạn có dùng được không.', '["phoneUse"]'::jsonb, '{"dark": true, "outfit": null}'::jsonb, 'Người dùng thật', '[{"label": "Usability Testing", "url": "https://academy.telos.vn/usability-testing-la-gi-ux-design/", "primary": true}, {"label": "Learnability", "url": "https://academy.telos.vn/learnability-la-gi-ux-design/", "primary": false}]'::jsonb, true)
on conflict (id) do update set title = excluded.title, kind = excluded.kind, "group" = excluded."group", article_url = excluded.article_url, summary = excluded.summary, doing = excluded.doing, with_designer = excluded.with_designer, props = excluded.props, appearance = excluded.appearance, tag = excluded.tag, cta = excluded.cta, is_active = excluded.is_active;

-- lượt 2: báo cáo cho ai
update tm_characters c set reports_to = v.rt, reports_to_small = v.rts from (values
  ('ceo', null, null),
  ('cpo', 'ceo', null),
  ('cto', 'ceo', null),
  ('head-of-design', 'cpo', null),
  ('head-of-data', 'cpo', null),
  ('head-of-eng', 'cto', null),
  ('product-manager', 'cpo', 'ceo'),
  ('product-owner', 'cpo', null),
  ('growth-pm', 'cpo', null),
  ('data-pm', 'cpo', null),
  ('ui-ux-designer', 'design-manager', 'product-manager'),
  ('product-designer', 'design-manager', null),
  ('ui-designer', 'design-manager', null),
  ('ux-designer', 'design-manager', null),
  ('intern', 'ui-ux-designer', null),
  ('ds-designer', 'head-of-design', null),
  ('ux-design-engineer', 'head-of-design', null),
  ('design-manager', 'head-of-design', null),
  ('ux-researcher', 'head-of-design', null),
  ('ux-writer', 'head-of-design', null),
  ('motion-designer', 'head-of-design', null),
  ('tech-lead', 'head-of-eng', 'ceo'),
  ('frontend-developer', 'head-of-eng', 'tech-lead'),
  ('backend-developer', 'head-of-eng', 'tech-lead'),
  ('fullstack-developer', 'head-of-eng', null),
  ('mobile-developer', 'head-of-eng', 'tech-lead'),
  ('qa-engineer', 'head-of-eng', 'tech-lead'),
  ('software-architect', 'cto', null),
  ('devops', 'cto', null),
  ('data-analyst', 'head-of-data', null),
  ('bi-analyst', 'head-of-data', null),
  ('data-scientist', 'head-of-data', null),
  ('data-engineer', 'head-of-data', null),
  ('scrum-master', 'delivery-manager', null),
  ('delivery-manager', 'cto', null),
  ('project-manager', 'delivery-manager', null),
  ('growth-manager', 'ceo', 'ceo'),
  ('performance-marketer', 'growth-manager', null),
  ('brand-manager', 'ceo', null),
  ('content-marketer', 'growth-manager', null),
  ('crm-manager', 'growth-manager', null),
  ('seo-specialist', 'growth-manager', null),
  ('csm', 'ceo', null),
  ('customer-support', 'csm', 'ceo'),
  ('account-manager', 'ceo', 'ceo'),
  ('business-analyst', 'cpo', 'ceo'),
  ('stakeholder', null, null),
  ('nhan-luu', null, null),
  ('user', null, null)
) as v(id, rt, rts) where c.id = v.id;

-- 3. Vị trí
insert into tm_placements (id, character_id, scale, room_id, seat_order) values
  ('product-manager@P1', 'product-manager', 'small', 'P1', 0),
  ('ui-ux-designer@P1', 'ui-ux-designer', 'small', 'P1', 1),
  ('intern@P1', 'intern', 'small', 'P1', 2),
  ('tech-lead@P2', 'tech-lead', 'small', 'P2', 0),
  ('frontend-developer@P2', 'frontend-developer', 'small', 'P2', 1),
  ('backend-developer@P2', 'backend-developer', 'small', 'P2', 2),
  ('mobile-developer@P2', 'mobile-developer', 'small', 'P2', 3),
  ('qa-engineer@P2', 'qa-engineer', 'small', 'P2', 4),
  ('ceo@P3', 'ceo', 'small', 'P3', 0),
  ('growth-manager@P3', 'growth-manager', 'small', 'P3', 1),
  ('account-manager@P3', 'account-manager', 'small', 'P3', 2),
  ('customer-support@P3', 'customer-support', 'small', 'P3', 3),
  ('business-analyst@P3', 'business-analyst', 'small', 'P3', 4),
  ('ceo@R01', 'ceo', 'large', 'R01', 0),
  ('cpo@R01', 'cpo', 'large', 'R01', 1),
  ('cto@R01', 'cto', 'large', 'R01', 2),
  ('head-of-design@R01', 'head-of-design', 'large', 'R01', 3),
  ('head-of-data@R01', 'head-of-data', 'large', 'R01', 4),
  ('head-of-eng@R01', 'head-of-eng', 'large', 'R01', 5),
  ('data-pm@R07', 'data-pm', 'large', 'R07', 0),
  ('data-analyst@R07', 'data-analyst', 'large', 'R07', 1),
  ('bi-analyst@R07', 'bi-analyst', 'large', 'R07', 2),
  ('data-scientist@R07', 'data-scientist', 'large', 'R07', 3),
  ('data-engineer@R07', 'data-engineer', 'large', 'R07', 4),
  ('stakeholder@R08', 'stakeholder', 'large', 'R08', 0),
  ('growth-pm@R02', 'growth-pm', 'large', 'R02', 0),
  ('product-designer@R02', 'product-designer', 'large', 'R02', 1),
  ('tech-lead@R02', 'tech-lead', 'large', 'R02', 2),
  ('fullstack-developer@R02', 'fullstack-developer', 'large', 'R02', 3),
  ('qa-engineer@R02', 'qa-engineer', 'large', 'R02', 4),
  ('product-owner@R02', 'product-owner', 'large', 'R02', 5),
  ('product-manager@R03', 'product-manager', 'large', 'R03', 0),
  ('ui-ux-designer@R03', 'ui-ux-designer', 'large', 'R03', 1),
  ('ui-designer@R03', 'ui-designer', 'large', 'R03', 2),
  ('intern@R03', 'intern', 'large', 'R03', 3),
  ('tech-lead@R03', 'tech-lead', 'large', 'R03', 4),
  ('frontend-developer@R03', 'frontend-developer', 'large', 'R03', 5),
  ('mobile-developer@R03', 'mobile-developer', 'large', 'R03', 6),
  ('backend-developer@R03', 'backend-developer', 'large', 'R03', 7),
  ('qa-engineer@R03', 'qa-engineer', 'large', 'R03', 8),
  ('product-manager@R04', 'product-manager', 'large', 'R04', 0),
  ('ux-designer@R04', 'ux-designer', 'large', 'R04', 1),
  ('tech-lead@R04', 'tech-lead', 'large', 'R04', 2),
  ('backend-developer@R04', 'backend-developer', 'large', 'R04', 3),
  ('frontend-developer@R04', 'frontend-developer', 'large', 'R04', 4),
  ('software-architect@R05', 'software-architect', 'large', 'R05', 0),
  ('devops@R05', 'devops', 'large', 'R05', 1),
  ('ds-designer@R05', 'ds-designer', 'large', 'R05', 2),
  ('ux-design-engineer@R05', 'ux-design-engineer', 'large', 'R05', 3),
  ('design-manager@R06', 'design-manager', 'large', 'R06', 0),
  ('ux-researcher@R06', 'ux-researcher', 'large', 'R06', 1),
  ('ux-writer@R06', 'ux-writer', 'large', 'R06', 2),
  ('motion-designer@R06', 'motion-designer', 'large', 'R06', 3),
  ('scrum-master@R09', 'scrum-master', 'large', 'R09', 0),
  ('delivery-manager@R09', 'delivery-manager', 'large', 'R09', 1),
  ('project-manager@R09', 'project-manager', 'large', 'R09', 2),
  ('growth-manager@R10', 'growth-manager', 'large', 'R10', 0),
  ('performance-marketer@R10', 'performance-marketer', 'large', 'R10', 1),
  ('brand-manager@R10', 'brand-manager', 'large', 'R10', 2),
  ('content-marketer@R10', 'content-marketer', 'large', 'R10', 3),
  ('crm-manager@R10', 'crm-manager', 'large', 'R10', 4),
  ('seo-specialist@R10', 'seo-specialist', 'large', 'R10', 5),
  ('csm@R10', 'csm', 'large', 'R10', 6),
  ('customer-support@R10', 'customer-support', 'large', 'R10', 7),
  ('account-manager@R10', 'account-manager', 'large', 'R10', 8),
  ('business-analyst@R10', 'business-analyst', 'large', 'R10', 9),
  ('user@P5', 'user', 'small', 'P5', 0),
  ('nhan-luu@P5', 'nhan-luu', 'small', 'P5', null),
  ('user@R11', 'user', 'large', 'R11', 0),
  ('nhan-luu@R11', 'nhan-luu', 'large', 'R11', null)
on conflict (id) do update set character_id = excluded.character_id, scale = excluded.scale, room_id = excluded.room_id, seat_order = excluded.seat_order;

-- 4. Nhiệm vụ
insert into tm_quests (id, type, scale, sort_order, title, room_id, giver, gather, offer_text, done_text, rewards, is_active, daily_date) values
  ('small-01', 'main', 'small', 1, 'Nhận việc đầu sprint', 'P4', 'product-manager@P1', '["tech-lead@P2", "frontend-developer@P2"]'::jsonb, 'Chào bạn! Sprint này mình làm lại luồng onboarding. Trước khi vẽ, bạn hỏi Tech Lead xem phần nào khó làm nhé.', 'Tuyệt, wireframe rõ ràng. Bước ảnh đại diện để sprint sau.', '[{"type": "character", "id": "product-manager"}, {"type": "term", "name": "Agile", "url": "https://academy.telos.vn/waterfall-va-agile-la-gi/"}]'::jsonb, true, null),
  ('small-02', 'main', 'small', 2, 'Hiểu mục tiêu kinh doanh', 'P3', 'ceo@P3', '["business-analyst@P3"]'::jsonb, 'Quý này công ty cần tăng 20% người dùng trả phí. Bạn hỏi BA xem onboarding liên quan thế nào.', 'Đúng rồi. Thiết kế nào giúp người dùng thấy giá trị sớm là thiết kế tốt.', '[{"type": "character", "id": "business-analyst"}, {"type": "term", "name": "Viability", "url": "https://academy.telos.vn/viability-la-gi-product-design/"}]'::jsonb, true, null),
  ('small-03', 'main', 'small', 3, 'Nghe tiếng nói khách hàng', 'P3', 'customer-support@P3', '["account-manager@P3"]'::jsonb, 'Mình nhận rất nhiều câu hỏi về bước đăng ký. Bạn sang hỏi Account Manager thêm góc nhìn khách lớn nhé.', 'Bạn ghi lại hai insight này vào persona nhé. Cảm ơn bạn đã lắng nghe!', '[{"type": "term", "name": "User Persona", "url": "https://academy.telos.vn/user-persona-la-gi-cach-tao-ra-1-user-persona/"}, {"type": "term", "name": "Empathy Map", "url": "https://academy.telos.vn/huong-dan-nguoi-moi-ve-empathy-map-la-gi/"}]'::jsonb, true, null),
  ('small-04', 'main', 'small', 4, 'Handoff cho Dev team', 'P2', 'frontend-developer@P2', '["qa-engineer@P2", "mobile-developer@P2"]'::jsonb, 'File Figma xong rồi hả? Trước khi code, bạn giải thích các trạng thái lỗi cho QA giúp mình.', 'Cảm ơn bạn. Có prototype bấm thử được nên mình hiểu luồng nhanh hơn nhiều.', '[{"type": "character", "id": "frontend-developer"}, {"type": "term", "name": "Prototype", "url": "https://academy.telos.vn/prototype-la-gi-video-huong-dan/"}]'::jsonb, true, null),
  ('small-05', 'main', 'small', 5, 'Demo cuối sprint', 'P4', 'product-manager@P1', '["ceo@P3", "growth-manager@P3", "tech-lead@P2", "customer-support@P3"]'::jsonb, 'Đến giờ demo rồi! Cả công ty đang ở phòng họp. Bạn trình bày rồi hỏi ý kiến CEO nhé.', 'Sprint đầu tiên của bạn hoàn thành rồi. Chào mừng tới team!', '[{"type": "character", "id": "stakeholder"}, {"type": "term", "name": "Desirability", "url": "https://academy.telos.vn/desirability-la-gi/"}]'::jsonb, true, null),
  ('large-01', 'main', 'large', 1, 'Sprint Planning', 'R08', 'product-manager@R03', '["tech-lead@R03", "frontend-developer@R03", "qa-engineer@R03"]'::jsonb, 'Sprint này squad Core làm lại luồng onboarding. Bạn hỏi Tech Lead ước lượng effort cho phần thiết kế mới nhé.', 'Ok, mình chốt story này vào sprint. Nhớ ghé team Design System nhé.', '[{"type": "character", "id": "product-manager"}, {"type": "term", "name": "Agile", "url": "https://academy.telos.vn/waterfall-va-agile-la-gi/"}]'::jsonb, true, null),
  ('large-02', 'main', 'large', 2, 'Discovery cùng số liệu', 'R03', 'tech-lead@R03', '["product-manager@R03"]'::jsonb, 'Trước khi vẽ, mình cần biết người dùng rơi ở bước nào. Bạn sang Data & Analytics xin số liệu funnel nhé.', '42% là con số lớn. Vấn đề rõ rồi, giờ mới tới giải pháp.', '[{"type": "term", "name": "Problem Statement", "url": "https://academy.telos.vn/problem-statement-cach-xac-dinh-cho-nguoi-moi-hoc-ui-ux/"}, {"type": "term", "name": "Customer Journey Map", "url": "https://academy.telos.vn/customer-journey-map-hanh-trinh-khach-hang/"}]'::jsonb, true, null),
  ('large-03', 'main', 'large', 3, 'Kiểm tra component', 'R05', 'ds-designer@R05', '["ux-design-engineer@R05"]'::jsonb, 'Bạn định vẽ thẻ chọn sở thích mới à? Hỏi UX Design Engineer xem component Chip đã có những gì đã.', 'Vậy mình thêm một biến thể thay vì làm component mới. Cảm ơn bạn đã hỏi trước!', '[{"type": "character", "id": "ds-designer"}, {"type": "term", "name": "Design System", "url": "https://academy.telos.vn/design-system-la-gi/"}]'::jsonb, true, null),
  ('large-04', 'main', 'large', 4, 'Design Critique', 'R06', 'design-manager@R06', '["product-designer@R02", "ui-designer@R03", "ux-designer@R04"]'::jsonb, 'Chiều nay đến lượt bạn trình bày wireframe. Lấy góp ý từ Product Designer và UX Designer nhé.', 'Hai góp ý rất tốt. Critique là để thiết kế tốt hơn, không phải để chấm điểm bạn.', '[{"type": "term", "name": "Heuristic Evaluation", "url": "https://academy.telos.vn/phuong-phap-heuristic-evaluation/"}, {"type": "term", "name": "Wireframe", "url": "https://academy.telos.vn/wireframe-khung-xuong-cua-thiet-ke/"}]'::jsonb, true, null),
  ('large-05', 'main', 'large', 5, 'Usability Test', 'R11', 'ux-researcher@R06', '["product-manager@R03"]'::jsonb, 'Mình mời được một người dùng thật, bạn ấy đang ngồi ở Pantry. Bạn cùng mình hỏi bạn ấy thử luồng onboarding nhé.', 'Một vấn đề thật, từ người dùng thật. Bạn sửa độ tương phản nút đó trước khi handoff nhé.', '[{"type": "term", "name": "Usability Testing", "url": "https://academy.telos.vn/usability-testing-la-gi-ux-design/"}, {"type": "term", "name": "Usability", "url": "https://academy.telos.vn/usability-la-gi-ux-design/"}]'::jsonb, true, null),
  ('large-06', 'main', 'large', 6, 'Handoff', 'R03', 'frontend-developer@R03', '["qa-engineer@R03", "mobile-developer@R03"]'::jsonb, 'File xong chưa? Bạn giải thích trạng thái lỗi và trạng thái tải cho QA giúp mình.', 'Có prototype bấm thử nên cả team hiểu luồng rất nhanh. Cảm ơn bạn!', '[{"type": "character", "id": "frontend-developer"}, {"type": "term", "name": "Prototype", "url": "https://academy.telos.vn/prototype-la-gi-video-huong-dan/"}]'::jsonb, true, null),
  ('large-07', 'main', 'large', 7, 'Sprint Review', 'R08', 'product-manager@R03', '["growth-manager@R10", "csm@R10", "stakeholder@R08", "tech-lead@R03"]'::jsonb, 'Đến giờ demo rồi. Marketing và Customer Success đều tới. Bạn nghe phản hồi từ hai bên nhé.', 'Hai ý này mình đưa vào backlog sprint sau. Demo của bạn rất thuyết phục.', '[{"type": "character", "id": "stakeholder"}, {"type": "term", "name": "Desirability", "url": "https://academy.telos.vn/desirability-la-gi/"}]'::jsonb, true, null),
  ('large-08', 'main', 'large', 8, '1-on-1 cuối sprint', 'R06', 'design-manager@R06', '[]'::jsonb, 'Sprint vừa rồi bạn đã làm việc với gần như mọi phòng ban. Mình nói chuyện về mục tiêu phát triển của bạn nhé.', 'Mục tiêu quý tới: tự dẫn một buổi Critique và bắt đầu làm portfolio từ dự án này.', '[{"type": "character", "id": "product-designer"}, {"type": "term", "name": "Portfolio", "url": "https://academy.telos.vn/product-designer-portfolio-gom-gi/"}]'::jsonb, true, null)
on conflict (id) do update set type = excluded.type, scale = excluded.scale, sort_order = excluded.sort_order, title = excluded.title, room_id = excluded.room_id, giver = excluded.giver, gather = excluded.gather, offer_text = excluded.offer_text, done_text = excluded.done_text, rewards = excluded.rewards, is_active = excluded.is_active, daily_date = excluded.daily_date;

-- 5. Bước nhiệm vụ
insert into tm_quest_steps (id, quest_id, sort_order, type, target, task_text, line_text, secs) values
  ('small-01-s1', 'small-01', 1, 'talk', 'tech-lead@P2', 'Hỏi Tech Lead phần nào của onboarding khó làm', 'Bước tải ảnh đại diện hơi nặng. Nếu bỏ được, team làm nhanh hơn 3 ngày.', null),
  ('small-01-s2', 'small-01', 2, 'work', null, 'Về chỗ ngồi, vẽ wireframe onboarding', 'Wireframe gọn hơn nhiều khi bỏ bước ảnh đại diện. Gửi mình xem nhé!', 5),
  ('small-02-s1', 'small-02', 1, 'talk', 'business-analyst@P3', 'Hỏi Business Analyst về yêu cầu kinh doanh', 'Người dùng thấy giá trị trong 3 phút đầu thì tỷ lệ nâng cấp cao gấp đôi. Onboarding phải dẫn tới đó.', null),
  ('small-03-s1', 'small-03', 1, 'talk', 'account-manager@P3', 'Hỏi Account Manager khách hàng than phiền gì', 'Khách doanh nghiệp muốn mời cả nhóm ngay khi đăng ký. Hiện phải làm sau, rất rối.', null),
  ('small-03-s2', 'small-03', 2, 'talk', 'user@P5', 'Ra Pantry hỏi trực tiếp một người dùng', 'Mình đăng ký xong mà không biết bấm vào đâu tiếp. Phải mò một lúc mới thấy.', null),
  ('small-04-s1', 'small-04', 1, 'work', null, 'Về máy hoàn thiện file Figma và prototype', 'File xong rồi đó. Giờ bạn giải thích các trạng thái cho QA nhé.', 5),
  ('small-04-s2', 'small-04', 2, 'talk', 'qa-engineer@P2', 'Giải thích các trạng thái lỗi cho QA', 'Rõ rồi. Mình sẽ viết test case cho cả trạng thái mất mạng nữa.', null),
  ('small-05-s1', 'small-05', 1, 'present', null, 'Trình bày onboarding mới trên TV phòng họp', 'Cả phòng vỗ tay. CEO giơ tay muốn góp ý.', 6),
  ('small-05-s2', 'small-05', 2, 'talk', 'ceo@P3', 'Hỏi ý kiến CEO', 'Rất rõ ràng. Mình thích việc người dùng thấy kết quả ngay ở bước 2. Ra mắt thôi!', null),
  ('large-01-s1', 'large-01', 1, 'talk', 'tech-lead@R03', 'Hỏi Tech Lead ước lượng effort', 'Khoảng 8 điểm. Nếu dùng lại component có sẵn trong Design System thì còn 5.', null),
  ('large-01-s2', 'large-01', 2, 'work', null, 'Về chỗ ngồi, phác wireframe đầu tiên', 'Bản phác đầu tiên đã có. Story này vào sprint được rồi.', 5),
  ('large-02-s1', 'large-02', 1, 'talk', 'data-analyst@R07', 'Sang Data & Analytics xin số liệu funnel', 'Đây: 42% người dùng bỏ đi ở bước chọn sở thích. Đó là chỗ đáng sửa nhất.', null),
  ('large-03-s1', 'large-03', 1, 'talk', 'ux-design-engineer@R05', 'Hỏi UX Design Engineer về component Chip', 'Chip có sẵn 3 trạng thái và đã có code. Bạn chỉ cần thêm trạng thái "đã chọn" có icon.', null),
  ('large-04-s1', 'large-04', 1, 'present', null, 'Trình bày wireframe trên màn hình Critique', 'Mọi người đã xem xong. Giờ đi lấy góp ý từng người nhé.', 5),
  ('large-04-s2', 'large-04', 2, 'talk', 'product-designer@R02', 'Lấy góp ý từ Product Designer', 'Bước 2 có hai nút chính cạnh nhau, người dùng sẽ phân vân. Giữ một nút chính thôi.', null),
  ('large-04-s3', 'large-04', 3, 'talk', 'ux-designer@R04', 'Lấy góp ý từ UX Designer', 'Nên cho phép bỏ qua bước chọn sở thích. Đừng ép người dùng.', null),
  ('large-05-s1', 'large-05', 1, 'talk', 'user@R11', 'Nhờ User thử luồng onboarding và quan sát', 'Ủa, muốn bỏ qua bước này thì bấm ở đâu? À… cái chữ mờ mờ này hả. Mình tưởng nó bị khoá.', null),
  ('large-05-s2', 'large-05', 2, 'talk', 'product-manager@R03', 'Chốt vấn đề vừa thấy với PM', 'Bạn thấy không? Người dùng không nhận ra nút "Bỏ qua" vì nó quá mờ.', null),
  ('large-06-s1', 'large-06', 1, 'work', null, 'Về máy chuẩn bị spec và prototype', 'Spec có đủ trạng thái lỗi và trạng thái tải. Giải thích cho QA nhé.', 5),
  ('large-06-s2', 'large-06', 2, 'talk', 'qa-engineer@R03', 'Giải thích các trạng thái cho QA', 'Rõ rồi. Mình sẽ test thêm trường hợp mạng yếu và màn hình nhỏ.', null),
  ('large-07-s1', 'large-07', 1, 'present', null, 'Demo onboarding trên TV phòng họp', 'Demo rất mượt. Marketing và Customer Success đều có ý kiến.', 6),
  ('large-07-s2', 'large-07', 2, 'talk', 'growth-manager@R10', 'Nghe phản hồi từ Growth Manager', 'Mình muốn thêm bước mời bạn bè ngay cuối onboarding. Có làm được không?', null),
  ('large-07-s3', 'large-07', 3, 'talk', 'csm@R10', 'Nghe phản hồi từ Customer Success', 'Khách hàng sẽ rất thích. Họ hỏi chuyện này mỗi tuần.', null)
on conflict (id) do update set quest_id = excluded.quest_id, sort_order = excluded.sort_order, type = excluded.type, target = excluded.target, task_text = excluded.task_text, line_text = excluded.line_text, secs = excluded.secs;

-- 6. Gắn nhân vật với thuật ngữ nhóm "Vai trò" theo URL bài viết (bỏ dấu / cuối khi so sánh).
--    Khớp → đặt term_id và xoá article_url (game lấy URL của thuật ngữ). Không khớp → giữ article_url.
with recursive vt as (
  select id from categories where slug = 'vai-tro'
  union all
  select c.id from categories c join vt on c.parent_id = vt.id
), m as (
  select distinct on (ch.id) ch.id as cid, t.id as tid
  from tm_characters ch
  join concepts t on t.category_id in (select id from vt)
                 and t.url is not null
                 and rtrim(lower(t.url), '/') = rtrim(lower(ch.article_url), '/')
  where ch.article_url is not null
  order by ch.id, t.is_published desc
)
update tm_characters ch set term_id = m.tid, article_url = null from m where ch.id = m.cid;

-- 7. Thẻ thưởng: {type:'term', name, url} → {type:'term', term_id}.
--    Ưu tiên khớp cả URL lẫn tên (vd Agile và Waterfall dùng chung một bài), rồi theo tên, rồi theo URL.
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
);

commit;

-- 8. BÁO CÁO — nhân vật nào đã gắn thuật ngữ, thẻ thưởng nào chưa khớp thuật ngữ (cần xử lý tay trong CMS)
select 'Nhân vật đã gắn thuật ngữ' as loai, ch.id as ma, ch.title || ' → ' || t.name as chi_tiet
from tm_characters ch join concepts t on t.id = ch.term_id
union all
select 'Nhân vật có link riêng, chưa gắn thuật ngữ', ch.id, ch.article_url
from tm_characters ch where ch.term_id is null and ch.article_url is not null
union all
select 'Nhân vật chưa có bài', ch.id, ch.title
from tm_characters ch where ch.term_id is null and ch.article_url is null and ch.kind = 'role'
union all
select 'Thẻ thưởng CHƯA khớp thuật ngữ', q.id, (r ->> 'name') || ' · ' || coalesce(r ->> 'url', '')
from tm_quests q, jsonb_array_elements(q.rewards) r
where r ->> 'type' = 'term' and not (r ? 'term_id')
order by 1, 2;
