-- ════════════════════════════════════════════════════════
-- TEAM MAP — nâng cấp sang chơi tự do (chạy MỘT LẦN trên DB đang chạy, sau khi đã chạy supabase_team_map.sql bản mới)
-- · mỗi 30 phút mở 4 hành động vui (Đọc bài, Lật flashcard luôn mở), lần thắng nào cũng tính
-- · game Ném pop-task dễ hơn (thêm tờ, tầm trúng rộng, nhân vật đi chậm và hay đứng lại, có hỗ trợ nhắm)
-- Không đụng tới các nội dung khác đã sửa trong CMS.
-- ════════════════════════════════════════════════════════
begin;
alter table tm_hourly_config add column if not exists open_count int not null default 4;
update tm_hourly_config set slot_minutes = 30, open_count = 4 where id = 1;
update tm_hourly_actions set config = config || '{"ammo": 10, "hits_needed": 3, "flight_secs": 0.35, "hit_radius": 1.0, "max_range": 8, "target_speed_factor": 0.7, "pause_secs": 1.2, "aim_assist": 2.0}'::jsonb where id = 'poptask';
commit;
select slot_minutes, open_count, (select config from tm_hourly_actions where id = 'poptask') as poptask from tm_hourly_config;
