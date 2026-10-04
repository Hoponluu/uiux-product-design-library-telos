// Team Map — hành động tự do + 8 mini-game + huy hiệu (SPEC-hourly, bản chơi tự do).
// Bấm vào một nhân vật: các trò chơi được với người đó hiện thành vòng quanh họ. Đọc bài, Lật flashcard luôn mở;
// mỗi lượt (30 phút) mở thêm vài trò vui, mọi người chơi thấy giống nhau.
// Engine gọi window.TM_HOURLY_GAMES(E) với E là các hàm / dữ liệu nội bộ của engine. Logic thuần nằm ở team-map.hourly.js.
window.TM_HOURLY_GAMES = function(E){
'use strict';
const H = window.TM_HOURLY, D = E.D, HD = D.HOURLY, L = E.L, $ = E.$, THREE = E.THREE;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
const cfgOf = a => Object.assign({}, DEFAULTS[a] || {}, (HD.actions[a] || {}).config || {});
const DEFAULTS = {
  read:{ options:3, retry_wait_secs:10 },
  fight:{ duration_secs:10, start_percent:50, tap_gain:2.5, npc_base:5, npc_per_rank:1.9, max_taps_per_sec:15 },
  poptask:{ ammo:10, hits_needed:3, flight_secs:.35, hit_radius:1, max_range:8, target_speed_factor:.7, pause_secs:1.2, aim_assist:2 },
  flashcard:{ cards:4, pass_correct:3, min_terms:4 },
  coffee:{ secs_per_cup:30, max_cups:3, spill_radius:.7 },
  hide:{ secs:60, countdown_secs:3 },
  race:{ speed_top:.97, speed_step:.055, npc_delay_secs:.5, false_start_penalty_secs:1 },
  gossip:{ fill_secs:8, time_limit_secs:45, hear_radius:2.2, grace_secs:.25, warn_secs:.6 }
};
const ICON = { read:'📖', fight:'🥊', poptask:'📝', flashcard:'🃏', coffee:'☕', hide:'🙈', race:'🏃', gossip:'🤫' };
// hành động bắt đầu ngay sau khi chọn người (không cần đi tới gặp)
const INSTANT = ['flashcard', 'coffee', 'hide'];

// ---------- tiến độ ----------
const ST = H.load();
const storeOk = H.save(ST);   // false: trình duyệt chặn lưu (chế độ riêng tư…) → vẫn chơi được, chỉ không lưu
const persist = () => { H.save(ST); };
const slotNow = () => H.slotAt(HD.config);
const roleName = id => (D.ROLES[id] || {}).title || id;
const titleOf = tk => H.fill(HD.actions[tk.action].title, { target:roleName(tk.who), partner:roleName(tk.partner) });
const tools = () => H.ACTIONS.filter(a => HD.actions[a] && HD.actions[a].active);
const isOpen = a => HD.config.is_enabled && H.openAt(D, slotNow()).includes(a);
const nameOf = a => (HD.actions[a] || {}).name || a;

// pending: đã chọn người, đang đi tới gặp (null nếu không) · picking: đang chọn người cho một hành động
let pending = null, picking = null;
const here = tk => tk && tk.scale === E.scaleKey;

// nhân vật trong thế giới 3D: đúng phòng theo vị trí có id nhỏ nhất
function charOf(id){
  const room = H.roomOfChar(D, E.scaleKey, id);
  return E.chars.find(c => c.role.id === id && room && c.room.id === room.id) || E.chars.find(c => c.role.id === id) || null;
}
const author = () => E.chars.find(c => c.roamer) || null;
const lounge = () => E.rooms.find(r => r.kind === 'lounge') || null;

// ---------- DOM ----------
const app = $('#app');
const el = (tag, attrs, html) => { const x = document.createElement(tag); Object.assign(x, attrs || {}); if (html != null) x.innerHTML = html; return x; };
const bfab = el('button', { id:'b-fab', className:'icon-btn b-fab', type:'button' });
const radialEl = el('div', { id:'h-radial', hidden:true });
const card = el('div', { id:'h-card', className:'card', hidden:true });
const bar = el('div', { id:'h-bar', className:'card', hidden:true });
const act = el('button', { id:'h-act', className:'h-act', type:'button', hidden:true });
const sheet = el('aside', { id:'h-sheet', className:'card', hidden:true });
const toast = el('div', { id:'h-toast', className:'card', hidden:true });
const shade = el('div', { id:'h-shade', hidden:true });
const badgesEl = el('div', { id:'badges', hidden:true });
$('.topbar').insertBefore(bfab, $('#btn-list'));
[radialEl, card, bar, act, sheet, toast, shade, badgesEl].forEach(x => app.appendChild(x));
radialEl.setAttribute('role', 'menu');

const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
let toastT = 0;
function say(text, secs = 3){ toast.textContent = text; toast.hidden = false; toastT = secs; }

// ---------- nhãn 3D (◆ trên đầu người cần gặp, • trên đầu người chọn được, bong bóng thoại, ? cảnh báo) ----------
const tags = [];
function tag(cls, getter){ const T = E.addLabel('', cls, new THREE.Vector3(), { custom:() => getter(T) }); tags.push(T); return T; }
const above = (c, h) => { const p = c.obj.root.position; return new THREE.Vector3(p.x, h, p.z); };
let bubbles = [];
function speak(c, text, secs = 2.6){
  if (!c || !text) return;
  bubbles = bubbles.filter(b => { if (b.c === c){ b.T.el.remove(); return false; } return true; });
  const b = { c, until:E.t + secs }; b.T = E.addLabel(`<div class="h-say">${esc(text)}</div>`, 'h-saylbl', new THREE.Vector3(),
    { custom:() => b.until > E.t && !c.hidden ? { show:true, pos:above(c, c.obj.root.scale.y * 2.25) } : { show:false } });
  bubbles.push(b);
}
function buildTags(){
  tags.length = 0; bubbles = []; pickTags = [];
  tag('hqm', T => { if (!pending || game) return { show:false };
    const who = targetFor(pending); if (!who || who.hidden) return { show:false };
    if (T.el.dataset.k !== '◆'){ T.el.dataset.k = '◆'; T.el.innerHTML = '<div class="qmark hq step">◆</div>'; } return { show:true, pos:above(who, 2.05) }; });
}
// người cần tới gặp để bắt đầu / tiếp tục
function targetFor(tk){
  if (game && game.marker) return game.marker();
  if (tk.action === 'hide' || tk.action === 'coffee' || tk.action === 'flashcard') return null;
  return charOf(tk.action === 'gossip' ? tk.partner : tk.who);
}
// chấm trên đầu những người chọn được (chỉ trong lúc chọn)
let pickTags = [];
function showPickTags(ids){
  clearPickTags();
  ids.forEach(id => { const c = charOf(id); if (!c) return;
    const T = E.addLabel('<div class="qmark hq pick">•</div>', 'hqm hpick', new THREE.Vector3(), { custom:() => picking && !c.hidden ? { show:true, pos:above(c, 2.0) } : { show:false } });
    T.c = c; pickTags.push(T); });
}
function clearPickTags(){ pickTags.forEach(T => { T.el.remove(); const i = E.labels.indexOf(T); if (i >= 0) E.labels.splice(i, 1); }); pickTags = []; }

// ---------- vòng sáng trên sàn (điểm lấy cà phê, đích chạy đua, tầm nghe, tầm ném) ----------
function ring(x, z, r, color, opacity = .9){
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, .05, 8, 48), new THREE.MeshBasicMaterial({ color, transparent:true, opacity }));
  m.rotation.x = -Math.PI/2; m.position.set(x, .07, z); E.world.add(m); return m;
}
const drop = m => { if (m && m.parent) m.parent.remove(m); };

// ════════════════════════════════════════════════════════
// MENU TRÒN QUANH NHÂN VẬT
// ════════════════════════════════════════════════════════
const LABEL = { talk:['Nói chuyện', 'Talk'], read:['Đọc bài', 'Read'], fight:['Đánh nhau', 'Fight'], poptask:['Ném task', 'Pop-task'], flashcard:['Lật thẻ', 'Flashcards'],
  coffee:['Mang cà phê', 'Bring coffee'], hide:['Trốn tìm', 'Hide & seek'], race:['Chạy đua', 'Race'], 'gossip-about':['Nấu xói về họ', 'Gossip about them'], 'gossip-with':['Rủ họ nấu xói', 'Gossip with them'] };
let radial = null;   // { c, all }
// các trò chơi được với một người (bỏ trò không hợp lệ; trò hợp lệ nhưng đang khoá thì vẫn hiện, có ổ khoá)
function actionsFor(c){
  if (!HD.config.is_enabled || !c || c.roamer || c.isPlayer || !c.role) return [];
  const id = c.role.id, sc = E.scaleKey, out = [];
  tools().forEach(a => {
    if (a === 'gossip'){
      if (!H.whyNot(D, sc, 'gossip', id)) out.push({ a, k:'gossip-about' });
      if (H.targets(D, sc, 'gossip').some(v => v !== id && H.partners(D, sc, v).includes(id))) out.push({ a, k:'gossip-with' });
      return; }
    if (!H.whyNot(D, sc, a, id)) out.push({ a, k:a });
  });
  out.forEach(x => { x.open = isOpen(x.a); });
  return out.filter(x => x.open).concat(out.filter(x => !x.open));   // trò đang mở trước, trò đang khoá sau
}
function openRadial(c){
  if (game) return false;
  const items = actionsFor(c); if (!items.length) return false;
  closeRadial(); closeSheet();
  if (c.ai && c.ai.s === 'pause') c.ai.t = 60;   // đứng yên trong lúc chọn
  const all = [{ k:'talk' }].concat(items), n = all.length, R = Math.round(Math.max(82, 30 + n * 11));
  const left = H.slotEnds(HD.config, slotNow()) - Date.now();
  radial = { c, all, R };
  radialEl.innerHTML = all.map((it, i) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n;
    const lab = L(LABEL[it.k][0], LABEL[it.k][1]), lock = it.open === false;
    return `<button class="h-rad${it.k === 'talk' ? ' talk' : ''}${lock ? ' locked' : ''}" type="button" role="menuitem" data-rad="${i}"
      style="--x:${Math.round(Math.cos(ang) * R)}px;--y:${Math.round(Math.sin(ang) * R)}px;--d:${i * 22}ms"
      title="${esc(it.k === 'talk' ? lab : nameOf(it.a))}${lock ? ' · ' + L('đang khoá, có thể mở ở lượt sau', 'locked, may open next round') : ''}">
      <span class="h-ico" aria-hidden="true">${it.k === 'talk' ? '💬' : lock ? '🔒' : ICON[it.a]}</span><span class="h-rl">${esc(lab)}</span><kbd>${i + 1}</kbd></button>`; }).join('')
    + (items.some(it => !it.open) ? `<div class="h-radt" style="--y:${R + 44}px">🔒 ${L('lượt mới sau', 'new round in')} <b>${fmt(left)}</b></div>` : '');
  radialEl.setAttribute('aria-label', L(`Chơi với ${c.role.title}`, `Play with ${c.role.title}`));
  radialEl.hidden = false; app.classList.add('h-radial-on'); placeRadial();
  requestAnimationFrame(() => { if (radial) radialEl.classList.add('open'); });
  radialEl.querySelectorAll('[data-rad]').forEach(b => b.onclick = e => { e.stopPropagation(); pickRadial(all[+b.dataset.rad]); });
  track('tm_radial_open', { character_id:c.role.id, actions:items.length, open:items.filter(i => i.open).length });
  return true;
}
function placeRadial(){
  if (!radial) return;
  const c = radial.c, q = c.obj.root.position, s = E.project(new THREE.Vector3(q.x, 1.0, q.z));
  const cr = E.canvas.getBoundingClientRect(), ar = app.getBoundingClientRect(), m = radial.R + 44;
  const x = Math.min(Math.max(cr.left - ar.left + s.x, m), ar.width - m), y = Math.min(Math.max(cr.top - ar.top + s.y, m), ar.height - m - 30);
  radialEl.style.transform = `translate(${x | 0}px,${y | 0}px)`;
}
function closeRadial(){
  if (!radial) return; const c = radial.c; radial = null;
  radialEl.hidden = true; radialEl.classList.remove('open'); radialEl.innerHTML = ''; app.classList.remove('h-radial-on');
  if (c.ai && c.ai.s === 'pause') c.ai.t = 2;
}
function pickRadial(it){
  if (!radial) return; const c = radial.c, id = c.role.id; closeRadial();
  if (it.k === 'talk') return E.openPanel(c);
  if (!it.open) return say(L(`${nameOf(it.a)} đang khoá. Lượt sau có thể mở.`, `${nameOf(it.a)} is locked. It may open next round.`), 3);
  if (E.mainBusy()) return say(L('Làm xong nhiệm vụ đang dở đã, rồi quay lại chơi.', 'Finish your current quest first, then come back to play.'), 3);
  track('tm_action_open', { action_id:it.a, source:it.k === 'gossip-with' ? 'radial-with' : 'radial' });
  if (it.k === 'gossip-about') return gossipAbout(id, 'radial');
  if (it.k === 'gossip-with') return startPick('gossip', 'radial', { partner:id });
  picking = { action:it.a, step:'who', source:'radial', who:id, ids:[id] }; confirmPick();
}
// chạm / bấm ra ngoài thì đóng
document.addEventListener('pointerdown', e => { if (radial && !radialEl.contains(e.target)) closeRadial(); }, true);

// ════════════════════════════════════════════════════════
// CHỌN NGƯỜI
// ════════════════════════════════════════════════════════
const stars = id => '★'.repeat(Math.min(5, Math.max(1, Math.ceil(((D.ROLES[id] || {}).rank || 2) / 1.6))));
const distTo = id => { const c = charOf(id); if (!c) return 1e9; const p = E.player.obj.root.position, q = c.obj.root.position; return Math.hypot(p.x - q.x, p.z - q.z); };
const roomName = id => (H.roomOfChar(D, E.scaleKey, id) || {}).name || '';
const PICK_TITLE = { gossip:['Nấu xói về ai?', 'Gossip about who?'] };
const PICK_HINT = { gossip:['Cấp càng cao đi tuần càng gắt.', 'Higher rank patrols harder.'] };
function startPick(a, source, opts = {}){
  closeSheet(); closeRadial(); E.closeDialog(); E.closePanel(); cancelPending(true);
  let ids = H.targets(D, E.scaleKey, a).filter(id => charOf(id));
  if (opts.partner) ids = ids.filter(v => H.partners(D, E.scaleKey, v).includes(opts.partner));
  picking = { action:a, step:'who', source, fixedPartner:opts.partner || null };
  if (!ids.length){ picking = null;
    return say(L(`Quy mô này chưa có ai để ${nameOf(a).toLowerCase()}. Thử quy mô khác nha.`, `Nobody here for ${nameOf(a).toLowerCase()} at this company size. Try another size.`), 3.5); }
  ids.sort((x, y) => distTo(x) - distTo(y));
  picking.ids = ids; showPickTags(ids); renderPick();
}
function renderPick(){
  const p = picking; if (!p) return;
  if (p.step === 'partner') return renderPartner();
  const t = PICK_TITLE[p.action], h = PICK_HINT[p.action];
  sheet.innerHTML = `<button class="close" aria-label="${L('Huỷ', 'Cancel')}">×</button><div class="sheet-body">
    <p class="eyebrow">${ICON[p.action]} ${esc(nameOf(p.action))}${p.fixedPartner ? ' · ' + L('với', 'with') + ' ' + esc(roleName(p.fixedPartner)) : ''}</p>
    <h2>${L(t[0], t[1])}</h2><p class="h-pickhint">${L(h[0], h[1])} ${L('Bấm vào người có dấu • trên bản đồ, hoặc chọn dưới đây.', 'Tap someone with a • on the map, or pick below.')}</p>
    <div class="h-picklist">${p.ids.map(id => `<button class="h-pickrow" type="button" data-pick="${esc(id)}"><b>${esc(roleName(id))}</b><span>${esc(roomName(id))}</span><em title="${L('Độ khó', 'Difficulty')}">${stars(id)}</em></button>`).join('')}</div></div>`;
  E.closeSheets('hourly'); sheet.hidden = false; sheet.classList.add('h-picking');
  sheet.querySelector('.close').onclick = cancelPick;
  sheet.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => choose(b.dataset.pick, 'list'));
}
function choose(id, how){
  const p = picking; if (!p) return;
  if (p.step === 'partner'){ p.partner = id; return confirmPick(); }
  if (!p.ids.includes(id)){
    const why = H.whyNot(D, E.scaleKey, p.action, id);
    return say(why ? L(`${roleName(id)}: ${why}.`, `${roleName(id)} can't be picked for this.`) : L(`Chọn người khác nha.`, 'Pick someone else.'), 2.6); }
  p.who = id;
  if (p.action === 'gossip' && p.fixedPartner){ p.partner = p.fixedPartner; return confirmPick(); }
  confirmPick();
}
// nấu xói về một người: người nghe chọn sẵn là người hợp lệ gần nhất, đổi được bằng chip
function gossipAbout(id, source){
  const ps = H.partners(D, E.scaleKey, id).filter(x => charOf(x)).sort((x, y) => distTo(x) - distTo(y));
  if (!ps.length) return say(L('Không có ai để nói cùng.', 'Nobody to gossip with.'), 2.5);
  cancelPending(true); picking = { action:'gossip', step:'partner', source, who:id, partners:ps, partner:ps[0] }; renderPartner();
}
// nấu xói bước 2: người nghe đã chọn sẵn (gần nhất), cho đổi bằng chip
function renderPartner(){
  const p = picking;
  sheet.innerHTML = `<button class="close" aria-label="${L('Huỷ', 'Cancel')}">×</button><div class="sheet-body">
    <p class="eyebrow">${ICON.gossip} ${esc(nameOf('gossip'))}</p>
    <h2>${L('Nấu xói', 'Gossip about')} ${esc(roleName(p.who))}</h2>
    <p class="h-pickhint">${L('Nói với', 'Tell')}: <b>${esc(roleName(p.partner))}</b> · ${esc(roomName(p.partner))}</p>
    ${p.partners.length > 1 ? `<div class="chips h-partners">${p.partners.slice(0, 4).map(id => `<button class="chip${id === p.partner ? ' pub' : ''}" type="button" data-partner="${esc(id)}">${esc(roleName(id))}</button>`).join('')}</div>` : ''}
    <div class="row"><button class="btn btn-primary" data-go="1">${L('Bắt đầu', 'Start')}</button><button class="btn btn-ghost" data-back="1">${L('Huỷ', 'Cancel')}</button></div></div>`;
  E.closeSheets('hourly'); sheet.hidden = false;
  sheet.querySelector('.close').onclick = cancelPick;
  sheet.querySelectorAll('[data-partner]').forEach(b => b.onclick = () => { p.partner = b.dataset.partner; renderPartner(); });
  sheet.querySelector('[data-go]').onclick = confirmPick;
  sheet.querySelector('[data-back]').onclick = cancelPick;
}
function confirmPick(){
  const p = picking; if (!p) return;
  const tk = { slot:slotNow(), scale:E.scaleKey, action:p.action, who:p.who, partner:p.action === 'gossip' ? p.partner : null };
  endPick(); pending = tk;
  track('tm_action_pick', { action_id:tk.action, character_id:tk.who, source:p.source });
  if (INSTANT.includes(tk.action)) return start(tk.action);
  if (tk.action === 'read'){ renderCard(); return goTo(tk); }
  renderCard(); say(objective(tk), 3.5); goTo(tk);
}
function endPick(){ picking = null; clearPickTags(); sheet.classList.remove('h-picking'); closeSheet(); }
function cancelPick(){ if (!picking) return; endPick(); }
function cancelPending(quiet){ if (!pending) return; pending = null; E.player.path = []; E.player.onArrive = null; renderCard(); if (!quiet) say(L('Đã huỷ.', 'Cancelled.'), 1.5); }

// ---------- HUD ----------
function objective(tk){
  const who = roleName(tk.who), room = (H.roomOfChar(D, tk.scale, tk.action === 'gossip' ? tk.partner : tk.who) || {}).name || '';
  switch (tk.action){
    case 'read': return L(`Tới gặp ${who} ở ${room}, bấm "Đọc bài đầy đủ" rồi "Đọc xong rồi, hỏi đi"`, `Meet ${who} in ${room}, open the article, then press "Done reading, quiz me"`);
    case 'gossip': return L(`Tới gặp ${roleName(tk.partner)} ở ${room} để bắt đầu nấu xói ${who}`, `Meet ${roleName(tk.partner)} in ${room} to start gossiping about ${who}`);
    default: return L(`Tới gặp ${who} ở ${room} để bắt đầu`, `Meet ${who} in ${room} to start`);
  }
}
function renderCard(){
  const tk = pending;
  if (!tk || game || !here(tk)){ card.hidden = true; return; }
  card.innerHTML = `<p class="eyebrow">${ICON[tk.action]} ${esc(nameOf(tk.action))}</p><h3>${esc(titleOf(tk))}</h3>
    <div class="objective">${esc(objective(tk))}</div>
    <div class="row h-row"><button class="btn btn-primary" data-h="go">${L('Tới đó', 'Go there')}</button><button class="btn btn-ghost" data-h="cancel">${L('Huỷ', 'Cancel')}</button></div>`;
  card.hidden = false;
}
card.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (!b || !pending) return;
  if (b.dataset.h === 'cancel') return cancelPending();
  if (b.dataset.h === 'go') goTo(pending); });
function goTo(tk){
  const p = E.player.obj.root.position;
  const c = targetFor(tk); if (!c) return; const q = c.obj.root.position;
  E.walkTo(E.player, q.x, q.z, () => E.talk(c), 1.3);
  if (Math.hypot(q.x - p.x, q.z - p.z) < 1.4) E.talk(c);
}
function renderBfab(){
  const n = HD.badges.filter(b => ST.badges[b.id]).length;
  bfab.innerHTML = `<span aria-hidden="true">🏅</span> <span class="hide-sm">${L('Huy hiệu', 'Badges')} </span>${n}/${HD.badges.length}`;
  bfab.setAttribute('aria-label', L(`Huy hiệu: đã mở ${n} trên ${HD.badges.length}`, `Badges: ${n} of ${HD.badges.length} unlocked`));
}
bfab.addEventListener('click', () => openBadges());

// ---------- bảng của Nhân Lưu: giới thiệu + gợi ý ----------
function authorCard(){
  if (!HD.config.is_enabled) return '';
  const tk = H.suggest(D, E.scaleKey, slotNow()), left = H.slotEnds(HD.config, slotNow()) - Date.now();
  return `<div class="h-offer"><h4>${L('Chơi gì bây giờ?', 'What to play?')}<span class="h-left">${L(`đổi lượt sau ${fmt(left)}`, `new round in ${fmt(left)}`)}</span></h4>
    <p>${L('Bấm vào một đồng nghiệp: các trò chơi được với người đó hiện quanh họ. Đọc bài và Lật thẻ lúc nào cũng mở, mấy trò còn lại đổi mỗi lượt. Thắng nhiều để mở huy hiệu.',
      'Click a coworker: the games you can play with them appear around them. Reading and Flashcards are always open, the other games change every round. Win to unlock badges.')}</p>
    ${tk ? `<b>${L('Gợi ý của ổng', 'His suggestion')}: ${esc(titleOf(tk))}</b><p>${esc(H.fill(HD.actions[tk.action].offer, { target:roleName(tk.who), partner:roleName(tk.partner) }))}</p>
    <div class="row"><button class="btn btn-primary" data-h="suggest">${L('Chơi luôn', 'Play it')}</button></div>` : ''}</div>`;
}
// trong bảng nhân vật: nút đọc bài (khi đang chọn đọc bài người này)
function panelExtra(c){
  if (game || !HD.config.is_enabled || c.roamer) return '';
  const tk = pending;
  if (tk && here(tk) && tk.action === 'read' && c.role.id === tk.who){
    const ok = readOpened.has(tk.who), wait = Math.ceil((readRetryAt - Date.now()) / 1000);
    return `<div class="h-offer h-read"><h4>${ICON.read} ${esc(nameOf('read'))}</h4>
      <p>${ok ? L('Đọc xong chưa? Người ta hỏi lại một câu đó.', 'Done reading? They will ask you one question.') : L('Bấm "Đọc bài đầy đủ" trước, đọc xong quay lại đây.', 'Open the full article first, then come back here.')}</p>
      <div class="row"><button class="btn btn-primary" data-h="quiz"${ok && wait <= 0 ? '' : ' disabled'}>${wait > 0 ? L(`Đợi ${wait} giây`, `Wait ${wait}s`) : L('Đọc xong rồi, hỏi đi', 'Done reading, quiz me')}</button></div></div>`;
  }
  return '';
}
function bindPanel(c){
  const p = $('#panel');
  p.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
    const k = b.dataset.h;
    if (k === 'suggest'){ const tk = H.suggest(D, E.scaleKey, slotNow()); if (!tk) return; E.closePanel();
      if (E.mainBusy()) return say(L('Làm xong nhiệm vụ đang dở đã.', 'Finish your current quest first.'));
      picking = { action:tk.action, step:'who', source:'author', who:tk.who, partner:tk.partner, ids:[tk.who] }; return confirmPick(); }
    if (k === 'quiz'){ E.closePanel(); return start('read'); }
  });
}
const readOpened = new Set(); let readRetryAt = 0;
// mở bài viết (tab mới trên desktop, xem trước trên mobile) = đã đọc
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href]'); const tk = pending; if (!a || !tk || tk.action !== 'read') return;
  const url = (D.ROLES[tk.who] || {}).url; if (!url) return;
  const norm = u => String(u).split('?')[0].replace(/\/$/, '');
  if (norm(a.href) === norm(url)){ readOpened.add(tk.who); setTimeout(() => { const btn = $('#panel [data-h="quiz"]'); if (btn && readRetryAt <= Date.now()){ btn.disabled = false; btn.textContent = L('Đọc xong rồi, hỏi đi', 'Done reading, quiz me'); } }, 50); }
}, true);
const track = (n, p) => E.track(n, Object.assign({ tm_slot:slotNow() }, p));

// ---------- khung mini-game ----------
let game = null;
const GAMES = {};
function flashLocked(){ say(L('Đang chơi mini-game. Bấm "Thoát" nếu muốn dừng.', 'A mini-game is running. Press "Quit" to stop.'), 2.5); }
function start(id){
  const tk = pending; if (!tk || !here(tk) || game || tk.action !== id) return;
  E.closeSheets(); E.closeDialog(); closeSheet(); cancelPick(); closeRadial();
  const target = charOf(tk.who);
  if (!target && id !== 'flashcard' && id !== 'read') return;
  game = { id, tk, target, rank:(D.ROLES[tk.who] || {}).rank || 2, cfg:cfgOf(id), t0:E.t, cleanup:[], held:new Set() };
  app.classList.add('h-playing'); card.hidden = true;
  track('tm_hourly_start', { action_id:tk.action, character_id:tk.who });
  GAMES[id].start(game);
}
// thanh HUD ở giữa phía trên + nút to (Space tương đương)
function showBar(html){ bar.innerHTML = `<div class="h-bar-in">${html}</div><button class="btn btn-ghost h-quit" type="button">${L('Thoát', 'Quit')}</button>`; bar.hidden = false;
  bar.querySelector('.h-quit').onclick = () => quit(); }
function setBar(sel, html){ const x = bar.querySelector(sel); if (x) x.innerHTML = html; }
function showAct(label, hold){ act.textContent = label; act.hidden = false; act.dataset.hold = hold ? '1' : ''; }
function quit(){ if (!game) return; finish({ win:false, fail_kind:'quit' }); }
// đưa NPC về lại trạng thái thường
function release(c){ if (!c) return; c.hidden = false; c.obj.root.scale.set(1, 1, 1); c.speed = c.roamer ? 3.2 : 3.6; c.frozenUntil = 0;
  if (c.roamer){ c.ai = { s:'idle', t:2 }; c.busy = false; return; }
  if (c.fixed || c.guest){ c.busy = false; c.path = []; c.obj.root.position.set(c.seat.x, 0, c.seat.z); c.heading = c.seat.rot; c.sitting = true; return; }
  E.goHome(c, () => { c.busy = false; }); }
function grab(c){ if (!c) return; c.busy = true; c.sitting = false; c.ai = { s:'hourly' }; c.path = []; c.onArrive = null; }
function endGame(){
  if (!game) return; const g = game; game = null;
  g.cleanup.forEach(f => { try { f(); } catch (e) {} });
  bar.hidden = true; act.hidden = true; shade.hidden = true; app.classList.remove('h-playing');
  E.player.frozenUntil = 0;
}
// kết quả: ghi tiến độ, chấm huy hiệu, Nhân Lưu khen (thắng)
function finish(r){
  if (!game) return; const g = game, tk = g.tk, a = HD.actions[tk.action];
  const ev = { action_id:tk.action, character_id:tk.who, rank:g.rank, scale:tk.scale, slot:tk.slot, win:!!r.win, flawless:!!r.flawless,
    secs: r.secs != null ? r.secs : E.t - g.t0, fail_kind: r.win ? null : (r.fail_kind || 'lose') };
  endGame();
  H.record(ST, ev);
  const got = H.evaluate(ST, D);
  pending = null;
  persist(); renderBfab();
  track('tm_hourly_result', { action_id:ev.action_id, character_id:ev.character_id, win:ev.win, flawless:ev.flawless, fail_kind:ev.fail_kind || '' });
  got.forEach(id => track('tm_badge_unlock', { badge_id:id }));
  if (r.win && got.length) praise(a.win, () => resultSheet(tk, true, got));
  else resultSheet(tk, r.win, got, r.note);
}
// mở huy hiệu: Nhân Lưu tự đi tới chỗ người chơi rồi nói câu thắng
function praise(text, then){
  const a = author(); if (!a){ then(); return; }
  a.ai = null; a.busy = true; a.path = [];
  const p = E.player.obj.root.position, [x, z] = E.nearestFree(p.x + 1.1, p.z + .4);
  let done = false;
  const arrive = () => { if (done) return; done = true; E.faceEach(a, E.player); E.setFace(a.obj, 'happy', 'mSmile'); a.faceT = 3;
    E.dialog(a, text, 'Ok', () => { a.ai = { s:'idle', t:3 }; a.busy = false; then(); }); };
  E.walkTo(a, x, z, arrive, .4);
  setTimeout(() => { if (!done){ a.path = []; a.obj.root.position.set(x, 0, z); arrive(); } }, 9000);
}
function resultSheet(tk, win, got, note){
  const a = HD.actions[tk.action], w = H.statOf(ST, tk.action).wins, open = isOpen(tk.action);
  sheet.innerHTML = `<button class="close" aria-label="${L('Đóng', 'Close')}">×</button><div class="sheet-body">
    <p class="eyebrow">${ICON[tk.action]} ${esc(nameOf(tk.action))}</p><h2>${esc(titleOf(tk))}</h2>
    <div class="chips"><span class="chip ${win ? 'pub' : 'todo'}">${win ? L('Thắng', 'Won') : L('Thua', 'Lost')}</span>${win ? `<span class="chip">${L(`Đã thắng ${w} lần`, `${w} wins so far`)}</span>` : ''}</div>
    <p class="${win ? 'h-win' : 'h-lose'}">${esc(win ? a.win : a.lose)}</p>${note ? `<p class="h-note">${esc(note)}</p>` : ''}
    ${got.length ? `<div class="h-got">${got.map(id => { const b = HD.badges.find(x => x.id === id); return `<div class="h-gotb"><canvas class="h-coin-mini" data-badge="${esc(id)}" width="160" height="160"></canvas><div><b>${L('Mở huy hiệu', 'Badge unlocked')}: ${esc(b.name)}</b><p>${esc(b.desc)}</p></div></div>`; }).join('')}</div>` : ''}
    <div class="row">${got.length ? `<button class="btn btn-primary" data-r="badges">${L('Xem huy hiệu', 'See badges')}</button>` : ''}
      ${open ? `<button class="btn ${got.length ? 'btn-ghost' : 'btn-primary'}" data-r="retry">${win ? L('Chơi tiếp', 'Play again') : L('Chơi lại', 'Try again')}</button>` : ''}
      <button class="btn btn-ghost" data-r="close">${L('Đóng', 'Close')}</button></div></div>`;
  E.closeSheets('hourly'); sheet.hidden = false;
  sheet.querySelector('.close').onclick = closeSheet;
  sheet.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    const k = b.dataset.r; closeSheet();
    if (k === 'badges') openBadges(got[0]);
    if (k === 'retry') retry(tk);
  });
  sheet.querySelectorAll('.h-coin-mini').forEach(cv => miniCoin(cv, HD.badges.find(x => x.id === cv.dataset.badge)));
}
function retry(tk){
  if (!isOpen(tk.action)) return say(L(`${nameOf(tk.action)} vừa khoá, chờ lượt sau nha.`, `${nameOf(tk.action)} just locked, wait for the next round.`), 3);
  if (tk.action === 'read'){ const w = Math.ceil((readRetryAt - Date.now()) / 1000);
    if (w > 0) return say(L(`Đợi ${w} giây nữa rồi hỏi lại nha.`, `Wait ${w} more seconds before trying again.`)); }
  pending = Object.assign({}, tk, { slot:slotNow() });
  if (tk.action === 'read' || INSTANT.includes(tk.action)) return start(tk.action);
  const c = targetFor(pending); if (c){ renderCard(); goTo(pending); say(objective(pending), 3); }
}
function closeSheet(){ sheet.hidden = true; }

// ---------- hook từ engine ----------
function onTalk(c){
  if (game) return game.onTalk ? game.onTalk(c) : true;
  if (picking){ if (!c.roamer) choose(c.role.id, 'map'); return true; }
  const tk = pending; if (!tk || !here(tk)) return false;
  if (tk.action === 'read'){ if (c.role.id !== tk.who) return false; E.openPanel(c); return true; }
  if (INSTANT.includes(tk.action)) return false;
  const starter = tk.action === 'gossip' ? tk.partner : tk.who;
  if (c.role.id !== starter || c.roamer) return false;
  start(tk.action); return true;
}
function onClick(e){
  if (game) return !!(game.onClick && game.onClick(e));
  if (picking && picking.step === 'who'){ const c = E.pick(e); if (c && !c.isPlayer && !c.roamer){ choose(c.role.id, 'map'); return true; } }
  return false;
}
function onKey(e, down){
  const k = e.key;
  if (!game){
    if (!down) return false;
    if (k === 'Escape'){ if (!badgesEl.hidden){ closeBadges(); return true; } if (radial){ closeRadial(); return true; } if (picking){ cancelPick(); return true; } return false; }
    // phím số chọn mục trong menu tròn
    if (radial && /^[1-9]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey){ const it = radial.all[+k - 1]; if (it){ pickRadial(it); return true; } }
    return false;
  }
  if (k === 'Escape'){ if (down) quit(); return true; }
  if (k === ' ' || k === 'Spacebar'){ e.preventDefault(); if (down && e.repeat) return true; game.onAct && game.onAct(down, true); return true; }
  if (game.onKey) return game.onKey(e, down);
  return false;
}
// nút to trên màn hình: chạm = Space
const actDown = e => { e.preventDefault(); if (game && game.onAct) game.onAct(true, false); };
const actUp = e => { if (game && game.onAct && act.dataset.hold) game.onAct(false, false); };
act.addEventListener('pointerdown', actDown); act.addEventListener('pointerup', actUp); act.addEventListener('pointercancel', actUp); act.addEventListener('pointerleave', actUp);

let tickAcc = 0;
function tick(dt){
  if (game && game.tick) game.tick(dt);
  if (radial){ const c = radial.c, p = E.player.obj.root.position, q = c.obj.root.position;
    if (game || c.hidden || Math.hypot(p.x - q.x, p.z - q.z) > 3.4) closeRadial(); else placeRadial(); }
  if (toastT > 0){ toastT -= dt; if (toastT <= 0) toast.hidden = true; }
  tickAcc += dt; if (tickAcc < .5) return; tickAcc = 0;
  // hết lượt: hành động đang chọn / đang đi tới bị khoá thì huỷ (trò đang chơi vẫn chơi tiếp tới hết)
  if (!game && picking && !isOpen(picking.action)){ cancelPick(); say(L('Hết lượt, hành động này vừa khoá.', 'Round over, this action just locked.'), 3); }
  if (!game && pending && !isOpen(pending.action)){ pending = null; E.player.path = []; E.player.onArrive = null; renderCard(); say(L('Hết lượt, hành động này vừa khoá.', 'Round over, this action just locked.'), 3); }
  // vị trí thẻ: ngay dưới thẻ quest chính nếu đang hiện
  const q = $('#quest'), top = !q.hidden && q.offsetParent ? q.offsetTop + q.offsetHeight + 8 : null;
  card.style.top = top != null ? top + 'px' : '';
}
function onWorld(){
  if (game){ const g = game; game = null; g.cleanup.forEach(f => { try { f(); } catch (e) {} }); bar.hidden = true; act.hidden = true; shade.hidden = true; app.classList.remove('h-playing'); }
  picking = null; pending = null; closeRadial(); sheet.classList.remove('h-picking'); if (!sheet.hidden) closeSheet();
  buildTags(); renderCard(); renderBfab();
  if (!ST.seen.radial && HD.config.is_enabled){ ST.seen.radial = 1; persist(); setTimeout(() => say(L('Mẹo: bấm vào một đồng nghiệp để xem các trò chơi được với họ.', 'Tip: click a coworker to see the games you can play with them.'), 6), 2500); }
}
// ════════════════════════════════════════════════════════
// 8 MINI-GAME
// ════════════════════════════════════════════════════════
const dist = (a, b) => { const p = a.obj.root.position, q = b.obj.root.position; return Math.hypot(p.x - q.x, p.z - q.z); };
const pos = c => c.obj.root.position;
const timerHtml = s => `<span class="h-timer">${Math.ceil(Math.max(0, s))}s</span>`;
function faceOff(g){ // đứng đối mặt nhau, người chơi trước mặt nhân vật
  const c = g.target; grab(c); g.cleanup.push(() => release(c));
  const q = pos(c), p = pos(E.player); const d = Math.hypot(p.x - q.x, p.z - q.z) || 1;
  const [x, z] = E.nearestFree(q.x + (p.x - q.x) / d * 1.1, q.z + (p.z - q.z) / d * 1.1);
  E.player.path = []; E.player.obj.root.position.set(x, 0, z); E.faceEach(E.player, c);
}

// 5.1 read — câu hỏi trắc nghiệm về bài viết
const readTries = {};
GAMES.read = { start(g){
  const tk = g.tk, all = H.quizOf(D, tk.who); if (!all.length){ endGame(); return; }
  const key = tk.slot + ':' + tk.who; readTries[key] = readTries[key] || { n:0, last:null };
  const pool = all.length > 1 ? all.filter(q => q.id !== readTries[key].last) : all, q = rnd(pool); readTries[key].last = q.id; g.q = q;
  const order = H.shuffle([0, 1, 2], Math.random);
  sheet.innerHTML = `<div class="sheet-body"><p class="eyebrow">${esc(roleName(tk.who))} ${L('hỏi', 'asks')}</p><h2>${esc(q.q)}</h2>
    <div class="h-opts">${order.map((i, k) => `<button class="btn btn-ghost h-opt" data-i="${i}"><kbd>${k + 1}</kbd> ${esc(q.options[i])}</button>`).join('')}</div></div>`;
  sheet.hidden = false;
  const answer = i => { if (!game) return; const ok = i === q.correct, first = readTries[key].n === 0; readTries[key].n++;
    sheet.hidden = true; if (!ok) readRetryAt = Date.now() + (g.cfg.retry_wait_secs || 10) * 1000;
    finish(ok ? { win:true, flawless:first } : { win:false, fail_kind:'wrong', note:L(`Đáp án đúng: ${q.options[q.correct]}`, `Correct answer: ${q.options[q.correct]}`) }); };
  sheet.querySelectorAll('.h-opt').forEach(b => b.onclick = () => answer(+b.dataset.i));
  g.onKey = (e, down) => { if (down && /^[1-3]$/.test(e.key)){ answer(order[+e.key - 1]); return true; } return false; };
  g.onTalk = () => true;
  g.cleanup.push(() => { sheet.hidden = true; });
} };

// 5.2 fight — kéo co bằng thanh lực
GAMES.fight = { start(g){
  const c = g.target, cf = g.cfg; faceOff(g);
  let v = cf.start_percent, low = v, left = cf.duration_secs, taps = [], done = false;
  speak(c, H.line(D, 'fight', 'start', g.tk.who), 2.2);
  showBar(`<div class="h-title">${L('Đánh nhau với', 'Fight')} ${esc(roleName(g.tk.who))}</div>
    <div class="h-tug"><span>${L('Bạn', 'You')}</span><div class="h-tugbar"><i style="width:${v}%"></i><b></b></div><span>${esc(roleName(g.tk.who))}</span></div>
    <div class="h-sub">${L('Bấm Space hoặc nút "Đẩy" thật nhanh', 'Press Space or the "Push" button as fast as you can')} · <span class="h-t">${timerHtml(left)}</span></div>`);
  showAct(L('Đẩy!', 'Push!'));
  const push = rate => cf.npc_base + cf.npc_per_rank * g.rank;
  const shakeP = E.player.obj.inner, shakeC = c.obj.inner;
  g.onAct = down => { if (!down || done) return; const now = performance.now(); taps = taps.filter(x => now - x < 1000);
    if (taps.length >= cf.max_taps_per_sec) return; taps.push(now); v = Math.min(100, v + cf.tap_gain);
    if (v >= 100){ done = true; shakeP.position.x = shakeC.position.x = 0; const fill = bar.querySelector('.h-tugbar i'); if (fill) fill.style.width = '100%';
      finish({ win:true, flawless:low >= 50 }); } };
  g.tick = dt => { if (done) return;
    left -= dt; v = Math.max(0, v - push() * dt); low = Math.min(low, v);
    const j = reduceMotion ? 0 : .03; shakeP.position.x = (Math.random() - .5) * j; shakeC.position.x = (Math.random() - .5) * j;
    E.setFace(E.player.obj, 'look', 'mO'); E.setFace(c.obj, v > 50 ? 'side' : 'look', 'mFlat');
    const fill = bar.querySelector('.h-tugbar i'); if (fill) fill.style.width = v + '%'; setBar('.h-t', timerHtml(left));
    if (Math.random() < dt * 6) dust(pos(E.player), pos(c));
    if (v >= 100 || v <= 0 || left <= 0){ done = true; shakeP.position.x = shakeC.position.x = 0;
      const win = v >= 100 || (v > 0 && left <= 0 && v > 50); finish({ win, flawless:win && low >= 50, fail_kind:'lose' }); } };
  g.onTalk = () => true;
} };
function dust(a, b){ // bụi bay giữa hai người
  const m = E.ball(.08 + Math.random() * .06, '#E9E2F5'); m.position.set((a.x + b.x) / 2 + (Math.random() - .5) * .6, .15, (a.z + b.z) / 2 + (Math.random() - .5) * .6);
  E.world.add(m); let life = .6; const id = setInterval(() => { life -= .05; m.position.y += .02; m.scale.multiplyScalar(1.04); if (life <= 0){ clearInterval(id); drop(m); } }, 50);
}

// 5.3 poptask — ném pop-task vào nhân vật đang đi lại trong phòng.
// Cho dễ trúng: nhắm gần nhân vật (trong aim_assist m) hoặc bấm Space / nút thì tự nhắm đón đầu theo hướng đi;
// tờ giấy trúng khi bay ngang qua người (nửa sau đường bay), không cần rơi đúng chỗ; nhân vật đi chậm và đứng lại giữa các lần đi.
GAMES.poptask = { start(g){
  const c = g.target, cf = g.cfg; grab(c);
  const rangeRing = ring(0, 0, cf.max_range, '#FFC53D', .35), aimRing = ring(0, 0, .55, '#2FBF8F', .8);
  g.cleanup.push(() => { release(c); stuck.forEach(drop); flying.forEach(f => drop(f.m)); drop(rangeRing); drop(aimRing); });
  c.speed = 3.6 * cf.target_speed_factor * (1 + .04 * (g.rank - 1));
  const pause = () => Math.max(.4, cf.pause_secs * (1.25 - .08 * g.rank)) * (.7 + Math.random() * .6);
  let ammo = cf.ammo, hits = 0, misses = 0, done = false, vel = { x:0, z:0 }, last = null; const flying = [], stuck = [];
  // đi tới một điểm trong phòng, ưu tiên điểm còn trong tầm ném của người chơi
  const wander = () => { if (!game || done) return; const r = c.room, m = pos(E.player); let pt = null;
    for (let k = 0; k < 8 && !pt; k++){ const x = r.x + (Math.random() - .5) * (r.w - 2.4), z = r.z + (Math.random() - .5) * (r.d - 2.4);
      if (Math.hypot(x - m.x, z - m.z) < cf.max_range * .8 || k === 7) pt = [x, z]; }
    const [x, z] = E.nearestFree(pt[0], pt[1]); E.walkTo(c, x, z, () => setTimeout(wander, pause() * 1000)); };
  setTimeout(wander, 1200);
  const hud = () => showBar(`<div class="h-title">${L('Ném trúng', 'Hit')} ${esc(roleName(g.tk.who))}</div>
    <div class="h-sub">${E.isMobile() ? L('Chạm nút "Ném" là tự nhắm · đứng trong vòng vàng', 'Tap "Throw" to auto-aim · stay within the yellow circle')
      : L('Space / nút "Ném" là tự nhắm · hoặc bấm vào người · WASD để đi, đứng trong vòng vàng', 'Space / "Throw" auto-aims · or click on them · WASD to move, stay within the yellow circle')}</div>
    <div class="h-count">${L('Trúng', 'Hits')} <b>${hits}/${cf.hits_needed}</b> · ${L('Còn', 'Left')} <b>${ammo}</b> ${L('tờ', 'tasks')}</div>`);
  hud(); showAct(L('Ném', 'Throw'));
  const inRange = () => { const p = pos(E.player), q = pos(c); return Math.hypot(q.x - p.x, q.z - p.z) <= cf.max_range; };
  // điểm đón đầu: vị trí sau thời gian bay, theo vận tốc hiện tại
  const lead = () => { const q = pos(c); return { x:q.x + vel.x * cf.flight_secs, z:q.z + vel.z * cf.flight_secs }; };
  const throwTo = (tx, tz) => { if (done || ammo <= 0) return; const p = pos(E.player); let dx = tx - p.x, dz = tz - p.z; const d = Math.hypot(dx, dz) || 1;
    if (d > cf.max_range){ dx *= cf.max_range / d; dz *= cf.max_range / d; }
    ammo--; const m = E.box(.26, .02, .2, '#FFF6A8'); m.position.set(p.x, 1, p.z); E.world.add(m);
    E.player.heading = Math.atan2(dx, dz);
    flying.push({ m, x0:p.x, z0:p.z, x1:p.x + dx, z1:p.z + dz, t:0 }); hud(); };
  const autoThrow = () => { if (!inRange()){ say(L('Xa quá, lại gần chút (vào trong vòng vàng).', 'Too far, get closer (inside the yellow circle).'), 2); return; } const t = lead(); throwTo(t.x, t.z); };
  g.onClick = e => { const o = E.pick(e); if (o === c) { autoThrow(); return true; }
    const q = E.groundPoint(e); if (!q) return true; const cq = pos(c);
    if (Math.hypot(q.x - cq.x, q.z - cq.z) <= cf.aim_assist) autoThrow(); else throwTo(q.x, q.z); return true; };
  g.onAct = down => { if (down) autoThrow(); };
  const hit = f => { hits++; drop(f.m);
    const s = E.box(.24, .2, .02, '#FFF6A8'); s.position.set((Math.random() - .5) * .3, .75 + Math.random() * .4, .36); s.rotation.z = (Math.random() - .5) * .6; c.obj.root.add(s); stuck.push(s);
    speak(c, H.line(D, 'poptask', 'react', g.tk.who), 2.4); say(`📝 ${H.line(D, 'poptask', 'task', g.tk.who)}`, 2.4);
    E.setFace(c.obj, 'look', 'mO'); c.faceT = 1.5;
    // trúng thì đứng khựng lại một chút
    c.path = []; c.onArrive = null; c.frozenUntil = E.t + .8; setTimeout(wander, 1000); };
  g.tick = dt => {
    const q = pos(c), p = pos(E.player);
    if (last && dt > 0){ const k = Math.min(1, dt * 8); vel.x += ((q.x - last.x) / dt - vel.x) * k; vel.z += ((q.z - last.z) / dt - vel.z) * k; }
    last = { x:q.x, z:q.z };
    rangeRing.position.set(p.x, .07, p.z); aimRing.position.set(q.x, .07, q.z); aimRing.material.color.set(inRange() ? '#2FBF8F' : '#9A93B5');
    for (let i = flying.length - 1; i >= 0; i--){ const f = flying[i]; f.t += dt / cf.flight_secs; const k = Math.min(1, f.t);
      const x = f.x0 + (f.x1 - f.x0) * k, z = f.z0 + (f.z1 - f.z0) * k;
      f.m.position.set(x, 1 + Math.sin(k * Math.PI) * 1.2 - k * .95, z); f.m.rotation.y += dt * 12;
      if (k >= .45 && Math.hypot(q.x - x, q.z - z) <= cf.hit_radius){ flying.splice(i, 1); hit(f); hud(); }
      else if (k >= 1){ flying.splice(i, 1); misses++; const m = f.m; setTimeout(() => drop(m), 1500); hud();
        if (misses === 1 && !hits) say(L('Hụt rồi! Bấm Space hoặc nút "Ném" để tự nhắm đón đầu.', 'Missed! Press Space or "Throw" to auto-aim ahead of them.'), 3); }
      else continue;
      if (hits >= cf.hits_needed){ done = true; return finish({ win:true, flawless:misses === 0 }); }
      if (ammo <= 0 && !flying.length){ done = true; return finish({ win:false, fail_kind:'out_of_ammo' }); }
    }
  };
  g.onTalk = () => true;
} };

// 5.4 flashcard — xem định nghĩa, chọn đúng thuật ngữ (bản rút gọn trong game)
GAMES.flashcard = { start(g){
  const tk = g.tk, cf = g.cfg, T = HD.terms, mine = H.termsOf(D, tk.who).map(id => T[id]);
  const deck = H.shuffle(mine, Math.random).slice(0, Math.min(cf.cards, mine.length));
  const need = Math.min(cf.pass_correct, deck.length);
  let i = 0, right = 0;
  const mask = (desc, name) => { const s = (desc || '').replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '____'); return s.length > 260 ? s.slice(0, 257) + '…' : s; };
  const show = () => {
    const t = deck[i]; g.cur = t.id; const others = Object.values(T).filter(x => x.id !== t.id && x.name !== t.name);
    const same = H.shuffle(others.filter(x => x.cat === t.cat), Math.random), rest = H.shuffle(others.filter(x => x.cat !== t.cat), Math.random);
    const opts = H.shuffle([t, ...same.concat(rest).slice(0, 2)], Math.random);
    sheet.innerHTML = `<div class="sheet-body"><p class="eyebrow">${L('Flashcard', 'Flashcard')} ${i + 1}/${deck.length} · ${L('đúng', 'correct')} ${right}</p>
      <h2>${L('Thuật ngữ nào có nghĩa này?', 'Which term means this?')}</h2><blockquote class="h-def">${esc(mask(t.desc, t.name) || L('(Chưa có mô tả) Gợi ý: ', '(No description) Hint: ') + t.name.slice(0, 2) + '…')}</blockquote>
      <div class="h-opts">${opts.map((o, k) => `<button class="btn btn-ghost h-opt" data-id="${esc(o.id)}"><kbd>${k + 1}</kbd> ${esc(o.name)}</button>`).join('')}</div></div>`;
    sheet.hidden = false;
    const pickIt = id => { if (!game) return; const ok = id === t.id; if (ok) right++;
      sheet.querySelectorAll('.h-opt').forEach(b => { b.disabled = true; if (b.dataset.id === t.id) b.classList.add('ok'); else if (b.dataset.id === id) b.classList.add('bad'); });
      setTimeout(() => { if (!game) return; i++; if (i < deck.length) show();
        else finish(right >= need ? { win:true, flawless:right === deck.length } : { win:false, fail_kind:'lose', note:L(`Đúng ${right}/${deck.length}, cần ${need}.`, `${right}/${deck.length} correct, ${need} needed.`) }); }, 700); };
    sheet.querySelectorAll('.h-opt').forEach(b => b.onclick = () => pickIt(b.dataset.id));
    g.onKey = (e, down) => { if (down && /^[1-3]$/.test(e.key)){ const b = sheet.querySelectorAll('.h-opt')[+e.key - 1]; if (b && !b.disabled) pickIt(b.dataset.id); return true; } return false; };
  };
  show(); g.onTalk = () => true; g.cleanup.push(() => { sheet.hidden = true; });
} };

// 5.5 coffee — lấy ly ở Pantry, mang tới không đụng ai
function cupSpot(){ const r = lounge(); return E.nearestFree(r.x - 2.4, r.z - 1.6); }
GAMES.coffee = { start(g){
  const c = g.target, cf = g.cfg, [sx, sz] = cupSpot(), mark = ring(sx, sz, .55, '#E92F7C');
  let cups = 0, holding = false, left = 0, stand = 0, spills = 0, done = false, cup = null;
  g.cleanup.push(() => { drop(mark); drop(cup); });
  const hud = () => showBar(`<div class="h-title">${L('Mang cà phê cho', 'Coffee for')} ${esc(roleName(g.tk.who))}</div>
    <div class="h-sub">${holding ? L('Đi vòng tránh mọi người, tới gặp người nhận', 'Walk around people and reach them') : L('Đứng vào vòng tròn hồng ở Pantry để lấy ly', 'Stand in the pink circle in the Pantry to grab a cup')}${holding ? ' · <span class="h-t">' + timerHtml(left) + '</span>' : ''}</div>
    <div class="h-count">${L('Ly', 'Cup')} <b>${Math.min(cups + (holding ? 0 : 1), cf.max_cups)}/${cf.max_cups}</b></div>`);
  hud();
  g.marker = () => holding ? c : null;
  const lose = why => { holding = false; drop(cup); cup = null; if (cups >= cf.max_cups){ done = true; finish({ win:false, fail_kind:why }); } else hud(); };
  g.tick = dt => { if (done) return;
    const p = pos(E.player);
    if (!holding){ if (cups >= cf.max_cups) return;
      if (Math.hypot(p.x - sx, p.z - sz) < .8){ stand += dt; if (stand >= 1){ stand = 0; holding = true; cups++; left = cf.secs_per_cup;
        cup = E.cyl(.07, .06, .16, '#FFFFFF', 12); cup.position.set(.32, .95, .25); E.player.obj.root.add(cup); hud(); } } else stand = 0;
      return; }
    left -= dt; setBar('.h-t', timerHtml(left));
    const hit = E.chars.find(o => o !== E.player && o !== c && !o.hidden && dist(o, E.player) < cf.spill_radius);
    if (hit){ spills++; speak(hit, H.line(D, 'coffee', 'spill', hit.role.id), 2.4); E.setFace(hit.obj, 'look', 'mO'); hit.faceT = 1.5; puddle(p); return lose('spill'); }
    if (left <= 0){ say(L('Hết giờ, cà phê nguội rồi. Quay lại Pantry lấy ly mới.', 'Too slow, the coffee went cold. Grab a new cup at the Pantry.')); return lose('timeout'); }
    if (dist(c, E.player) < 1.3){ done = true; drop(cup); cup = null; E.faceEach(E.player, c); speak(c, H.line(D, 'coffee', 'thanks', g.tk.who), 2.6);
      E.setFace(c.obj, 'happy', 'mSmile'); c.faceT = 2; setTimeout(() => finish({ win:true, flawless:spills === 0 && cups === 1 }), 900); }
  };
  g.onTalk = () => true;   // giao bằng cách tới gần; trong lúc chơi không mở bảng thông tin
} };
function puddle(p){ const m = new THREE.Mesh(new THREE.CircleGeometry(.45, 24), new THREE.MeshBasicMaterial({ color:'#8A5A3C', transparent:true, opacity:.7 }));
  m.rotation.x = -Math.PI/2; m.position.set(p.x + .3, .03, p.z + .2); E.world.add(m);
  let o = .7; const id = setInterval(() => { o -= .04; m.material.opacity = o; if (o <= 0){ clearInterval(id); drop(m); } }, 200); }

// 5.6 hide — nhân vật trốn ở phòng khác, hỏi NPC để có gợi ý
GAMES.hide = { start(g){
  const c = g.target, cf = g.cfg, pr = E.roomAt(pos(E.player).x, pos(E.player).z);
  const rooms = E.rooms.filter(r => r.kind !== 'locked' && r !== c.room && r !== pr && (r.hideSpots || []).length);
  const room = rnd(rooms.length ? rooms : E.rooms.filter(r => r.kind !== 'locked' && r !== c.room && (r.hideSpots || []).length));
  if (!room){ endGame(); return; }
  const [hx, hz] = rnd(room.hideSpots);
  grab(c); g.cleanup.push(() => { c.hidden = false; c.obj.root.scale.set(1, 1, 1); release(c); });
  let count = cf.countdown_secs, left = cf.secs, hints = 0, found = false, peek = 0;
  shade.hidden = false; shade.innerHTML = `<b>${Math.ceil(count)}</b><span>${esc(roleName(g.tk.who))} ${L('đang đi trốn…', 'is running off to hide…')}</span>`;
  c.path = []; c.obj.root.position.set(hx, 0, hz); c.heading = Math.random() * 6.28; c.hidden = true; c.obj.root.scale.set(1, .6, 1);
  g.hideRoom = room;
  const hud = () => showBar(`<div class="h-title">${L('Tìm', 'Find')} ${esc(roleName(g.tk.who))}</div>
    <div class="h-sub">${L('Tới gần rồi nói chuyện (F / chạm) để bắt · hỏi người khác để có gợi ý', 'Get close and talk (F / tap) to catch them · ask others for hints')} · <span class="h-t">${timerHtml(left)}</span></div>`);
  g.tick = dt => {
    if (count > 0){ count -= dt; shade.querySelector('b').textContent = Math.max(1, Math.ceil(count)); if (count <= 0){ shade.hidden = true; g.t0 = E.t; hud(); } return; }
    if (found) return;
    left -= dt; setBar('.h-t', timerHtml(left));
    peek += dt; const up = !reduceMotion && (peek % 4) < .5; c.obj.root.scale.y += ((up ? .85 : .6) - c.obj.root.scale.y) * .2;
    if (left <= 0){ found = true; finish({ win:false, fail_kind:'timeout' }); }
  };
  g.onTalk = o => { if (count > 0 || found) return true;
    if (o === c){ found = true; c.hidden = false; c.obj.root.scale.set(1, 1, 1); E.faceEach(E.player, c); speak(c, H.line(D, 'hide', 'found', g.tk.who), 2.4);
      const secs = E.t - g.t0; setTimeout(() => finish({ win:true, flawless:hints === 0, secs }), 900); return true; }
    if (o.roamer) return true;
    hints++; E.faceEach(E.player, o); speak(o, H.fill(H.line(D, 'hide', 'hint', o.role.id), { room:room.name }), 3); return true; };
  // bấm trúng thân nhân vật đang trốn cũng tính (kể cả khi chỉ nhô đầu)
  g.onClick = e => { const o = E.pick(e); if (o === c && count <= 0){ const q = pos(c); E.walkTo(E.player, q.x, q.z, () => E.talk(c), 1.2); return true; } return false; };
} };

// 5.7 race — chạy đua tới Pantry
GAMES.race = { start(g){
  const c = g.target, cf = g.cfg, r = lounge(); if (!r){ endGame(); return; }
  grab(c); g.cleanup.push(() => release(c));
  const [gx, gz] = E.nearestFree(r.x, r.z + r.d/2 - 1.4), goal = ring(gx, gz, .8, '#2FBF8F'); g.cleanup.push(() => drop(goal));
  c.path = []; c.obj.root.position.set(c.seat.x, 0, c.seat.z);
  const [px, pz] = E.nearestFree(c.seat.x + .9, c.seat.z + .3); E.player.path = []; E.player.obj.root.position.set(px, 0, pz);
  speak(c, H.line(D, 'race', 'start', g.tk.who), 2);
  let count = 3, falseStart = false, started = false, npcAt = 0, done = false;
  const p0 = { x:px, z:pz };
  shade.hidden = false; shade.classList.add('h-light'); shade.innerHTML = `<b>3</b><span>${L('Chạy tới vòng xanh ở Pantry. Đừng chạy trước hiệu lệnh!', 'Run to the green circle in the Pantry. No false starts!')}</span>`;
  g.cleanup.push(() => shade.classList.remove('h-light'));
  showBar(`<div class="h-title">${L('Chạy đua với', 'Race')} ${esc(roleName(g.tk.who))}</div><div class="h-sub">${L('WASD / bấm sàn để chạy', 'WASD / click the floor to run')}</div>`);
  g.tick = dt => { if (done) return;
    const p = pos(E.player);
    if (!started){ count -= dt; shade.querySelector('b').textContent = count > 0 ? Math.ceil(count) : L('Chạy!', 'Go!');
      if (!falseStart && (Math.hypot(p.x - p0.x, p.z - p0.z) > .25)){ falseStart = true; say(L('Chạy trước hiệu lệnh! Phạt đứng yên.', 'False start! Penalty.'), 2); }
      if (count <= 0){ started = true; g.t0 = E.t; setTimeout(() => { shade.hidden = true; }, 500);
        if (falseStart) E.player.frozenUntil = E.t + cf.false_start_penalty_secs;
        npcAt = E.t + cf.npc_delay_secs; } return; }
    if (npcAt && E.t >= npcAt){ npcAt = 0; c.speed = E.player.speed * Math.max(.2, cf.speed_top - cf.speed_step * (g.rank - 1)); E.walkTo(c, gx, gz); }
    const pin = Math.hypot(p.x - gx, p.z - gz) < .9, q = pos(c), cin = Math.hypot(q.x - gx, q.z - gz) < .9;
    if (pin || cin){ done = true; finish(pin ? { win:true, flawless:!falseStart } : { win:false, fail_kind:'slower' }); }
  };
  g.onTalk = () => true;
} };

// 5.8 gossip — giữ Space để nấu xói, đừng để người bị nấu xói nghe thấy
GAMES.gossip = { start(g){
  const c = g.target, partner = charOf(g.tk.partner), cf = g.cfg; if (!partner){ endGame(); return; }
  grab(c); grab(partner); g.cleanup.push(() => { release(c); release(partner); drop(hear); });
  const pp = pos(partner), [px, pz] = E.nearestFree(pp.x + .9, pp.z + .2); E.player.path = []; E.player.obj.root.position.set(px, 0, pz); E.faceEach(E.player, partner);
  const hear = ring(0, 0, cf.hear_radius, '#E92F7C', .55);
  let fill = 0, left = cf.time_limit_secs, holding = false, inRange = 0, clean = true, done = false, phase = 'away', phaseT = 1.5, warn = null, lineT = 0;
  const warnTag = E.addLabel('<div class="qmark turn">?</div>', 'hqm', new THREE.Vector3(), { custom:() => warn && E.t < warn ? { show:true, pos:above(c, 2.1) } : { show:false } });
  g.cleanup.push(() => warnTag.el.remove());
  showBar(`<div class="h-title">${L('Nấu xói', 'Gossip about')} ${esc(roleName(g.tk.who))} ${L('với', 'with')} ${esc(roleName(g.tk.partner))}</div>
    <div class="h-meter"><i></i></div><div class="h-sub">${L('Giữ Space / giữ nút để thì thầm · thấy "?" thì thả tay', 'Hold Space / the button to whisper · let go when you see "?"')} · <span class="h-t">${timerHtml(left)}</span></div>`);
  showAct(L('Nấu xói (giữ)', 'Gossip (hold)'), true);
  g.onAct = down => { holding = down && !done; act.classList.toggle('on', holding); };
  const goNear = () => { const m = pos(E.player), a = Math.random() * 6.28, [x, z] = E.nearestFree(m.x + Math.cos(a) * 1.4, m.z + Math.sin(a) * 1.4); E.walkTo(c, x, z); };
  const goAway = () => { const m = pos(E.player), r = c.room; let best = null;
    for (let k = 0; k < 8; k++){ const x = r.x + (Math.random() - .5) * (r.w - 1.8), z = r.z + (Math.random() - .5) * (r.d - 1.8); const d = Math.hypot(x - m.x, z - m.z); if (!best || d > best[2]) best = [x, z, d]; }
    const [x, z] = E.nearestFree(best[0], best[1]); E.walkTo(c, x, z); };
  goAway();
  g.tick = dt => { if (done) return;
    left -= dt; setBar('.h-t', timerHtml(left));
    const q = pos(c); hear.position.set(q.x, .07, q.z);
    phaseT -= dt;
    if (phaseT <= 0){
      if (phase === 'away'){ phase = 'warn'; phaseT = cf.warn_secs; warn = E.t + cf.warn_secs; }
      else if (phase === 'warn'){ phase = 'near'; phaseT = 1.5 + Math.random() * 1.5 + 2; goNear(); }
      else { phase = 'away'; phaseT = 2 + Math.random() * 2 + 1.5; goAway(); } }
    const close = dist(c, E.player) < cf.hear_radius;
    if (holding){
      fill += dt; lineT -= dt; if (lineT <= 0){ lineT = 2 + Math.random(); speak(E.player, H.line(D, 'gossip', 'say', g.tk.who), 2.4); }
      if (close){ clean = false; inRange += dt; if (inRange > cf.grace_secs){ done = true; holding = false; E.faceEach(c, E.player); speak(c, H.line(D, 'gossip', 'caught', g.tk.who), 2.8);
        E.setFace(c.obj, 'look', 'mFlat'); c.faceT = 2; setTimeout(() => finish({ win:false, fail_kind:'caught' }), 1100); return; } }
      else inRange = 0;
    } else inRange = 0;
    const m = bar.querySelector('.h-meter i'); if (m) m.style.width = Math.min(100, fill / cf.fill_secs * 100) + '%';
    if (fill >= cf.fill_secs){ done = true; finish({ win:true, flawless:clean }); }
    else if (left <= 0){ done = true; finish({ win:false, fail_kind:'timeout' }); }
  };
  g.onTalk = () => true;
} };

// ════════════════════════════════════════════════════════
// HUY HIỆU + ĐỒNG XU 3D
// ════════════════════════════════════════════════════════
const COND = {
  wins:(b, a) => L(`Thắng "${a}" ${b.threshold} lần`, `Win "${a}" ${b.threshold} times`),
  distinct_characters:(b, a) => L(`Thắng "${a}" với ${b.threshold} người khác nhau`, `Win "${a}" against ${b.threshold} different people`),
  flawless_wins:(b, a) => L(`Thắng sạch "${a}" ${b.threshold} lần`, `Flawless "${a}" wins: ${b.threshold}`),
  win_streak:(b, a) => L(`Thắng "${a}" ${b.threshold} lần liên tiếp`, `Win "${a}" ${b.threshold} times in a row`),
  win_under_secs:(b, a) => L(`Thắng "${a}" trong ${b.params.secs} giây`, `Win "${a}" within ${b.params.secs} seconds`),
  win_vs:(b, a) => b.params.character_id ? L(`Thắng "${a}" với ${roleName(b.params.character_id)}`, `Win "${a}" against ${roleName(b.params.character_id)}`)
    : L(`Thắng "${a}" với nhân vật cấp ${b.params.rank_min || 1}–${b.params.rank_max || 8}`, `Win "${a}" against rank ${b.params.rank_min || 1}–${b.params.rank_max || 8}`),
  fail_count:(b, a) => L(`Thua "${a}" kiểu "${b.params.fail_kind}" ${b.threshold} lần`, `Lose "${a}" by "${b.params.fail_kind}" ${b.threshold} times`),
  all_actions:() => L('Thắng ít nhất một lần ở mọi hành động', 'Win every action at least once')
};
const condText = b => (COND[b.type] || (() => ''))(b, b.action && HD.actions[b.action] ? HD.actions[b.action].name : '');
const dateText = iso => { try { return new Date(iso).toLocaleDateString(E.LANG === 'en' ? 'en-GB' : 'vi-VN'); } catch (e) { return ''; } };
// mặt đồng xu mặc định / đồng xu 3D: team-map.coin.js (dùng chung với bản xem trước trong CMS)
const COIN = window.TM_COIN, coinOpts = { drawLogo:E.drawLogo, dateText, reduceMotion };
const faceUrl = new Map();
function coinImg(b){ if (b.image) return b.image; if (!faceUrl.has(b.rim)) faceUrl.set(b.rim, COIN.logoFace(b.rim, 256, E.drawLogo).toDataURL()); return faceUrl.get(b.rim); }

function openBadges(focus){
  E.closeSheets(); const n = HD.badges.filter(b => ST.badges[b.id]).length;
  badgesEl.innerHTML = `<button class="btn btn-ghost close-list" data-b="close">${L('Quay lại mô hình 3D', 'Back to the 3D map')}</button><div class="inner">
    <p class="eyebrow">${L('Product Map', 'Product Map')}</p><h1>${L('Huy hiệu', 'Badges')} <span class="h-n">${n}/${HD.badges.length}</span></h1>
    <p class="lead">${L('Bấm vào một đồng nghiệp rồi chọn trò để chơi, thắng để mở huy hiệu. Bấm vào huy hiệu đã mở để xoay đồng xu và lưu ảnh khoe bạn bè.', 'Click a coworker and pick a game; win to unlock badges. Tap an unlocked badge to spin the coin and save an image to share.')}</p>
    <p class="h-store">${storeOk ? L('Huy hiệu lưu trên trình duyệt này. Đổi máy hoặc xoá dữ liệu trình duyệt là mất.', 'Badges are saved in this browser. Switching devices or clearing browser data loses them.')
      : L('Trình duyệt đang chặn lưu dữ liệu (chế độ riêng tư?), nên huy hiệu sẽ không được giữ lại.', 'This browser blocks saving data (private mode?), so badges will not be kept.')}</p>
    <div class="h-grid">${HD.badges.map(b => { const got = ST.badges[b.id];
      if (!got && b.hidden) return `<div class="h-badge locked"><div class="coin2d dark"></div><b>???</b><span>${L('Huy hiệu ẩn', 'Hidden badge')}</span></div>`;
      return `<button class="h-badge${got ? '' : ' dim'}" data-b="${got ? 'view' : ''}" data-id="${esc(b.id)}"${got ? '' : ' disabled'}>
        <div class="coin2d" style="--rim:${b.rim}"><img src="${esc(coinImg(b))}" alt="" crossorigin="anonymous" loading="lazy"></div>
        <b>${esc(b.name)}</b><span>${got ? esc(b.desc) : esc(condText(b))}</span>${got ? `<small>${dateText(got)}</small>` : ''}
        ${b.reward.status === 'coming' ? `<em class="chip draft">${L('Quà: sắp có', 'Gift: coming soon')}</em>` : ''}</button>`; }).join('')}</div></div>`;
  badgesEl.hidden = false;
  badgesEl.querySelectorAll('[data-b]').forEach(x => x.onclick = () => { if (x.dataset.b === 'close') closeBadges(); else if (x.dataset.b === 'view') viewCoin(HD.badges.find(b => b.id === x.dataset.id)); });
  track('tm_badges_open', { unlocked:n });
  if (focus) viewCoin(HD.badges.find(b => b.id === focus), true);
}
function closeBadges(){ closeCoin(); badgesEl.hidden = true; }

let viewer = null;
function viewCoin(b, intro){
  if (!b || !ST.badges[b.id]) return; closeCoin();
  const box = el('div', { className:'h-coinbox' }, `<div class="card h-coincard" role="dialog" aria-modal="true" aria-label="${esc(b.name)}">
    <button class="close" aria-label="${L('Đóng', 'Close')}">×</button><canvas class="h-coin3d" width="360" height="360"></canvas>
    <h2>${esc(b.name)}</h2><p>${esc(b.desc)}</p><small>${L('Đạt ngày', 'Earned on')} ${dateText(ST.badges[b.id])}</small>
    ${b.reward.status === 'coming' ? `<p><em class="chip draft">${L('Quà: sắp có', 'Gift: coming soon')}</em></p>` : ''}
    <div class="row">${b.reward.status === 'open' && b.reward.url ? `<a class="btn btn-ghost" href="${esc(b.reward.url)}" target="_blank" rel="noopener">${esc(b.reward.title || L('Nhận quà', 'Get the gift'))}</a>` : ''}
      <button class="btn btn-primary" data-c="save">${L('Lưu ảnh', 'Save image')}</button></div>
    <p class="h-hint">${L('Kéo để xoay đồng xu', 'Drag to spin the coin')}</p></div>`);
  badgesEl.appendChild(box);
  viewer = { box, scene:COIN.scene(box.querySelector('canvas'), b, ST.badges[b.id], Object.assign({ intro }, coinOpts)), b };
  box.querySelector('.close').onclick = closeCoin;
  box.addEventListener('click', e => { if (e.target === box) closeCoin(); });
  box.querySelector('[data-c="save"]').onclick = () => saveImage(b);
}
function closeCoin(){ if (!viewer) return; viewer.scene.destroy(); viewer.box.remove(); viewer = null; }
function miniCoin(canvas, b){ const sc = COIN.scene(canvas, b, ST.badges[b.id], Object.assign({ intro:true, mini:true }, coinOpts));
  const stop = new MutationObserver(() => { if (!canvas.isConnected || sheet.hidden){ sc.destroy(); stop.disconnect(); } }); stop.observe(sheet, { attributes:true, childList:true, subtree:true }); }

// --- "Lưu ảnh": thẻ PNG 1080 × 1350, đồng xu đúng góc đang xoay ---
async function saveImage(b){
  if (!viewer || !ST.badges[b.id]) return;
  const W = 1080, Hh = 1350, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, Hh); grd.addColorStop(0, '#241354'); grd.addColorStop(1, '#170B3D'); g.fillStyle = grd; g.fillRect(0, 0, W, Hh);
  g.fillStyle = 'rgba(233,47,124,.18)'; g.beginPath(); g.arc(W/2, 520, 380, 0, 7); g.fill();
  viewer.scene.render();
  try { g.drawImage(viewer.box.querySelector('canvas'), W/2 - 340, 180, 680, 680); } catch (e) {}
  g.textAlign = 'center'; g.fillStyle = '#FFC53D'; g.font = '600 34px Oswald, "Be Vietnam Pro", sans-serif'; g.fillText(L('HUY HIỆU · PRODUCT MAP', 'BADGE · PRODUCT MAP'), W/2, 120);
  g.fillStyle = '#FFFFFF'; g.font = '700 64px "Be Vietnam Pro", sans-serif'; wrap(g, b.name, W/2, 960, 900, 74, 2);
  g.fillStyle = '#D9D2F2'; g.font = '500 38px "Be Vietnam Pro", sans-serif'; wrap(g, b.desc, W/2, 1080, 880, 50, 3);
  g.fillStyle = '#BEB3DA'; g.font = '500 30px "Be Vietnam Pro", sans-serif'; g.fillText(`${L('Đạt ngày', 'Earned on')} ${dateText(ST.badges[b.id])}`, W/2, 1215);
  E.drawLogo(g, 70, Hh - 120, 64, '#F4F0FB'); g.textAlign = 'left'; g.fillStyle = '#F4F0FB'; g.font = '700 30px "Be Vietnam Pro", sans-serif'; g.fillText('TELOS ACADEMY', 150, Hh - 78);
  g.textAlign = 'right'; g.fillStyle = '#BEB3DA'; g.font = '500 28px "Be Vietnam Pro", sans-serif'; g.fillText('uiux-library.nhanluu.com', W - 70, Hh - 78);
  let blob; try { blob = await new Promise(r => c.toBlob(r, 'image/png')); } catch (e) { blob = null; }
  if (!blob) return say(L('Không xuất được ảnh (hình huy hiệu chưa cho phép CORS).', 'Could not export the image (badge image host blocks CORS).'), 4);
  const name = `telos-huy-hieu-${b.id}.png`, file = new File([blob], name, { type:'image/png' });
  if (E.isMobile() && navigator.canShare && navigator.canShare({ files:[file] })){
    try { await navigator.share({ files:[file], title:b.name, text:b.desc }); track('tm_badge_save', { badge_id:b.id, method:'share' }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = el('a', { href:URL.createObjectURL(blob), download:name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  track('tm_badge_save', { badge_id:b.id, method:'download' });
}
function wrap(g, text, x, y, maxW, lh, maxLines){ const words = String(text || '').split(/\s+/); let line = '', n = 0;
  for (let i = 0; i < words.length; i++){ const t = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(t).width > maxW && line){ g.fillText(n === maxLines - 1 ? line + '…' : line, x, y + n * lh); n++; line = words[i]; if (n >= maxLines) return; } else line = t; }
  if (line && n < maxLines) g.fillText(line, x, y + n * lh); }

onWorld();
if (!storeOk) console.info('[Team Map] localStorage không dùng được: huy hiệu sẽ không được lưu.');
return { onTalk, onClick, onKey, tick, onWorld, authorCard, panelExtra, bindPanel, playing:() => !!game, flashLocked, radial:openRadial,
  holdsMain:() => !!game || !!pending, sheetOpen:() => !sheet.hidden, closeSheet:() => { if (!game){ cancelPick(); closeSheet(); } closeRadial(); },
  // cho test
  _state:ST, _open:() => H.openAt(D, slotNow()), _pending:() => pending, _picking:() => picking, _choose:choose, _radial:() => radial && { who:radial.c.role.id, items:radial.all.map(i => i.k + (i.open === false ? ':locked' : '')) }, _pickRadial:k => { const it = radial && radial.all.find(i => i.k === k); if (it) pickRadial(it); },
  _pend:tk => { pending = Object.assign({ slot:slotNow(), scale:E.scaleKey, partner:null }, tk); renderCard(); },
  _start:(a, who, partner) => { pending = { slot:slotNow(), scale:E.scaleKey, action:a, who:who || (pending && pending.who), partner:partner || (pending && pending.partner) || null }; start(a); }, _openBadges:openBadges, _game:() => game, _E:E, _H:H };
};
