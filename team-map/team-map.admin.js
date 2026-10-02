// Team Map — CMS trong adminCMS.html (tab "Team Map")
// Dùng lại helper của adminCMS: sbGet, sbInsert, sbUpdate, sbDelete, sbRpc, toast, toSlug, allConcepts, allCats.
// Bốn tab: Nhân vật · Phòng ban · Nhiệm vụ · Import / Export. Lưu là lên ngay (không có bản nháp).
(function(){
  const L = window.TM_LAYOUT;
  const GROUPS = L.groups, GROUP_KEYS = Object.keys(GROUPS);
  const KINDS = { role:'Vai trò', player:'Nhân vật chính', author:'Tác giả', guest:'Khách' };
  const SCALE_NAME = { small:'Công ty product nhỏ', large:'Tập đoàn product 100+', agency:'Outsource agency' };
  const SCALE_KEYS = Object.keys(SCALE_NAME);
  const HEX = /^#[0-9a-f]{6}$/i;
  const STEP_TYPES = { talk:'Nói chuyện với một người', work:'Về chỗ ngồi làm việc', present:'Trình bày trên TV' };
  const QTYPES = { main:'Chính', daily:'Daily' };
  const TV_ROOMS = L.rooms.filter(r => r.tv !== undefined).map(r => r.id);
  const LAYOUT = Object.fromEntries(L.rooms.map(r => [r.id, r]));
  const EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';

  const S = { loaded:false, loading:null, tab:'chars', chars:[], rooms:[], pls:[], quests:[], steps:[],
    f:{ q:'', group:'', scale:'', noArticle:false, qScale:'small', qType:'main' }, imp:null };

  // ════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const panel = () => document.getElementById('panel-teammap');
  const byId = (list, id) => list.find(x => x.id === id);
  const charOf = id => byId(S.chars, id);
  const roomOf = id => byId(S.rooms, id);
  const termOf = id => id == null || id === '' ? null : allConcepts.find(t => String(t.id) === String(id));
  const termMap = () => Object.fromEntries(allConcepts.map(t => [String(t.id), t]));
  const resolvedUrl = c => TeamMapLoader.resolveUrl(c, termMap());
  const roomsOf = scale => S.rooms.filter(r => r.scale === scale).sort((a, b) => a.sort_order - b.sort_order);
  const plsOf = scale => S.pls.filter(p => p.scale === scale);
  const roomKind = id => (LAYOUT[id] || {}).kind;
  const plLabel = pid => { const p = byId(S.pls, pid); if (!p) return pid + ' (không tồn tại)'; const c = charOf(p.character_id), r = roomOf(p.room_id);
    return `${c ? c.title : p.character_id} — ${r ? r.name : p.room_id}`; };
  const pad2 = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };

  // Danh mục "Vai trò" + các nhóm con
  function roleCategoryIds(){
    const root = allCats.find(c => c.slug === 'vai-tro'); if (!root) return new Set();
    const ids = new Set([root.id]); let grew = true;
    while (grew){ grew = false; allCats.forEach(c => { if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)){ ids.add(c.id); grew = true; } }); }
    return ids;
  }
  const roleTerms = () => { const ids = roleCategoryIds(); return allConcepts.filter(t => ids.has(t.category_id)); };
  const catName = id => (allCats.find(c => c.id === id) || {}).name || '—';

  // Nhiệm vụ đang dùng một mã vị trí / một nhân vật
  function questsUsingPlacement(pid){
    const ids = new Set();
    S.quests.forEach(q => { if (q.giver === pid || (q.gather || []).includes(pid)) ids.add(q.id); });
    S.steps.forEach(s => { if (s.target === pid) ids.add(s.quest_id); });
    return [...ids].map(id => byId(S.quests, id)).filter(Boolean);
  }
  function questsUsingChar(cid){
    const ids = new Set();
    S.pls.filter(p => p.character_id === cid).forEach(p => questsUsingPlacement(p.id).forEach(q => ids.add(q.id)));
    S.quests.forEach(q => { if ((q.rewards || []).some(r => r.type === 'character' && r.id === cid)) ids.add(q.id); });
    return [...ids].map(id => byId(S.quests, id));
  }
  const questNames = qs => qs.map(q => `${q.id} · ${q.title}`).join(', ');

  function rewardLabel(r){
    if (r.type === 'character'){ const c = charOf(r.id); return c ? c.title : r.id; }
    if (r.term_id != null){ const t = termOf(r.term_id); return t ? t.name : `#${r.term_id} (không tồn tại)`; }
    return (r.name || '?') + ' ⚠';
  }

  // ════════════════════════════════════════════════════════
  // DATA
  // ════════════════════════════════════════════════════════
  async function load(){
    const [chars, rooms, pls, quests, steps] = await Promise.all([
      sbGet('tm_characters', 'select=*&order=title'),
      sbGet('tm_rooms', 'select=*&order=sort_order'),
      sbGet('tm_placements', 'select=*'),
      sbGet('tm_quests', 'select=*&order=sort_order'),
      sbGet('tm_quest_steps', 'select=*&order=sort_order'),
    ]);
    Object.assign(S, { chars, rooms, pls, quests, steps, loaded:true });
  }
  async function reload(){ await load(); render(); }

  function open(){
    if (S.loaded) return render();
    panel().innerHTML = '<div class="empty-state">Đang tải dữ liệu Team Map...</div>';
    S.loading = S.loading || load().then(render).catch(e => {
      S.loading = null;
      panel().innerHTML = `<div class="export-card"><h3>Không tải được dữ liệu Team Map</h3>
        <p>${esc(e.message)}</p><p>Nếu đây là lần đầu: chạy <code>supabase_team_map.sql</code> rồi <code>supabase_team_map_seed.sql</code> trong Supabase → SQL Editor (xem <code>docs/team-map-notes.md</code>).</p>
        <button class="btn-add" data-act="retry">Thử lại</button></div>`;
    });
  }

  // ════════════════════════════════════════════════════════
  // SHELL + MODAL
  // ════════════════════════════════════════════════════════
  const TABS = { chars:'Nhân vật', rooms:'Phòng ban', quests:'Nhiệm vụ', io:'Import / Export' };
  function render(){
    S.loading = null;
    panel().innerHTML = `<div class="tm-subtabs">${Object.entries(TABS).map(([k, v]) =>
      `<button class="tm-sub${S.tab === k ? ' active' : ''}" data-act="tab" data-tab="${k}">${v}</button>`).join('')}
      <span class="tm-sub-note">Lưu là lên ngay · game cập nhật ở lần tải trang sau</span></div><div id="tm-body"></div>`;
    ({ chars:renderChars, rooms:renderRooms, quests:renderQuests, io:renderIO })[S.tab]();
  }
  const body = () => document.getElementById('tm-body');

  function modalEl(){
    let m = document.getElementById('tm-modal');
    if (!m){
      m = document.createElement('div'); m.id = 'tm-modal'; m.className = 'modal-backdrop';
      m.innerHTML = '<div class="modal tm-wide"><div class="modal-header"><h3></h3><button class="modal-close" data-act="close">×</button></div><div class="modal-body"></div><div class="modal-footer"></div></div>';
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) closeModal(); });
      m.addEventListener('click', onClick); m.addEventListener('input', onInput); m.addEventListener('change', onChange);
    }
    return m;
  }
  function openModal(title, html, footer){
    const m = modalEl();
    m.querySelector('h3').textContent = title;
    m.querySelector('.modal-body').innerHTML = html;
    m.querySelector('.modal-footer').innerHTML = footer;
    m.classList.add('open'); m.querySelector('.modal').scrollTop = 0;
    return m;
  }
  function closeModal(){ const m = document.getElementById('tm-modal'); if (m) m.classList.remove('open'); S.form = null; }

  // Hỏi lại ngay trong trang (không dùng confirm() của trình duyệt)
  function ask(title, msg, okLabel = 'Xoá', danger = true){
    return new Promise(res => {
      let m = document.getElementById('tm-confirm');
      if (!m){ m = document.createElement('div'); m.id = 'tm-confirm'; m.className = 'modal-backdrop tm-confirm'; document.body.appendChild(m); }
      m.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true"><div class="modal-header"><h3>${esc(title)}</h3></div>
        <div class="modal-body"><p class="tm-confirm-msg">${msg}</p></div>
        <div class="modal-footer">${okLabel ? '<button class="btn-cancel" data-r="0">Huỷ</button>' : ''}<button class="btn-save${danger ? ' tm-danger' : ''}" data-r="1">${esc(okLabel || 'Đã hiểu')}</button></div></div>`;
      m.classList.add('open');
      const done = v => { m.classList.remove('open'); res(v); };
      m.onclick = e => { const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === '1' && !!okLabel); else if (e.target === m) done(false); };
      m.querySelector('[data-r="1"]').focus();
    });
  }

  // Lỗi ngay cạnh ô sai
  function clearErrs(root){ root.querySelectorAll('.tm-err').forEach(e => e.remove()); root.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid')); }
  function setErr(root, sel, msg){
    const el = root.querySelector(sel); if (!el) return toast(msg, true);
    el.classList.add('invalid');
    const d = document.createElement('div'); d.className = 'tm-err'; d.textContent = msg;
    (el.closest('.form-group') || el.parentElement).appendChild(d);
  }

  // Ô chọn có tìm kiếm
  function comboHtml(name, value, label, placeholder){
    return `<div class="tm-combo" data-combo="${name}"><input class="form-control" data-combo-q="${name}" value="${esc(label)}" placeholder="${esc(placeholder)}" autocomplete="off"/>
      <input type="hidden" data-combo-v="${name}" value="${esc(value ?? '')}"/><div class="tm-combo-list" hidden></div></div>`;
  }
  function comboFilter(input, items){
    const list = input.parentElement.querySelector('.tm-combo-list'), q = input.value.trim().toLowerCase();
    const hits = items.filter(i => !q || i.label.toLowerCase().includes(q) || (i.sub || '').toLowerCase().includes(q)).slice(0, 60);
    list.innerHTML = hits.map(i => `<div class="tm-combo-item" data-pick="${esc(i.id)}" data-label="${esc(i.label)}"><b>${esc(i.label)}</b>${i.sub ? `<span>${esc(i.sub)}</span>` : ''}</div>`).join('')
      || '<div class="tm-combo-empty">Không tìm thấy</div>';
    list.hidden = false;
  }
  document.addEventListener('click', e => { if (!e.target.closest('.tm-combo')) document.querySelectorAll('.tm-combo-list').forEach(l => l.hidden = true); });

  // Kéo thả đổi thứ tự (ul > li[draggable])
  function sortable(ul, onDrop){
    let drag = null;
    ul.querySelectorAll('li[draggable]').forEach(li => {
      li.addEventListener('dragstart', e => { drag = li; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      li.addEventListener('dragend', () => { li.classList.remove('dragging'); drag = null; onDrop([...ul.querySelectorAll('li[draggable]')].map(x => x.dataset.id)); });
      li.addEventListener('dragover', e => { e.preventDefault(); if (!drag || drag === li) return; const r = li.getBoundingClientRect();
        ul.insertBefore(drag, e.clientY > r.top + r.height / 2 ? li.nextSibling : li); });
    });
  }

  // ════════════════════════════════════════════════════════
  // TAB NHÂN VẬT
  // ════════════════════════════════════════════════════════
  function renderChars(){
    const f = S.f, q = f.q.toLowerCase();
    const rows = S.chars.filter(c => {
      if (q && !(c.title.toLowerCase().includes(q) || c.id.includes(q))) return false;
      if (f.group && c.group !== f.group) return false;
      if (f.scale === 'none'){ if (S.pls.some(p => p.character_id === c.id)) return false; }
      else if (f.scale && !S.pls.some(p => p.character_id === c.id && p.scale === f.scale)) return false;
      if (f.noArticle && resolvedUrl(c)) return false;
      return true;
    });
    const roomCodes = (c, scale) => S.pls.filter(p => p.character_id === c.id && p.scale === scale).map(p => { const r = roomOf(p.room_id); return esc(r ? r.code || r.id : p.room_id); }).join(', ') || '<span class="no-url">—</span>';
    body().innerHTML = `<div class="toolbar">
        <h2>Nhân vật <span class="tm-count">(${rows.length} / ${S.chars.length})</span></h2>
        <input class="search-input" data-f="q" type="text" placeholder="Tìm chức danh hoặc id..." value="${esc(f.q)}"/>
        <button class="btn-add" data-act="char-new">+ Thêm nhân vật</button>
      </div>
      <div class="tm-filters">
        <select class="form-control" data-f="group"><option value="">Mọi nhóm</option>${GROUP_KEYS.map(k => `<option value="${k}"${f.group === k ? ' selected' : ''}>${GROUPS[k].name}</option>`).join('')}</select>
        <select class="form-control" data-f="scale"><option value="">Mọi quy mô</option>${SCALE_KEYS.map(k => `<option value="${k}"${f.scale === k ? ' selected' : ''}>Có ở ${SCALE_NAME[k].toLowerCase()}</option>`).join('')}<option value="none"${f.scale === 'none' ? ' selected' : ''}>Chưa có chỗ ngồi</option></select>
        <label class="tm-check"><input type="checkbox" data-f="noArticle"${f.noArticle ? ' checked' : ''}/> Chưa có bài</label>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Chức danh</th><th>Nhóm</th><th>Loại</th><th>Thuật ngữ</th><th>Phòng (nhỏ)</th><th>Phòng (lớn)</th><th>Phòng (agency)</th><th>Bài viết</th><th>Hiển thị</th><th></th></tr></thead>
      <tbody>${rows.map(c => { const t = termOf(c.term_id), url = resolvedUrl(c);
        return `<tr>
          <td><div class="td-name">${esc(c.title)}</div><div class="td-slug">${esc(c.id)}</div></td>
          <td class="tm-nowrap"><span class="tm-dot" style="background:${(GROUPS[c.group] || {}).color || '#999'}"></span>${esc((GROUPS[c.group] || {}).name || c.group)}</td>
          <td><span class="badge ${c.kind === 'role' ? 'badge-sub' : 'badge-vai-tro'}">${KINDS[c.kind] || c.kind}</span></td>
          <td class="td-desc">${t ? esc(t.name) : '<span class="no-url">—</span>'}</td>
          ${SCALE_KEYS.map(k => `<td>${roomCodes(c, k)}</td>`).join('')}
          <td>${url ? `<a class="badge badge-pub" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(url)}">Đã có bài</a>` : '<span class="badge badge-draft">Sắp ra mắt</span>'}</td>
          <td><button class="tm-toggle${c.is_active ? ' on' : ''}" data-act="char-toggle" data-id="${esc(c.id)}" aria-pressed="${c.is_active}" title="${c.is_active ? 'Đang hiện — bấm để ẩn' : 'Đang ẩn — bấm để hiện'}"></button></td>
          <td class="td-actions"><button class="btn-edit" data-act="char-edit" data-id="${esc(c.id)}">Sửa</button><button class="btn-del" data-act="char-del" data-id="${esc(c.id)}">Xoá</button></td>
        </tr>`; }).join('') || '<tr><td colspan="10" class="empty-state">Không có nhân vật phù hợp</td></tr>'}</tbody></table></div>`;
  }

  async function toggleChar(id){
    const c = charOf(id);
    try { await sbUpdate('tm_characters', id, { is_active: !c.is_active }); c.is_active = !c.is_active; renderChars(); toast(c.is_active ? `Đã hiện "${c.title}"` : `Đã ẩn "${c.title}"`); }
    catch(e) { toast('Lỗi: ' + e.message, true); }
  }

  async function deleteChar(id){
    const c = charOf(id), used = questsUsingChar(id);
    if (used.length) return ask('Không xoá được', `<b>${esc(c.title)}</b> đang được dùng trong nhiệm vụ: ${esc(questNames(used))}.<br><br>Gỡ khỏi các nhiệm vụ đó trước, hoặc tắt hiển thị nhân vật này.`, null);
    if (!await ask('Xoá nhân vật?', `Xoá <b>${esc(c.title)}</b> và mọi chỗ ngồi của nhân vật này. Thao tác không thể hoàn tác.`)) return;
    try { await sbDelete('tm_characters', id); toast(`Đã xoá "${c.title}"`); await reload(); }
    catch(e) { toast('Lỗi: ' + e.message, true); }
  }

  // ---------- form nhân vật ----------
  function openChar(id){
    const c = id ? charOf(id) : null;
    const F = S.form = { kind:'char', isNew:!c, orig:c,
      pls: Object.fromEntries(SCALE_KEYS.map(k => [k, S.pls.filter(p => c && p.character_id === c.id && p.scale === k)
             .map(p => ({ orig:p.id, room_id:p.room_id, seat_order:p.seat_order, fixed:!!p.fixed }))])),
      cta: (c && c.cta || []).map(b => ({ label:b.label || '', url:b.url || '', primary:!!b.primary })),
      props: new Set(c ? c.props || [] : []) };
    SCALE_KEYS.forEach(k => { if (!F.pls[k].length) F.pls[k].push({ orig:null, room_id:'', seat_order:null, fixed:false }); });
    const t = c ? termOf(c.term_id) : null;
    const charOpts = sel => `<option value="">— Không —</option>` + S.chars.filter(x => !c || x.id !== c.id).map(x => `<option value="${esc(x.id)}"${sel === x.id ? ' selected' : ''}>${esc(x.title)}</option>`).join('');
    const vt = allCats.filter(x => roleCategoryIds().has(x.id));
    openModal(c ? `Sửa nhân vật · ${c.title}` : 'Thêm nhân vật', `
      <div class="form-row">
        <div class="form-group"><label>Chức danh *</label><input class="form-control" name="title" value="${esc(c ? c.title : '')}" placeholder="VD: Product Manager"/></div>
        <div class="form-group"><label>Id *</label><input class="form-control" name="id" value="${esc(c ? c.id : '')}" ${c ? 'readonly' : ''} placeholder="vd: product-manager"/>
          <div class="form-hint">${c ? 'Không đổi được sau khi tạo (nhiệm vụ tham chiếu theo id)' : 'Tự tạo từ chức danh, chỉ gồm a-z, 0-9 và dấu -'}</div></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Nhóm nghề *</label><select class="form-control" name="group">${GROUP_KEYS.map(k => `<option value="${k}"${c && c.group === k ? ' selected' : ''}>${GROUPS[k].name}</option>`).join('')}</select>
          <div class="form-hint">Quyết định màu vòng tròn dưới chân và màn hình máy tính</div></div>
        <div class="form-group"><label>Loại</label><select class="form-control" name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${(c ? c.kind : 'role') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>

      <div class="tm-section">Liên kết bài viết</div>
      <div class="form-group"><label>Thuật ngữ liên kết (nhóm "Vai trò")</label>
        ${comboHtml('term', c ? c.term_id : '', t ? t.name : '', 'Gõ để tìm thuật ngữ...')}
        <div class="tm-inline"><button type="button" class="tm-link" data-act="term-new">+ Tạo thuật ngữ mới</button><button type="button" class="tm-link" data-act="term-clear">Bỏ liên kết</button></div>
      </div>
      <div class="tm-newterm" hidden>
        <div class="form-row">
          <div class="form-group"><label>Tên thuật ngữ *</label><input class="form-control" name="nt_name"/></div>
          <div class="form-group"><label>Nhóm con</label><select class="form-control" name="nt_cat">${vt.map(x => `<option value="${x.id}">${'　'.repeat(Math.max(0, x.depth - 1))}${esc(x.name)}</option>`).join('')}</select></div>
        </div>
        <div class="form-group"><label>Mô tả ngắn</label><textarea class="form-control" name="nt_desc" rows="2"></textarea></div>
        <div class="form-group"><label>URL bài viết</label><input class="form-control" name="nt_url" type="url" placeholder="https://academy.telos.vn/..."/></div>
        <div class="tm-inline"><button type="button" class="btn-add" data-act="term-create">Lưu thuật ngữ và gắn vào nhân vật</button><button type="button" class="btn-cancel" data-act="term-cancel">Huỷ</button></div>
      </div>
      <div class="form-group"><label>Link bài viết (ghi đè)</label><input class="form-control" name="article_url" type="url" value="${esc(c ? c.article_url : '')}" placeholder="Để trống để dùng URL của thuật ngữ"/>
        <div class="form-hint" data-resolved></div></div>

      <div class="tm-section">Nội dung</div>
      <div class="form-group"><label>Họ là ai</label><textarea class="form-control" name="summary" rows="2">${esc(c ? c.summary : '')}</textarea></div>
      <div class="form-group"><label>Đang làm</label><textarea class="form-control" name="doing" rows="2">${esc(c ? c.doing : '')}</textarea><div class="form-hint">Cũng là câu trong bong bóng khi người chơi lại gần</div></div>
      <div class="form-group"><label>Làm việc với bạn thế nào</label><textarea class="form-control" name="with_designer" rows="2">${esc(c ? c.with_designer : '')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Báo cáo cho (quy mô lớn)</label><select class="form-control" name="reports_to">${charOpts(c && c.reports_to)}</select></div>
        <div class="form-group"><label>Báo cáo cho (quy mô nhỏ)</label><select class="form-control" name="reports_to_small">${charOpts(c && c.reports_to_small)}</select><div class="form-hint">Trống thì dùng giá trị của quy mô lớn</div></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Báo cáo cho (agency)</label><select class="form-control" name="reports_to_agency">${charOpts(c && c.reports_to_agency)}</select><div class="form-hint">Ở agency, trống = không báo cáo cho ai</div></div>
        <div class="form-group"><label>Màu thân / viền (tuỳ chọn)</label><div class="tm-row">
          <input class="form-control" name="body_color" value="${esc(c && c.appearance ? c.appearance.body_color || '' : '')}" placeholder="Thân, vd #FFC53D" maxlength="7"/>
          <input class="form-control" name="outline_color" value="${esc(c && c.appearance ? c.appearance.outline_color || '' : '')}" placeholder="Viền, vd #8A5D00" maxlength="7"/></div>
          <div class="form-hint">Mã màu #RRGGBB. Trống thì dùng tạo hình mặc định.</div></div>
      </div>
      <div class="form-group"><label>Đồ nghề</label><div class="tm-chipgrid">${L.props.map(p => `<label class="tm-chip"><input type="checkbox" data-prop="${p}"${F.props.has(p) ? ' checked' : ''}/>${p}</label>`).join('')}</div></div>

      <div class="tm-special" ${c && ['author','guest'].includes(c.kind) ? '' : 'hidden'}>
        <div class="tm-section">Tác giả / khách</div>
        <div class="form-group"><label>Nhãn phụ</label><input class="form-control" name="tag" value="${esc(c ? c.tag : '')}" placeholder="VD: Academic Director · TELOS Academy"/></div>
        <div class="form-group"><label>Các nút trong bảng thông tin</label><div data-cta></div><button type="button" class="tm-link" data-act="cta-add">+ Thêm nút</button></div>
      </div>

      <div class="tm-section">Vị trí</div>
      <div data-pls></div>

      <div class="tm-block"><label class="tm-check"><input type="checkbox" name="is_active"${!c || c.is_active ? ' checked' : ''}/> Hiển thị trong game</label></div>`,
      `<button class="btn-cancel" data-act="close">Huỷ</button><button class="btn-save" data-act="char-save">Lưu</button>`);
    renderCta(); renderPls(); updateResolved();
  }

  function formRoot(){ return document.querySelector('#tm-modal .modal'); }
  const fv = name => { const el = formRoot().querySelector(`[name="${name}"]`); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };

  function updateResolved(){
    const el = formRoot().querySelector('[data-resolved]'); if (!el) return;
    const url = resolvedUrl({ article_url: fv('article_url') || null, term_id: formRoot().querySelector('[data-combo-v="term"]').value || null });
    el.innerHTML = url ? `Đang dùng: <a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>` : 'Đang dùng: <i>chưa có link → game hiện "Bài viết sắp ra mắt"</i>';
  }

  function renderCta(){
    const box = formRoot().querySelector('[data-cta]'); if (!box) return;
    box.innerHTML = S.form.cta.map((b, i) => `<div class="tm-row">
      <input class="form-control" data-cta-f="label" data-i="${i}" value="${esc(b.label)}" placeholder="Nhãn"/>
      <input class="form-control" data-cta-f="url" data-i="${i}" value="${esc(b.url)}" placeholder="https://..."/>
      <label class="tm-check"><input type="checkbox" data-cta-f="primary" data-i="${i}"${b.primary ? ' checked' : ''}/> Nút chính</label>
      <button type="button" class="btn-del" data-act="cta-del" data-i="${i}">Xoá</button></div>`).join('') || '<div class="form-hint">Chưa có nút</div>';
  }

  function renderPls(){
    const F = S.form, box = formRoot().querySelector('[data-pls]');
    const id = F.orig ? F.orig.id : fv('id');
    const row = (scale, p, i) => {
      const opts = roomsOf(scale).filter(r => roomKind(r.id) !== 'locked');
      const used = p.orig ? questsUsingPlacement(p.orig) : [];
      const moved = p.orig && p.room_id && p.orig !== `${id}@${p.room_id}`;
      return `<div class="tm-row">
        <select class="form-control" data-pl-f="room_id" data-scale="${scale}" data-i="${i}">
          <option value="">${i ? '— Chọn phòng —' : 'Không xuất hiện'}</option>
          ${opts.map(r => `<option value="${r.id}"${p.room_id === r.id ? ' selected' : ''}>${esc(r.code || r.id)} · ${esc(r.name)}</option>`).join('')}</select>
        <input class="form-control tm-num" type="number" min="0" data-pl-f="seat_order" data-scale="${scale}" data-i="${i}" value="${p.seat_order ?? ''}" placeholder="Ghế" title="Thứ tự ghế (0, 1, 2…)"/>
        <label class="tm-check" title="Ngồi yên tại ghế: không đi dạo, không đi tới điểm tập hợp (vd Client)"><input type="checkbox" data-pl-f="fixed" data-scale="${scale}" data-i="${i}"${p.fixed ? ' checked' : ''}/> Cố định</label>
        ${scale !== 'small' && i ? `<button type="button" class="btn-del" data-act="pl-del" data-scale="${scale}" data-i="${i}">Bỏ</button>` : ''}
      </div>${used.length && (moved || !p.room_id) ? `<div class="tm-warn">${!p.room_id ? 'Không bỏ được' : 'Đổi phòng'}: vị trí <code>${esc(p.orig)}</code> đang được nhiệm vụ dùng (${esc(questNames(used))}).
        ${!p.room_id ? 'Gỡ khỏi các nhiệm vụ đó trước.' : `Mã sẽ tự đổi thành <code>${esc(id)}@${esc(p.room_id)}</code> trong các nhiệm vụ này. Kiểm tra lại người giao / bước "work" nếu nhiệm vụ phụ thuộc phòng cũ.`}</div>` : ''}`;
    };
    box.innerHTML = SCALE_KEYS.map(k => `<div class="form-group"><label>${SCALE_NAME[k]}</label>${(k === 'small' ? F.pls[k].slice(0, 1) : F.pls[k]).map((p, i) => row(k, p, i)).join('')}
      ${k === 'small' ? '' : `<button type="button" class="tm-link" data-act="pl-add" data-scale="${k}">+ Thêm phòng ở ${SCALE_NAME[k].toLowerCase()}</button>`}</div>`).join('') +
      `<div class="form-hint">Nhân vật "Tác giả" không có ghế cố định (đi khắp nơi), phòng chỉ là điểm xuất phát. "Khách" ngồi ở Pantry.</div>`;
  }

  async function createTerm(){
    const root = formRoot(), name = fv('nt_name');
    clearErrs(root.querySelector('.tm-newterm'));
    if (!name) return setErr(root, '[name="nt_name"]', 'Nhập tên thuật ngữ');
    let slug = toSlug(name), n = 2; while (allConcepts.some(t => t.slug === slug)) slug = toSlug(name) + '-' + n++;
    try {
      const [created] = await sbInsert('concepts', { name, slug, category_id: fv('nt_cat'), description: fv('nt_desc') || null,
        url: fv('nt_url') || null, node_size: 8, is_published: true });
      allConcepts.push(created); allConcepts.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      if (typeof renderConceptsTable === 'function') renderConceptsTable();
      root.querySelector('[data-combo-v="term"]').value = created.id;
      root.querySelector('[data-combo-q="term"]').value = created.name;
      root.querySelector('.tm-newterm').hidden = true; updateResolved();
      toast(`Đã tạo thuật ngữ "${created.name}" và gắn vào nhân vật`);
    } catch(e) { toast('Lỗi tạo thuật ngữ: ' + e.message, true); }
  }

  async function saveChar(){
    const F = S.form, root = formRoot(); clearErrs(root);
    const id = F.orig ? F.orig.id : fv('id'), kind = fv('kind');
    let bad = false; const err = (sel, msg) => { bad = true; setErr(root, sel, msg); };
    if (!fv('title')) err('[name="title"]', 'Nhập chức danh');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) err('[name="id"]', 'Id chỉ gồm chữ thường không dấu, số và dấu -');
    else if (F.isNew && charOf(id)) err('[name="id"]', 'Id này đã tồn tại');
    if (kind === 'player' && S.chars.some(x => x.kind === 'player' && x.id !== id)) err('[name="kind"]', 'Đã có nhân vật chính khác. Chỉ được 1 nhân vật chính.');
    const all = SCALE_KEYS.flatMap(k => F.pls[k]), pls = all.filter(p => p.room_id);
    SCALE_KEYS.forEach(k => F.pls[k].forEach((p, i) => { if (F.pls[k].filter(x => x.room_id && x.room_id === p.room_id).length > 1) err(`[data-pl-f="room_id"][data-scale="${k}"][data-i="${i}"]`, 'Trùng phòng'); }));
    all.forEach(p => { if (p.orig && !p.room_id && questsUsingPlacement(p.orig).length) bad = true; });
    ['body_color','outline_color'].forEach(k => { if (fv(k) && !HEX.test(fv(k))) err(`[name="${k}"]`, 'Mã màu dạng #RRGGBB'); });
    if (kind === 'player'){
      SCALE_KEYS.forEach(k => { if (roomsOf(k).length && F.pls[k].filter(p => p.room_id).length !== 1) err(`[data-pl-f="room_id"][data-scale="${k}"]`, `Nhân vật chính cần đúng 1 chỗ ở ${SCALE_NAME[k].toLowerCase()}`); });
    }
    const cta = F.cta.filter(b => b.label || b.url);
    cta.forEach((b, i) => { if (!/^https?:\/\//.test(b.url)) err(`[data-cta-f="url"][data-i="${F.cta.indexOf(b)}"]`, 'Nhập URL đầy đủ (https://...)'); });
    if (fv('article_url') && !/^https?:\/\//.test(fv('article_url'))) err('[name="article_url"]', 'Nhập URL đầy đủ (https://...)');
    if (bad) return toast('Kiểm tra lại các ô đánh dấu đỏ', true);
    const termId = root.querySelector('[data-combo-v="term"]').value;
    const character = { id, title: fv('title'), kind, group: fv('group'), term_id: termId === '' ? null : termId,
      article_url: fv('article_url') || null, summary: fv('summary') || null, doing: fv('doing') || null, with_designer: fv('with_designer') || null,
      reports_to: fv('reports_to') || null, reports_to_small: fv('reports_to_small') || null, reports_to_agency: fv('reports_to_agency') || null,
      props: L.props.filter(p => F.props.has(p)),
      appearance: (() => { const a = { ...(F.orig && F.orig.appearance || { dark:false, outfit:null }) }; delete a.body_color; delete a.outline_color;
        if (fv('body_color')) a.body_color = fv('body_color'); if (fv('outline_color')) a.outline_color = fv('outline_color'); return a; })(),
      tag: ['author','guest'].includes(kind) ? (fv('tag') || null) : (F.orig ? F.orig.tag : null),
      cta: ['author','guest'].includes(kind) ? (cta.length ? cta : null) : (F.orig ? F.orig.cta : null),
      is_active: fv('is_active') };
    const btn = root.querySelector('[data-act="char-save"]'); btn.disabled = true; btn.textContent = 'Đang lưu...';
    try {
      await sbRpc('tm_save_character', { p: { character, placements: pls.map(p => ({ id:p.orig, room_id:p.room_id, seat_order: p.seat_order === '' || p.seat_order == null ? null : +p.seat_order, fixed:!!p.fixed })) } });
      toast(F.isNew ? `Đã thêm "${character.title}"` : `Đã lưu "${character.title}"`);
      closeModal(); await reload();
    } catch(e) { toast('Lỗi: ' + e.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Lưu'; }
  }

  // ════════════════════════════════════════════════════════
  // TAB PHÒNG BAN
  // ════════════════════════════════════════════════════════
  function renderRooms(){
    const table = scale => `<h3 class="tm-h3">${SCALE_NAME[scale]}</h3><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th>Nhân vật</th><th>Giới thiệu</th><th></th></tr></thead><tbody>
      ${roomsOf(scale).map(r => { const n = S.pls.filter(p => p.room_id === r.id).length; return `<tr>
        <td><div class="td-name">${esc(r.code || '—')}</div><div class="td-slug">${esc(r.id)}</div></td><td>${esc(r.name)}</td>
        <td><span class="badge badge-sub">${esc(roomKind(r.id) || '?')}</span>${TV_ROOMS.includes(r.id) ? ' <span class="badge badge-sub">TV</span>' : ''}</td>
        <td>${n}</td><td>${r.intro ? '<span class="badge badge-pub">Có</span>' : '<span class="badge badge-draft">Chưa có</span>'}</td>
        <td class="td-actions"><button class="btn-edit" data-act="room-edit" data-id="${esc(r.id)}">Sửa</button></td></tr>`; }).join('')}</tbody></table></div>`;
    body().innerHTML = `<div class="toolbar"><h2>Phòng ban</h2></div>
      <p class="tm-note">Bố cục phòng (vị trí, kích thước, cửa, TV) cố định trong code nên không thêm/xoá phòng ở đây. Sửa được mã, tên, đoạn giới thiệu và thứ tự ghế.</p>
      ${SCALE_KEYS.map(table).join('')}`;
  }

  function openRoom(id){
    const r = roomOf(id), seated = S.pls.filter(p => p.room_id === id).sort((a, b) => (a.seat_order ?? 1e9) - (b.seat_order ?? 1e9) || a.character_id.localeCompare(b.character_id));
    S.form = { kind:'room', id, order: seated.map(p => p.id), origOrder: seated.map(p => p.id).join() };
    openModal(`Sửa phòng · ${r.id}`, `
      <div class="form-row">
        <div class="form-group"><label>Mã hiển thị</label><input class="form-control" name="code" value="${esc(r.code)}"/><div class="form-hint">In trên sàn, vd "R03", "Team 1"</div></div>
        <div class="form-group"><label>Thứ tự</label><input class="form-control" type="number" name="sort_order" value="${r.sort_order}"/><div class="form-hint">Thứ tự trong CMS và "Xem dạng danh sách"</div></div>
      </div>
      <div class="form-group"><label>Tên phòng *</label><input class="form-control" name="name" value="${esc(r.name)}"/></div>
      <div class="form-group"><label>Đoạn giới thiệu</label><textarea class="form-control" name="intro" rows="4" placeholder="2–3 câu: phòng này làm gì, designer ghé đây khi nào">${esc(r.intro || '')}</textarea>
        <div class="form-hint">Hiện khi người chơi bước vào phòng. Để trống thì không hiện thẻ.</div></div>
      <div class="form-group"><label>Nhân vật trong phòng · kéo thả để đổi thứ tự ghế</label>
        ${seated.length ? `<ul class="tm-sortlist" data-sort="seats">${seated.map(p => { const c = charOf(p.character_id); return `<li draggable="true" data-id="${esc(p.id)}"><span class="tm-handle">⋮⋮</span>${esc(c ? c.title : p.character_id)}<span class="td-slug">${esc(p.id)}</span></li>`; }).join('')}</ul>`
          : '<div class="form-hint">Chưa có ai ngồi ở phòng này</div>'}</div>`,
      `<button class="btn-cancel" data-act="close">Huỷ</button><button class="btn-save" data-act="room-save">Lưu</button>`);
    const ul = formRoot().querySelector('[data-sort="seats"]'); if (ul) sortable(ul, ids => { S.form.order = ids; });
  }

  async function saveRoom(){
    const F = S.form, root = formRoot(); clearErrs(root);
    if (!fv('name')) return setErr(root, '[name="name"]', 'Nhập tên phòng');
    const btn = root.querySelector('[data-act="room-save"]'); btn.disabled = true;
    try {
      await sbUpdate('tm_rooms', F.id, { code: fv('code'), name: fv('name'), intro: fv('intro') || null, sort_order: parseInt(fv('sort_order')) || 0 });
      if (F.order.join() !== F.origOrder) await sbRpc('tm_reorder', { p_table:'tm_placements', p: F.order.map((id, i) => ({ id, sort:i })) });
      toast('Đã lưu phòng'); closeModal(); await reload();
    } catch(e) { toast('Lỗi: ' + e.message, true); }
    finally { btn.disabled = false; }
  }

  // ════════════════════════════════════════════════════════
  // TAB NHIỆM VỤ
  // ════════════════════════════════════════════════════════
  function renderQuests(){
    const f = S.f, list = S.quests.filter(q => q.scale === f.qScale && q.type === f.qType).sort((a, b) => a.sort_order - b.sort_order);
    const stepsN = id => S.steps.filter(s => s.quest_id === id).length;
    body().innerHTML = `<div class="toolbar"><h2>Nhiệm vụ <span class="tm-count">(${list.length})</span></h2>
        <select class="form-control tm-w-auto" data-f="qScale">${Object.entries(SCALE_NAME).map(([k, v]) => `<option value="${k}"${f.qScale === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
        <select class="form-control tm-w-auto" data-f="qType">${Object.entries(QTYPES).map(([k, v]) => `<option value="${k}"${f.qType === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
        <button class="btn-add" data-act="quest-new">+ Thêm nhiệm vụ</button></div>
      ${f.qType === 'daily' ? '<p class="tm-note">Nhiệm vụ daily chỉ được lưu để chuẩn bị dữ liệu. Game chưa chạy daily.</p>' : '<p class="tm-note">Kéo ⋮⋮ để đổi thứ tự trong chuỗi quest. Nhiệm vụ đang tắt không xuất hiện trong game.</p>'}
      <ul class="tm-qlist" data-sort="quests">${list.map((q, i) => `<li draggable="true" data-id="${esc(q.id)}" class="${q.is_active ? '' : 'off'}">
        <span class="tm-handle">⋮⋮</span><span class="tm-qn">${i + 1}</span>
        <div class="tm-qmain"><div class="td-name">${esc(q.title)} ${q.is_active ? '' : '<span class="badge badge-draft">Đang tắt</span>'}</div>
          <div class="td-slug">${esc(q.id)} · ${esc((roomOf(q.room_id) || {}).name || q.room_id)} · giao bởi ${esc(q.giver ? plLabel(q.giver) : '—')} · ${stepsN(q.id)} bước${q.daily_date ? ' · ' + esc(q.daily_date) : ''}</div>
          <div class="tm-rewards">${(q.rewards || []).map(r => `<span class="badge ${r.type === 'term' && r.term_id == null ? 'badge-draft' : 'badge-vai-tro'}" title="${r.type === 'term' && r.term_id == null ? 'Chưa gắn thuật ngữ trong thư viện' : ''}">${esc(rewardLabel(r))}</span>`).join(' ')}</div></div>
        <div class="td-actions"><button class="btn-edit" data-act="quest-edit" data-id="${esc(q.id)}">Sửa</button><button class="btn-edit" data-act="quest-dup" data-id="${esc(q.id)}">Nhân bản</button><button class="btn-del" data-act="quest-del" data-id="${esc(q.id)}">Xoá</button></div>
      </li>`).join('') || '<li class="empty-state">Chưa có nhiệm vụ</li>'}</ul>`;
    const ul = body().querySelector('[data-sort="quests"]');
    sortable(ul, async ids => {
      const changed = ids.some((id, i) => byId(S.quests, id).sort_order !== i + 1); if (!changed) return;
      try { await sbRpc('tm_reorder', { p_table:'tm_quests', p: ids.map((id, i) => ({ id, sort:i + 1 })) }); ids.forEach((id, i) => byId(S.quests, id).sort_order = i + 1); renderQuests(); toast('Đã đổi thứ tự'); }
      catch(e) { toast('Lỗi: ' + e.message, true); renderQuests(); }
    });
  }

  function newQuestId(scale, type){
    const prefix = type === 'daily' ? `daily-${scale}-` : `${scale}-`; let n = 1;
    while (S.quests.some(q => q.id === prefix + pad2(n))) n++;
    return prefix + pad2(n);
  }

  function openQuest(id, dup){
    const src = id ? byId(S.quests, id) : null, isNew = !src || dup;
    const scale = src ? src.scale : S.f.qScale, type = src ? src.type : S.f.qType;
    const q = src ? JSON.parse(JSON.stringify(src)) : { scale, type, title:'', room_id:'', giver:'', gather:[], offer_text:'', done_text:'', rewards:[], is_active:true, daily_date:null };
    if (isNew){ q.id = newQuestId(q.scale, q.type); q.sort_order = Math.max(0, ...S.quests.filter(x => x.scale === q.scale && x.type === q.type).map(x => x.sort_order)) + 1; if (dup) q.title += ' (bản sao)'; }
    const steps = src ? S.steps.filter(s => s.quest_id === src.id).sort((a, b) => a.sort_order - b.sort_order).map(s => ({ ...s })) : [];
    S.form = { kind:'quest', isNew, q, steps };
    openModal(isNew ? (dup ? 'Nhân bản nhiệm vụ' : 'Thêm nhiệm vụ') : `Sửa nhiệm vụ · ${q.id}`, '<div data-quest></div>',
      `<button class="btn-cancel" data-act="close">Huỷ</button><button class="btn-save" data-act="quest-save">Lưu</button>`);
    renderQuestForm();
  }

  function renderQuestForm(){
    const { q, steps } = S.form, box = formRoot().querySelector('[data-quest]');
    const rooms = roomsOf(q.scale).filter(r => roomKind(r.id) !== 'locked');
    const pls = plsOf(q.scale).slice().sort((a, b) => plLabel(a.id).localeCompare(plLabel(b.id), 'vi'));
    const plOpts = (sel, empty) => `<option value="">${empty}</option>` + pls.map(p => `<option value="${esc(p.id)}"${sel === p.id ? ' selected' : ''}>${esc(plLabel(p.id))}</option>`).join('');
    const hasTV = TV_ROOMS.includes(q.room_id);
    box.innerHTML = `
      <div class="form-group"><label>Tên nhiệm vụ *</label><input class="form-control" data-q="title" value="${esc(q.title)}"/></div>
      <div class="form-row">
        <div class="form-group"><label>Loại</label><select class="form-control" data-q="type">${Object.entries(QTYPES).map(([k, v]) => `<option value="${k}"${q.type === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="form-group"><label>Quy mô</label><select class="form-control" data-q="scale" ${S.form.isNew ? '' : 'title="Đổi quy mô sẽ phải chọn lại người giao, người tham gia và người cần gặp"'}>${Object.entries(SCALE_NAME).map(([k, v]) => `<option value="${k}"${q.scale === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Phòng tập hợp *</label><select class="form-control" data-q="room_id"><option value="">— Chọn phòng —</option>${rooms.map(r => `<option value="${r.id}"${q.room_id === r.id ? ' selected' : ''}>${esc(r.code || r.id)} · ${esc(r.name)}${TV_ROOMS.includes(r.id) ? ' (có TV)' : ''}</option>`).join('')}</select></div>
        <div class="form-group">${q.type === 'daily' ? `<label>Ngày (daily)</label><input class="form-control" type="date" data-q="daily_date" value="${esc(q.daily_date || '')}"/>` : `<label>Id</label><input class="form-control" value="${esc(q.id)}" readonly/>`}</div>
      </div>
      <div class="form-group"><label>Người giao việc *</label><select class="form-control" data-q="giver">${plOpts(q.giver, '— Chọn người giao —')}</select></div>
      <div class="form-group"><label>Người tham gia (cùng tới phòng tập hợp)</label>
        <div class="tm-chipgrid tm-gather">${pls.map(p => `<label class="tm-chip"><input type="checkbox" data-gather="${esc(p.id)}"${(q.gather || []).includes(p.id) ? ' checked' : ''}/>${esc(plLabel(p.id))}</label>`).join('')}</div>
        ${(q.gather || []).filter(g => !pls.some(p => p.id === g)).map(g => `<div class="tm-warn">Mã vị trí không còn: <code>${esc(g)}</code> (sẽ bị bỏ khi lưu)</div>`).join('')}</div>
      <div class="form-group"><label>Lời thoại khi nhận việc</label><textarea class="form-control" data-q="offer_text" rows="2">${esc(q.offer_text || '')}</textarea></div>
      <div class="form-group"><label>Lời thoại khi trả việc</label><textarea class="form-control" data-q="done_text" rows="2">${esc(q.done_text || '')}</textarea></div>

      <div class="tm-section">Các bước</div>
      <ul class="tm-steps" data-sort="steps">${steps.map((s, i) => `<li draggable="true" data-id="${i}">
        <div class="tm-row"><span class="tm-handle" title="Kéo để đổi thứ tự">⋮⋮</span><b class="tm-qn">${i + 1}</b>
          <select class="form-control" data-s="type" data-i="${i}">${Object.entries(STEP_TYPES).map(([k, v]) => `<option value="${k}"${s.type === k ? ' selected' : ''}${k === 'present' && !hasTV ? ' disabled' : ''}>${v}${k === 'present' && !hasTV ? ' (cần phòng có TV)' : ''}</option>`).join('')}</select>
          ${s.type === 'talk' ? `<select class="form-control" data-s="target" data-i="${i}">${plOpts(s.target, '— Người cần gặp —')}</select>`
            : `<input class="form-control tm-num" type="number" min="1" step="0.5" data-s="secs" data-i="${i}" value="${s.secs ?? 5}" title="Số giây của thanh tiến độ"/><span class="form-hint">giây</span>`}
          <button type="button" class="btn-del" data-act="step-del" data-i="${i}">Xoá</button></div>
        <div class="form-group"><input class="form-control" data-s="task_text" data-i="${i}" value="${esc(s.task_text || '')}" placeholder="Dòng mục tiêu trên thẻ quest *"/></div>
        <div class="form-group"><textarea class="form-control" data-s="line_text" data-i="${i}" rows="2" placeholder="${s.type === 'talk' ? 'Lời của người cần gặp sau khi nói chuyện' : 'Lời của người giao việc khi xong bước'}">${esc(s.line_text || '')}</textarea></div>
      </li>`).join('')}</ul>
      <button type="button" class="tm-link" data-act="step-add">+ Thêm bước</button>

      <div class="tm-section">Thẻ thưởng</div>
      <div data-rewards>${(q.rewards || []).map((r, i) => `<div class="tm-row">
        <select class="form-control tm-w-auto" data-r="type" data-i="${i}"><option value="term"${r.type === 'term' ? ' selected' : ''}>Thuật ngữ</option><option value="character"${r.type === 'character' ? ' selected' : ''}>Nhân vật</option></select>
        ${r.type === 'character' ? `<select class="form-control" data-r="id" data-i="${i}"><option value="">— Chọn nhân vật —</option>${S.chars.map(c => `<option value="${esc(c.id)}"${r.id === c.id ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select>`
          : comboHtml('reward-' + i, r.term_id, r.term_id != null ? (termOf(r.term_id) || {}).name || '' : '', 'Tìm thuật ngữ trong thư viện...')}
        <button type="button" class="btn-del" data-act="reward-del" data-i="${i}">Xoá</button></div>
        ${r.type === 'term' && r.term_id == null && r.name ? `<div class="tm-warn">Chưa gắn thuật ngữ: <b>${esc(r.name)}</b>${r.url ? ` (<a href="${esc(r.url)}" target="_blank" rel="noopener">link</a>)` : ''}. Game vẫn hiện thẻ này; chọn thuật ngữ để gắn vào thư viện.</div>` : ''}`).join('')}</div>
      <button type="button" class="tm-link" data-act="reward-add">+ Thêm thẻ</button>

      <div class="tm-block"><label class="tm-check"><input type="checkbox" data-q="is_active"${q.is_active ? ' checked' : ''}/> Hiển thị trong game</label></div>`;
    const ul = box.querySelector('[data-sort="steps"]');
    sortable(ul, order => { S.form.steps = order.map(i => S.form.steps[+i]); renderQuestForm(); });
  }

  async function saveQuest(){
    const { q, steps, isNew } = S.form, root = formRoot(); clearErrs(root);
    let bad = false; const err = (sel, msg) => { bad = true; setErr(root, sel, msg); };
    const pids = new Set(plsOf(q.scale).map(p => p.id));
    if (!q.title.trim()) err('[data-q="title"]', 'Nhập tên nhiệm vụ');
    if (!q.room_id || !roomsOf(q.scale).some(r => r.id === q.room_id)) err('[data-q="room_id"]', 'Chọn phòng tập hợp thuộc ' + SCALE_NAME[q.scale].toLowerCase());
    if (!q.giver || !pids.has(q.giver)) err('[data-q="giver"]', 'Chọn người giao việc thuộc ' + SCALE_NAME[q.scale].toLowerCase());
    steps.forEach((s, i) => {
      if (!s.task_text || !s.task_text.trim()) err(`[data-s="task_text"][data-i="${i}"]`, 'Nhập dòng mục tiêu');
      if (s.type === 'talk' && !pids.has(s.target)) err(`[data-s="target"][data-i="${i}"]`, 'Chọn người cần gặp thuộc ' + SCALE_NAME[q.scale].toLowerCase());
      if (s.type === 'present' && !TV_ROOMS.includes(q.room_id)) err(`[data-s="type"][data-i="${i}"]`, `Bước "Trình bày" chỉ dùng được ở phòng có TV (${TV_ROOMS.join(', ')})`);
    });
    const rewards = [];
    (q.rewards || []).forEach((r, i) => {
      if (r.type === 'character'){ if (!charOf(r.id)) err(`[data-r="id"][data-i="${i}"]`, 'Chọn nhân vật'); else rewards.push({ type:'character', id:r.id }); }
      else if (r.term_id != null && r.term_id !== '') rewards.push({ type:'term', term_id:r.term_id });
      else if (r.name) rewards.push({ type:'term', name:r.name, url:r.url || null });
      else err(`[data-combo-q="reward-${i}"]`, 'Chọn thuật ngữ');
    });
    if (bad) return toast('Kiểm tra lại các ô đánh dấu đỏ', true);
    const quest = { id:q.id, type:q.type, scale:q.scale, sort_order:q.sort_order, title:q.title.trim(), room_id:q.room_id, giver:q.giver,
      gather:(q.gather || []).filter(g => pids.has(g) && g !== q.giver), offer_text:q.offer_text || null, done_text:q.done_text || null,
      rewards, is_active:!!q.is_active, daily_date: q.type === 'daily' ? (q.daily_date || null) : null };
    const payload = steps.map((s, i) => ({ id:`${q.id}-s${i + 1}`, sort_order:i + 1, type:s.type, target: s.type === 'talk' ? s.target : null,
      task_text:s.task_text.trim(), line_text:(s.line_text || '').trim() || null, secs: s.type === 'talk' ? null : (s.secs === '' || s.secs == null ? 5 : +s.secs) }));
    const btn = root.querySelector('[data-act="quest-save"]'); btn.disabled = true; btn.textContent = 'Đang lưu...';
    try {
      await sbRpc('tm_save_quest', { p: { quest, steps: payload } });
      toast(isNew ? 'Đã thêm nhiệm vụ' : 'Đã lưu nhiệm vụ'); S.f.qScale = q.scale; S.f.qType = q.type;
      closeModal(); await reload();
    } catch(e) { toast('Lỗi: ' + e.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Lưu'; }
  }

  async function deleteQuest(id){
    const q = byId(S.quests, id);
    if (!await ask('Xoá nhiệm vụ?', `Xoá <b>${esc(q.title)}</b> cùng toàn bộ các bước. Thao tác không thể hoàn tác.`)) return;
    try { await sbDelete('tm_quests', id); toast('Đã xoá nhiệm vụ'); await reload(); }
    catch(e) { toast('Lỗi: ' + e.message, true); }
  }

  // ════════════════════════════════════════════════════════
  // EXCEL: định nghĩa sheet (dùng chung cho export và import)
  // Dòng 1: tiêu đề tiếng Việt · dòng 2: khoá kỹ thuật (import đọc theo dòng này) · dữ liệu từ dòng 3.
  // Khoá bắt đầu bằng "_" là cột chỉ đọc (nền xám), import bỏ qua.
  // ════════════════════════════════════════════════════════
  const YES = 'Có', NO = 'Không', SEP = '; ';
  const joinList = a => (a || []).join(SEP);
  const splitList = v => String(v || '').split(/[;\n]/).map(x => x.trim()).filter(Boolean);
  const rewardToCell = r => r.type === 'character' ? `character:${r.id}` : r.term_id != null ? `term:${r.term_id}` : `link:${r.name || ''}|${r.url || ''}`;

  const SHEETS = [
    { name:'Nhan vat', key:'characters', title:'Nhân vật', required:['id','title','kind','group'],
      cols:[['id','id',18],['title','Chức danh',26],['kind','Loại',10,{ list:Object.keys(KINDS) }],['group','Nhóm',13,{ list:GROUP_KEYS }],
        ['term_id','Thuật ngữ liên kết (id)',38],['_term_name','Tên thuật ngữ',24],['article_url','Link bài (ghi đè)',40],['_resolved_url','Link đang dùng',40],
        ['summary','Họ là ai',50,{ wrap:1 }],['doing','Đang làm',40,{ wrap:1 }],['with_designer','Làm việc với bạn',50,{ wrap:1 }],
        ['reports_to','Báo cáo cho',18],['reports_to_small','Báo cáo cho (nhỏ)',18],['reports_to_agency','Báo cáo cho (agency)',18],['props','Đồ nghề',26],
        ['body_color','Màu thân',11],['outline_color','Màu viền',11],['tag','Nhãn phụ',26],
        ['cta1_label','Nút 1 nhãn',16],['cta1_url','Nút 1 URL',36],['cta2_label','Nút 2 nhãn',16],['cta2_url','Nút 2 URL',36],['is_active','Hiển thị',10,{ list:[YES, NO] }]],
      rows:() => S.chars.slice().sort((a, b) => a.id.localeCompare(b.id)),
      toCells:c => { const t = termOf(c.term_id), b = c.cta || [];
        return { id:c.id, title:c.title, kind:c.kind, group:c.group, term_id:c.term_id ?? '', _term_name:t ? t.name : '', article_url:c.article_url, _resolved_url:resolvedUrl(c) || '',
          summary:c.summary, doing:c.doing, with_designer:c.with_designer, reports_to:c.reports_to, reports_to_small:c.reports_to_small, reports_to_agency:c.reports_to_agency, props:joinList(c.props),
          body_color:(c.appearance || {}).body_color || '', outline_color:(c.appearance || {}).outline_color || '', tag:c.tag,
          cta1_label:b[0] ? b[0].label : '', cta1_url:b[0] ? b[0].url : '', cta2_label:b[1] ? b[1].label : '', cta2_url:b[1] ? b[1].url : '', is_active:c.is_active ? YES : NO }; },
      fromCells:(v, has) => { const o = { id:v.id };
        ['title','kind','group','article_url','summary','doing','with_designer','reports_to','reports_to_small','reports_to_agency','tag'].forEach(k => { if (has(k)) o[k] = v[k] || null; });
        if (has('body_color') || has('outline_color')){ const cur = (charOf(v.id) || {}).appearance || {};
          o.appearance_patch = { body_color: has('body_color') ? v.body_color || null : cur.body_color || null, outline_color: has('outline_color') ? v.outline_color || null : cur.outline_color || null }; }
        if (has('term_id')) o.term_id = v.term_id || null;
        if (has('props')) o.props = splitList(v.props);
        if (has('is_active')) o.is_active = v.is_active !== NO;
        if (has('cta1_label') || has('cta1_url') || has('cta2_label') || has('cta2_url')){
          const b = [[v.cta1_label, v.cta1_url], [v.cta2_label, v.cta2_url]].filter(([l, u]) => l || u).map(([l, u], i) => ({ label:l || u, url:u || '', primary:i === 0 }));
          o.cta = b.length ? b : null; }
        return o; } },
    { name:'Vi tri', key:'placements', title:'Vị trí', required:['character_id','room_id'],
      cols:[['id','id',28],['character_id','Nhân vật (id)',20],['_title','Chức danh',26],['_scale','Quy mô',10],['room_id','Phòng (id)',11],['_room_name','Tên phòng',24],['seat_order','Thứ tự ghế',11],['fixed','Cố định',10,{ list:[YES, NO] }]],
      rows:() => S.pls.slice().sort((a, b) => a.scale.localeCompare(b.scale) || a.room_id.localeCompare(b.room_id) || (a.seat_order ?? 1e9) - (b.seat_order ?? 1e9)),
      toCells:p => ({ id:p.id, character_id:p.character_id, _title:(charOf(p.character_id) || {}).title || '', _scale:p.scale, room_id:p.room_id, _room_name:(roomOf(p.room_id) || {}).name || '', seat_order:p.seat_order ?? '', fixed:p.fixed ? YES : NO }),
      fromCells:(v, has) => { const o = { id:v.id || `${v.character_id}@${v.room_id}`, character_id:v.character_id, room_id:v.room_id };
        if (has('seat_order')) o.seat_order = v.seat_order === '' ? null : Number(v.seat_order);
        if (has('fixed')) o.fixed = v.fixed === YES; return o; } },
    { name:'Phong ban', key:'rooms', title:'Phòng ban', required:['id'],
      cols:[['id','id',8],['_scale','Quy mô',10],['code','Mã',12],['name','Tên',28],['intro','Giới thiệu',70,{ wrap:1 }],['sort_order','Thứ tự',9]],
      rows:() => S.rooms.slice().sort((a, b) => a.scale.localeCompare(b.scale) * -1 || a.sort_order - b.sort_order),
      toCells:r => ({ id:r.id, _scale:r.scale, code:r.code, name:r.name, intro:r.intro, sort_order:r.sort_order }),
      fromCells:(v, has) => { const o = { id:v.id };
        ['code','name','intro'].forEach(k => { if (has(k)) o[k] = v[k] || (k === 'code' ? '' : null); });
        if (has('sort_order')) o.sort_order = v.sort_order === '' ? 0 : Number(v.sort_order); return o; } },
    { name:'Nhiem vu', key:'quests', title:'Nhiệm vụ', required:['id','scale','title','room_id'],
      cols:[['id','id',14],['type','Loại',9,{ list:Object.keys(QTYPES) }],['scale','Quy mô',9,{ list:SCALE_KEYS }],['sort_order','Thứ tự',8],['title','Tên',28],['room_id','Phòng tập hợp (id)',12],
        ['giver','Người giao (mã vị trí)',26],['gather','Người tham gia',44,{ wrap:1 }],['offer_text','Lời nhận việc',50,{ wrap:1 }],['done_text','Lời trả việc',50,{ wrap:1 }],
        ['rewards','Thẻ thưởng',44,{ wrap:1 }],['daily_date','Ngày (daily)',13],['is_active','Hiển thị',10,{ list:[YES, NO] }]],
      rows:() => S.quests.slice().sort((a, b) => a.scale.localeCompare(b.scale) * -1 || a.type.localeCompare(b.type) || a.sort_order - b.sort_order),
      toCells:q => ({ id:q.id, type:q.type, scale:q.scale, sort_order:q.sort_order, title:q.title, room_id:q.room_id, giver:q.giver, gather:joinList(q.gather),
        offer_text:q.offer_text, done_text:q.done_text, rewards:(q.rewards || []).map(rewardToCell).join(SEP), daily_date:q.daily_date || '', is_active:q.is_active ? YES : NO }),
      fromCells:(v, has) => { const o = { id:v.id };
        ['type','scale','title','room_id','giver','offer_text','done_text'].forEach(k => { if (has(k)) o[k] = v[k] || null; });
        if (has('sort_order')) o.sort_order = v.sort_order === '' ? 0 : Number(v.sort_order);
        if (has('gather')) o.gather = splitList(v.gather);
        if (has('rewards')) o.rewards = splitList(v.rewards).map(x => {
          const m = /^(term|character|link):(.*)$/.exec(x); if (!m) return { bad:x };
          if (m[1] === 'character') return { type:'character', id:m[2].trim() };
          if (m[1] === 'term') return { type:'term', term_id:m[2].trim() };
          const [name, url] = m[2].split('|'); return { type:'term', name:(name || '').trim(), url:(url || '').trim() || null }; });
        if (has('daily_date')) o.daily_date = v.daily_date || null;
        if (has('is_active')) o.is_active = v.is_active !== NO;
        return o; } },
    { name:'Buoc nhiem vu', key:'steps', title:'Bước nhiệm vụ', required:['id','quest_id','type','task_text'],
      cols:[['id','id',16],['quest_id','Nhiệm vụ (id)',14],['_quest_title','Tên nhiệm vụ',26],['sort_order','Thứ tự',8],['type','Loại bước',10,{ list:Object.keys(STEP_TYPES) }],
        ['target','Người cần gặp (mã vị trí)',26],['task_text','Mục tiêu',44,{ wrap:1 }],['line_text','Lời thoại',56,{ wrap:1 }],['secs','Số giây',9]],
      rows:() => S.steps.slice().sort((a, b) => a.quest_id.localeCompare(b.quest_id) || a.sort_order - b.sort_order),
      toCells:s => ({ id:s.id, quest_id:s.quest_id, _quest_title:(byId(S.quests, s.quest_id) || {}).title || '', sort_order:s.sort_order, type:s.type, target:s.target,
        task_text:s.task_text, line_text:s.line_text, secs:s.secs ?? '' }),
      fromCells:(v, has) => { const o = { id:v.id };
        ['quest_id','type','target','task_text','line_text'].forEach(k => { if (has(k)) o[k] = v[k] || null; });
        if (has('sort_order')) o.sort_order = v.sort_order === '' ? 0 : Number(v.sort_order);
        if (has('secs')) o.secs = v.secs === '' ? null : Number(v.secs); return o; } },
  ];

  function loadExcelJS(){
    if (window.ExcelJS) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = EXCELJS_URL; s.onload = res; s.onerror = () => rej(new Error('Không tải được thư viện ExcelJS')); document.head.appendChild(s); });
  }

  // ---------- export ----------
  const GRAY = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFEDEDF2' } };
  function addSheet(wb, def){
    const ws = wb.addWorksheet(def.name, { views:[{ state:'frozen', ySplit:2, xSplit:1 }] });
    ws.columns = def.cols.map(([key, , w]) => ({ key, width:w }));
    const head = ws.getRow(1), keys = ws.getRow(2);
    def.cols.forEach(([key, label], i) => {
      const ro = key.startsWith('_');
      Object.assign(head.getCell(i + 1), { value: label + (ro ? ' (chỉ đọc)' : ''), font:{ bold:true, italic:ro, color:{ argb: ro ? 'FF77778A' : 'FF1D1A5E' } },
        fill: ro ? GRAY : { type:'pattern', pattern:'solid', fgColor:{ argb:'FFECEBF8' } }, alignment:{ vertical:'middle', wrapText:true } });
      Object.assign(keys.getCell(i + 1), { value:key, font:{ size:9, color:{ argb:'FF9999AA' } }, fill: ro ? GRAY : undefined });
    });
    head.height = 30;
    def.rows().forEach(r => {
      const v = def.toCells(r);
      const row = ws.addRow(def.cols.map(([key]) => { const x = v[key]; return x === '' || x == null ? null : (typeof x === 'number' ? x : String(x)); }));
      def.cols.forEach(([key, , , o], i) => { const cell = row.getCell(i + 1);
        if (key.startsWith('_')){ cell.fill = GRAY; cell.font = { italic:true, color:{ argb:'FF77778A' } }; }
        if (o && o.wrap) cell.alignment = { wrapText:true, vertical:'top' }; else cell.alignment = { vertical:'top' }; });
    });
    const last = Math.max(ws.rowCount, 2) + 200;
    def.cols.forEach(([key, , , o], i) => { if (!o || !o.list) return; const col = ws.getColumn(i + 1).letter;
      ws.dataValidations.add(`${col}3:${col}${last}`, { type:'list', allowBlank:true, formulae:[`"${o.list.join(',')}"`] }); });
    ws.autoFilter = { from:{ row:2, column:1 }, to:{ row:2, column:def.cols.length } };
  }

  function addGuide(wb){
    const ws = wb.addWorksheet('Huong dan'); ws.columns = [{ width:28 }, { width:100 }];
    const lines = [
      ['TEAM MAP — FILE NỘI DUNG', `Xuất ngày ${today()} từ Admin CMS.`],
      [],
      ['Cách sửa', 'Sửa trực tiếp các ô trong từng sheet rồi vào Admin → Team Map → Import / Export → Chọn file. Hệ thống sẽ hiện màn xem trước trước khi ghi.'],
      ['Dòng 1 / dòng 2', 'Dòng 1 là tiêu đề tiếng Việt. Dòng 2 là khoá kỹ thuật (chữ xám): KHÔNG sửa dòng này. Import đọc cột theo dòng 2 nên đổi thứ tự cột không sao.'],
      ['Cột nền xám (chỉ đọc)', 'Chỉ để bạn đọc cho dễ hiểu (tên thuật ngữ, link đang dùng, tên phòng…). Import bỏ qua các cột này.'],
      ['Thêm / cập nhật', 'Dòng có id trùng với dữ liệu hiện có → cập nhật. Dòng có id mới → thêm mới. Dòng không có trong file → giữ nguyên. Import KHÔNG BAO GIỜ xoá.'],
      ['Nhiều giá trị trong 1 ô', `Đồ nghề, người tham gia, thẻ thưởng: ngăn bằng "${SEP}" (chấm phẩy + dấu cách).`],
      ['Hiển thị', `Ghi "${YES}" hoặc "${NO}".`],
      [],
      ['SHEET', ''],
      ['Nhan vat', 'Mỗi dòng là một nhân vật. "Thuật ngữ liên kết (id)" lấy ở sheet Thuat ngu. Link bài (ghi đè) để trống thì game dùng URL của thuật ngữ. Nút 1 là nút chính.'],
      ['Vi tri', 'Mỗi dòng là một chỗ ngồi. id = <id nhân vật>@<id phòng> (để trống id thì tự tạo). Đổi phòng của một chỗ đang có thì nên làm trong CMS để nhiệm vụ tự cập nhật; đổi ở đây sẽ tạo chỗ ngồi mới.'],
      ['Phong ban', 'Chỉ sửa được phòng đã có (mã, tên, giới thiệu, thứ tự). Không thêm phòng mới.'],
      ['Nhiem vu', 'Người giao và người tham gia là mã vị trí (sheet Vi tri), cùng quy mô với nhiệm vụ. Game chỉ chạy loại "main".'],
      ['Buoc nhiem vu', 'Mỗi dòng là một bước của nhiệm vụ. Bước "talk" cần cột "Người cần gặp". Bước "present" chỉ dùng ở phòng có TV.'],
      ['Thuat ngu', 'Danh sách thuật ngữ để tra id. Import bỏ qua sheet này.'],
      [],
      ['GIÁ TRỊ HỢP LỆ', ''],
      ['Loại nhân vật (kind)', Object.entries(KINDS).map(([k, v]) => `${k} = ${v}`).join(' · ') + '. Chỉ có 1 nhân vật "player".'],
      ['Nhóm (group)', GROUP_KEYS.map(k => `${k} = ${GROUPS[k].name}`).join(' · ')],
      ['Đồ nghề (props)', L.props.join(', ')],
      ['Loại nhiệm vụ (type)', 'main = chuỗi quest chính · daily = nhiệm vụ hằng ngày (game chưa chạy)'],
      ['Quy mô (scale)', SCALE_KEYS.map(k => `${k} = ${SCALE_NAME[k]}`).join(' · ')],
      ['Màu thân / viền', 'Mã màu dạng #RRGGBB (vd #FFC53D). Để trống thì dùng tạo hình mặc định.'],
      ['Cố định (Vi tri)', `"${YES}" = ngồi yên tại ghế: không đi dạo, không đi tới điểm tập hợp (vd Client ở phòng họp).`],
      ['Loại bước', Object.entries(STEP_TYPES).map(([k, v]) => `${k} = ${v}`).join(' · ')],
      ['Phòng có TV', TV_ROOMS.join(', ')],
      ['Thẻ thưởng', 'term:<id thuật ngữ> · character:<id nhân vật> · link:<tên>|<url> (thẻ chưa có trong thư viện)'],
    ];
    lines.forEach(l => { const r = ws.addRow(l); r.getCell(1).font = { bold:true }; r.getCell(2).alignment = { wrapText:true, vertical:'top' }; });
    [1, 10, 18].forEach(n => ws.getRow(n).getCell(1).font = { bold:true, color:{ argb:'FF241775' }, size:12 });
  }

  async function exportXlsx(btn){
    btn.disabled = true; btn.textContent = 'Đang tạo file...';
    try {
      await loadExcelJS(); await load();
      const wb = new ExcelJS.Workbook(); wb.creator = 'TELOS Admin CMS';
      addGuide(wb);
      SHEETS.forEach(d => addSheet(wb, d));
      const tws = wb.addWorksheet('Thuat ngu', { views:[{ state:'frozen', ySplit:1 }] });
      tws.columns = [{ header:'id', key:'id', width:38 }, { header:'Tên', key:'name', width:32 }, { header:'Nhóm', key:'cat', width:20 }, { header:'URL', key:'url', width:60 }, { header:'Published', key:'pub', width:10 }];
      tws.getRow(1).font = { bold:true };
      allConcepts.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi')).forEach(t => tws.addRow({ id:String(t.id), name:t.name, cat:catName(t.category_id), url:t.url || '', pub:t.is_published ? YES : NO }));
      const buf = await wb.xlsx.writeBuffer();
      const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })), download:`team-map-${today()}.xlsx` });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Đã xuất file Excel');
    } catch(e) { toast('Lỗi xuất file: ' + e.message, true); }
    finally { btn.disabled = false; btn.textContent = '⬇ Xuất file Excel'; }
  }

  // ---------- import ----------
  function cellText(v){
    if (v == null) return '';
    if (v instanceof Date) return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`;
    if (typeof v === 'object'){
      if (v.richText) return v.richText.map(x => x.text).join('');
      if ('text' in v) return cellText(v.text);
      if ('result' in v) return cellText(v.result);
      if (v.error) return '';
    }
    return String(v);
  }
  const norm = v => (v == null ? '' : String(v)).replace(/\r\n?/g, '\n').trim();

  function readSheet(ws){
    const keys = {}; ws.getRow(2).eachCell({ includeEmpty:false }, (c, n) => { const k = norm(cellText(c.value)); if (k) keys[n] = k; });
    const rows = [];
    for (let i = 3; i <= ws.rowCount; i++){
      const row = ws.getRow(i), v = {}; let any = false;
      Object.entries(keys).forEach(([n, k]) => { const t = norm(cellText(row.getCell(+n).value)); v[k] = t; if (t && !k.startsWith('_')) any = true; });
      if (any) rows.push({ n:i, v });
    }
    return { keys:new Set(Object.values(keys)), rows };
  }

  async function importFile(file){
    S.imp = { file:file.name, busy:true }; renderIO();
    try {
      await loadExcelJS(); await load();
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
      S.imp = analyse(wb, file.name);
    } catch(e) { S.imp = { file:file.name, fatal:e.message }; }
    renderIO();
  }

  // Kiểm tra + so sánh với dữ liệu hiện có
  function analyse(wb, fileName){
    const errors = [], res = { file:fileName, sheets:{}, errors };
    const E = (def, n, key, msg) => errors.push({ sheet:def.name, row:n, col: key ? ((def.cols.find(c => c[0] === key) || [])[1] || key) : '', msg });
    const parsed = {};
    SHEETS.forEach(def => {
      const ws = wb.getWorksheet(def.name); if (!ws) return;
      const { keys, rows } = readSheet(ws);
      const missing = def.required.filter(k => !keys.has(k));
      if (missing.length){ E(def, 2, null, `Thiếu cột bắt buộc: ${missing.join(', ')} (dòng 2 phải giữ nguyên khoá kỹ thuật)`); return; }
      const has = k => keys.has(k), seen = {};
      parsed[def.key] = rows.map(r => { const o = def.fromCells(r.v, has);
        if (!o.id) E(def, r.n, 'id', 'Thiếu id');
        else if (seen[o.id]) E(def, r.n, 'id', `Trùng id với dòng ${seen[o.id]}`); else seen[o.id] = r.n;
        return { n:r.n, v:r.v, o }; });
      parsed[def.key].has = has;
    });
    if (!Object.keys(parsed).length) errors.push({ sheet:'—', row:'', col:'', msg:'Không tìm thấy sheet nào của Team Map (Nhan vat, Vi tri, Phong ban, Nhiem vu, Buoc nhiem vu)' });

    // dữ liệu "sau khi import" để kiểm tra tham chiếu (DB + dòng trong file)
    const merged = (list, key) => { const m = Object.fromEntries(list.map(x => [x.id, { ...x }])); (parsed[key] || []).forEach(r => { if (r.o.id) m[r.o.id] = { ...(m[r.o.id] || {}), ...r.o }; }); return m; };
    const C = merged(S.chars, 'characters'), P = merged(S.pls, 'placements'), Q = merged(S.quests, 'quests');
    Object.values(P).forEach(p => { if (!p.scale) p.scale = (roomOf(p.room_id) || {}).scale; });
    const termIds = new Set(allConcepts.map(t => String(t.id)));
    const def = k => SHEETS.find(d => d.key === k);
    const isInt = v => v === '' || /^-?\d+$/.test(v);
    const isNum = v => v === '' || !isNaN(Number(v));
    const yesNo = (d, r, k) => { if (r.v[k] !== undefined && r.v[k] !== '' && ![YES, NO].includes(r.v[k])) E(d, r.n, k, `Chỉ nhận "${YES}" hoặc "${NO}"`); };

    (parsed.characters || []).forEach(r => { const d = def('characters'), o = r.o, isNew = !charOf(o.id), m = C[o.id];
      if (o.id && !/^[a-z0-9][a-z0-9-]*$/.test(o.id)) E(d, r.n, 'id', 'Id chỉ gồm chữ thường không dấu, số và dấu -');
      if (!m.title) E(d, r.n, 'title', 'Thiếu chức danh');
      if (!KINDS[m.kind || 'role']) E(d, r.n, 'kind', `Giá trị không hợp lệ "${m.kind}". Hợp lệ: ${Object.keys(KINDS).join(', ')}`);
      if (!GROUPS[m.group]) E(d, r.n, 'group', isNew && !m.group ? 'Thiếu nhóm' : `Giá trị không hợp lệ "${m.group}". Hợp lệ: ${GROUP_KEYS.join(', ')}`);
      if (o.term_id && !termIds.has(String(o.term_id))) E(d, r.n, 'term_id', `Không có thuật ngữ id "${o.term_id}" (xem sheet Thuat ngu)`);
      ['body_color','outline_color'].forEach(k => { if (r.v[k] && !HEX.test(r.v[k])) E(d, r.n, k, 'Mã màu dạng #RRGGBB'); });
      ['reports_to','reports_to_small','reports_to_agency'].forEach(k => { if (o[k] && !C[o[k]]) E(d, r.n, k, `Không có nhân vật "${o[k]}"`); if (o[k] && o[k] === o.id) E(d, r.n, k, 'Không thể báo cáo cho chính mình'); });
      (o.props || []).forEach(p => { if (!L.props.includes(p)) E(d, r.n, 'props', `Đồ nghề không hợp lệ "${p}"`); });
      (o.cta || []).forEach((b, i) => { if (!/^https?:\/\//.test(b.url)) E(d, r.n, `cta${i + 1}_url`, 'Cần URL đầy đủ (https://...)'); });
      if (o.article_url && !/^https?:\/\//.test(o.article_url)) E(d, r.n, 'article_url', 'Cần URL đầy đủ (https://...)');
      yesNo(d, r, 'is_active'); });
    if (Object.values(C).filter(c => c.kind === 'player').length > 1) errors.push({ sheet:'Nhan vat', row:'', col:'Loại', msg:'Có nhiều hơn 1 nhân vật "player"' });

    (parsed.placements || []).forEach(r => { const d = def('placements'), o = r.o;
      if (!C[o.character_id]) E(d, r.n, 'character_id', `Không có nhân vật "${o.character_id}"`);
      if (!roomOf(o.room_id)) E(d, r.n, 'room_id', `Không có phòng "${o.room_id}"`);
      else if (roomKind(o.room_id) === 'locked') E(d, r.n, 'room_id', 'Không xếp chỗ vào phòng đóng');
      if (o.id !== `${o.character_id}@${o.room_id}`) E(d, r.n, 'id', `id phải là "${o.character_id}@${o.room_id}"`);
      if (!isInt(r.v.seat_order ?? '')) E(d, r.n, 'seat_order', 'Thứ tự ghế phải là số nguyên');
      yesNo(d, r, 'fixed'); });

    (parsed.rooms || []).forEach(r => { const d = def('rooms'), o = r.o;
      if (!roomOf(o.id)) E(d, r.n, 'id', `Không có phòng "${o.id}" (import không tạo phòng mới)`);
      if ('name' in o && !o.name) E(d, r.n, 'name', 'Thiếu tên phòng');
      if (!isInt(r.v.sort_order ?? '')) E(d, r.n, 'sort_order', 'Thứ tự phải là số nguyên'); });

    const plOk = (pid, scale) => P[pid] && P[pid].scale === scale;
    (parsed.quests || []).forEach(r => { const d = def('quests'), o = r.o, m = Q[o.id];
      if (!QTYPES[m.type || 'main']) E(d, r.n, 'type', 'Chỉ nhận main hoặc daily');
      if (!SCALE_NAME[m.scale]) E(d, r.n, 'scale', `Chỉ nhận ${SCALE_KEYS.join(', ')}`);
      if (!m.title) E(d, r.n, 'title', 'Thiếu tên');
      const room = roomOf(m.room_id);
      if (!room) E(d, r.n, 'room_id', `Không có phòng "${m.room_id}"`); else if (room.scale !== m.scale) E(d, r.n, 'room_id', `Phòng ${m.room_id} không thuộc quy mô ${m.scale}`);
      if (!plOk(m.giver, m.scale)) E(d, r.n, 'giver', `Mã vị trí "${m.giver || ''}" không tồn tại ở quy mô ${m.scale}`);
      (m.gather || []).forEach(g => { if (!plOk(g, m.scale)) E(d, r.n, 'gather', `Mã vị trí "${g}" không tồn tại ở quy mô ${m.scale}`); });
      (o.rewards || []).forEach(x => {
        if (x.bad) E(d, r.n, 'rewards', `Không hiểu "${x.bad}" — dùng term:<id>, character:<id> hoặc link:<tên>|<url>`);
        else if (x.type === 'character' && !C[x.id]) E(d, r.n, 'rewards', `Không có nhân vật "${x.id}"`);
        else if (x.type === 'term' && x.term_id != null && !termIds.has(String(x.term_id))) E(d, r.n, 'rewards', `Không có thuật ngữ id "${x.term_id}"`);
        else if (x.type === 'term' && x.term_id == null && !x.name) E(d, r.n, 'rewards', 'Thẻ link: thiếu tên'); });
      if (o.daily_date && !/^\d{4}-\d{2}-\d{2}$/.test(o.daily_date)) E(d, r.n, 'daily_date', 'Ngày phải có dạng YYYY-MM-DD');
      if (!isInt(r.v.sort_order ?? '')) E(d, r.n, 'sort_order', 'Thứ tự phải là số nguyên');
      yesNo(d, r, 'is_active'); });

    (parsed.steps || []).forEach(r => { const d = def('steps'), o = r.o, cur = byId(S.steps, o.id) || {}, m = { ...cur, ...o }, q = Q[m.quest_id];
      if (!q) E(d, r.n, 'quest_id', `Không có nhiệm vụ "${m.quest_id}"`);
      if (!STEP_TYPES[m.type]) E(d, r.n, 'type', `Loại bước không hợp lệ "${m.type}". Hợp lệ: ${Object.keys(STEP_TYPES).join(', ')}`);
      if (q && m.type === 'talk' && !plOk(m.target, q.scale)) E(d, r.n, 'target', `Bước talk cần mã vị trí hợp lệ ở quy mô ${q.scale} (đang là "${m.target || ''}")`);
      if (q && m.type === 'present' && !TV_ROOMS.includes(q.room_id)) E(d, r.n, 'type', `Bước present chỉ dùng ở phòng có TV (${TV_ROOMS.join(', ')}); nhiệm vụ đang tập hợp ở ${q.room_id}`);
      if (!m.task_text) E(d, r.n, 'task_text', 'Thiếu dòng mục tiêu');
      if (!isNum(r.v.secs ?? '')) E(d, r.n, 'secs', 'Số giây phải là số');
      if (!isInt(r.v.sort_order ?? '')) E(d, r.n, 'sort_order', 'Thứ tự phải là số nguyên'); });
    // bước ở nhiệm vụ đang có trong DB cũng phải hợp lệ nếu nhiệm vụ đổi phòng/quy mô trong file
    (parsed.quests || []).forEach(r => { const q = Q[r.o.id];
      S.steps.filter(s => s.quest_id === q.id && !(parsed.steps || []).some(x => x.o.id === s.id)).forEach(s => {
        if (s.type === 'talk' && !plOk(s.target, q.scale)) E(def('quests'), r.n, 'scale', `Bước ${s.id} đang gặp "${s.target}" không thuộc quy mô ${q.scale}`);
        if (s.type === 'present' && !TV_ROOMS.includes(q.room_id)) E(def('quests'), r.n, 'room_id', `Bước ${s.id} là present nhưng phòng ${q.room_id} không có TV`); }); });

    // so sánh từng ô (theo đúng định dạng đã xuất) để biết thêm mới / cập nhật / không đổi
    SHEETS.forEach(d => {
      const list = parsed[d.key]; if (!list) return;
      const cur = { characters:S.chars, placements:S.pls, rooms:S.rooms, quests:S.quests, steps:S.steps }[d.key];
      const out = { title:d.title, name:d.name, added:[], updated:[], same:0, errors:errors.filter(e => e.sheet === d.name).length };
      list.forEach(r => {
        const old = r.o.id ? byId(cur, r.o.id) : null;
        if (!old){ out.added.push(r); return; }
        const oc = d.toCells(old), changes = [];
        d.cols.forEach(([k, label]) => { if (k.startsWith('_') || !list.has(k) || k === 'id') return;
          const a = norm(oc[k]), b = norm(r.v[k]); if (a !== b) changes.push({ k, label, a, b }); });
        if (changes.length) out.updated.push({ ...r, changes, old }); else out.same++;
      });
      res.sheets[d.key] = out;
    });
    return res;
  }

  async function applyImport(btn){
    const imp = S.imp; if (!imp || imp.errors.length) return;
    const p = {};
    SHEETS.forEach(d => { const s = imp.sheets[d.key]; if (!s) return;
      let rows = [...s.added, ...s.updated].map(r => r.o);
      if (d.key === 'quests' || d.key === 'steps'){ // gửi đủ cột (giữ giá trị cũ cho cột không có trong file)
        const cur = d.key === 'quests' ? S.quests : S.steps;
        rows = rows.map(o => ({ ...(byId(cur, o.id) || {}), ...o }));
        if (d.key === 'steps') rows = rows.map(o => ({ ...o, target: o.type === 'talk' ? o.target : null }));
        if (d.key === 'quests') rows = rows.map(o => { delete o.updated_at; return o; });
      }
      if (d.key === 'rooms') rows = s.updated.map(r => r.o);
      if (rows.length) p[d.key] = rows; });
    if (!Object.keys(p).length) return toast('Không có thay đổi nào để áp dụng');
    btn.disabled = true; btn.textContent = 'Đang ghi...';
    try {
      await sbRpc('tm_import', { p });
      const sum = SHEETS.filter(d => imp.sheets[d.key]).map(d => { const s = imp.sheets[d.key]; return `${d.title}: ${s.added.length} thêm · ${s.updated.length} cập nhật`; });
      S.imp = { done:sum, file:imp.file }; await load(); renderIO(); toast('Đã áp dụng import');
    } catch(e) { toast('Lỗi, chưa ghi gì vào DB: ' + e.message, true); btn.disabled = false; btn.textContent = 'Áp dụng'; }
  }

  function renderIO(){
    const imp = S.imp;
    let preview = '';
    if (imp && imp.busy) preview = '<div class="empty-state">Đang đọc và kiểm tra file...</div>';
    else if (imp && imp.fatal) preview = `<div class="tm-warn">Không đọc được file <b>${esc(imp.file)}</b>: ${esc(imp.fatal)}</div>`;
    else if (imp && imp.done) preview = `<div class="tm-ok"><b>Đã import ${esc(imp.file)}</b><br>${imp.done.map(esc).join('<br>')}</div>`;
    else if (imp && imp.sheets){
      const totalChanges = Object.values(imp.sheets).reduce((n, s) => n + s.added.length + s.updated.length, 0);
      preview = `<h3 class="tm-h3">Xem trước · ${esc(imp.file)}</h3>
        ${imp.errors.length ? `<div class="tm-warn"><b>${imp.errors.length} lỗi — chưa ghi gì. Sửa file rồi chọn lại.</b><table class="tm-errtable"><tr><th>Sheet</th><th>Dòng</th><th>Cột</th><th>Lý do</th></tr>
          ${imp.errors.map(e => `<tr><td>${esc(e.sheet)}</td><td>${esc(e.row)}</td><td>${esc(e.col)}</td><td>${esc(e.msg)}</td></tr>`).join('')}</table></div>` : ''}
        <div class="tm-impgrid">${SHEETS.filter(d => imp.sheets[d.key]).map(d => { const s = imp.sheets[d.key];
          return `<details class="tm-impcard"><summary><b>${esc(s.title)}</b><span>${s.added.length} thêm mới · ${s.updated.length} cập nhật · ${s.same} không đổi · <span class="${s.errors ? 'tm-bad' : ''}">${s.errors} lỗi</span></span></summary>
            ${s.added.map(r => `<div class="tm-impline"><span class="badge badge-pub">Thêm</span> dòng ${r.n} · <code>${esc(r.o.id)}</code> ${esc(r.v.title || r.v.name || r.v.task_text || '')}</div>`).join('')}
            ${s.updated.map(r => `<div class="tm-impline"><span class="badge badge-vai-tro">Cập nhật</span> dòng ${r.n} · <code>${esc(r.o.id)}</code>
              <ul>${r.changes.map(c => `<li><b>${esc(c.label)}</b>: <del>${esc(c.a.slice(0, 120)) || '∅'}</del> → <ins>${esc(c.b.slice(0, 120)) || '∅'}</ins></li>`).join('')}</ul></div>`).join('')}
            ${!s.added.length && !s.updated.length ? '<div class="form-hint">Không có thay đổi</div>' : ''}</details>`; }).join('')}</div>
        <div class="tm-inline" style="margin-top:14px"><button class="btn-add" data-act="imp-apply" ${imp.errors.length || !totalChanges ? 'disabled' : ''}>Áp dụng</button>
          <button class="btn-cancel" data-act="imp-cancel">Huỷ</button>
          <span class="form-hint">${imp.errors.length ? 'Còn lỗi nên chưa áp dụng được' : totalChanges ? `Sẽ ghi ${totalChanges} dòng trong một lần (lỗi thì không ghi gì)` : 'File giống hệt dữ liệu hiện tại'}</span></div>`;
    }
    body().innerHTML = `<div class="toolbar"><h2>Import / Export</h2></div>
      <div class="tm-iogrid">
        <div class="export-card"><h3>Xuất file Excel</h3><p>Một file <code>team-map-YYYY-MM-DD.xlsx</code>: sheet hướng dẫn + mỗi bảng một sheet (nhân vật, vị trí, phòng ban, nhiệm vụ, bước) + sheet tra cứu thuật ngữ.</p>
          <button class="btn-add" data-act="exp">⬇ Xuất file Excel</button></div>
        <div class="export-card"><h3>Nhập file Excel</h3><p>Cập nhật theo id, thêm dòng mới, <b>không xoá</b> gì. Luôn có màn xem trước; chỉ ghi khi không còn lỗi.</p>
          <label class="btn-export tm-file">Chọn file .xlsx<input type="file" accept=".xlsx" data-act="imp-file" hidden/></label></div>
      </div>${preview}`;
  }

  // ════════════════════════════════════════════════════════
  // EVENTS (uỷ quyền cho panel + modal)
  // ════════════════════════════════════════════════════════
  function onClick(e){
    const pick = e.target.closest('[data-pick]');
    if (pick){ const box = pick.closest('.tm-combo'), name = box.dataset.combo;
      box.querySelector('[data-combo-v]').value = pick.dataset.pick; box.querySelector('[data-combo-q]').value = pick.dataset.label;
      box.querySelector('.tm-combo-list').hidden = true; comboPicked(name, pick.dataset.pick); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, i = +b.dataset.i, F = S.form;
    switch (b.dataset.act){
      case 'retry': return open();
      case 'tab': S.tab = b.dataset.tab; return render();
      case 'close': return closeModal();
      case 'char-new': return openChar(null);
      case 'char-edit': return openChar(id);
      case 'char-del': return deleteChar(id);
      case 'char-toggle': return toggleChar(id);
      case 'char-save': return saveChar();
      case 'term-new': { const box = formRoot().querySelector('.tm-newterm'); box.hidden = false;
        const cat = allCats.find(c => c.slug === L.roleCategoryByGroup[fv('group')]); if (cat) formRoot().querySelector('[name="nt_cat"]').value = cat.id;
        formRoot().querySelector('[name="nt_name"]').value = formRoot().querySelector('[name="nt_name"]').value || fv('title'); return; }
      case 'term-cancel': formRoot().querySelector('.tm-newterm').hidden = true; return;
      case 'term-create': return createTerm();
      case 'term-clear': formRoot().querySelector('[data-combo-v="term"]').value = ''; formRoot().querySelector('[data-combo-q="term"]').value = ''; return updateResolved();
      case 'cta-add': F.cta.push({ label:'', url:'', primary:!F.cta.length }); return renderCta();
      case 'cta-del': F.cta.splice(i, 1); return renderCta();
      case 'pl-add': F.pls[b.dataset.scale].push({ orig:null, room_id:'', seat_order:null, fixed:false }); return renderPls();
      case 'pl-del': F.pls[b.dataset.scale].splice(i, 1); return renderPls();
      case 'room-edit': return openRoom(id);
      case 'room-save': return saveRoom();
      case 'quest-new': return openQuest(null);
      case 'quest-edit': return openQuest(id);
      case 'quest-dup': return openQuest(id, true);
      case 'quest-del': return deleteQuest(id);
      case 'quest-save': return saveQuest();
      case 'step-add': F.steps.push({ type:'talk', target:'', task_text:'', line_text:'', secs:null }); return renderQuestForm();
      case 'step-del': F.steps.splice(i, 1); return renderQuestForm();
      case 'reward-add': F.q.rewards.push({ type:'term', term_id:null }); return renderQuestForm();
      case 'reward-del': F.q.rewards.splice(i, 1); return renderQuestForm();
      case 'exp': return exportXlsx(b);
      case 'imp-apply': return applyImport(b);
      case 'imp-cancel': S.imp = null; return renderIO();
    }
  }

  function comboPicked(name, value){
    if (name === 'term') return updateResolved();
    const m = /^reward-(\d+)$/.exec(name);
    if (m){ const r = S.form.q.rewards[+m[1]]; r.term_id = value; delete r.name; delete r.url; }
  }

  function onInput(e){
    const t = e.target;
    if (t.dataset.f === 'q'){ S.f.q = t.value; renderChars(); const el = body().querySelector('[data-f="q"]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); return; }
    if (t.dataset.comboQ){ const name = t.dataset.comboQ;
      const items = name === 'term' ? roleTerms().map(x => ({ id:String(x.id), label:x.name, sub:catName(x.category_id) }))
        : allConcepts.map(x => ({ id:String(x.id), label:x.name, sub:catName(x.category_id) + (x.is_published ? '' : ' · draft') }));
      if (!t.value) { t.parentElement.querySelector('[data-combo-v]').value = ''; if (name === 'term') updateResolved(); }
      return comboFilter(t, items); }
    const F = S.form; if (!F) return;
    if (t.name === 'title' && F.kind === 'char' && F.isNew){ formRoot().querySelector('[name="id"]').value = toSlug(t.value); return; }
    if (t.name === 'article_url') return updateResolved();
    if (t.dataset.ctaF){ const b = F.cta[+t.dataset.i]; if (t.dataset.ctaF === 'primary') b.primary = t.checked; else b[t.dataset.ctaF] = t.value.trim(); return; }
    if (t.dataset.plF === 'seat_order'){ F.pls[t.dataset.scale][+t.dataset.i].seat_order = t.value; return; }
    if (t.dataset.q && !['scale','type','room_id','is_active'].includes(t.dataset.q)){ F.q[t.dataset.q] = t.value; return; }
    if (t.dataset.s && ['task_text','line_text','secs'].includes(t.dataset.s)){ F.steps[+t.dataset.i][t.dataset.s] = t.value; return; }
  }
  function onFocus(e){ const t = e.target; if (t.dataset && t.dataset.comboQ) onInput(e); }

  function onChange(e){
    const t = e.target, F = S.form;
    if (t.dataset.act === 'imp-file' && t.files[0]) return importFile(t.files[0]);
    if (t.dataset.f && t.dataset.f !== 'q'){ S.f[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; return S.tab === 'quests' ? renderQuests() : renderChars(); }
    if (!F) return;
    if (t.dataset.prop){ t.checked ? F.props.add(t.dataset.prop) : F.props.delete(t.dataset.prop); return; }
    if (t.name === 'kind'){ formRoot().querySelector('.tm-special').hidden = !['author','guest'].includes(t.value); return; }
    if (t.name === 'id' && F.isNew) return renderPls();
    if (t.dataset.plF === 'room_id'){ F.pls[t.dataset.scale][+t.dataset.i].room_id = t.value; return renderPls(); }
    if (t.dataset.plF === 'fixed'){ F.pls[t.dataset.scale][+t.dataset.i].fixed = t.checked; return; }
    if (t.dataset.gather){ const g = new Set(F.q.gather || []); t.checked ? g.add(t.dataset.gather) : g.delete(t.dataset.gather); F.q.gather = [...g]; return; }
    if (t.dataset.q){
      const k = t.dataset.q;
      if (k === 'is_active'){ F.q.is_active = t.checked; return; }
      F.q[k] = t.value;
      if (k === 'scale'){ F.q.room_id = ''; F.q.giver = ''; F.q.gather = []; F.steps.forEach(s => { if (s.type === 'talk') s.target = ''; }); }
      if (k === 'type' && F.isNew){ F.q.id = newQuestId(F.q.scale, F.q.type); }
      if (['scale','type','room_id'].includes(k)) renderQuestForm();
      return;
    }
    if (t.dataset.s === 'type'){ const s = F.steps[+t.dataset.i]; s.type = t.value; if (t.value !== 'talk') s.target = null; if (t.value !== 'talk' && s.secs == null) s.secs = 5; return renderQuestForm(); }
    if (t.dataset.s === 'target'){ F.steps[+t.dataset.i].target = t.value; return; }
    if (t.dataset.r === 'type'){ F.q.rewards[+t.dataset.i] = t.value === 'character' ? { type:'character', id:'' } : { type:'term', term_id:null }; return renderQuestForm(); }
    if (t.dataset.r === 'id'){ F.q.rewards[+t.dataset.i].id = t.value; return; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const p = panel(); if (!p) return;
    p.addEventListener('click', onClick); p.addEventListener('input', onInput); p.addEventListener('change', onChange);
    document.addEventListener('focusin', e => { if (e.target.closest && e.target.closest('#tm-modal')) onFocus(e); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('tm-modal')?.classList.contains('open') && !document.getElementById('tm-confirm')?.classList.contains('open')) closeModal(); });
  });

  window.TMAdmin = { open, reload, _S:S, _analyse:analyse, _SHEETS:SHEETS };
})();
