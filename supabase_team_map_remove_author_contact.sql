-- Team Map: bỏ nút liên hệ (link nhanluu.com/contact) trong bảng của nhân vật Nhân Lưu.
-- Chỉ đụng vào dòng nhan-luu: xoá nút có link /contact khỏi cta, đồng thời xoá nhãn tiếng Anh cùng vị trí
-- trong i18n.en.cta (nhãn EN ghép với nút theo thứ tự). Các nút khác và nội dung đã sửa trong CMS giữ nguyên.
-- Chạy lại nhiều lần an toàn (lần sau không còn gì để xoá).
with c as (
  select id, cta, i18n,
    (select array_agg(o - 1) from jsonb_array_elements(coalesce(cta, '[]'::jsonb)) with ordinality e(b, o)
      where b->>'url' ~* '^https?://(www\.)?nhanluu\.com/contact/?$') as drop_idx
  from tm_characters where id = 'nhan-luu'
)
update tm_characters t set
  cta = (select coalesce(jsonb_agg(b order by o), '[]'::jsonb) from jsonb_array_elements(c.cta) with ordinality e(b, o) where not (o - 1 = any(c.drop_idx))),
  i18n = case when jsonb_typeof(c.i18n #> '{en,cta}') = 'array'
    then jsonb_set(c.i18n, '{en,cta}', (select coalesce(jsonb_agg(l order by o), '[]'::jsonb) from jsonb_array_elements(c.i18n #> '{en,cta}') with ordinality e(l, o) where not (o - 1 = any(c.drop_idx))))
    else c.i18n end
from c
where t.id = c.id and c.drop_idx is not null;

select id, cta, i18n #> '{en,cta}' as cta_en from tm_characters where id = 'nhan-luu';
