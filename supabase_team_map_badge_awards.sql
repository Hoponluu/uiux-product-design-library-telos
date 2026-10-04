-- ════════════════════════════════════════════════════════
-- 5. MÃ HUY HIỆU (dùng khi đổi quà)
-- Mỗi lần người chơi đạt một huy hiệu (từ award_start) được server cấp một mã duy nhất, ví dụ TL-000123-K7QF,
-- và lưu vào tm_badge_awards. 000123 = số thứ tự; K7QF = 4 ký tự kiểm tra tính bằng HMAC với khoá bí mật chỉ server biết,
-- nên không ai tự bịa ra được một mã đúng. Không cần đăng nhập, không giới hạn.
-- File nâng cấp cho DB đang chạy (cùng nội dung với phần 5 trong supabase_team_map.sql). Chạy lại an toàn.
-- ════════════════════════════════════════════════════════
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table tm_hourly_config add column if not exists award_start timestamptz not null default '2026-10-05 00:00:00+07';

-- khoá bí mật của server: bật RLS, không có policy nào → không ai đọc được qua API, chỉ hàm security definer bên dưới dùng
create table if not exists tm_private (
  id     int primary key default 1 check (id = 1),
  secret bytea not null default extensions.gen_random_bytes(32)
);
insert into tm_private (id) values (1) on conflict do nothing;
alter table tm_private enable row level security;
revoke all on tm_private from anon, authenticated;

create table if not exists tm_badge_awards (
  serial     bigint generated always as identity primary key,
  code       text not null unique,
  badge_id   text not null references tm_badges(id) on update cascade,
  request_id uuid not null unique,          -- trình duyệt gửi kèm: gửi lại (mất mạng) thì nhận lại đúng mã cũ, không sinh trùng
  lang       text,
  scale      text,
  status     text not null default 'valid' check (status in ('valid','redeemed','void')),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tm_badge_awards_created on tm_badge_awards (created_at desc);

drop trigger if exists tm_touch on tm_badge_awards;
create trigger tm_touch before update on tm_badge_awards for each row execute function tm_touch();

-- chỉ admin xem / đổi trạng thái; người chơi đi qua 2 hàm bên dưới
alter table tm_badge_awards enable row level security;
drop policy if exists "admin read awards" on tm_badge_awards;
drop policy if exists "admin update awards" on tm_badge_awards;
create policy "admin read awards"   on tm_badge_awards for select to authenticated using (is_admin());
create policy "admin update awards" on tm_badge_awards for update to authenticated using (is_admin()) with check (is_admin());
revoke all on tm_badge_awards from anon;
grant select, update on tm_badge_awards to authenticated;

-- mã hiển thị từ số thứ tự + khoá bí mật
create or replace function tm_award_code(p_serial bigint) returns text
language sql stable security definer set search_path = public as $$
  select 'TL-' || lpad(p_serial::text, 6, '0') || '-' ||
         upper(substr(encode(extensions.hmac(convert_to(p_serial::text, 'UTF8'), (select secret from tm_private where id = 1), 'sha256'), 'hex'), 1, 4));
$$;
revoke all on function tm_award_code(bigint) from public, anon, authenticated;

-- Cấp mã khi người chơi đạt huy hiệu. Trả về { ok, code, created_at, status } hoặc { ok:false, reason: not_started | unknown_badge | bad_request }
create or replace function tm_award_badge(p_badge text, p_request uuid, p_meta jsonb default '{}'::jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare cfg tm_hourly_config; r tm_badge_awards;
begin
  select * into cfg from tm_hourly_config where id = 1;
  if cfg.award_start is null or now() < cfg.award_start then
    return json_build_object('ok', false, 'reason', 'not_started', 'start', cfg.award_start); end if;
  if p_request is null then return json_build_object('ok', false, 'reason', 'bad_request'); end if;
  select * into r from tm_badge_awards where request_id = p_request;
  if found then return json_build_object('ok', true, 'code', r.code, 'created_at', r.created_at, 'status', r.status); end if;
  if not exists (select 1 from tm_badges where id = p_badge and is_active) then
    return json_build_object('ok', false, 'reason', 'unknown_badge'); end if;
  begin
    insert into tm_badge_awards (code, badge_id, request_id, lang, scale)
    values ('pending-' || p_request, p_badge, p_request, left(p_meta ->> 'lang', 5), left(p_meta ->> 'scale', 20))
    returning * into r;
  exception when unique_violation then   -- hai request trùng gửi cùng lúc
    select * into r from tm_badge_awards where request_id = p_request;
    return json_build_object('ok', true, 'code', r.code, 'created_at', r.created_at, 'status', r.status);
  end;
  update tm_badge_awards set code = tm_award_code(r.serial) where serial = r.serial returning * into r;
  return json_build_object('ok', true, 'code', r.code, 'created_at', r.created_at, 'status', r.status);
end $$;
revoke all on function tm_award_badge(text, uuid, jsonb) from public;
grant execute on function tm_award_badge(text, uuid, jsonb) to anon, authenticated;

-- Tra một mã: có thật không, của huy hiệu nào, ngày nào, trạng thái (đã đổi quà / huỷ chưa).
create or replace function tm_verify_award(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare r tm_badge_awards;
begin
  select * into r from tm_badge_awards where code = upper(trim(p_code));
  if not found then return json_build_object('ok', false, 'reason', 'not_found', 'checked_at', now()); end if;
  return json_build_object('ok', true, 'code', r.code, 'badge_id', r.badge_id, 'created_at', r.created_at, 'status', r.status, 'checked_at', now());
end $$;
revoke all on function tm_verify_award(text) from public;
grant execute on function tm_verify_award(text) to anon, authenticated;

notify pgrst, 'reload schema';
