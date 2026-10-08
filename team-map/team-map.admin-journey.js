// Team Map CMS — trang Hành trình UI/UX (docs/SPEC-journey.md mục 7): tab "Hành trình" (checkpoint + cài đặt trang), sheet Excel "Hanh trinh".
// team-map.admin.js gọi window.TM_ADMIN_JOURNEY(ctx) với các helper của nó; module này không tự đăng ký sự kiện nào.
window.TM_ADMIN_JOURNEY = function(X){
'use strict';
const { S, esc, toast } = X;
const IDS = ['start', 'figma', 'ui', 'ux', 'ds', 'ai', 'pdm', 'web', 'code', 'finish'];
const KIND = { start:'Xuất phát', main:'Trạm chính', branch:'Nhánh rẽ', finish:'Đích' };
const PROPS = () => (window.TM_MASCOT ? window.TM_MASCOT.PROP_LIST : (window.TM_LAYOUT && window.TM_LAYOUT.props) || []);
const URL_RE = /^https?:\/\/\S+$/i;
const F = () => S.jform;
const terms = () => (typeof allConcepts !== 'undefined' ? allConcepts : []);
const termName = id => { const t = terms().find(x => String(x.id) === String(id)); return t ? t.name : `#${id}`; };

// style riêng của tab này
if (!document.getElementById('tmj-style')){ const st = document.createElement('style'); st.id = 'tmj-style'; st.textContent = `
.tmj-list{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.tmj-row{display:grid;grid-template-columns:28px 1fr auto;gap:12px;align-items:center;background:#fff;border:1px solid #e6e3f0;border-radius:12px;padding:12px 14px}
.tmj-row.tmj-branch{margin-left:34px;border-style:dashed;background:#F6FCFE}
.tmj-row.tmj-off{opacity:.55}
.tmj-num{width:28px;height:28px;border-radius:50%;background:#FDE7F0;color:#C81F68;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center}
.tmj-branch .tmj-num{background:#E0F5FB;color:#1A8FB0}
.tmj-row b{font-size:14px}.tmj-row small{display:block;color:#777;font-size:12px;margin-top:2px}
.tmj-tags span{display:inline-block;font-size:11px;padding:2px 7px;border-radius:999px;background:#F1EEFA;color:#4B3F86;margin:4px 4px 0 0}
.tmj-form{display:grid;grid-template-columns:1fr 260px;gap:20px;align-items:start}
.tmj-form fieldset{border:1px solid #ece9f5;border-radius:12px;padding:12px 14px 4px;margin:0 0 14px}
.tmj-form legend{font-weight:700;font-size:13px;color:#241775;padding:0 6px}
.tmj-know{list-style:none;padding:0;margin:0 0 8px;display:grid;gap:6px}
.tmj-know li{display:grid;grid-template-columns:18px 1fr 30px;gap:6px;align-items:center}
.tmj-know li .tmj-grip{cursor:grab;color:#aaa;text-align:center;user-select:none}
.tmj-know li.dragging{opacity:.5}
.tmj-prev{position:sticky;top:0;background:linear-gradient(160deg,#F3F0FC,#E9F9FD);border-radius:14px;padding:10px;text-align:center}
.tmj-prev canvas{width:240px;height:300px;cursor:grab;display:block;margin:0 auto;touch-action:none}
.tmj-prev p{font-size:12px;color:#666;margin:6px 0 0}
.tmj-prev b{display:block;font-size:14px;color:#241775;margin-top:4px}
.tmj-terms{max-height:180px;overflow:auto;border:1px solid #ece9f5;border-radius:10px;padding:6px 8px;display:flex;flex-wrap:wrap;gap:4px}
.tmj-chosen span{display:inline-block;font-size:12px;background:#241775;color:#fff;border-radius:999px;padding:3px 9px;margin:0 4px 4px 0}
.tmj-seg{display:inline-flex;border:1px solid #ddd;border-radius:999px;padding:3px;margin-bottom:14px}
.tmj-seg button{border:0;background:none;padding:7px 14px;border-radius:999px;cursor:pointer;font:inherit;font-size:13px}
.tmj-seg button.active{background:#241775;color:#fff}
.tmj-note{font-size:12.5px;color:#666;background:#F7F5FC;border-radius:10px;padding:10px 12px;margin:0 0 14px}
.tmj-thumb{display:block;max-width:100%;width:320px;aspect-ratio:1200/630;object-fit:cover;border-radius:10px;border:1px solid #eee;margin:-6px 0 12px}
.tmj-og{max-width:360px;border-radius:10px;border:1px solid #eee;display:block;margin:6px 0}
.tmj-work{display:grid;grid-template-columns:110px 1fr 2fr;gap:8px;align-items:center;margin-bottom:6px}
@media(max-width:820px){.tmj-form{grid-template-columns:1fr}.tmj-prev{position:static}}
`; document.head.appendChild(st); }

// ---------- dữ liệu ----------
async function load(){
  try {
    const [cps, st] = await Promise.all([sbGet('tm_journey_checkpoints', 'select=*&order=sort_order'), sbGet('tm_journey_settings', 'select=*&id=eq.1')]);
    S.journey = { cps, settings:st[0] || null };
  } catch (e) { S.journey = null; console.warn('[Team Map CMS] Chưa có bảng hành trình:', e.message); }
}
// thứ tự trên bản đồ: xuất phát → trạm chính, nhánh ngay sau trạm rẽ ra → đích
function ordered(){
  const cps = S.journey.cps, mains = cps.filter(c => c.kind === 'main').sort((a, b) => a.sort_order - b.sort_order), out = cps.filter(c => c.kind === 'start');
  mains.forEach(m => { out.push(m); cps.filter(c => c.kind === 'branch' && c.branch_after === m.id).forEach(b => out.push(b)); });
  return out.concat(cps.filter(c => c.kind === 'finish'));
}

// ---------- tab ----------
function render(){
  if (!S.journey) return;
  const view = S.jview || 'cps';
  X.body().innerHTML = `<div class="tmj-seg"><button class="${view === 'cps' ? 'active' : ''}" data-act="jv" data-v="cps">Checkpoint</button><button class="${view === 'set' ? 'active' : ''}" data-act="jv" data-v="set">Cài đặt trang</button></div>
    <p class="tmj-note">Trang <a href="/hanh-trinh-ui-ux" target="_blank" rel="noopener">/hanh-trinh-ui-ux</a> là game 2D đi theo nấc: tới trạm là biến hình, hiện hai bảng "Vai trò" (mô tả + kiến thức cần có) và "Khóa học" (ảnh thumbnail + nội dung khóa). Sửa ở đây là game đọc bản mới ở lần tải trang sau.</p>
    <div id="tmj-body"></div>`;
  view === 'set' ? renderSettings() : renderList();
}
function renderList(){
  let n = 0;
  const rows = ordered().map(c => { const num = c.kind === 'main' ? ++n : c.kind === 'branch' ? '↳' : c.kind === 'start' ? '🏠' : '🏢';
    const tags = [KIND[c.kind], c.sessions ? `${c.sessions} buổi` : '', c.is_milestone ? 'Mốc nghề' : '', c.require_challenge ? 'Thử thách' : '', c.kind === 'branch' && !c.is_active ? 'Đang ẩn' : '',
      (c.form_props || []).length ? '🎒 ' + c.form_props.join(', ') : ''].filter(Boolean);
    return `<li class="tmj-row${c.kind === 'branch' ? ' tmj-branch' : ''}${c.is_active === false ? ' tmj-off' : ''}"><span class="tmj-num">${num}</span>
      <div><b>${esc(c.name)}</b> → <b style="color:#C81F68">${esc(c.form_title)}</b><small>${esc(c.course_title || '—')}</small><div class="tmj-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>
      <button class="btn-edit" data-act="jcp-edit" data-id="${esc(c.id)}">Sửa</button></li>`; }).join('');
  document.getElementById('tmj-body').innerHTML = `<ul class="tmj-list">${rows}</ul><p class="tmj-note" style="margin-top:12px">Không thêm, xoá hay đổi thứ tự checkpoint: vị trí trên bản đồ cố định trong code. Trạm chính, xuất phát và đích không ẩn được.</p>`;
}

// ---------- form checkpoint ----------
function openCp(id){
  const c = S.journey.cps.find(x => x.id === id); if (!c) return;
  S.jform = { id, c, know:(c.knowledge || []).slice(), skills:(c.role_skills || []).slice(), props:new Set(c.form_props || []), terms:new Set((c.challenge_term_ids || []).map(String)), tq:'' };
  const se = c.kind === 'start' || c.kind === 'finish';
  const inp = (name, label, val, attrs = '') => `<div class="form-group"><label>${label}</label><input class="form-control" name="${name}" value="${esc(val ?? '')}" ${attrs}/></div>`;
  const ta = (name, label, val) => `<div class="form-group"><label>${label}</label><textarea class="form-control" name="${name}" rows="3">${esc(val ?? '')}</textarea></div>`;
  const ck = (name, label, val, dis) => `<label class="tm-chip"><input type="checkbox" name="${name}"${val ? ' checked' : ''}${dis ? ' disabled' : ''}/> ${label}</label>`;
  const html = `<div class="tmj-form"><div>
    <fieldset><legend>Checkpoint · ${esc(KIND[c.kind])}${c.branch_after ? ` (rẽ sau ${esc(c.branch_after)})` : ''}</legend>
      ${inp('j_name', 'Tên checkpoint *', c.name)}
      ${se ? '' : `<div class="form-row">${inp('j_course_title', 'Khóa học tương ứng', c.course_title)}${inp('j_sessions', 'Số buổi', c.sessions, 'type="number" min="1" max="200"')}</div>${inp('j_course_url', 'Link khóa học', c.course_url, 'placeholder="https://academy.telos.vn/..."')}
      ${inp('j_course_image', 'Ảnh khóa học (thumbnail trên TELOS)', c.course_image_url, 'placeholder="https://academy.telos.vn/wp-content/uploads/..."')}<img class="tmj-thumb" data-jthumb src="${esc(c.course_image_url || '')}" alt=""${c.course_image_url ? '' : ' hidden'}>`}
      ${ta('j_description', 'Mô tả nội dung', c.description)}
      ${se ? '' : `<div class="form-group"><label>Kiến thức sẽ học <small style="font-weight:400;color:#888">— mỗi dòng một ý, kéo ⋮⋮ để đổi thứ tự</small></label><ul class="tmj-know" data-jknow></ul><button class="btn-cancel" type="button" data-act="jk-add">+ Thêm dòng</button></div>`}
      ${ta('j_outcome', 'Học xong bạn sẽ', c.outcome)}
      ${c.kind === 'branch' ? `<div class="form-group">${ck('j_active', 'Hiển thị nhánh này trên bản đồ và phần chữ', c.is_active !== false)}</div>` : ''}
    </fieldset>
    <fieldset><legend>Vai trò (bảng "Vai trò" trong game)</legend>
      ${ta('j_role_summary', 'Mô tả vai trò', c.role_summary)}
      <div class="form-group"><label>Kiến thức cần có <small style="font-weight:400;color:#888">— mỗi dòng một ý, kéo ⋮⋮ để đổi thứ tự</small></label><ul class="tmj-know" data-jskills></ul><button class="btn-cancel" type="button" data-act="js-add">+ Thêm dòng</button></div>
      ${inp('j_role_link', 'Link tìm hiểu vai trò', c.role_link, 'placeholder="/thuat-ngu/uiux-designer hoặc https://..."')}
    </fieldset>
    <fieldset><legend>Biến hình</legend>
      ${inp('j_form_title', 'Nhân vật biến thành (chức danh) *', c.form_title)}
      ${ta('j_form_description', 'Câu mô tả hình thái', c.form_description)}
      <div class="form-group"><label>Đồ nghề ${c.kind === 'branch' ? '<small style="font-weight:400;color:#888">— đồ cộng thêm vào hình thái của trạm chính</small>' : ''}</label><div class="tm-chipgrid">${PROPS().map(p => `<label class="tm-chip"><input type="checkbox" data-jprop="${esc(p)}"${S.jform.props.has(p) ? ' checked' : ''}/>${esc(p)}</label>`).join('')}</div></div>
      ${se ? '' : `<div class="form-group">${ck('j_milestone', 'Mốc nghề (pháo giấy + dòng "Lên cấp")', c.is_milestone)}</div>`}
    </fieldset>
    ${se ? '' : `<fieldset><legend>Thử thách</legend>
      <div class="form-group">${ck('j_challenge', 'Bắt buộc vượt thử thách (flashcard, đúng 3/4 mới được biến hình)', c.require_challenge)}</div>
      <div class="form-group"><label>Thuật ngữ cho thử thách</label><div class="tmj-chosen" data-jchosen></div>
        <input class="form-control" data-jterm-q placeholder="Tìm thuật ngữ..." style="margin-bottom:6px"/><div class="tmj-terms" data-jterms></div></div>
    </fieldset>`}
  </div>
  <div class="tmj-prev"><canvas data-jprev width="480" height="600"></canvas><b data-jprev-title></b><p>Kéo để xoay · hình thái người chơi thấy khi tới trạm này</p></div></div>`;
  X.openModal(`Checkpoint: ${c.name}`, html, `<button class="btn-cancel" data-act="close">Huỷ</button><button class="btn-save" data-act="jcp-save">Lưu</button>`);
  renderKnow(); renderSkills(); renderTerms(); startPreview();
}
function renderKnow(){
  const ul = X.formRoot().querySelector('[data-jknow]'); if (!ul) return;
  ul.innerHTML = F().know.map((k, i) => `<li draggable="true" data-id="${i}"><span class="tmj-grip" title="Kéo để đổi thứ tự">⋮⋮</span><input class="form-control" data-jk="${i}" value="${esc(k)}"/><button class="btn-del" type="button" data-act="jk-del" data-i="${i}" title="Xoá dòng">×</button></li>`).join('')
    || '<li style="color:#999;font-size:13px">Chưa có dòng nào</li>';
  X.sortable(ul, ids => { F().know = ids.map(i => F().know[+i]); renderKnow(); });
}
function renderSkills(){
  const ul = X.formRoot().querySelector('[data-jskills]'); if (!ul) return;
  ul.innerHTML = F().skills.map((k, i) => `<li draggable="true" data-id="${i}"><span class="tmj-grip" title="Kéo để đổi thứ tự">⋮⋮</span><input class="form-control" data-jsk="${i}" value="${esc(k)}"/><button class="btn-del" type="button" data-act="js-del" data-i="${i}" title="Xoá dòng">×</button></li>`).join('')
    || '<li style="color:#999;font-size:13px">Chưa có dòng nào</li>';
  X.sortable(ul, ids => { F().skills = ids.map(i => F().skills[+i]); renderSkills(); });
}
function renderTerms(){
  const root = X.formRoot(), box = root.querySelector('[data-jterms]'); if (!box) return;
  const q = F().tq.trim().toLowerCase();
  box.innerHTML = terms().filter(t => t.is_published !== false && (!q || t.name.toLowerCase().includes(q))).slice(0, 120)
    .map(t => `<label class="tm-chip"><input type="checkbox" data-jterm="${esc(t.id)}"${F().terms.has(String(t.id)) ? ' checked' : ''}/>${esc(t.name)}</label>`).join('') || '<span style="color:#999;font-size:13px">Không tìm thấy</span>';
  root.querySelector('[data-jchosen]').innerHTML = [...F().terms].map(id => `<span>${esc(termName(id))}</span>`).join('') || '<span style="background:#eee;color:#888">Chưa chọn</span>';
}

// ---------- xem trước nhân vật 3D (module dùng chung team-map.mascot.js) ----------
let PV = null;
function previewProps(){
  const c = F().c, own = [...F().props];
  if (c.kind !== 'branch' || !window.TM_JOURNEY) return window.TM_MASCOT.resolveProps(own);
  const base = S.journey.cps.find(x => x.id === c.branch_after);   // nhánh: đồ của trạm chính rẽ ra + đồ nhánh
  return window.TM_MASCOT.resolveProps([...(base ? base.form_props || [] : []), ...own]);
}
function startPreview(){
  stopPreview();
  const cv = X.formRoot().querySelector('[data-jprev]'); if (!cv) return;
  if (!window.THREE || !window.TM_MASCOT){ cv.replaceWith(Object.assign(document.createElement('p'), { textContent:'Không tải được Three.js để xem trước.' })); return; }
  let r; try { r = new THREE.WebGLRenderer({ canvas:cv, antialias:true, alpha:true }); } catch (e) { return; }
  r.setPixelRatio(1); r.setSize(480, 600, false);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0xa79cd0, .75)); const l = new THREE.DirectionalLight(0xffffff, .6); l.position.set(3, 6, 5); sc.add(l);
  const cam = new THREE.PerspectiveCamera(30, .8, .1, 50); cam.position.set(0, 1.45, 5.4); cam.lookAt(0, 1, 0);
  const m = window.TM_MASCOT.buildMascot({ props:previewProps() }, { isPlayer:true, arrange:true }); m.ring.visible = false; m.root.rotation.y = -.4; sc.add(m.root);
  PV = { r, sc, cam, m, yaw:-.4, raf:0 };
  let drag = null;
  cv.onpointerdown = e => { drag = { x:e.clientX, y:PV.yaw }; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (drag) PV.yaw = drag.y + (e.clientX - drag.x) * .012; };
  cv.onpointerup = () => { drag = null; };
  const loop = () => { if (!PV) return; PV.m.root.rotation.y = PV.yaw; PV.r.render(PV.sc, PV.cam); PV.raf = requestAnimationFrame(loop); }; loop();
  refreshPreview();
}
function refreshPreview(){
  if (!PV) return; window.TM_MASCOT.setProps(PV.m, previewProps(), { arrange:true });
  const t = X.formRoot().querySelector('[data-jprev-title]'), c = F().c; if (t) t.textContent = (X.formRoot().querySelector('[name="j_form_title"]') || {}).value || c.form_title;
  if (F().c.id === 'pdm') window.TM_MASCOT.addHalo(PV.m);
}
function stopPreview(){ if (!PV) return; cancelAnimationFrame(PV.raf); PV.r.dispose(); PV = null; }

async function saveCp(){
  const root = X.formRoot(), fv = X.fv, c = F().c; X.clearErrs(root); let bad = false; const err = (s, m) => { bad = true; X.setErr(root, s, m); };
  const se = c.kind === 'start' || c.kind === 'finish';
  const o = { name:fv('j_name'), description:fv('j_description') || '', outcome:fv('j_outcome') || null, form_title:fv('j_form_title'), form_description:fv('j_form_description') || '',
    form_props:PROPS().filter(p => F().props.has(p)),
    role_summary:fv('j_role_summary') || null, role_skills:F().skills.map(k => k.trim()).filter(Boolean), role_link:fv('j_role_link') || null };
  if (o.role_link && !/^(\/|https?:\/\/)\S+$/i.test(o.role_link)) err('[name="j_role_link"]', 'Link bắt đầu bằng / (trang trong thư viện) hoặc https://');
  if (!o.name) err('[name="j_name"]', 'Nhập tên checkpoint');
  if (!o.form_title) err('[name="j_form_title"]', 'Nhập chức danh nhân vật biến thành');
  if (!se){
    const ses = fv('j_sessions'), url = fv('j_course_url');
    const img = fv('j_course_image');
    if (img && !URL_RE.test(img)) err('[name="j_course_image"]', 'Cần URL ảnh đầy đủ (https://...)');
    Object.assign(o, { course_image_url:img || null, course_title:fv('j_course_title') || null, course_url:url || null, sessions:ses === '' ? null : Number(ses),
      knowledge:F().know.map(k => k.trim()).filter(Boolean), is_milestone:root.querySelector('[name="j_milestone"]').checked,
      require_challenge:root.querySelector('[name="j_challenge"]').checked, challenge_term_ids:[...F().terms] });
    if (url && !URL_RE.test(url)) err('[name="j_course_url"]', 'Cần URL đầy đủ (https://...)');
    if (ses !== '' && !(Number.isInteger(o.sessions) && o.sessions >= 1 && o.sessions <= 200)) err('[name="j_sessions"]', 'Số buổi là số nguyên 1–200');
    if (o.require_challenge && !o.challenge_term_ids.length) toast('Chưa chọn thuật ngữ: thử thách sẽ lấy ngẫu nhiên từ kho thuật ngữ', false);
  }
  if (c.kind === 'branch') o.is_active = root.querySelector('[name="j_active"]').checked;
  if (bad) return;
  try {
    const [row] = await sbUpdate('tm_journey_checkpoints', c.id, o);
    Object.assign(c, row || o); X.closeModal(); render(); toast('Đã lưu checkpoint');
  } catch (e) { toast('Lỗi: ' + e.message, true); }
}

// ---------- cài đặt trang ----------
function renderSettings(){
  const s = S.journey.settings || { seo_title:'', seo_description:'', intro_text:'', og_image_url:null, workplaces:[] };
  S.jset = { og:s.og_image_url || '', work:(s.workplaces || []).map(w => Object.assign({}, w)) };
  const embed = `<iframe src="https://uiux-library.nhanluu.com/hanh-trinh-ui-ux?embed=1" width="100%" height="900" style="border:0" loading="lazy" title="Hành trình UI/UX"></iframe>`;
  document.getElementById('tmj-body').innerHTML = `<div style="max-width:760px">
    <div class="form-group"><label>Tiêu đề trang (title) <small data-jcount="seo_title"></small></label><input class="form-control" name="js_title" value="${esc(s.seo_title)}" data-jlen="70"/></div>
    <div class="form-group"><label>Mô tả (meta description) <small data-jcount="seo_desc"></small></label><textarea class="form-control" name="js_desc" rows="3" data-jlen="160">${esc(s.seo_description)}</textarea></div>
    <div class="form-group"><label>Ảnh chia sẻ (1200 × 630, PNG/JPEG/WebP, tối đa 2 MB)</label>
      ${S.jset.og ? `<img class="tmj-og" src="${esc(S.jset.og)}" alt="">` : '<p style="font-size:13px;color:#888;margin:4px 0">Chưa có, đang dùng ảnh chung của thư viện.</p>'}
      <input type="file" accept="image/png,image/jpeg,image/webp" data-act="js-og"/> <span data-jogstate style="font-size:12px;color:#666"></span></div>
    <div class="form-group"><label>Ba thẻ "Chọn nơi làm việc đầu tiên"</label>
      ${S.jset.work.map((w, i) => `<div class="tmj-work"><code>${esc(w.scale)}</code><input class="form-control" data-jw="${i}" data-k="label" value="${esc(w.label)}" placeholder="Nhãn"/><input class="form-control" data-jw="${i}" data-k="note" value="${esc(w.note || '')}" placeholder="Ghi chú"/></div>`).join('')}
      <small style="color:#888">Quy mô (small, large, agency) cố định. Người đã đi nhánh Web thấy nhãn "Hợp với bạn" ở thẻ Agency.</small></div>
    <div class="form-group"><button class="btn-save" data-act="js-save">Lưu cài đặt</button></div>
    <div class="form-group"><label>Nhúng vào trang khác (vd. academy.telos.vn)</label><textarea class="form-control" rows="2" readonly data-jembed>${esc(embed)}</textarea>
      <button class="btn-cancel" type="button" data-act="js-copy" style="margin-top:6px">Copy mã nhúng</button></div></div>`;
  counters();
}
function counters(){ document.querySelectorAll('[data-jlen]').forEach(el => { const k = el.name === 'js_title' ? 'seo_title' : 'seo_desc', max = +el.dataset.jlen, n = el.value.length;
  const c = document.querySelector(`[data-jcount="${k}"]`); if (c){ c.textContent = `${n}/${max} ký tự`; c.style.color = n > max ? '#C81F68' : '#888'; } }); }
async function uploadOg(input){
  const file = input.files && input.files[0], state = document.querySelector('[data-jogstate]'); if (!file) return;
  if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)){ toast('Chỉ nhận PNG, WebP hoặc JPEG', true); input.value = ''; return; }
  if (file.size > 2 * 1048576){ toast('Ảnh tối đa 2 MB', true); input.value = ''; return; }
  const dims = await new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([0, 0]); im.src = URL.createObjectURL(file); });
  if (!dims[0]) return toast('Không đọc được ảnh', true);
  if (Math.abs(dims[0] / dims[1] - 1200 / 630) > .06) toast(`Ảnh ${dims[0]}×${dims[1]} không đúng tỉ lệ 1200 × 630, Facebook/Zalo có thể cắt bớt`, false);
  const ext = { 'image/png':'png', 'image/webp':'webp', 'image/jpeg':'jpg' }[file.type], path = `journey/og-${Date.now().toString(36)}.${ext}`;
  state.textContent = 'Đang tải lên...';
  try {
    const r = await fetch(`${SB_CONFIG.url}/storage/v1/object/tm-badges/${path}`, { method:'POST',
      headers:{ ...SB_CONFIG.headers(await accessToken()), 'Content-Type':file.type, 'x-upsert':'true', 'cache-control':'31536000' }, body:file });
    if (!r.ok){ const t = await r.text(); throw new Error(t.slice(0, 200)); }
    S.jset.og = `${SB_CONFIG.url}/storage/v1/object/public/tm-badges/${path}`;
    state.textContent = 'Đã tải lên, bấm "Lưu cài đặt" để áp dụng'; toast('Đã tải ảnh lên');
  } catch (e) { state.textContent = 'Lỗi tải lên'; toast('Lỗi tải ảnh: ' + e.message + ' (kiểm tra bucket tm-badges trong Supabase Storage)', true); }
}
async function saveSettings(){
  const v = n => (document.querySelector(`[name="${n}"]`) || {}).value || '';
  const o = { seo_title:v('js_title').trim(), seo_description:v('js_desc').trim(), og_image_url:S.jset.og || null,
    workplaces:S.jset.work.map(w => Object.assign({}, w, { label:(w.label || '').trim() || w.scale, note:(w.note || '').trim() })) };
  if (!o.seo_title) return toast('Nhập tiêu đề trang', true);
  try {
    let row;
    if (S.journey.settings) [row] = await sbUpdate('tm_journey_settings', 1, o);
    else [row] = await sbInsert('tm_journey_settings', Object.assign({ id:1 }, o));
    S.journey.settings = row || Object.assign({ id:1 }, o); toast('Đã lưu cài đặt trang'); renderSettings();
  } catch (e) { toast('Lỗi: ' + e.message, true); }
}

// ---------- Excel: sheet "Hanh trinh" (chỉ cập nhật 10 id có sẵn) ----------
const joinKnow = a => (a || []).join('\n');
const splitKnow = v => String(v || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
function sheets(){
  if (!S.journey) return [];
  const { YES, NO, joinList, splitList } = X;
  return [{ name:'Hanh trinh', key:'journey', title:'Hành trình', required:['id'],
    cols:[['id','id',10],['_kind','Loại',11],['_sort','Thứ tự',8],['name','Tên checkpoint',26],['course_title','Tên khóa học',36],['course_url','Link khóa học',44],['sessions','Số buổi',9],
      ['form_title','Nhân vật biến thành',24],['form_description','Mô tả hình thái',44,{ wrap:1 }],['form_props','Đồ nghề',26],['is_milestone','Mốc nghề',10,{ list:[YES, NO] }],
      ['description','Mô tả',60,{ wrap:1 }],['knowledge','Kiến thức (mỗi dòng một ý)',70,{ wrap:1 }],['outcome','Học xong bạn sẽ',50,{ wrap:1 }],
      ['course_image_url','Ảnh khóa học',44],['role_summary','Mô tả vai trò',50,{ wrap:1 }],['role_skills','Kiến thức cần có (mỗi dòng một ý)',60,{ wrap:1 }],['role_link','Link vai trò',30],
      ['require_challenge','Bắt buộc thử thách',12,{ list:[YES, NO] }],['challenge_term_ids','Thuật ngữ thử thách (id)',40,{ wrap:1 }],['is_active','Hiển thị',10,{ list:[YES, NO] }]],
    rows:() => ordered(), cur:() => S.journey.cps,
    toCells:c => ({ id:c.id, _kind:KIND[c.kind] || c.kind, _sort:c.sort_order, name:c.name, course_title:c.course_title || '', course_url:c.course_url || '', sessions:c.sessions ?? '',
      form_title:c.form_title, form_description:c.form_description || '', form_props:joinList(c.form_props), is_milestone:c.is_milestone ? YES : NO, description:c.description || '',
      knowledge:joinKnow(c.knowledge), outcome:c.outcome || '', course_image_url:c.course_image_url || '', role_summary:c.role_summary || '', role_skills:joinKnow(c.role_skills), role_link:c.role_link || '', require_challenge:c.require_challenge ? YES : NO, challenge_term_ids:joinList(c.challenge_term_ids), is_active:c.is_active === false ? NO : YES }),
    fromCells:(v, has) => { const o = { id:v.id };
      ['name','course_title','course_url','form_title','outcome','course_image_url','role_summary','role_link'].forEach(k => { if (has(k)) o[k] = v[k] || null; });
      if (has('role_skills')) o.role_skills = splitKnow(v.role_skills);
      ['form_description','description'].forEach(k => { if (has(k)) o[k] = v[k] || ''; });
      if (has('sessions')) o.sessions = v.sessions === '' || v.sessions == null ? null : Number(v.sessions);
      if (has('form_props')) o.form_props = splitList(v.form_props);
      if (has('knowledge')) o.knowledge = splitKnow(v.knowledge);
      if (has('challenge_term_ids')) o.challenge_term_ids = splitList(v.challenge_term_ids);
      ['is_milestone','require_challenge'].forEach(k => { if (has(k)) o[k] = v[k] === YES; });
      if (has('is_active')) o.is_active = v.is_active !== NO;
      return o; },
    validate:(r, E) => { const o = r.o, cur = S.journey.cps.find(c => c.id === o.id);
      if (!IDS.includes(o.id) || !cur){ E('id', `Không có checkpoint "${o.id}" (chỉ cập nhật 10 checkpoint có sẵn: ${IDS.join(', ')})`); return; }
      if ('name' in o && !o.name) E('name', 'Thiếu tên checkpoint');
      if ('form_title' in o && !o.form_title) E('form_title', 'Thiếu chức danh nhân vật biến thành');
      if (o.course_url && !URL_RE.test(o.course_url)) E('course_url', 'Cần URL đầy đủ (https://...)');
      if (o.course_image_url && !URL_RE.test(o.course_image_url)) E('course_image_url', 'Cần URL ảnh đầy đủ (https://...)');
      if (o.role_link && !/^(\/|https?:\/\/)\S+$/i.test(o.role_link)) E('role_link', 'Link bắt đầu bằng / hoặc https://');
      if ('sessions' in o && o.sessions !== null && !(Number.isInteger(o.sessions) && o.sessions >= 1 && o.sessions <= 200)) E('sessions', 'Số buổi là số nguyên 1–200');
      (o.form_props || []).forEach(p => { if (!PROPS().includes(p)) E('form_props', `Đồ nghề không hợp lệ "${p}"`); });
      const ids = new Set(terms().map(t => String(t.id))); (o.challenge_term_ids || []).forEach(t => { if (!ids.has(String(t))) E('challenge_term_ids', `Không có thuật ngữ id "${t}"`); });
      if (o.is_active === false && cur.kind !== 'branch') E('is_active', 'Chỉ nhánh rẽ mới ẩn được'); },
    prepare:s => s.updated.map(r => r.o) }];
}

// ---------- sự kiện (gọi từ team-map.admin.js) ----------
function onClick(act, b){
  switch (act){
    case 'jv': S.jview = b.dataset.v; render(); return true;
    case 'jcp-edit': openCp(b.dataset.id); return true;
    case 'jcp-save': saveCp(); return true;
    case 'jk-add': F().know.push(''); renderKnow(); { const ins = X.formRoot().querySelectorAll('[data-jk]'); if (ins.length) ins[ins.length - 1].focus(); } return true;
    case 'jk-del': F().know.splice(+b.dataset.i, 1); renderKnow(); return true;
    case 'js-add': F().skills.push(''); renderSkills(); { const ins = X.formRoot().querySelectorAll('[data-jsk]'); if (ins.length) ins[ins.length - 1].focus(); } return true;
    case 'js-del': F().skills.splice(+b.dataset.i, 1); renderSkills(); return true;
    case 'js-save': saveSettings(); return true;
    case 'js-copy': { const t = document.querySelector('[data-jembed]'); t.select(); try { navigator.clipboard.writeText(t.value); } catch (e) { document.execCommand('copy'); } toast('Đã copy mã nhúng'); return true; }
  }
  return false;
}
function onInput(e){
  const t = e.target;
  if (t.dataset.jk !== undefined && F()){ F().know[+t.dataset.jk] = t.value; return true; }
  if (t.dataset.jsk !== undefined && F()){ F().skills[+t.dataset.jsk] = t.value; return true; }
  if (t.name === 'j_course_image'){ const im = X.formRoot().querySelector('[data-jthumb]'); if (im){ im.src = t.value.trim(); im.hidden = !URL_RE.test(t.value.trim()); } return true; }
  if (t.dataset.jtermQ !== undefined && F()){ F().tq = t.value; renderTerms(); return true; }
  if (t.dataset.jw !== undefined && S.jset){ S.jset.work[+t.dataset.jw][t.dataset.k] = t.value; return true; }
  if (t.dataset.jlen){ counters(); return true; }
  if (t.name === 'j_form_title'){ refreshPreview(); return true; }
  return false;
}
function onChange(e){
  const t = e.target;
  if (t.dataset.jprop && F()){ t.checked ? F().props.add(t.dataset.jprop) : F().props.delete(t.dataset.jprop); refreshPreview(); return true; }
  if (t.dataset.jterm && F()){ t.checked ? F().terms.add(String(t.dataset.jterm)) : F().terms.delete(String(t.dataset.jterm)); renderTerms(); return true; }
  if (t.dataset.act === 'js-og'){ uploadOg(t); return true; }
  return false;
}
function onClose(){ stopPreview(); S.jform = null; }

return { load, tabs:{ journey:'Hành trình' }, render:{ journey:render }, sheets, onClick, onInput, onChange, onClose };
};
