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
    const ids = new Set();
    characters.forEach(c => { if (c.term_id != null) ids.add(String(c.term_id)); });
    quests.forEach(q => (q.rewards || []).forEach(r => { if (r.type === 'term' && r.term_id != null) ids.add(String(r.term_id)); }));
    const terms = ids.size ? await get(`concepts?select=id,name,url,is_published&id=in.(${[...ids].map(encodeURIComponent).join(',')})`) : [];
    return { characters, rooms, placements, quests, steps, terms };
  }

  async function fetchSeed(){
    const r = await fetch(SEED_URL);
    if (!r.ok) throw new Error('Không đọc được seed.json');
    const d = await r.json();
    return { characters:d.characters, rooms:d.rooms, placements:d.placements,
      quests:d.quests.filter(q => q.type === 'main' && q.is_active !== false), steps:d.quest_steps, terms:[] };
  }

  // ---------- ghép dữ liệu ----------
  // URL bài viết của nhân vật: link ghi đè, nếu trống thì lấy URL của thuật ngữ liên kết (đã publish).
  function resolveUrl(c, termById){
    if (c.article_url) return c.article_url;
    const t = c.term_id != null ? termById[String(c.term_id)] : null;
    return t && t.url && t.is_published !== false ? t.url : null;
  }

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
      const links = (c.cta || []).filter(b => b && b.url).map(b => ({ label:b.label || b.url, url:b.url, primary:!!b.primary }));
      const r = { id:c.id, title:c.title, group:L.groups[c.group] ? c.group : 'business', url, status: url ? 'pub' : 'todo',
        props:(c.props || []).filter(p => L.props.includes(p)), summary:c.summary || '', doing:c.doing || '', withDesigner:c.with_designer || '',
        reportsTo: byId[c.reports_to] ? c.reports_to : null, kind:c.kind || 'role' };
      if (ap.dark) r.dark = true;
      if (ap.outfit) r.outfit = ap.outfit;
      if (/^#[0-9a-f]{6}$/i.test(ap.body_color || '')) r.bodyColor = ap.body_color;
      if (/^#[0-9a-f]{6}$/i.test(ap.outline_color || '')) r.outlineColor = ap.outline_color;
      if (c.kind === 'author') r.special = { tag:c.tag || '', links };
      if (c.kind === 'guest') r.guest = { tag:c.tag || '', links };
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
        if (row.intro) ROOM_INFO[g.id] = row.intro;
        if (g.tv !== undefined) TV_ROOMS[g.id] = g.tv;
        const here = placements.filter(p => p.room_id === g.id);
        here.forEach(p => pids.add(p.id));
        const seated = g.kind === 'locked' ? [] : here
          .filter(p => ['role','player'].includes(byId[p.character_id].kind))
          .sort((a, b) => (a.seat_order ?? 1e9) - (b.seat_order ?? 1e9) || a.character_id.localeCompare(b.character_id));
        const members = seated.map(p => p.character_id), fixed = seated.filter(p => p.fixed).map(p => p.character_id);
        const r = { id:g.id, code:row.code ?? g.id, name:row.name || g.id, x:g.x, z:g.z, w:g.w, d:g.d, kind:g.kind, floor:g.floor, members, fixed };
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
          if (s.type === 'talk'){ if (!refOk(s.target, q.scale)) bad.push('bước ' + s.id + ' → ' + s.target); return { who:s.target, task:s.task_text || '', line:s.line_text || '' }; }
          if (s.type === 'present' && TV_ROOMS[q.room_id] === undefined) bad.push('bước present ở phòng không có TV');
          return { type:s.type, task:s.task_text || '', secs: s.secs != null ? Number(s.secs) : 5, line:s.line_text || '' };
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
        QUESTS[q.scale].push({ id:q.id, title:q.title, room:q.room_id, giver:q.giver, gather:q.gather || [], offer:q.offer_text || '', done:q.done_text || '', steps, rewards });
      });

    return { data:{ GROUPS:L.groups, ROLES, TERMS, SCALES, LOCKED_ROLES, QUESTS, ROOM_INFO, TV_ROOMS, SCALE_REPORTS, DOTTED:L.dotted,
      SCREEN_KIND:L.screenKind, PLAYER_ID:player.id, AUTHOR_ID:author ? author.id : null, GUEST_ID:guest ? guest.id : null }, warn };
  }

  async function load(){
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
    return out.data;
  }

  window.TeamMapLoader = { load, build, resolveUrl };
})();
