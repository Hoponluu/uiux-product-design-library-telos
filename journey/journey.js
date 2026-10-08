// Trang Hành trình UI/UX — game 3D (Three.js r128). docs/SPEC-journey.md mục 5.
// Nhân vật dựng bằng team-map.mascot.js (chung với Team Map), hình thái tính bằng journey.form.js.
// Dữ liệu: nhúng sẵn trong trang (#jx-data, render phía server) rồi tải lại bản mới nhất từ Supabase.
(function(){
'use strict';
const $ = s => document.querySelector(s);
const html = document.documentElement;
const BOOT = (() => { try { return JSON.parse($('#jx-data').textContent); } catch (e) { return null; } })();
const route = $('#jx-route');
const track = (name, p = {}) => { try { if (typeof window.gtag === 'function') window.gtag('event', name, p); } catch (e) {} };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EMBED = !!(BOOT && BOOT.embed);
const COURSE_SAFE = u => /^https?:\/\//i.test(String(u || '')) ? u : null;

// Nút "Bỏ qua game" luôn chạy được
$('#jx-skip') && $('#jx-skip').addEventListener('click', () => { track('journey_skip_game'); route.scrollIntoView({ behavior:reduce ? 'auto' : 'smooth' }); });

// ---------- WebGL? không có thì chỉ hiện phần chữ, không báo lỗi ----------
function hasGL(){
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; }
}
if (!BOOT || !window.THREE || !window.TM_MASCOT || !window.TM_JOURNEY || !hasGL()){ html.classList.add('jx-nogl'); return; }
const M = window.TM_MASCOT, JF = window.TM_JOURNEY;

// ---------- tiến độ ----------
let ST = JF.read();
if (!ST.visited.includes('start')) ST.visited.unshift('start');
const save = () => JF.write(ST);

// ---------- dữ liệu ----------
let CPS = BOOT.checkpoints, BY = {};
const COMBOS = BOOT.combos || [];
let WORK = (BOOT.settings && BOOT.settings.workplaces) || [];
const index = () => { BY = {}; CPS.forEach(c => { BY[c.id] = c; }); };
index();
const mains = () => CPS.filter(c => c.kind === 'main').sort((a, b) => a.sort_order - b.sort_order);
const activeBranch = id => BY[id] && BY[id].kind === 'branch' && BY[id].is_active !== false;
async function fresh(){
  const C = window.SB_CONFIG; if (!C) return;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3000);
  try {
    const h = C.headers ? C.headers() : { apikey:C.key };
    const [a, b] = await Promise.all([fetch(`${C.url}/rest/v1/tm_journey_checkpoints?select=*&order=sort_order`, { headers:h, signal:ctl.signal }),
      fetch(`${C.url}/rest/v1/tm_journey_settings?select=workplaces&id=eq.1`, { headers:h, signal:ctl.signal })]);
    if (a.ok){ const d = await a.json(); if (Array.isArray(d) && d.length >= 8) { CPS = d; index(); } }
    if (b.ok){ const d = await b.json(); if (d && d[0] && Array.isArray(d[0].workplaces) && d[0].workplaces.length) WORK = d[0].workplaces; }
  } catch (e) {} finally { clearTimeout(t); }
}

// ---------- bản đồ (hình học cố định trong code, không sửa từ CMS) ----------
const W = 2.4;                    // bề rộng đường
const MAIN = [[-19,0],[16,0],[16,9],[-16,9],[-16,18],[13.2,18]];
const LOOPS = { web:[[2.5,0],[3.6,-5],[9.4,-5],[10.5,0]], code:[[-2.5,9],[-3.6,13.6],[-12.4,13.6],[-13.5,9]] };
// vị trí trạm + hướng đi tới trạm
const POS = { start:[-15,0,1,0], figma:[-8,0,1,0], ui:[-1,0,1,0], web:[6.5,-5,1,0], ux:[9,9,-1,0], ds:[1,9,-1,0], code:[-8,13.6,-1,0], ai:[-9,18,1,0], pdm:[1,18,1,0], finish:[10.6,18,1,0] };
const HOME = [-21,0], OFFICE = [16.4,18], DOOR = [13.6,18];
const JUNCTIONS = [{ at:[2.5,0], branch:'web', after:'ui', side:1 }, { at:[-2.5,9], branch:'code', after:'ds', side:-1 }];
const B = { x0:-26, x1:24, z0:-11, z1:25 };

// ---------- khung ----------
const host = $('#jx-game'), canvas = $('#jx-canvas'), labelsEl = $('#jx-labels'), sheet = $('#jx-sheet'), hud = $('#jx-hud');
let renderer, scene, camera, sun, ground, roads = [], started = false, visible = true, ratio = 1, engagedAt = 0, raf = 0;
const dark = () => document.body.classList.contains('dark');
const smallScreen = () => innerWidth < 760;

function init(){
  if (started) return; started = true;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias:true }); }
  catch (e) { html.classList.add('jx-nogl'); return; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = !smallScreen(); renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, .1, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa79cd0, .66));
  sun = new THREE.DirectionalLight(0xffffff, .55); sun.position.set(12, 30, 16); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left:-34, right:34, top:28, bottom:-28, near:1, far:80 }); scene.add(sun, sun.target); sun.target.position.set(-1, 0, 8);
  fresh().then(() => { buildWorld(); buildPlayer(); bindInput(); refresh(); resize(); loop(); document.querySelectorAll('.jx-fly').forEach(b => b.hidden = false);
    const ld = $('#jx-loading'); ld.classList.add('done'); setTimeout(() => ld.remove(), 450); });
}

// ---------- vật liệu & tiện ích ----------
const { mat, box, cyl } = M;
function signTex(lines, bg = '#FFFFFF', fg = '#1C1033', accent = '#E92F7C'){
  const S = 512, H = 128, c = document.createElement('canvas'); c.width = S; c.height = H; const g = c.getContext('2d');
  { g.fillStyle = bg; g.fillRect(0, 0, S, H); g.fillStyle = accent; g.fillRect(0, H - 10, S, 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (t, px, w) => { let s = px; g.font = `700 ${s}px -apple-system, "Segoe UI", sans-serif`; while (g.measureText(t).width > w && s > 14){ s -= 2; g.font = `700 ${s}px -apple-system, "Segoe UI", sans-serif`; } };
    if (lines[1]){ fit(lines[0], 44, S - 40); g.fillText(lines[0], S / 2, H * .38); g.globalAlpha = .65; fit(lines[1], 26, S - 40); g.font = g.font.replace('700', '500'); g.fillText(lines[1], S / 2, H * .74); g.globalAlpha = 1; }
    else { fit(lines[0], 46, S - 40); g.fillText(lines[0], S / 2, H * .5); } }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function planeTex(t, w, h){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map:t, transparent:true })); return m; }
// biển luôn quay về phía camera (đọc được ở mọi góc xoay)
function sprite(t, w, h){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:t, depthWrite:false })); sp.scale.set(w, h, 1); return sp; }
function segDist(px, pz, a, b){ const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz; let t = L ? ((px - a[0]) * dx + (pz - a[1]) * dz) / L : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + dx * t, z = a[1] + dz * t; return Math.hypot(px - x, pz - z); }
function polyDist(px, pz, P){ let d = 1e9; for (let i = 0; i < P.length - 1; i++) d = Math.min(d, segDist(px, pz, P[i], P[i + 1])); return d; }
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- dựng thế giới ----------
const stations = {};   // id → { ring, gate, bar, signMesh, x, z, dx, dz }
let doorMesh, doorGlow, groundMat, roadMat, edgeMat;
function roadPath(P, group){
  for (let i = 0; i < P.length - 1; i++){ const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az), a = Math.atan2(bx - ax, bz - az);
    const s = new THREE.Mesh(new THREE.BoxGeometry(W, .06, L), roadMat); s.position.set((ax + bx) / 2, .03, (az + bz) / 2); s.rotation.y = a; s.receiveShadow = true; group.add(s);
    [-1, 1].forEach(k => { const e = new THREE.Mesh(new THREE.BoxGeometry(.14, .08, L), edgeMat); e.position.set((ax + bx) / 2 + Math.cos(a) * k * W / 2, .04, (az + bz) / 2 - Math.sin(a) * k * W / 2); e.rotation.y = a; group.add(e); });
    for (let d = 1; d < L - .5; d += 1.6){ const t = d / L, dash = new THREE.Mesh(new THREE.BoxGeometry(.1, .065, .7), mat('#FFFFFF')); dash.position.set(ax + (bx - ax) * t, .04, az + (bz - az) * t); dash.rotation.y = a; group.add(dash); } }
  P.forEach(([x, z]) => { const j = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2, .06, 28), roadMat); j.position.set(x, .031, z); j.receiveShadow = true; group.add(j); });
}
function tree(x, z){ const g = new THREE.Group(); const t = cyl(.12, .16, .8, '#8A6A4A', 8); t.position.y = .4; g.add(t);
  const c = new THREE.Mesh(new THREE.ConeGeometry(.7 + rnd() * .3, 1.5 + rnd() * .5, 8), mat(['#5FC28E', '#4DB37E', '#7ACB9A'][Math.floor(rnd() * 3)])); c.position.y = 1.5; c.castShadow = true; g.add(c);
  g.position.set(x, 0, z); g.scale.setScalar(.5 + rnd() * .3); scene.add(g); }
function lamp(x, z){ const g = new THREE.Group(); const p = cyl(.05, .07, 2.2, '#3B2F86', 8); p.position.y = 1.1; g.add(p); const arm = box(.5, .05, .05, '#3B2F86'); arm.position.set(.22, 2.2, 0); g.add(arm);
  const bulb = new THREE.Mesh(M.G.sphereLo, new THREE.MeshBasicMaterial({ color:'#FFE58A' })); bulb.scale.setScalar(.12); bulb.position.set(.44, 2.1, 0); g.add(bulb); g.position.set(x, 0, z); scene.add(g); return g; }
function house(){ const g = new THREE.Group(); const b = box(3.2, 2.2, 3, '#FFFFFF'); b.position.y = 1.1; g.add(b);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 4), mat('#E92F7C')); roof.position.y = 3; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  const door = box(.8, 1.3, .06, '#3B2F86'); door.position.set(1.62, .65, 0); door.rotation.y = Math.PI / 2; g.add(door);
  const win = box(.06, .6, .7, '#9FE3F2'); win.position.set(1.62, 1.4, -.9); g.add(win);
  g.position.set(HOME[0] - 1.2, 0, HOME[1]); scene.add(g); }
function office(){ const g = new THREE.Group(); const [ox, oz] = OFFICE; const b = box(5, 5.2, 6, '#FFFFFF'); b.position.set(0, 2.6, 0); g.add(b);
  const band = box(5.06, .5, 6.06, '#241775'); band.position.y = 5; g.add(band);
  for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) if (!(r === 0 && Math.abs(c) <= 0)) { const w = box(.06, .8, .7, '#9FE3F2'); w.position.set(-2.53, 1.3 + r * 1.3, c * 1.15); g.add(w); }
  const sign = planeTex(signTex(['TELOS · Product Co.'], '#241775', '#FFFFFF', '#35C6E8'), 3.6, .9); sign.position.set(-2.56, 4.1, 0); sign.rotation.y = -Math.PI / 2; g.add(sign);
  doorMesh = box(.08, 1.8, 1.3, '#E92F7C'); doorMesh.position.set(-2.55, .9, 0); g.add(doorMesh);
  doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.3), new THREE.MeshBasicMaterial({ color:'#FFE58A', transparent:true, opacity:0, depthWrite:false })); doorGlow.position.set(-2.62, 1.05, 0); doorGlow.rotation.y = -Math.PI / 2; g.add(doorGlow);
  g.position.set(ox, 0, oz); scene.add(g); doorMesh.userData.door = true; }
function station(id){
  const c = BY[id], p = POS[id]; if (!c || !p) return;
  const [x, z, dx, dz] = p, kind = c.kind, col = kind === 'branch' ? '#35C6E8' : kind === 'start' ? '#FFC53D' : kind === 'finish' ? '#241775' : '#E92F7C';
  const g = new THREE.Group(); scene.add(g);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.95, 1.25, 40), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:.85, depthWrite:false })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, .075, z); g.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(.95, 40), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:.14, depthWrite:false })); fill.rotation.x = -Math.PI / 2; fill.position.set(x, .072, z); g.add(fill);
  const S = { id, x, z, dx, dz, ring, fill, group:g };
  if (kind === 'main' || kind === 'branch'){
    // cổng chữ U ngay trước trạm, có biển tên
    const gx = x - dx * 2.4, gz = z - dz * 2.4, px = -dz, pz = dx, a = Math.atan2(dx, dz);
    [-1, 1].forEach(k => { const post = cyl(.1, .1, 2.6, kind === 'branch' ? '#1A8FB0' : '#3B2F86', 10); post.position.set(gx + px * k * (W / 2 + .25), 1.3, gz + pz * k * (W / 2 + .25)); g.add(post); });
    const beam = box(W + .9, .16, .16, kind === 'branch' ? '#1A8FB0' : '#3B2F86'); beam.position.set(gx, 2.6, gz); beam.rotation.y = a; g.add(beam);
    const sm = sprite(signTex([c.name, c.course_title ? c.course_title.replace(/^Khóa Học /i, '') : '']), 3.2, .8); sm.position.set(gx, 3.15, gz); g.add(sm);
    const bar = box(W + .3, .12, .12, '#E92F7C'); bar.position.set(gx, .95, gz); bar.rotation.y = a; g.add(bar);
    const stripes = []; for (let k = -2; k <= 2; k++){ const st = box(.22, .125, .125, '#FFFFFF'); st.position.set(gx + px * k * .5, .95, gz + pz * k * .5); st.rotation.y = a; g.add(st); stripes.push(st); }
    // bục nhỏ ghi số buổi
    if (c.sessions){ const pod = box(.9, .5, .6, '#FFFFFF'); pod.position.set(x + px * 2.1, .25, z + pz * 2.1); pod.rotation.y = a; g.add(pod);
      const t = sprite(signTex([`${c.sessions} buổi`], '#FFFFFF', '#241775', col), 1.1, .28); t.position.set(x + px * 2.1, .85, z + pz * 2.1); g.add(t); }
    Object.assign(S, { gx, gz, px, pz, a, bar, stripes, sm, closedTex:signTex(['🔒 Ghé trạm trước đã', c.name], '#FFF1F5', '#B0154F', '#E92F7C'), openTex:sm.material.map });
  }
  stations[id] = S;
}
function junction(j){
  if (!activeBranch(j.branch)) return;
  const [x, z] = j.at, g = new THREE.Group(); const post = cyl(.06, .06, 2.3, '#5B5270', 8); post.position.y = 1.15; g.add(post);
  const t1 = sprite(signTex([`Rẽ: ${BY[j.branch].course_title ? BY[j.branch].course_title.replace(/^Khóa Học /i, '') : BY[j.branch].name}`, 'Nhánh tuỳ chọn'], '#E9F9FD', '#0B5F78', '#35C6E8'), 2.6, .65); t1.position.set(0, 2.55, 0); g.add(t1);
  const t2 = sprite(signTex(['Đường chính'], '#FFFFFF', '#241775', '#E92F7C'), 2.0, .5); t2.position.set(0, 1.85, 0); g.add(t2);
  g.position.set(x, 0, z + j.side * (W / 2 + .6)); scene.add(g);
}
function buildWorld(){
  groundMat = new THREE.MeshLambertMaterial({ color:'#9ED6B0' }); roadMat = new THREE.MeshLambertMaterial({ color:'#F4F0FB' }); edgeMat = new THREE.MeshLambertMaterial({ color:'#C9BEEA' });
  ground = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0 + 30, B.z1 - B.z0 + 30), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2); ground.receiveShadow = true; scene.add(ground);
  const rg = new THREE.Group(); scene.add(rg); roadPath(MAIN, rg);
  Object.entries(LOOPS).forEach(([id, P]) => { if (activeBranch(id)) roadPath(P, rg); });
  house(); office();
  Object.keys(POS).forEach(id => { if (BY[id] && (BY[id].kind !== 'branch' || activeBranch(id))) station(id); });
  JUNCTIONS.forEach(junction);
  // cây + đèn đường, tránh đường và trạm
  const allPaths = [MAIN].concat(Object.entries(LOOPS).filter(([id]) => activeBranch(id)).map(([, P]) => P));
  const near = (x, z, r) => allPaths.some(P => polyDist(x, z, P) < r) || Object.values(stations).some(s => Math.hypot(x - s.x, z - s.z) < r + 1.2) || Math.hypot(x - OFFICE[0], z - OFFICE[1]) < 5 || Math.hypot(x - HOME[0] + 1.2, z - HOME[1]) < 3.4;
  seed = 7; for (let i = 0; i < 300; i++){ const x = B.x0 + rnd() * (B.x1 - B.x0), z = B.z0 + rnd() * (B.z1 - B.z0); if (!near(x, z, 3.1)) tree(x, z); }
  for (let i = 0; i < MAIN.length - 1; i++){ const [ax, az] = MAIN[i], [bx, bz] = MAIN[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let d = 3; d < L - 2; d += 7){ const x = ax + (bx - ax) * d / L + nx * (W / 2 + .7), z = az + (bz - az) * d / L + nz * (W / 2 + .7); if (!Object.values(stations).some(s => Math.hypot(x - s.x, z - s.z) < 2.8 || (s.gx != null && Math.hypot(x - s.gx, z - s.gz) < 2))) lamp(x, z).rotation.y = Math.atan2(-nx, -nz) + Math.PI / 2; } }
  buildGrid(); applyTheme();
}
function applyTheme(){
  const d = dark();
  scene.background = new THREE.Color(d ? '#14112B' : '#EEE9F8');
  groundMat.color.set(d ? '#1E3A35' : '#9ED6B0'); roadMat.color.set(d ? '#2B2754' : '#F4F0FB'); edgeMat.color.set(d ? '#4A4290' : '#C9BEEA');
}
window.addEventListener('jx-theme', () => scene && applyTheme());

// ---------- lưới tìm đường ----------
const CS = .5; let grid = null;
function buildGrid(){
  const cols = Math.ceil((B.x1 - B.x0) / CS), rows = Math.ceil((B.z1 - B.z0) / CS), walk = new Uint8Array(cols * rows);
  const paths = [MAIN].concat(Object.entries(LOOPS).filter(([id]) => activeBranch(id)).map(([, P]) => P));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++){ const x = B.x0 + (c + .5) * CS, z = B.z0 + (r + .5) * CS;
    let ok = paths.some(P => polyDist(x, z, P) <= W / 2 - .2) || Object.values(stations).some(s => Math.hypot(x - s.x, z - s.z) < 1.3);
    if (x > DOOR[0] + .3 && Math.abs(z - DOOR[1]) < 4) ok = false;   // không đi xuyên tường văn phòng
    walk[r * cols + c] = ok ? 1 : 0; }
  grid = { cols, rows, walk, gate:new Uint8Array(cols * rows) };
  gatesToGrid();
}
const cellOf = (x, z) => [Math.floor((x - B.x0) / CS), Math.floor((z - B.z0) / CS)];
const cellXZ = (c, r) => [B.x0 + (c + .5) * CS, B.z0 + (r + .5) * CS];
const freeCell = (c, r) => c >= 0 && r >= 0 && c < grid.cols && r < grid.rows && grid.walk[r * grid.cols + c] && !grid.gate[r * grid.cols + c];
const freeXZ = (x, z) => { const [c, r] = cellOf(x, z); return freeCell(c, r); };
function gatesToGrid(){
  grid.gate.fill(0);
  Object.values(stations).forEach(s => { if (s.gx == null || gateOpen(s.id)) return;
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++){ const [x, z] = cellXZ(c, r), ax = x - s.gx, az = z - s.gz;
      const along = ax * s.dx + az * s.dz, across = ax * s.px + az * s.pz; if (Math.abs(along) <= .55 && Math.abs(across) <= W / 2 + .4) grid.gate[r * grid.cols + c] = 1; } });
}
function nearestFree(x, z){
  const [c0, r0] = cellOf(x, z); if (freeCell(c0, r0)) return [c0, r0];
  for (let rad = 1; rad < 14; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++){ if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue; if (freeCell(c0 + dc, r0 + dr)) return [c0 + dc, r0 + dr]; }
  return null;
}
function astar(from, to){
  const N = grid.cols * grid.rows, key = (c, r) => r * grid.cols + c, g = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const open = [[0, key(...from)]]; g[key(...from)] = 0; const goal = key(...to), [tc, tr] = to;
  while (open.length){ let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i; const [, k] = open.splice(bi, 1)[0];
    if (k === goal) break; if (closed[k]) continue; closed[k] = 1; const c = k % grid.cols, r = (k - c) / grid.cols;
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){ const nc = c + dc, nr = r + dr; if (!freeCell(nc, nr)) continue; if (dc && dr && (!freeCell(c + dc, r) || !freeCell(c, r + dr))) continue;
      const nk = key(nc, nr), ng = g[k] + (dc && dr ? 1.414 : 1); if (ng < g[nk]){ g[nk] = ng; prev[nk] = k; open.push([ng + Math.hypot(tc - nc, tr - nr), nk]); } } }
  if (prev[goal] < 0 && goal !== key(...from)) return null;
  const out = []; for (let k = goal; k >= 0 && k !== key(...from); k = prev[k]){ const c = k % grid.cols; out.push(cellXZ(c, (k - c) / grid.cols)); }
  return out.reverse();
}

// ---------- người chơi ----------
let P = null;   // { obj, x, z, heading, path, phase, spin }
let FORM = null;
function buildPlayer(){
  FORM = JF.form(CPS, ST.visited, COMBOS);
  const obj = M.buildMascot({ props:FORM.props }, { isPlayer:true, arrange:true });
  scene.add(obj.root);
  const last = [...ST.visited].reverse().find(id => POS[id] && (BY[id] && (BY[id].kind !== 'branch' || activeBranch(id))));
  const [sx, sz] = last ? [POS[last][0] + POS[last][2] * 1.6, POS[last][1] + POS[last][3] * 1.6] : [POS.start[0] - 1.8, POS.start[1]];
  const f = nearestFree(sx, sz) || nearestFree(POS.start[0], POS.start[1]); const [x, z] = cellXZ(...f);
  P = { obj, x, z, heading:Math.PI / 2, path:[], phase:0, spin:0, label:null };
  obj.root.position.set(x, 0, z); obj.root.rotation.y = P.heading;
  if (FORM.halo) M.addHalo(obj);
  P.label = addLabel('jx-me', () => [P.x, 2.25, P.z]); setPlayerLabel(false);
  cam.tx = x; cam.tz = z; cam.x = x; cam.z = z;
}
function setPlayerLabel(pop){ P.label.el.innerHTML = `${esc(FORM.title)}${FORM.sub ? `<small>${esc(FORM.sub)}</small>` : ''}`; if (pop && !reduce){ P.label.el.classList.remove('jx-pop'); void P.label.el.offsetWidth; P.label.el.classList.add('jx-pop'); } }

// ---------- nhãn HTML ----------
const labels = [];
function addLabel(cls, pos){ const el = document.createElement('div'); el.className = 'jx-label ' + cls; labelsEl.appendChild(el); const L = { el, pos }; labels.push(L); return L; }
const V = new THREE.Vector3();
function placeLabels(){ const w = host.clientWidth, h = host.clientHeight;
  labels.forEach(L => { const p = L.pos(); if (!p){ L.el.style.display = 'none'; return; } V.set(p[0], p[1], p[2]).project(camera);
    if (V.z > 1 || Math.abs(V.x) > 1.2 || Math.abs(V.y) > 1.2){ L.el.style.display = 'none'; return; }
    L.el.style.display = ''; L.el.style.left = ((V.x + 1) / 2 * w) + 'px'; L.el.style.top = ((1 - V.y) / 2 * h) + 'px'; }); }

// ---------- camera ----------
const cam = { yaw:.3, yawT:.3, pitch:.95, dist:smallScreen() ? 19 : 18, distT:smallScreen() ? 19 : 18, x:0, z:0, tx:0, tz:0, fly:null };
function updateCamera(dt){
  const k = 1 - Math.pow(.002, dt);
  const tgt = cam.fly || [P.x, P.z]; cam.tx = tgt[0]; cam.tz = tgt[1];
  cam.x += (cam.tx - cam.x) * k * .8; cam.z += (cam.tz - cam.z) * k * .8; cam.yaw += (cam.yawT - cam.yaw) * k; cam.dist += (cam.distT - cam.dist) * k;
  const cp = Math.cos(cam.pitch) * cam.dist;
  camera.position.set(cam.x + Math.sin(cam.yaw) * cp, Math.sin(cam.pitch) * cam.dist, cam.z + Math.cos(cam.yaw) * cp); camera.lookAt(cam.x, .8, cam.z);
}
function resize(){ if (!renderer) return; const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize);

// ---------- điều khiển ----------
const keys = {};
let busy = false;          // đang biến hình / chuyển trang
function bindInput(){
  const typing = e => /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
  // phím chỉ điều khiển game khi khung game hiện quá nửa màn hình (không giành phím cuộn trang của người đang đọc phần chữ)
  window.addEventListener('keydown', e => { if (typing(e) || !visible || ratio < .5) return; const k = e.key.toLowerCase();
    if (sheet.onKey && sheet.onKey(e)) { e.preventDefault(); return; }
    if (k === 'escape' && !sheet.hidden){ closeSheet(); return; }
    if (k === 'q'){ cam.yawT += .45; return; } if (k === 'e'){ cam.yawT -= .45; return; }
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){ keys[k] = true; cam.fly = null; if (k.startsWith('arrow')) e.preventDefault(); } });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => Object.keys(keys).forEach(k => keys[k] = false));
  $('#jx-rotl').onclick = () => { cam.yawT += .45; }; $('#jx-rotr').onclick = () => { cam.yawT -= .45; };
  $('#jx-zin').onclick = () => { cam.distT = Math.max(7, cam.distT - 2.5); }; $('#jx-zout').onclick = () => { cam.distT = Math.min(30, cam.distT + 2.5); };
  // cuộn chuột: zoom khi giữ Ctrl/⌘ hoặc vừa bấm vào game; còn lại để trang cuộn bình thường xuống phần lộ trình
  let wheelHint = false;
  canvas.addEventListener('wheel', e => { const engaged = e.ctrlKey || e.metaKey || performance.now() - engagedAt < 6000;
    if (!engaged){ if (!wheelHint){ wheelHint = true; toast('Giữ Ctrl (⌘) + cuộn để zoom, hoặc bấm vào bản đồ trước'); } return; }
    e.preventDefault(); engagedAt = performance.now(); cam.distT = Math.max(7, Math.min(30, cam.distT + Math.sign(e.deltaY) * 1.4)); }, { passive:false });
  const pts = new Map(); let down = null, pinch = 0;
  canvas.addEventListener('pointerdown', e => { engagedAt = performance.now(); canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 1) down = { x:e.clientX, y:e.clientY, t:performance.now(), yaw:cam.yawT, moved:false }; else { down = null; pinch = 0; } });
  canvas.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2){ const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.distT = Math.max(7, Math.min(30, cam.distT * pinch / d)); pinch = d; return; }
    if (down){ const dx = e.clientX - down.x; if (Math.abs(dx) > 6 || Math.abs(e.clientY - down.y) > 6) down.moved = true; if (down.moved) cam.yawT = down.yaw - dx * .008; } });
  const up = e => { pts.delete(e.pointerId); if (down && !down.moved && performance.now() - down.t < 600 && e.type === 'pointerup') tap(e.clientX, e.clientY); if (!pts.size) down = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
}
const ray = new THREE.Raycaster(), NDC = new THREE.Vector2();
function tap(cx, cy){
  if (busy) return; const r = canvas.getBoundingClientRect(); NDC.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(NDC, camera);
  cam.fly = null;
  if (doorMesh && ray.intersectObject(doorMesh).length){ walkTo(POS.finish[0], POS.finish[1]); return; }
  const hit = ray.intersectObject(ground)[0]; if (!hit) return; walkTo(hit.point.x, hit.point.z);
}
function walkTo(x, z){
  const from = nearestFree(P.x, P.z), to = nearestFree(x, z); if (!from || !to) return false;
  const path = astar(from, to); if (!path){ blockedHint(x, z); return false; }
  P.path = path; return true;
}
function blockedHint(x, z){
  // bấm vào phía sau cổng đang đóng → nhắc ghé trạm trước
  const g = Object.values(stations).find(s => s.gx != null && !gateOpen(s.id) && Math.hypot(x - s.gx, z - s.gz) < 9);
  if (g) toast(`Cổng "${BY[g.id].name}" đang đóng. Ghé trạm trước đã.`);
}
let toastT = 0;
function toast(msg){ let el = $('#jx-toast'); if (!el){ el = document.createElement('div'); el.id = 'jx-toast'; el.className = 'jx-label jx-sign jx-locked'; el.style.cssText = 'left:50%;top:auto;bottom:70px;transform:translateX(-50%);position:absolute;z-index:5;white-space:normal;max-width:90%;font-size:13px;padding:8px 14px'; host.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

// ---------- cổng, cửa, HUD ----------
function gateOpen(id){
  const c = BY[id]; if (!c || c.kind !== 'main') return true;
  if (ST.visited.includes(id)) return true;
  const ms = mains(), i = ms.findIndex(m => m.id === id);
  return i <= 0 ? true : ST.visited.includes(ms[i - 1].id);
}
const allMainsDone = () => mains().every(m => ST.visited.includes(m.id));
let doorLabel = null;
function refresh(){
  Object.values(stations).forEach(s => {
    const v = ST.visited.includes(s.id); s.fill.material.opacity = v ? .38 : .14;
    if (s.bar){ const open = gateOpen(s.id); s.bar.visible = !open; s.stripes.forEach(m => { m.visible = !open; });
      s.sm.material.map = open ? s.openTex : s.closedTex; s.sm.material.needsUpdate = true; } });
  gatesToGrid();
  const done = allMainsDone();
  if (doorGlow) doorGlow.material.opacity = done ? .55 : 0;
  if (!doorLabel) doorLabel = addLabel('jx-sign', () => [DOOR[0] + .4, 2.9, DOOR[1]]);
  const miss = mains().filter(m => !ST.visited.includes(m.id));
  doorLabel.el.className = 'jx-label jx-sign ' + (done ? 'jx-open' : 'jx-locked');
  doorLabel.el.textContent = done ? '✨ Ngày đầu đi làm' : `🔒 Còn thiếu ${miss.length} trạm`;
  // HUD
  const ms = mains(), mv = ms.filter(m => ST.visited.includes(m.id)).length, br = CPS.filter(c => activeBranch(c.id)), bv = br.filter(c => ST.visited.includes(c.id)).length;
  hud.innerHTML = `<div class="jx-h-k">Hình thái hiện tại</div><div class="jx-h-t">${esc(FORM.title)}</div>${FORM.sub ? `<div class="jx-h-s">${esc(FORM.sub)}</div>` : ''}
    <div class="jx-bar"><i style="width:${Math.round(mv / Math.max(1, ms.length) * 100)}%"></i></div><div class="jx-h-p">Đã qua ${mv}/${ms.length} trạm${br.length ? ` · ${bv}/${br.length} nhánh` : ''}</div>`;
  // phần chữ: đánh dấu trạm đã ghé
  document.querySelectorAll('.jx-cp').forEach(s => s.classList.toggle('is-visited', ST.visited.includes(s.dataset.cp) && s.dataset.cp !== 'start'));
}

// ---------- vòng lặp ----------
let lastT = performance.now(), inside = null;
function loop(){
  raf = requestAnimationFrame(loop); if (!visible) return;
  const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  stepPlayer(dt); updateCamera(dt); renderer.render(scene, camera); placeLabels();
}
function stepPlayer(dt){
  const o = P.obj; let mx = 0, mz = 0, moving = false;
  if (!busy){
    const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), s = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    if (f || s){ P.path = []; const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw); mx = fx * f + rx * s; mz = fz * f + rz * s; const L = Math.hypot(mx, mz); mx /= L; mz /= L; }
    else if (P.path.length){ const [tx, tz] = P.path[0], dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz); if (d < .12) P.path.shift(); else { mx = dx / d; mz = dz / d; } }
  } else if (P.auto){ const [tx, tz] = P.auto, dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz); if (d > .1){ mx = dx / d; mz = dz / d; } }
  if (mx || mz){ const sp = 4.4 * dt; let nx = P.x + mx * sp, nz = P.z + mz * sp;
    if (P.auto || freeXZ(nx, nz)){ P.x = nx; P.z = nz; } else if (freeXZ(nx, P.z)){ P.x = nx; } else if (freeXZ(P.x, nz)){ P.z = nz; }
    moving = true; const h = Math.atan2(mx, mz); let dh = h - P.heading; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; P.heading += dh * Math.min(1, dt * 12); }
  o.root.position.set(P.x, 0, P.z); o.root.rotation.y = P.heading;
  const t = performance.now() / 1000;
  if (moving){ P.phase += dt * 10; const sw = Math.sin(P.phase) * .6; o.legs[0].rotation.x = sw; o.legs[1].rotation.x = -sw; o.inner.position.y = Math.abs(Math.sin(P.phase)) * .05; }
  else { o.legs[0].rotation.x *= .8; o.legs[1].rotation.x *= .8; o.inner.position.y = Math.sin(t * 2.2) * .018; }
  if (P.spin){ o.inner.rotation.y += P.spin * dt; } else o.inner.rotation.y *= .85;
  if (!busy) checkZones();
}
function checkZones(){
  let now = null;
  for (const s of Object.values(stations)){ if (Math.hypot(P.x - s.x, P.z - s.z) < 1.15){ now = s.id; break; } }
  if (now !== inside){ inside = now; if (now) openStation(now); }
  // đi xa khỏi trạm đang mở thì đóng bảng
  if (sheet.dataset.cp && !sheet.hidden && !sheet.dataset.sticky){ const s = stations[sheet.dataset.cp]; if (s && Math.hypot(P.x - s.x, P.z - s.z) > 3.2) closeSheet(); }
}

// ---------- bảng thông tin ----------
function openSheet(h, cp, sticky){ sheet.innerHTML = `<button class="jx-x" type="button" aria-label="Đóng">×</button>${h}`; sheet.hidden = false; sheet.dataset.cp = cp || ''; if (sticky) sheet.dataset.sticky = '1'; else delete sheet.dataset.sticky; sheet.onKey = null; sheet.querySelector('.jx-x').onclick = closeSheet; sheet.scrollTop = 0; }
function closeSheet(){ sheet.hidden = true; sheet.innerHTML = ''; sheet.dataset.cp = ''; delete sheet.dataset.sticky; sheet.onKey = null; }
const kindLabel = c => c.kind === 'branch' ? '<p class="jx-k jx-b">Nhánh tuỳ chọn</p>' : c.kind === 'start' ? '<p class="jx-k">Xuất phát</p>' : `<p class="jx-k">Trạm ${mains().findIndex(m => m.id === c.id) + 1}/${mains().length}${c.is_milestone ? ' · Mốc nghề' : ''}</p>`;
function openStation(id){
  const c = BY[id]; if (!c) return; if (c.kind === 'finish') return openDoor();
  track('journey_station_open', { cp_id:id });
  const v = ST.visited.includes(id), url = COURSE_SAFE(c.course_url);
  const needCh = c.require_challenge && !ST.challenge_passed.includes(id);
  const know = (c.knowledge || []).filter(Boolean);
  let actions = '';
  if (c.kind === 'main' || c.kind === 'branch'){
    actions = `<div class="jx-row">${url ? `<a class="gx-btn gx-btn-ghost" href="${esc(url)}" target="_blank" rel="noopener" data-act="course">Xem khóa học ↗</a>` : ''}
      ${v ? `<button class="gx-btn" type="button" data-act="save">Lưu ảnh trước và sau</button>` : `<button class="gx-btn" type="button" data-act="${needCh ? 'challenge' : 'transform'}">${needCh ? 'Làm thử thách' : 'Biến hình ✨'}</button>`}</div>`;
  } else actions = `<div class="jx-row"><button class="gx-btn" type="button" data-act="go">Lên đường →</button></div>`;
  openSheet(`${kindLabel(c)}<h2>${esc(c.name)}</h2>
    ${c.course_title ? `<p class="jx-c">${esc(c.course_title)}${c.sessions ? ` <span>· ${esc(c.sessions)} buổi</span>` : ''}</p>` : ''}
    ${v && c.kind !== 'start' ? '<span class="jx-done">✓ Đã ghé trạm này</span>' : ''}
    ${c.description ? `<p>${esc(c.description)}</p>` : ''}
    ${know.length ? `<h3>Bạn sẽ học</h3><ul>${know.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
    ${c.outcome ? `<h3>Học xong bạn sẽ</h3><p>${esc(c.outcome)}</p>` : ''}
    <div class="jx-formcard"><i>${c.kind === 'start' ? '🎒' : c.is_milestone ? '🏅' : '✨'}</i><div><b>${c.kind === 'start' ? 'Bạn đang là: ' : 'Biến thành: '}${esc(c.form_title)}</b><span>${esc(c.form_description || '')}</span></div></div>
    ${needCh ? '<p style="font-size:13px">Trạm này cần vượt thử thách: đúng 3/4 thẻ thuật ngữ mới được biến hình.</p>' : ''}
    ${actions}`, id);
  sheet.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'course'){ track('journey_course_click', { cp_id:id, link_url:url, click_source:'journey_game' }); return; }
    if (a === 'transform') transform(id); else if (a === 'challenge') challenge(id); else if (a === 'save') saveImage(id); else if (a === 'go'){ closeSheet(); walkTo(POS.figma[0] - 2.6, POS.figma[1]); }
  });
}

// ---------- thử thách flashcard (3/4 đúng là qua) ----------
let TERMS = null;
async function loadTerms(){
  if (TERMS) return TERMS; const C = window.SB_CONFIG;
  try { const r = await fetch(`${C.url}/rest/v1/concepts?select=id,name,description,category_id&is_published=eq.true`, { headers:C.headers ? C.headers() : { apikey:C.key } }); if (r.ok) TERMS = await r.json(); } catch (e) {}
  return TERMS || [];
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
async function challenge(id){
  const c = BY[id], all = (await loadTerms()).filter(t => t.name && t.description);
  if (all.length < 4){ toast('Chưa tải được thẻ thuật ngữ, cho qua lần này.'); ST.challenge_passed.push(id); save(); return transform(id); }
  const want = (c.challenge_term_ids || []).map(String), mine = all.filter(t => want.includes(String(t.id)));
  const deck = shuffle(mine).slice(0, 4); shuffle(all.filter(t => !deck.includes(t))).forEach(t => { if (deck.length < 4) deck.push(t); });
  const need = 3; let i = 0, right = 0;
  const mask = (d, n) => { const s = d.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '____'); return s.length > 260 ? s.slice(0, 257) + '…' : s; };
  const show = () => {
    const t = deck[i], others = all.filter(x => x.id !== t.id && x.name !== t.name);
    const opts = shuffle([t, ...shuffle(others.filter(x => x.category_id === t.category_id)).concat(shuffle(others.filter(x => x.category_id !== t.category_id))).slice(0, 2)]);
    openSheet(`<p class="jx-k">Thử thách · thẻ ${i + 1}/${deck.length} · đúng ${right}</p><h2>Thuật ngữ nào có nghĩa này?</h2>
      <blockquote class="jx-def">${esc(mask(t.description, t.name))}</blockquote>
      <div class="jx-opts">${opts.map((o, k) => `<button type="button" data-id="${esc(o.id)}"><kbd>${k + 1}</kbd>${esc(o.name)}</button>`).join('')}</div>`, id, true);
    const pick = pid => { const ok = String(pid) === String(t.id); if (ok) right++;
      sheet.querySelectorAll('.jx-opts button').forEach(b => { b.disabled = true; if (String(b.dataset.id) === String(t.id)) b.classList.add('ok'); else if (b.dataset.id === String(pid)) b.classList.add('bad'); });
      setTimeout(() => { i++; if (i < deck.length) return show(); const pass = right >= need; track('journey_challenge', { cp_id:id, pass, correct:right });
        if (pass){ ST.challenge_passed.push(id); save(); openSheet(`<p class="jx-k">Thử thách</p><h2>Qua rồi! 🎉</h2><p>Đúng ${right}/${deck.length} thẻ.</p><div class="jx-row"><button class="gx-btn" type="button" data-act="t">Biến hình ✨</button></div>`, id, true); sheet.querySelector('[data-act]').onclick = () => transform(id); }
        else { openSheet(`<p class="jx-k">Thử thách</p><h2>Chưa qua</h2><p>Đúng ${right}/${deck.length}, cần ${need}. Đọc lại phần kiến thức rồi thử lần nữa nhé.</p><div class="jx-row"><button class="gx-btn gx-btn-ghost" type="button" data-act="info">Xem lại trạm</button><button class="gx-btn" type="button" data-act="again">Thử lại</button></div>`, id, true);
          sheet.querySelector('[data-act="again"]').onclick = () => challenge(id); sheet.querySelector('[data-act="info"]').onclick = () => openStation(id); } }, 700); };
    sheet.querySelectorAll('.jx-opts button').forEach(b => b.onclick = () => pick(b.dataset.id));
    sheet.onKey = e => { if (/^[1-3]$/.test(e.key)){ const b = sheet.querySelectorAll('.jx-opts button')[+e.key - 1]; if (b && !b.disabled) pick(b.dataset.id); return true; } return false; };
  };
  show();
}

// ---------- cảnh biến hình ----------
function trail(){
  const g = new THREE.Group(); const n = 42;
  for (let i = 0; i < n; i++){ const s = new THREE.Mesh(M.G.sphereLo, new THREE.MeshBasicMaterial({ color:i % 2 ? '#E92F7C' : '#35C6E8', transparent:true, opacity:.9 })); const a = i / n * Math.PI * 6, y = i / n * 2.2;
    s.scale.setScalar(.06 + (i % 3) * .015); s.position.set(Math.cos(a) * .95, y, Math.sin(a) * .95); g.add(s); }
  g.position.set(P.x, 0, P.z); scene.add(g); return g;
}
function confetti(){ const box = $('#jx-confetti'); const cols = ['#E92F7C', '#35C6E8', '#FFC53D', '#8A3FFC', '#2FBF8F'];
  for (let i = 0; i < 70; i++){ const c = document.createElement('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = cols[i % cols.length]; c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; c.style.animationDelay = Math.random() * .5 + 's'; c.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(c); }
  setTimeout(() => { box.innerHTML = ''; }, 3800); }
let lastBefore = {};
async function transform(id){
  if (busy || ST.visited.includes(id)) return; busy = true; closeSheet(); P.path = []; cam.fly = null;
  const c = BY[id], before = JF.form(CPS, ST.visited, COMBOS);
  ST.visited.push(id); save();
  const after = JF.form(CPS, ST.visited, COMBOS); lastBefore[id] = before;
  track('journey_transform', { cp_id:id, form_title:after.title, milestone:!!c.is_milestone });
  const d0 = cam.distT;
  if (!reduce){
    cam.distT = 7.5; $('#jx-dim').hidden = false; await sleep(450);
    const tr = trail(); P.spin = 4; const t0 = performance.now();
    await new Promise(res => { const step = () => { const k = (performance.now() - t0) / 1500; P.spin = 4 + k * 26; tr.rotation.y += .25; tr.position.set(P.x, 0, P.z); tr.scale.setScalar(1 + Math.sin(k * Math.PI) * .25);
      if (k < 1) requestAnimationFrame(step); else res(); }; step(); });
    scene.remove(tr); P.spin = 0;
    const fl = $('#jx-flash'); fl.hidden = false; setTimeout(() => { fl.hidden = true; }, 600);
  }
  FORM = after; M.setProps(P.obj, FORM.props, { arrange:true }); if (FORM.halo) M.addHalo(P.obj); setPlayerLabel(true); refresh();
  if (c.is_milestone){ const bn = $('#jx-banner'); bn.textContent = `Lên cấp: ${after.title}`; bn.hidden = false; if (!reduce) confetti(); setTimeout(() => { bn.hidden = true; }, 2600); }
  await sleep(reduce ? 300 : 1300);
  $('#jx-dim').hidden = true; cam.distT = d0; busy = false;
  const next = mains().find(m => !ST.visited.includes(m.id));
  openSheet(`<p class="jx-k">${c.is_milestone ? 'Lên cấp' : 'Biến hình xong'}</p><h2>${esc(after.title)}</h2>${after.sub ? `<p class="jx-c">${esc(after.sub)}</p>` : ''}
    <p>${esc(c.form_description || '')}</p>
    <p style="font-size:13px">${next ? `Trạm tiếp theo: <b>${esc(next.name)}</b>. Cổng đã mở.` : 'Bạn đã qua đủ các trạm chính. Đi tới tòa văn phòng cuối đường để bắt đầu ngày đầu đi làm.'}</p>
    <div class="jx-row"><button class="gx-btn gx-btn-ghost" type="button" data-act="save">Lưu ảnh trước và sau</button><button class="gx-btn" type="button" data-act="ok">Đi tiếp →</button></div>`, id);
  sheet.querySelector('[data-act="save"]').onclick = () => saveImage(id);
  sheet.querySelector('[data-act="ok"]').onclick = () => { closeSheet(); if (next && POS[next.id]) walkTo(POS[next.id][0] - POS[next.id][2] * 4, POS[next.id][1] - POS[next.id][3] * 4); else if (!next) walkTo(POS.finish[0] - 1.5, POS.finish[1]); };
}

// ---------- ảnh trước và sau (PNG 1080 × 1350) ----------
async function saveImage(id){
  const c = BY[id]; if (!c) return;
  const i = ST.visited.indexOf(id), before = lastBefore[id] || JF.form(CPS, ST.visited.slice(0, Math.max(0, i)), COMBOS), after = JF.form(CPS, ST.visited.slice(0, i + 1), COMBOS);
  const Wd = 1080, Ht = 1350, cv = document.createElement('canvas'); cv.width = Wd; cv.height = Ht; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, Wd, Ht); gr.addColorStop(0, '#241775'); gr.addColorStop(1, '#4B33B8'); g.fillStyle = gr; g.fillRect(0, 0, Wd, Ht);
  const shot = props => { const r = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true }); r.setSize(440, 560, false); r.setPixelRatio(1);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0xa79cd0, .75)); const l = new THREE.DirectionalLight(0xffffff, .6); l.position.set(3, 6, 5); sc.add(l);
    const m = M.buildMascot({ props:props.props }, { isPlayer:true, arrange:true }); m.ring.visible = false; if (props.halo) M.addHalo(m); m.root.rotation.y = -.35; sc.add(m.root);
    const cm = new THREE.PerspectiveCamera(30, 440 / 560, .1, 50); cm.position.set(0, 1.45, 5.4); cm.lookAt(0, 1.0, 0); r.render(sc, cm);
    const out = document.createElement('canvas'); out.width = 440; out.height = 560; out.getContext('2d').drawImage(r.domElement, 0, 0); r.dispose(); r.forceContextLoss && r.forceContextLoss(); return out; };
  const card = (x, im, lab, title, sub) => { g.fillStyle = 'rgba(255,255,255,.96)'; rr(g, x, 330, 460, 720, 36); g.fill(); g.drawImage(im, x + 10, 360, 440, 560);
    g.fillStyle = '#E92F7C'; g.font = '700 26px -apple-system, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText(lab, x + 230, 952);
    g.fillStyle = '#1C1033'; fitText(g, title, 40, 420, '800'); g.fillText(title, x + 230, 1000); if (sub){ g.fillStyle = '#6B5FA5'; fitText(g, sub, 24, 420, '600'); g.fillText(sub, x + 230, 1034); } };
  g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 28px -apple-system, "Segoe UI", sans-serif'; g.fillText('HÀNH TRÌNH UI/UX · TELOS ACADEMY', Wd / 2, 110);
  g.fillStyle = '#FFFFFF'; fitText(g, `Lên đời: ${after.title}`, 62, 980, '800'); g.fillText(`Lên đời: ${after.title}`, Wd / 2, 200);
  if (c.course_title){ g.fillStyle = 'rgba(255,255,255,.82)'; fitText(g, `Sau ${c.course_title}`, 30, 960, '500'); g.fillText(`Sau ${c.course_title}`, Wd / 2, 258); }
  card(60, shot(before), 'TRƯỚC', before.title, before.sub); card(560, shot(after), 'SAU', after.title, after.sub);
  g.fillStyle = '#FFC53D'; g.font = '800 64px -apple-system, "Segoe UI", sans-serif'; g.fillText('→', Wd / 2, 700);
  g.fillStyle = '#FFFFFF'; g.font = '800 44px -apple-system, "Segoe UI", sans-serif'; g.textAlign = 'left'; g.fillText('TELOS', 70, 1250);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '500 26px -apple-system, "Segoe UI", sans-serif'; g.textAlign = 'right'; g.fillText('uiux-library.nhanluu.com/hanh-trinh-ui-ux', Wd - 70, 1250);
  const a = document.createElement('a'); a.download = `hanh-trinh-${id}.png`; a.href = cv.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove();
  track('journey_save_image', { cp_id:id });
  window.__jxLastImage = { w:cv.width, h:cv.height, before:before.title, after:after.title };
}
function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fitText(g, t, px, w, wt){ let s = px; do { g.font = `${wt} ${s}px -apple-system, "Segoe UI", sans-serif`; s -= 2; } while (g.measureText(t).width > w && s > 14); }

// ---------- đích: đi làm ----------
function openDoor(){
  if (!allMainsDone()){ const miss = mains().filter(m => !ST.visited.includes(m.id));
    openSheet(`<p class="jx-k">Tòa văn phòng</p><h2>Cửa còn khoá</h2><p>Qua đủ ${mains().length} trạm chính thì cửa mới mở. Bạn còn thiếu:</p><ul class="jx-miss">${miss.map(m => `<li>${esc(m.name)}${m.course_title ? ` <span style="opacity:.6">(${esc(m.course_title)})</span>` : ''}</li>`).join('')}</ul>`, 'finish'); return; }
  const web = ST.visited.includes('web');
  openSheet(`<p class="jx-k">Ngày đầu đi làm</p><h2>Chọn nơi làm việc đầu tiên</h2><p>Bạn bước vào với tư cách <b>${esc(FORM.title)}</b>${FORM.sub ? ` · ${esc(FORM.sub)}` : ''}. Muốn bắt đầu ở đâu?</p>
    <div class="jx-work">${WORK.map(w => `<button type="button" data-scale="${esc(w.scale)}"><b>${esc(w.label)}</b><span>${esc(w.note || '')}</span>${web && (w.suggest_if === 'web' || w.scale === 'agency') ? '<em>Hợp với bạn</em>' : ''}</button>`).join('')}</div>`, 'finish', true);
  sheet.querySelectorAll('[data-scale]').forEach(b => b.onclick = () => goWork(b.dataset.scale));
}
async function goWork(scale){
  if (busy) return; busy = true; closeSheet();
  ST.finished_at = new Date().toISOString(); ST.workplace = scale; save();
  track('journey_finish', { workplace:scale, form_id:FORM.id, branches:FORM.branches.join(',') });
  const q = new URLSearchParams({ tu:'hanh-trinh', 'quy-mo':scale, 'hinh-thai':FORM.id }); if (FORM.branches.length) q.set('nhanh', FORM.branches.join(','));
  const url = '/team-map?' + q.toString().replace(/%2C/g, ',');
  window.__jxGoUrl = url;
  // cửa mở, nhân vật bước vào, màn hình mờ dần
  const t0 = performance.now(); const openDoorAnim = () => { const k = Math.min(1, (performance.now() - t0) / 700); doorMesh.position.z = -1.3 * k; if (k < 1) requestAnimationFrame(openDoorAnim); }; openDoorAnim();
  P.auto = [DOOR[0], DOOR[1]]; await sleep(reduce ? 200 : 700); P.auto = [OFFICE[0], OFFICE[1]];
  const fd = $('#jx-fade'); fd.hidden = false; void fd.offsetWidth; fd.classList.add('on');
  await sleep(1200);
  if (EMBED){ window.open(url, '_blank', 'noopener'); fd.classList.remove('on'); setTimeout(() => { fd.hidden = true; }, 1100); busy = false; P.auto = null; P.x = POS.finish[0]; P.z = POS.finish[1]; doorMesh.position.z = 0; }
  else location.href = url;
}

// ---------- từ phần chữ: bay camera tới trạm (nhân vật không dịch chuyển) ----------
function flyTo(id){
  if (!POS[id] || !scene) return;
  host.scrollIntoView({ behavior:reduce ? 'auto' : 'smooth', block:'start' });
  cam.fly = [POS[id][0], POS[id][1]]; track('journey_fly', { cp_id:id });
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.jx-fly'); if (b){ e.preventDefault(); flyTo(b.dataset.cp); } });

// ---------- khởi tạo khi cuộn tới, dừng vẽ khi khuất ----------
if ('IntersectionObserver' in window){
  new IntersectionObserver(es => es.forEach(en => { visible = en.isIntersecting; ratio = en.intersectionRatio; if (visible){ lastT = performance.now(); init(); } }), { threshold:[0, .05, .5, .75, 1] }).observe(host);
} else init();

// cho test / debug
window.__jx = { get state(){ return ST; }, get form(){ return FORM; }, get player(){ return P && { x:P.x, z:P.z, props:P.obj.props, halo:!!P.obj.halo }; }, get busy(){ return busy; },
  stations:() => Object.keys(stations), pos:id => POS[id], gateOpen, open:id => openStation(id), transform, challenge, walkTo, flyTo, get cam(){ return cam; },
  teleport:id => { const s = stations[id] || { x:POS[id][0], z:POS[id][1] }; const f = nearestFree(s.x - (POS[id][2] || 0) * 1.2, s.z - (POS[id][3] || 0) * 1.2); [P.x, P.z] = cellXZ(...f); P.path = []; inside = null; },
  freeAt:(x, z) => freeXZ(x, z), path:(a, b) => { const f = nearestFree(...a), t = nearestFree(...b); return !!(f && t && astar(f, t)); } };
})();
