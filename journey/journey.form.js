// Hình thái nhân vật theo các trạm đã ghé (docs/SPEC-journey.md mục 5.5). Dùng chung cho trang Hành trình và Team Map.
// window.TM_JOURNEY.form(checkpoints, visitedIds, combos) → { id, title, sub, props, halo, mains, branches }
(function(){
'use strict';
const KEY = 'tm_journey_v1';

function form(cps, visited, combos){
  const by = {}; cps.forEach(c => { by[c.id] = c; });
  const seen = (visited || []).filter((id, i, a) => by[id] && a.indexOf(id) === i);
  const mainsAll = cps.filter(c => c.kind === 'main').sort((a, b) => a.sort_order - b.sort_order);
  const mains = seen.filter(id => by[id].kind === 'main');
  const branches = seen.filter(id => by[id].kind === 'branch' && by[id].is_active !== false);
  const top = mains.length ? mains.map(id => by[id]).sort((a, b) => b.sort_order - a.sort_order)[0] : (cps.find(c => c.kind === 'start') || { id:'start', form_title:'Newbie', form_props:['backpack'] });
  // đồ nghề: bộ đồ của trạm chính cao nhất + đồ của các nhánh; xếp theo thời điểm ghé để món mới hơn thắng khi trùng vị trí
  const at = id => { const i = seen.indexOf(id); return i < 0 ? -1 : i; };
  const items = [];
  (top.form_props || []).forEach(p => items.push([at(top.id), p]));
  branches.forEach(id => (by[id].form_props || []).forEach(p => items.push([at(id), p])));
  items.sort((a, b) => a[0] - b[0]);
  const list = items.map(x => x[1]);
  const props = window.TM_MASCOT ? window.TM_MASCOT.resolveProps(list) : list;
  const combo = (combos || []).find(c => (c.requires || []).length && c.requires.every(r => branches.includes(r)));
  const sub = combo ? combo.title_suffix : branches.map(id => by[id].form_title).join(' · ');
  const last = mainsAll[mainsAll.length - 1];
  return { id:top.id, title:top.form_title, sub, props, halo:!!(last && mains.includes(last.id)), mains, branches, mainsAll:mainsAll.map(c => c.id) };
}

// tiến độ lưu trên trình duyệt (bọc try/catch: chặn localStorage thì vẫn chạy, chỉ không lưu)
function read(){
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && Array.isArray(v.visited)) return { visited:v.visited, challenge_passed:v.challenge_passed || [], finished_at:v.finished_at || null, workplace:v.workplace || null }; } catch (e) {}
  return { visited:[], challenge_passed:[], finished_at:null, workplace:null };
}
function write(st){ try { localStorage.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; } }

window.TM_JOURNEY = { form, read, write, KEY };
})();
