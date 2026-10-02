#!/usr/bin/env python3
"""Sinh hai file seed từ team-map/seed.json:

    python3 scripts/gen_team_map_seed.py

- supabase_team_map_seed.sql: dữ liệu đầy đủ mọi quy mô, cho DB mới.
  Upsert theo id nên chạy lại không tạo trùng — nhưng sẽ GHI ĐÈ nội dung đã sửa trong CMS.
- supabase_team_map_agency_seed.sql: chỉ phần quy mô Agency / Outsource, cho DB đã có dữ liệu.
  Chỉ thêm phòng, nhân vật mới, vị trí, nhiệm vụ của agency và cột reports_to_agency;
  không sửa nội dung các nhân vật cũ.

- supabase_team_map_en.sql: chỉ bản tiếng Anh (cột i18n.en), cho DB đã có dữ liệu.
  Không đụng tới nội dung tiếng Việt đã sửa trong CMS.

Bản tiếng Anh lấy từ team-map/i18n-en.json và được ghép vào team-map/seed.json (trường i18n)
để trang /en/team-map vẫn có tiếng Anh khi phải dùng seed dự phòng.

Tất cả chạy trong Supabase → SQL Editor, sau supabase_team_map.sql.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'team-map', 'seed.json')
OUT = os.path.join(ROOT, 'supabase_team_map_seed.sql')
OUT_AGENCY = os.path.join(ROOT, 'supabase_team_map_agency_seed.sql')
SRC_EN = os.path.join(ROOT, 'team-map', 'i18n-en.json')
OUT_EN = os.path.join(ROOT, 'supabase_team_map_en.sql')
EN_GROUPS = [('characters', 'characters', 'tm_characters'), ('rooms', 'rooms', 'tm_rooms'),
             ('quests', 'quests', 'tm_quests'), ('quest_steps', 'steps', 'tm_quest_steps')]


def merge_en(d):
    """Ghép bản tiếng Anh vào từng dòng của seed.json (trường i18n.en)."""
    en = json.load(open(SRC_EN, encoding='utf-8'))
    for key, en_key, _ in EN_GROUPS:
        tr = en[en_key]
        ids = {it['id'] for it in d[key]}
        unknown = set(tr) - ids
        assert not unknown, f'i18n-en.json có id không tồn tại trong {key}: {sorted(unknown)}'
        for it in d[key]:
            if it['id'] in tr:
                it['i18n'] = {'en': tr[it['id']]}
            else:
                it.pop('i18n', None)
    return d


def build_en(d):
    out = ['-- ════════════════════════════════════════════════════════',
           '-- TEAM MAP — bản tiếng Anh (sinh tự động bởi scripts/gen_team_map_seed.py, đừng sửa tay)',
           '-- Chạy sau supabase_team_map.sql. Chỉ ghi cột i18n.en (nội dung trang /en/team-map),',
           '-- không đụng tới nội dung tiếng Việt. Chạy lại sẽ ghi đè bản tiếng Anh đã sửa trong CMS.',
           '-- ════════════════════════════════════════════════════════', 'begin;', '']
    for key, _, table in EN_GROUPS:
        items = [it for it in d[key] if it.get('i18n')]
        out.append(f'-- {table}: {len(items)} dòng')
        out.append(f"update {table} t set i18n = jsonb_set(t.i18n, '{{en}}', v.en) from (values")
        out.append(',\n'.join(f"  ({lit(it['id'])}, {lit(it['i18n']['en'])})" for it in items))
        out.append(') as v(id, en) where t.id = v.id;\n')
    out += ['commit;', '',
            '-- Kiểm tra: số dòng đã có bản tiếng Anh',
            "select 'tm_characters' as bang, count(*) filter (where i18n ? 'en') as co_tieng_anh, count(*) as tong from tm_characters",
            "union all select 'tm_rooms', count(*) filter (where i18n ? 'en'), count(*) from tm_rooms",
            "union all select 'tm_quests', count(*) filter (where i18n ? 'en'), count(*) from tm_quests",
            "union all select 'tm_quest_steps', count(*) filter (where i18n ? 'en'), count(*) from tm_quest_steps;", '']
    return '\n'.join(out)


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
    if not items:
        return f'-- ({table}: không có dòng nào)\n'
    qcols = ', '.join('"group"' if c == 'group' else c for c in cols)
    sets = ', '.join(f'{q} = excluded.{q}' for q in ('"group"' if c == 'group' else c for c in cols if c != key and c not in skip_update))
    return f'insert into {table} ({qcols}) values\n{rows(items, cols)}\non conflict ({key}) do update set {sets};\n'


# Gắn thuật ngữ + chuyển thẻ thưởng sang term_id + báo cáo. {CHARS} / {QUESTS} / {HINTS} được thay khi sinh.
TAIL = """-- 6. Gắn nhân vật với thuật ngữ nhóm "Vai trò": theo URL bài viết (bỏ dấu / cuối khi so sánh),
--    hoặc theo tên thuật ngữ gợi ý (term_search). Khớp → đặt term_id và xoá article_url (game lấy URL của thuật ngữ).
--    Không khớp → giữ article_url.
with recursive vt as (
  select id from categories where slug = 'vai-tro'
  union all
  select c.id from categories c join vt on c.parent_id = vt.id
), hint(cid, name) as (values {HINTS}
), m as (
  select distinct on (ch.id) ch.id as cid, t.id as tid
  from tm_characters ch
  left join hint h on h.cid = ch.id
  join concepts t on t.category_id in (select id from vt)
                 and ((t.url is not null and ch.article_url is not null and rtrim(lower(t.url), '/') = rtrim(lower(ch.article_url), '/'))
                      or (h.name is not null and lower(t.name) = lower(h.name)))
  where {CHARS} and ch.term_id is null
  order by ch.id, t.is_published desc
)
update tm_characters ch set term_id = m.tid, article_url = null from m where ch.id = m.cid;

-- 7. Thẻ thưởng: {type:'term', name, url} → {type:'term', term_id}.
--    Ưu tiên khớp cả tên lẫn URL (vd Agile và Waterfall dùng chung một bài), rồi theo tên, rồi theo URL.
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
) where {QUESTS};

commit;

-- 8. BÁO CÁO — nhân vật nào đã gắn thuật ngữ, thẻ thưởng nào chưa khớp thuật ngữ (cần xử lý tay trong CMS)
select 'Nhân vật đã gắn thuật ngữ' as loai, ch.id as ma, ch.title || ' → ' || t.name as chi_tiet
from tm_characters ch join concepts t on t.id = ch.term_id where {CHARS}
union all
select 'Nhân vật có link riêng, chưa gắn thuật ngữ', ch.id, ch.article_url
from tm_characters ch where {CHARS} and ch.term_id is null and ch.article_url is not null
union all
select 'Nhân vật chưa có bài', ch.id, ch.title
from tm_characters ch where {CHARS} and ch.term_id is null and ch.article_url is null and ch.kind = 'role'
union all
select 'Thẻ thưởng CHƯA khớp thuật ngữ', q.id, (r ->> 'name') || ' · ' || coalesce(r ->> 'url', '')
from tm_quests q, jsonb_array_elements(q.rewards) r
where {QUESTS} and r ->> 'type' = 'term' and not (r ? 'term_id')
order by 1, 2;
"""


def check(d):
    pids = {p['id'] for p in d['placements']}
    scale_of = {p['id']: p['scale'] for p in d['placements']}
    room_scale = {r['id']: r['scale'] for r in d['rooms']}
    for p in d['placements']:
        assert p['id'] == f"{p['character_id']}@{p['room_id']}" and room_scale[p['room_id']] == p['scale'], p['id']
    for q in d['quests']:
        assert room_scale[q['room_id']] == q['scale'], (q['id'], q['room_id'])
        for ref in [q['giver'], *q['gather']]:
            assert ref in pids and scale_of[ref] == q['scale'], (q['id'], ref)
    for st in d['quest_steps']:
        if st['type'] == 'talk':
            assert st['target'] in pids, (st['id'], st['target'])


def build(d, agency_only=False):
    if agency_only:
        rooms = [r for r in d['rooms'] if r['scale'] == 'agency']
        new_chars = [c for c in d['characters'] if 'term_search' in c]   # nhân vật mới của agency
        placements = [p for p in d['placements'] if p['scale'] == 'agency']
        quests = [q for q in d['quests'] if q['scale'] == 'agency']
        qids = {q['id'] for q in quests}
        steps = [st for st in d['quest_steps'] if st['quest_id'] in qids]
        chars_scope = 'ch.id in (' + ', '.join(lit(c['id']) for c in new_chars) + ')'
        quests_scope = "q.scale = 'agency'"
        head = ['-- TEAM MAP — seed quy mô Agency / Outsource (sinh tự động bởi scripts/gen_team_map_seed.py, đừng sửa tay)',
                '-- Chạy sau supabase_team_map.sql trên DB ĐÃ CÓ dữ liệu Team Map. Chỉ thêm / cập nhật phần agency:',
                '-- 6 phòng A1–A6, 5 nhân vật mới, 17 vị trí, 8 nhiệm vụ, cột reports_to_agency. Không sửa nội dung nhân vật cũ.',
                '-- Chạy lại nhiều lần không tạo trùng (upsert theo id), nhưng sẽ ghi đè phần agency đã sửa trong CMS.']
        reports_sql = ['-- lượt 2: báo cáo cho ai ở agency (chỉ cột reports_to_agency, kể cả với nhân vật cũ)',
                       'update tm_characters c set reports_to_agency = v.rta from (values',
                       ',\n'.join(f"  ({lit(c['id'])}, {lit(c.get('reports_to_agency'))})" for c in d['characters'] if c.get('reports_to_agency')),
                       ') as v(id, rta) where c.id = v.id;']
    else:
        rooms, new_chars, placements, quests, steps = d['rooms'], d['characters'], d['placements'], d['quests'], d['quest_steps']
        chars_scope, quests_scope = 'true', 'true'
        head = ['-- TEAM MAP — seed đầy đủ mọi quy mô (sinh tự động bởi scripts/gen_team_map_seed.py, đừng sửa tay)',
                '-- Chạy sau supabase_team_map.sql cho DB mới. Upsert theo id: chạy lại sẽ ghi đè nội dung đã sửa trong CMS.',
                '-- DB đã có dữ liệu và chỉ cần thêm quy mô Agency: dùng supabase_team_map_agency_seed.sql.']
        reports_sql = ['-- lượt 2: báo cáo cho ai',
                       'update tm_characters c set reports_to = v.rt, reports_to_small = v.rts, reports_to_agency = v.rta from (values',
                       ',\n'.join(f"  ({lit(c['id'])}, {lit(c['reports_to'])}, {lit(c['reports_to_small'])}, {lit(c.get('reports_to_agency'))})"
                                  for c in d['characters']),
                       ') as v(id, rt, rts, rta) where c.id = v.id;']

    hints = ', '.join(f"({lit(c['id'])}, {lit(c['term_search'])})" for c in new_chars if c.get('term_search')) or '(null::text, null::text)'
    chars = [dict(c, reports_to=None, reports_to_small=None) for c in new_chars]
    out = ['-- ════════════════════════════════════════════════════════', *head,
           '-- ════════════════════════════════════════════════════════',
           'begin;', '',
           '-- 1. Phòng ban (chỉ nội dung; hình học nằm trong team-map/team-map.layout.js)',
           upsert('tm_rooms', rooms, ['id', 'scale', 'code', 'name', 'intro', 'sort_order', 'i18n']),
           '-- 2. Nhân vật (lượt 1: chưa gắn báo cáo cho ai)',
           upsert('tm_characters', chars,
                  ['id', 'title', 'kind', 'group', 'article_url', 'summary', 'doing', 'with_designer',
                   'props', 'appearance', 'tag', 'cta', 'is_active', 'i18n']),
           *reports_sql, '',
           '-- 3. Vị trí (fixed = ngồi cố định, không đi dạo, không tới điểm tập hợp)',
           upsert('tm_placements', placements, ['id', 'character_id', 'scale', 'room_id', 'seat_order', 'fixed']),
           '-- 4. Nhiệm vụ',
           upsert('tm_quests', quests,
                  ['id', 'type', 'scale', 'sort_order', 'title', 'room_id', 'giver', 'gather',
                   'offer_text', 'done_text', 'rewards', 'is_active', 'daily_date', 'i18n']),
           '-- 5. Bước nhiệm vụ',
           upsert('tm_quest_steps', steps,
                  ['id', 'quest_id', 'sort_order', 'type', 'target', 'task_text', 'line_text', 'secs', 'i18n']),
           TAIL.replace('{HINTS}', hints).replace('{CHARS}', chars_scope).replace('{QUESTS}', quests_scope)]
    return '\n'.join(out)


def main():
    d = merge_en(json.load(open(SRC, encoding='utf-8')))
    check(d)
    with open(SRC, 'w', encoding='utf-8') as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print('Đã ghép bản tiếng Anh vào', os.path.relpath(SRC, ROOT))
    for path, agency_only in [(OUT, False), (OUT_AGENCY, True)]:
        open(path, 'w', encoding='utf-8').write(build(d, agency_only))
        print('Đã ghi', os.path.relpath(path, ROOT))
    open(OUT_EN, 'w', encoding='utf-8').write(build_en(d))
    print('Đã ghi', os.path.relpath(OUT_EN, ROOT))


if __name__ == '__main__':
    main()
