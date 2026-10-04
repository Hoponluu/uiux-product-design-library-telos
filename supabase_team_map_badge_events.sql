-- ════════════════════════════════════════════════════════
-- TEAM MAP — cho phép điều kiện huy hiệu "Hành động đặc biệt" (condition_type = 'event')
-- params.event: 'chain_course' (xong một chuỗi quest rồi bấm "Khám phá khoá học TELOS")
--               'author_link'  (bấm vào trang cá nhân của Nhân Lưu trong bảng của ổng)
-- Chạy một lần trên DB đang chạy. Chạy lại supabase_team_map.sql bản mới cũng có cùng tác dụng.
-- ════════════════════════════════════════════════════════
alter table tm_badges drop constraint if exists tm_badges_condition_type_check;
alter table tm_badges add constraint tm_badges_condition_type_check
  check (condition_type in ('wins','distinct_characters','flawless_wins','win_streak','win_under_secs','win_vs','fail_count','all_actions','event'));
