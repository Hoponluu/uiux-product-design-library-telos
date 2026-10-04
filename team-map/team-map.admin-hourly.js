// Team Map CMS — nhiệm vụ theo giờ (SPEC-hourly mục 8): 3 tab mới, nhóm trường trong form nhân vật, 4 sheet Excel.
// team-map.admin.js gọi window.TM_ADMIN_HOURLY(ctx) với các helper của nó; module này không tự đăng ký sự kiện nào.
window.TM_ADMIN_HOURLY = function(X){
'use strict';
const H = window.TM_HOURLY, { S, esc, toast } = X;
const ACTIONS = H.ACTIONS;
const KIND_BY_ACTION = { poptask:['task','react'], fight:['start'], coffee:['spill','thanks'], hide:['hint','found'], race:['start'], gossip:['say','caught'], read:[], flashcard:[] };
const KIND_LABEL = { task:'Chữ trên tờ pop-task', react:'Nhân vật bị ném trúng', start:'Nhân vật lúc bắt đầu', spill:'NPC bị đổ cà phê', thanks:'Nhân vật nhận cà phê',
  hint:'NPC khi được hỏi ({room} = phòng đang trốn)', found:'Nhân vật khi bị tìm ra', say:'Câu nấu xói (nhân vật = người bị nấu xói)', caught:'Người bị nấu xói bắt quả tang' };
const COND_LABEL = { wins:'Số lần thắng', distinct_characters:'Thắng với N nhân vật khác nhau', flawless_wins:'Số lần thắng sạch', win_streak:'Chuỗi thắng liên tiếp',
  win_under_secs:'Thắng trong ≤ N giây', win_vs:'Thắng một nhân vật / một khoảng cấp bậc', fail_count:'Số lần thua theo kiểu', all_actions:'Thắng mọi hành động đang bật', event:'Hành động đặc biệt (ngoài mini-game)' };
// nhãn tiếng Việt cho các khoá trong config
const CFG_LABEL = { options:'Số đáp án', retry_wait_secs:'Chờ trước khi hỏi lại (giây)', duration_secs:'Thời lượng (giây)', start_percent:'Thanh lực ban đầu (%)', tap_gain:'Mỗi lần bấm tăng',
  npc_base:'Lực đẩy cơ bản / giây', npc_per_rank:'Lực đẩy thêm mỗi cấp', max_taps_per_sec:'Tối đa lần bấm / giây', ammo:'Số tờ pop-task', hits_needed:'Số phát cần trúng',
  flight_secs:'Thời gian bay (giây)', hit_radius:'Bán kính trúng', max_range:'Tầm ném xa nhất', target_speed_factor:'Hệ số tốc độ nhân vật', cards:'Số thẻ', pass_correct:'Số thẻ đúng để thắng',
  min_terms:'Thuật ngữ tối thiểu của nhân vật', secs_per_cup:'Giây cho mỗi ly', max_cups:'Số ly tối đa', spill_radius:'Bán kính va chạm', secs:'Thời gian tìm (giây)', countdown_secs:'Đếm ngược (giây)',
  speed_top:'Tốc độ cấp 1 (× người chơi)', speed_step:'Giảm mỗi cấp', npc_delay_secs:'Nhân vật xuất phát trễ (giây)', false_start_penalty_secs:'Phạt xuất phát sớm (giây)',
  fill_secs:'Tổng giây giữ để đầy thanh', time_limit_secs:'Giới hạn thời gian (giây)', hear_radius:'Bán kính tầm nghe', grace_secs:'Độ trễ trước khi bị bắt (giây)', warn_secs:'Báo "?" trước (giây)',
  pause_secs:'Nhân vật đứng lại (giây)', aim_assist:'Bấm cách nhân vật bao xa vẫn tự nhắm (m)' };
const RANKS = { 1:'Thực tập', 2:'Nhân viên', 3:'Lead / PM', 4:'Manager', 5:'Head / Director', 6:'C-level / Stakeholder', 7:'Client', 8:'User' };
const HEX = /^#[0-9a-f]{6}$/i;
const toLocalInput = iso => { const d = new Date(iso), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
const charName = id => { const c = X.charOf(id); return c ? c.title : id; };
const actName = id => (S.hourly.actions.find(a => a.id === id) || {}).name || id;
const termName = id => { const t = allConcepts.find(x => String(x.id) === String(id)); return t ? t.name : `#${id}`; };
const F = () => S.hform;

// ---------- dữ liệu ----------
async function load(){
  try {
    const [config, actions, lines, quiz, badges] = await Promise.all([sbGet('tm_hourly_config', 'select=*&id=eq.1'), sbGet('tm_hourly_actions', 'select=*&order=sort_order'),
      sbGet('tm_hourly_lines', 'select=*&order=id'), sbGet('tm_quiz_questions', 'select=*&order=id'), sbGet('tm_badges', 'select=*&order=sort_order')]);
    S.hourly = { config:Object.assign({ id:1, slot_minutes:30, open_count:4, is_enabled:true }, config[0] || {}), actions, lines, quiz, badges };
  } catch (e) { S.hourly = null; console.warn('[Team Map CMS] Chưa có bảng nhiệm vụ theo giờ:', e.message); }
}
// dữ liệu giống hệt game (loader + logic chung) để tính "Đang chạy" và lý do hợp lệ
function gameData(){
  const raw = { characters:S.chars, rooms:S.rooms, placements:S.pls, quests:S.quests.filter(q => q.type === 'main' && q.is_active !== false), steps:S.steps, terms:allConcepts,
    hourly:{ config:S.hourly.config, actions:S.hourly.actions, lines:S.hourly.lines, quiz_questions:S.hourly.quiz, badges:S.hourly.badges } };
  return TeamMapLoader.build(raw).data;
}

// ════════════════════════════════════════════════════════
// TAB "NHIỆM VỤ THEO GIỜ"
// ════════════════════════════════════════════════════════
function renderHourly(){
  const C = S.hourly.config;
  let running = '';
  try {
    const D = gameData(), slot = H.slotAt(C), fmt = s => new Date(s * H.slotMs(C)).toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
    const fun = a => !H.ALWAYS_OPEN.includes(a);
    const rows = C.is_enabled ? Array.from({ length:8 }, (_, k) => `<tr${k ? '' : ' class="tm-now"'}><td>${k ? fmt(slot + k) : 'Đang chạy'}</td><td>${H.openAt(D, slot + k).filter(fun).map(a => esc(actName(a))).join(' · ') || '—'}</td></tr>`).join('') : '';
    const counts = Object.keys(D.SCALES).map(sc => `<li><b>${esc(X.SCALE_NAME[sc])}</b>: ${H.ACTIONS.filter(a => D.HOURLY.actions[a]).map(a => `${esc(actName(a))} ${H.targets(D, sc, a).length}`).join(' · ')}</li>`).join('');
    running = C.is_enabled ? `<table class="tm-runtable"><tbody>${rows}</tbody></table><p class="tm-note" style="margin-top:10px">Số người chọn được cho mỗi hành động:</p><ul class="tm-runcount">${counts}</ul>`
      : '<p class="tm-note">Đang tắt toàn bộ tính năng.</p>';
  } catch (e) { running = `<p class="tm-warn">Không tính được: ${esc(e.message)}</p>`; }
  X.body().innerHTML = `<div class="toolbar"><h2>Hành động</h2></div>
    <p class="tm-note">Người chơi bấm vào một nhân vật: các hành động chơi được với người đó hiện thành vòng quanh họ (hành động đang khoá có ổ khoá); lần thắng nào cũng tính vào huy hiệu. <b>Đọc bài</b> và <b>Lật flashcard</b> luôn mở; mỗi lượt mở thêm một số hành động vui (theo trọng số), mọi người chơi thấy giống nhau. Lưu là có hiệu lực ở lần tải trang sau.</p>
    <div class="tm-hgrid">
      <div class="export-card"><h3>Cấu hình</h3>
        <label class="tm-check"><input type="checkbox" data-hc="is_enabled"${C.is_enabled ? ' checked' : ''}/> Bật các hành động (menu tròn quanh nhân vật)</label>
        <div class="form-row">
          <div class="form-group"><label>Độ dài một lượt (phút)</label><input class="form-control" type="number" min="5" max="1440" data-hc="slot_minutes" value="${C.slot_minutes}"/></div>
          <div class="form-group"><label>Số hành động vui mở mỗi lượt (0–6)</label><input class="form-control" type="number" min="0" max="6" data-hc="open_count" value="${C.open_count ?? 4}"/><div class="form-hint">6 = mở hết</div></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Cấp mã huy hiệu từ</label><input class="form-control" type="datetime-local" data-hc="award_start" value="${C.award_start ? toLocalInput(C.award_start) : ''}"/><div class="form-hint">Huy hiệu đạt từ lúc này mới có mã (giờ theo máy bạn)</div></div>
        </div>
        <button class="btn-save" data-act="h-cfg-save">Lưu cấu hình</button></div>
      <div class="export-card"><h3>Các lượt sắp tới</h3><p class="tm-note">Hành động vui mở ở lượt hiện tại và 7 lượt kế tiếp, tính bằng đúng hàm game dùng (theo dữ liệu đã lưu).</p>${running}</div>
    </div>
    <h3 class="tm-h3">8 hành động</h3>
    <div class="tm-actions">${S.hourly.actions.map(a => `<div class="tm-actcard${a.is_active ? '' : ' off'}">
      <div class="tm-actcard-h"><b>${esc(a.name)}</b><code>${a.id}</code><span class="badge badge-sub">${H.ALWAYS_OPEN.includes(a.id) ? 'Luôn mở' : 'Trọng số ' + a.weight}</span>${X.enBadge(a, ['name','title_template','offer_text','win_text','lose_text'])}
        <button class="tm-toggle${a.is_active ? ' on' : ''}" data-act="h-act-toggle" data-id="${a.id}" aria-pressed="${a.is_active}" title="${a.is_active ? 'Đang bật — bấm để tắt' : 'Đang tắt — bấm để bật'}"></button>
        <button class="btn-edit" data-act="h-act-edit" data-id="${a.id}">Sửa</button></div>
      <div class="td-slug">${esc(a.title_template)}</div></div>`).join('')}</div>`;
}
function openAction(id){
  const a = S.hourly.actions.find(x => x.id === id), en = X.enOf(a), cfg = a.config || {};
  S.hform = { kind:'h-action', id };
  X.openModal(`Sửa hành động · ${a.name}`, `
    <div class="form-row"><div class="form-group"><label>Tên hiển thị *</label><input class="form-control" name="h_name" value="${esc(a.name)}"/></div>
      <div class="form-group"><label>Trọng số (≥ 1)</label><input class="form-control" type="number" min="1" name="h_weight" value="${a.weight}"/><div class="form-hint">${H.ALWAYS_OPEN.includes(id) ? 'Hành động này luôn mở, trọng số không dùng' : 'Càng lớn càng hay được mở'}</div></div></div>
    <div class="form-group"><label>Mẫu tên nhiệm vụ *</label><input class="form-control" name="h_title" value="${esc(a.title_template)}"/><div class="form-hint">Dùng {target}${id === 'gossip' ? ' và {partner}' : ''}</div></div>
    <div class="form-group"><label>Lời Nhân Lưu khi gợi ý</label><textarea class="form-control" name="h_offer" rows="2">${esc(a.offer_text || '')}</textarea></div>
    <div class="form-row"><div class="form-group"><label>Lời khi thắng</label><textarea class="form-control" name="h_win" rows="2">${esc(a.win_text || '')}</textarea></div>
      <div class="form-group"><label>Lời khi thua</label><textarea class="form-control" name="h_lose" rows="2">${esc(a.lose_text || '')}</textarea></div></div>
    <div class="tm-section">Tham số mini-game</div>
    <div class="tm-cfggrid">${Object.keys(cfg).map(k => `<div class="form-group"><label>${esc(CFG_LABEL[k] || k)}</label><input class="form-control" type="number" step="any" data-cfg="${k}" value="${cfg[k]}"/></div>`).join('')}</div>
    <details class="tm-en" open><summary class="tm-section">Tiếng Anh · trang /en/team-map</summary>
      ${X.enInput('en_name', 'Tên (tiếng Anh)', en.name)}${X.enInput('en_title', 'Mẫu tên nhiệm vụ (tiếng Anh)', en.title_template)}
      ${X.enInput('en_offer', 'Lời giao (tiếng Anh)', en.offer_text, 2)}${X.enInput('en_win', 'Lời thắng (tiếng Anh)', en.win_text, 2)}${X.enInput('en_lose', 'Lời thua (tiếng Anh)', en.lose_text, 2)}
    </details>
    <div class="tm-block"><label class="tm-check"><input type="checkbox" name="h_active"${a.is_active ? ' checked' : ''}/> Hiện trong menu tròn quanh nhân vật</label></div>`,
    `<button class="btn-cancel" data-act="close">Huỷ</button><button class="btn-save" data-act="h-act-save">Lưu</button>`);
}
async function saveAction(){
  const a = S.hourly.actions.find(x => x.id === F().id), root = X.formRoot(), fv = X.fv; X.clearErrs(root);
  if (!fv('h_name')) return X.setErr(root, '[name="h_name"]', 'Nhập tên');
  if (!fv('h_title')) return X.setErr(root, '[name="h_title"]', 'Nhập mẫu tên');
  if (!(parseInt(fv('h_weight')) >= 1)) return X.setErr(root, '[name="h_weight"]', 'Trọng số là số nguyên ≥ 1');
  const config = {}; let bad = false;
  root.querySelectorAll('[data-cfg]').forEach(i => { const v = Number(i.value); if (i.value === '' || isNaN(v) || v < 0){ bad = true; X.setErr(root, `[data-cfg="${i.dataset.cfg}"]`, 'Số ≥ 0'); } config[i.dataset.cfg] = v; });
  if (bad) return;
  try {
    await sbUpdate('tm_hourly_actions', a.id, { name:fv('h_name'), title_template:fv('h_title'), offer_text:fv('h_offer') || null, win_text:fv('h_win') || null, lose_text:fv('h_lose') || null,
      weight:parseInt(fv('h_weight')), config, is_active:fv('h_active'),
      i18n:X.withEn(a.i18n, { name:fv('en_name'), title_template:fv('en_title'), offer_text:fv('en_offer'), win_text:fv('en_win'), lose_text:fv('en_lose') }) });
    toast('Đã lưu hành động'); X.closeModal(); await X.reload();
  } catch (e) { toast('Lỗi: ' + e.message, true); }
}
async function saveConfig(){
  const v = k => X.body().querySelector(`[data-hc="${k}"]`), num = k => parseInt(v(k).value);
  const p = { is_enabled:v('is_enabled').checked, slot_minutes:num('slot_minutes'), open_count:num('open_count') };
  if (v('award_start') && v('award_start').value) p.award_start = new Date(v('award_start').value).toISOString();
  if (!(p.slot_minutes >= 5 && p.slot_minutes <= 1440)) return toast('Độ dài lượt từ 5 đến 1440 phút', true);
  if (!(p.open_count >= 0 && p.open_count <= 6)) return toast('Số hành động mở từ 0 đến 6', true);
  try { await sbUpdate('tm_hourly_config', 1, p); toast('Đã lưu cấu hình'); await X.reload(); } catch (e) { toast('Lỗi: ' + e.message, true); }
}

// ════════════════════════════════════════════════════════
// TAB "CÂU HỎI VÀ LỜI THOẠI"
// ════════════════════════════════════════════════════════
function renderLines(){
  const f = S.f; f.hqChar = f.hqChar || ''; f.hlAct = f.hlAct || ''; f.hlKind = f.hlKind || '';
  const quiz = S.hourly.quiz.filter(q => !f.hqChar || q.character_id === f.hqChar);
  const lines = S.hourly.lines.filter(l => (!f.hlAct || l.action_id === f.hlAct) && (!f.hlKind || l.kind === f.hlKind));
  const charOpts = sel => S.chars.filter(c => c.kind !== 'player').map(c => `<option value="${esc(c.id)}"${sel === c.id ? ' selected' : ''}>${esc(c.title)}</option>`).join('');
  X.body().innerHTML = `<div class="toolbar"><h2>Câu hỏi <span class="tm-count">(${quiz.length} / ${S.hourly.quiz.length})</span></h2>
      <select class="form-control tm-w-auto" data-hf="hqChar"><option value="">Mọi nhân vật</option>${charOpts(f.hqChar)}</select>
      <button class="btn-add" data-act="h-quiz-new">+ Thêm câu hỏi</button></div>
    <p class="tm-note">Dùng cho hành động "Đọc bài và trả lời": nhân vật cần có bài viết đã xuất bản và ít nhất một câu hỏi đang bật.</p>
    <div class="table-wrap"><table><thead><tr><th>Nhân vật</th><th>Câu hỏi</th><th>Đáp án đúng</th><th>Hiển thị</th><th></th></tr></thead><tbody>
    ${quiz.map(q => `<tr><td class="tm-nowrap">${esc(charName(q.character_id))}</td><td class="td-desc">${esc(q.question)} ${X.enBadge(q, ['question','options'])}</td><td class="td-desc">${esc((q.options || [])[q.correct_index] || '')}</td>
      <td><button class="tm-toggle${q.is_active ? ' on' : ''}" data-act="h-quiz-toggle" data-id="${esc(q.id)}" aria-pressed="${q.is_active}"></button></td>
      <td class="td-actions"><button class="btn-edit" data-act="h-quiz-edit" data-id="${esc(q.id)}">Sửa</button><button class="btn-del" data-act="h-quiz-del" data-id="${esc(q.id)}">Xoá</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Chưa có câu hỏi</td></tr>'}</tbody></table></div>

    <div class="toolbar"><h2>Lời thoại <span class="tm-count">(${lines.length} / ${S.hourly.lines.length})</span></h2>
      <select class="form-control tm-w-auto" data-hf="hlAct"><option value="">Mọi hành động</option>${ACTIONS.filter(a => KIND_BY_ACTION[a].length).map(a => `<option value="${a}"${f.hlAct === a ? ' selected' : ''}>${esc(actName(a))}</option>`).join('')}</select>
      <select class="form-control tm-w-auto" data-hf="hlKind"><option value="">Mọi loại câu</option>${Object.keys(KIND_LABEL).map(k => `<option value="${k}"${f.hlKind === k ? ' selected' : ''}>${k}</option>`).join('')}</select>
      <button class="btn-add" data-act="h-line-new">+ Thêm câu</button></div>
    <p class="tm-note">Ô nhân vật để trống = câu dùng chung. Game ưu tiên câu riêng của nhân vật, không có thì lấy ngẫu nhiên câu chung.</p>
    <div class="table-wrap"><table><thead><tr><th>Hành động</th><th>Loại</th><th>Nhân vật</th><th>Câu</th><th>Hiển thị</th><th></th></tr></thead><tbody>
    ${lines.map(l => `<tr><td class="tm-nowrap">${esc(actName(l.action_id))}</td><td><span class="badge badge-sub" title="${esc(KIND_LABEL[l.kind] || '')}">${esc(l.kind)}</span></td>
      <td class="tm-nowrap">${l.character_id ? esc(charName(l.character_id)) : '<span class="no-url">Dùng chung</span>'}</td><td class="td-desc">${esc(l.text)} ${X.enBadge(l, ['text'])}</td>
      <td><button class="tm-toggle${l.is_active ? ' on' : ''}" data-act="h-line-toggle" data-id="${esc(l.id)}" aria-pressed="${l.is_active}"></button></td>
      <td class="td-actions"><button class="btn-edit" data-act="h-line-edit" data-id="${esc(l.id)}">Sửa</button><button class="btn-del" data-act="h-line-del" data-id="${esc(l.id)}">Xoá</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">Không có câu phù hợp</td></tr>'}</tbody></table></div>`;
}
const nextId = (list, prefix) => { let n = list.length + 1; while (list.some(x => x.id === prefix + String(n).padStart(3, '0'))) n++; return prefix + String(n).padStart(3, '0'); };
function openQuiz(id){
  const q = id ? S.hourly.quiz.find(x => x.id === id) : null, en = X.enOf(q), opts = q ? q.options : ['', '', ''];
  S.hform = { kind:'h-quiz', orig:q };
  X.openModal(q ? 'Sửa câu hỏi' : 'Thêm câu hỏi', `
    <div class="form-group"><label>Nhân vật *</label><select class="form-control" name="q_char"><option value="">— Chọn nhân vật —</option>${S.chars.filter(c => c.kind === 'role' || c.kind === 'guest').map(c => `<option value="${esc(c.id)}"${(q ? q.character_id : S.f.hqChar) === c.id ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Câu hỏi *</label><textarea class="form-control" name="q_q" rows="2">${esc(q ? q.question : '')}</textarea></div>
    ${[0, 1, 2].map(i => `<div class="tm-row"><label class="tm-check"><input type="radio" name="q_ok" value="${i}"${(q ? q.correct_index : 0) === i ? ' checked' : ''}/> Đúng</label><input class="form-control" name="q_o${i}" value="${esc(opts[i] || '')}" placeholder="Đáp án ${i + 1} *"/></div>`).join('')}
    <details class="tm-en" open><summary class="tm-section">Tiếng Anh · trang /en/team-map</summary>
      ${X.enInput('en_q', 'Câu hỏi (tiếng Anh)', en.question, 2)}${[0, 1, 2].map(i => X.enInput('en_o' + i, `Đáp án ${i + 1} (tiếng Anh)`, (en.options || [])[i])).join('')}
      <p class="tm-note">Cần đủ cả 3 đáp án tiếng Anh thì trang EN mới dùng bản dịch.</p></details>
    <div class="tm-block"><label class="tm-check"><input type="checkbox" name="q_active"${!q || q.is_active ? ' checked' : ''}/> Hiển thị</label></div>`,
    `<button class="btn-cancel" data-act="close">Huỷ</button><button class="btn-save" data-act="h-quiz-save">Lưu</button>`);
}
async function saveQuiz(){
  const root = X.formRoot(), fv = X.fv, q = F().orig; X.clearErrs(root); let bad = false; const err = (s, m) => { bad = true; X.setErr(root, s, m); };
  if (!fv('q_char')) err('[name="q_char"]', 'Chọn nhân vật'); if (!fv('q_q')) err('[name="q_q"]', 'Nhập câu hỏi');
  [0, 1, 2].forEach(i => { if (!fv('q_o' + i)) err(`[name="q_o${i}"]`, 'Nhập đáp án'); }); if (bad) return;
  const enOpts = [0, 1, 2].map(i => fv('en_o' + i));
  const row = { character_id:fv('q_char'), question:fv('q_q'), options:[0, 1, 2].map(i => fv('q_o' + i)), correct_index:+root.querySelector('[name="q_ok"]:checked').value, is_active:fv('q_active'),
    i18n:X.withEn(q && q.i18n, { question:fv('en_q'), options: enOpts.every(Boolean) ? enOpts : null }) };
  try { if (q) await sbUpdate('tm_quiz_questions', q.id, row); else await sbInsert('tm_quiz_questions', { id:`qz-${row.character_id}-${Date.now().toString(36)}`, ...row });
    toast('Đã lưu câu hỏi'); X.closeModal(); await X.reload(); } catch (e) { toast('Lỗi: ' + e.message, true); }
}
function openLine(id){
  const l = id ? S.hourly.lines.find(x => x.id === id) : null, en = X.enOf(l), act = l ? l.action_id : (S.f.hlAct || 'poptask');
  S.hform = { kind:'h-line', orig:l };
  X.openModal(l ? 'Sửa lời thoại' : 'Thêm lời thoại', `
    <div class="form-row"><div class="form-group"><label>Hành động *</label><select class="form-control" name="l_act">${ACTIONS.filter(a => KIND_BY_ACTION[a].length).map(a => `<option value="${a}"${act === a ? ' selected' : ''}>${esc(actName(a))}</option>`).join('')}</select></div>
      <div class="form-group"><label>Loại câu *</label><select class="form-control" name="l_kind">${KIND_BY_ACTION[act].map(k => `<option value="${k}"${(l ? l.kind : S.f.hlKind) === k ? ' selected' : ''}>${k} · ${esc(KIND_LABEL[k])}</option>`).join('')}</select></div></div>
    <div class="form-group"><label>Nhân vật</label><select class="form-control" name="l_char"><option value="">— Dùng chung —</option>${S.chars.filter(c => c.kind !== 'player' && c.kind !== 'author').map(c => `<option value="${esc(c.id)}"${l && l.character_id === c.id ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select>
      <div class="form-hint">Với "say" của Nấu xói: nhân vật là người bị nấu xói</div></div>
    <div class="form-group"><label>Câu thoại *</label><textarea class="form-control" name="l_text" rows="2">${esc(l ? l.text : '')}</textarea></div>
    <details class="tm-en" open><summary class="tm-section">Tiếng Anh · trang /en/team-map</summary>${X.enInput('en_text', 'Câu thoại (tiếng Anh)', en.text, 2)}</details>
    <div class="tm-block"><label class="tm-check"><input type="checkbox" name="l_active"${!l || l.is_active ? ' checked' : ''}/> Hiển thị</label></div>`,
    `<button class="btn-cancel" data-act="close">Huỷ</button><button class="btn-save" data-act="h-line-save">Lưu</button>`);
}
async function saveLine(){
  const root = X.formRoot(), fv = X.fv, l = F().orig; X.clearErrs(root);
  if (!fv('l_text')) return X.setErr(root, '[name="l_text"]', 'Nhập câu thoại');
  if (!KIND_BY_ACTION[fv('l_act')].includes(fv('l_kind'))) return X.setErr(root, '[name="l_kind"]', 'Loại câu không hợp với hành động');
  const row = { action_id:fv('l_act'), kind:fv('l_kind'), character_id:fv('l_char') || null, text:fv('l_text'), is_active:fv('l_active'), i18n:X.withEn(l && l.i18n, { text:fv('en_text') }) };
  try { if (l) await sbUpdate('tm_hourly_lines', l.id, row); else await sbInsert('tm_hourly_lines', { id:nextId(S.hourly.lines, 'hl-'), ...row });
    toast('Đã lưu lời thoại'); X.closeModal(); await X.reload(); } catch (e) { toast('Lỗi: ' + e.message, true); }
}

// ════════════════════════════════════════════════════════
// TAB "HUY HIỆU"
// ════════════════════════════════════════════════════════
const condSummary = b => { const p = b.params || {};
  const extra = b.condition_type === 'win_vs' ? (p.character_id ? ` · ${charName(p.character_id)}` : ` · cấp ${p.rank_min || 1}–${p.rank_max || 8}`)
    : b.condition_type === 'win_under_secs' ? ` · ≤ ${p.secs}s` : b.condition_type === 'fail_count' ? ` · ${p.fail_kind} × ${b.threshold}`
    : b.condition_type === 'event' ? ` · ${(H.EVENTS[p.event] || [p.event])[0]}` : b.threshold ? ` · ${b.threshold}` : '';
  return `${COND_LABEL[b.condition_type] || b.condition_type}${b.action_id ? ' · ' + actName(b.action_id) : ''}${extra}`; };
function renderBadges(){
  const list = S.hourly.badges.slice().sort((a, b) => a.sort_order - b.sort_order);
  X.body().innerHTML = `<div class="toolbar"><h2>Huy hiệu <span class="tm-count">(${list.length})</span></h2><button class="btn-add" data-act="h-badge-new">+ Thêm huy hiệu</button></div>
    <p class="tm-note">Kéo ⋮⋮ để đổi thứ tự. Người chơi lưu huy hiệu trên trình duyệt: xoá một huy hiệu thì ai đã có cũng không còn thấy nó, nên ưu tiên tắt thay vì xoá.</p>
    <ul class="tm-qlist" data-sort="badges">${list.map((b, i) => `<li draggable="true" data-id="${esc(b.id)}" class="${b.is_active ? '' : 'off'}">
      <span class="tm-handle">⋮⋮</span><span class="tm-cointhumb" style="--rim:${esc(b.rim_color)}">${b.image_url ? `<img src="${esc(b.image_url)}" alt="">` : ''}</span>
      <div class="tm-qmain"><div class="td-name">${esc(b.name)} ${b.is_hidden ? '<span class="badge badge-sub">Ẩn</span>' : ''} ${b.is_active ? '' : '<span class="badge badge-draft">Đang tắt</span>'} ${b.reward_status !== 'none' ? `<span class="badge badge-vai-tro">Quà: ${b.reward_status}</span>` : ''} ${X.enBadge(b, ['name','description'])}</div>
        <div class="td-slug">${esc(b.id)} · ${esc(condSummary(b))}</div><div class="td-desc">${esc(b.description || '')}</div></div>
      <div class="td-actions"><button class="tm-toggle${b.is_active ? ' on' : ''}" data-act="h-badge-toggle" data-id="${esc(b.id)}" aria-pressed="${b.is_active}"></button>
        <button class="btn-edit" data-act="h-badge-edit" data-id="${esc(b.id)}">Sửa</button><button class="btn-del" data-act="h-badge-del" data-id="${esc(b.id)}">Xoá</button></div></li>`).join('') || '<li class="empty-state">Chưa có huy hiệu</li>'}</ul>`;
  X.sortable(X.body().querySelector('[data-sort="badges"]'), async ids => {
    try { await sbRpc('tm_reorder', { p_table:'tm_badges', p:ids.map((id, i) => ({ id, sort:i + 1 })) }); ids.forEach((id, i) => { S.hourly.badges.find(b => b.id === id).sort_order = i + 1; }); renderBadges(); toast('Đã đổi thứ tự'); }
    catch (e) { toast('Lỗi: ' + e.message, true); renderBadges(); } });
}
let preview = null;
function badgeFromForm(){ const fv = X.fv, rim = HEX.test(fv('b_rim')) ? fv('b_rim') : '#FFC53D';
  return { id:F().id || 'preview', name:fv('b_name'), desc:fv('b_desc'), image:F().image || null, rim }; }
function loadThree(){ return window.THREE ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; s.onload = res; s.onerror = () => rej(new Error('Không tải được Three.js')); document.head.appendChild(s); }); }
function openBadge(id){
  const b = id ? S.hourly.badges.find(x => x.id === id) : null, en = X.enOf(b), p = (b && b.params) || {};
  S.hform = { kind:'h-badge', orig:b, id:b ? b.id : '', image:b ? b.image_url : null };
  const actOpts = sel => `<option value="">— Không —</option>` + ACTIONS.map(a => `<option value="${a}"${sel === a ? ' selected' : ''}>${esc(actName(a))}</option>`).join('');
  X.openModal(b ? `Sửa huy hiệu · ${b.name}` : 'Thêm huy hiệu', `<div class="tm-badgeform"><div class="tm-badgefields">
    <div class="form-row"><div class="form-group"><label>Tên *</label><input class="form-control" name="b_name" value="${esc(b ? b.name : '')}"/></div>
      <div class="form-group"><label>Id *</label><input class="form-control" name="b_id" value="${esc(b ? b.id : '')}" ${b ? 'readonly' : ''} placeholder="vd: trum-giao-viec"/><div class="form-hint">${b ? 'Không đổi được (tiến độ người chơi lưu theo id)' : 'Tự tạo từ tên'}</div></div></div>
    <div class="form-group"><label>Mô tả trên thẻ</label><textarea class="form-control" name="b_desc" rows="2">${esc(b ? b.description || '' : '')}</textarea></div>
    <div class="form-group"><label>Hình mặt đồng xu</label><div class="tm-row"><input type="file" accept="image/png,image/webp,image/jpeg" data-act-change="b-upload" name="b_file"/>
      <button type="button" class="tm-link" data-act="h-badge-noimg">Bỏ hình</button></div>
      <div class="form-hint">PNG hoặc WebP vuông, khuyến nghị 1024 × 1024, tối đa 1 MB, nội dung chính nằm trong hình tròn nội tiếp. Trống thì dùng logo TELOS.</div>
      <div class="form-hint" data-imgstate>${b && b.image_url ? 'Đang dùng: ' + esc(b.image_url) : 'Chưa có hình'}</div></div>
    <div class="form-row"><div class="form-group"><label>Màu viền</label><div class="tm-row"><input type="color" name="b_rimpick" value="${esc(b ? b.rim_color : '#FFC53D')}"/><input class="form-control" name="b_rim" value="${esc(b ? b.rim_color : '#FFC53D')}" maxlength="7"/></div></div>
      <div class="form-group"><label>Thứ tự</label><input class="form-control" type="number" name="b_sort" value="${b ? b.sort_order : S.hourly.badges.length + 1}"/></div></div>
    <div class="tm-section">Điều kiện mở</div>
    <div class="form-row"><div class="form-group"><label>Loại điều kiện *</label><select class="form-control" name="b_type">${H.CONDITIONS.map(c => `<option value="${c}"${(b ? b.condition_type : 'wins') === c ? ' selected' : ''}>${esc(COND_LABEL[c])}</option>`).join('')}</select></div>
      <div class="form-group" data-cf="action"><label>Hành động</label><select class="form-control" name="b_action">${actOpts(b ? b.action_id : '')}</select></div></div>
    <div class="form-row">
      <div class="form-group" data-cf="threshold"><label>Ngưỡng</label><input class="form-control" type="number" min="1" name="b_threshold" value="${b && b.threshold != null ? b.threshold : 1}"/></div>
      <div class="form-group" data-cf="secs"><label>Số giây tối đa</label><input class="form-control" type="number" min="1" name="b_secs" value="${p.secs || 15}"/></div>
      <div class="form-group" data-cf="fail_kind"><label>Kiểu thua</label><select class="form-control" name="b_fail">${['caught','timeout','lose','quit','spill','wrong','slower','out_of_ammo'].map(k => `<option${p.fail_kind === k ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="form-group" data-cf="vs"><label>Thắng nhân vật</label><select class="form-control" name="b_vs"><option value="">— Theo cấp bậc —</option>${S.chars.filter(c => c.kind !== 'player' && c.kind !== 'author').map(c => `<option value="${esc(c.id)}"${p.character_id === c.id ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></div>
      <div class="form-group" data-cf="event"><label>Hành động</label><select class="form-control" name="b_event">${Object.entries(H.EVENTS).map(([k, v]) => `<option value="${k}"${p.event === k ? ' selected' : ''}>${esc(v[0])}</option>`).join('')}</select></div>
      <div class="form-group" data-cf="vs"><label>Cấp từ – đến</label><div class="tm-row"><input class="form-control tm-num" type="number" min="1" max="8" name="b_rmin" value="${p.rank_min ?? ''}"/><input class="form-control tm-num" type="number" min="1" max="8" name="b_rmax" value="${p.rank_max ?? ''}"/></div></div>
    </div>
    <div class="tm-block"><label class="tm-check"><input type="checkbox" name="b_hidden"${!b || b.is_hidden ? ' checked' : ''}/> Ẩn khi chưa mở (chỉ hiện bóng đen và "???")</label>
      <label class="tm-check"><input type="checkbox" name="b_active"${!b || b.is_active ? ' checked' : ''}/> Đang bật</label></div>
    <details class="tm-en"><summary class="tm-section">Quà (chừa sẵn, chưa dùng trong game)</summary>
      <div class="form-row"><div class="form-group"><label>Tiêu đề</label><input class="form-control" name="b_rtitle" value="${esc(b ? b.reward_title || '' : '')}"/></div>
        <div class="form-group"><label>Trạng thái</label><select class="form-control" name="b_rstatus">${['none','coming','open'].map(k => `<option value="${k}"${(b ? b.reward_status : 'none') === k ? ' selected' : ''}>${{ none:'Không có', coming:'Sắp có', open:'Đang mở' }[k]}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>Ghi chú</label><input class="form-control" name="b_rnote" value="${esc(b ? b.reward_note || '' : '')}"/></div>
      <div class="form-group"><label>Link nhận quà</label><input class="form-control" name="b_rurl" value="${esc(b ? b.reward_url || '' : '')}" placeholder="https://..."/></div></details>
    <details class="tm-en" open><summary class="tm-section">Tiếng Anh · trang /en/team-map</summary>${X.enInput('en_bname', 'Tên (tiếng Anh)', en.name)}${X.enInput('en_bdesc', 'Mô tả (tiếng Anh)', en.description, 2)}</details>
    </div><div class="tm-badgeprev"><canvas class="tm-coinprev" width="260" height="260"></canvas><div class="form-hint">Xem trước · kéo để xoay</div></div></div>`,
    `<button class="btn-cancel" data-act="close">Huỷ</button><button class="btn-save" data-act="h-badge-save">Lưu</button>`);
  showCondFields();
  loadThree().then(() => { const cv = X.formRoot().querySelector('.tm-coinprev'); if (!cv || !window.TM_COIN) return;
    if (preview) preview.destroy(); preview = TM_COIN.scene(cv, badgeFromForm(), new Date().toISOString(), { dateText:d => new Date(d).toLocaleDateString('vi-VN') }); })
    .catch(e => toast(e.message, true));
}
function showCondFields(){
  const root = X.formRoot(), t = X.fv('b_type'), on = { action:t !== 'all_actions' && t !== 'event', threshold:['wins','distinct_characters','flawless_wins','win_streak','fail_count'].includes(t),
    secs:t === 'win_under_secs', fail_kind:t === 'fail_count', vs:t === 'win_vs', event:t === 'event' };
  root.querySelectorAll('[data-cf]').forEach(g => { g.hidden = !on[g.dataset.cf]; });
}
const refreshPreview = () => { if (preview) preview.update(badgeFromForm()); };
async function uploadImage(input){
  const file = input.files && input.files[0], state = X.formRoot().querySelector('[data-imgstate]'); if (!file) return;
  if (!['image/png','image/webp','image/jpeg'].includes(file.type)){ toast('Chỉ nhận PNG, WebP hoặc JPEG', true); input.value = ''; return; }
  if (file.size > 1048576){ toast('Hình tối đa 1 MB', true); input.value = ''; return; }
  const dims = await new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([0, 0]); im.src = URL.createObjectURL(file); });
  if (!dims[0]){ toast('Không đọc được hình', true); return; }
  if (Math.abs(dims[0] - dims[1]) > Math.max(dims[0], dims[1]) * .05) toast(`Hình ${dims[0]}×${dims[1]} không vuông, sẽ bị cắt tròn ở giữa`, false);
  const id = F().id || X.toSlug(X.fv('b_name')) || 'badge', ext = { 'image/png':'png', 'image/webp':'webp', 'image/jpeg':'jpg' }[file.type];
  const path = `${id}-${Date.now().toString(36)}.${ext}`;
  state.textContent = 'Đang tải lên...';
  try {
    const r = await fetch(`${SB_CONFIG.url}/storage/v1/object/tm-badges/${encodeURIComponent(path)}`, { method:'POST',
      headers:{ ...SB_CONFIG.headers(await accessToken()), 'Content-Type':file.type, 'x-upsert':'true', 'cache-control':'31536000' }, body:file });
    if (!r.ok){ const t = await r.text(); throw new Error(t.slice(0, 200)); }
    F().image = `${SB_CONFIG.url}/storage/v1/object/public/tm-badges/${encodeURIComponent(path)}`;
    state.textContent = 'Đã tải lên: ' + F().image; refreshPreview(); toast('Đã tải hình lên, bấm Lưu để áp dụng');
  } catch (e) { state.textContent = 'Lỗi tải lên'; toast('Lỗi tải hình: ' + e.message + ' (kiểm tra bucket tm-badges trong Supabase Storage)', true); }
}
async function saveBadge(){
  const root = X.formRoot(), fv = X.fv, b = F().orig; X.clearErrs(root); let bad = false; const err = (s, m) => { bad = true; X.setErr(root, s, m); };
  const id = b ? b.id : fv('b_id'), t = fv('b_type');
  if (!fv('b_name')) err('[name="b_name"]', 'Nhập tên');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) err('[name="b_id"]', 'Id chỉ gồm chữ thường không dấu, số và dấu -');
  else if (!b && S.hourly.badges.some(x => x.id === id)) err('[name="b_id"]', 'Id đã tồn tại');
  if (!HEX.test(fv('b_rim'))) err('[name="b_rim"]', 'Mã màu dạng #RRGGBB');
  if (t !== 'all_actions' && t !== 'event' && !fv('b_action')) err('[name="b_action"]', 'Chọn hành động');
  if (fv('b_rurl') && !/^https?:\/\//.test(fv('b_rurl'))) err('[name="b_rurl"]', 'Nhập URL đầy đủ');
  if (t === 'win_vs' && !fv('b_vs') && !fv('b_rmin') && !fv('b_rmax')) err('[name="b_vs"]', 'Chọn nhân vật hoặc khoảng cấp');
  if (bad) return;
  const params = t === 'win_under_secs' ? { secs:+fv('b_secs') } : t === 'fail_count' ? { fail_kind:fv('b_fail') } : t === 'event' ? { event:fv('b_event') }
    : t === 'win_vs' ? (fv('b_vs') ? { character_id:fv('b_vs') } : Object.fromEntries([['rank_min', fv('b_rmin')], ['rank_max', fv('b_rmax')]].filter(([, v]) => v !== '').map(([k, v]) => [k, +v]))) : {};
  const row = { name:fv('b_name'), description:fv('b_desc') || null, image_url:F().image || null, rim_color:fv('b_rim'), sort_order:parseInt(fv('b_sort')) || 0,
    condition_type:t, action_id: t === 'all_actions' || t === 'event' ? null : fv('b_action'), threshold: ['wins','distinct_characters','flawless_wins','win_streak','fail_count'].includes(t) ? Math.max(1, parseInt(fv('b_threshold')) || 1) : null,
    params, is_hidden:fv('b_hidden'), is_active:fv('b_active'), reward_title:fv('b_rtitle') || null, reward_note:fv('b_rnote') || null, reward_url:fv('b_rurl') || null, reward_status:fv('b_rstatus'),
    i18n:X.withEn(b && b.i18n, { name:fv('en_bname'), description:fv('en_bdesc') }) };
  try { if (b) await sbUpdate('tm_badges', b.id, row); else await sbInsert('tm_badges', { id, ...row });
    toast('Đã lưu huy hiệu'); X.closeModal(); await X.reload(); } catch (e) { toast('Lỗi: ' + e.message, true); }
}
async function deleteBadge(id){
  const b = S.hourly.badges.find(x => x.id === id);
  if (!(await X.ask('Xoá huy hiệu?', `Người chơi đã có "${b.name}" sẽ không còn thấy huy hiệu này. Nên tắt thay vì xoá. Vẫn xoá?`))) return;
  try { await sbDelete('tm_badges', id); toast('Đã xoá'); await X.reload(); } catch (e) { toast('Lỗi: ' + e.message, true); }
}
async function toggle(table, list, id){
  const r = list.find(x => x.id === id);
  try { await sbUpdate(table, id, { is_active:!r.is_active }); r.is_active = !r.is_active; X.render(); } catch (e) { toast('Lỗi: ' + e.message, true); }
}
async function del(table, id, label){
  if (!(await X.ask('Xoá?', `Xoá ${label}?`))) return;
  try { await sbDelete(table, id); toast('Đã xoá'); await X.reload(); } catch (e) { toast('Lỗi: ' + e.message, true); }
}

// ════════════════════════════════════════════════════════
// FORM NHÂN VẬT: nhóm "Hành động & mini-game"
// ════════════════════════════════════════════════════════
function charSection(c){
  const rel = new Set(((c && c.related_term_ids) || []).map(String)), part = new Set((c && c.gossip_partner_ids) || []), ex = new Set((c && c.hourly_exclude) || []);
  S.hchar = { rel, part };
  let elig = '';
  if (c){ try { const D = gameData();
    elig = Object.keys(D.SCALES).filter(sc => D.PLACE[sc][c.id]).map(sc => `<div><b>${esc(X.SCALE_NAME[sc])}:</b> ${ACTIONS.map(a => { const why = H.whyNot(D, sc, a, c.id);
      return why ? `<span class="tm-why bad" title="${esc(why)}">${esc(actName(a))}: ${esc(why)}</span>` : `<span class="tm-why ok">${esc(actName(a))}</span>`; }).join(' ')}</div>`).join('') || '<div class="form-hint">Chưa có chỗ ngồi ở quy mô nào</div>';
  } catch (e) { elig = `<div class="tm-warn">${esc(e.message)}</div>`; } }
  return `<div class="tm-section">Hành động &amp; mini-game</div>
    <div class="form-row"><div class="form-group"><label>Cấp bậc</label><select class="form-control" name="h_rank"><option value="">— Mặc định (2) —</option>${Object.entries(RANKS).map(([k, v]) => `<option value="${k}"${c && c.rank == k ? ' selected' : ''}>${k} · ${v}</option>`).join('')}</select>
      <div class="form-hint">Cấp càng cao đánh nhau càng trâu, chạy đua càng chậm. 1 Thực tập · 2 Nhân viên · 3 Lead/PM · 4 Manager · 5 Head/Director · 6 C-level · 7 Client · 8 User</div></div>
      <div class="form-group"><label>Không tham gia hành động</label><div class="tm-chipgrid">${ACTIONS.map(a => `<label class="tm-chip"><input type="checkbox" data-hex="${a}"${ex.has(a) ? ' checked' : ''}/>${esc(actName(a))}</label>`).join('')}</div></div></div>
    <div class="form-group"><label>Thuật ngữ liên quan (flashcard) <span class="tm-count" data-relc>${rel.size}</span></label>
      <input class="form-control" data-hsearch="rel" placeholder="Gõ để lọc thuật ngữ..."/><div class="tm-chipgrid tm-pick" data-hlist="rel">${allConcepts.filter(t => t.is_published !== false).sort((a, b) => a.name.localeCompare(b.name, 'vi')).map(t => `<label class="tm-chip" data-name="${esc(t.name.toLowerCase())}"><input type="checkbox" data-hrel="${esc(String(t.id))}"${rel.has(String(t.id)) ? ' checked' : ''}/>${esc(t.name)}</label>`).join('')}</div></div>
    <div class="form-group"><label>Người nấu xói cùng <span class="tm-count">trống = tự động (cùng phòng, trừ sếp trực tiếp)</span></label>
      <input class="form-control" data-hsearch="part" placeholder="Gõ để lọc nhân vật..."/><div class="tm-chipgrid tm-pick" data-hlist="part">${S.chars.filter(x => x.kind !== 'player' && x.kind !== 'author' && (!c || x.id !== c.id)).map(x => `<label class="tm-chip" data-name="${esc(x.title.toLowerCase())}"><input type="checkbox" data-hpart="${esc(x.id)}"${part.has(x.id) ? ' checked' : ''}/>${esc(x.title)}</label>`).join('')}</div></div>
    ${c ? `<div class="form-group"><label>Đang hợp lệ với (theo dữ liệu đã lưu)</label><div class="tm-elig">${elig}</div></div>` : ''}`;
}
function charValues(root){
  const rank = root.querySelector('[name="h_rank"]'); if (!rank) return {};
  return { rank: rank.value ? +rank.value : null,
    related_term_ids:[...root.querySelectorAll('[data-hrel]:checked')].map(i => { const t = allConcepts.find(x => String(x.id) === i.dataset.hrel); return t ? t.id : i.dataset.hrel; }),
    gossip_partner_ids:(ids => ids.length ? ids : null)([...root.querySelectorAll('[data-hpart]:checked')].map(i => i.dataset.hpart)),
    hourly_exclude:[...root.querySelectorAll('[data-hex]:checked')].map(i => i.dataset.hex) };
}

// ════════════════════════════════════════════════════════
// EXCEL
// ════════════════════════════════════════════════════════
const json = v => v == null ? '' : JSON.stringify(v);
const parseJson = (s, fallback) => { if (s === '' || s == null) return fallback; try { return JSON.parse(s); } catch (e) { return { __bad:s }; } };
function sheets(){
  if (!S.hourly) return [];
  const { YES, NO, splitList, joinList, enCols, enCells, enFrom } = X;
  return [
    { name:'Hanh dong', key:'hourly_actions', title:'Hành động (nhiệm vụ theo giờ)', required:['id'],
      cols:[['id','id',11],['name','Tên',18],['title_template','Mẫu tên nhiệm vụ',36,{ wrap:1 }],['offer_text','Lời giao',50,{ wrap:1 }],['win_text','Lời khi thắng',40,{ wrap:1 }],
        ['lose_text','Lời khi thua',40,{ wrap:1 }],['weight','Trọng số',9],['config','Tham số (JSON)',50,{ wrap:1 }],['is_active','Hiển thị',10,{ list:[YES, NO] }],
        ...enCols([['name','Tên',18],['title_template','Mẫu tên',36],['offer_text','Lời giao',50],['win_text','Lời thắng',40],['lose_text','Lời thua',40]])],
      rows:() => S.hourly.actions, cur:() => S.hourly.actions,
      toCells:a => ({ id:a.id, name:a.name, title_template:a.title_template, offer_text:a.offer_text, win_text:a.win_text, lose_text:a.lose_text, weight:a.weight, config:json(a.config),
        is_active:a.is_active ? YES : NO, ...enCells(a, ['name','title_template','offer_text','win_text','lose_text']) }),
      fromCells:(v, has) => { const o = { id:v.id }; ['name','title_template','offer_text','win_text','lose_text'].forEach(k => { if (has(k)) o[k] = v[k] || null; });
        if (has('weight')) o.weight = v.weight === '' ? 1 : Number(v.weight); if (has('config')) o.config = parseJson(v.config, {}); if (has('is_active')) o.is_active = v.is_active !== NO;
        return enFrom(v, has, ['name','title_template','offer_text','win_text','lose_text'], o); },
      validate:(r, E) => { const o = r.o; if (o.id && !ACTIONS.includes(o.id)) E('id', `Không có hành động "${o.id}" (chỉ cập nhật 8 hành động có sẵn: ${ACTIONS.join(', ')})`);
        if ('name' in o && !o.name) E('name', 'Thiếu tên'); if ('title_template' in o && !o.title_template) E('title_template', 'Thiếu mẫu tên');
        if ('weight' in o && !(Number.isInteger(o.weight) && o.weight >= 1)) E('weight', 'Trọng số là số nguyên ≥ 1');
        if (o.config && o.config.__bad !== undefined) E('config', 'Tham số không phải JSON hợp lệ');
        else if (o.config && (typeof o.config !== 'object' || Array.isArray(o.config))) E('config', 'Tham số phải là một object JSON'); },
      prepare:s => s.updated.map(r => r.o) },
    { name:'Cau hoi', key:'quiz', title:'Câu hỏi', required:['id','character_id','question'],
      cols:[['id','id',22],['character_id','Nhân vật (id)',20],['_title','Chức danh',24],['question','Câu hỏi',50,{ wrap:1 }],['opt1','Đáp án 1',32,{ wrap:1 }],['opt2','Đáp án 2',32,{ wrap:1 }],['opt3','Đáp án 3',32,{ wrap:1 }],
        ['correct','Đáp án đúng (1–3)',10,{ list:['1','2','3'] }],['is_active','Hiển thị',10,{ list:[YES, NO] }],
        ...enCols([['question','Câu hỏi',50],['opt1','Đáp án 1',32],['opt2','Đáp án 2',32],['opt3','Đáp án 3',32]])],
      rows:() => S.hourly.quiz, cur:() => S.hourly.quiz,
      toCells:q => { const e = X.enOf(q), eo = e.options || []; return { id:q.id, character_id:q.character_id, _title:charName(q.character_id), question:q.question,
        opt1:q.options[0], opt2:q.options[1], opt3:q.options[2], correct:String(q.correct_index + 1), is_active:q.is_active ? YES : NO,
        en_question:e.question || '', en_opt1:eo[0] || '', en_opt2:eo[1] || '', en_opt3:eo[2] || '' }; },
      fromCells:(v, has) => { const o = { id:v.id }; if (has('character_id')) o.character_id = v.character_id; if (has('question')) o.question = v.question;
        if (has('opt1') || has('opt2') || has('opt3')){ const cur = S.hourly.quiz.find(x => x.id === v.id); const old = cur ? cur.options : ['', '', '']; o.options = [1, 2, 3].map(i => has('opt' + i) ? v['opt' + i] : old[i - 1]); }
        if (has('correct')) o.correct_index = Number(v.correct) - 1; if (has('is_active')) o.is_active = v.is_active !== NO;
        const en = {}; if (has('en_question')) en.question = v.en_question || null;
        if (has('en_opt1') || has('en_opt2') || has('en_opt3')){ const l = [v.en_opt1 || '', v.en_opt2 || '', v.en_opt3 || '']; en.options = l.every(Boolean) ? l : null; }
        if (Object.keys(en).length) o.i18n_en = en; return o; },
      validate:(r, E) => { const cur = S.hourly.quiz.find(x => x.id === r.o.id) || {}, m = { ...cur, ...r.o };
        if (!X.charOf(m.character_id)) E('character_id', `Không có nhân vật "${m.character_id || ''}"`); if (!m.question) E('question', 'Thiếu câu hỏi');
        (m.options || []).forEach((x, i) => { if (!x) E('opt' + (i + 1), 'Thiếu đáp án'); }); if (!(m.correct_index >= 0 && m.correct_index <= 2)) E('correct', 'Chỉ nhận 1, 2 hoặc 3'); },
      prepare:s => [...s.added, ...s.updated].map(r => { const cur = S.hourly.quiz.find(x => x.id === r.o.id) || { is_active:true }; const m = { ...cur, ...r.o }; delete m.updated_at; delete m.i18n; return m; }) },
    { name:'Loi thoai', key:'lines', title:'Lời thoại', required:['id','action_id','kind','text'],
      cols:[['id','id',10],['action_id','Hành động',11,{ list:ACTIONS }],['kind','Loại câu',10,{ list:Object.keys(KIND_LABEL) }],['character_id','Nhân vật (id)',20],['_title','Chức danh',24],
        ['text','Câu thoại',60,{ wrap:1 }],['is_active','Hiển thị',10,{ list:[YES, NO] }],...enCols([['text','Câu thoại',60]])],
      rows:() => S.hourly.lines, cur:() => S.hourly.lines,
      toCells:l => ({ id:l.id, action_id:l.action_id, kind:l.kind, character_id:l.character_id || '', _title:l.character_id ? charName(l.character_id) : '', text:l.text, is_active:l.is_active ? YES : NO, ...enCells(l, ['text']) }),
      fromCells:(v, has) => { const o = { id:v.id }; ['action_id','kind','text'].forEach(k => { if (has(k)) o[k] = v[k] || null; }); if (has('character_id')) o.character_id = v.character_id || null;
        if (has('is_active')) o.is_active = v.is_active !== NO; return enFrom(v, has, ['text'], o); },
      validate:(r, E) => { const cur = S.hourly.lines.find(x => x.id === r.o.id) || {}, m = { ...cur, ...r.o };
        if (!ACTIONS.includes(m.action_id)) E('action_id', `Không có hành động "${m.action_id || ''}"`);
        else if (!KIND_BY_ACTION[m.action_id].includes(m.kind)) E('kind', `Loại câu "${m.kind || ''}" không dùng cho ${m.action_id}. Hợp lệ: ${KIND_BY_ACTION[m.action_id].join(', ') || '(không có)'}`);
        if (m.character_id && !X.charOf(m.character_id)) E('character_id', `Không có nhân vật "${m.character_id}"`); if (!m.text) E('text', 'Thiếu câu thoại'); },
      prepare:s => [...s.added, ...s.updated].map(r => { const cur = S.hourly.lines.find(x => x.id === r.o.id) || { is_active:true }; const m = { ...cur, ...r.o }; delete m.updated_at; delete m.i18n; return m; }) },
    { name:'Huy hieu', key:'badges', title:'Huy hiệu', required:['id','name','condition_type'],
      cols:[['id','id',24],['sort_order','Thứ tự',8],['name','Tên',26],['description','Mô tả',44,{ wrap:1 }],['image_url','Link hình',40],['rim_color','Màu viền',11],
        ['condition_type','Loại điều kiện',20,{ list:H.CONDITIONS }],['action_id','Hành động',11,{ list:ACTIONS }],['threshold','Ngưỡng',8],['params','Tham số (JSON)',30],
        ['is_hidden','Ẩn',8,{ list:[YES, NO] }],['is_active','Hiển thị',10,{ list:[YES, NO] }],['reward_title','Quà: tiêu đề',20],['reward_note','Quà: ghi chú',24],['reward_url','Quà: link',30],
        ['reward_status','Quà: trạng thái',12,{ list:['none','coming','open'] }],...enCols([['name','Tên',26],['description','Mô tả',44]])],
      rows:() => S.hourly.badges.slice().sort((a, b) => a.sort_order - b.sort_order), cur:() => S.hourly.badges,
      toCells:b => ({ id:b.id, sort_order:b.sort_order, name:b.name, description:b.description, image_url:b.image_url || '', rim_color:b.rim_color, condition_type:b.condition_type, action_id:b.action_id || '',
        threshold:b.threshold ?? '', params:json(b.params), is_hidden:b.is_hidden ? YES : NO, is_active:b.is_active ? YES : NO, reward_title:b.reward_title || '', reward_note:b.reward_note || '',
        reward_url:b.reward_url || '', reward_status:b.reward_status, ...enCells(b, ['name','description']) }),
      fromCells:(v, has) => { const o = { id:v.id };
        ['name','description','image_url','rim_color','condition_type','action_id','reward_title','reward_note','reward_url','reward_status'].forEach(k => { if (has(k)) o[k] = v[k] || null; });
        if (has('sort_order')) o.sort_order = v.sort_order === '' ? 0 : Number(v.sort_order); if (has('threshold')) o.threshold = v.threshold === '' ? null : Number(v.threshold);
        if (has('params')) o.params = parseJson(v.params, {}); if (has('is_hidden')) o.is_hidden = v.is_hidden !== NO; if (has('is_active')) o.is_active = v.is_active !== NO;
        return enFrom(v, has, ['name','description'], o); },
      validate:(r, E) => { const cur = S.hourly.badges.find(x => x.id === r.o.id) || {}, m = { ...cur, ...r.o };
        if (r.o.id && !/^[a-z0-9][a-z0-9-]*$/.test(r.o.id)) E('id', 'Id chỉ gồm chữ thường không dấu, số và dấu -');
        if (!m.name) E('name', 'Thiếu tên'); if (!H.CONDITIONS.includes(m.condition_type)) E('condition_type', `Loại không hợp lệ. Hợp lệ: ${H.CONDITIONS.join(', ')}`);
        if (m.condition_type !== 'all_actions' && m.condition_type !== 'event' && !ACTIONS.includes(m.action_id)) E('action_id', 'Cần hành động hợp lệ');
        if (m.condition_type === 'event' && !H.EVENTS[(m.params || {}).event]) E('params', `Cần {"event": "..."} với: ${Object.keys(H.EVENTS).join(', ')}`);
        if (m.rim_color && !HEX.test(m.rim_color)) E('rim_color', 'Mã màu dạng #RRGGBB');
        if (m.params && m.params.__bad !== undefined) E('params', 'Tham số không phải JSON hợp lệ');
        if (m.threshold != null && !(Number.isInteger(m.threshold) && m.threshold >= 1)) E('threshold', 'Ngưỡng là số nguyên ≥ 1');
        if (m.image_url && !/^https?:\/\//.test(m.image_url)) E('image_url', 'Chỉ nhận URL hình đã upload (https://...)');
        if (m.reward_url && !/^https?:\/\//.test(m.reward_url)) E('reward_url', 'Cần URL đầy đủ');
        if (!['none','coming','open'].includes(m.reward_status || 'none')) E('reward_status', 'Chỉ nhận none, coming, open'); },
      prepare:s => [...s.added, ...s.updated].map(r => { const cur = S.hourly.badges.find(x => x.id === r.o.id) || { is_hidden:true, is_active:true, rim_color:'#FFC53D', reward_status:'none', params:{} };
        const m = { ...cur, ...r.o }; delete m.updated_at; delete m.i18n; return m; }) },
  ];
}
// cột thêm cho sheet Nhan vat
const charCols = [['rank','Cấp bậc (1–8)',10],['related_term_ids','Thuật ngữ liên quan (id)',40,{ wrap:1 }],['gossip_partner_ids','Người nấu xói cùng (id)',30,{ wrap:1 }],['hourly_exclude','Không tham gia hành động',26]];
const charCells = c => ({ rank:c.rank ?? '', related_term_ids:X.joinList((c.related_term_ids || []).map(String)), gossip_partner_ids:X.joinList(c.gossip_partner_ids || []), hourly_exclude:X.joinList(c.hourly_exclude || []) });
function charFrom(v, has, o){
  if (has('rank')) o.rank = v.rank === '' ? null : Number(v.rank);
  if (has('related_term_ids')) o.related_term_ids = X.splitList(v.related_term_ids).map(id => { const t = allConcepts.find(x => String(x.id) === id); return t ? t.id : id; });
  if (has('gossip_partner_ids')){ const l = X.splitList(v.gossip_partner_ids); o.gossip_partner_ids = l.length ? l : null; }
  if (has('hourly_exclude')) o.hourly_exclude = X.splitList(v.hourly_exclude);
  return o;
}
function charValidate(r, E){ const o = r.o;
  if (o.rank != null && !(Number.isInteger(o.rank) && o.rank >= 1 && o.rank <= 8)) E('rank', 'Cấp bậc là số nguyên 1–8');
  (o.related_term_ids || []).forEach(id => { if (!allConcepts.some(t => String(t.id) === String(id))) E('related_term_ids', `Không có thuật ngữ id "${id}"`); });
  (o.gossip_partner_ids || []).forEach(id => { if (!X.charOf(id)) E('gossip_partner_ids', `Không có nhân vật "${id}"`); });
  (o.hourly_exclude || []).forEach(a => { if (!ACTIONS.includes(a)) E('hourly_exclude', `Không có hành động "${a}"`); }); }

// ---------- sự kiện ----------
// ════════════════════════════════════════════════════════
// TAB "MÃ HUY HIỆU": mỗi lần người chơi đạt huy hiệu được cấp một mã (dùng khi đổi quà)
// ════════════════════════════════════════════════════════
const AW_STATUS = { valid:'Hợp lệ', redeemed:'Đã đổi quà', void:'Đã huỷ' };
async function loadAwards(){
  try { S.awards = await sbGet('tm_badge_awards', 'select=*&order=serial.desc&limit=5000'); S.awardsErr = null; }
  catch (e) { S.awards = []; S.awardsErr = e.message; }
}
async function patchAward(serial, data){
  // (H ở file này là logic hourly, nên tự dựng header: key công khai + token của admin đang đăng nhập)
  const r = await fetch(`${SB_CONFIG.url}/rest/v1/tm_badge_awards?serial=eq.${encodeURIComponent(serial)}`, { method:'PATCH',
    headers:{ ...SB_CONFIG.headers(await accessToken()), 'Content-Type':'application/json', Prefer:'return=representation' }, body:JSON.stringify(data) });
  if (!r.ok) await sbFail(r);
  const rows = await r.json(); if (!rows.length) throw new Error('Không có quyền ghi'); return rows[0];
}
function renderAwards(){
  if (!S.awards){ X.body().innerHTML = '<p class="tm-note">Đang tải mã huy hiệu…</p>'; loadAwards().then(renderAwards); return; }
  const f = S.f; f.awQ = f.awQ || ''; f.awBadge = f.awBadge || ''; f.awStatus = f.awStatus || '';
  const all = S.awards, day = Date.now() - 864e5, q = f.awQ.trim().toUpperCase();
  const list = all.filter(a => (!f.awBadge || a.badge_id === f.awBadge) && (!f.awStatus || a.status === f.awStatus) && (!q || a.code.includes(q)));
  const C = S.hourly.config, when = d => new Date(d).toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', second:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' });
  X.body().innerHTML = `<div class="toolbar"><h2>Mã huy hiệu <span class="tm-count">(${list.length} / ${all.length})</span></h2>
      <input class="form-control tm-w-auto" data-awf="awQ" placeholder="Tìm mã, vd TL-000123…" value="${esc(f.awQ)}"/>
      <select class="form-control tm-w-auto" data-awf="awBadge"><option value="">Mọi huy hiệu</option>${S.hourly.badges.map(b => `<option value="${esc(b.id)}"${f.awBadge === b.id ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
      <select class="form-control tm-w-auto" data-awf="awStatus"><option value="">Mọi trạng thái</option>${Object.entries(AW_STATUS).map(([k, v]) => `<option value="${k}"${f.awStatus === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <button class="btn-edit" data-act="aw-reload">Tải lại</button><button class="btn-edit" data-act="aw-csv">Xuất CSV</button></div>
    ${S.awardsErr ? `<p class="tm-warn">Không tải được: ${esc(S.awardsErr)}. Đã chạy supabase_team_map_badge_awards.sql chưa?</p>` : ''}
    <p class="tm-note">Mỗi lần người chơi đạt huy hiệu (từ <b>${esc(when(C.award_start))}</b>, đổi trong tab Hành động) được cấp một mã và lưu ở đây.
      Mã gồm số thứ tự + 4 ký tự kiểm tra do server tính, nên mã tự chế sẽ không có trong bảng này. Khi đổi quà: tìm mã, đối chiếu huy hiệu và ngày đạt,
      đổi xong bấm "Đã đổi quà" để một mã không đổi được hai lần.</p>
    <div class="tm-awstats"><div><b>${all.length}</b><span>mã đã cấp</span></div><div><b>${all.filter(a => Date.parse(a.created_at) > day).length}</b><span>trong 24 giờ</span></div>
      <div><b>${all.filter(a => a.status === 'redeemed').length}</b><span>đã đổi quà</span></div><div><b>${all.filter(a => a.status === 'void').length}</b><span>đã huỷ</span></div></div>
    <div class="table-wrap"><table><thead><tr><th>Mã</th><th>Huy hiệu</th><th>Thời gian</th><th>Trạng thái</th><th>Ghi chú</th><th></th></tr></thead><tbody>
    ${list.slice(0, 500).map(a => { const b = S.hourly.badges.find(x => x.id === a.badge_id);
      return `<tr><td><code>${esc(a.code)}</code></td><td>${esc(b ? b.name : a.badge_id)}</td><td class="tm-nowrap">${esc(when(a.created_at))}</td>
        <td><span class="badge ${a.status === 'valid' ? 'badge-pub' : a.status === 'redeemed' ? 'badge-sub' : 'badge-draft'}">${AW_STATUS[a.status]}</span></td>
        <td><input class="form-control tm-awnote" data-awnote="${a.serial}" value="${esc(a.note || '')}" placeholder="vd: đổi quà 12/10, SĐT…"/></td>
        <td class="td-actions">${a.status !== 'redeemed' ? `<button class="btn-edit" data-act="aw-status" data-serial="${a.serial}" data-to="redeemed">Đã đổi quà</button>` : ''}
          ${a.status !== 'void' ? `<button class="btn-del" data-act="aw-status" data-serial="${a.serial}" data-to="void">Huỷ</button>` : ''}
          ${a.status !== 'valid' ? `<button class="btn-edit" data-act="aw-status" data-serial="${a.serial}" data-to="valid">Khôi phục</button>` : ''}</td></tr>`; }).join('')
      || '<tr><td colspan="6" class="empty-state">Chưa có mã nào</td></tr>'}</tbody></table></div>
    ${list.length > 500 ? '<p class="tm-note">Đang hiện 500 mã mới nhất, dùng ô tìm / lọc để thu hẹp.</p>' : ''}`;
}
async function setAwardStatus(serial, to){
  const a = S.awards.find(x => String(x.serial) === String(serial)); if (!a) return;
  if (to === 'void' && !confirm(`Huỷ mã ${a.code}?`)) return;
  try { Object.assign(a, await patchAward(serial, { status:to })); toast(`${a.code}: ${AW_STATUS[to]}`); renderAwards(); } catch (e) { toast('Lỗi: ' + e.message, true); }
}
function awardsCsv(){
  const rows = [['code','badge','created_at','status','note']].concat(S.awards.map(a => [a.code, a.badge_id, a.created_at, a.status, a.note || '']));
  const csv = '\ufeff' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' })); el.download = `ma-huy-hieu-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(el); el.click(); el.remove();
}

function onClick(act, b){
  const id = b.dataset.id;
  switch (act){
    case 'aw-reload': S.awards = null; renderAwards(); return true;
    case 'aw-csv': awardsCsv(); return true;
    case 'aw-status': setAwardStatus(b.dataset.serial, b.dataset.to); return true;
    case 'h-cfg-save': return saveConfig(), true;
    case 'h-act-edit': return openAction(id), true;
    case 'h-act-save': return saveAction(), true;
    case 'h-act-toggle': return toggle('tm_hourly_actions', S.hourly.actions, id), true;
    case 'h-quiz-new': return openQuiz(null), true;
    case 'h-quiz-edit': return openQuiz(id), true;
    case 'h-quiz-save': return saveQuiz(), true;
    case 'h-quiz-toggle': return toggle('tm_quiz_questions', S.hourly.quiz, id), true;
    case 'h-quiz-del': return del('tm_quiz_questions', id, 'câu hỏi này'), true;
    case 'h-line-new': return openLine(null), true;
    case 'h-line-edit': return openLine(id), true;
    case 'h-line-save': return saveLine(), true;
    case 'h-line-toggle': return toggle('tm_hourly_lines', S.hourly.lines, id), true;
    case 'h-line-del': return del('tm_hourly_lines', id, 'câu thoại này'), true;
    case 'h-badge-new': return openBadge(null), true;
    case 'h-badge-edit': return openBadge(id), true;
    case 'h-badge-save': return saveBadge(), true;
    case 'h-badge-toggle': return toggle('tm_badges', S.hourly.badges, id), true;
    case 'h-badge-del': return deleteBadge(id), true;
    case 'h-badge-noimg': F().image = null; X.formRoot().querySelector('[data-imgstate]').textContent = 'Chưa có hình'; refreshPreview(); return true;
  }
  return false;
}
function onInput(e){
  const t = e.target;
  if (t.dataset.awf && t.tagName === 'INPUT'){ S.f[t.dataset.awf] = t.value; const pos = t.selectionStart; renderAwards(); const n = X.body().querySelector(`[data-awf="${t.dataset.awf}"]`); if (n){ n.focus(); n.setSelectionRange(pos, pos); } return true; }
  if (t.dataset.hsearch){ const q = t.value.trim().toLowerCase(); X.formRoot().querySelectorAll(`[data-hlist="${t.dataset.hsearch}"] .tm-chip`).forEach(ch => { ch.hidden = q && !ch.dataset.name.includes(q); }); return true; }
  if (t.dataset.hrel !== undefined){ const n = X.formRoot().querySelectorAll('[data-hrel]:checked').length; X.formRoot().querySelector('[data-relc]').textContent = n; return true; }
  if (!S.hform || S.hform.kind !== 'h-badge') return false;
  if (t.name === 'b_rimpick'){ X.formRoot().querySelector('[name="b_rim"]').value = t.value; refreshPreview(); return true; }
  if (t.name === 'b_rim'){ if (HEX.test(t.value)) X.formRoot().querySelector('[name="b_rimpick"]').value = t.value; refreshPreview(); return true; }
  if (t.name === 'b_name' && !S.hform.orig){ X.formRoot().querySelector('[name="b_id"]').value = X.toSlug(t.value); return true; }
  return false;
}
function onChange(e){
  const t = e.target;
  if (t.dataset.hf){ S.f[t.dataset.hf] = t.value; renderLines(); return true; }
  if (t.dataset.awf && t.tagName === 'SELECT'){ S.f[t.dataset.awf] = t.value; renderAwards(); return true; }
  if (t.dataset.awnote){ const a = S.awards.find(x => String(x.serial) === t.dataset.awnote);
    patchAward(t.dataset.awnote, { note:t.value.trim() || null }).then(r => { Object.assign(a, r); toast('Đã lưu ghi chú'); }).catch(e => toast('Lỗi: ' + e.message, true)); return true; }
  if (t.name === 'b_type'){ showCondFields(); return true; }
  if (t.name === 'b_file'){ uploadImage(t); return true; }
  if (t.name === 'l_act'){ const sel = X.formRoot().querySelector('[name="l_kind"]'); sel.innerHTML = KIND_BY_ACTION[t.value].map(k => `<option value="${k}">${k} · ${esc(KIND_LABEL[k])}</option>`).join(''); return true; }
  return false;
}
function onClose(){ if (preview){ preview.destroy(); preview = null; } S.hform = null; }

return { load, tabs:{ hourly:'Hành động', hlines:'Câu hỏi và lời thoại', badges:'Huy hiệu', awards:'Mã huy hiệu' }, render:{ hourly:renderHourly, hlines:renderLines, badges:renderBadges, awards:renderAwards },
  onClick, onInput, onChange, onClose, charSection, charValues, sheets, charCols, charCells, charFrom, charValidate };
};
