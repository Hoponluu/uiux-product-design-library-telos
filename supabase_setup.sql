-- ════════════════════════════════════════════════════════
-- RLS: anon chỉ được đọc, không được ghi
-- ════════════════════════════════════════════════════════
alter table categories enable row level security;
alter table concepts    enable row level security;

create policy "public read categories" on categories for select using (true);
create policy "public read concepts"   on concepts   for select using (true);

-- ════════════════════════════════════════════════════════
-- SEED: Công cụ UX
-- ════════════════════════════════════════════════════════
insert into concepts (slug, name, category_id, description, url, node_size)
select slug, name, (select id from categories where slug='cong-cu'), description, url, 8
from (values
  ('ai-ux-pattern',       'AI UX Pattern',        'Các mẫu thiết kế giao diện phổ biến khi tích hợp tính năng AI vào sản phẩm.',                                               'https://academy.telos.vn/ai-ux-pattern-la-gi/'),
  ('bieu-do-xuong-ca',    'Biểu đồ Xương Cá',     'Công cụ phân tích nguyên nhân gốc rễ của một vấn đề, hình dung dưới dạng xương cá.',                                       'https://academy.telos.vn/bieu-do-xuong-ca-la-gi/'),
  ('cognitive-walkthrough','Cognitive Walkthrough','Phương pháp đánh giá UX từ chuyên gia, tập trung vào khả năng người dùng mới tự tìm ra cách dùng.',                         'https://academy.telos.vn/phuong-phap-cognitive-walkthrough/'),
  ('customer-journey-map','Customer Journey Map',  'Sơ đồ mô tả toàn bộ hành trình của khách hàng khi tương tác với sản phẩm hoặc dịch vụ.',                                  'https://academy.telos.vn/customer-journey-map-hanh-trinh-khach-hang/'),
  ('design-system',       'Design System',         'Bộ thư viện component, token, và guideline dùng chung để đảm bảo nhất quán trong thiết kế và code.',                       'https://academy.telos.vn/design-system-la-gi/'),
  ('empathy-map',         'Empathy Map',           'Công cụ tổng hợp insight người dùng theo 4 chiều: nói, nghĩ, làm, và cảm nhận.',                                           'https://academy.telos.vn/huong-dan-nguoi-moi-ve-empathy-map-la-gi/'),
  ('grid-system',         'Grid System',           'Hệ thống lưới giúp sắp xếp các thành phần giao diện nhất quán, cân đối và dễ responsive.',                                 'https://academy.telos.vn/grid-system-la-gi-vai-tro-trong-ui-ux/'),
  ('heuristic-evaluation','Heuristic Evaluation',  'Phương pháp đánh giá UX từ chuyên gia dựa trên 10 nguyên lý usability của Jakob Nielsen.',                                  'https://academy.telos.vn/phuong-phap-heuristic-evaluation/'),
  ('mockup',              'Mockup',                'Bản thiết kế tĩnh thể hiện giao diện gần với sản phẩm thật, dùng để review visual trước khi prototype.',                   'https://academy.telos.vn/mockup-la-gi-huong-dan-toan-tap-cho-nguoi-moi/'),
  ('portfolio',           'Portfolio',             'Hồ sơ năng lực của designer — tập hợp các case study thể hiện tư duy và quy trình thiết kế.',                             'https://academy.telos.vn/product-designer-portfolio-gom-gi/'),
  ('problem-statement',   'Problem Statement',     'Câu phát biểu súc tích xác định đúng vấn đề người dùng cần giải quyết, làm nền cho toàn bộ thiết kế.',                    'https://academy.telos.vn/problem-statement-cach-xac-dinh-cho-nguoi-moi-hoc-ui-ux/'),
  ('prototype',           'Prototype',             'Phiên bản mô phỏng sản phẩm có tương tác, dùng để test ý tưởng trước khi đưa vào development.',                           'https://academy.telos.vn/prototype-la-gi-video-huong-dan/'),
  ('pure',                'PURE',                  'Phương pháp đánh giá UX từ chuyên gia của Google, cho điểm định lượng theo 3 chiều cho mỗi bước tương tác.',               'https://academy.telos.vn/pure-phuong-phap-danh-gia-ux-tu-chuyen-gia-google/'),
  ('sitemap',             'Sitemap',               'Sơ đồ cấu trúc thông tin của một website hoặc app, thể hiện quan hệ phân cấp giữa các trang.',                            'https://academy.telos.vn/sitemap-la-gi/'),
  ('usability-testing',   'Usability Testing',     'Phương pháp quan sát người dùng thực tế thực hiện task để phát hiện vấn đề mà expert review không thấy được.',             null),
  ('user-flow',           'User Flow',             'Sơ đồ các bước người dùng thực hiện để hoàn thành một task cụ thể trong sản phẩm.',                                        'https://academy.telos.vn/user-flow-dan-loi-nguoi-dung-trong-tung-tuong-tac/'),
  ('user-persona',        'User Persona',          'Hồ sơ người dùng đại diện được xây dựng từ dữ liệu research, dùng để định hướng quyết định thiết kế.',                    'https://academy.telos.vn/user-persona-la-gi-cach-tao-ra-1-user-persona/'),
  ('ux-flow',             'UX Flow',               'Các loại flow phổ biến trong UX — onboarding, checkout, empty state — và cách thiết kế từng loại.',                        'https://academy.telos.vn/hieu-dung-ve-cac-ux-flow-pho-bien-hay-gap/'),
  ('ux-pattern',          'UX Pattern',            'Giải pháp thiết kế đã được kiểm chứng cho các vấn đề giao diện lặp đi lặp lại.',                                          'https://academy.telos.vn/ux-pattern-chia-khoa-tao-nen-trai-nghiem/')
) as t(slug, name, description, url);

-- ════════════════════════════════════════════════════════
-- SEED: Khái niệm
-- ════════════════════════════════════════════════════════
insert into concepts (slug, name, category_id, description, url, node_size)
select slug, name, (select id from categories where slug='khai-niem'), description, url, 8
from (values
  ('accessibility',   'Accessibility',   'Thiết kế để mọi người dùng — kể cả người khuyết tật — đều có thể sử dụng được sản phẩm.',                               'https://academy.telos.vn/hieu-ve-thiet-ke-trai-nghiem-accessibility/'),
  ('agile',           'Agile',           'Quy trình phát triển sản phẩm theo vòng lặp ngắn, linh hoạt, ưu tiên phản hồi nhanh hơn kế hoạch cố định.',            'https://academy.telos.vn/waterfall-va-agile-la-gi/'),
  ('bo-cuc-website',  'Bố cục Website',  'Cách tổ chức và sắp xếp các thành phần trên trang web để dẫn dắt sự chú ý người dùng.',                               'https://academy.telos.vn/bo-cuc-website-la-gi-mot-huong-dan-tu-tong-the-den-truc-quan/'),
  ('design-thinking', 'Design Thinking', 'Tư duy thiết kế lấy con người làm trung tâm, gồm 5 giai đoạn từ empathize đến test.',                                  'https://academy.telos.vn/tu-duy-thiet-ke-human-centered-design/'),
  ('double-diamond',  'Double Diamond',  'Mô hình quy trình thiết kế 4 giai đoạn — tìm đúng vấn đề trước, rồi mới tìm đúng giải pháp.',                         null),
  ('thiet-ke',        'Thiết kế',        'Khảo sát ý niệm thiết kế là gì — vượt ra ngoài thẩm mỹ để giải quyết vấn đề có chủ đích.',                            'https://academy.telos.vn/khao-sat-y-niem-thiet-ke-la-gi/'),
  ('ux-design',       'UX Design',       'Thiết kế trải nghiệm người dùng — tư duy giải quyết vấn đề toàn diện, không chỉ là thiết kế giao diện.',               'https://academy.telos.vn/ux-design-khong-chi-la-button-ma-la-tu-duy-product/'),
  ('ux-research',     'UX Research',     'Nghiên cứu người dùng để hiểu hành vi, nhu cầu, và vấn đề — nền tảng của mọi quyết định thiết kế.',                   'https://academy.telos.vn/ux-research-la-gi-tu-duy-hay-chuc-danh/'),
  ('waterfall',       'Waterfall',       'Quy trình phát triển tuyến tính theo từng giai đoạn cố định — đối lập với Agile về tính linh hoạt.',                   'https://academy.telos.vn/waterfall-va-agile-la-gi/'),
  ('wireframe',       'Wireframe',       'Bản phác thảo khung giao diện tập trung vào cấu trúc và layout, chưa có màu sắc hay visual chi tiết.',                 'https://academy.telos.vn/wireframe-khung-xuong-cua-thiet-ke/')
) as t(slug, name, description, url);

-- ════════════════════════════════════════════════════════
-- SEED: Vai trò (gắn vào subcategory tương ứng)
-- ════════════════════════════════════════════════════════
insert into concepts (slug, name, category_id, description, url, node_size)
select slug, name, (select id from categories where slug=cat_slug), description, url, 8
from (values
  ('product-designer', 'Product Designer',       'vt-design',      'Vai trò thiết kế toàn diện — từ research, UX, đến UI — với tư duy gắn liền mục tiêu sản phẩm.',                          'https://academy.telos.vn/product-designer-la-gi-va-3-tu-duy/'),
  ('uiux-designer',    'UI/UX Designer',          'vt-design',      'Vai trò thiết kế tập trung vào giao diện và trải nghiệm người dùng — kết hợp tư duy UX và kỹ năng UI.',                  'https://academy.telos.vn/cong-viec-cua-ui-ux-designer/'),
  ('design-engineer',  'UX Design Engineer',      'vt-design',      'Vai trò kết hợp tư duy UX, kỹ năng thiết kế và khả năng kỹ thuật để tự triển khai trải nghiệm chất lượng cao.',          'https://academy.telos.vn/ux-design-engineer-la-gi/'),
  ('product-manager',  'Product Manager',         'vt-product',     'Người chịu trách nhiệm về định hướng và kết quả sản phẩm — xác định cần làm gì, tại sao, và theo thứ tự nào.',           'https://academy.telos.vn/product-manager-pm-la-gi-product-team/'),
  ('product-owner',    'Product Owner',           'vt-product',     'Vai trò Scrum quản lý product backlog và ra quyết định ưu tiên cho từng sprint — cầu nối giữa business và team.',        'https://academy.telos.vn/product-owner-po-la-gi/'),
  ('frontend-dev',     'Frontend Developer',      'vt-engineering', 'Developer phụ trách giao diện người dùng — người biến file Figma thành sản phẩm thực chạy trên browser.',                null),
  ('backend-dev',      'Backend Developer',       'vt-engineering', 'Developer phụ trách logic, dữ liệu, và API phía server — nền tảng vận hành của mọi sản phẩm.',                          null),
  ('fullstack-dev',    'Full-stack Developer',    'vt-engineering', 'Developer có khả năng làm cả Frontend lẫn Backend — linh hoạt và phù hợp với team nhỏ cần tốc độ.',                     null),
  ('devops',           'DevOps / Platform Eng.',  'vt-engineering', 'Người xây dựng hạ tầng, pipeline deploy, và đảm bảo hệ thống vận hành ổn định và có thể mở rộng.',                     null),
  ('software-architect','Software Architect',     'vt-engineering', 'Người thiết kế kiến trúc tổng thể hệ thống — quyết định cách các thành phần được tổ chức và giao tiếp dài hạn.',        null),
  ('business-analyst', 'Business Analyst',        'vt-business',    'Người phân tích yêu cầu kinh doanh và dịch chúng thành đặc tả kỹ thuật cho team design và engineering.',               'https://academy.telos.vn/business-analyst-ba-la-gi-product-team/'),
  ('freelancer',       'Freelancer',              'vt-cross',       'Hình thức làm việc độc lập nhận dự án theo hợp đồng — cách vận hành, tìm client và định giá dịch vụ.',                 'https://academy.telos.vn/cach-lam-freelance-thiet-ke-giao-dien/'),
  ('intern',           'Intern',                  'vt-cross',       'Góc nhìn thực tế về vai trò thực tập sinh UI/UX — kỳ vọng, cách chuẩn bị và tận dụng thời gian intern.',               'https://academy.telos.vn/intern-ui-ux-nhung-cam-nang-khi-di-thuc-tap/'),
  ('vi-tri-nganh',     'Vị trí ngành UI/UX',      'vt-cross',       'Tổng quan các chức danh phổ biến trong ngành UI/UX và phạm vi công việc của từng vị trí.',                             'https://academy.telos.vn/tim-hieu-cac-vi-tri-trong-nganh-ui-ux-design/')
) as t(slug, name, cat_slug, description, url);
