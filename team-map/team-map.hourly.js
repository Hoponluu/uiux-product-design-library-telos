// Team Map — nhiệm vụ theo giờ (SPEC-hourly): phần logic thuần, không đụng tới giao diện.
// Dùng chung cho game (team-map.hourly-games.js) và CMS (khối "Đang chạy"), nên hai nơi luôn ra cùng một kết quả.
(function(){
  const ACTIONS = ['read','fight','poptask','flashcard','coffee','hide','race','gossip'];
  const CONDITIONS = ['wins','distinct_characters','flawless_wins','win_streak','win_under_secs','win_vs','fail_count','all_actions'];
  const KEEP_SLOTS = 48;       // số lượt giữ trong localStorage
  const STORE_KEY = 'tm_hourly_v1';

  // ---------- số ngẫu nhiên có seed ----------
  function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(str){ let h = 2166136261; for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function shuffle(arr, rnd){ const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- đồng hồ ----------
  const slotMs = cfg => Math.max(5, cfg.slot_minutes || 60) * 60000;
  const slotAt = (cfg, now = Date.now()) => Math.floor(now / slotMs(cfg));
  const slotEnds = (cfg, slot) => (slot + 1) * slotMs(cfg);

  // ---------- cặp hợp lệ ----------
  // Phòng của nhân vật ở một quy mô: vị trí có id nhỏ nhất (PLACE đã sắp theo id vị trí).
  function roomOfChar(D, scale, id){
    const ids = D.PLACE && D.PLACE[scale] && D.PLACE[scale][id]; if (!ids || !ids.length) return null;
    return (D.SCALES[scale].rooms || []).find(r => r.id === ids[0]) || null;
  }
  function bossOf(D, scale, id){
    const sr = D.SCALE_REPORTS && D.SCALE_REPORTS[scale];
    return sr && sr[id] !== undefined ? sr[id] : (D.ROLES[id] ? D.ROLES[id].reportsTo : null);
  }
  // nhân vật có mặt trong thế giới 3D của quy mô: người ngồi ghế (role) + khách ở Pantry
  function present(D, scale, id){
    const r = D.ROLES[id], room = roomOfChar(D, scale, id); if (!r || !room || room.kind === 'locked') return false;
    if (r.kind === 'guest') return room.kind === 'lounge';
    return r.kind === 'role' && room.members.includes(id);
  }
  function partners(D, scale, target){
    const r = D.ROLES[target]; if (!r) return [];
    const ok = id => id !== target && id !== D.PLAYER_ID && id !== D.AUTHOR_ID && present(D, scale, id);
    if (r.gossipPartners) return r.gossipPartners.filter(ok).sort();
    const room = roomOfChar(D, scale, target); if (!room) return [];
    const boss = bossOf(D, scale, target);
    return Object.keys(D.PLACE[scale] || {}).filter(id => ok(id) && id !== boss && (roomOfChar(D, scale, id) || {}).id === room.id).sort();
  }
  const quizOf = (D, id) => D.HOURLY.quiz.filter(q => q.who === id);
  const termsOf = (D, id) => (D.ROLES[id].relatedTerms || []).filter(t => D.HOURLY.terms[t]);

  // Lý do một cặp không hợp lệ (null = hợp lệ). Dùng cho cả vòng xoay lẫn dòng giải thích trong CMS.
  function whyNot(D, scale, actionId, id){
    const H = D.HOURLY, a = H && H.actions[actionId], r = D.ROLES[id];
    if (!a) return 'chưa có hành động';
    if (!a.active) return 'hành động đang tắt';
    if (!r) return 'nhân vật đang ẩn';
    if (r.kind === 'player' || r.kind === 'author' || id === D.PLAYER_ID || id === D.AUTHOR_ID) return 'nhân vật chính / tác giả';
    if (!present(D, scale, id)) return 'không có chỗ ngồi ở quy mô này';
    if ((r.hourlyExclude || []).includes(actionId)) return 'đã loại trong CMS';
    const room = roomOfChar(D, scale, id), cfg = a.config || {};
    if (actionId === 'read'){ if (!r.url) return 'chưa có bài viết'; if (!quizOf(D, id).length) return 'chưa có câu hỏi'; }
    if (actionId === 'flashcard'){ const n = termsOf(D, id).length, need = cfg.min_terms || 4; if (n < need) return `mới có ${n}/${need} thuật ngữ`; }
    if ((actionId === 'coffee' || actionId === 'race') && room.kind === 'lounge') return 'đang ngồi ở Pantry';
    if ((actionId === 'coffee' || actionId === 'race') && !(D.SCALES[scale].rooms || []).some(x => x.kind === 'lounge')) return 'quy mô không có Pantry';
    if (actionId === 'gossip' && !partners(D, scale, id).length) return 'không có ai để nấu xói cùng';
    return null;
  }
  function pairs(D, scale){
    const H = D.HOURLY; if (!H || !H.config.is_enabled || !D.SCALES[scale]) return [];
    const ids = Object.keys(D.PLACE[scale] || {}).sort();
    const out = [];
    ACTIONS.filter(a => H.actions[a]).sort().forEach(a => ids.forEach(id => { if (!whyNot(D, scale, a, id)) out.push({ action:a, who:id }); }));
    return out;
  }

  // ---------- chọn cặp theo giờ ----------
  // Danh sách đã nhân theo trọng số, xáo theo chu kỳ (seed = cycle). Luật "không lặp N lượt" và "không trùng hành động
  // lượt trước" được áp tuần tự trong từng khối BLOCK lượt cố định, nên kết quả của một lượt không phụ thuộc lúc tính.
  // Đầu khối so với đuôi khối trước (tính không kèm khối trước nữa) để không lặp qua ranh giới khối.
  const BLOCK = 168, cache = new Map();
  function sequence(D, scale, list, b, cross){
    const H = D.HOURLY, K = Math.max(0, H.config.no_repeat_slots | 0);
    const arr = []; list.forEach(p => { for (let i = 0; i < H.actions[p.action].weight; i++) arr.push(p); });
    const N = arr.length, distinct = list.length, actionsN = new Set(list.map(p => p.action)).size, key = p => p.action + ':' + p.who;
    const hist = cross ? sequence(D, scale, list, b - 1, false).slice(-Math.max(K, 1)) : [], out = [];
    for (let s = b * BLOCK; s < (b + 1) * BLOCK; s++){
      const sh = shuffle(arr, mulberry32(Math.floor(s / N) * 2654435761 + hash(scale))), i = ((s % N) + N) % N;
      const recent = hist.slice(-Math.min(K, distinct - 1)).map(key), last = hist[hist.length - 1];
      // lượt 1: không lặp + khác hành động lượt trước · lượt 2: chỉ không lặp · không được thì lấy phần tử gốc
      const scan = strict => { for (let k = 0; k < N; k++){ const c = sh[(i + k) % N];
        if (K && recent.includes(key(c))) continue; if (strict && last && actionsN > 1 && c.action === last.action) continue; return c; } return null; };
      const c = scan(true) || scan(false) || sh[i];
      hist.push(c); out.push(c);
    }
    return out;
  }
  function pick(D, scale, slot){
    const list = pairs(D, scale); if (!list.length) return null;
    const b = Math.floor(slot / BLOCK), sig = scale + '|' + b + '|' + D.HOURLY.config.no_repeat_slots + '|' + list.map(p => p.action + ':' + p.who + '*' + D.HOURLY.actions[p.action].weight).join(',');
    let seq = cache.get(sig); if (!seq){ seq = sequence(D, scale, list, b, true); if (cache.size > 24) cache.clear(); cache.set(sig, seq); }
    const chosen = seq[slot - b * BLOCK];
    const out = { slot, scale, action:chosen.action, who:chosen.who, partner:null };
    if (out.action === 'gossip'){ const ps = partners(D, scale, out.who); out.partner = ps[Math.floor(mulberry32(slot * 7919 + hash(out.who))() * ps.length)]; }
    return out;
  }

  // ---------- chữ ----------
  const fill = (tpl, vars) => String(tpl || '').replace(/\{(target|partner|room)\}/g, (m, k) => vars[k] != null ? vars[k] : m);
  // câu riêng của nhân vật trước, không có thì câu chung cùng hành động + loại
  function line(D, action, kind, who, rnd = Math.random){
    const all = D.HOURLY.lines.filter(l => l.action === action && l.kind === kind);
    const own = all.filter(l => l.who && l.who === who), pool = own.length ? own : all.filter(l => !l.who);
    return pool.length ? pool[Math.floor(rnd() * pool.length)].text : '';
  }

  // ---------- tiến độ (localStorage) ----------
  const blank = () => ({ accepted:null, slots:{}, stats:{}, badges:{} });
  function load(){
    try { const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (!d || typeof d !== 'object') return blank();
      return Object.assign(blank(), d, { slots:d.slots || {}, stats:d.stats || {}, badges:d.badges || {} }); } catch (e) { return blank(); }
  }
  function save(st){
    const keys = Object.keys(st.slots).sort((a, b) => parseInt(b) - parseInt(a));
    keys.slice(KEEP_SLOTS).forEach(k => delete st.slots[k]);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
  }
  const statOf = (st, a) => st.stats[a] = Object.assign({ wins:0, flawless:0, streak:0, best_secs:null, characters:[], vs:[], fails:{} }, st.stats[a] || {});

  // Ghi một kết quả mini-game. ev = { action_id, character_id, rank, scale, slot, win, flawless, secs, fail_kind }.
  // Trả về { counted } — thắng vượt hạn mức của lượt thì không tính vào huy hiệu.
  function record(st, ev, cfg){
    const s = statOf(st, ev.action_id), sk = ev.slot + ':' + ev.scale, slot = st.slots[sk] = st.slots[sk] || { wins:0 };
    if (!ev.win){ const k = ev.fail_kind || 'lose'; s.fails[k] = (s.fails[k] || 0) + 1; s.streak = 0; return { counted:true }; }
    if (slot.wins >= (cfg.counted_wins_per_slot ?? 1)) return { counted:false };
    slot.wins++; s.wins++; if (ev.flawless) s.flawless++; s.streak++;
    if (!s.characters.includes(ev.character_id)) s.characters.push(ev.character_id);
    if (!s.vs.some(v => v.c === ev.character_id)) s.vs.push({ c:ev.character_id, rank:ev.rank });
    if (ev.secs != null && (s.best_secs == null || ev.secs < s.best_secs)) s.best_secs = Math.round(ev.secs * 10) / 10;
    return { counted:true };
  }
  function met(st, b, activeActions){
    const s = b.action ? statOf(st, b.action) : null, t = b.threshold || 1, p = b.params || {};
    switch (b.type){
      case 'wins': return s.wins >= t;
      case 'distinct_characters': return s.characters.length >= t;
      case 'flawless_wins': return s.flawless >= t;
      case 'win_streak': return s.streak >= t;
      case 'win_under_secs': return s.best_secs != null && s.best_secs <= (p.secs || 0);
      case 'win_vs': return s.vs.some(v => p.character_id ? v.c === p.character_id
        : (p.rank_min == null || v.rank >= p.rank_min) && (p.rank_max == null || v.rank <= p.rank_max));
      case 'fail_count': return (s.fails[p.fail_kind || 'lose'] || 0) >= t;
      case 'all_actions': return activeActions.length > 0 && activeActions.every(a => statOf(st, a).wins >= 1);
    }
    return false;
  }
  // Chấm lại mọi huy hiệu đang bật mà người chơi chưa có. Trả về danh sách id vừa mở.
  function evaluate(st, D){
    const H = D.HOURLY, active = ACTIONS.filter(a => H.actions[a] && H.actions[a].active), now = new Date().toISOString(), got = [];
    H.badges.forEach(b => { if (st.badges[b.id]) return; if (b.action && !H.actions[b.action]) return; if (met(st, b, active)){ st.badges[b.id] = now; got.push(b.id); } });
    return got;
  }

  window.TM_HOURLY = { ACTIONS, CONDITIONS, STORE_KEY, mulberry32, hash, shuffle, slotAt, slotEnds, slotMs, pairs, pick, whyNot, partners,
    roomOfChar, bossOf, present, quizOf, termsOf, fill, line, load, save, blank, record, evaluate, met, statOf };
})();
