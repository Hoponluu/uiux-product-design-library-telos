-- ════════════════════════════════════════════════════════
-- 1. CẬP NHẬT URL cho các khái niệm trước đây chưa có link
-- ════════════════════════════════════════════════════════

update concepts set url = 'https://academy.telos.vn/backend-developer-la-ai-product/'
where slug = 'backend-dev';

update concepts set url = 'https://academy.telos.vn/frontend-developer-la-ai-product/'
where slug = 'frontend-dev';

update concepts set url = 'https://academy.telos.vn/full-stack-developer-la-ai-product/'
where slug = 'fullstack-dev';

update concepts set url = 'https://academy.telos.vn/usability-testing-la-gi-ux-design/'
where slug = 'usability-testing';

update concepts set url = 'https://academy.telos.vn/mo-hinh-double-diamond-la-gi/'
where slug = 'double-diamond';

-- ════════════════════════════════════════════════════════
-- 2. ĐỔI CATEGORY: Design Thinking + Double Diamond → Công cụ UX
-- ════════════════════════════════════════════════════════

update concepts
set category_id = (select id from categories where slug = 'cong-cu')
where slug in ('design-thinking', 'double-diamond');

-- ════════════════════════════════════════════════════════
-- 3. SỬA DESCRIPTION: UX Design Engineer (bị merge 2 đoạn)
-- ════════════════════════════════════════════════════════

update concepts
set description = 'Vai trò kết hợp tư duy UX, kỹ năng thiết kế và khả năng kỹ thuật để tự triển khai trải nghiệm chất lượng cao từ đầu đến cuối.'
where slug = 'design-engineer';

-- ════════════════════════════════════════════════════════
-- 4. THÊM 3 KHÁI NIỆM MỚI
-- ════════════════════════════════════════════════════════

insert into concepts (slug, name, category_id, description, url, node_size, is_published)
values
  (
    'information-architecture',
    'Information Architecture (IA)',
    (select id from categories where slug = 'cong-cu'),
    'Cách tổ chức, đặt nhãn, và cấu trúc thông tin trong sản phẩm để người dùng có thể tìm được những gì họ cần và hiểu được mình đang ở đâu trong hệ thống.',
    'https://academy.telos.vn/information-architecture-la-gi-vs-sitemap/',
    8,
    true
  ),
  (
    'mental-model',
    'Mental Model',
    (select id from categories where slug = 'cong-cu'),
    'Hình ảnh trong đầu người dùng về cách một hệ thống hoạt động — không phải cách hệ thống thực sự hoạt động, mà là cách họ nghĩ nó hoạt động.',
    'https://academy.telos.vn/mental-model-la-gi-ux-research-design/',
    8,
    true
  ),
  (
    'open-source-design-system',
    'Open-source Design System',
    (select id from categories where slug = 'cong-cu'),
    'Các design system được phát hành công khai — tài nguyên tham khảo hoặc dùng trực tiếp từ cộng đồng và tổ chức lớn.',
    'https://academy.telos.vn/design-system-la-gi/#index_-14',
    8,
    true
  );

-- ════════════════════════════════════════════════════════
-- VERIFY — kiểm tra kết quả
-- ════════════════════════════════════════════════════════

select
  c.name,
  cat.name as category,
  case when c.url is not null then 'co URL' else 'TRONG' end as url_status
from concepts c
join categories cat on cat.id = c.category_id
where c.slug in (
  'backend-dev','frontend-dev','fullstack-dev','usability-testing',
  'double-diamond','design-thinking','design-engineer',
  'information-architecture','mental-model','open-source-design-system'
)
order by c.name;
