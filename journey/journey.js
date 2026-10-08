// Trang Hành trình UI/UX — game 2D đi theo nấc (docs/SPEC-journey.md, bản 2).
// Bấm "Đi tiếp" → nhân vật bước tới trạm kế và tự biến hình; trạm có nhánh rẽ ngay sau thì hỏi Có / Không.
// Không lưu tiến độ: mỗi lần mở trang là đi lại từ đầu. Hai bảng: Vai trò (kiến thức cần có) + Khóa học (thumbnail TELOS).
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
const index = () => { BY = {}; CPS.forEach(c => { BY[c.id] = c; }); };
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
let ST, FORM, busy = false, lastBefore = {};
function reset(){
  ST = { pos:'start', visited:['start'], decided:{}, view:null, challenge_passed:[] };
  FORM = JF.form(CPS, ST.visited, COMBOS); lastBefore = {};
}
reset();

// ---------- khung ----------
const board = $('#jx-board'), svg = $('#jx-track'), token = $('#jx-token'), tag = $('#jx-tag'), bar = $('#jx-bar'), hud = $('#jx-hud');
const rolePanel = $('#jx-role'), coursePanel = $('#jx-course'), modal = $('#jx-modal'), sheet = $('#jx-sheet');
const POS = {};
let vertical = false;

// ---------- bản đồ: đặt trạm + vẽ đường ----------
function layout(){
  const W = board.clientWidth; vertical = W < 640;
  const list = order(), main = list.filter(c => c.kind !== 'branch');
  board.querySelectorAll('.jx-node').forEach(n => { n.hidden = !list.includes(BY[n.dataset.cp]); });   // nhánh đang tắt
  if (!vertical){
    const H = 272, pad = Math.max(56, W * .055), y = 182;
    board.style.height = H + 'px';
    main.forEach((c, i) => { POS[c.id] = [pad + i * (W - pad * 2) / (main.length - 1), y]; });
    list.filter(c => c.kind === 'branch').forEach(b => { const a = POS[b.branch_after], z = POS[main[main.indexOf(BY[b.branch_after]) + 1].id]; POS[b.id] = [(a[0] + z[0]) / 2, 80]; });
  } else {
    const step = 54, top = 40, x = Math.min(116, W * .3);
    let i = 0; list.forEach(c => { if (c.kind === 'branch') return; POS[c.id] = [x, top + i * step]; i++; });
    list.filter(c => c.kind === 'branch').forEach(b => { const a = POS[b.branch_after], z = POS[main[main.indexOf(BY[b.branch_after]) + 1].id]; POS[b.id] = [Math.min(W - 150, x + 110), (a[1] + z[1]) / 2]; });
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
    const d = vertical ? `M${a[0]},${a[1]} Q${m[0]},${a[1]} ${m[0]},${m[1]} Q${m[0]},${z[1]} ${z[0]},${z[1]}` : `M${a[0]},${a[1]} Q${a[0]},${m[1]} ${m[0]},${m[1]} Q${z[0]},${m[1]} ${z[0]},${z[1]}`;
    const cls = ST.visited.includes(b.id) ? 'done' : ST.decided[b.id] === false ? 'skip' : '';
    return `<path class="jx-fork ${cls}" d="${d}"/>`; }).join('');
  svg.innerHTML = `<path class="jx-road" d="${line}"/>${forks}${doneIdx ? `<path class="jx-road-done" d="${done}"/>` : ''}`;
}
function placeToken(animate){
  const p = POS[ST.pos]; if (!p) return;
  if (animate && !reduce){ token.classList.remove('hop'); void token.offsetWidth; token.classList.add('hop'); }
  const dot = BY[ST.pos].kind === 'branch' ? 16 : 22;
  token.style.left = p[0] + 'px'; token.style.top = (vertical ? p[1] : p[1] - dot) + 'px';
}
window.addEventListener('resize', () => layout());

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
// { id } để bước tới, { fork:nhánh } để hỏi Có / Không, null khi đã tới đích
function nextTarget(){
  const c = BY[ST.pos], ms = mains();
  if (!c || c.kind === 'finish') return null;
  const nextMain = afterId => { const i = ms.findIndex(m => m.id === afterId); return ms[i + 1] ? ms[i + 1].id : (finishCp() || {}).id; };
  if (c.kind === 'start') return { id:ms[0].id };
  if (c.kind === 'branch') return { id:nextMain(c.branch_after) };
  const b = branchAfter(c.id);
  if (b && ST.decided[b.id] === undefined) return { fork:b };
  return { id:nextMain(c.id) };
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
function choose(yes){
  const t = nextTarget(); if (!t || !t.fork || busy) return;
  ST.decided[t.fork.id] = !!yes; track('journey_branch', { cp_id:t.fork.id, choice:yes ? 'yes' : 'no' });
  if (yes) go(t.fork.id); else { const n = nextTarget(); if (n && n.id) go(n.id); }
}
function next(){ const t = nextTarget(); if (!t) return openWork(); if (t.fork) return; go(t.id); }

// ---------- biến hình (tự động khi tới trạm) ----------
function confetti(){ const box = $('#jx-confetti'); const cols = ['#E92F7C', '#35C6E8', '#FFC53D', '#8A3FFC', '#2FBF8F'];
  for (let i = 0; i < 60; i++){ const c = document.createElement('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = cols[i % cols.length]; c.style.animationDuration = (1.4 + Math.random() * 1.4) + 's'; c.style.animationDelay = Math.random() * .4 + 's'; box.appendChild(c); }
  setTimeout(() => { box.innerHTML = ''; }, 3400); }
async function transform(c){
  lastBefore[c.id] = FORM;
  ST.visited.push(c.id); FORM = JF.form(CPS, ST.visited, COMBOS);
  track('journey_transform', { cp_id:c.id, form_title:FORM.title, milestone:!!c.is_milestone });
  if (!reduce){ token.classList.remove('glow'); void token.offsetWidth; token.classList.add('glow'); if (AV){ AV.spin = 30; await sleep(900); AV.spin = 0; } else await sleep(500); }
  applyForm(true);
  if (c.is_milestone){ const bn = $('#jx-banner'); bn.textContent = `Lên cấp: ${FORM.title}`; bn.hidden = false; if (!reduce) confetti(); setTimeout(() => { bn.hidden = true; }, 2400); }
}

// ---------- hiển thị ----------
const preloaded = {};
const nextTargetAfterNo = b => { const ms = mains(), i = ms.findIndex(m => m.id === b.branch_after); return ms[i + 1] || finishCp(); };
function render(){
  const list = order(), t = nextTarget(), ms = mains(), mv = ms.filter(m => ST.visited.includes(m.id)).length;
  const brs = list.filter(c => c.kind === 'branch'), bv = brs.filter(b => ST.visited.includes(b.id)).length;
  board.querySelectorAll('.jx-node').forEach(n => { const id = n.dataset.cp;
    n.classList.toggle('is-done', ST.visited.includes(id)); n.classList.toggle('is-here', ST.pos === id);
    n.classList.toggle('is-next', !!t && (t.id === id || (!!t.fork && t.fork.id === id)));
    n.classList.toggle('is-skip', ST.decided[id] === false); n.classList.toggle('is-view', ST.view === id); });
  drawTrack();
  hud.innerHTML = `<span class="jx-h-k">Hình thái hiện tại</span><span class="jx-h-t">${esc(FORM.title)}</span>${FORM.sub ? `<span class="jx-h-s">${esc(FORM.sub)}</span>` : ''}
    <span class="jx-bar-p"><i style="width:${Math.round(mv / Math.max(1, ms.length) * 100)}%"></i></span><span class="jx-h-p">Đã qua ${mv}/${ms.length} trạm${brs.length ? ` · ${bv}/${brs.length} nhánh` : ''}</span>`;
  const resetBtn = ST.visited.length > 1 ? '<button class="jx-reset" type="button" data-act="reset">Đi lại từ đầu</button>' : '';
  let msg, acts;
  if (ST.view && ST.view !== ST.pos){ const v = BY[ST.view];
    msg = `Đang xem ${ST.visited.includes(v.id) ? 'lại' : 'trước'} <b>${esc(v.name)}</b>. Bạn đang ở <b>${esc(BY[ST.pos].name)}</b>.`;
    acts = `<button class="gx-btn gx-btn-ghost" type="button" data-act="back">Về trạm hiện tại</button>`; }
  else if (!t){ msg = 'Bạn đã tới tòa văn phòng. Chọn nơi làm việc đầu tiên để bắt đầu ngày đầu đi làm.'; acts = `<button class="gx-btn" type="button" data-act="work">Chọn nơi làm việc</button>`; }
  else if (t.fork){ const b = t.fork;
    msg = `Ngã rẽ: học thêm <b>${esc(b.course_title || b.name)}</b>${b.sessions ? ` (${esc(b.sessions)} buổi)` : ''} để thành <b>${esc(b.form_title)}</b>? Nhánh tuỳ chọn, đi xong quay lại đường chính.`;
    acts = `<button class="gx-btn" type="button" data-act="yes">Có, rẽ nhánh</button><button class="gx-btn gx-btn-ghost" type="button" data-act="no">Không, đi tiếp</button>`; }
  else { const n = BY[t.id];
    msg = ST.pos === 'start' ? `Bấm <b>Đi tiếp</b> để bước tới trạm đầu tiên: <b>${esc(n.name)}</b>.` : n.kind === 'finish' ? 'Qua đủ các trạm rồi. Đi tiếp tới tòa văn phòng.' : `Trạm tiếp theo: <b>${esc(n.name)}</b>${n.course_title ? ` · ${esc(n.course_title)}` : ''}.`;
    acts = `<button class="gx-btn" type="button" data-act="next">${n.kind === 'finish' ? 'Tới văn phòng →' : 'Đi tiếp →'}</button>`; }
  bar.innerHTML = `<p class="jx-msg">${msg}</p><div class="jx-acts">${acts}${resetBtn}</div>`;
  // tải sẵn ảnh khóa học của trạm kế tiếp (và nhánh) để tới nơi là có ảnh ngay
  if (t) [t.id && BY[t.id], t.fork, t.fork && BY[(nextTargetAfterNo(t.fork) || {}).id]].forEach(c => { const u = c && safeUrl(c.course_image_url); if (u && !preloaded[u]){ preloaded[u] = new Image(); preloaded[u].src = u; } });
  panels(BY[ST.view || ST.pos]);
}
function panels(c){
  const skills = (c.role_skills || []).filter(Boolean), link = c.role_link && /^(\/|https?:\/\/)/.test(c.role_link) ? c.role_link : null;
  const here = c.id === ST.pos && ST.visited.includes(c.id) && (c.kind === 'main' || c.kind === 'branch');
  rolePanel.innerHTML = `<p class="jx-k">${c.kind === 'start' ? 'Bạn bắt đầu là' : c.kind === 'finish' ? 'Bạn vào văn phòng là' : 'Vai trò sau trạm này'}</p>
    <h2 class="jx-role-t">${esc(c.form_title)}</h2>
    ${here && (FORM.title !== c.form_title || FORM.sub) ? `<span class="jx-now">Hình thái của bạn: ${esc(FORM.title)}${FORM.sub ? ' · ' + esc(FORM.sub) : ''}</span>` : ''}
    ${c.form_description ? `<p class="jx-quote">${esc(c.form_description)}</p>` : ''}
    ${c.role_summary ? `<p>${esc(c.role_summary)}</p>` : ''}
    ${skills.length ? `<h3>Kiến thức cần có</h3><ul class="jx-skills">${skills.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
    <div class="jx-row">${link ? `<a class="jx-link" href="${esc(link)}" target="_blank" rel="noopener">Tìm hiểu vai trò này →</a>` : ''}
      ${here && AV ? `<button class="gx-btn gx-btn-ghost" type="button" data-act="save">Lưu ảnh trước và sau</button>` : ''}</div>`;
  if (c.kind === 'start'){ coursePanel.innerHTML = `<p class="jx-k">Bắt đầu</p><h2>${esc(c.name)}</h2>${c.description ? `<p>${esc(c.description)}</p>` : ''}${c.outcome ? `<p class="jx-out">${esc(c.outcome)}</p>` : ''}`; return; }
  if (c.kind === 'finish'){ coursePanel.innerHTML = `<p class="jx-k">Đích</p><h2>${esc(c.name)}</h2>${c.description ? `<p>${esc(c.description)}</p>` : ''}`; return; }
  const url = safeUrl(c.course_url), img = safeUrl(c.course_image_url), know = (c.knowledge || []).filter(Boolean);
  coursePanel.innerHTML = `${img ? `<a class="jx-thumb" href="${esc(url || '#')}" target="_blank" rel="noopener" data-ga="journey_course_click" data-cp="${esc(c.id)}"><img src="${esc(img)}" alt="${esc(c.course_title || c.name)}" width="1200" height="630" onload="this.parentNode.classList.add('ok')" onerror="this.parentNode.hidden=true"></a>` : ''}
    <p class="jx-k">${c.kind === 'branch' ? 'Nhánh tuỳ chọn · ' : ''}Khóa học${c.sessions ? ` · ${esc(c.sessions)} buổi` : ''}</p>
    <h2>${esc(c.course_title || c.name)}</h2>
    ${c.description ? `<p>${esc(c.description)}</p>` : ''}
    ${know.length ? `<h3>Bạn sẽ học</h3><ul>${know.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
    ${c.outcome ? `<p class="jx-out"><b>Học xong bạn sẽ:</b> ${esc(c.outcome)}</p>` : ''}
    ${url ? `<a class="gx-btn" href="${esc(url)}" target="_blank" rel="noopener" data-ga="journey_course_click" data-cp="${esc(c.id)}">Xem khóa học tại TELOS ↗</a>` : ''}`;
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

// ---------- ảnh trước và sau (PNG 1080 × 1350) ----------
function saveImage(id){
  const c = BY[id]; if (!c || !M || !window.THREE) return;
  const i = ST.visited.indexOf(id), before = lastBefore[id] || JF.form(CPS, ST.visited.slice(0, Math.max(0, i)), COMBOS), after = JF.form(CPS, ST.visited.slice(0, i + 1), COMBOS);
  const Wd = 1080, Ht = 1350, cv = document.createElement('canvas'); cv.width = Wd; cv.height = Ht; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, Wd, Ht); gr.addColorStop(0, '#241775'); gr.addColorStop(1, '#4B33B8'); g.fillStyle = gr; g.fillRect(0, 0, Wd, Ht);
  const shot = f => { const r = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true }); r.setSize(440, 560, false); r.setPixelRatio(1);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0xa79cd0, .75)); const l = new THREE.DirectionalLight(0xffffff, .6); l.position.set(3, 6, 5); sc.add(l);
    const m = M.buildMascot({ props:f.props }, { isPlayer:true, arrange:true }); m.ring.visible = false; if (f.halo) M.addHalo(m); m.root.rotation.y = -.35; sc.add(m.root);
    const cm = new THREE.PerspectiveCamera(30, 440 / 560, .1, 50); cm.position.set(0, 1.45, 5.4); cm.lookAt(0, 1.0, 0); r.render(sc, cm);
    const out = document.createElement('canvas'); out.width = 440; out.height = 560; out.getContext('2d').drawImage(r.domElement, 0, 0); r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); return out; };
  const fit = (t, px, w, wt) => { let s = px; do { g.font = `${wt} ${s}px -apple-system, "Segoe UI", sans-serif`; s -= 2; } while (g.measureText(t).width > w && s > 14); };
  const rr = (x, y, w, h, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); };
  const card = (x, im, lab, f) => { g.fillStyle = 'rgba(255,255,255,.96)'; rr(x, 330, 460, 720, 36); g.fill(); g.drawImage(im, x + 10, 360, 440, 560);
    g.fillStyle = '#E92F7C'; g.font = '700 26px -apple-system, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText(lab, x + 230, 952);
    g.fillStyle = '#1C1033'; fit(f.title, 40, 420, '800'); g.fillText(f.title, x + 230, 1000); if (f.sub){ g.fillStyle = '#6B5FA5'; fit(f.sub, 24, 420, '600'); g.fillText(f.sub, x + 230, 1034); } };
  g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 28px -apple-system, "Segoe UI", sans-serif'; g.fillText('HÀNH TRÌNH UI/UX · TELOS ACADEMY', Wd / 2, 110);
  g.fillStyle = '#FFFFFF'; fit(`Lên đời: ${after.title}`, 62, 980, '800'); g.fillText(`Lên đời: ${after.title}`, Wd / 2, 200);
  if (c.course_title){ g.fillStyle = 'rgba(255,255,255,.82)'; fit(`Sau ${c.course_title}`, 30, 960, '500'); g.fillText(`Sau ${c.course_title}`, Wd / 2, 258); }
  card(60, shot(before), 'TRƯỚC', before); card(560, shot(after), 'SAU', after);
  g.fillStyle = '#FFC53D'; g.font = '800 64px -apple-system, "Segoe UI", sans-serif'; g.fillText('→', Wd / 2, 700);
  g.fillStyle = '#FFFFFF'; g.font = '800 44px -apple-system, "Segoe UI", sans-serif'; g.textAlign = 'left'; g.fillText('TELOS', 70, 1250);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '500 26px -apple-system, "Segoe UI", sans-serif'; g.textAlign = 'right'; g.fillText('uiux-library.nhanluu.com/hanh-trinh-ui-ux', Wd - 70, 1250);
  const a = document.createElement('a'); a.download = `hanh-trinh-${id}.png`; a.href = cv.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove();
  track('journey_save_image', { cp_id:id });
  window.__jxLastImage = { w:cv.width, h:cv.height, before:before.title, after:after.title };
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
    if (t && t.fork && t.fork.id === id) return choose(true);
    ST.view = id === ST.pos ? null : id; track('journey_view', { cp_id:id }); render(); return; }   // trạm khác: xem nội dung
  const b = e.target.closest('[data-act]'); if (!b) return;
  switch (b.dataset.act){
    case 'next': return next();
    case 'yes': return choose(true);
    case 'no': return choose(false);
    case 'back': ST.view = null; return render();
    case 'work': return openWork();
    case 'save': return saveImage(ST.pos);
    case 'close': return closeModal();
    case 'reset': if (busy) return; reset(); applyForm(false); placeToken(false); render(); track('journey_reset'); return;
  }
});
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
  if (!modal.hidden){ if (e.key === 'Escape') closeModal(); else if (sheet.onKey && sheet.onKey(e)) e.preventDefault(); return; }
  if (!visible || busy) return;
  const t = nextTarget();
  if (t && t.fork && /^[yY]$/.test(e.key)){ e.preventDefault(); choose(true); }
  else if (t && t.fork && /^[nN]$/.test(e.key)){ e.preventDefault(); choose(false); }
  else if (e.key === 'ArrowRight' && !(t && t.fork)){ e.preventDefault(); next(); }
});

// ---------- khởi động ----------
initAvatar(); applyForm(false); layout(); render();
fresh().then(changed => { if (changed && ST.visited.length === 1){ reset(); applyForm(false); layout(); render(); } });

// cho test / debug
window.__jx = { get state(){ return ST; }, get form(){ return FORM; }, get busy(){ return busy; }, get avatar(){ return AV && { props:AV.m.props, halo:!!AV.m.halo }; },
  nextTarget, next, choose, go, pos:id => POS[id], get vertical(){ return vertical; } };
})();
