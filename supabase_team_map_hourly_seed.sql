-- ════════════════════════════════════════════════════════
-- TEAM MAP — seed nhiệm vụ theo giờ (sinh tự động bởi scripts/gen_team_map_hourly_seed.py, đừng sửa tay)
-- Chạy sau supabase_team_map.sql. Upsert theo id: chạy lại không tạo trùng, nhưng ghi đè các dòng đã sửa trong CMS.
-- ════════════════════════════════════════════════════════
begin;

-- 1. Cấu hình (một dòng)
insert into tm_hourly_config (id, slot_minutes, no_repeat_slots, counted_wins_per_slot, open_count) values (1, 30, 3, 1, 4)
on conflict (id) do update set slot_minutes = excluded.slot_minutes, open_count = excluded.open_count;

-- 2. Cấp bậc: chỉ ghi cho nhân vật chưa có cấp (id không tồn tại thì bỏ qua, xem báo cáo cuối file)
--    (Không dùng bảng tạm: SQL Editor của Supabase không giữ bảng tạm giữa các câu lệnh.)
update tm_characters c set rank = r.rank from (values
  ('intern', 1),
  ('product-designer', 2),
  ('ui-designer', 2),
  ('ux-designer', 2),
  ('ds-designer', 2),
  ('ux-design-engineer', 2),
  ('ux-researcher', 2),
  ('ux-writer', 2),
  ('motion-designer', 2),
  ('frontend-developer', 2),
  ('backend-developer', 2),
  ('fullstack-developer', 2),
  ('mobile-developer', 2),
  ('qa-engineer', 2),
  ('devops', 2),
  ('data-analyst', 2),
  ('bi-analyst', 2),
  ('data-scientist', 2),
  ('data-engineer', 2),
  ('performance-marketer', 2),
  ('content-marketer', 2),
  ('seo-specialist', 2),
  ('customer-support', 2),
  ('business-analyst', 2),
  ('graphic-designer', 2),
  ('sales', 2),
  ('freelancer', 2),
  ('tech-lead', 3),
  ('software-architect', 3),
  ('scrum-master', 3),
  ('product-owner', 3),
  ('product-manager', 3),
  ('growth-pm', 3),
  ('data-pm', 3),
  ('project-manager', 3),
  ('account-manager', 3),
  ('crm-manager', 3),
  ('csm', 3),
  ('design-manager', 4),
  ('delivery-manager', 4),
  ('growth-manager', 4),
  ('brand-manager', 4),
  ('head-of-design', 5),
  ('head-of-data', 5),
  ('head-of-eng', 5),
  ('design-director', 5),
  ('ceo', 6),
  ('cpo', 6),
  ('cto', 6),
  ('stakeholder', 6),
  ('client', 7),
  ('user', 8)
) as r(id, rank)
where c.id = r.id and c.rank is null;

-- 3. Hành động
insert into tm_hourly_actions (id, sort_order, name, title_template, offer_text, win_text, lose_text, weight, config, is_active, i18n) values
  ('read', 1, 'Đọc bài và trả lời', 'Đọc bài về {target} rồi trả lời một câu hỏi', 'Giờ này đọc sách đi con. Qua đọc bài về {target}, rồi để người ta hỏi lại một câu coi có hiểu không.', 'Đọc thiệt hả? Tui tưởng lướt cho có thôi chứ.', 'Sai rồi. Đọc lại đi, bài có dài lắm đâu.', 1, '{"options": 3, "retry_wait_secs": 10}'::jsonb, true, '{"en": {"name": "Read and answer", "title_template": "Read about {target}, then answer one question", "offer_text": "Reading time, kiddo. Go read the article about {target}, then let them quiz you to see if it stuck.", "win_text": "You actually read it? I thought you''d just skim it.", "lose_text": "Wrong. Read it again, it''s not that long."}}'::jsonb),
  ('fight', 2, 'Đánh nhau', 'Đánh nhau với {target}', 'Nghe nói bạn muốn đánh nhau với đồng nghiệp. Được, giờ này cho đánh {target}. Bấm thiệt nhanh vô, sếp càng to càng trâu đó.', 'Thắng rồi. Mai nhớ đi làm bình thường, đừng nhìn mặt người ta.', 'Thua rồi. Người ta ăn lương cao hơn thì khoẻ hơn, có gì lạ đâu.', 1, '{"duration_secs": 10, "start_percent": 50, "tap_gain": 2.5, "npc_base": 5, "npc_per_rank": 1.9, "max_taps_per_sec": 15}'::jsonb, true, '{"en": {"name": "Fight", "title_template": "Fight {target}", "offer_text": "I hear you want to fight a coworker. Fine, this hour you get to fight {target}. Tap as fast as you can, the bigger the boss the tougher they are.", "win_text": "You won. Come to work tomorrow like nothing happened, and don''t make eye contact.", "lose_text": "You lost. People on a bigger salary are stronger, nothing strange about that."}}'::jsonb),
  ('poptask', 3, 'Ném pop-task', 'Ném trúng {target} 3 pop-task', 'Bình thường người ta ném việc gấp vô mặt bạn. Giờ này đổi vai: ném trúng {target} 3 cái pop-task cho tui.', 'Ném việc cho người khác vui ha? Giờ hiểu cảm giác của sếp chưa.', 'Hết task để ném rồi. Hiếm khi nào công ty hết việc vậy lắm.', 1, '{"ammo": 10, "hits_needed": 3, "flight_secs": 0.35, "hit_radius": 1.0, "max_range": 8, "target_speed_factor": 0.7, "pause_secs": 1.2, "aim_assist": 2.0}'::jsonb, true, '{"en": {"name": "Throw pop-tasks", "title_template": "Hit {target} with 3 pop-tasks", "offer_text": "Normally people throw urgent tasks in your face. This hour we switch roles: hit {target} with 3 pop-tasks for me.", "win_text": "Fun dumping work on other people, huh? Now you know how the boss feels.", "lose_text": "Out of tasks to throw. The company rarely runs out of work like that."}}'::jsonb),
  ('flashcard', 4, 'Lật flashcard', 'Chơi flashcard thuật ngữ của {target}', '{target} hay nói mấy từ nghe sang lắm. Qua đó lật vài thẻ flashcard coi bạn hiểu được mấy từ.', 'Giỏi. Giờ họp bạn gật đầu là gật thiệt chứ không phải gật cho có nữa.', 'Chưa đủ điểm. Không sao, đi họp cứ gật đầu là được.', 1, '{"cards": 4, "pass_correct": 3, "min_terms": 4}'::jsonb, true, '{"en": {"name": "Flashcards", "title_template": "Play {target}''s jargon flashcards", "offer_text": "{target} loves fancy words. Go flip a few flashcards and see how many you actually understand.", "win_text": "Nice. Now when you nod in meetings, you actually mean it.", "lose_text": "Not enough points. Don''t worry, in meetings just keep nodding."}}'::jsonb),
  ('coffee', 5, 'Mang cà phê', 'Mang cà phê cho {target}', '{target} đang buồn ngủ. Ra Pantry lấy ly cà phê mang qua, đừng có đụng ai kẻo đổ.', 'Tới nơi còn nguyên ly. Kỹ năng này không có trong JD đâu nhưng quý lắm.', 'Đổ hết ba ly rồi. Thôi để người ta tự đi lấy.', 1, '{"secs_per_cup": 30, "max_cups": 3, "spill_radius": 0.7}'::jsonb, true, '{"en": {"name": "Bring coffee", "title_template": "Bring {target} a coffee", "offer_text": "{target} is falling asleep. Grab a coffee from the Pantry and bring it over, and don''t bump into anyone or it spills.", "win_text": "Arrived without a drop spilled. Not in the JD, but a precious skill.", "lose_text": "Three cups spilled. Let them get their own."}}'::jsonb),
  ('hide', 6, 'Trốn tìm', 'Tìm {target} đang trốn', '{target} trốn họp rồi. Bạn có 60 giây đi tìm. Hỏi mấy người xung quanh coi có ai thấy không.', 'Tìm ra rồi. Mời về họp tiếp.', 'Hết giờ. Người ta trốn giỏi hơn bạn tìm.', 1, '{"secs": 60, "countdown_secs": 3}'::jsonb, true, '{"en": {"name": "Hide and seek", "title_template": "Find {target}, who is hiding", "offer_text": "{target} skipped the meeting and went into hiding. You have 60 seconds to find them. Ask around to see if anyone spotted them.", "win_text": "Found them. Back to the meeting, please.", "lose_text": "Time''s up. They hide better than you seek."}}'::jsonb),
  ('race', 7, 'Chạy đua', 'Chạy đua với {target} tới Pantry', 'Pantry mới có bánh. Chạy đua với {target} coi ai tới trước. Nói trước, cấp càng thấp chạy càng lẹ.', 'Tới trước rồi. Bánh hết từ sáng, tui quên nói.', 'Chậm rồi. Ngồi nhiều quá mà.', 1, '{"speed_top": 0.97, "speed_step": 0.055, "npc_delay_secs": 0.5, "false_start_penalty_secs": 1}'::jsonb, true, '{"en": {"name": "Race", "title_template": "Race {target} to the Pantry", "offer_text": "There are new cakes in the Pantry. Race {target} and see who gets there first. Fair warning: the more junior, the faster they run.", "win_text": "You got there first. The cakes were gone this morning, forgot to tell you.", "lose_text": "Too slow. Too much sitting."}}'::jsonb),
  ('gossip', 8, 'Nấu xói', 'Nấu xói {target} với {partner}', 'Giờ này nấu xói. Qua kiếm {partner} nấu xói {target} một chút. Nhỏ tiếng thôi, người ta đi ngang là phải im liền.', 'Nấu xong rồi hả. Tui không nghe gì hết nha, tui không biết gì hết.', 'Bị nghe rồi. Mai đi làm nhớ mua trà sữa cho người ta.', 1, '{"fill_secs": 8, "time_limit_secs": 45, "hear_radius": 2.2, "grace_secs": 0.25, "warn_secs": 0.6}'::jsonb, true, '{"en": {"name": "Gossip", "title_template": "Gossip about {target} with {partner}", "offer_text": "Gossip hour. Go find {partner} and have a little gossip about {target}. Keep it down, if they walk past you shut up right away.", "win_text": "All done? I didn''t hear a thing, I don''t know anything.", "lose_text": "You got overheard. Better buy them a bubble tea tomorrow."}}'::jsonb)
on conflict (id) do update set sort_order = excluded.sort_order, name = excluded.name, title_template = excluded.title_template,
  offer_text = excluded.offer_text, win_text = excluded.win_text, lose_text = excluded.lose_text, weight = excluded.weight,
  config = excluded.config, is_active = excluded.is_active, i18n = excluded.i18n;

-- 4. Lời thoại (câu của nhân vật chưa có trong DB thì bỏ qua)
insert into tm_hourly_lines (id, action_id, kind, character_id, text, is_active, i18n)
select l.id, l.action_id, l.kind, l.character_id::text, l.text, l.is_active, l.i18n from (values
  ('hl-001', 'poptask', 'task', null, 'Em ơi sửa giúp anh cái banner, 5 phút thôi.', true, '{"en": {"text": "Could you fix this banner for me, just 5 minutes."}}'::jsonb),
  ('hl-002', 'poptask', 'task', null, 'Cái này gấp nha, chiều nay gửi anh.', true, '{"en": {"text": "This one''s urgent, send it to me this afternoon."}}'::jsonb),
  ('hl-003', 'poptask', 'task', null, 'Khách mới đổi ý, làm lại từ đầu giúp chị.', true, '{"en": {"text": "The client changed their mind, please redo it from scratch."}}'::jsonb),
  ('hl-004', 'poptask', 'task', null, 'Tiện tay làm luôn cái này nha.', true, '{"en": {"text": "Do this too while you''re at it."}}'::jsonb),
  ('hl-005', 'poptask', 'task', null, 'Sáng mai demo, tối nay em coi giúp.', true, '{"en": {"text": "Demo is tomorrow morning, can you check it tonight?"}}'::jsonb),
  ('hl-006', 'poptask', 'task', null, 'Nhỏ xíu à, chắc 10 phút là xong.', true, '{"en": {"text": "It''s tiny, should take 10 minutes."}}'::jsonb),
  ('hl-007', 'poptask', 'task', null, 'Sếp mới nhắn, ưu tiên cái này trước.', true, '{"en": {"text": "The boss just messaged, do this one first."}}'::jsonb),
  ('hl-008', 'poptask', 'task', null, 'Thêm một màn hình nữa thôi, không đáng kể đâu.', true, '{"en": {"text": "Just one more screen, no big deal."}}'::jsonb),
  ('hl-009', 'poptask', 'react', null, 'Ủa, cái này của ai giao vậy?', true, '{"en": {"text": "Wait, who assigned this?"}}'::jsonb),
  ('hl-010', 'poptask', 'react', null, 'Lại nữa hả?', true, '{"en": {"text": "Again?"}}'::jsonb),
  ('hl-011', 'poptask', 'react', null, 'Tui đang full việc mà.', true, '{"en": {"text": "I''m already at full capacity."}}'::jsonb),
  ('hl-012', 'poptask', 'react', null, 'Ghi vô backlog đi rồi tính.', true, '{"en": {"text": "Put it in the backlog and we''ll see."}}'::jsonb),
  ('hl-013', 'poptask', 'react', 'product-manager', 'Cái này có trong sprint không? Không có thì để sprint sau.', true, '{"en": {"text": "Is this in the sprint? If not, next sprint."}}'::jsonb),
  ('hl-014', 'poptask', 'react', 'frontend-developer', 'Tạo ticket đi rồi tui làm.', true, '{"en": {"text": "Make a ticket and I''ll do it."}}'::jsonb),
  ('hl-015', 'poptask', 'react', 'backend-developer', 'Tạo ticket đi rồi tui làm.', true, '{"en": {"text": "Make a ticket and I''ll do it."}}'::jsonb),
  ('hl-016', 'poptask', 'react', 'qa-engineer', 'Để tui test lại coi cái task này có bug không.', true, '{"en": {"text": "Let me test whether this task has bugs."}}'::jsonb),
  ('hl-017', 'poptask', 'react', 'client', 'Việc này nằm ngoài hợp đồng, tính thêm tiền nha.', true, '{"en": {"text": "That''s outside the contract, it''ll cost extra."}}'::jsonb),
  ('hl-018', 'poptask', 'react', 'ceo', 'Anh giao việc cho người khác chứ ai giao việc cho anh.', true, '{"en": {"text": "I give people work, nobody gives me work."}}'::jsonb),
  ('hl-019', 'poptask', 'react', 'intern', 'Dạ để em làm, mà làm sao vậy anh chị?', true, '{"en": {"text": "Sure, I''ll do it… but how do I do it?"}}'::jsonb),
  ('hl-020', 'fight', 'start', null, 'Ê, đánh thiệt hả?', true, '{"en": {"text": "Wait, for real?"}}'::jsonb),
  ('hl-021', 'fight', 'start', null, 'Tui báo HR đó nha.', true, '{"en": {"text": "I''m telling HR."}}'::jsonb),
  ('hl-022', 'fight', 'start', null, 'Từ từ, tui đang cầm ly cà phê.', true, '{"en": {"text": "Hold on, I''m holding a coffee."}}'::jsonb),
  ('hl-023', 'fight', 'start', 'user', 'Người dùng luôn đúng. Thử coi.', true, '{"en": {"text": "The user is always right. Try me."}}'::jsonb),
  ('hl-024', 'fight', 'start', 'client', 'Tui trả tiền mà bạn đánh tui hả?', true, '{"en": {"text": "I''m paying you and you''re fighting me?"}}'::jsonb),
  ('hl-025', 'coffee', 'spill', null, 'Ủa ly cà phê của tui đâu?', true, '{"en": {"text": "Hey, where''s my coffee?"}}'::jsonb),
  ('hl-026', 'coffee', 'spill', null, 'Đi đứng kiểu gì vậy?', true, '{"en": {"text": "Watch where you''re going!"}}'::jsonb),
  ('hl-027', 'coffee', 'spill', null, 'Ướt hết áo rồi nè.', true, '{"en": {"text": "My shirt is soaked."}}'::jsonb),
  ('hl-028', 'coffee', 'thanks', null, 'Cảm ơn nha, đúng lúc đang gục.', true, '{"en": {"text": "Thanks, just when I was crashing."}}'::jsonb),
  ('hl-029', 'coffee', 'thanks', null, 'Có đường không? Thôi kệ, cảm ơn.', true, '{"en": {"text": "Any sugar? Never mind, thanks."}}'::jsonb),
  ('hl-030', 'hide', 'hint', null, 'Thấy chạy về phía {room} đó.', true, '{"en": {"text": "Saw them running towards {room}."}}'::jsonb),
  ('hl-031', 'hide', 'hint', null, 'Hình như mới lủi qua {room}.', true, '{"en": {"text": "I think they just slipped past {room}."}}'::jsonb),
  ('hl-032', 'hide', 'hint', null, 'Tui không nói gì hết nha, mà coi thử {room} đi.', true, '{"en": {"text": "I didn''t say anything, but try {room}."}}'::jsonb),
  ('hl-033', 'hide', 'found', null, 'Suỵt, đừng nói ai tui ở đây.', true, '{"en": {"text": "Shh, don''t tell anyone I''m here."}}'::jsonb),
  ('hl-034', 'hide', 'found', null, 'Cho tui trốn thêm 5 phút nữa thôi mà.', true, '{"en": {"text": "Just let me hide five more minutes."}}'::jsonb),
  ('hl-035', 'race', 'start', null, 'Chờ tui cột dây giày đã.', true, '{"en": {"text": "Wait, let me tie my shoes."}}'::jsonb),
  ('hl-036', 'race', 'start', null, 'Tới trước được gì không vậy?', true, '{"en": {"text": "What do I win if I get there first?"}}'::jsonb),
  ('hl-037', 'gossip', 'caught', null, 'Hồi nãy em nói gì chị đó Mai?', true, '{"en": {"text": "What did you just say about me, Mai?"}}'::jsonb),
  ('hl-038', 'gossip', 'caught', null, 'Tui nghe hết rồi nha.', true, '{"en": {"text": "I heard everything."}}'::jsonb),
  ('hl-039', 'gossip', 'caught', null, 'Nói tiếp đi, tui đứng đây nghe nè.', true, '{"en": {"text": "Go on, I''m standing right here listening."}}'::jsonb),
  ('hl-040', 'gossip', 'say', null, 'Họp một tiếng mà cuối cùng chốt lại là hẹn họp tiếp.', true, '{"en": {"text": "An hour-long meeting that ended with scheduling another meeting."}}'::jsonb),
  ('hl-041', 'gossip', 'say', null, 'Nhắn hỏi thì seen, tới lúc gấp thì gọi liền ba cuộc.', true, '{"en": {"text": "Messages get left on seen, then when it''s urgent they call three times."}}'::jsonb),
  ('hl-042', 'gossip', 'say', null, 'Nói là góp ý nhẹ thôi mà gửi nguyên cái file 40 comment.', true, '{"en": {"text": "Said it was just light feedback, then sent a file with 40 comments."}}'::jsonb),
  ('hl-043', 'gossip', 'say', 'product-manager', 'Mỗi tuần đổi ưu tiên một lần, mà lần nào cũng nói là lần cuối.', true, '{"en": {"text": "Priorities change every week, and every time it''s \"the last time\"."}}'::jsonb),
  ('hl-044', 'gossip', 'say', 'product-owner', 'Viết ticket có một dòng rồi hỏi sao design không đúng ý.', true, '{"en": {"text": "Writes a one-line ticket, then asks why the design isn''t what they wanted."}}'::jsonb),
  ('hl-045', 'gossip', 'say', 'frontend-developer', 'Design lệch 2 pixel thì kêu không sao, tới lúc mình nói lệch thì kêu khó làm.', true, '{"en": {"text": "When the design is off by 2 pixels it''s fine, when we say the build is off it''s \"hard to do\"."}}'::jsonb),
  ('hl-046', 'gossip', 'say', 'backend-developer', 'Hỏi cái gì cũng trả lời là API chưa có.', true, '{"en": {"text": "Whatever you ask, the answer is \"the API isn''t ready\"."}}'::jsonb),
  ('hl-047', 'gossip', 'say', 'fullstack-developer', 'Cái gì cũng nhận làm được, rồi cái gì cũng trễ.', true, '{"en": {"text": "Says yes to everything, then everything is late."}}'::jsonb),
  ('hl-048', 'gossip', 'say', 'mobile-developer', 'Hễ khó là nói iOS không cho làm vậy.', true, '{"en": {"text": "Whenever it''s hard, it''s \"iOS doesn''t allow that\"."}}'::jsonb),
  ('hl-049', 'gossip', 'say', 'qa-engineer', 'Log nguyên cái bug vì cái nút lệch nửa pixel.', true, '{"en": {"text": "Logged a whole bug because a button was half a pixel off."}}'::jsonb),
  ('hl-050', 'gossip', 'say', 'tech-lead', 'Hỏi làm được không thì nói được, hỏi chừng nào xong thì nói còn tuỳ.', true, '{"en": {"text": "Ask if it can be done: yes. Ask when it''ll be done: it depends."}}'::jsonb),
  ('hl-051', 'gossip', 'say', 'design-manager', 'Review xong chỉ nói một câu là chưa tới, mà không nói tới đâu.', true, '{"en": {"text": "After review all they say is \"not there yet\", without saying where \"there\" is."}}'::jsonb),
  ('hl-052', 'gossip', 'say', 'head-of-design', 'Coi design 10 giây rồi kêu thử làm thêm ba phương án nữa.', true, '{"en": {"text": "Looks at the design for 10 seconds, then asks for three more options."}}'::jsonb),
  ('hl-053', 'gossip', 'say', 'ceo', 'Đi ngang màn hình một cái là đòi đổi màu nút.', true, '{"en": {"text": "Walks past a screen once and wants the button colour changed."}}'::jsonb),
  ('hl-054', 'gossip', 'say', 'cpo', 'Lần nào cũng hỏi số liệu đâu, mà có số rồi thì quyết theo cảm giác.', true, '{"en": {"text": "Always asks where the data is, then decides on gut feeling anyway."}}'::jsonb),
  ('hl-055', 'gossip', 'say', 'cto', 'Cái gì cũng muốn viết lại từ đầu.', true, '{"en": {"text": "Wants to rewrite everything from scratch."}}'::jsonb),
  ('hl-056', 'gossip', 'say', 'stakeholder', 'Không dự buổi nào hết, tới ngày cuối mới vô góp ý.', true, '{"en": {"text": "Skipped every session, shows up on the last day with feedback."}}'::jsonb),
  ('hl-057', 'gossip', 'say', 'business-analyst', 'Viết tài liệu 40 trang mà chỗ mình cần thì không có.', true, '{"en": {"text": "Writes a 40-page document and the part we need isn''t in it."}}'::jsonb),
  ('hl-058', 'gossip', 'say', 'project-manager', 'Ngày nào cũng hỏi xong chưa, hỏi cần giúp gì không thì không thấy.', true, '{"en": {"text": "Asks \"is it done?\" every day, never asks \"do you need help?\"."}}'::jsonb),
  ('hl-059', 'gossip', 'say', 'account-manager', 'Khách đòi gì cũng dạ, rồi về nói team ráng giúp.', true, '{"en": {"text": "Says yes to everything the client wants, then asks the team to \"try their best\"."}}'::jsonb),
  ('hl-060', 'gossip', 'say', 'intern', 'Hỏi hiểu chưa thì dạ hiểu, xong làm ra một cái khác hẳn.', true, '{"en": {"text": "Says \"yes, I get it\", then makes something completely different."}}'::jsonb),
  ('hl-061', 'gossip', 'say', 'client', 'Kêu làm logo to lên, làm xong lại kêu sao nhìn rối quá.', true, '{"en": {"text": "Asked for a bigger logo, then said it looks too cluttered."}}'::jsonb),
  ('hl-062', 'gossip', 'say', 'user', 'Nói là thích lắm, mà cài xong xài đúng một lần rồi xoá.', true, '{"en": {"text": "Said they loved it, used it once, then deleted it."}}'::jsonb),
  ('hl-063', 'gossip', 'say', 'ux-researcher', 'Hỏi nên làm sao thì trả lời là còn tuỳ, phải phỏng vấn thêm.', true, '{"en": {"text": "Ask what to do and the answer is \"it depends, we need more interviews\"."}}'::jsonb),
  ('hl-064', 'gossip', 'say', 'data-analyst', 'Xin một con số thôi mà hẹn sang tuần sau.', true, '{"en": {"text": "Asked for one number and got told \"next week\"."}}'::jsonb),
  ('hl-065', 'gossip', 'say', 'scrum-master', 'Ngày nào cũng bắt đứng họp, mà họp đứng 45 phút.', true, '{"en": {"text": "Makes us do a stand-up every day, and the stand-up takes 45 minutes."}}'::jsonb),
  ('hl-066', 'gossip', 'say', 'design-director', 'Kêu sáng tạo tự do đi, xong sửa lại y như ý ổng.', true, '{"en": {"text": "Says \"be creative, total freedom\", then changes it to exactly what he wanted."}}'::jsonb),
  ('hl-067', 'gossip', 'say', 'sales', 'Hứa với khách cái tính năng mà team chưa ai nghe tới.', true, '{"en": {"text": "Promised the client a feature nobody on the team has heard of."}}'::jsonb)
) as l(id, action_id, kind, character_id, text, is_active, i18n) where l.character_id is null or exists (select 1 from tm_characters c where c.id = l.character_id)
on conflict (id) do update set action_id = excluded.action_id, kind = excluded.kind, character_id = excluded.character_id,
  text = excluded.text, is_active = excluded.is_active, i18n = excluded.i18n;

-- 5. Câu hỏi trắc nghiệm
insert into tm_quiz_questions (id, character_id, question, options, correct_index, is_active, i18n)
select q.* from (values
  ('qz-product-manager-1', 'product-manager', 'Product Manager chịu trách nhiệm chính về điều gì?', '["Quyết định sản phẩm nên giải quyết vấn đề gì và ưu tiên cái nào trước", "Viết code cho các tính năng chính", "Vẽ toàn bộ giao diện của sản phẩm"]'::jsonb, 0, true, '{"en": {"question": "What is a Product Manager mainly responsible for?", "options": ["Deciding which problems the product should solve and what comes first", "Writing the code for the main features", "Designing the entire interface"]}}'::jsonb),
  ('qz-product-owner-1', 'product-owner', 'Trong một nhóm Scrum, Product Owner là người quản lý thứ gì?', '["Lương thưởng của cả nhóm", "Product backlog và thứ tự ưu tiên của nó", "Máy chủ và hạ tầng"]'::jsonb, 1, true, '{"en": {"question": "In a Scrum team, what does the Product Owner manage?", "options": ["The team''s salaries and bonuses", "The product backlog and its priorities", "Servers and infrastructure"]}}'::jsonb),
  ('qz-product-designer-1', 'product-designer', 'So với UI Designer, Product Designer thường gánh thêm phần nào?', '["Chỉ làm ảnh quảng cáo", "Viết API cho backend", "Cả bài toán sản phẩm: từ tìm hiểu vấn đề tới đo kết quả sau khi ra mắt"]'::jsonb, 2, true, '{"en": {"question": "Compared with a UI Designer, what extra does a Product Designer usually take on?", "options": ["Only advertising images", "Writing backend APIs", "The whole product problem: from understanding it to measuring results after launch"]}}'::jsonb),
  ('qz-intern-1', 'intern', 'Điều gì giúp một thực tập sinh design tiến bộ nhanh nhất?', '["Hỏi sớm và xin nhận xét thường xuyên", "Giấu bài tới khi thật hoàn hảo mới đưa ra", "Chỉ làm đúng phần được giao, không hỏi thêm"]'::jsonb, 0, true, '{"en": {"question": "What helps a design intern improve fastest?", "options": ["Asking early and asking for feedback often", "Hiding work until it is perfect", "Doing only what was assigned and never asking more"]}}'::jsonb),
  ('qz-ds-designer-1', 'ds-designer', 'Design System Designer tạo ra thứ gì cho cả đội dùng chung?', '["Kế hoạch marketing", "Bộ component, token và quy tắc sử dụng", "Bảng lương"]'::jsonb, 1, true, '{"en": {"question": "What does a Design System Designer create for the whole team?", "options": ["A marketing plan", "Components, tokens and usage rules", "The payroll"]}}'::jsonb),
  ('qz-ux-design-engineer-1', 'ux-design-engineer', 'UX Design Engineer đứng ở giữa hai công việc nào?', '["Kế toán và nhân sự", "Bán hàng và chăm sóc khách hàng", "Thiết kế và lập trình giao diện"]'::jsonb, 2, true, '{"en": {"question": "A UX Design Engineer sits between which two jobs?", "options": ["Accounting and HR", "Sales and customer care", "Design and front-end development"]}}'::jsonb),
  ('qz-motion-designer-1', 'motion-designer', 'Motion Designer trong đội sản phẩm lo phần nào?', '["Chuyển động và hiệu ứng chuyển cảnh trong giao diện", "Thiết kế cơ sở dữ liệu", "Viết điều khoản sử dụng"]'::jsonb, 0, true, '{"en": {"question": "What does a Motion Designer handle in a product team?", "options": ["Motion and transitions in the interface", "Database design", "Writing the terms of service"]}}'::jsonb),
  ('qz-frontend-developer-1', 'frontend-developer', 'Frontend Developer biến bản thiết kế thành thứ gì?', '["Báo cáo tài chính", "Giao diện chạy được mà người dùng thao tác trực tiếp", "Kịch bản phỏng vấn người dùng"]'::jsonb, 1, true, '{"en": {"question": "What does a Frontend Developer turn a design into?", "options": ["A financial report", "A working interface that users interact with directly", "A user interview script"]}}'::jsonb),
  ('qz-backend-developer-1', 'backend-developer', 'Backend Developer lo phần nào của sản phẩm?', '["Màu sắc và kiểu chữ", "Bài đăng mạng xã hội", "Máy chủ, dữ liệu và API phía sau giao diện"]'::jsonb, 2, true, '{"en": {"question": "Which part of the product does a Backend Developer handle?", "options": ["Colours and typography", "Social media posts", "Servers, data and the APIs behind the interface"]}}'::jsonb),
  ('qz-fullstack-developer-1', 'fullstack-developer', 'Fullstack Developer khác gì so với Frontend hay Backend Developer?', '["Làm được cả phần giao diện lẫn phần máy chủ", "Chỉ làm thiết kế, không viết code", "Chỉ kiểm thử sản phẩm"]'::jsonb, 0, true, '{"en": {"question": "How is a Fullstack Developer different from a Frontend or Backend Developer?", "options": ["They can build both the interface and the server side", "They only design and never code", "They only test the product"]}}'::jsonb),
  ('qz-business-analyst-1', 'business-analyst', 'Business Analyst thường giúp đội làm rõ điều gì?', '["Bảng màu thương hiệu", "Yêu cầu nghiệp vụ và quy trình mà sản phẩm phải đáp ứng", "Lịch nghỉ phép của nhóm"]'::jsonb, 1, true, '{"en": {"question": "What does a Business Analyst usually help the team clarify?", "options": ["The brand colour palette", "The business requirements and processes the product must support", "The team''s holiday schedule"]}}'::jsonb),
  ('qz-stakeholder-1', 'stakeholder', 'Stakeholder là ai trong một dự án?', '["Người viết code chính", "Người dùng cuối của sản phẩm", "Người có quyền lợi hoặc tiếng nói với kết quả dự án, dù không trực tiếp làm"]'::jsonb, 2, true, '{"en": {"question": "Who is a stakeholder in a project?", "options": ["The lead developer", "The product''s end user", "Someone with an interest in or a say over the outcome, even if they don''t do the work"]}}'::jsonb)
) as q(id, character_id, question, options, correct_index, is_active, i18n) where exists (select 1 from tm_characters c where c.id = q.character_id)
on conflict (id) do update set character_id = excluded.character_id, question = excluded.question, options = excluded.options,
  correct_index = excluded.correct_index, is_active = excluded.is_active, i18n = excluded.i18n;

-- 6. Huy hiệu (image_url để trống, admin upload sau; giữ hình đã upload nếu chạy lại)
insert into tm_badges (id, sort_order, name, description, image_url, rim_color, condition_type, action_id, threshold, params,
                       is_hidden, is_active, reward_title, reward_note, reward_url, reward_status, i18n) values
  ('kiet-gi-cung-bac', 1, 'Kiệt gì cũng bắc', 'Giờ ai làm gì mình cũng biết hết rồi, chỉ không biết làm sao để tăng lương thôi', null, '#FFC53D', 'distinct_characters', 'read', 5, '{}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "Know-it-all", "description": "Now you know what everyone does. You just don''t know how to get a raise."}}'::jsonb),
  ('khach-hang-khong-phai-thuong-de', 2, 'Khách hàng không phải thượng đế', 'Hạ được người mạnh nhất công ty: người dùng.', null, '#FFC53D', 'win_vs', 'fight', 1, '{"character_id": "user"}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "The customer is not king", "description": "Took down the strongest person in the company: the user."}}'::jsonb),
  ('trum-giao-viec', 3, 'Trùm giao việc', 'Việc gấp nha, chiều nay gửi anh.', null, '#FFC53D', 'flawless_wins', 'poptask', 1, '{}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "Task-dumping boss", "description": "It''s urgent, send it to me this afternoon."}}'::jsonb),
  ('tu-dien-song', 4, 'Từ điển sống', 'Nói chuyện toàn jargon, không ai hiểu nhưng ai cũng nể.', null, '#FFC53D', 'flawless_wins', 'flashcard', 3, '{}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "Walking dictionary", "description": "Speaks only in jargon. Nobody understands, everybody is impressed."}}'::jsonb),
  ('barista-khong-luong', 5, 'Barista không lương', 'Kỹ năng không ghi trong JD nhưng dùng nhiều nhất.', null, '#FFC53D', 'flawless_wins', 'coffee', 5, '{}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "Unpaid barista", "description": "Not in the JD, but the skill you use the most."}}'::jsonb),
  ('may-thich-tron-hong', 6, 'Mày thích trốn hong?', 'Trốn họp kiểu gì cũng bị tìm ra.', null, '#FFC53D', 'win_under_secs', 'hide', 1, '{"secs": 15}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "Think you can hide?", "description": "Skip a meeting however you like, you will be found."}}'::jsonb),
  ('trum-chay-chot', 7, 'Trùm chạy chọt', 'Nhanh hơn cả intern lúc 6 giờ chiều.', null, '#FFC53D', 'win_vs', 'race', 1, '{"rank_max": 1}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "Office sprinter", "description": "Faster than the intern at 6 pm."}}'::jsonb),
  ('ran-doc-van-phong', 8, 'Rắn độc văn phòng', 'Skrrrr', null, '#FFC53D', 'win_streak', 'gossip', 5, '{}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "Office snake", "description": "Skrrrr"}}'::jsonb),
  ('qua-bao-toi-som', 9, 'Quả báo tới sớm', 'Hồi nãy em nói gì chị đó Mai?', null, '#FFC53D', 'fail_count', 'gossip', 3, '{"fail_kind": "caught"}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "Instant karma", "description": "What did you just say about me, Mai?"}}'::jsonb),
  ('nhan-vien-cua-thang', 10, 'Nhân viên của tháng', 'Phần thưởng: thêm việc.', null, '#FFC53D', 'all_actions', null, null, '{}'::jsonb, true, true, null, null, null, 'none', '{"en": {"name": "Employee of the month", "description": "Your reward: more work."}}'::jsonb)
on conflict (id) do update set sort_order = excluded.sort_order, name = excluded.name, description = excluded.description,
  image_url = coalesce(tm_badges.image_url, excluded.image_url), rim_color = excluded.rim_color, condition_type = excluded.condition_type,
  action_id = excluded.action_id, threshold = excluded.threshold, params = excluded.params, is_hidden = excluded.is_hidden,
  is_active = excluded.is_active, i18n = excluded.i18n;

-- 7. Thuật ngữ liên quan: nhân vật đang để trống → các thuật ngữ trong thẻ thưởng của nhiệm vụ chính
--    mà nhân vật tham gia (người giao, người được gọi họp, người cần gặp ở một bước).
with part as (
  select q.id as qid, split_part(q.giver, '@', 1) as cid from tm_quests q where q.type = 'main' and q.giver is not null
  union select q.id, split_part(g, '@', 1) from tm_quests q, jsonb_array_elements_text(q.gather) g where q.type = 'main'
  union select s.quest_id, split_part(s.target, '@', 1) from tm_quest_steps s join tm_quests q on q.id = s.quest_id
        where q.type = 'main' and s.target is not null
), t as (
  select p.cid, jsonb_agg(distinct r -> 'term_id') as ids
  from part p join tm_quests q on q.id = p.qid, jsonb_array_elements(q.rewards) r
  where r ->> 'type' = 'term' and r ? 'term_id' group by p.cid
)
update tm_characters c set related_term_ids = t.ids from t where c.id = t.cid and c.related_term_ids = '[]'::jsonb;

-- 7b. (ngoài SPEC) còn dưới 4 thuật ngữ → bổ sung thuật ngữ theo nhóm nghề, tra theo tên trong kho
with g(grp, name) as (values
  ('design', 'Wireframe'),
  ('design', 'Mockup'),
  ('design', 'Prototype'),
  ('design', 'User Flow'),
  ('design', 'Design System'),
  ('design', 'Usability Testing'),
  ('design', 'Heuristic Evaluation'),
  ('design', 'User Persona'),
  ('design', 'Accessibility'),
  ('design', 'Information Architecture (IA)'),
  ('design', 'Grid System'),
  ('design', 'UX Pattern'),
  ('product', 'Agile'),
  ('product', 'Waterfall'),
  ('product', 'Problem Statement'),
  ('product', 'User Persona'),
  ('product', 'Customer Journey Map'),
  ('product', 'Design Thinking'),
  ('product', 'Double Diamond'),
  ('product', 'PURE'),
  ('engineering', 'Agile'),
  ('engineering', 'Waterfall'),
  ('engineering', 'Design System'),
  ('engineering', 'Prototype'),
  ('engineering', 'Accessibility'),
  ('engineering', 'Wireframe'),
  ('engineering', 'UX Pattern'),
  ('engineering', 'Grid System'),
  ('data', 'UX Research'),
  ('data', 'Customer Journey Map'),
  ('data', 'Usability Testing'),
  ('data', 'Mental Model'),
  ('data', 'PURE'),
  ('data', 'User Persona'),
  ('delivery', 'Agile'),
  ('delivery', 'Waterfall'),
  ('delivery', 'Double Diamond'),
  ('delivery', 'Problem Statement'),
  ('delivery', 'Prototype'),
  ('business', 'Customer Journey Map'),
  ('business', 'User Persona'),
  ('business', 'Problem Statement'),
  ('business', 'Empathy Map'),
  ('business', 'Sitemap'),
  ('business', 'Bố cục Website')
), add as (
  select c.id, jsonb_agg(distinct to_jsonb(k.id)) as ids from tm_characters c
  join g on g.grp = c."group" join concepts k on lower(k.name) = lower(g.name) and k.is_published
  where c.kind = 'role' and jsonb_array_length(c.related_term_ids) < 4 group by c.id
)
update tm_characters c set related_term_ids = (select jsonb_agg(distinct e) from (
    select jsonb_array_elements(c.related_term_ids) e union select jsonb_array_elements(add.ids)) x)
from add where c.id = add.id;

-- Báo cáo: id bị bỏ qua + nhân vật có dưới 4 thuật ngữ liên quan (flashcard cần ít nhất 4)
select 'Cấp bậc: id không tồn tại' as muc, string_agg(r.id, ', ') as chi_tiet from (values ('intern'), ('product-designer'), ('ui-designer'), ('ux-designer'), ('ds-designer'), ('ux-design-engineer'), ('ux-researcher'), ('ux-writer'), ('motion-designer'), ('frontend-developer'), ('backend-developer'), ('fullstack-developer'), ('mobile-developer'), ('qa-engineer'), ('devops'), ('data-analyst'), ('bi-analyst'), ('data-scientist'), ('data-engineer'), ('performance-marketer'), ('content-marketer'), ('seo-specialist'), ('customer-support'), ('business-analyst'), ('graphic-designer'), ('sales'), ('freelancer'), ('tech-lead'), ('software-architect'), ('scrum-master'), ('product-owner'), ('product-manager'), ('growth-pm'), ('data-pm'), ('project-manager'), ('account-manager'), ('crm-manager'), ('csm'), ('design-manager'), ('delivery-manager'), ('growth-manager'), ('brand-manager'), ('head-of-design'), ('head-of-data'), ('head-of-eng'), ('design-director'), ('ceo'), ('cpo'), ('cto'), ('stakeholder'), ('client'), ('user')) as r(id) where not exists (select 1 from tm_characters c where c.id = r.id)
union all select 'Lời thoại bỏ qua (nhân vật chưa có)', string_agg(l.id || ' → ' || l.character_id, ', ') from (values ('hl-013', 'product-manager'), ('hl-014', 'frontend-developer'), ('hl-015', 'backend-developer'), ('hl-016', 'qa-engineer'), ('hl-017', 'client'), ('hl-018', 'ceo'), ('hl-019', 'intern'), ('hl-023', 'user'), ('hl-024', 'client'), ('hl-043', 'product-manager'), ('hl-044', 'product-owner'), ('hl-045', 'frontend-developer'), ('hl-046', 'backend-developer'), ('hl-047', 'fullstack-developer'), ('hl-048', 'mobile-developer'), ('hl-049', 'qa-engineer'), ('hl-050', 'tech-lead'), ('hl-051', 'design-manager'), ('hl-052', 'head-of-design'), ('hl-053', 'ceo'), ('hl-054', 'cpo'), ('hl-055', 'cto'), ('hl-056', 'stakeholder'), ('hl-057', 'business-analyst'), ('hl-058', 'project-manager'), ('hl-059', 'account-manager'), ('hl-060', 'intern'), ('hl-061', 'client'), ('hl-062', 'user'), ('hl-063', 'ux-researcher'), ('hl-064', 'data-analyst'), ('hl-065', 'scrum-master'), ('hl-066', 'design-director'), ('hl-067', 'sales')) as l(id, character_id)
  where l.character_id is not null and not exists (select 1 from tm_characters c where c.id = l.character_id)
union all select 'Câu hỏi bỏ qua (nhân vật chưa có)', string_agg(q.id, ', ') from (values ('qz-product-manager-1', 'product-manager'), ('qz-product-owner-1', 'product-owner'), ('qz-product-designer-1', 'product-designer'), ('qz-intern-1', 'intern'), ('qz-ds-designer-1', 'ds-designer'), ('qz-ux-design-engineer-1', 'ux-design-engineer'), ('qz-motion-designer-1', 'motion-designer'), ('qz-frontend-developer-1', 'frontend-developer'), ('qz-backend-developer-1', 'backend-developer'), ('qz-fullstack-developer-1', 'fullstack-developer'), ('qz-business-analyst-1', 'business-analyst'), ('qz-stakeholder-1', 'stakeholder')) as q(id, character_id) where not exists (select 1 from tm_characters c where c.id = q.character_id)
union all select 'Dưới 4 thuật ngữ liên quan', string_agg(c.id || ' (' || jsonb_array_length(c.related_term_ids) || ')', ', ' order by c.id)
  from tm_characters c where c.kind = 'role' and c.is_active and jsonb_array_length(c.related_term_ids) < 4;

commit;
