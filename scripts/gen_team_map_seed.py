#!/usr/bin/env python3
"""Sinh supabase_team_map_seed.sql từ team-map/seed.json.

    python3 scripts/gen_team_map_seed.py

File SQL sinh ra chạy trong Supabase → SQL Editor (sau supabase_team_map.sql).
Upsert theo id nên chạy lại không tạo trùng — nhưng sẽ GHI ĐÈ nội dung đã sửa trong CMS
bằng nội dung trong seed.json. Chỉ chạy lại khi muốn khôi phục dữ liệu gốc.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'team-map', 'seed.json')
OUT = os.path.join(ROOT, 'supabase_team_map_seed.sql')


def lit(v):
    """Giá trị Python → literal SQL."""
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (list, dict)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def rows(items, cols):
    return ',\n'.join('  (' + ', '.join(lit(it.get(c)) for c in cols) + ')' for it in items)


def upsert(table, items, cols, key='id', skip_update=()):
    qcols = ', '.join('"group"' if c == 'group' else c for c in cols)
    sets = ', '.join(f'{q} = excluded.{q}' for q in ('"group"' if c == 'group' else c for c in cols if c != key and c not in skip_update))
    return f'insert into {table} ({qcols}) values\n{rows(items, cols)}\non conflict ({key}) do update set {sets};\n'


def main():
    d = json.load(open(SRC, encoding='utf-8'))
    pids = {p['id'] for p in d['placements']}
    scale_of = {p['id']: p['scale'] for p in d['placements']}
    # kiểm tra tham chiếu trước khi sinh SQL
    for q in d['quests']:
        for ref in [q['giver'], *q['gather']]:
            assert ref in pids and scale_of[ref] == q['scale'], (q['id'], ref)
    for s in d['quest_steps']:
        if s['type'] == 'talk':
            assert s['target'] in pids, (s['id'], s['target'])

    chars = [dict(c, reports_to=None, reports_to_small=None) for c in d['characters']]
    out = ['-- ════════════════════════════════════════════════════════',
           '-- TEAM MAP — seed (sinh tự động bởi scripts/gen_team_map_seed.py, đừng sửa tay)',
           '-- Chạy sau supabase_team_map.sql. Upsert theo id: chạy lại sẽ ghi đè nội dung đã sửa trong CMS.',
           '-- ════════════════════════════════════════════════════════',
           'begin;', '',
           '-- 1. Phòng ban (chỉ nội dung)',
           upsert('tm_rooms', d['rooms'], ['id', 'scale', 'code', 'name', 'intro', 'sort_order']),
           '-- 2. Nhân vật (lượt 1: chưa gắn báo cáo cho ai)',
           upsert('tm_characters', chars,
                  ['id', 'title', 'kind', 'group', 'article_url', 'summary', 'doing', 'with_designer',
                   'props', 'appearance', 'tag', 'cta', 'is_active']),
           '-- lượt 2: báo cáo cho ai',
           'update tm_characters c set reports_to = v.rt, reports_to_small = v.rts from (values',
           ',\n'.join(f"  ({lit(c['id'])}, {lit(c['reports_to'])}, {lit(c['reports_to_small'])})" for c in d['characters']),
           ') as v(id, rt, rts) where c.id = v.id;', '',
           '-- 3. Vị trí',
           upsert('tm_placements', d['placements'], ['id', 'character_id', 'scale', 'room_id', 'seat_order']),
           '-- 4. Nhiệm vụ',
           upsert('tm_quests', d['quests'],
                  ['id', 'type', 'scale', 'sort_order', 'title', 'room_id', 'giver', 'gather',
                   'offer_text', 'done_text', 'rewards', 'is_active', 'daily_date']),
           '-- 5. Bước nhiệm vụ',
           upsert('tm_quest_steps', d['quest_steps'],
                  ['id', 'quest_id', 'sort_order', 'type', 'target', 'task_text', 'line_text', 'secs']),
           '''-- 6. Gắn nhân vật với thuật ngữ nhóm "Vai trò" theo URL bài viết (bỏ dấu / cuối khi so sánh).
--    Khớp → đặt term_id và xoá article_url (game lấy URL của thuật ngữ). Không khớp → giữ article_url.
with recursive vt as (
  select id from categories where slug = 'vai-tro'
  union all
  select c.id from categories c join vt on c.parent_id = vt.id
), m as (
  select distinct on (ch.id) ch.id as cid, t.id as tid
  from tm_characters ch
  join concepts t on t.category_id in (select id from vt)
                 and t.url is not null
                 and rtrim(lower(t.url), '/') = rtrim(lower(ch.article_url), '/')
  where ch.article_url is not null
  order by ch.id, t.is_published desc
)
update tm_characters ch set term_id = m.tid, article_url = null from m where ch.id = m.cid;

-- 7. Thẻ thưởng: {type:'term', name, url} → {type:'term', term_id}.
--    Ưu tiên khớp cả URL lẫn tên (vd Agile và Waterfall dùng chung một bài), rồi theo tên, rồi theo URL.
--    Không khớp thì giữ nguyên dạng cũ (game vẫn hiện tên + link) và liệt kê ở báo cáo bên dưới.
update tm_quests q set rewards = (
  select coalesce(jsonb_agg(
    case when r ->> 'type' = 'term' and not (r ? 'term_id') then coalesce(
      (select jsonb_build_object('type', 'term', 'term_id', t.id) from concepts t
        where lower(t.name) = lower(r ->> 'name')
        order by (t.url is not null and rtrim(lower(t.url), '/') = rtrim(lower(r ->> 'url'), '/')) desc, t.is_published desc limit 1),
      (select jsonb_build_object('type', 'term', 'term_id', t.id) from concepts t
        where t.url is not null and rtrim(lower(t.url), '/') = rtrim(lower(r ->> 'url'), '/')
        order by t.is_published desc limit 1),
      r)
    else r end order by n), '[]'::jsonb)
  from jsonb_array_elements(q.rewards) with ordinality as e(r, n)
);

commit;

-- 8. BÁO CÁO — nhân vật nào đã gắn thuật ngữ, thẻ thưởng nào chưa khớp thuật ngữ (cần xử lý tay trong CMS)
select 'Nhân vật đã gắn thuật ngữ' as loai, ch.id as ma, ch.title || ' → ' || t.name as chi_tiet
from tm_characters ch join concepts t on t.id = ch.term_id
union all
select 'Nhân vật có link riêng, chưa gắn thuật ngữ', ch.id, ch.article_url
from tm_characters ch where ch.term_id is null and ch.article_url is not null
union all
select 'Nhân vật chưa có bài', ch.id, ch.title
from tm_characters ch where ch.term_id is null and ch.article_url is null and ch.kind = 'role'
union all
select 'Thẻ thưởng CHƯA khớp thuật ngữ', q.id, (r ->> 'name') || ' · ' || coalesce(r ->> 'url', '')
from tm_quests q, jsonb_array_elements(q.rewards) r
where r ->> 'type' = 'term' and not (r ? 'term_id')
order by 1, 2;
'''.rstrip() + '\n']
    open(OUT, 'w', encoding='utf-8').write('\n'.join(out))
    print('Đã ghi', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
