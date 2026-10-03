// Team Map — nhiệm vụ theo giờ của Nhân Lưu: luồng nhận / trả, 8 mini-game, huy hiệu, đồng xu 3D (SPEC-hourly).
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
  poptask:{ ammo:6, hits_needed:3, flight_secs:.45, hit_radius:.6, max_range:6, target_speed_factor:1.25 },
  flashcard:{ cards:4, pass_correct:3, min_terms:4 },
  coffee:{ secs_per_cup:30, max_cups:3, spill_radius:.7 },
  hide:{ secs:60, countdown_secs:3 },
  race:{ speed_top:.97, speed_step:.055, npc_delay_secs:.5, false_start_penalty_secs:1 },
  gossip:{ fill_secs:8, time_limit_secs:45, hear_radius:2.2, grace_secs:.25, warn_secs:.6 }
};

// ---------- tiến độ ----------
const ST = H.load();
const storeOk = H.save(ST);   // false: trình duyệt chặn lưu (chế độ riêng tư…) → vẫn chơi được, chỉ không lưu
const persist = () => { H.save(ST); };
const slotNow = () => H.slotAt(HD.config);
const roleName = id => (D.ROLES[id] || {}).title || id;
const titleOf = tk => H.fill(HD.actions[tk.action].title, { target:roleName(tk.who), partner:roleName(tk.partner) });

// nhiệm vụ của lượt hiện tại ở quy mô đang xem (null nếu tắt / không có cặp nào)
function current(){ return HD.config.is_enabled ? H.pick(D, E.scaleKey, slotNow()) : null; }
const accepted = () => ST.accepted && HD.actions[ST.accepted.action] && D.ROLES[ST.accepted.who] ? ST.accepted : null;
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
const fab = el('button', { id:'h-fab', className:'h-fab', type:'button' });
const bfab = el('button', { id:'b-fab', className:'icon-btn b-fab', type:'button' });
const card = el('div', { id:'h-card', className:'card', hidden:true });
const bar = el('div', { id:'h-bar', className:'card', hidden:true });
const act = el('button', { id:'h-act', className:'h-act', type:'button', hidden:true });
const sheet = el('aside', { id:'h-sheet', className:'card', hidden:true });
const toast = el('div', { id:'h-toast', className:'card', hidden:true });
const shade = el('div', { id:'h-shade', hidden:true });
const badgesEl = el('div', { id:'badges', hidden:true });
$('.dock').insertBefore(fab, $('.dock').firstChild);
$('.topbar').insertBefore(bfab, $('#btn-list'));
[card, bar, act, sheet, toast, shade, badgesEl].forEach(x => app.appendChild(x));
fab.setAttribute('aria-label', L('Nhiệm vụ giờ này', 'Quest of the hour'));

const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
let toastT = 0;
function say(text, secs = 3){ toast.textContent = text; toast.hidden = false; toastT = secs; }

// ---------- nhãn 3D (◆ trên đầu mục tiêu, ! trên đầu Nhân Lưu, bong bóng thoại, ? cảnh báo) ----------
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
  tags.length = 0; bubbles = [];
  tag('hqm', T => { const a = author(), tk = current(); if (!a || game || accepted() || !tk) return { show:false };
    if (T.el.dataset.k !== '!'){ T.el.dataset.k = '!'; T.el.innerHTML = '<div class="qmark hq">!</div>'; } return { show:true, pos:above(a, 2.05) }; });
  tag('hqm', T => { const tk = accepted(); if (!tk || !here(tk)) return { show:false };
    const who = targetFor(tk); if (!who || who.hidden) return { show:false };
    if (T.el.dataset.k !== '◆'){ T.el.dataset.k = '◆'; T.el.innerHTML = '<div class="qmark hq step">◆</div>'; } return { show:true, pos:above(who, 2.05) }; });
}
// người cần tới gặp để bắt đầu / tiếp tục
function targetFor(tk){
  if (game && game.marker) return game.marker();
  if (tk.action === 'hide' || tk.action === 'coffee') return null;
  return charOf(tk.action === 'gossip' ? tk.partner : tk.who);
}

// ---------- vòng sáng trên sàn (điểm lấy cà phê, đích chạy đua, tầm nghe) ----------
function ring(x, z, r, color, opacity = .9){
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, .05, 8, 48), new THREE.MeshBasicMaterial({ color, transparent:true, opacity }));
  m.rotation.x = -Math.PI/2; m.position.set(x, .07, z); E.world.add(m); return m;
}
const drop = m => { if (m && m.parent) m.parent.remove(m); };

// ---------- HUD ----------
function objective(tk){
  const who = roleName(tk.who), room = (H.roomOfChar(D, tk.scale, tk.action === 'gossip' ? tk.partner : tk.who) || {}).name || '';
  switch (tk.action){
    case 'read': return L(`Tới gặp ${who} ở ${room}, bấm "Đọc bài đầy đủ" rồi "Đọc xong rồi, hỏi đi"`, `Meet ${who} in ${room}, open the article, then press "Done reading, quiz me"`);
    case 'coffee': return L('Ra Pantry, đứng vào vòng tròn hồng để lấy cà phê', 'Go to the Pantry and stand in the pink circle to grab a coffee');
    case 'hide': return L(`Tìm ${who}. Hỏi người xung quanh để có gợi ý`, `Find ${who}. Ask people around for hints`);
    case 'gossip': return L(`Tới gặp ${roleName(tk.partner)} ở ${room} để bắt đầu nấu xói`, `Meet ${roleName(tk.partner)} in ${room} to start gossiping`);
    default: return L(`Tới gặp ${who} ở ${room} để bắt đầu`, `Meet ${who} in ${room} to start`);
  }
}
function renderCard(){
  const tk = accepted();
  if (!tk || game){ card.hidden = true; return; }
  const other = !here(tk), sc = (D.SCALES[tk.scale] || {}).name || tk.scale;
  card.innerHTML = `<p class="eyebrow">${L('Nhiệm vụ giờ này', 'Quest of the hour')}</p><h3>${esc(titleOf(tk))}</h3>
    <div class="objective">${other ? L(`Nhiệm vụ này ở ${esc(sc)}.`, `This quest is in the ${esc(sc)}.`) : esc(objective(tk))}</div>
    <div class="row h-row">${other ? `<button class="btn btn-primary" data-h="switch">${L('Chuyển sang đó', 'Switch there')}</button>`
      : tk.action !== 'hide' ? `<button class="btn btn-primary" data-h="go">${L('Tới đó', 'Go there')}</button>` : ''}
      <button class="btn btn-ghost" data-h="drop">${L('Bỏ', 'Drop')}</button></div>`;
  card.hidden = false;
}
card.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (!b) return; const tk = accepted(); if (!tk) return;
  if (b.dataset.h === 'drop'){ ST.accepted = null; persist(); track('tm_hourly_drop', { action_id:tk.action, character_id:tk.who }); renderCard(); return; }
  if (b.dataset.h === 'switch') return E.setScale(tk.scale);
  if (b.dataset.h === 'go') goTo(tk); });
function goTo(tk){
  const p = E.player.obj.root.position;
  if (tk.action === 'coffee' && lounge()){ const [x, z] = cupSpot(); E.walkTo(E.player, x, z); return; }
  const c = targetFor(tk); if (!c) return; const q = c.obj.root.position;
  E.walkTo(E.player, q.x, q.z, () => E.talk(c), 1.3);
  if (Math.hypot(q.x - p.x, q.z - p.z) < 1.4) E.talk(c);
}
let lastFab = '';
function renderFab(){
  const tk = current(), acc = accepted(), left = H.slotEnds(HD.config, slotNow()) - Date.now();
  const s = `${fmt(left)}|${!!tk}|${!!acc}`; if (s === lastFab) return; lastFab = s;
  fab.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 9v4l2.5 2M9 2h6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
    <span class="mb-met">${tk ? fmt(left) : '—'}</span>${tk && !acc ? '<i class="h-dot" aria-hidden="true">!</i>' : ''}`;
  fab.title = tk ? L(`Nhiệm vụ giờ này · đổi sau ${fmt(left)}`, `Quest of the hour · changes in ${fmt(left)}`) : L('Giờ này chưa có nhiệm vụ', 'No quest this hour');
  fab.hidden = !HD.config.is_enabled;
}
fab.addEventListener('click', () => {
  if (game) return flashLocked();
  const acc = accepted(); if (acc){ renderCard(); if (here(acc)) goTo(acc); return; }
  const a = author(); if (!a) return;
  // xoay camera về phía Nhân Lưu và chỉ đường
  const p = E.player.obj.root.position, q = a.obj.root.position;
  E.setYaw(Math.atan2(p.x - q.x, p.z - q.z));
  say(L(`Nhân Lưu đang ở ${a.room.name}. Tới nói chuyện để nhận nhiệm vụ giờ này.`, `Nhân Lưu is in ${a.room.name}. Talk to him to get the quest of the hour.`), 4);
  E.walkTo(E.player, q.x, q.z, () => E.talk(a), 1.3);
});
function renderBfab(){
  const n = HD.badges.filter(b => ST.badges[b.id]).length;
  bfab.innerHTML = `<span aria-hidden="true">🏅</span> <span class="hide-sm">${L('Huy hiệu', 'Badges')} </span>${n}/${HD.badges.length}`;
  bfab.setAttribute('aria-label', L(`Huy hiệu: đã mở ${n} trên ${HD.badges.length}`, `Badges: ${n} of ${HD.badges.length} unlocked`));
}
bfab.addEventListener('click', () => openBadges());

// ---------- thẻ nhiệm vụ trong bảng của Nhân Lưu ----------
function authorCard(){
  if (!HD.config.is_enabled) return '';
  const acc = accepted(), tk = acc || current();
  if (!tk) return `<div class="h-offer"><h4>${L('Nhiệm vụ giờ này', 'Quest of the hour')}</h4><p>${L('Giờ này ổng chưa nghĩ ra việc gì. Quay lại sau nha.', 'He has no quest for you this hour. Come back later.')}</p></div>`;
  const left = H.slotEnds(HD.config, tk.slot) - Date.now(), a = HD.actions[tk.action];
  const blocked = !acc && E.mainBusy();
  return `<div class="h-offer"><h4>${L('Nhiệm vụ giờ này', 'Quest of the hour')}<span class="h-left">${acc && tk.slot !== slotNow() ? L('lượt cũ', 'earlier slot') : L(`còn ${fmt(left)}`, `${fmt(left)} left`)}</span></h4>
    <b>${esc(titleOf(tk))}</b><p>${esc(H.fill(a.offer, { target:roleName(tk.who), partner:roleName(tk.partner) }))}</p>
    ${acc ? `<div class="h-status">${L('Đang làm', 'In progress')}${here(acc) ? '' : ' · ' + esc((D.SCALES[acc.scale] || {}).name || acc.scale)}</div>
      <div class="row"><button class="btn btn-ghost" data-h="drop">${L('Bỏ nhiệm vụ này', 'Drop this quest')}</button></div>`
    : `<div class="row"><button class="btn btn-primary" data-h="accept"${blocked ? ' disabled' : ''}>${blocked ? L('Làm xong nhiệm vụ đang dở đã', 'Finish your current quest first') : L('Nhận', 'Accept')}</button></div>`}</div>`;
}
// nút "Đọc xong rồi, hỏi đi" trong bảng của nhân vật mục tiêu (hành động read)
function panelExtra(c){
  const tk = accepted(); if (!tk || !here(tk) || tk.action !== 'read' || c.role.id !== tk.who || game) return '';
  const ok = readOpened.has(tk.who), wait = Math.ceil((readRetryAt - Date.now()) / 1000);
  return `<div class="h-offer h-read"><h4>${L('Nhiệm vụ giờ này', 'Quest of the hour')}</h4>
    <p>${ok ? L('Đọc xong chưa? Người ta hỏi lại một câu đó.', 'Done reading? They will ask you one question.') : L('Bấm "Đọc bài đầy đủ" trước, đọc xong quay lại đây.', 'Open the full article first, then come back here.')}</p>
    <div class="row"><button class="btn btn-primary" data-h="quiz"${ok && wait <= 0 ? '' : ' disabled'}>${wait > 0 ? L(`Đợi ${wait} giây`, `Wait ${wait}s`) : L('Đọc xong rồi, hỏi đi', 'Done reading, quiz me')}</button></div></div>`;
}
function bindPanel(c){
  const p = $('#panel');
  p.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
    const k = b.dataset.h;
    if (k === 'accept') return acceptNow();
    if (k === 'drop'){ ST.accepted = null; persist(); renderCard(); E.closePanel(); return; }
    if (k === 'quiz'){ E.closePanel(); return start('read'); }
  });
}
const readOpened = new Set(); let readRetryAt = 0;
// mở bài viết (tab mới trên desktop, xem trước trên mobile) = đã đọc
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href]'); const tk = accepted(); if (!a || !tk || tk.action !== 'read') return;
  const url = (D.ROLES[tk.who] || {}).url; if (!url) return;
  const norm = u => String(u).split('?')[0].replace(/\/$/, '');
  if (norm(a.href) === norm(url)){ readOpened.add(tk.who); setTimeout(() => { const btn = $('#panel [data-h="quiz"]'); if (btn && readRetryAt <= Date.now()){ btn.disabled = false; btn.textContent = L('Đọc xong rồi, hỏi đi', 'Done reading, quiz me'); } }, 50); }
}, true);

function acceptNow(){
  const tk = current(); if (!tk || accepted()) return;
  if (E.mainBusy()) return say(L('Làm xong nhiệm vụ đang dở đã.', 'Finish your current quest first.'));
  ST.accepted = { slot:tk.slot, scale:tk.scale, action:tk.action, who:tk.who, partner:tk.partner || null }; persist();
  track('tm_hourly_accept', { action_id:tk.action, character_id:tk.who });
  E.closePanel(); renderCard();
  if (tk.action === 'hide') start('hide');
  else if (tk.action === 'coffee') start('coffee');
  else say(objective(ST.accepted), 4);
}
const track = (n, p) => E.track(n, Object.assign({ tm_slot:slotNow() }, p));

// ---------- khung mini-game ----------
let game = null;
const GAMES = {};
function flashLocked(){ say(L('Đang chơi mini-game. Bấm "Thoát" nếu muốn dừng.', 'A mini-game is running. Press "Quit" to stop.'), 2.5); }
function start(id){
  const tk = accepted(); if (!tk || !here(tk) || game) return;
  E.closeSheets(); E.closeDialog(); closeSheet();
  const target = charOf(tk.who);
  if (!target && id !== 'flashcard' && id !== 'read') return;
  game = { id, tk, target, rank:(D.ROLES[tk.who] || {}).rank || 2, cfg:cfgOf(id), t0:E.t, cleanup:[], held:new Set() };
  app.classList.add('h-playing'); card.hidden = true;
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
// kết quả: ghi tiến độ, chấm huy hiệu, Nhân Lưu khen (thắng) hoặc chê (thua)
function finish(r){
  if (!game) return; const g = game, tk = g.tk, a = HD.actions[tk.action];
  const ev = { action_id:tk.action, character_id:tk.who, rank:g.rank, scale:tk.scale, slot:tk.slot, win:!!r.win, flawless:!!r.flawless,
    secs: r.secs != null ? r.secs : E.t - g.t0, fail_kind: r.win ? null : (r.fail_kind || 'lose') };
  endGame();
  const { counted } = H.record(ST, ev, HD.config);
  const got = H.evaluate(ST, D);
  if (r.win) ST.accepted = null;
  persist(); renderBfab();
  track('tm_hourly_result', { action_id:ev.action_id, character_id:ev.character_id, win:ev.win, flawless:ev.flawless, fail_kind:ev.fail_kind || '', counted });
  got.forEach(id => track('tm_badge_unlock', { badge_id:id }));
  if (r.win){
    praise(a.win, () => resultSheet(tk, true, got, counted));
  } else resultSheet(tk, false, got, true, r.note);
}
// thắng: Nhân Lưu tự đi tới chỗ người chơi rồi nói câu thắng
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
function resultSheet(tk, win, got, counted, note){
  const a = HD.actions[tk.action];
  sheet.innerHTML = `<button class="close" aria-label="${L('Đóng', 'Close')}">×</button><div class="sheet-body">
    <p class="eyebrow">${L('Nhiệm vụ giờ này', 'Quest of the hour')}</p><h2>${esc(titleOf(tk))}</h2>
    <div class="chips"><span class="chip ${win ? 'pub' : 'todo'}">${win ? L('Thắng', 'Won') : L('Thua', 'Lost')}</span>${win && !counted ? `<span class="chip">${L('Lượt này đã tính rồi, chơi cho vui', 'Already counted this hour, just for fun')}</span>` : ''}</div>
    ${win ? '' : `<p class="h-lose">${esc(a.lose)}</p>`}${note ? `<p class="h-note">${esc(note)}</p>` : ''}
    ${got.length ? `<div class="h-got">${got.map(id => { const b = HD.badges.find(x => x.id === id); return `<div class="h-gotb"><canvas class="h-coin-mini" data-badge="${esc(id)}" width="160" height="160"></canvas><div><b>${L('Mở huy hiệu', 'Badge unlocked')}: ${esc(b.name)}</b><p>${esc(b.desc)}</p></div></div>`; }).join('')}</div>` : ''}
    <div class="row">${win ? (got.length ? `<button class="btn btn-primary" data-r="badges">${L('Xem huy hiệu', 'See badges')}</button>` : '')
      : `<button class="btn btn-primary" data-r="retry">${L('Chơi lại', 'Play again')}</button><button class="btn btn-ghost" data-r="drop">${L('Bỏ nhiệm vụ', 'Drop quest')}</button>`}
      <button class="btn btn-ghost" data-r="close">${L('Đóng', 'Close')}</button></div></div>`;
  E.closeSheets('hourly'); sheet.hidden = false;
  sheet.querySelector('.close').onclick = closeSheet;
  sheet.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    const k = b.dataset.r; closeSheet();
    if (k === 'badges') openBadges(got[0]);
    if (k === 'drop'){ ST.accepted = null; persist(); renderCard(); }
    if (k === 'retry') retry(tk);
  });
  sheet.querySelectorAll('.h-coin-mini').forEach(cv => miniCoin(cv, HD.badges.find(x => x.id === cv.dataset.badge)));
  renderCard();
}
function retry(tk){
  if (tk.action === 'read'){ const w = Math.ceil((readRetryAt - Date.now()) / 1000);
    if (w > 0) return say(L(`Đợi ${w} giây nữa rồi hỏi lại nha.`, `Wait ${w} more seconds before trying again.`)); return start('read'); }
  if (tk.action === 'hide' || tk.action === 'coffee' || tk.action === 'flashcard') return start(tk.action);
  const c = targetFor(tk); if (c){ const q = c.obj.root.position; E.walkTo(E.player, q.x, q.z, () => E.talk(c), 1.3); say(objective(tk), 3); }
}
function closeSheet(){ sheet.hidden = true; }

// ---------- hook từ engine ----------
function onTalk(c){
  if (game) return game.onTalk ? game.onTalk(c) : true;
  const tk = accepted(); if (!tk || !here(tk)) return false;
  if (tk.action === 'read' || tk.action === 'hide' || tk.action === 'coffee') return false;
  const starter = tk.action === 'gossip' ? tk.partner : tk.who;
  if (c.role.id !== starter || c.roamer) return false;
  start(tk.action); return true;
}
function onClick(e){ return !!(game && game.onClick && game.onClick(e)); }
function onKey(e, down){
  const k = e.key;
  if (!game){ if (down && k === 'Escape' && !badgesEl.hidden){ closeBadges(); return true; } return false; }
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
  if (toastT > 0){ toastT -= dt; if (toastT <= 0) toast.hidden = true; }
  tickAcc += dt; if (tickAcc < .5) return; tickAcc = 0;
  renderFab();
  // vị trí thẻ nhiệm vụ: ngay dưới thẻ quest chính nếu đang hiện
  const q = $('#quest'), top = !q.hidden && q.offsetParent ? q.offsetTop + q.offsetHeight + 8 : null;
  card.style.top = top != null ? top + 'px' : '';
  if (!card.hidden && accepted() && !game){ const o = card.querySelector('.objective'); if (o && here(accepted())) o.textContent = objective(accepted()); }
}
function onWorld(){
  if (game){ const g = game; game = null; g.cleanup.forEach(f => { try { f(); } catch (e) {} }); bar.hidden = true; act.hidden = true; shade.hidden = true; app.classList.remove('h-playing'); }
  buildTags(); renderCard(); renderFab(); renderBfab();
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
  g.onAct = down => { if (!down || done) return; const now = performance.now(); taps = taps.filter(x => now - x < 1000);
    if (taps.length >= cf.max_taps_per_sec) return; taps.push(now); v = Math.min(100, v + cf.tap_gain); };
  const shakeP = E.player.obj.inner, shakeC = c.obj.inner;
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

// 5.3 poptask — ném pop-task vào nhân vật đang đi lại trong phòng
GAMES.poptask = { start(g){
  const c = g.target, cf = g.cfg; grab(c); g.cleanup.push(() => { release(c); stuck.forEach(drop); flying.forEach(f => drop(f.m)); });
  c.speed = 3.6 * cf.target_speed_factor;
  let ammo = cf.ammo, hits = 0, thrown = 0, firstHits = 0, done = false; const flying = [], stuck = [];
  const wander = () => { if (!game || done) return; const r = c.room, p = [r.x + (Math.random() - .5) * (r.w - 2.4), r.z + (Math.random() - .5) * (r.d - 2.4)];
    const [x, z] = E.nearestFree(p[0], p[1]); E.walkTo(c, x, z, () => setTimeout(wander, 200 + Math.random() * 500)); };
  wander();
  const hud = () => showBar(`<div class="h-title">${L('Ném trúng', 'Hit')} ${esc(roleName(g.tk.who))}</div>
    <div class="h-sub">${L('Bấm / chạm sàn để ném · Space ném về phía nhân vật · WASD để đi', 'Click / tap the floor to throw · Space throws towards them · WASD to move')}</div>
    <div class="h-count">${L('Trúng', 'Hits')} <b>${hits}/${cf.hits_needed}</b> · ${L('Còn', 'Left')} <b>${ammo}</b> ${L('tờ', 'tasks')}</div>`);
  hud(); showAct(L('Ném', 'Throw'));
  const throwTo = (tx, tz) => { if (done || ammo <= 0) return; const p = pos(E.player); let dx = tx - p.x, dz = tz - p.z; const d = Math.hypot(dx, dz) || 1;
    if (d > cf.max_range){ dx *= cf.max_range / d; dz *= cf.max_range / d; }
    ammo--; thrown++; const m = E.box(.26, .02, .2, '#FFF6A8'); m.position.set(p.x, 1, p.z); E.world.add(m);
    E.player.heading = Math.atan2(dx, dz);
    flying.push({ m, x0:p.x, z0:p.z, x1:p.x + dx, z1:p.z + dz, t:0, n:thrown }); hud(); };
  g.onClick = e => { const q = E.groundPoint(e); if (q) throwTo(q.x, q.z); return true; };
  g.onAct = down => { if (!down) return; const q = pos(c); throwTo(q.x, q.z); };
  g.tick = dt => {
    for (let i = flying.length - 1; i >= 0; i--){ const f = flying[i]; f.t += dt / cf.flight_secs; const k = Math.min(1, f.t);
      f.m.position.set(f.x0 + (f.x1 - f.x0) * k, 1 + Math.sin(k * Math.PI) * 1.2 - k * .95, f.z0 + (f.z1 - f.z0) * k); f.m.rotation.y += dt * 12;
      if (k < 1) continue;
      flying.splice(i, 1); const q = pos(c);
      if (Math.hypot(q.x - f.x1, q.z - f.z1) <= cf.hit_radius){
        hits++; if (f.n <= cf.hits_needed) firstHits++; drop(f.m);
        const s = E.box(.24, .2, .02, '#FFF6A8'); s.position.set((Math.random() - .5) * .3, .75 + Math.random() * .4, .36); s.rotation.z = (Math.random() - .5) * .6; c.obj.root.add(s); stuck.push(s);
        speak(c, H.line(D, 'poptask', 'react', g.tk.who), 2.4); say(`📝 ${H.line(D, 'poptask', 'task', g.tk.who)}`, 2.4);
        E.setFace(c.obj, 'look', 'mO'); c.faceT = 1.5;
      } else { const m = f.m; setTimeout(() => drop(m), 1500); }
      hud();
      if (hits >= cf.hits_needed){ done = true; return finish({ win:true, flawless:firstHits >= cf.hits_needed && thrown === cf.hits_needed }); }
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
// mặt đồng xu mặc định: nền màu viền + logo TELOS
const logoFace = (rim, size = 512) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = rim; g.fillRect(0, 0, size, size); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(size/2, size/2, size*.42, 0, 7); g.fill();
  E.drawLogo(g, size*.24, size*.24, size*.52, '#1C1033'); return c; };
const faceUrl = new Map();
function coinImg(b){ if (b.image) return b.image; if (!faceUrl.has(b.rim)) faceUrl.set(b.rim, logoFace(b.rim, 256).toDataURL()); return faceUrl.get(b.rim); }

function openBadges(focus){
  E.closeSheets(); const n = HD.badges.filter(b => ST.badges[b.id]).length;
  badgesEl.innerHTML = `<button class="btn btn-ghost close-list" data-b="close">${L('Quay lại mô hình 3D', 'Back to the 3D map')}</button><div class="inner">
    <p class="eyebrow">${L('Nhiệm vụ giờ này', 'Quest of the hour')}</p><h1>${L('Huy hiệu', 'Badges')} <span class="h-n">${n}/${HD.badges.length}</span></h1>
    <p class="lead">${L('Làm nhiệm vụ giờ này của Nhân Lưu để mở huy hiệu. Bấm vào huy hiệu đã mở để xoay đồng xu và lưu ảnh khoe bạn bè.', 'Do Nhân Lưu\'s quest of the hour to unlock badges. Tap an unlocked badge to spin the coin and save an image to share.')}</p>
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

// --- đồng xu 3D: canvas Three.js riêng, chỉ tạo khi mở, huỷ khi đóng ---
function coinTextures(b, iso){
  const make = c => { const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };
  const back = document.createElement('canvas'); back.width = back.height = 512; const g = back.getContext('2d');
  g.fillStyle = b.rim; g.fillRect(0, 0, 512, 512); E.drawLogo(g, 176, 120, 160, '#1C1033');
  g.fillStyle = '#1C1033'; g.textAlign = 'center'; g.font = '700 34px "Be Vietnam Pro", sans-serif'; g.fillText('TELOS ACADEMY', 256, 340);
  g.font = '500 28px "Be Vietnam Pro", sans-serif'; g.fillText(iso ? dateText(iso) : '', 256, 384);
  const front = make(logoFace(b.rim)), backT = make(back);
  // mặt sau nhìn từ phía sau: lật ngang để chữ không bị ngược
  backT.wrapS = THREE.RepeatWrapping; backT.repeat.x = -1;
  if (b.image){ const ld = new THREE.TextureLoader(); ld.setCrossOrigin('anonymous');
    ld.load(b.image, t => { front.image = t.image; front.needsUpdate = true; }, undefined, () => {}); }
  return { front, back:backT };
}
function makeCoin(b, iso){
  const geo = new THREE.CylinderGeometry(1, 1, .12, 64); geo.rotateX(Math.PI / 2);
  const tx = coinTextures(b, iso);
  const side = new THREE.MeshStandardMaterial({ color:b.rim, metalness:.75, roughness:.32 });
  const front = new THREE.MeshStandardMaterial({ map:tx.front, metalness:.15, roughness:.45 });
  const back = new THREE.MeshStandardMaterial({ map:tx.back, metalness:.35, roughness:.4 });
  // CylinderGeometry: [thân, nắp trên, nắp dưới]; sau rotateX nắp trên quay về +Z (mặt trước)
  const m = new THREE.Mesh(geo, [side, front, back]);
  return { mesh:m, dispose:() => { geo.dispose(); [side, front, back].forEach(x => { if (x.map) x.map.dispose(); x.dispose(); }); } };
}
function coinScene(canvas, b, iso, opts = {}){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, preserveDrawingBuffer:true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .1, 50); cam.position.set(0, 0, 4.4);
  scene.add(new THREE.AmbientLight(0xffffff, .75)); const dl = new THREE.DirectionalLight(0xffffff, .9); dl.position.set(2, 3, 4); scene.add(dl);
  const rl = new THREE.DirectionalLight(0xffe7b0, .45); rl.position.set(-3, -1, 2); scene.add(rl);
  const coin = makeCoin(b, iso); scene.add(coin.mesh);
  let vel = opts.intro ? 18 : 0, rot = opts.intro ? -Math.PI * 2 : 0, scale = opts.intro ? .2 : 1, dragging = null, alive = true, last = performance.now();
  const auto = reduceMotion ? 0 : (opts.mini ? 1.2 : .6);
  const size = () => { const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  size();
  const frame = now => { if (!alive) return; const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!dragging){ vel += ((auto) - vel) * Math.min(1, dt * 1.6); rot += vel * dt; }
    scale += (1 - scale) * Math.min(1, dt * 4);
    coin.mesh.rotation.y = rot; coin.mesh.scale.setScalar(scale); renderer.render(scene, cam); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  if (!opts.mini){
    const down = e => { dragging = { x:e.clientX, t:performance.now(), r:rot }; vel = 0; canvas.setPointerCapture(e.pointerId); };
    const move = e => { if (!dragging) return; const dx = e.clientX - dragging.x; const nr = dragging.r + dx * .012; const dtm = Math.max(1, performance.now() - dragging.t);
      vel = (nr - rot) / (dtm / 1000) * .5; rot = nr; dragging.t = performance.now(); dragging.r = rot; dragging.x = e.clientX; };
    const up = () => { dragging = null; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.style.touchAction = 'none';
  }
  return { renderer, render:() => renderer.render(scene, cam), resize:size,
    destroy:() => { alive = false; coin.dispose(); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } };
}
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
  viewer = { box, scene:coinScene(box.querySelector('canvas'), b, ST.badges[b.id], { intro }) , b };
  box.querySelector('.close').onclick = closeCoin;
  box.addEventListener('click', e => { if (e.target === box) closeCoin(); });
  box.querySelector('[data-c="save"]').onclick = () => saveImage(b);
}
function closeCoin(){ if (!viewer) return; viewer.scene.destroy(); viewer.box.remove(); viewer = null; }
function miniCoin(canvas, b){ const sc = coinScene(canvas, b, ST.badges[b.id], { intro:true, mini:true });
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
return { onTalk, onClick, onKey, tick, onWorld, authorCard, panelExtra, bindPanel, playing:() => !!game, flashLocked,
  holdsMain:() => !!accepted(), sheetOpen:() => !sheet.hidden, closeSheet:() => { if (!game) closeSheet(); },
  // cho test / CMS
  _state:ST, _current:current, _start:start, _openBadges:openBadges, _coinScene:coinScene, _game:() => game, _E:E, _H:H };
};
