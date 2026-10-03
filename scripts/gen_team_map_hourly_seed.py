#!/usr/bin/env python3
"""Sinh seed cho nhiệm vụ theo giờ (SPEC-hourly) từ team-map/seed-hourly.json:

    python3 scripts/gen_team_map_hourly_seed.py

- supabase_team_map_hourly_seed.sql: chạy trong Supabase → SQL Editor, sau supabase_team_map.sql.
  Upsert theo id, chạy lại không tạo trùng (nhưng ghi đè nội dung đã sửa trong CMS cho các dòng có trong seed).
  Cấp bậc chỉ ghi cho nhân vật chưa có cấp; thuật ngữ liên quan chỉ điền cho nhân vật đang để trống.
- Ghép dữ liệu (kèm bản tiếng Anh từ team-map/i18n-hourly-en.json) vào team-map/seed.json, khoá "hourly",
  để game vẫn có nhiệm vụ theo giờ khi phải dùng seed dự phòng.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'team-map', 'seed-hourly.json')
SRC_EN = os.path.join(ROOT, 'team-map', 'i18n-hourly-en.json')
SEED = os.path.join(ROOT, 'team-map', 'seed.json')
OUT = os.path.join(ROOT, 'supabase_team_map_hourly_seed.sql')


def lit(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (list, dict)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def values(rows):
    return ',\n'.join('  (' + ', '.join(lit(x) for x in r) + ')' for r in rows)


def with_en(items, tr, fields):
    """Gắn i18n.en cho từng dòng."""
    out = []
    for it in items:
        it = dict(it)
        t = tr.get(it['id'])
        if isinstance(t, str):
            t = {fields[0]: t}
        it['i18n'] = {'en': {k: t[k] for k in fields if t and t.get(k)}} if t else {}
        out.append(it)
    return out


# Bổ sung (ngoài SPEC): nhân vật vẫn dưới 4 thuật ngữ sau bước 7 → thêm thuật ngữ hợp với nhóm nghề,
# tra theo TÊN trong kho thuật ngữ (tên nào không có trong DB thì bỏ qua). Chủ dự án chỉnh lại trong CMS.
GROUP_TERMS = {
    'design': ['Wireframe', 'Mockup', 'Prototype', 'User Flow', 'Design System', 'Usability Testing', 'Heuristic Evaluation',
               'User Persona', 'Accessibility', 'Information Architecture (IA)', 'Grid System', 'UX Pattern'],
    'product': ['Agile', 'Waterfall', 'Problem Statement', 'User Persona', 'Customer Journey Map', 'Design Thinking', 'Double Diamond', 'PURE'],
    'engineering': ['Agile', 'Waterfall', 'Design System', 'Prototype', 'Accessibility', 'Wireframe', 'UX Pattern', 'Grid System'],
    'data': ['UX Research', 'Customer Journey Map', 'Usability Testing', 'Mental Model', 'PURE', 'User Persona'],
    'delivery': ['Agile', 'Waterfall', 'Double Diamond', 'Problem Statement', 'Prototype'],
    'business': ['Customer Journey Map', 'User Persona', 'Problem Statement', 'Empathy Map', 'Sitemap', 'Bố cục Website'],
}


def main():
    h = json.load(open(SRC, encoding='utf-8'))
    en = json.load(open(SRC_EN, encoding='utf-8'))
    for key, en_key in [('actions', 'actions'), ('lines', 'lines'), ('quiz_questions', 'quiz'), ('badges', 'badges')]:
        unknown = set(en[en_key]) - {x['id'] for x in h[key]}
        assert not unknown, f'i18n-hourly-en.json có id lạ trong {en_key}: {sorted(unknown)}'
    actions = with_en(h['actions'], en['actions'], ['name', 'title_template', 'offer_text', 'win_text', 'lose_text'])
    lines = with_en(h['lines'], en['lines'], ['text'])
    quiz = with_en(h['quiz_questions'], en['quiz'], ['question', 'options'])
    badges = with_en(h['badges'], en['badges'], ['name', 'description'])
    cfg = h['config']

    sql = [
        '-- ════════════════════════════════════════════════════════',
        '-- TEAM MAP — seed nhiệm vụ theo giờ (sinh tự động bởi scripts/gen_team_map_hourly_seed.py, đừng sửa tay)',
        '-- Chạy sau supabase_team_map.sql. Upsert theo id: chạy lại không tạo trùng, nhưng ghi đè các dòng đã sửa trong CMS.',
        '-- ════════════════════════════════════════════════════════',
        'begin;', '',
        '-- 1. Cấu hình (một dòng)',
        'insert into tm_hourly_config (id, slot_minutes, no_repeat_slots, counted_wins_per_slot) values '
        f"(1, {cfg['slot_minutes']}, {cfg['no_repeat_slots']}, {cfg['counted_wins_per_slot']})",
        'on conflict (id) do update set slot_minutes = excluded.slot_minutes, no_repeat_slots = excluded.no_repeat_slots,',
        '  counted_wins_per_slot = excluded.counted_wins_per_slot;', '',
        '-- 2. Cấp bậc: chỉ ghi cho nhân vật chưa có cấp (id không tồn tại thì bỏ qua, xem báo cáo cuối file)',
        'create temp table _rank (id text, rank int) on commit drop;',
        'insert into _rank values', values([(k, v) for k, v in h['character_rank'].items()]) + ';',
        'update tm_characters c set rank = r.rank from _rank r where c.id = r.id and c.rank is null;', '',
        '-- 3. Hành động',
        'insert into tm_hourly_actions (id, sort_order, name, title_template, offer_text, win_text, lose_text, weight, config, is_active, i18n) values',
        values([(a['id'], a['sort_order'], a['name'], a['title_template'], a['offer_text'], a['win_text'], a['lose_text'],
                 a['weight'], a['config'], a['is_active'], a['i18n']) for a in actions]),
        'on conflict (id) do update set sort_order = excluded.sort_order, name = excluded.name, title_template = excluded.title_template,',
        '  offer_text = excluded.offer_text, win_text = excluded.win_text, lose_text = excluded.lose_text, weight = excluded.weight,',
        '  config = excluded.config, is_active = excluded.is_active, i18n = excluded.i18n;', '',
        '-- 4. Lời thoại (câu của nhân vật chưa có trong DB thì bỏ qua)',
        'create temp table _lines (id text, action_id text, kind text, character_id text, text text, is_active boolean, i18n jsonb) on commit drop;',
        'insert into _lines values', values([(l['id'], l['action_id'], l['kind'], l['character_id'], l['text'], l['is_active'], l['i18n']) for l in lines]) + ';',
        'insert into tm_hourly_lines (id, action_id, kind, character_id, text, is_active, i18n)',
        'select * from _lines l where l.character_id is null or exists (select 1 from tm_characters c where c.id = l.character_id)',
        'on conflict (id) do update set action_id = excluded.action_id, kind = excluded.kind, character_id = excluded.character_id,',
        '  text = excluded.text, is_active = excluded.is_active, i18n = excluded.i18n;', '',
        '-- 5. Câu hỏi trắc nghiệm',
        'create temp table _quiz (id text, character_id text, question text, options jsonb, correct_index int, is_active boolean, i18n jsonb) on commit drop;',
        'insert into _quiz values', values([(q['id'], q['character_id'], q['question'], q['options'], q['correct_index'], q['is_active'], q['i18n']) for q in quiz]) + ';',
        'insert into tm_quiz_questions (id, character_id, question, options, correct_index, is_active, i18n)',
        'select * from _quiz q where exists (select 1 from tm_characters c where c.id = q.character_id)',
        'on conflict (id) do update set character_id = excluded.character_id, question = excluded.question, options = excluded.options,',
        '  correct_index = excluded.correct_index, is_active = excluded.is_active, i18n = excluded.i18n;', '',
        '-- 6. Huy hiệu (image_url để trống, admin upload sau; giữ hình đã upload nếu chạy lại)',
        'insert into tm_badges (id, sort_order, name, description, image_url, rim_color, condition_type, action_id, threshold, params,',
        '                       is_hidden, is_active, reward_title, reward_note, reward_url, reward_status, i18n) values',
        values([(b['id'], b['sort_order'], b['name'], b['description'], b['image_url'], b['rim_color'], b['condition_type'], b['action_id'],
                 b['threshold'], b['params'], b['is_hidden'], b['is_active'], b['reward_title'], b['reward_note'], b['reward_url'],
                 b['reward_status'], b['i18n']) for b in badges]),
        'on conflict (id) do update set sort_order = excluded.sort_order, name = excluded.name, description = excluded.description,',
        '  image_url = coalesce(tm_badges.image_url, excluded.image_url), rim_color = excluded.rim_color, condition_type = excluded.condition_type,',
        '  action_id = excluded.action_id, threshold = excluded.threshold, params = excluded.params, is_hidden = excluded.is_hidden,',
        '  is_active = excluded.is_active, i18n = excluded.i18n;', '',
        '-- 7. Thuật ngữ liên quan: nhân vật đang để trống → các thuật ngữ trong thẻ thưởng của nhiệm vụ chính',
        '--    mà nhân vật tham gia (người giao, người được gọi họp, người cần gặp ở một bước).',
        'with part as (',
        "  select q.id as qid, split_part(q.giver, '@', 1) as cid from tm_quests q where q.type = 'main' and q.giver is not null",
        "  union select q.id, split_part(g, '@', 1) from tm_quests q, jsonb_array_elements_text(q.gather) g where q.type = 'main'",
        "  union select s.quest_id, split_part(s.target, '@', 1) from tm_quest_steps s join tm_quests q on q.id = s.quest_id",
        "        where q.type = 'main' and s.target is not null",
        '), t as (',
        "  select p.cid, jsonb_agg(distinct r -> 'term_id') as ids",
        '  from part p join tm_quests q on q.id = p.qid, jsonb_array_elements(q.rewards) r',
        "  where r ->> 'type' = 'term' and r ? 'term_id' group by p.cid",
        ')',
        "update tm_characters c set related_term_ids = t.ids from t where c.id = t.cid and c.related_term_ids = '[]'::jsonb;", '',
        '-- 7b. (ngoài SPEC) còn dưới 4 thuật ngữ → bổ sung thuật ngữ theo nhóm nghề, tra theo tên trong kho',
        'create temp table _gterms (grp text, name text) on commit drop;',
        'insert into _gterms values', values([(g, n) for g, names in GROUP_TERMS.items() for n in names]) + ';',
        'with add as (',
        "  select c.id, jsonb_agg(distinct to_jsonb(k.id)) as ids from tm_characters c",
        '  join _gterms g on g.grp = c."group" join concepts k on lower(k.name) = lower(g.name) and k.is_published',
        "  where c.kind = 'role' and jsonb_array_length(c.related_term_ids) < 4 group by c.id",
        ')',
        'update tm_characters c set related_term_ids = (select jsonb_agg(distinct e) from (',
        '    select jsonb_array_elements(c.related_term_ids) e union select jsonb_array_elements(add.ids)) x)',
        'from add where c.id = add.id;', '',
        '-- Báo cáo: id bị bỏ qua + nhân vật có dưới 4 thuật ngữ liên quan (flashcard cần ít nhất 4)',
        "select 'Cấp bậc: id không tồn tại' as muc, string_agg(r.id, ', ') as chi_tiet from _rank r where not exists (select 1 from tm_characters c where c.id = r.id)",
        "union all select 'Lời thoại bỏ qua (nhân vật chưa có)', string_agg(l.id || ' → ' || l.character_id, ', ') from _lines l",
        '  where l.character_id is not null and not exists (select 1 from tm_characters c where c.id = l.character_id)',
        "union all select 'Câu hỏi bỏ qua (nhân vật chưa có)', string_agg(q.id, ', ') from _quiz q where not exists (select 1 from tm_characters c where c.id = q.character_id)",
        "union all select 'Dưới 4 thuật ngữ liên quan', string_agg(c.id || ' (' || jsonb_array_length(c.related_term_ids) || ')', ', ' order by c.id)",
        "  from tm_characters c where c.kind = 'role' and c.is_active and jsonb_array_length(c.related_term_ids) < 4;",
        '', 'commit;', '']
    open(OUT, 'w', encoding='utf-8').write('\n'.join(sql))
    print('Đã ghi', os.path.relpath(OUT, ROOT))

    d = json.load(open(SEED, encoding='utf-8'))
    for c in d['characters']:
        if c['id'] in h['character_rank']:
            c['rank'] = h['character_rank'][c['id']]
    d['hourly'] = {'config': dict(cfg, is_enabled=True), 'actions': actions, 'lines': lines, 'quiz_questions': quiz, 'badges': badges}
    with open(SEED, 'w', encoding='utf-8') as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print('Đã ghép nhiệm vụ theo giờ vào', os.path.relpath(SEED, ROOT))


if __name__ == '__main__':
    main()
