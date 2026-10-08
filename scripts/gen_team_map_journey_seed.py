#!/usr/bin/env python3
"""Sinh supabase_team_map_journey.sql từ team-map/seed-journey.json (trang Hành trình, docs/SPEC-journey.md).

Chạy:  python3 scripts/gen_team_map_journey_seed.py
SQL sinh ra chạy lại nhiều lần an toàn: tạo bảng nếu chưa có, chỉ chèn checkpoint / cài đặt còn thiếu
(không ghi đè nội dung đã sửa trong CMS).
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = json.loads((ROOT / 'team-map' / 'seed-journey.json').read_text(encoding='utf-8'))
IDS = ['start', 'figma', 'ui', 'ux', 'ds', 'ai', 'pdm', 'web', 'code', 'finish']

def q(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"
def j(v): return q(json.dumps(v, ensure_ascii=False)) + '::jsonb'

cps = SEED['checkpoints']
role_rows = ',\n'.join('  (' + ', '.join([q(c['id']), q(c.get('role_summary')), j(c.get('role_skills') or []), q(c.get('role_link')), q(c.get('course_image_url'))]) + ')' for c in cps)
assert sorted(c['id'] for c in cps) == sorted(IDS), 'seed phải có đúng 10 checkpoint'
rows = ',\n'.join('  (' + ', '.join([q(c['id']), q(c['kind']), q(c['sort_order']), q(c.get('branch_after')), q(c['name']), q(c.get('course_title')),
    q(c.get('course_url')), q(c.get('sessions')), q(c['form_title']), q(c.get('form_description') or ''), j(c.get('form_props') or []), q(bool(c.get('is_milestone'))),
    q(c.get('description') or ''), j(c.get('knowledge') or []), q(c.get('outcome')), q(bool(c.get('require_challenge'))), j(c.get('challenge_term_ids') or []),
    q(c.get('is_active', True))]) + ')' for c in cps)

SEO_TITLE = 'Lộ trình học UI/UX Designer và Product Designer | TELOS Academy'
SEO_DESC = ('Lộ trình từ con số 0 tới Product Designer tại TELOS Academy: Figma, UI, UX, Design System, A.I. và Product Design & Manage, '
            'cùng hai nhánh Web Design và Code for Designer. Chơi thử dạng game 3D hoặc đọc từng chặng.')
INTRO = ('Sáu trạm chính và hai nhánh tuỳ chọn, mỗi trạm là một khoá học tại TELOS Academy. Đi qua trạm nào, bạn biết mình sẽ học gì, '
         'học xong làm được gì, và lên đời thành phiên bản nào của một designer.')

sql = f"""-- ════════════════════════════════════════════════════════════════════
-- Trang Hành trình UI/UX (/hanh-trinh-ui-ux) — docs/SPEC-journey.md
-- File này sinh từ team-map/seed-journey.json bằng scripts/gen_team_map_journey_seed.py.
-- Chạy lại nhiều lần an toàn: chỉ chèn dòng còn thiếu, không ghi đè nội dung đã sửa trong CMS.
-- ════════════════════════════════════════════════════════════════════

create table if not exists tm_journey_checkpoints (
  id                 text primary key check (id in ({', '.join(q(i) for i in IDS)})),
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
{rows}
on conflict (id) do nothing;

-- nội dung bảng Vai trò + ảnh khoá học: chỉ điền ô còn trống (không ghi đè bản đã sửa trong CMS)
update tm_journey_checkpoints c set
  role_summary     = coalesce(c.role_summary, v.role_summary),
  role_skills      = case when c.role_skills is null or c.role_skills = '[]'::jsonb then v.role_skills else c.role_skills end,
  role_link        = coalesce(c.role_link, v.role_link),
  course_image_url = coalesce(c.course_image_url, v.course_image_url)
from (values
{role_rows}
) as v(id, role_summary, role_skills, role_link, course_image_url)
where c.id = v.id;

-- bản 3: tên nhánh bỏ chữ "Rẽ trái: / Rẽ phải:" (chỉ đổi khi vẫn còn tên cũ, tên đã sửa trong CMS giữ nguyên)
update tm_journey_checkpoints set name = 'Làm web' where id = 'web' and name = 'Rẽ trái: làm web';
update tm_journey_checkpoints set name = 'Biết code' where id = 'code' and name = 'Rẽ phải: biết code';

insert into tm_journey_settings (id, seo_title, seo_description, intro_text, workplaces)
values (1, {q(SEO_TITLE)}, {q(SEO_DESC)}, {q(INTRO)}, {j(SEED['workplaces'])})
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
"""
(ROOT / 'supabase_team_map_journey.sql').write_text(sql, encoding='utf-8')
print('wrote supabase_team_map_journey.sql:', len(cps), 'checkpoints')
