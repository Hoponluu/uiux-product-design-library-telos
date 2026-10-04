-- ════════════════════════════════════════════════════════
-- TEAM MAP — migration
-- Chạy file này một lần trong Supabase → SQL Editor, TRƯỚC file supabase_team_map_seed.sql.
-- Chạy lại nhiều lần không sao (mọi lệnh đều idempotent).
--
-- Nội dung:
--   0. Quyền admin bằng Supabase Auth (thay cho service_role key trong adminCMS.html)
--   1. Năm bảng tm_*  (nhân vật, phòng ban, vị trí, nhiệm vụ, bước nhiệm vụ)
--   2. Trigger kiểm tra ràng buộc + tự cập nhật tham chiếu khi đổi phòng
--   3. RLS: anon chỉ đọc, admin mới được ghi
--   4. RPC: lưu nhân vật, lưu nhiệm vụ, đổi phòng, import Excel (mỗi hàm là một transaction)
--
-- Đã chạy bản trước? Chạy lại toàn bộ file này là đủ: mục 1.6 tự nâng cấp bảng cũ
-- (thêm quy mô "agency", cột reports_to_agency, cờ fixed cho vị trí ngồi).
-- ════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════
-- 0. ADMIN — Supabase Auth + danh sách email được phép ghi
-- ════════════════════════════════════════════════════════
-- Sau khi chạy file này:
--   a) Supabase → Authentication → Users → "Add user" (email + mật khẩu) cho từng admin.
--   b) Thêm email đó vào bảng admin_users (sửa dòng insert bên dưới rồi chạy lại).
--   c) Supabase → Authentication → Sign In / Providers: tắt "Allow new users to sign up".
--   d) Đổi (rotate) service_role key cũ vì key này đã từng nằm công khai trong adminCMS.html.

create table if not exists admin_users (
  email      text primary key,
  created_at timestamptz not null default now()
);
alter table admin_users enable row level security;   -- không có policy: client không đọc/ghi được bảng này

-- insert into admin_users (email) values ('ten-ban@example.com') on conflict do nothing;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Thư viện thuật ngữ: giữ quyền đọc công khai, thêm quyền ghi cho admin
drop policy if exists "admin write categories" on categories;
drop policy if exists "admin write concepts"   on concepts;
create policy "admin write categories" on categories for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write concepts"   on concepts   for all to authenticated using (is_admin()) with check (is_admin());


-- ════════════════════════════════════════════════════════
-- 1. BẢNG
-- ════════════════════════════════════════════════════════

-- 1.1 Phòng ban (chỉ nội dung; hình học nằm trong team-map/team-map.layout.js)
create table if not exists tm_rooms (
  id         text primary key,
  scale      text not null check (scale in ('small','large','agency')),
  code       text not null default '',
  name       text not null,
  intro      text,
  sort_order int  not null default 0,
  updated_at timestamptz not null default now()
);

-- 1.2 Nhân vật
create table if not exists tm_characters (
  id               text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  title            text not null,
  kind             text not null default 'role' check (kind in ('role','player','author','guest')),
  "group"          text not null check ("group" in ('design','product','engineering','data','delivery','business')),
  article_url      text,
  summary          text,
  doing            text,
  with_designer    text,
  reports_to       text references tm_characters(id) on delete set null,
  reports_to_small text references tm_characters(id) on delete set null,
  props            jsonb not null default '[]'::jsonb,
  appearance       jsonb not null default '{"dark":false,"outfit":null}'::jsonb,
  tag              text,
  cta              jsonb,
  is_active        boolean not null default true,
  updated_at       timestamptz not null default now()
);
create unique index if not exists tm_characters_one_player on tm_characters (kind) where kind = 'player';

-- term_id: cùng kiểu với concepts.id (uuid hay bigint đều được), tự dò kiểu lúc chạy
do $$
declare t text;
begin
  if not exists (select 1 from information_schema.columns where table_name = 'tm_characters' and column_name = 'term_id') then
    select format_type(a.atttypid, a.atttypmod) into t
    from pg_attribute a where a.attrelid = 'concepts'::regclass and a.attname = 'id';
    execute format('alter table tm_characters add column term_id %s references concepts(id) on delete set null', t);
  end if;
end $$;

-- 1.3 Vị trí ngồi. id = "<character_id>@<room_id>" — đây là "mã vị trí" mà nhiệm vụ tham chiếu.
create table if not exists tm_placements (
  id           text primary key,
  character_id text not null references tm_characters(id) on delete cascade,
  scale        text not null check (scale in ('small','large','agency')),
  room_id      text not null references tm_rooms(id),
  seat_order   int,
  unique (character_id, room_id),
  check (id = character_id || '@' || room_id)
);

-- 1.4 Nhiệm vụ
create table if not exists tm_quests (
  id         text primary key,
  type       text not null default 'main' check (type in ('main','daily')),
  scale      text not null check (scale in ('small','large','agency')),
  sort_order int  not null default 0,
  title      text not null,
  room_id    text not null references tm_rooms(id),
  giver      text,
  gather     jsonb not null default '[]'::jsonb,
  offer_text text,
  done_text  text,
  rewards    jsonb not null default '[]'::jsonb,
  is_active  boolean not null default true,
  daily_date date,
  updated_at timestamptz not null default now()
);

-- 1.5 Bước nhiệm vụ
create table if not exists tm_quest_steps (
  id         text primary key,
  quest_id   text not null references tm_quests(id) on delete cascade,
  sort_order int  not null default 0,
  type       text not null check (type in ('talk','work','present')),
  target     text,
  task_text  text not null,
  line_text  text,
  secs       numeric
);
create index if not exists tm_quest_steps_quest on tm_quest_steps (quest_id, sort_order);


-- 1.6 Nâng cấp cho DB đã chạy bản trước: quy mô Agency / Outsource
do $$
declare t text; c text;
begin
  foreach t in array array['tm_rooms','tm_placements','tm_quests'] loop
    for c in select conname from pg_constraint
             where conrelid = t::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%scale%' loop
      execute format('alter table %I drop constraint %I', t, c);
    end loop;
    execute format('alter table %I add constraint %I check (scale in (''small'',''large'',''agency''))', t, t || '_scale_check');
  end loop;
end $$;
-- báo cáo cho ai ở quy mô agency (giống reports_to_small)
alter table tm_characters add column if not exists reports_to_agency text references tm_characters(id) on delete set null;
-- nhân vật ngồi cố định (không đi dạo, không tới điểm tập hợp), vd Client ở phòng họp
alter table tm_placements add column if not exists fixed boolean not null default false;

-- 1.7 Bản tiếng Anh (/en/team-map): nội dung dịch nằm trong cột i18n, dạng {"en": {"<tên cột>": "..."}}.
-- Ô nào chưa có bản tiếng Anh thì trang EN hiện tiếng Việt.
--   tm_characters: title, summary, doing, with_designer, tag, cta (mảng nhãn nút)
--   tm_rooms: code, name, intro · tm_quests: title, offer_text, done_text · tm_quest_steps: task_text, line_text
alter table tm_characters  add column if not exists i18n jsonb not null default '{}'::jsonb;
alter table tm_rooms       add column if not exists i18n jsonb not null default '{}'::jsonb;
alter table tm_quests      add column if not exists i18n jsonb not null default '{}'::jsonb;
alter table tm_quest_steps add column if not exists i18n jsonb not null default '{}'::jsonb;

-- 1.8 Nhiệm vụ theo giờ của Nhân Lưu (SPEC-hourly): cột thêm cho nhân vật + 5 bảng mới.
--   rank: cấp bậc 1–8 (trống = 2) · related_term_ids: thuật ngữ cho flashcard
--   gossip_partner_ids: người nấu xói cùng (trống = tự tính) · hourly_exclude: hành động không ghép với nhân vật này
alter table tm_characters add column if not exists rank int;
alter table tm_characters add column if not exists related_term_ids jsonb not null default '[]'::jsonb;
alter table tm_characters add column if not exists gossip_partner_ids jsonb;
alter table tm_characters add column if not exists hourly_exclude jsonb not null default '[]'::jsonb;
alter table tm_characters drop constraint if exists tm_characters_rank_check;
alter table tm_characters add constraint tm_characters_rank_check check (rank between 1 and 8);

-- một dòng duy nhất (id = 1)
create table if not exists tm_hourly_config (
  id                    int primary key default 1 check (id = 1),
  slot_minutes          int not null default 60 check (slot_minutes between 5 and 1440),
  no_repeat_slots       int not null default 3 check (no_repeat_slots between 0 and 24),
  counted_wins_per_slot int not null default 1 check (counted_wins_per_slot between 0 and 100),
  is_enabled            boolean not null default true,
  updated_at            timestamptz not null default now()
);
insert into tm_hourly_config (id) values (1) on conflict do nothing;
-- chơi tự do: mỗi lượt mở open_count hành động vui (Đọc bài, Lật flashcard luôn mở). no_repeat_slots, counted_wins_per_slot không còn dùng.
alter table tm_hourly_config add column if not exists open_count int not null default 4;
alter table tm_hourly_config drop constraint if exists tm_hourly_config_open_count_check;
alter table tm_hourly_config add constraint tm_hourly_config_open_count_check check (open_count between 0 and 6);

-- 8 hành động, mã cố định trong code (mỗi mã là một mini-game). CMS chỉ sửa nội dung, không thêm / xoá dòng.
create table if not exists tm_hourly_actions (
  id             text primary key check (id in ('read','fight','poptask','flashcard','coffee','hide','race','gossip')),
  sort_order     int  not null default 0,
  name           text not null,
  title_template text not null,
  offer_text     text,
  win_text       text,
  lose_text      text,
  weight         int  not null default 1 check (weight >= 1),
  config         jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  i18n           jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);

-- lời thoại trong mini-game. character_id trống = câu dùng chung; gossip/say: character_id = người bị nấu xói
create table if not exists tm_hourly_lines (
  id           text primary key,
  action_id    text not null references tm_hourly_actions(id) on delete cascade,
  kind         text not null check (kind in ('task','react','start','spill','thanks','hint','found','say','caught')),
  character_id text references tm_characters(id) on delete cascade,
  text         text not null,
  is_active    boolean not null default true,
  i18n         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create table if not exists tm_quiz_questions (
  id            text primary key,
  character_id  text not null references tm_characters(id) on delete cascade,
  question      text not null,
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 3),
  correct_index int  not null check (correct_index between 0 and 2),
  is_active     boolean not null default true,
  i18n          jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

create table if not exists tm_badges (
  id             text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  sort_order     int  not null default 0,
  name           text not null,
  description    text,
  image_url      text,
  rim_color      text not null default '#FFC53D' check (rim_color ~ '^#[0-9A-Fa-f]{6}$'),
  condition_type text not null check (condition_type in ('wins','distinct_characters','flawless_wins','win_streak','win_under_secs','win_vs','fail_count','all_actions','event')),
  action_id      text references tm_hourly_actions(id),
  threshold      int,
  params         jsonb not null default '{}'::jsonb,
  is_hidden      boolean not null default true,
  is_active      boolean not null default true,
  -- chừa sẵn cho luồng đổi quà (chưa làm)
  reward_title   text,
  reward_note    text,
  reward_url     text,
  reward_status  text not null default 'none' check (reward_status in ('none','coming','open')),
  i18n           jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);
-- 'event' = hành động đặc biệt ngoài mini-game (params.event: chain_course, author_link). Bảng đã có thì nâng cấp ràng buộc.
alter table tm_badges drop constraint if exists tm_badges_condition_type_check;
alter table tm_badges add constraint tm_badges_condition_type_check check (condition_type in ('wins','distinct_characters','flawless_wins','win_streak','win_under_secs','win_vs','fail_count','all_actions','event'));


-- ════════════════════════════════════════════════════════
-- 2. TRIGGER
-- ════════════════════════════════════════════════════════

-- 2.1 updated_at
create or replace function tm_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists tm_rooms_touch on tm_rooms;
create trigger tm_rooms_touch before update on tm_rooms for each row execute function tm_touch();
drop trigger if exists tm_characters_touch on tm_characters;
create trigger tm_characters_touch before update on tm_characters for each row execute function tm_touch();
drop trigger if exists tm_quests_touch on tm_quests;
create trigger tm_quests_touch before update on tm_quests for each row execute function tm_touch();
do $$
declare t text;
begin
  foreach t in array array['tm_hourly_config','tm_hourly_actions','tm_hourly_lines','tm_quiz_questions','tm_badges'] loop
    execute format('drop trigger if exists %I on %I', t || '_touch', t);
    execute format('create trigger %I before update on %I for each row execute function tm_touch()', t || '_touch', t);
  end loop;
end $$;

-- 2.2 Phòng có TV (khớp TV trong team-map.layout.js) — bước "present" chỉ hợp lệ ở các phòng này
create or replace function tm_tv_rooms() returns text[] language sql immutable as $$
  select array['P4','R01','R06','R08','A4'];
$$;

-- 2.3 Vị trí: scale luôn lấy theo phòng
create or replace function tm_placement_scale() returns trigger language plpgsql as $$
begin
  select scale into new.scale from tm_rooms where id = new.room_id;
  if new.scale is null then raise exception 'Phòng % không tồn tại', new.room_id; end if;
  return new;
end $$;
drop trigger if exists tm_placements_scale on tm_placements;
create trigger tm_placements_scale before insert or update of room_id on tm_placements
  for each row execute function tm_placement_scale();

-- 2.4 Đổi phòng (đổi id vị trí) → thay mã cũ bằng mã mới trong nhiệm vụ và bước nhiệm vụ
create or replace function tm_placement_rename_refs() returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id then
    update tm_quests set giver = new.id where giver = old.id;
    update tm_quests
      set gather = (select coalesce(jsonb_agg(case when g = old.id then new.id else g end order by n), '[]'::jsonb)
                    from jsonb_array_elements_text(gather) with ordinality as e(g, n))
      where gather ? old.id;
    update tm_quest_steps set target = new.id where target = old.id;
  end if;
  return new;
end $$;
drop trigger if exists tm_placements_rename on tm_placements;
create trigger tm_placements_rename after update of id on tm_placements
  for each row execute function tm_placement_rename_refs();

-- 2.5 Không xoá vị trí đang được nhiệm vụ dùng
create or replace function tm_placement_guard_delete() returns trigger language plpgsql as $$
declare q text;
begin
  select string_agg(distinct x.id, ', ') into q from (
    select id from tm_quests where giver = old.id or gather ? old.id
    union select quest_id from tm_quest_steps where target = old.id
  ) x;
  if q is not null then
    raise exception 'Vị trí % đang được nhiệm vụ dùng: %', old.id, q using errcode = '23503';
  end if;
  return old;
end $$;
drop trigger if exists tm_placements_guard on tm_placements;
create trigger tm_placements_guard before delete on tm_placements
  for each row execute function tm_placement_guard_delete();

-- 2.6 Không xoá nhân vật đang là thẻ thưởng của nhiệm vụ
create or replace function tm_character_guard_delete() returns trigger language plpgsql as $$
declare q text;
begin
  select string_agg(id, ', ') into q from tm_quests
  where rewards @> jsonb_build_array(jsonb_build_object('type','character','id',old.id));
  if q is not null then
    raise exception 'Nhân vật % đang là thẻ thưởng của nhiệm vụ: %', old.id, q using errcode = '23503';
  end if;
  return old;
end $$;
drop trigger if exists tm_characters_guard on tm_characters;
create trigger tm_characters_guard before delete on tm_characters
  for each row execute function tm_character_guard_delete();

-- 2.7 Nhiệm vụ: phòng tập hợp, người giao, người tham gia phải cùng quy mô
create or replace function tm_quest_check() returns trigger language plpgsql as $$
declare bad text;
begin
  if not exists (select 1 from tm_rooms where id = new.room_id and scale = new.scale) then
    raise exception 'Nhiệm vụ %: phòng tập hợp % không thuộc quy mô %', new.id, new.room_id, new.scale;
  end if;
  if new.giver is not null and not exists (select 1 from tm_placements where id = new.giver and scale = new.scale) then
    raise exception 'Nhiệm vụ %: người giao % không phải mã vị trí của quy mô %', new.id, new.giver, new.scale;
  end if;
  if jsonb_typeof(new.gather) <> 'array' then raise exception 'Nhiệm vụ %: gather phải là mảng', new.id; end if;
  select string_agg(g, ', ') into bad from jsonb_array_elements_text(new.gather) g
  where not exists (select 1 from tm_placements p where p.id = g and p.scale = new.scale);
  if bad is not null then
    raise exception 'Nhiệm vụ %: người tham gia không hợp lệ: %', new.id, bad;
  end if;
  return new;
end $$;
drop trigger if exists tm_quests_check on tm_quests;
create trigger tm_quests_check before insert or update on tm_quests
  for each row execute function tm_quest_check();

-- 2.8 Bước nhiệm vụ
create or replace function tm_step_check() returns trigger language plpgsql as $$
declare q tm_quests;
begin
  select * into q from tm_quests where id = new.quest_id;
  if new.type = 'talk' then
    if new.target is null or not exists (select 1 from tm_placements where id = new.target and scale = q.scale) then
      raise exception 'Bước %: bước "talk" cần người cần gặp là mã vị trí của quy mô %', new.id, q.scale;
    end if;
  else
    new.target := null;
  end if;
  if new.type = 'present' and not (q.room_id = any (tm_tv_rooms())) then
    raise exception 'Bước %: bước "present" chỉ dùng được ở phòng có TV (%)', new.id, array_to_string(tm_tv_rooms(), ', ');
  end if;
  return new;
end $$;
drop trigger if exists tm_steps_check on tm_quest_steps;
create trigger tm_steps_check before insert or update on tm_quest_steps
  for each row execute function tm_step_check();


-- ════════════════════════════════════════════════════════
-- 3. RLS
-- ════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['tm_rooms','tm_characters','tm_placements','tm_quests','tm_quest_steps',
                           'tm_hourly_config','tm_hourly_actions','tm_hourly_lines','tm_quiz_questions','tm_badges'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read %s" on %I', t, t);
    execute format('drop policy if exists "admin write %s" on %I', t, t);
    execute format('create policy "public read %s" on %I for select using (true)', t, t);
    execute format('create policy "admin write %s" on %I for all to authenticated using (is_admin()) with check (is_admin())', t, t);
  end loop;
end $$;


-- 3.1 Hình huy hiệu: bucket Storage đọc công khai, chỉ admin được ghi.
-- (Bỏ qua nếu DB không có schema storage, vd khi chạy thử ngoài Supabase.)
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('tm-badges', 'tm-badges', true, 1048576, array['image/png','image/webp','image/jpeg'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  execute 'drop policy if exists "tm badges public read" on storage.objects';
  execute 'drop policy if exists "tm badges admin write" on storage.objects';
  execute $p$create policy "tm badges public read" on storage.objects for select using (bucket_id = 'tm-badges')$p$;
  execute $p$create policy "tm badges admin write" on storage.objects for all to authenticated
             using (bucket_id = 'tm-badges' and is_admin()) with check (bucket_id = 'tm-badges' and is_admin())$p$;
end $$;


-- ════════════════════════════════════════════════════════
-- 4. RPC (security invoker: RLS ở trên vẫn áp dụng)
-- ════════════════════════════════════════════════════════

create or replace function tm_require_admin() returns void language plpgsql stable as $$
begin
  if not is_admin() then raise exception 'Không có quyền ghi (cần đăng nhập admin)' using errcode = '42501'; end if;
end $$;

-- 4.1 Đổi phòng / thứ tự ghế của một vị trí. Trả về mã vị trí mới.
create or replace function tm_move_placement(p_id text, p_room_id text, p_seat_order int default null)
returns text language plpgsql as $$
declare v tm_placements; new_id text;
begin
  perform tm_require_admin();
  select * into v from tm_placements where id = p_id;
  if v.id is null then raise exception 'Không tìm thấy vị trí %', p_id; end if;
  new_id := v.character_id || '@' || p_room_id;
  update tm_placements set id = new_id, room_id = p_room_id, seat_order = coalesce(p_seat_order, seat_order)
  where id = p_id;
  return new_id;
end $$;

-- 4.2 Lưu nhân vật + các vị trí của nhân vật trong một transaction.
-- p = { "character": {...đủ cột...}, "placements": [ { "id": <mã cũ|null>, "room_id": "...", "seat_order": n, "fixed": bool } ] }
create or replace function tm_save_character(p jsonb) returns jsonb language plpgsql as $$
declare
  c   tm_characters := jsonb_populate_record(null::tm_characters, p -> 'character');
  pl  jsonb;
  new_id text;
  keep text[] := array[]::text[];
begin
  perform tm_require_admin();
  insert into tm_characters (id, title, kind, "group", term_id, article_url, summary, doing, with_designer,
                             reports_to, reports_to_small, reports_to_agency, props, appearance, tag, cta, is_active, i18n,
                             rank, related_term_ids, gossip_partner_ids, hourly_exclude)
  values (c.id, c.title, coalesce(c.kind,'role'), c."group", c.term_id, c.article_url, c.summary, c.doing, c.with_designer,
          c.reports_to, c.reports_to_small, c.reports_to_agency, coalesce(c.props,'[]'::jsonb),
          coalesce(c.appearance,'{"dark":false,"outfit":null}'::jsonb), c.tag, c.cta, coalesce(c.is_active, true), coalesce(c.i18n,'{}'::jsonb),
          c.rank, coalesce(c.related_term_ids,'[]'::jsonb), c.gossip_partner_ids, coalesce(c.hourly_exclude,'[]'::jsonb))
  on conflict (id) do update set
    title = excluded.title, kind = excluded.kind, "group" = excluded."group", term_id = excluded.term_id,
    article_url = excluded.article_url, summary = excluded.summary, doing = excluded.doing,
    with_designer = excluded.with_designer, reports_to = excluded.reports_to,
    reports_to_small = excluded.reports_to_small, reports_to_agency = excluded.reports_to_agency, props = excluded.props, appearance = excluded.appearance,
    tag = excluded.tag, cta = excluded.cta, is_active = excluded.is_active,
    i18n = case when p -> 'character' ? 'i18n' then excluded.i18n else tm_characters.i18n end,
    -- nhiệm vụ theo giờ: client cũ không gửi các khoá này thì giữ nguyên
    rank               = case when p -> 'character' ? 'rank'               then excluded.rank               else tm_characters.rank end,
    related_term_ids   = case when p -> 'character' ? 'related_term_ids'   then excluded.related_term_ids   else tm_characters.related_term_ids end,
    gossip_partner_ids = case when p -> 'character' ? 'gossip_partner_ids' then excluded.gossip_partner_ids else tm_characters.gossip_partner_ids end,
    hourly_exclude     = case when p -> 'character' ? 'hourly_exclude'     then excluded.hourly_exclude     else tm_characters.hourly_exclude end;

  if p ? 'placements' then
    select coalesce(array_agg(x ->> 'id'), array[]::text[]) into keep
    from jsonb_array_elements(p -> 'placements') x where x ->> 'id' is not null;
    -- vị trí bị bỏ khỏi form → xoá (trigger chặn nếu nhiệm vụ đang dùng)
    delete from tm_placements where character_id = c.id and not (id = any (keep));
    for pl in select * from jsonb_array_elements(p -> 'placements') loop
      new_id := c.id || '@' || (pl ->> 'room_id');
      if pl ->> 'id' is not null then
        update tm_placements set id = new_id, room_id = pl ->> 'room_id', seat_order = (pl ->> 'seat_order')::int,
               fixed = coalesce((pl ->> 'fixed')::boolean, false)
        where id = pl ->> 'id';
      else
        insert into tm_placements (id, character_id, scale, room_id, seat_order, fixed)
        values (new_id, c.id, 'small', pl ->> 'room_id', (pl ->> 'seat_order')::int, coalesce((pl ->> 'fixed')::boolean, false));
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'character', (select to_jsonb(x) from tm_characters x where x.id = c.id),
    'placements', (select coalesce(jsonb_agg(to_jsonb(x) order by x.scale, x.room_id), '[]'::jsonb) from tm_placements x where x.character_id = c.id));
end $$;

-- 4.3 Lưu nhiệm vụ + toàn bộ bước. p = { "quest": {...}, "steps": [ {...}, ... ] }
create or replace function tm_save_quest(p jsonb) returns jsonb language plpgsql as $$
declare
  q tm_quests := jsonb_populate_record(null::tm_quests, p -> 'quest');
  keep text[];
begin
  perform tm_require_admin();
  insert into tm_quests (id, type, scale, sort_order, title, room_id, giver, gather, offer_text, done_text, rewards, is_active, daily_date, i18n)
  values (q.id, coalesce(q.type,'main'), q.scale, coalesce(q.sort_order,0), q.title, q.room_id, q.giver,
          coalesce(q.gather,'[]'::jsonb), q.offer_text, q.done_text, coalesce(q.rewards,'[]'::jsonb),
          coalesce(q.is_active,true), q.daily_date, coalesce(q.i18n,'{}'::jsonb))
  on conflict (id) do update set
    type = excluded.type, scale = excluded.scale, sort_order = excluded.sort_order, title = excluded.title,
    room_id = excluded.room_id, giver = excluded.giver, gather = excluded.gather, offer_text = excluded.offer_text,
    done_text = excluded.done_text, rewards = excluded.rewards, is_active = excluded.is_active, daily_date = excluded.daily_date,
    i18n = case when p -> 'quest' ? 'i18n' then excluded.i18n else tm_quests.i18n end;

  select coalesce(array_agg(s ->> 'id'), array[]::text[]) into keep from jsonb_array_elements(coalesce(p -> 'steps','[]'::jsonb)) s;
  delete from tm_quest_steps where quest_id = q.id and not (id = any (keep));
  -- bước không gửi kèm i18n (client cũ) thì giữ nguyên bản dịch đang có
  insert into tm_quest_steps (id, quest_id, sort_order, type, target, task_text, line_text, secs, i18n)
  select s.id, q.id, coalesce(s.sort_order,0), s.type, s.target, s.task_text, s.line_text, s.secs,
         coalesce(x -> 'i18n', (select o.i18n from tm_quest_steps o where o.id = s.id), '{}'::jsonb)
  from jsonb_array_elements(coalesce(p -> 'steps','[]'::jsonb)) x,
       lateral jsonb_populate_record(null::tm_quest_steps, x) s
  on conflict (id) do update set
    quest_id = excluded.quest_id, sort_order = excluded.sort_order, type = excluded.type, target = excluded.target,
    task_text = excluded.task_text, line_text = excluded.line_text, secs = excluded.secs, i18n = excluded.i18n;

  return jsonb_build_object(
    'quest', (select to_jsonb(x) from tm_quests x where x.id = q.id),
    'steps', (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order), '[]'::jsonb) from tm_quest_steps x where x.quest_id = q.id));
end $$;

-- 4.4 Đổi thứ tự (ghế hoặc nhiệm vụ). p = [ { "id": "...", "sort": n }, ... ]
create or replace function tm_reorder(p_table text, p jsonb) returns void language plpgsql as $$
begin
  perform tm_require_admin();
  if p_table = 'tm_placements' then
    update tm_placements t set seat_order = (x ->> 'sort')::int from jsonb_array_elements(p) x where t.id = x ->> 'id';
  elsif p_table = 'tm_quests' then
    update tm_quests t set sort_order = (x ->> 'sort')::int from jsonb_array_elements(p) x where t.id = x ->> 'id';
  elsif p_table = 'tm_badges' then
    update tm_badges t set sort_order = (x ->> 'sort')::int from jsonb_array_elements(p) x where t.id = x ->> 'id';
  else
    raise exception 'Bảng không hợp lệ: %', p_table;
  end if;
end $$;

-- 4.5 Import Excel: cập nhật theo id, thêm dòng mới, KHÔNG xoá. Toàn bộ trong một transaction.
-- p = { "characters": [...], "placements": [...], "rooms": [...], "quests": [...], "steps": [...] }
-- Mỗi dòng chỉ chứa các cột có trong file; cột vắng mặt (vd appearance) được giữ nguyên.
create or replace function tm_import(p jsonb) returns jsonb language plpgsql as $$
declare r jsonb; n jsonb := '{}'::jsonb; cnt int;
begin
  perform tm_require_admin();

  -- nhân vật: hai lượt (lượt 1 chưa gắn reports_to để cho phép trỏ tới nhân vật mới trong cùng file)
  for r in select * from jsonb_array_elements(coalesce(p -> 'characters','[]'::jsonb)) loop
    insert into tm_characters (id, title, kind, "group") values (r ->> 'id', r ->> 'title', coalesce(r ->> 'kind','role'), r ->> 'group')
    on conflict (id) do nothing;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p -> 'characters','[]'::jsonb)) loop
    update tm_characters set
      title            = case when r ? 'title'            then r ->> 'title'            else title end,
      kind             = case when r ? 'kind'             then r ->> 'kind'             else kind end,
      "group"          = case when r ? 'group'            then r ->> 'group'            else "group" end,
      term_id          = case when r ? 'term_id'          then (jsonb_populate_record(null::tm_characters, jsonb_build_object('term_id', r -> 'term_id'))).term_id else term_id end,
      article_url      = case when r ? 'article_url'      then r ->> 'article_url'      else article_url end,
      summary          = case when r ? 'summary'          then r ->> 'summary'          else summary end,
      doing            = case when r ? 'doing'            then r ->> 'doing'            else doing end,
      with_designer    = case when r ? 'with_designer'    then r ->> 'with_designer'    else with_designer end,
      reports_to       = case when r ? 'reports_to'       then r ->> 'reports_to'       else reports_to end,
      reports_to_small = case when r ? 'reports_to_small' then r ->> 'reports_to_small' else reports_to_small end,
      reports_to_agency = case when r ? 'reports_to_agency' then r ->> 'reports_to_agency' else reports_to_agency end,
      -- appearance_patch: chỉ đổi màu thân / viền, giữ các khoá khác (dark, outfit)
      appearance       = case when r ? 'appearance_patch'
                              then (appearance - 'body_color' - 'outline_color') || jsonb_strip_nulls(r -> 'appearance_patch')
                              else appearance end,
      props            = case when r ? 'props'            then coalesce(r -> 'props','[]'::jsonb) else props end,
      tag              = case when r ? 'tag'              then r ->> 'tag'              else tag end,
      cta              = case when r ? 'cta'              then nullif(r -> 'cta','null'::jsonb) else cta end,
      is_active        = case when r ? 'is_active'        then (r ->> 'is_active')::boolean else is_active end,
      rank             = case when r ? 'rank'             then (r ->> 'rank')::int else rank end,
      related_term_ids = case when r ? 'related_term_ids' then coalesce(r -> 'related_term_ids','[]'::jsonb) else related_term_ids end,
      gossip_partner_ids = case when r ? 'gossip_partner_ids' then nullif(r -> 'gossip_partner_ids','null'::jsonb) else gossip_partner_ids end,
      hourly_exclude   = case when r ? 'hourly_exclude'   then coalesce(r -> 'hourly_exclude','[]'::jsonb) else hourly_exclude end,
      -- i18n_en: chỉ các ô tiếng Anh có trong file; ô trống (null) = xoá bản dịch đó
      i18n             = case when r ? 'i18n_en' then jsonb_set(i18n, '{en}', jsonb_strip_nulls(coalesce(i18n -> 'en','{}'::jsonb) || (r -> 'i18n_en'))) else i18n end
    where id = r ->> 'id';
  end loop;
  n := n || jsonb_build_object('characters', jsonb_array_length(coalesce(p -> 'characters','[]'::jsonb)));

  for r in select * from jsonb_array_elements(coalesce(p -> 'placements','[]'::jsonb)) loop
    insert into tm_placements (id, character_id, scale, room_id, seat_order, fixed)
    values (r ->> 'character_id' || '@' || (r ->> 'room_id'), r ->> 'character_id', 'small', r ->> 'room_id', (r ->> 'seat_order')::int,
            coalesce((r ->> 'fixed')::boolean, false))
    on conflict (id) do update set seat_order = excluded.seat_order,
      fixed = case when r ? 'fixed' then excluded.fixed else tm_placements.fixed end;
  end loop;
  n := n || jsonb_build_object('placements', jsonb_array_length(coalesce(p -> 'placements','[]'::jsonb)));

  for r in select * from jsonb_array_elements(coalesce(p -> 'rooms','[]'::jsonb)) loop
    update tm_rooms set
      code       = case when r ? 'code'       then coalesce(r ->> 'code','') else code end,
      name       = case when r ? 'name'       then r ->> 'name'       else name end,
      intro      = case when r ? 'intro'      then r ->> 'intro'      else intro end,
      sort_order = case when r ? 'sort_order' then coalesce((r ->> 'sort_order')::int, 0) else sort_order end,
      i18n             = case when r ? 'i18n_en' then jsonb_set(i18n, '{en}', jsonb_strip_nulls(coalesce(i18n -> 'en','{}'::jsonb) || (r -> 'i18n_en'))) else i18n end
    where id = r ->> 'id';
    get diagnostics cnt = row_count;
    if cnt = 0 then raise exception 'Phòng % không tồn tại (import không tạo phòng mới)', r ->> 'id'; end if;
  end loop;
  n := n || jsonb_build_object('rooms', jsonb_array_length(coalesce(p -> 'rooms','[]'::jsonb)));

  for r in select * from jsonb_array_elements(coalesce(p -> 'quests','[]'::jsonb)) loop
    insert into tm_quests (id, type, scale, sort_order, title, room_id, giver, gather, offer_text, done_text, rewards, is_active, daily_date)
    values (r ->> 'id', coalesce(r ->> 'type','main'), r ->> 'scale', coalesce((r ->> 'sort_order')::int,0), r ->> 'title',
            r ->> 'room_id', r ->> 'giver', coalesce(r -> 'gather','[]'::jsonb), r ->> 'offer_text', r ->> 'done_text',
            coalesce(r -> 'rewards','[]'::jsonb), coalesce((r ->> 'is_active')::boolean, true), (r ->> 'daily_date')::date)
    on conflict (id) do update set
      type = excluded.type, scale = excluded.scale, sort_order = excluded.sort_order, title = excluded.title,
      room_id = excluded.room_id, giver = excluded.giver, gather = excluded.gather, offer_text = excluded.offer_text,
      done_text = excluded.done_text, rewards = excluded.rewards, is_active = excluded.is_active, daily_date = excluded.daily_date;
    if r ? 'i18n_en' then
      update tm_quests set i18n = jsonb_set(i18n, '{en}', jsonb_strip_nulls(coalesce(i18n -> 'en','{}'::jsonb) || (r -> 'i18n_en'))) where id = r ->> 'id';
    end if;
  end loop;
  n := n || jsonb_build_object('quests', jsonb_array_length(coalesce(p -> 'quests','[]'::jsonb)));

  for r in select * from jsonb_array_elements(coalesce(p -> 'steps','[]'::jsonb)) loop
    insert into tm_quest_steps (id, quest_id, sort_order, type, target, task_text, line_text, secs)
    values (r ->> 'id', r ->> 'quest_id', coalesce((r ->> 'sort_order')::int,0), r ->> 'type', r ->> 'target',
            r ->> 'task_text', r ->> 'line_text', (r ->> 'secs')::numeric)
    on conflict (id) do update set
      quest_id = excluded.quest_id, sort_order = excluded.sort_order, type = excluded.type, target = excluded.target,
      task_text = excluded.task_text, line_text = excluded.line_text, secs = excluded.secs;
    if r ? 'i18n_en' then
      update tm_quest_steps set i18n = jsonb_set(i18n, '{en}', jsonb_strip_nulls(coalesce(i18n -> 'en','{}'::jsonb) || (r -> 'i18n_en'))) where id = r ->> 'id';
    end if;
  end loop;
  n := n || jsonb_build_object('steps', jsonb_array_length(coalesce(p -> 'steps','[]'::jsonb)));

  -- nhiệm vụ theo giờ: hành động chỉ cập nhật 8 id có sẵn; câu hỏi, lời thoại, huy hiệu upsert theo id
  for r in select * from jsonb_array_elements(coalesce(p -> 'hourly_actions','[]'::jsonb)) loop
    update tm_hourly_actions set
      name           = case when r ? 'name'           then r ->> 'name'           else name end,
      title_template = case when r ? 'title_template' then r ->> 'title_template' else title_template end,
      offer_text     = case when r ? 'offer_text'     then r ->> 'offer_text'     else offer_text end,
      win_text       = case when r ? 'win_text'       then r ->> 'win_text'       else win_text end,
      lose_text      = case when r ? 'lose_text'      then r ->> 'lose_text'      else lose_text end,
      weight         = case when r ? 'weight'         then (r ->> 'weight')::int  else weight end,
      config         = case when r ? 'config'         then r -> 'config'          else config end,
      is_active      = case when r ? 'is_active'      then (r ->> 'is_active')::boolean else is_active end,
      i18n           = case when r ? 'i18n_en' then jsonb_set(i18n, '{en}', jsonb_strip_nulls(coalesce(i18n -> 'en','{}'::jsonb) || (r -> 'i18n_en'))) else i18n end
    where id = r ->> 'id';
    get diagnostics cnt = row_count;
    if cnt = 0 then raise exception 'Hành động % không tồn tại (chỉ có 8 hành động cố định)', r ->> 'id'; end if;
  end loop;
  n := n || jsonb_build_object('hourly_actions', jsonb_array_length(coalesce(p -> 'hourly_actions','[]'::jsonb)));

  for r in select * from jsonb_array_elements(coalesce(p -> 'quiz','[]'::jsonb)) loop
    insert into tm_quiz_questions (id, character_id, question, options, correct_index, is_active)
    values (r ->> 'id', r ->> 'character_id', r ->> 'question', r -> 'options', (r ->> 'correct_index')::int, coalesce((r ->> 'is_active')::boolean, true))
    on conflict (id) do update set character_id = excluded.character_id, question = excluded.question, options = excluded.options,
      correct_index = excluded.correct_index, is_active = excluded.is_active;
    if r ? 'i18n_en' then
      update tm_quiz_questions set i18n = jsonb_set(i18n, '{en}', jsonb_strip_nulls(coalesce(i18n -> 'en','{}'::jsonb) || (r -> 'i18n_en'))) where id = r ->> 'id';
    end if;
  end loop;
  n := n || jsonb_build_object('quiz', jsonb_array_length(coalesce(p -> 'quiz','[]'::jsonb)));

  for r in select * from jsonb_array_elements(coalesce(p -> 'lines','[]'::jsonb)) loop
    insert into tm_hourly_lines (id, action_id, kind, character_id, text, is_active)
    values (r ->> 'id', r ->> 'action_id', r ->> 'kind', r ->> 'character_id', r ->> 'text', coalesce((r ->> 'is_active')::boolean, true))
    on conflict (id) do update set action_id = excluded.action_id, kind = excluded.kind, character_id = excluded.character_id,
      text = excluded.text, is_active = excluded.is_active;
    if r ? 'i18n_en' then
      update tm_hourly_lines set i18n = jsonb_set(i18n, '{en}', jsonb_strip_nulls(coalesce(i18n -> 'en','{}'::jsonb) || (r -> 'i18n_en'))) where id = r ->> 'id';
    end if;
  end loop;
  n := n || jsonb_build_object('lines', jsonb_array_length(coalesce(p -> 'lines','[]'::jsonb)));

  for r in select * from jsonb_array_elements(coalesce(p -> 'badges','[]'::jsonb)) loop
    insert into tm_badges (id, sort_order, name, description, image_url, rim_color, condition_type, action_id, threshold, params,
                           is_hidden, is_active, reward_title, reward_note, reward_url, reward_status)
    values (r ->> 'id', coalesce((r ->> 'sort_order')::int, 0), r ->> 'name', r ->> 'description', r ->> 'image_url',
            coalesce(r ->> 'rim_color', '#FFC53D'), r ->> 'condition_type', r ->> 'action_id', (r ->> 'threshold')::int,
            coalesce(r -> 'params','{}'::jsonb), coalesce((r ->> 'is_hidden')::boolean, true), coalesce((r ->> 'is_active')::boolean, true),
            r ->> 'reward_title', r ->> 'reward_note', r ->> 'reward_url', coalesce(r ->> 'reward_status', 'none'))
    on conflict (id) do update set sort_order = excluded.sort_order, name = excluded.name, description = excluded.description,
      image_url = excluded.image_url, rim_color = excluded.rim_color, condition_type = excluded.condition_type, action_id = excluded.action_id,
      threshold = excluded.threshold, params = excluded.params, is_hidden = excluded.is_hidden, is_active = excluded.is_active,
      reward_title = excluded.reward_title, reward_note = excluded.reward_note, reward_url = excluded.reward_url, reward_status = excluded.reward_status;
    if r ? 'i18n_en' then
      update tm_badges set i18n = jsonb_set(i18n, '{en}', jsonb_strip_nulls(coalesce(i18n -> 'en','{}'::jsonb) || (r -> 'i18n_en'))) where id = r ->> 'id';
    end if;
  end loop;
  n := n || jsonb_build_object('badges', jsonb_array_length(coalesce(p -> 'badges','[]'::jsonb)));

  return n;
end $$;

notify pgrst, 'reload schema';
