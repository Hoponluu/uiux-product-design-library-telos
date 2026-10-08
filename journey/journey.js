// Trang Hành trình UI/UX — game 2D đi theo nấc (docs/SPEC-journey.md, bản 2).
// Bấm trạm kế tiếp (có nhãn "Bấm để đi tiếp", hoặc phím →) → nhân vật bước tới và tự biến hình; nhánh rẽ (một trên, một dưới đường chính) là trạm bắt buộc.
// Không lưu tiến độ: mỗi lần mở trang là đi lại từ đầu. Bản đồ phủ cả màn hình; hai bảng Vai trò + Khóa học dàn nhiều cột, ghim ở đáy, không cuộn.
// Nhân vật dựng bằng team-map.mascot.js (chung với Team Map), hình thái tính bằng journey.form.js.
(function(){
'use strict';
const $ = s => document.querySelector(s);
const html = document.documentElement;
const BOOT = (() => { try { return JSON.parse($('#jx-data').textContent); } catch (e) { return null; } })();
if (!BOOT || !window.TM_JOURNEY) return;
const track = (name, p = {}) => { try { if (typeof window.gtag === 'function') window.gtag('event', name, p); } catch (e) {} };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EMBED = !!BOOT.embed;
const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? u : null;
const JF = window.TM_JOURNEY, M = window.TM_MASCOT || null;

// ---------- dữ liệu ----------
let CPS = BOOT.checkpoints, BY = {}, WORK = (BOOT.settings && BOOT.settings.workplaces) || [];
const COMBOS = BOOT.combos || [];
// tên nhánh cũ "Rẽ trái: … / Rẽ phải: …" → bỏ tiền tố (giống api/_lib/journey.js)
const cleanName = n => { const t = String(n == null ? '' : n).replace(/^\s*rẽ\s+(trái|phải)\s*:\s*/i, ''); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
const index = () => { BY = {}; CPS.forEach(c => { c.name = cleanName(c.name); BY[c.id] = c; }); };
index();
const mains = () => CPS.filter(c => c.kind === 'main').sort((a, b) => a.sort_order - b.sort_order);
const active = c => c && (c.kind !== 'branch' || c.is_active !== false);
const branchAfter = id => CPS.find(c => c.kind === 'branch' && c.branch_after === id && active(c));
const startCp = () => CPS.find(c => c.kind === 'start');
const finishCp = () => CPS.find(c => c.kind === 'finish');
function order(){   // xuất phát → trạm chính (nhánh ngay sau trạm rẽ ra) → đích
  const out = [startCp()]; mains().forEach(m => { out.push(m); const b = branchAfter(m.id); if (b) out.push(b); }); out.push(finishCp()); return out.filter(Boolean);
}
async function fresh(){
  const C = window.SB_CONFIG; if (!C) return false;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3000);
  try {
    const h = C.headers ? C.headers() : { apikey:C.key };
    const [a, b] = await Promise.all([fetch(`${C.url}/rest/v1/tm_journey_checkpoints?select=*&order=sort_order`, { headers:h, signal:ctl.signal }),
      fetch(`${C.url}/rest/v1/tm_journey_settings?select=workplaces&id=eq.1`, { headers:h, signal:ctl.signal })]);
    let changed = false;
    if (a.ok){ const d = await a.json(); if (Array.isArray(d) && d.length >= 8){ CPS = d; index(); changed = true; } }
    if (b.ok){ const d = await b.json(); if (d && d[0] && Array.isArray(d[0].workplaces) && d[0].workplaces.length) WORK = d[0].workplaces; }
    return changed;
  } catch (e) { return false; } finally { clearTimeout(t); }
}

// ---------- trạng thái (chỉ trong phiên này) ----------
let ST, FORM, busy = false;
function reset(){
  ST = { pos:'start', visited:['start'], view:null, challenge_passed:[] };
  FORM = JF.form(CPS, ST.visited, COMBOS);
}
reset();

// ---------- khung ----------
const board = $('#jx-board'), svg = $('#jx-track'), token = $('#jx-token'), tag = $('#jx-tag'), hint = $('#jx-hint'), live = $('#jx-live'), resetBtn = $('#jx-reset'), head = $('.jx-head');
const rolePanel = $('#jx-role'), coursePanel = $('#jx-course'), modal = $('#jx-modal'), sheet = $('#jx-sheet');
const POS = {};
let vertical = false;

// ---------- bản đồ: đặt trạm + vẽ đường ----------
function layout(){
  const W = board.clientWidth; vertical = W < 640;
  const list = order(), main = list.filter(c => c.kind !== 'branch');
  board.querySelectorAll('.jx-node').forEach(n => { n.hidden = !list.includes(BY[n.dataset.cp]); });   // nhánh đang tắt
  // nhánh rẽ xen kẽ: nhánh thứ nhất phía trên, nhánh thứ hai phía dưới đường chính… cho hai bên cân nhau
  const brs = list.filter(c => c.kind === 'branch'), mid = b => { const a = POS[b.branch_after], z = POS[main[main.indexOf(BY[b.branch_after]) + 1].id]; return [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2]; };
  if (!vertical){
    // bản đồ cao theo khung (CSS); chừa chỗ cho tiêu đề ở trên và hai bảng nổi ở dưới
    board.style.height = '';
    const H = board.clientHeight, pad = Math.max(56, W * .055);
    const pn = document.querySelector('.jx-panels'), br = board.getBoundingClientRect();
    const floating = pn && getComputedStyle(pn).position === 'absolute';   // màn rộng: hai bảng ghim đè lên đáy bản đồ
    const hb = getComputedStyle(head).position === 'absolute' ? head.getBoundingClientRect().bottom - br.top : 0;
    const top = Math.max(12, hb + 8), bottom = floating ? Math.min(H - 20, pn.getBoundingClientRect().top - br.top - 8) : H - 20;
    // chừa chỗ cho nhân vật + nhãn chức danh khi đứng ở nhánh trên, và nhãn + gợi ý "Bấm để đi tiếp" dưới nhánh dưới
    const upNeed = 17 + (token.offsetHeight || 122) + 28, downNeed = 17 + 62;
    const gap = (W - pad * 2) / (main.length - 1);   // khoảng cách hai trạm: làn rẽ không cao quá ~0.6 lần, khỏi thành gai nhọn
    // màn thấp: khung game cao thêm (trang cuộn một chút) để dải bảng không đè lên trạm
    const lack = top + upNeed + 2 * 66 + downNeed - bottom, game = board.parentNode;
    if (floating && lack > 1 && !layout.grown){ layout.grown = true; game.style.minHeight = (game.offsetHeight + lack) + 'px'; layout.grown = false; return layout(); }
    const d = Math.max(66, Math.min(120, gap * .6, (bottom - top - upNeed - downNeed) / 2));   // ≥ 66: nhãn nhánh trên vừa trong vòm
    const y = Math.max(top + upNeed + d, Math.min(bottom - downNeed - d, (top + upNeed + bottom - downNeed) / 2));
    main.forEach((c, i) => { POS[c.id] = [pad + i * (W - pad * 2) / (main.length - 1), y]; });
    brs.forEach((b, k) => { const m = mid(b); POS[b.id] = [m[0], y + (k % 2 ? d : -d)]; });
    // nhãn nhánh luôn dưới chấm (nhánh trên: nằm trong vòm, nhân vật đứng trên không che); nhánh dưới → hai trạm hai đầu đưa nhãn lên trên
    board.querySelectorAll('.jx-node').forEach(n => n.classList.remove('lbl-up'));
    const up = id => { const n = board.querySelector(`.jx-node[data-cp="${id}"]`); if (n) n.classList.add('lbl-up'); };
    brs.forEach((b, k) => { if (k % 2) { up(b.branch_after); up(main[main.indexOf(BY[b.branch_after]) + 1].id); } });
  } else {
    // mobile: nhãn nằm bên phải chấm nên cả hai nhánh đặt bên phải đường chính
    const step = 56, top = 40, x = Math.min(140, W * .36);
    board.querySelectorAll('.jx-node').forEach(n => n.classList.remove('lbl-up'));
    let i = 0; list.forEach(c => { if (c.kind === 'branch') return; POS[c.id] = [x, top + i * step]; i++; });
    brs.forEach(b => { POS[b.id] = [Math.min(W - 150, x + 110), mid(b)[1]]; });
    board.style.height = (top * 2 + (main.length - 1) * step) + 'px';
  }
  board.querySelectorAll('.jx-node').forEach(n => { const p = POS[n.dataset.cp]; if (!p) return; n.style.left = p[0] + 'px'; n.style.top = p[1] + 'px'; });
  drawTrack(); placeToken(false);
}
function drawTrack(){
  const W = board.clientWidth, H = board.clientHeight, list = order(), main = list.filter(c => c.kind !== 'branch');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pts = main.map(c => POS[c.id]); if (pts.some(p => !p)) return;
  const line = 'M' + pts.map(p => p.join(',')).join(' L');
  const doneIdx = Math.max(0, ...main.map((c, i) => ST.visited.includes(c.id) ? i : 0));   // đoạn đã đi trên đường chính
  const done = 'M' + pts.slice(0, doneIdx + 1).map(p => p.join(',')).join(' L');
  const forks = list.filter(c => c.kind === 'branch').map(b => { const a = POS[b.branch_after], m = POS[b.id], z = POS[main[main.indexOf(BY[b.branch_after]) + 1].id];
    // ngang: làn rẽ bo tròn từ trạm này sang trạm kia, đoạn giữa chạy ngang qua chấm nhánh (đủ rộng cho nhãn nhánh nằm gọn bên trong)
    const k = (z[0] - a[0]) * .13, y = a[1];
    const d = vertical ? `M${a[0]},${a[1]} Q${m[0]},${a[1]} ${m[0]},${m[1]} Q${m[0]},${z[1]} ${z[0]},${z[1]}`
      : `M${a[0]},${y} C${a[0] + k},${y} ${a[0] + k},${m[1]} ${a[0] + 2 * k},${m[1]} L${z[0] - 2 * k},${m[1]} C${z[0] - k},${m[1]} ${z[0] - k},${y} ${z[0]},${y}`;
    const cls = ST.visited.includes(b.id) ? 'done' : '';
    return `<path class="jx-fork ${cls}" d="${d}"/>`; }).join('');
  svg.innerHTML = `<path class="jx-road" d="${line}"/>${forks}${doneIdx ? `<path class="jx-road-done" d="${done}"/>` : ''}`;
}
function placeToken(animate){
  const p = POS[ST.pos]; if (!p) return;
  if (animate && !reduce){ token.classList.remove('hop'); void token.offsetWidth; token.classList.add('hop'); }
  const dot = BY[ST.pos].kind === 'branch' ? 16 : 22;
  token.style.left = p[0] + 'px'; token.style.top = (vertical ? p[1] : p[1] - dot) + 'px';
}
window.addEventListener('resize', () => { board.parentNode.style.minHeight = ''; fitPanels(); layout(); render(); });

// ---------- nhân vật (WebGL; không có thì dùng emoji) ----------
let AV = null, visible = true;
function initAvatar(){
  if (!window.THREE || !M){ html.classList.add('jx-nogl'); return; }
  const cv = $('#jx-avatar'); let r;
  try { r = new THREE.WebGLRenderer({ canvas:cv, antialias:true, alpha:true }); } catch (e) { html.classList.add('jx-nogl'); return; }
  r.setPixelRatio(1); r.setSize(220, 260, false);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0xa79cd0, .75)); const l = new THREE.DirectionalLight(0xffffff, .6); l.position.set(3, 6, 5); sc.add(l);
  const cam = new THREE.PerspectiveCamera(30, 220 / 260, .1, 50); cam.position.set(0, 1.3, 4.5); cam.lookAt(0, .95, 0);
  const m = M.buildMascot({ props:FORM.props }, { isPlayer:true, arrange:true }); m.ring.visible = false; sc.add(m.root);
  AV = { r, sc, cam, m, spin:0, t0:performance.now() };
  const loop = () => { requestAnimationFrame(loop); if (!visible || document.hidden) return; const t = (performance.now() - AV.t0) / 1000;
    if (AV.spin > 0){ AV.m.inner.rotation.y += AV.spin * .016; } else { AV.m.inner.rotation.y = Math.sin(t * .8) * .35 - .2; }
    AV.m.inner.position.y = Math.abs(Math.sin(t * 2.4)) * .03; AV.r.render(AV.sc, AV.cam); };
  loop();
}
function applyForm(pop){
  if (AV){ M.setProps(AV.m, FORM.props, { arrange:true }); if (FORM.halo) M.addHalo(AV.m); else if (AV.m.halo){ AV.m.root.remove(AV.m.halo); AV.m.halo = null; } }
  tag.textContent = FORM.title;
  if (pop && !reduce){ tag.classList.remove('pop'); void tag.offsetWidth; tag.classList.add('pop'); }
}
if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; })).observe(board);

// ---------- đi tiếp ----------
// { id } trạm kế tiếp trên đường (nhánh rẽ nằm sẵn trong thứ tự, không bỏ qua được); null khi đã tới đích
function nextTarget(){
  const list = order(), i = list.findIndex(c => c.id === ST.pos);
  return i >= 0 && list[i + 1] ? { id:list[i + 1].id } : null;
}
async function go(id){
  if (busy || !BY[id]) return; const c = BY[id];
  if (c.require_challenge && !ST.challenge_passed.includes(id)){ const ok = await challenge(id); if (!ok) return; }
  busy = true; ST.view = null; modal.hidden = true;
  ST.pos = id; placeToken(true); render(); await sleep(reduce ? 50 : 650);
  if (!ST.visited.includes(id)){
    if (c.kind === 'main' || c.kind === 'branch') await transform(c);
    else ST.visited.push(id);
  }
  busy = false; render();
  if (c.kind === 'finish') openWork();
}
function next(){ const t = nextTarget(); if (!t) return openWork(); go(t.id); }
// nhãn "Bấm để đi tiếp" dưới trạm kế tiếp (tới đích rồi thì dưới tòa văn phòng)
function placeHint(t){
  const id = t ? t.id : ST.pos === (finishCp() || {}).id ? ST.pos : null, n = id && board.querySelector(`.jx-node[data-cp="${id}"]`);
  if (!n || busy){ hint.hidden = true; return; }
  hint.textContent = t ? 'Bấm để đi tiếp' : 'Bấm để chọn nơi làm việc';
  const p = POS[id]; hint.classList.toggle('side', vertical);   // dọc (mobile): nhãn nằm bên trái chấm, khỏi đè tên trạm
  hint.style.left = (vertical ? p[0] - 26 : n.offsetLeft) + 'px';
  hint.style.top = (vertical ? p[1] : n.getBoundingClientRect().bottom - board.getBoundingClientRect().top + 6) + 'px'; hint.hidden = false;
}

// ---------- biến hình (tự động khi tới trạm) ----------
function confetti(){ const box = $('#jx-confetti'); const cols = ['#E92F7C', '#35C6E8', '#FFC53D', '#8A3FFC', '#2FBF8F'];
  for (let i = 0; i < 60; i++){ const c = document.createElement('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = cols[i % cols.length]; c.style.animationDuration = (1.4 + Math.random() * 1.4) + 's'; c.style.animationDelay = Math.random() * .4 + 's'; box.appendChild(c); }
  setTimeout(() => { box.innerHTML = ''; }, 3400); }
async function transform(c){
  ST.visited.push(c.id); FORM = JF.form(CPS, ST.visited, COMBOS);
  track('journey_transform', { cp_id:c.id, form_title:FORM.title, milestone:!!c.is_milestone });
  if (!reduce){ token.classList.remove('glow'); void token.offsetWidth; token.classList.add('glow'); if (AV){ AV.spin = 30; await sleep(900); AV.spin = 0; } else await sleep(500); }
  applyForm(true);
  if (c.is_milestone){ const bn = $('#jx-banner'); bn.textContent = `Lên cấp: ${FORM.title}`; bn.hidden = false; if (!reduce) confetti(); setTimeout(() => { bn.hidden = true; }, 2400); }
}

// ---------- hiển thị ----------
const preloaded = {};
function render(){
  const t = nextTarget();
  board.querySelectorAll('.jx-node').forEach(n => { const id = n.dataset.cp;
    n.classList.toggle('is-done', ST.visited.includes(id)); n.classList.toggle('is-here', ST.pos === id);
    n.classList.toggle('is-next', !!t && t.id === id); n.classList.toggle('is-view', ST.view === id); });
  drawTrack();
  resetBtn.hidden = ST.visited.length < 2;
  placeHint(t);
  if (!busy) live.textContent = !t ? 'Bạn đã tới tòa văn phòng. Bấm vào tòa văn phòng để chọn nơi làm việc đầu tiên.'
    : `Bạn đang ở ${BY[ST.pos].name}, hình thái ${FORM.title}. Trạm kế tiếp: ${BY[t.id].name}.`;
  // tải sẵn ảnh khóa học của trạm kế tiếp (và nhánh) để tới nơi là có ảnh ngay
  const nx = t && order()[order().findIndex(c => c.id === t.id) + 1];
  if (t) [BY[t.id], nx].forEach(c => { const u = c && safeUrl(c.course_image_url); if (u && !preloaded[u]){ preloaded[u] = new Image(); preloaded[u].src = u; } });
  panels(BY[ST.view || ST.pos]);
}
// hai bảng (cùng markup với api/_lib/journey.js): Vai trò 2 cột, Khóa học 3 cột; đang xem trạm khác thì ghi "Xem trước / Xem lại"
function panels(c){
  const skills = (c.role_skills || []).filter(Boolean), link = c.role_link && /^(\/|https?:\/\/)/.test(c.role_link) ? c.role_link : null;
  const peek = ST.view && ST.view === c.id && c.id !== ST.pos ? `<span class="jx-peek">${ST.visited.includes(c.id) ? 'Xem lại' : 'Xem trước'} · bấm trạm đang đứng để quay về</span>` : '';
  rolePanel.innerHTML = `<div class="jx-col">${peek}<p class="jx-k">${c.kind === 'start' ? 'Bạn bắt đầu là' : c.kind === 'finish' ? 'Bạn vào văn phòng là' : 'Vai trò sau trạm này'}</p>
    <h2 class="jx-role-t">${esc(c.form_title)}</h2>
    ${c.form_description ? `<p class="jx-quote">${esc(c.form_description)}</p>` : ''}
    ${c.role_summary ? `<p>${esc(c.role_summary)}</p>` : ''}
</div>
    <div class="jx-col">${skills.length ? `<h3>Kiến thức cần có</h3><ul class="jx-skills">${skills.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
    ${link ? `<a class="jx-link" href="${esc(link)}" target="_blank" rel="noopener">Tìm hiểu vai trò này →</a>` : ''}</div>`;
  if (c.kind === 'start' || c.kind === 'finish'){
    coursePanel.innerHTML = `<div class="jx-col"><p class="jx-k">${c.kind === 'start' ? 'Bắt đầu' : 'Đích'}</p><h2>${esc(c.name)}</h2></div>
    <div class="jx-col">${c.description ? `<p>${esc(c.description)}</p>` : ''}</div><div class="jx-col">${c.outcome ? `<p class="jx-out">${esc(c.outcome)}</p>` : ''}</div>`; return; }
  const url = safeUrl(c.course_url), img = safeUrl(c.course_image_url), know = (c.knowledge || []).filter(Boolean);
  coursePanel.innerHTML = `<div class="jx-col">${img ? `<a class="jx-thumb" href="${esc(url || '#')}" target="_blank" rel="noopener" data-ga="journey_course_click" data-cp="${esc(c.id)}"><img src="${esc(img)}" alt="${esc(c.course_title || c.name)}" width="1200" height="630" onload="this.parentNode.classList.add('ok')" onerror="this.parentNode.hidden=true"></a>` : ''}
    ${url ? `<a class="gx-btn" href="${esc(url)}" target="_blank" rel="noopener" data-ga="journey_course_click" data-cp="${esc(c.id)}" aria-label="Tìm hiểu thêm về ${esc(c.course_title || c.name)} tại TELOS Academy">Tìm hiểu thêm ↗</a>` : ''}</div>
    <div class="jx-col"><p class="jx-k">${c.kind === 'branch' ? 'Nhánh rẽ · ' : ''}Khóa học${c.sessions ? ` · ${esc(c.sessions)} buổi` : ''}</p>
    <h2>${esc(c.course_title || c.name)}</h2>${c.description ? `<p>${esc(c.description)}</p>` : ''}</div>
    <div class="jx-col jx-col-list">${know.length ? `<h3>Bạn sẽ học</h3><ul>${know.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}${c.outcome ? `<p class="jx-out"><b>Học xong bạn sẽ:</b> ${esc(c.outcome)}</p>` : ''}</div>`;
}
// màn rộng: dải bảng ở đáy giữ chiều cao của trạm nhiều chữ nhất, để bản đồ không nhảy khi đi từ trạm này sang trạm khác
const strip = document.querySelector('.jx-panels');
function fitPanels(){
  strip.style.minHeight = '';
  if (getComputedStyle(strip).position !== 'absolute') return;
  const v = ST.view; let max = 0;
  order().forEach(c => { ST.view = c.id; panels(c); max = Math.max(max, strip.offsetHeight); });
  ST.view = v; strip.style.minHeight = max + 'px'; panels(BY[ST.view || ST.pos]);
}

// ---------- modal ----------
function openModal(h, onKey){ sheet.innerHTML = `<button class="jx-x" type="button" aria-label="Đóng" data-act="close">×</button>${h}`; modal.hidden = false; sheet.onKey = onKey || null; const f = sheet.querySelector('button:not(.jx-x)'); if (f) f.focus(); }
function closeModal(){ modal.hidden = true; sheet.innerHTML = ''; sheet.onKey = null; if (modal._resolve){ const r = modal._resolve; modal._resolve = null; r(false); } }
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

// ---------- thử thách flashcard (đúng 3/4 mới vào được trạm) ----------
let TERMS = null;
async function loadTerms(){
  if (TERMS) return TERMS; const C = window.SB_CONFIG;
  try { const r = await fetch(`${C.url}/rest/v1/concepts?select=id,name,description,category_id&is_published=eq.true`, { headers:C.headers ? C.headers() : { apikey:C.key } }); if (r.ok) TERMS = await r.json(); } catch (e) {}
  return TERMS || [];
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function challenge(id){
  return new Promise(async resolve => {
    const c = BY[id], all = (await loadTerms()).filter(t => t.name && t.description);
    if (all.length < 4){ toast('Chưa tải được thẻ thuật ngữ, cho qua lần này.'); ST.challenge_passed.push(id); return resolve(true); }
    const want = (c.challenge_term_ids || []).map(String), deck = shuffle(all.filter(t => want.includes(String(t.id)))).slice(0, 4);
    shuffle(all.filter(t => !deck.includes(t))).forEach(t => { if (deck.length < 4) deck.push(t); });
    let i = 0, right = 0;
    const mask = (d, n) => { const s = d.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '____'); return s.length > 260 ? s.slice(0, 257) + '…' : s; };
    const show = () => {
      const t = deck[i], others = all.filter(x => x.id !== t.id && x.name !== t.name);
      const opts = shuffle([t, ...shuffle(others.filter(x => x.category_id === t.category_id)).concat(shuffle(others.filter(x => x.category_id !== t.category_id))).slice(0, 2)]);
      openModal(`<p class="jx-k">Thử thách trước trạm ${esc(c.name)} · thẻ ${i + 1}/${deck.length} · đúng ${right}</p><h2>Thuật ngữ nào có nghĩa này?</h2>
        <blockquote class="jx-def">${esc(mask(t.description, t.name))}</blockquote>
        <div class="jx-opts">${opts.map((o, k) => `<button type="button" data-id="${esc(o.id)}"><kbd>${k + 1}</kbd>${esc(o.name)}</button>`).join('')}</div>`,
        e => { if (/^[1-3]$/.test(e.key)){ const b = sheet.querySelectorAll('.jx-opts button')[+e.key - 1]; if (b && !b.disabled) b.click(); return true; } return false; });
      modal._resolve = resolve;   // đóng giữa chừng = chưa qua
      sheet.querySelectorAll('.jx-opts button').forEach(b => b.onclick = () => { const ok = String(b.dataset.id) === String(t.id); if (ok) right++;
        sheet.querySelectorAll('.jx-opts button').forEach(x => { x.disabled = true; if (String(x.dataset.id) === String(t.id)) x.classList.add('ok'); else if (x === b) x.classList.add('bad'); });
        setTimeout(() => { i++; if (i < deck.length) return show(); const pass = right >= 3; track('journey_challenge', { cp_id:id, pass, correct:right }); modal._resolve = null;
          if (pass){ ST.challenge_passed.push(id); openModal(`<p class="jx-k">Thử thách</p><h2>Qua rồi! 🎉</h2><p>Đúng ${right}/${deck.length} thẻ. Đi tiếp tới trạm ${esc(c.name)}.</p><div class="jx-row"><button class="gx-btn" type="button" data-act="ch-ok">Đi tiếp →</button></div>`);
            sheet.querySelector('[data-act="ch-ok"]').onclick = () => { modal.hidden = true; resolve(true); }; }
          else { openModal(`<p class="jx-k">Thử thách</p><h2>Chưa qua</h2><p>Đúng ${right}/${deck.length}, cần 3. Xem trước nội dung trạm rồi thử lại nhé.</p><div class="jx-row"><button class="gx-btn" type="button" data-act="ch-close">Xem nội dung trạm</button></div>`);
            sheet.querySelector('[data-act="ch-close"]').onclick = () => { modal.hidden = true; ST.view = id; render(); resolve(false); }; } }, 700); });
    };
    show();
  });
}

// ---------- đích: chọn nơi làm việc → Team Map ----------
function openWork(){
  const web = ST.visited.includes('web');
  openModal(`<p class="jx-k">Ngày đầu đi làm</p><h2>Chọn nơi làm việc đầu tiên</h2><p>Bạn bước vào với tư cách <b>${esc(FORM.title)}</b>${FORM.sub ? ` · ${esc(FORM.sub)}` : ''}. Muốn bắt đầu ở đâu?</p>
    <div class="jx-work">${WORK.map(w => `<button type="button" data-scale="${esc(w.scale)}"><b>${esc(w.label)}</b><span>${esc(w.note || '')}</span>${web && (w.suggest_if === 'web' || w.scale === 'agency') ? '<em>Hợp với bạn</em>' : ''}</button>`).join('')}</div>`);
  sheet.querySelectorAll('[data-scale]').forEach(b => b.onclick = () => goWork(b.dataset.scale));
}
async function goWork(scale){
  if (busy) return; busy = true; modal.hidden = true;
  track('journey_finish', { workplace:scale, form_id:FORM.id, branches:FORM.branches.join(',') });
  const q = new URLSearchParams({ tu:'hanh-trinh', 'quy-mo':scale, 'hinh-thai':FORM.id }); if (FORM.branches.length) q.set('nhanh', FORM.branches.join(','));
  const url = '/team-map?' + q.toString().replace(/%2C/g, ',');
  window.__jxGoUrl = url;
  const fd = $('#jx-fade'); fd.hidden = false; void fd.offsetWidth; fd.classList.add('on'); await sleep(reduce ? 200 : 900);
  if (EMBED){ window.open(url, '_blank', 'noopener'); fd.classList.remove('on'); setTimeout(() => { fd.hidden = true; }, 1000); busy = false; }
  else location.href = url;
}

let toastT = 0;
function toast(msg){ let el = $('.jx-toast'); if (!el){ el = document.createElement('div'); el.className = 'jx-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

// ---------- sự kiện ----------
document.addEventListener('click', e => {
  const n = e.target.closest('.jx-node');
  if (n){ if (busy) return; const id = n.dataset.cp, t = nextTarget();
    if (t && t.id === id) return next();                  // bấm trạm kế tiếp = đi tiếp
    if (id === ST.pos){ ST.view = null; render(); if (!t) openWork(); return; }   // trạm đang đứng: quay về (ở đích thì mở chọn nơi làm việc)
    ST.view = id; track('journey_view', { cp_id:id }); render(); return; }   // trạm khác: xem trước / xem lại nội dung
  const b = e.target.closest('[data-act]'); if (!b) return;
  switch (b.dataset.act){
    case 'work': return openWork();
    case 'close': return closeModal();
    case 'reset': if (busy) return; reset(); applyForm(false); placeToken(false); render(); track('journey_reset'); return;
  }
});
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
  if (!modal.hidden){ if (e.key === 'Escape') closeModal(); else if (sheet.onKey && sheet.onKey(e)) e.preventDefault(); return; }
  if (!visible || busy) return;
  if (e.key === 'ArrowRight'){ e.preventDefault(); next(); }
});

// ---------- khởi động ----------
initAvatar(); applyForm(false); fitPanels(); layout(); render();
fresh().then(changed => { if (changed && ST.visited.length === 1){ reset(); applyForm(false); fitPanels(); layout(); render(); } });

// cho test / debug
window.__jx = { get state(){ return ST; }, get form(){ return FORM; }, get busy(){ return busy; }, get avatar(){ return AV && { props:AV.m.props, halo:!!AV.m.halo }; },
  nextTarget, next, go, pos:id => POS[id], get vertical(){ return vertical; } };
})();
