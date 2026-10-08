// Team Map — loader
// Đọc 5 bảng tm_* + các thuật ngữ liên quan từ Supabase rồi ghép thành đúng cấu trúc mà engine cần
// (GROUPS, ROLES, TERMS, SCALES, LOCKED_ROLES, QUESTS, ROOM_INFO, TV_ROOMS, SMALL_REPORTS…).
// Tải lỗi / dữ liệu rỗng / dữ liệu không dựng được → dùng team-map/seed.json đóng gói kèm.
(function(){
  const SB_URL = window.SB_CONFIG.url;
  const SEED_URL = '/team-map/seed.json';
  const TIMEOUT = 5000;

  async function get(path){
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers:window.SB_CONFIG.headers(), signal:ctl.signal });
      if (!r.ok) throw new Error(`${path.split('?')[0]}: HTTP ${r.status}`);
      return r.json();
    } finally { clearTimeout(timer); }
  }

  // ---------- đọc từ Supabase ----------
  async function fetchRaw(){
    const [characters, rooms, placements, quests, steps] = await Promise.all([
      get('tm_characters?select=*&is_active=eq.true'),
      get('tm_rooms?select=*&order=sort_order'),
      get('tm_placements?select=*'),
      get('tm_quests?select=*&type=eq.main&is_active=eq.true&order=sort_order'),
      get('tm_quest_steps?select=*&order=sort_order'),
    ]);
    // cả kho thuật ngữ (vài chục dòng): dùng cho link bài, thẻ thưởng và flashcard của nhiệm vụ theo giờ
    const terms = await get('concepts?select=id,name,url,is_published,description,category_id');
    // nhiệm vụ theo giờ: DB chưa chạy migration mới thì bỏ qua, phần còn lại vẫn chạy
    let hourly = null;
    try {
      const [config, actions, lines, quiz, badges] = await Promise.all([
        get('tm_hourly_config?select=*&id=eq.1'), get('tm_hourly_actions?select=*&order=sort_order'),
        get('tm_hourly_lines?select=*&is_active=eq.true'), get('tm_quiz_questions?select=*&is_active=eq.true'),
        get('tm_badges?select=*&is_active=eq.true&order=sort_order')]);
      hourly = { config:config[0] || null, actions, lines, quiz_questions:quiz, badges };
    } catch (e) { console.warn('[Team Map] Chưa có dữ liệu nhiệm vụ theo giờ:', e.message || e); }
    return { characters, rooms, placements, quests, steps, terms, hourly };
  }

  async function fetchSeed(){
    const r = await fetch(SEED_URL);
    if (!r.ok) throw new Error('Không đọc được seed.json');
    const d = await r.json();
    return { characters:d.characters, rooms:d.rooms, placements:d.placements,
      quests:d.quests.filter(q => q.type === 'main' && q.is_active !== false), steps:d.quest_steps, terms:[], hourly:d.hourly || null };
  }

  // ---------- ghép dữ liệu ----------
  // URL bài viết của nhân vật: link ghi đè, nếu trống thì lấy URL của thuật ngữ liên kết (đã publish).
  function resolveUrl(c, termById){
    if (c.article_url) return c.article_url;
    const t = c.term_id != null ? termById[String(c.term_id)] : null;
    return t && t.url && t.is_published !== false ? t.url : null;
  }

  // Trang /en/team-map: lấy bản dịch trong cột i18n.en, ô nào chưa dịch thì dùng tiếng Việt.
  const tr = (row, field) => {
    const en = window.TM_LANG === 'en' && row.i18n && row.i18n.en;
    return en && typeof en[field] === 'string' && en[field].trim() ? en[field] : row[field];
  };

  function build(raw){
    const L = window.TM_LAYOUT, warn = [];
    const termById = {}; (raw.terms || []).forEach(t => { termById[String(t.id)] = t; });
    const chars = raw.characters.filter(c => c.is_active !== false);
    const byId = Object.fromEntries(chars.map(c => [c.id, c]));

    // Báo cáo cho ai theo quy mô. small: chỉ ghi đè khi có giá trị (trống thì dùng reports_to);
    // agency: luôn dùng cột riêng (trống = không báo cáo cho ai). large: reports_to.
    const ROLES = {}, SCALE_REPORTS = { small:{}, agency:{} };
    chars.forEach(c => {
      const url = resolveUrl(c, termById), ap = c.appearance || {};
      const ctaEn = window.TM_LANG === 'en' && c.i18n && c.i18n.en && Array.isArray(c.i18n.en.cta) ? c.i18n.en.cta : [];
      const links = (c.cta || []).map((b, i) => b && b.url ? { label:(typeof ctaEn[i] === 'string' && ctaEn[i].trim()) || b.label || b.url, url:b.url, primary:!!b.primary } : null).filter(Boolean);
      const r = { id:c.id, title:tr(c, 'title'), group:L.groups[c.group] ? c.group : 'business', url, status: url ? 'pub' : 'todo',
        props:(c.props || []).filter(p => L.props.includes(p)), summary:tr(c, 'summary') || '', doing:tr(c, 'doing') || '', withDesigner:tr(c, 'with_designer') || '',
        reportsTo: byId[c.reports_to] ? c.reports_to : null, kind:c.kind || 'role',
        // nhiệm vụ theo giờ
        rank: c.rank >= 1 && c.rank <= 8 ? c.rank : 2, relatedTerms:(c.related_term_ids || []).map(String),
        gossipPartners: Array.isArray(c.gossip_partner_ids) && c.gossip_partner_ids.length ? c.gossip_partner_ids : null,
        hourlyExclude: Array.isArray(c.hourly_exclude) ? c.hourly_exclude : [] };
      if (ap.dark) r.dark = true;
      if (ap.outfit) r.outfit = ap.outfit;
      if (/^#[0-9a-f]{6}$/i.test(ap.body_color || '')) r.bodyColor = ap.body_color;
      if (/^#[0-9a-f]{6}$/i.test(ap.outline_color || '')) r.outlineColor = ap.outline_color;
      if (c.kind === 'author') r.special = { tag:tr(c, 'tag') || '', links };
      if (c.kind === 'guest') r.guest = { tag:tr(c, 'tag') || '', links };
      ROLES[c.id] = r;
      if (c.reports_to_small && byId[c.reports_to_small]) SCALE_REPORTS.small[c.id] = c.reports_to_small;
      SCALE_REPORTS.agency[c.id] = c.reports_to_agency && byId[c.reports_to_agency] ? c.reports_to_agency : null;
    });
    const find = k => chars.find(c => c.kind === k);
    const player = find('player'), author = find('author'), guest = find('guest');
    if (!player) throw new Error('Thiếu nhân vật chính (kind = player)');

    // phòng: hình học trong code + nội dung trong tm_rooms + members theo tm_placements
    const roomRow = Object.fromEntries(raw.rooms.map(r => [r.id, r]));
    const placements = raw.placements.filter(p => byId[p.character_id]);
    const pids = new Set();
    const SCALES = {}, ROOM_INFO = {}, TV_ROOMS = {};
    for (const [scale, meta] of Object.entries(L.scales)){
      const rooms = L.rooms.filter(g => g.scale === scale).map(g => {
        const row = roomRow[g.id] || {};
        if (!roomRow[g.id]) warn.push(`Phòng ${g.id} chưa có trong tm_rooms`);
        if (row.intro) ROOM_INFO[g.id] = tr(row, 'intro');
        if (g.tv !== undefined) TV_ROOMS[g.id] = g.tv;
        const here = placements.filter(p => p.room_id === g.id);
        here.forEach(p => pids.add(p.id));
        const seated = g.kind === 'locked' ? [] : here
          .filter(p => ['role','player'].includes(byId[p.character_id].kind))
          .sort((a, b) => (a.seat_order ?? 1e9) - (b.seat_order ?? 1e9) || a.character_id.localeCompare(b.character_id));
        const members = seated.map(p => p.character_id), fixed = seated.filter(p => p.fixed).map(p => p.character_id);
        const r = { id:g.id, code:(row.code != null ? tr(row, 'code') : null) ?? g.id, name:tr(row, 'name') || g.id, x:g.x, z:g.z, w:g.w, d:g.d, kind:g.kind, floor:g.floor, members, fixed };
        if (g.doors) r.doors = g.doors;
        return r;
      });
      // quy mô chưa có dữ liệu (vd DB chưa chạy seed agency) → ẩn quy mô đó thay vì làm hỏng cả trang
      const seats = rooms.filter(r => r.members.includes(player.id)).length;
      if (seats !== 1){ warn.push(`Bỏ qua quy mô ${scale}: nhân vật chính có ${seats} chỗ ngồi (cần đúng 1)`); continue; }
      SCALES[scale] = { name:meta.name, rooms };
    }
    if (!SCALES.small && !SCALES.large) throw new Error('Không dựng được quy mô nào: thiếu chỗ ngồi của nhân vật chính');

    // "Phòng ban khác": role đang bật, có ghế ở quy mô lớn nhưng không có ở quy mô nhỏ
    const seatedIn = s => new Set(placements.filter(p => p.scale === s || (roomRow[p.room_id] || {}).scale === s).map(p => p.character_id));
    const inSmall = seatedIn('small'), inLarge = seatedIn('large');
    const LOCKED_ROLES = chars.filter(c => (c.kind || 'role') === 'role' && inLarge.has(c.id) && !inSmall.has(c.id)).map(c => c.id);

    // nhiệm vụ
    const TERMS = {};
    const stepsByQuest = {};
    (raw.steps || []).forEach(s => (stepsByQuest[s.quest_id] = stepsByQuest[s.quest_id] || []).push(s));
    const refOk = (ref, scale) => !!ref && pids.has(ref) && (roomRow[ref.split('@')[1]] || L.rooms.find(g => g.id === ref.split('@')[1]) || {}).scale === scale;
    const QUESTS = Object.fromEntries(Object.keys(SCALES).map(k => [k, []]));
    raw.quests.filter(q => (q.type || 'main') === 'main' && q.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .forEach(q => {
        const bad = [];
        if (!QUESTS[q.scale]) bad.push('quy mô');
        if (!SCALES[q.scale] || !SCALES[q.scale].rooms.find(r => r.id === q.room_id)) bad.push('phòng ' + q.room_id);
        if (!refOk(q.giver, q.scale)) bad.push('người giao ' + q.giver);
        (q.gather || []).forEach(g => { if (!refOk(g, q.scale)) bad.push('người tham gia ' + g); });
        const steps = (stepsByQuest[q.id] || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(s => {
          if (s.type === 'talk'){ if (!refOk(s.target, q.scale)) bad.push('bước ' + s.id + ' → ' + s.target); return { who:s.target, task:tr(s, 'task_text') || '', line:tr(s, 'line_text') || '' }; }
          if (s.type === 'present' && TV_ROOMS[q.room_id] === undefined) bad.push('bước present ở phòng không có TV');
          return { type:s.type, task:tr(s, 'task_text') || '', secs: s.secs != null ? Number(s.secs) : 5, line:tr(s, 'line_text') || '' };
        });
        if (bad.length){ warn.push(`Bỏ qua nhiệm vụ ${q.id} (${q.title}): ${bad.join(', ')}`); return; }
        const rewards = [];
        (q.rewards || []).forEach(r => {
          if (r.type === 'character'){ if (ROLES[r.id]) rewards.push(r.id); return; }
          if (r.type === 'term'){
            const t = r.term_id != null ? termById[String(r.term_id)] : null;
            const name = t ? t.name : r.name, url = t ? (t.is_published !== false ? t.url : null) : r.url;
            if (!name) return;
            TERMS[name] = url || null; rewards.push(name);
          }
        });
        QUESTS[q.scale].push({ id:q.id, title:tr(q, 'title'), room:q.room_id, giver:q.giver, gather:q.gather || [], offer:tr(q, 'offer_text') || '', done:tr(q, 'done_text') || '', steps, rewards });
      });

    // vị trí của từng nhân vật theo quy mô (kể cả khách, tác giả): { scale: { charId: [roomId, ...] } }, sắp theo id vị trí
    const PLACE = Object.fromEntries(Object.keys(SCALES).map(k => [k, {}]));
    placements.slice().sort((a, b) => a.id.localeCompare(b.id)).forEach(p => {
      const sc = (roomRow[p.room_id] || L.rooms.find(g => g.id === p.room_id) || {}).scale;
      if (PLACE[sc]) (PLACE[sc][p.character_id] = PLACE[sc][p.character_id] || []).push(p.room_id); });
    const HOURLY = buildHourly(raw.hourly, termById, warn);

    return { data:{ GROUPS:L.groups, ROLES, TERMS, SCALES, LOCKED_ROLES, QUESTS, ROOM_INFO, TV_ROOMS, SCALE_REPORTS, DOTTED:L.dotted,
      SCREEN_KIND:L.screenKind, PLAYER_ID:player.id, AUTHOR_ID:author ? author.id : null, GUEST_ID:guest ? guest.id : null, PLACE, HOURLY }, warn };
  }

  // Nhiệm vụ theo giờ: cấu hình, 8 hành động, lời thoại, câu hỏi, huy hiệu (đã chọn ngôn ngữ) + kho thuật ngữ cho flashcard
  function buildHourly(h, termById, warn){
    if (!h || !h.actions || !h.actions.length) return null;
    const cfg = Object.assign({ slot_minutes:30, open_count:4, is_enabled:true }, h.config || {});
    const trOpts = q => { const en = window.TM_LANG === 'en' && q.i18n && q.i18n.en && q.i18n.en.options;
      return Array.isArray(en) && en.length === 3 && en.every(x => typeof x === 'string' && x.trim()) ? en : q.options; };
    const actions = {};
    h.actions.forEach(a => { actions[a.id] = { id:a.id, sort:a.sort_order || 0, name:tr(a, 'name'), title:tr(a, 'title_template') || '',
      offer:tr(a, 'offer_text') || '', win:tr(a, 'win_text') || '', lose:tr(a, 'lose_text') || '', weight:Math.max(1, a.weight || 1),
      config:a.config || {}, active:a.is_active !== false }; });
    const terms = {};
    Object.values(termById).forEach(t => { if (t.is_published !== false && t.name) terms[String(t.id)] = { id:String(t.id), name:t.name, desc:t.description || '', cat:t.category_id ?? null, url:t.url || null }; });
    if (!Object.keys(terms).length) warn.push('Nhiệm vụ theo giờ: không đọc được kho thuật ngữ, bỏ hành động đọc bài / flashcard');
    return { config:cfg, actions,
      lines:(h.lines || []).filter(l => l.is_active !== false).map(l => ({ id:l.id, action:l.action_id, kind:l.kind, who:l.character_id || null, text:tr(l, 'text') || '' })),
      quiz:(h.quiz_questions || []).filter(q => q.is_active !== false && Array.isArray(q.options) && q.options.length === 3)
        .map(q => ({ id:q.id, who:q.character_id, q:tr(q, 'question') || '', options:trOpts(q), correct:q.correct_index })),
      badges:(h.badges || []).filter(b => b.is_active !== false).map(b => ({ id:b.id, sort:b.sort_order || 0, name:tr(b, 'name') || b.id, desc:tr(b, 'description') || '',
        image:b.image_url || null, rim:/^#[0-9a-f]{6}$/i.test(b.rim_color || '') ? b.rim_color : '#FFC53D', type:b.condition_type, action:b.action_id || null,
        threshold:b.threshold, params:b.params || {}, hidden:b.is_hidden !== false, reward:{ status:b.reward_status || 'none', title:b.reward_title, note:b.reward_note, url:b.reward_url } })),
      terms };
  }

  // Trang Hành trình (/hanh-trinh-ui-ux): các trạm để dựng lại hình thái của người chơi khi sang Team Map.
  // Tải song song, lỗi thì dùng seed-journey.json; không ảnh hưởng phần còn lại của Team Map.
  async function loadJourney(){
    let checkpoints = null;
    try { const d = await get('tm_journey_checkpoints?select=id,kind,sort_order,branch_after,form_title,form_props,is_active&order=sort_order'); if (Array.isArray(d) && d.length) checkpoints = d; } catch (e) {}
    let combos = [];
    try { const r = await fetch('/team-map/seed-journey.json'); if (r.ok){ const s = await r.json(); combos = s.branch_combos || []; if (!checkpoints) checkpoints = s.checkpoints; } } catch (e) {}
    return checkpoints ? { checkpoints, combos } : null;
  }

  async function load(){
    const journey = loadJourney();
    let source = 'supabase', out;
    try {
      const raw = await fetchRaw();
      if (!raw.characters.length || !raw.rooms.length) throw new Error('Dữ liệu Team Map trong Supabase đang rỗng');
      out = build(raw);
    } catch (e) {
      console.warn('[Team Map] Không dùng được dữ liệu Supabase, chuyển sang seed.json dự phòng:', e.message || e);
      source = 'seed';
      out = build(await fetchSeed());
    }
    out.warn.forEach(w => console.warn('[Team Map]', w));
    out.data.SOURCE = source;
    out.data.JOURNEY = await journey.catch(() => null);
    return out.data;
  }

  window.TeamMapLoader = { load, build, resolveUrl };
})();
