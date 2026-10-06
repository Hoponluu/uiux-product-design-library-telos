-- ════════════════════════════════════════════════════════════════════
-- Trang thuật ngữ (/thuat-ngu/<slug>, /en/glossary/<slug>)
-- 1. Cột tiếng Anh cho nhóm + thuật ngữ (CMS sửa được)
-- 2. Hai nhóm vai trò mới: Data, Delivery
-- 3. Mỗi vai trò trong Product Map chưa có thuật ngữ → tạo thuật ngữ mới
--    (mô tả lấy từ modal nhân vật, kể cả bản tiếng Anh), rồi nối lại term_id
-- 4. Bản dịch tiếng Anh cho các thuật ngữ hiện có (không ghi đè bản đã sửa)
-- Chạy lại nhiều lần vẫn an toàn.
-- ════════════════════════════════════════════════════════════════════

alter table categories add column if not exists name_en text;
alter table concepts   add column if not exists name_en text;
alter table concepts   add column if not exists description_en text;

-- 2. Nhóm vai trò mới (con của "Vai trò")
insert into categories (slug, name, parent_id, depth, color, sort_order)
select v.slug, v.name, p.id, 1, '#7B56BF', v.ord
from (values ('vt-data', 'Data', 5), ('vt-delivery', 'Delivery', 6)) as v(slug, name, ord)
cross join (select id from categories where slug = 'vai-tro') p
on conflict (slug) do nothing;

update categories c set name_en = v.en
from (values
  ('tieu-chi', 'Product criteria'), ('cong-cu', 'UX tools'), ('khai-niem', 'Concepts'), ('vai-tro', 'Roles'),
  ('vt-design', 'Design'), ('vt-product', 'Product'), ('vt-engineering', 'Engineering'), ('vt-business', 'Business'),
  ('vt-data', 'Data'), ('vt-delivery', 'Delivery'), ('vt-other', 'Other roles'), ('vt-cross', 'Cross-functional')
) as v(slug, en)
where c.slug = v.slug and c.name_en is null;

-- 3a. Nối các nhân vật đã có thuật ngữ trùng slug / trùng tên (vd. devops, software-architect)
update tm_characters ch set term_id = t.id
from concepts t
where ch.term_id is null and ch.kind = 'role'
  and (t.slug = ch.id or lower(t.name) = lower(ch.title));

-- 3b. Vai trò còn lại → thuật ngữ mới, nội dung lấy từ modal nhân vật
insert into concepts (slug, name, name_en, category_id, description, description_en, url, node_size, is_published)
select ch.id, ch.title, coalesce(nullif(ch.i18n->'en'->>'title', ''), ch.title),
       cat.id, ch.summary, nullif(ch.i18n->'en'->>'summary', ''), ch.article_url, 8, true
from tm_characters ch
join categories cat on cat.slug = case ch."group"
  when 'design' then 'vt-design' when 'product' then 'vt-product' when 'engineering' then 'vt-engineering'
  when 'business' then 'vt-business' when 'data' then 'vt-data' when 'delivery' then 'vt-delivery' end
where ch.kind = 'role' and ch.is_active and ch.term_id is null
on conflict (slug) do nothing;

update tm_characters ch set term_id = t.id
from concepts t
where ch.term_id is null and ch.kind = 'role' and t.slug = ch.id;

-- 4. Bản dịch tiếng Anh cho các thuật ngữ hiện có
update concepts c set
  name_en        = coalesce(c.name_en, v.name_en),
  description_en = coalesce(c.description_en, v.description_en)
from (values
  ('a-b-testing', 'A/B Testing', 'An experiment that compares two design versions to measure which one performs better with real users.'),
  ('accessibility', 'Accessibility', 'Designing so that everyone, including people with disabilities, can use the product.'),
  ('agile', 'Agile', 'A product development process built on short, flexible iterations that values fast feedback over a fixed plan.'),
  ('ai-ux-pattern', 'AI UX Pattern', 'Common interface patterns for bringing AI features into a product.'),
  ('backend-dev', 'Backend Developer', 'The developer who builds server-side logic, data and APIs, the engine that runs every product.'),
  ('bieu-do-xuong-ca', 'Fishbone Diagram', 'A root-cause analysis tool that lays out the causes of a problem in the shape of a fish skeleton.'),
  ('bo-cuc-website', 'Website Layout', 'How the elements on a web page are organized and arranged to guide the user''s attention.'),
  ('business-analyst', 'Business Analyst', 'The person who analyzes business requirements and turns them into specifications for the design and engineering teams.'),
  ('cognitive-walkthrough', 'Cognitive Walkthrough', 'An expert UX review method that checks whether new users can figure out how to use the product on their own.'),
  ('customer-journey-map', 'Customer Journey Map', 'A diagram of the whole journey a customer goes through when interacting with a product or service.'),
  ('design-engineer', 'UX Design Engineer', 'A role that combines UX thinking, design skills and engineering ability to ship high-quality experiences end to end.'),
  ('design-system', 'Design System', 'A shared library of components, tokens and guidelines that keeps design and code consistent.'),
  ('design-system-designer', 'Design System Designer', 'A role dedicated to building and maintaining the Design System: the component library, tokens and guidelines for the whole product.'),
  ('design-thinking', 'Design Thinking', 'A human-centered way of solving problems in 5 stages, from empathize to test.'),
  ('desirability', 'Desirability', 'How much users truly want to use the product, one of the three pillars of a sustainable product.'),
  ('devops', 'DevOps / Platform Eng.', 'The engineer who builds infrastructure and deploy pipelines and keeps the system stable and scalable.'),
  ('double-diamond', 'Double Diamond', 'A 4-stage design process model: first find the right problem, then find the right solution.'),
  ('empathy-map', 'Empathy Map', 'A tool that sums up user insights in 4 dimensions: says, thinks, does and feels.'),
  ('feasibility', 'Feasibility', 'Whether a solution can actually be built within the current technical, time and resource constraints.'),
  ('freelancer', 'Freelancer', 'Working independently on contract projects: how it works, finding clients and pricing your services.'),
  ('frontend-dev', 'Frontend Developer', 'The developer who builds the user interface, turning Figma files into a real product that runs in the browser.'),
  ('fullstack-dev', 'Full-stack Developer', 'A developer who works on both frontend and backend, flexible and a good fit for small teams that need speed.'),
  ('grid-system', 'Grid System', 'A system of grids that keeps interface elements consistent, balanced and easy to make responsive.'),
  ('heuristic-evaluation', 'Heuristic Evaluation', 'An expert UX review method based on Jakob Nielsen''s 10 usability heuristics.'),
  ('information-architecture', 'Information Architecture (IA)', 'How information in a product is organized, labeled and structured so users can find what they need and know where they are.'),
  ('intern', 'Intern', 'A realistic look at the UI/UX intern role: expectations, how to prepare and how to make the most of your internship.'),
  ('jobs-to-be-done', 'Jobs-to-be-done', 'A framework for understanding users through the "job" they need to get done, not their demographics or the features they ask for.'),
  ('learnability', 'Learnability', 'How easily a new user can complete basic tasks the first time they use the product.'),
  ('mental-model', 'Mental Model', 'The picture in a user''s head of how a system works: not how it really works, but how they think it works.'),
  ('mockup', 'Mockup', 'A static design that looks close to the real product, used to review visuals before prototyping.'),
  ('motion-designer', 'Motion Designer', 'A designer who creates motion and animation in digital products, from micro-interactions to transitions.'),
  ('mvp', 'MVP', 'The smallest version of a product that is good enough to launch and collect real user feedback as early as possible.'),
  ('open-source-design-system', 'Open-source Design System', 'Design systems published openly by communities and large organizations, to learn from or use directly.'),
  ('portfolio', 'Portfolio', 'A designer''s body of work: a set of case studies that show how they think and how they design.'),
  ('problem-statement', 'Problem Statement', 'A short statement that defines the right user problem to solve and anchors the whole design.'),
  ('product-designer', 'Product Designer', 'An end-to-end design role, from research and UX to UI, tied closely to product goals.'),
  ('product-manager', 'Product Manager', 'Owns the direction and outcomes of the product: what to build, why, and in what order.'),
  ('product-owner', 'Product Owner', 'The Scrum role that manages the product backlog and sets priorities for each sprint, bridging business and the team.'),
  ('prototype', 'Prototype', 'An interactive simulation of the product used to test ideas before development.'),
  ('pure', 'PURE', 'Google''s expert UX review method that scores each step of a task on 3 dimensions.'),
  ('sitemap', 'Sitemap', 'A diagram of how a website or app is structured, showing the hierarchy between pages.'),
  ('software-architect', 'Software Architect', 'The person who designs the overall system architecture and decides how its parts are organized and talk to each other in the long run.'),
  ('stakeholder', 'Stakeholder', 'People or groups with an interest in the product, who can affect or be affected by design and development decisions.'),
  ('thiet-ke', 'Design', 'What design really means: beyond aesthetics, solving problems with intent.'),
  ('uiux-designer', 'UI/UX Designer', 'A design role focused on the interface and the user experience, combining UX thinking with UI skills.'),
  ('usability', 'Usability', 'How effectively, efficiently and satisfyingly users can use a product in a real context.'),
  ('usability-testing', 'Usability Testing', 'Watching real users do tasks to find problems that expert reviews miss.'),
  ('user-flow', 'User Flow', 'A diagram of the steps a user takes to complete a specific task in the product.'),
  ('user-persona', 'User Persona', 'A profile of a representative user built from research data, used to guide design decisions.'),
  ('ux-design', 'UX Design', 'User experience design: whole-picture problem solving, not just designing screens.'),
  ('ux-flow', 'UX Flow', 'Common UX flows such as onboarding, checkout and empty states, and how to design each one.'),
  ('ux-pattern', 'UX Pattern', 'A proven design solution for interface problems that come up again and again.'),
  ('ux-research', 'UX Research', 'Studying users to understand their behavior, needs and problems, the foundation of every design decision.'),
  ('viability', 'Viability', 'Whether the product creates lasting value for the business: revenue, cost and long-term competitive position.'),
  ('waterfall', 'Waterfall', 'A linear development process with fixed stages, the opposite of Agile when it comes to flexibility.'),
  ('wireframe', 'Wireframe', 'A skeleton sketch of an interface that focuses on structure and layout, without color or detailed visuals.')
) as v(slug, name_en, description_en)
where c.slug = v.slug;

notify pgrst, 'reload schema';
