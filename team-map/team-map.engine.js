// ================= ENGINE =================
// Team Map engine (Three.js r128). Không chứa dữ liệu: nhận dữ liệu từ team-map.loader.js qua startTeamMap(data).
window.startTeamMap = function(D){
const { GROUPS, ROLES, TERMS, SCALES, LOCKED_ROLES, QUESTS, ROOM_INFO, TV_ROOMS, SCALE_REPORTS, DOTTED, SCREEN_KIND, PLAYER_ID, AUTHOR_ID, GUEST_ID } = D;
const SCALE_KEYS = Object.keys(SCALES), perScale = f => Object.fromEntries(SCALE_KEYS.map(k => [k, f()]));
// Google Analytics: custom event (bỏ qua nếu trang không có gtag, vd trình chặn quảng cáo)
const track = (name, params = {}) => { try { if (typeof window.gtag === 'function') window.gtag('event', name, Object.assign({ tm_scale: scaleKey, tm_lang: LANG }, params)); } catch (e) {} };
const $ = s => document.querySelector(s);
// Ngôn ngữ: /en/team-map → 'en'. L(vi, en) chọn chuỗi theo ngôn ngữ trang.
const LANG = window.TM_LANG === 'en' ? 'en' : 'vi', L = (vi, en) => LANG === 'en' ? en : vi;
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDark = () => { const t = document.documentElement.getAttribute('data-theme'); if (t) return t === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('#stage'), overlay = $('#overlay');
// Nhiệm vụ theo giờ + 8 mini-game (team-map.hourly-games.js). null nếu chưa có dữ liệu / file.
let HX = null;
const small = () => innerWidth < 760;

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.shadowMap.enabled = !small();
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xffffff, 0xa79cd0, 0.62));
const sun = new THREE.DirectionalLight(0xffffff, 0.55);
sun.position.set(14, 30, 12); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-48, right:48, top:40, bottom:-40, near:1, far:90 });
scene.add(sun); scene.add(sun.target);

// ---------- materials ----------
const matCache = {};
const mat = (c, o={}) => { const k = c + JSON.stringify(o); return matCache[k] || (matCache[k] = new THREE.MeshLambertMaterial(Object.assign({ color:c }, o))); };
const BODY = new THREE.MeshToonMaterial({ color:0x7676B8 });
const OUTLINE = new THREE.MeshBasicMaterial({ color:0x2E2470, side:THREE.BackSide });
const DARK_BODY = new THREE.MeshToonMaterial({ color:0x241775 });
const DARK_OUTLINE = new THREE.MeshBasicMaterial({ color:0x0F0A3A, side:THREE.BackSide });
const G = {
  sphere: new THREE.SphereGeometry(1, 32, 24),
  sphereLo: new THREE.SphereGeometry(1, 16, 12),
  leg: new THREE.CylinderGeometry(0.11, 0.12, 0.42, 14),
  legOut: new THREE.CylinderGeometry(0.135, 0.145, 0.44, 14),
  ring: new THREE.CircleGeometry(0.62, 32),
  eye: new THREE.PlaneGeometry(0.5, 0.5),
  mouth: new THREE.PlaneGeometry(0.22, 0.22)
};

// ---------- face textures (mascot: one big eye + tiny mouth) ----------
function tex(draw, size=128){ const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
const INK = '#2E2470', PUPIL = '#3B2F86';
function eyeBase(g){ g.fillStyle = '#fff'; g.beginPath(); g.arc(64,64,54,0,7); g.fill(); g.lineWidth = 7; g.strokeStyle = INK;
  [[0.2,1.3],[1.45,2.9],[3.05,4.6],[4.75,6.05]].forEach(([a,b]) => { g.beginPath(); g.arc(64,64,54,a,b); g.stroke(); }); }
function eyeOpen(dx, dy){ return tex(g => { eyeBase(g); g.fillStyle = PUPIL; g.beginPath(); g.arc(64+dx,64+dy,31,0,7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(54+dx,52+dy,9,0,7); g.fill(); }); }
const FACE = {
  open: eyeOpen(0,2), look: eyeOpen(13,-12), side: eyeOpen(-14,4),
  happy: tex(g => { eyeBase(g); g.strokeStyle = PUPIL; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.arc(64,76,22,Math.PI,0); g.stroke(); }),
  mO: tex(g => { g.fillStyle = '#F2788F'; g.beginPath(); g.ellipse(32,32,8,11,0,0,7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); }, 64),
  mSmile: tex(g => { g.fillStyle = '#E5446D'; g.beginPath(); g.moveTo(12,22); g.quadraticCurveTo(32,58,52,22); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.fillStyle = '#F7A6B6'; g.beginPath(); g.ellipse(32,38,9,5,0,0,7); g.fill(); }, 64),
  mFlat: tex(g => { g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(20,32); g.quadraticCurveTo(32,40,44,30); g.stroke(); }, 64)
};
const capTex = tex(g => { g.fillStyle = '#D9406F'; g.fillRect(0,0,256,96); g.fillStyle = '#fff'; g.font = 'bold 54px Oswald, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TELOS', 128, 50); }, 256);

// ---------- props: the profession tool each character carries ----------
function box(w,h,d,c,o){ const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(c,o)); m.castShadow = true; return m; }
function cyl(rt,rb,h,c,seg=16,o){ const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(c,o)); m.castShadow = true; return m; }
function torus(r,t,c,arc=Math.PI*2){ return new THREE.Mesh(new THREE.TorusGeometry(r,t,10,32,arc), mat(c)); }
function ball(r,c){ const m = new THREE.Mesh(G.sphereLo, mat(c)); m.scale.setScalar(r); return m; }
const HAND = new THREE.Vector3(0.52, 0.78, 0.18);
const PROPS = {
  blazer(){ const g = new THREE.Group(); g.position.y = .98; const open = .95, F = Math.PI/2, navy = '#1F2F5C';
    const outer = new THREE.Mesh(new THREE.SphereGeometry(.524, 48, 24, F + open, Math.PI*2 - open*2, 1.28, Math.PI - 1.28), mat(navy, { side:THREE.DoubleSide })); outer.castShadow = true; g.add(outer);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(.514, 24, 16, F - open, open*2, 1.98, Math.PI - 1.98), mat('#FFFFFF')));
    [-1,1].forEach(s => { g.add(new THREE.Mesh(new THREE.SphereGeometry(.514, 12, 20, s > 0 ? F + .6 : F - open, open - .6, 1.34, .7), mat('#FFFFFF')));
      const lapel = box(.16,.3,.03,'#182549'); lapel.position.set(s*.42, -.02, .33); lapel.rotation.set(-.55, s*-.85, s*.3); g.add(lapel);
      const cuff = ball(.165, navy); cuff.position.set(s*.5, -.16, .06); g.add(cuff);
      const pocket = box(.16,.02,.03,'#182549'); pocket.position.set(s*.47, -.3, .2); pocket.rotation.y = s*-1.1; g.add(pocket); });
    return g; },
  hair(){ const g = new THREE.Group(); const c = '#1D1A33';
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.535, 32, 12, 0, Math.PI*2, 0, .66), mat(c)); cap.position.y = .98; cap.castShadow = true; g.add(cap);
    [[-.2,1.4,.22,.16],[0,1.44,.26,.17],[.2,1.41,.2,.15],[.3,1.36,.02,.14],[-.3,1.36,.02,.14],[.08,1.5,.02,.16],[-.1,1.49,-.1,.16]].forEach(([x,y,z,r]) => { const b = ball(r, c); b.position.set(x,y,z); g.add(b); });
    return g; },
  necklace(){ const g = new THREE.Group(); const P = new THREE.Vector3(0,.7,.455);
    [-1,1].forEach(s => { const A = new THREE.Vector3(s*.2,.99,.47), mid = A.clone().add(P).multiplyScalar(.5), len = A.distanceTo(P);
      const c = cyl(.008,.008,len,'#15131F',6); c.position.copy(mid).setLength(mid.clone().sub(new THREE.Vector3(0,.98,0)).length()); c.position.copy(mid); c.position.z += .035; c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), P.clone().sub(A).normalize()); g.add(c); });
    const pend = cyl(.055,.055,.02,'#3D5BD6',20); pend.rotation.x = Math.PI/2 - .55; pend.position.copy(P).add(new THREE.Vector3(0,0,.03)); g.add(pend);
    const dot = cyl(.025,.025,.024,'#DCE4FF',14); dot.rotation.copy(pend.rotation); dot.position.copy(pend.position); g.add(dot);
    return g; },
  phoneUse(){ const g = new THREE.Group(); g.add(box(.17,.3,.025,'#F4F0FB')); const sc = box(.14,.25,.01,'#35C6E8'); sc.position.z = .016; g.add(sc);
    const bar = box(.1,.03,.01,'#E92F7C'); bar.position.set(0,.07,.022); g.add(bar);
    g.position.set(0,.74,.56); g.rotation.set(-1.0, Math.PI, 0); return g; },
  laptopCarry(){ const g = new THREE.Group(); const l = box(.42,.3,.035,'#D9D6E6'); g.add(l);
    const logo = new THREE.Mesh(new THREE.CircleGeometry(.05, 20), mat('#241775')); logo.position.z = .019; g.add(logo);
    g.position.set(.62, .74, .22); g.rotation.set(.1, -.5, -.12); return g; },
  clipboard(){ const g = new THREE.Group(); g.add(box(.34,.44,.03,'#C98B4F')); const p = box(.27,.33,.012,'#FFFFFF'); p.position.set(0,-.03,.02); g.add(p);
    for (let i=0;i<3;i++){ const l = box(.18,.02,.01,'#8A82A0'); l.position.set(-.02,.06-i*.07,.03); g.add(l); } const c = box(.12,.05,.04,'#5B5270'); c.position.y = .21; g.add(c);
    g.position.set(.58,.82,.28); g.rotation.set(-.35,-.5,0); return g; },
  laptop(){ const g = new THREE.Group(); const b = box(.56,.03,.38,'#D9D6E6'); g.add(b); const s = box(.56,.36,.025,'#241354'); s.position.set(0,.18,-.18); s.rotation.x = -.25; g.add(s);
    const code = box(.36,.03,.01,'#35C6E8'); code.position.set(-.04,.24,-.16); code.rotation.x = -.25; g.add(code); const code2 = box(.24,.03,.01,'#E92F7C'); code2.position.set(-.1,.17,-.15); code2.rotation.x = -.25; g.add(code2);
    g.position.set(0,.62,.62); g.rotation.y = Math.PI; return g; },
  tablet(){ const g = new THREE.Group(); g.add(box(.4,.28,.025,'#1C1033')); const sc = box(.34,.22,.01,'#F7E0EC'); sc.position.z = .015; g.add(sc);
    const pen = cyl(.018,.018,.36,'#E92F7C'); pen.position.set(.26,.02,.05); pen.rotation.z = .5; g.add(pen); g.position.set(.5,.74,.36); g.rotation.set(-.6,-.4,0); return g; },
  phone(){ const g = new THREE.Group(); g.add(box(.15,.28,.025,'#1C1033')); const s = box(.12,.22,.01,'#35C6E8'); s.position.z = .015; g.add(s); g.position.copy(HAND).add(new THREE.Vector3(0,.12,.06)); g.rotation.x = -.3; return g; },
  magnifier(){ const g = new THREE.Group(); g.add(torus(.15,.03,'#1C1033')); const gl = new THREE.Mesh(new THREE.CircleGeometry(.15,24), mat('#BFEAF6',{transparent:true,opacity:.55})); g.add(gl);
    const h = cyl(.03,.03,.32,'#1C1033'); h.position.set(.13,-.2,0); h.rotation.z = .6; g.add(h); g.position.set(.42,1.18,.5); g.rotation.y = -.3; return g; },
  headset(){ const g = new THREE.Group(); const band = torus(.53,.035,'#1C1033',Math.PI); band.position.y = .98; g.add(band);
    [-1,1].forEach(s => { const c = cyl(.12,.12,.08,'#E92F7C'); c.rotation.z = Math.PI/2; c.position.set(s*.53,.98,0); g.add(c); });
    const mic = cyl(.015,.015,.32,'#1C1033'); mic.position.set(.42,.86,.22); mic.rotation.set(1.2,0,.4); g.add(mic); const tip = ball(.04,'#1C1033'); tip.position.set(.32,.8,.36); g.add(tip); return g; },
  glasses(){ const g = new THREE.Group(); const r = torus(.27,.03,'#1C1033'); r.position.set(0,1.17,.47); r.rotation.x = -.38; g.add(r); return g; },
  monocle(){ const g = new THREE.Group(); const r = torus(.2,.025,'#C9A227'); r.position.set(-.08,1.17,.5); r.rotation.x = -.38; g.add(r);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(.2,24), mat('#E8E4F7',{transparent:true,opacity:.45})); gl.position.copy(r.position); gl.rotation.x = -.38; gl.position.z += .01; g.add(gl); return g; },
  pointer(){ const g = new THREE.Group(); const s = cyl(.018,.018,1.0,'#E8C48A'); g.add(s); const t = cyl(.025,.018,.08,'#E92F7C'); t.position.y = .52; g.add(t);
    g.position.set(.62,1.0,.18); g.rotation.set(.2,0,-.45); return g; },
  cap(){ const g = new THREE.Group(); const dome = new THREE.Mesh(new THREE.SphereGeometry(.54,32,16,0,Math.PI*2,0,Math.PI/3.6), mat('#D9406F')); dome.position.y = .98; dome.castShadow = true; g.add(dome);
    const brim = cyl(.32,.32,.035,'#C2325F',24); brim.scale.set(1,1,.62); brim.position.set(0,1.36,.36); brim.rotation.x = .3; g.add(brim);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(.42,.16), new THREE.MeshBasicMaterial({ map:capTex, transparent:true })); logo.position.set(0,1.47,.27); logo.rotation.x = -.95; g.add(logo);
    g.rotation.y = 0; return g; },
  chart(){ const g = new THREE.Group(); g.add(box(.42,.34,.02,'#FFFFFF')); [['#E92F7C',.1],['#FFC53D',.18],['#35C6E8',.26]].forEach(([c,h],i) => { const b = box(.07,h,.02,c); b.position.set(-.12+i*.12,-.13+h/2,.015); g.add(b); });
    g.position.set(.56,.84,.3); g.rotation.set(-.2,-.5,0); return g; },
  pie(){ const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.04,24,1,false,0,Math.PI*1.4), mat('#35C6E8')); const b = new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.04,24,1,false,Math.PI*1.4,Math.PI*.6), mat('#E92F7C'));
    g.add(a,b); g.rotation.x = Math.PI/2; g.position.set(.58,.86,.3); return g; },
  megaphone(){ const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(.06,.19,.38,20,1,true), mat('#E92F7C',{side:THREE.DoubleSide})); g.add(c);
    const h = box(.05,.14,.05,'#1C1033'); h.position.set(0,-.06,-.08); g.add(h); g.rotation.set(Math.PI/2,0,-.3); g.position.set(.6,.92,.38); return g; },
  briefcase(){ const g = new THREE.Group(); g.add(box(.38,.27,.11,'#E92F7C')); const h = torus(.07,.018,'#A5175A',Math.PI); h.position.y = .135; g.add(h); const lk = box(.08,.03,.01,'#FFFFFF'); lk.position.set(0,.03,.06); g.add(lk);
    g.position.set(.62,.42,.08); return g; },
  flag(){ const g = new THREE.Group(); const p = cyl(.018,.018,.8,'#5B5270'); g.add(p); const f = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.4,0),new THREE.Vector3(.32,.3,0),new THREE.Vector3(0,.18,0)]), mat('#FFC53D',{side:THREE.DoubleSide}));
    g.add(f); g.position.set(.58,.98,.15); g.rotation.z = -.1; return g; },
  pencil(){ const g = new THREE.Group(); const b = cyl(.045,.045,.48,'#FFC53D',6); g.add(b); const t = new THREE.Mesh(new THREE.ConeGeometry(.045,.1,6), mat('#E8C48A')); t.position.y = -.29; t.rotation.x = Math.PI; g.add(t);
    const e = cyl(.045,.045,.06,'#E92F7C',6); e.position.y = .27; g.add(e); g.position.set(.58,.9,.24); g.rotation.set(.3,0,-.5); return g; },
  palette(){ const g = new THREE.Group(); ['#E92F7C','#FFC53D','#35C6E8'].forEach((c,i) => { const b = box(.12,.3,.012,c); b.position.set(i*.04,0,i*.012); b.rotation.z = -.35+i*.35; g.add(b); });
    g.position.set(.56,.86,.32); g.rotation.x = -.3; return g; },
  scroll(){ const g = new THREE.Group(); const s = cyl(.07,.07,.55,'#3E7BD6'); s.rotation.z = Math.PI/2; g.add(s); const end = cyl(.075,.075,.04,'#FFFFFF'); end.rotation.z = Math.PI/2; end.position.x = .28; g.add(end);
    g.position.set(.42,.78,.42); g.rotation.y = .4; return g; },
  gear(){ const g = new THREE.Group(); g.add(torus(.13,.05,'#FFC53D')); for (let i=0;i<8;i++){ const t = box(.07,.07,.07,'#FFC53D'); const a = i/8*Math.PI*2; t.position.set(Math.cos(a)*.2,Math.sin(a)*.2,0); t.rotation.z = a; g.add(t); }
    g.position.set(.6,.86,.3); g.rotation.y = -.4; return g; },
  timer(){ const g = new THREE.Group(); const d = cyl(.17,.17,.06,'#FFFFFF',24); d.rotation.x = Math.PI/2; g.add(d); const r = torus(.17,.025,'#FF8A3D'); g.add(r);
    const k = cyl(.03,.03,.07,'#FF8A3D'); k.position.y = .22; g.add(k); const hnd = box(.02,.12,.01,'#1C1033'); hnd.position.set(.03,.04,.04); hnd.rotation.z = -.6; g.add(hnd); g.position.set(.58,.88,.32); return g; },
  calendar(){ const g = new THREE.Group(); g.add(box(.34,.36,.02,'#FFFFFF')); const t = box(.34,.08,.025,'#FF8A3D'); t.position.y = .14; g.add(t);
    for (let r=0;r<3;r++) for (let c=0;c<4;c++){ const d = box(.05,.04,.01,r===1&&c===2?'#E92F7C':'#D9D6E6'); d.position.set(-.11+c*.075,.04-r*.08,.015); g.add(d); }
    g.position.set(.56,.84,.3); g.rotation.set(-.2,-.5,0); return g; },
  flask(){ const g = new THREE.Group(); const b = ball(.15,'#7FE0C2'); g.add(b); const n = cyl(.05,.05,.18,'#E8E4F7'); n.position.y = .18; g.add(n); g.position.set(.58,.9,.3); return g; },
  database(){ const g = new THREE.Group(); for (let i=0;i<3;i++){ const c = cyl(.16,.16,.09,i===1?'#35C6E8':'#0B7A93',20); c.position.y = i*.11; g.add(c); } g.position.set(.6,.72,.28); return g; },
  cards(){ const g = new THREE.Group(); ['#FFC53D','#E92F7C','#35C6E8'].forEach((c,i) => { const b = box(.2,.2,.012,c); b.position.set(i*.06,i*.05,i*.01); b.rotation.z = (i-1)*.18; g.add(b); });
    g.position.set(.56,.86,.32); g.rotation.x = -.25; return g; },
  backpack(){ const g = new THREE.Group(); const b = box(.5,.5,.24,'#FFC53D'); b.position.set(0,.98,-.56); g.add(b); const p = box(.36,.18,.08,'#E9A800'); p.position.set(0,.88,-.71); g.add(p);
    [-1,1].forEach(s => { const st = box(.06,.6,.04,'#E9A800'); st.position.set(s*.2,.98,-.38); g.add(st); }); return g; },
  play(){ const g = new THREE.Group(); const d = cyl(.17,.17,.04,'#E92F7C',24); d.rotation.x = Math.PI/2; g.add(d);
    const tri = new THREE.Shape(); tri.moveTo(-.05,-.07); tri.lineTo(.08,0); tri.lineTo(-.05,.07); const t = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat('#FFFFFF')); t.position.z = .025; g.add(t);
    g.position.set(.58,.9,.32); return g; }
};

// ---------- mascot character ----------
function makeChar(role, isPlayer){
  const bodyM = role.bodyColor ? new THREE.MeshToonMaterial({ color:role.bodyColor }) : role.dark ? DARK_BODY : BODY;
  const outM = role.outlineColor ? new THREE.MeshBasicMaterial({ color:role.outlineColor, side:THREE.BackSide }) : role.dark ? DARK_OUTLINE : OUTLINE;
  const legM = role.outfit ? mat(role.outfit.legs) : bodyM, footM = role.outfit ? mat(role.outfit.feet) : bodyM;
  const root = new THREE.Group(); const inner = new THREE.Group(); root.add(inner);
  const R = .5, cy = .98;
  const body = new THREE.Mesh(G.sphere, bodyM); body.scale.setScalar(R); body.position.y = cy; body.castShadow = true; inner.add(body);
  const bo = new THREE.Mesh(G.sphere, outM); bo.scale.setScalar(R*1.055); bo.position.y = cy; inner.add(bo);
  const eyeMat = new THREE.MeshBasicMaterial({ map:FACE.open, transparent:true, polygonOffset:true, polygonOffsetFactor:-2 });
  const eye = new THREE.Mesh(G.eye, eyeMat); const ea = .36; eye.position.set(0, cy + R*1.012*Math.sin(ea), R*1.012*Math.cos(ea)); eye.rotation.x = -ea; inner.add(eye);
  const mouthMat = new THREE.MeshBasicMaterial({ map:FACE.mO, transparent:true, polygonOffset:true, polygonOffsetFactor:-2 });
  const mouth = new THREE.Mesh(G.mouth, mouthMat); const ma = -.2; mouth.position.set(0, cy + R*1.01*Math.sin(ma), R*1.01*Math.cos(ma)); mouth.rotation.x = -ma; inner.add(mouth);
  const hands = [-1,1].map(s => { const h = new THREE.Mesh(G.sphere, bodyM); h.scale.setScalar(.13); h.position.set(s*.5, cy-.16, .1); h.castShadow = true; inner.add(h);
    const ho = new THREE.Mesh(G.sphere, outM); ho.scale.setScalar(.155); ho.position.copy(h.position); inner.add(ho); return h; });
  const legs = [-1,1].map(s => { const piv = new THREE.Group(); piv.position.set(s*.17, .5, 0);
    const l = new THREE.Mesh(G.leg, legM); l.position.y = -.24; l.castShadow = true; piv.add(l);
    const lo = new THREE.Mesh(G.legOut, outM); lo.position.y = -.24; piv.add(lo);
    const f = new THREE.Mesh(G.sphere, footM); f.scale.set(.13,.07,.17); f.position.set(0,-.44,.05); piv.add(f);
    const fo = new THREE.Mesh(G.sphere, outM); fo.scale.set(.15,.085,.19); fo.position.copy(f.position); piv.add(fo);
    root.add(piv); return piv; });
  const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: isPlayer ? '#E92F7C' : GROUPS[role.group].color, transparent:true, opacity: isPlayer ? .55 : .38, depthWrite:false }));
  ring.rotation.x = -Math.PI/2; ring.position.y = .02; root.add(ring);
  (role.props || []).forEach(p => { if (PROPS[p]) inner.add(PROPS[p]()); });
  body.userData.pick = true;
  return { root, inner, body, eye, mouth, legs, hands, ring };
}
function setFace(o, eye, mouth){ o.eye.material.map = FACE[eye]; o.mouth.material.map = FACE[mouth]; }

// ---------- world ----------
let world = null, chars = [], player = null, rooms = [], grid = null, scaleKey = 'small', mode = 'explore';
let bounds = { x0:0, x1:0, z0:0, z1:0 };
const labels = []; // {el, pos:Vector3, kind}
const met = perScale(() => new Set());

function lerpHex(a, b, t){ const A = new THREE.Color(a), B = new THREE.Color(b); return A.lerp(B, t); }
let floorMesh = null; const roomFloors = [];
function applyTheme(){
  scene.background = new THREE.Color(cssVar('--scene-bg') || '#EEE9F8');
  if (floorMesh) floorMesh.material.color.set(cssVar('--scene-floor') || '#F7F4FC');
  roomFloors.forEach(({ m, c }) => m.material.color.copy(isDark() ? lerpHex(c, '#2A2052', .72) : new THREE.Color(c)));
}

function buildGrid(){
  const cs = .5, x0 = bounds.x0, z0 = bounds.z0, cols = Math.ceil((bounds.x1-x0)/cs), rows = Math.ceil((bounds.z1-z0)/cs);
  grid = { cs, x0, z0, cols, rows, b: new Uint8Array(cols*rows) };
}
function blockRect(cx, cz, w, d, pad=.32){
  const g = grid; const xa = Math.floor((cx-w/2-pad-g.x0)/g.cs), xb = Math.floor((cx+w/2+pad-g.x0)/g.cs);
  const za = Math.floor((cz-d/2-pad-g.z0)/g.cs), zb = Math.floor((cz+d/2+pad-g.z0)/g.cs);
  for (let z=Math.max(0,za); z<=Math.min(g.rows-1,zb); z++) for (let x=Math.max(0,xa); x<=Math.min(g.cols-1,xb); x++) g.b[z*g.cols+x] = 1;
}
const cellOf = (x,z) => [Math.floor((x-grid.x0)/grid.cs), Math.floor((z-grid.z0)/grid.cs)];
const cellFree = (cx,cz) => cx>=0 && cz>=0 && cx<grid.cols && cz<grid.rows && !grid.b[cz*grid.cols+cx];
const free = (x,z) => { const [cx,cz] = cellOf(x,z); return cellFree(cx,cz); };
const cellCenter = (cx,cz) => [grid.x0+(cx+.5)*grid.cs, grid.z0+(cz+.5)*grid.cs];
function nearestFree(x,z){ let [cx,cz] = cellOf(x,z); if (cellFree(cx,cz)) return [x,z];
  for (let r=1;r<20;r++) for (let dz=-r;dz<=r;dz++) for (let dx=-r;dx<=r;dx++){ if (Math.abs(dx)!==r && Math.abs(dz)!==r) continue; if (cellFree(cx+dx,cz+dz)) return cellCenter(cx+dx,cz+dz); }
  return [x,z]; }
function los(ax,az,bx,bz){ const d = Math.hypot(bx-ax,bz-az), n = Math.ceil(d/.2); for (let i=1;i<=n;i++){ const t = i/n; if (!free(ax+(bx-ax)*t, az+(bz-az)*t)) return false; } return true; }
function findPath(sx,sz,tx,tz){
  [tx,tz] = nearestFree(tx,tz); [sx,sz] = nearestFree(sx,sz);
  if (los(sx,sz,tx,tz)) return [[tx,tz]];
  const g = grid, N = g.cols*g.rows, [scx,scz] = cellOf(sx,sz), [tcx,tcz] = cellOf(tx,tz);
  const start = scz*g.cols+scx, goal = tcz*g.cols+tcx;
  const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [], hf = [];
  const push = (i,f) => { heap.push(i); hf.push(f); let k = heap.length-1; while (k>0){ const p = (k-1)>>1; if (hf[p] <= hf[k]) break; [heap[p],heap[k]] = [heap[k],heap[p]]; [hf[p],hf[k]] = [hf[k],hf[p]]; k = p; } };
  const pop = () => { const top = heap[0]; const li = heap.pop(), lf = hf.pop(); if (heap.length){ heap[0] = li; hf[0] = lf; let k = 0; for(;;){ const l = 2*k+1, r = l+1; let m = k; if (l<heap.length && hf[l]<hf[m]) m = l; if (r<heap.length && hf[r]<hf[m]) m = r; if (m===k) break; [heap[m],heap[k]] = [heap[k],heap[m]]; [hf[m],hf[k]] = [hf[k],hf[m]]; k = m; } } return top; };
  const h = (x,z) => { const dx = Math.abs(x-tcx), dz = Math.abs(z-tcz); return Math.max(dx,dz) + .414*Math.min(dx,dz); };
  gs[start] = 0; push(start, h(scx,scz));
  const D = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  let found = false, guard = 0;
  while (heap.length && guard++ < 60000){
    const cur = pop(); if (cur === goal){ found = true; break; } if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % g.cols, cz = (cur/g.cols)|0;
    for (const [dx,dz,c] of D){ const nx = cx+dx, nz = cz+dz; if (!cellFree(nx,nz)) continue; if (dx && dz && (!cellFree(cx+dx,cz) || !cellFree(cx,cz+dz))) continue;
      const ni = nz*g.cols+nx, ng = gs[cur]+c; if (ng < gs[ni]){ gs[ni] = ng; came[ni] = cur; push(ni, ng + h(nx,nz)); } }
  }
  if (!found) return [[tx,tz]];
  const cells = []; for (let c = goal; c !== -1 && c !== start; c = came[c]) cells.push(c); cells.reverse();
  const pts = cells.map(c => cellCenter(c % g.cols, (c/g.cols)|0)); pts[pts.length-1] = [tx,tz];
  // string-pull
  const out = []; let ax = sx, az = sz, i = 0;
  while (i < pts.length){ let j = pts.length-1; while (j > i && !los(ax,az,pts[j][0],pts[j][1])) j--; out.push(pts[j]); [ax,az] = pts[j]; i = j+1; }
  return out;
}

function addLabel(html, cls, pos, extra){ const el = document.createElement('div'); el.className = 'lbl ' + cls; el.innerHTML = html; overlay.appendChild(el); const L = Object.assign({ el, pos, cls }, extra||{}); labels.push(L); return L; }

function buildWorld(key){
  scaleKey = key;
  if (world){ scene.remove(world); }
  labels.forEach(l => l.el.remove()); labels.length = 0; roomFloors.length = 0;
  world = new THREE.Group(); scene.add(world);
  rooms = SCALES[key].rooms; chars = []; player = null;
  bounds = { x0: Math.min(...rooms.map(r => r.x - r.w/2)) - 5, x1: Math.max(...rooms.map(r => r.x + r.w/2)) + 5,
             z0: Math.min(...rooms.map(r => r.z - r.d/2)) - 5, z1: Math.max(...rooms.map(r => r.z + r.d/2)) + 5 };
  buildGrid();
  const fw = bounds.x1-bounds.x0, fd = bounds.z1-bounds.z0;
  floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(fw+40, fd+40), new THREE.MeshLambertMaterial({ color: cssVar('--scene-floor') || '#F7F4FC' }));
  floorMesh.rotation.x = -Math.PI/2; floorMesh.position.set((bounds.x0+bounds.x1)/2, 0, (bounds.z0+bounds.z1)/2); floorMesh.receiveShadow = true; world.add(floorMesh);
  // map edge is walkable limit
  for (let x=0;x<grid.cols;x++){ grid.b[x] = 1; grid.b[(grid.rows-1)*grid.cols+x] = 1; } for (let z=0;z<grid.rows;z++){ grid.b[z*grid.cols] = 1; grid.b[z*grid.cols+grid.cols-1] = 1; }

  rooms.forEach(r => buildRoom(r));
  { const hub = rooms.find(r => r.kind === 'lounge') || rooms.find(r => r.id === 'R08') || rooms[0];
    if (AUTHOR_ID){ const [hx, hz] = nearestFree(hub.x + 1.6, hub.z + hub.d/2 - 1.2); const nl = addChar(AUTHOR_ID, hub, hx, hz, Math.PI); nl.ai = { s:'idle', t:3 }; nl.speed = 3.2; } }
  chars.forEach(c => { c.obj.root.position.set(c.seat.x, 0, c.seat.z); c.obj.root.rotation.y = c.seat.rot; c.heading = c.seat.rot; if (!c.isPlayer && !c.roamer) sitDown(c, 2 + Math.random()*10); });
  { const pc = chars.find(c => c.isPlayer); const [px, pz] = nearestFree(pc.seat.x - Math.sin(pc.seat.rot)*1.0, pc.seat.z - Math.cos(pc.seat.rot)*1.0); pc.obj.root.position.set(px, 0, pz); }
  spot = makeSpot();
  cornerLogo(chars.find(c => c.isPlayer).room);
  rooms.filter(r => r.kind === 'lounge').forEach(cornerLogo);
  lastRoom = undefined;
  player = chars.find(c => c.isPlayer);
  $('#mett').textContent = $('#map-mett').textContent = new Set(chars.filter(c => !c.isPlayer && !c.roamer && !c.guest).map(c => c.role.id)).size;
  updateMet(); applyTheme();
  // màn hình dọc (mobile) thấy ít theo chiều ngang, nên lùi camera ra xa hơn
  placeCamera(player.obj.root.position, camY.overview ? camY.dist : Math.round(18 * Math.min(1.6, Math.max(1, .8 / camera.aspect))));
}

let decorRoom = null;
function buildRoom(r){
  const wallH = r.kind === 'glass' ? .9 : r.kind === 'locked' ? 1.7 : .6, t = .22;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), new THREE.MeshLambertMaterial({ color:r.floor }));
  fl.rotation.x = -Math.PI/2; fl.position.set(r.x, .012, r.z); fl.receiveShadow = true; world.add(fl); roomFloors.push({ m:fl, c:r.floor });
  floorText(r.code.toUpperCase(), r.name.toUpperCase(), r.x, r.z - r.d/2 + (r.kind === 'locked' ? -1.9 : .95), Math.min(r.w - 1, 9));
  if (r.kind === 'lounge'){ // open pantry, no walls
    const tb = cyl(.9,.9,.08,'#FFFFFF',28); tb.position.set(r.x,.72,r.z); world.add(tb); const leg = cyl(.08,.08,.7,'#5B5270'); leg.position.set(r.x,.36,r.z); world.add(leg); blockRect(r.x, r.z, 1.8, 1.8, .2);
    r.gather = (k) => Array.from({ length:k }, (_,i) => [r.x - 2.3, r.z + (i-(k-1)/2)*1.2]);
    if (GUEST_ID){ const ux = r.x + 1.5, uz = r.z + .2; chair(ux, uz, -Math.PI/2); addChar(GUEST_ID, r, ux, uz, -Math.PI/2); }
    decorRoom = r; decor(r); decorRoom = null;
    return;
  }
  const wm = r.kind === 'glass' ? mat('#9FE3F2',{ transparent:true, opacity:.35 }) : mat('#FFFFFF');
  const doors = r.kind === 'locked' ? [] : (r.doors || [{side:'n',off:0},{side:'s',off:0},{side:'e',off:0},{side:'w',off:0}]);
  const sides = { n:[r.x, r.z-r.d/2, r.w, 'x'], s:[r.x, r.z+r.d/2, r.w, 'x'], w:[r.x-r.w/2, r.z, r.d, 'z'], e:[r.x+r.w/2, r.z, r.d, 'z'] };
  for (const [side, [cx, cz, len, axis]] of Object.entries(sides)){
    const gaps = doors.filter(d => d.side === side).map(d => d.off).sort((a,b) => a-b);
    let segs = [[-len/2, len/2]];
    gaps.forEach(o => { segs = segs.flatMap(([a,b]) => (o-1.3 > a && o+1.3 < b) ? [[a,o-1.3],[o+1.3,b]] : [[a,b]]); });
    segs.forEach(([a,b]) => { const L = b-a, m = (a+b)/2; if (L < .05) return;
      const w = new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?L:t, wallH, axis==='x'?t:L), wm);
      const px = axis==='x' ? cx+m : cx, pz = axis==='x' ? cz : cz+m; w.position.set(px, wallH/2, pz); w.castShadow = r.kind !== 'glass'; w.receiveShadow = true; world.add(w);
      if (r.kind !== 'glass'){ const cap = new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?L:t+.02, .04, axis==='x'?t+.02:L), mat('#CFC6E6')); cap.position.set(px, wallH+.02, pz); world.add(cap); }
      blockRect(px, pz, axis==='x'?L:t, axis==='x'?t:L); });
  }
  if (r.kind === 'locked'){
    const door = box(2.2, 1.6, .12, '#E92F7C'); door.position.set(r.x, .8, r.z - r.d/2 - .05); world.add(door);
    const knob = ball(.07,'#FFC53D'); knob.position.set(r.x+.75, .8, r.z - r.d/2 - .14); world.add(knob);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), mat('#D9D2EA',{ transparent:true, opacity:.75 })); roof.rotation.x = -Math.PI/2; roof.position.set(r.x, wallH+.03, r.z); world.add(roof);
    r.doorPoint = [r.x, r.z - r.d/2 - 1.1];
    return;
  }
  // furniture + seats
  const n = r.members.length;
  if (r.kind === 'meeting'){
    const tb = cyl(1.5,1.5,.1,'#FFFFFF',36); tb.position.set(r.x,.66,r.z); tb.receiveShadow = true; world.add(tb);
    const leg = cyl(.12,.2,.62,'#5B5270'); leg.position.set(r.x,.31,r.z); world.add(leg); blockRect(r.x, r.z, 3, 3, .05);
    r.members.forEach((id,i) => { const a = -Math.PI/2 + i/Math.max(n,1)*Math.PI*2 + (n>1?.3:0); const x = r.x + Math.cos(a)*2.25, z = r.z + Math.sin(a)*2.25;
      const rot = Math.atan2(r.x-x, r.z-z); chair(x, z, rot); addChar(id, r, x, z, rot); });
    r.gather = (k) => Array.from({ length:k }, (_,i) => { const a = Math.PI/2 + (i-(k-1)/2)*.62; return [r.x + Math.cos(a)*2.4, r.z + Math.sin(a)*2.4]; });
  } else {
    const tall = r.d > r.w * 1.5, cols = Math.max(1, Math.ceil(n/2)), sp = tall ? 2.6 : 1.9, len = cols*sp + .3;
    const dw = tall ? 1.1 : len, dd = tall ? len : 1.1;
    const dx = r.x, dz = tall ? r.z : r.z - .4;
    const top = box(dw, .08, dd, '#FFFFFF'); top.position.set(dx, .64, dz); top.receiveShadow = true; world.add(top);
    const base = box(dw-.3, .6, dd-.3, '#DCD5EE'); base.position.set(dx, .3, dz); world.add(base); blockRect(dx, dz, dw, dd, .12);
    if (tall){ addHide(r, dx, dz - dd/2 - .5); addHide(r, dx, dz + dd/2 + .5); } else { addHide(r, dx - dw/2 - .5, dz); addHide(r, dx + dw/2 + .5, dz); }
    r.members.forEach((id,i) => { const col = Math.floor(i/2), side = i%2 ? 1 : -1, along = (col-(cols-1)/2)*sp, across = side*1.15;
      const x = tall ? dx + across : dx + along, z = tall ? dz + along : dz + across;
      const rot = tall ? (side < 0 ? Math.PI/2 : -Math.PI/2) : (side < 0 ? 0 : Math.PI);
      chair(x, z, rot); const c = addChar(id, r, x, z, rot);
      c.screen = deskGear(tall ? dx + side*.3 : x, tall ? z : dz + side*.3, rot, i, c.role.group); });
    r.gather = (k) => Array.from({ length:k }, (_,i) => tall ? [r.x - r.w/2 + 1.4, r.z + (i-(k-1)/2)*1.2] : [r.x + (i-(k-1)/2)*1.25, r.z + r.d/2 - 1.5]);
  }
  if (TV_ROOMS[r.id] !== undefined) addTV(r, TV_ROOMS[r.id]);
  decorRoom = r; decor(r); decorRoom = null;
}
const screenCache = {};
function screenTex(kind){
  if (screenCache[kind]) return screenCache[kind];
  const t = tex((g) => { const W = 256, H = 160;
    if (kind === 'code'){ g.fillStyle = '#1C1033'; g.fillRect(0,0,W,H); const cols = ['#35C6E8','#E92F7C','#FFC53D','#BEB3DA'];
      for (let i=0;i<11;i++){ g.fillStyle = cols[(i*7)%4]; g.fillRect(16 + (i%3)*12, 12 + i*13, 40 + ((i*37)%120), 6); } }
    else if (kind === 'figma'){ g.fillStyle = '#E9E6F2'; g.fillRect(0,0,W,H); g.fillStyle = '#FFFFFF'; g.fillRect(0,0,46,H); g.fillRect(W-40,0,40,H);
      [[60,22],[112,22],[164,22]].forEach(([x,y],i) => { g.fillStyle = '#FFFFFF'; g.fillRect(x,y,44,84); g.fillStyle = i===1?'#E92F7C':'#7676B8'; g.fillRect(x+6,y+8,32,8); g.fillStyle = '#D9D6E6'; g.fillRect(x+6,y+24,32,22); g.fillRect(x+6,y+52,20,6); });
      g.strokeStyle = '#35C6E8'; g.lineWidth = 2; g.strokeRect(110,20,48,88); }
    else if (kind === 'chart'){ g.fillStyle = '#FFFFFF'; g.fillRect(0,0,W,H); const hs = [40,70,55,96,80,118];
      hs.forEach((h,i) => { g.fillStyle = i===5?'#E92F7C':'#35C6E8'; g.fillRect(24+i*36, H-14-h, 22, h); }); g.strokeStyle = '#FFC53D'; g.lineWidth = 4; g.beginPath(); g.moveTo(24,110); g.lineTo(120,80); g.lineTo(230,30); g.stroke(); }
    else { g.fillStyle = '#F2EEFA'; g.fillRect(0,0,W,H); ['To do','Doing','Done'].forEach((_,c) => { for (let k=0;k<3-c%2;k++){ g.fillStyle = ['#FFC53D','#35C6E8','#E92F7C'][c]; g.fillRect(14+c*82, 16+k*44, 66, 34); } }); }
  }, 256);
  t.repeat.set(1, .625); t.offset.set(0, .375); return (screenCache[kind] = t);
}
const LOGO_PATHS = [
  'M220.536 284.614C220.536 322.035 251.951 352.817 290.141 352.817C328.332 352.817 359.746 322.035 359.746 284.614C359.746 247.192 328.332 216.411 290.141 216.411C251.951 216.411 220.536 247.192 220.536 284.614Z',
  'M64.6923 157.262C127.522 51.0337 258.725 3.95547 375.145 43.7909L366.521 66.7265C323.403 52.2409 275.972 49.8266 229.158 61.8979C117.666 91.4727 44.9811 194.079 56.0686 306.343L86.2515 303.325C76.3959 205.547 139.842 116.219 237.166 90.2656C334.49 64.9158 434.894 111.39 476.781 200.718L503.884 188.647C480.477 139.155 441.054 100.526 394.24 78.1943L413.951 27.4946L400.4 21.4589C266.733 -32.8621 110.891 19.0447 38.8213 142.172C-33.864 265.3 -1.83318 423.435 112.739 509.745L131.218 486.206C28.3497 408.949 0.0147582 267.111 64.6923 157.262Z',
  'M483.555 114.408C558.704 196.493 571.64 316 514.97 411.967C450.292 522.42 311.082 568.895 190.966 520.006L179.263 547.166C214.989 561.652 252.564 568.895 289.523 568.895C390.543 568.895 488.483 516.988 541.457 427.056C604.287 320.225 590.119 186.836 506.346 95.0941L483.555 114.408Z',
  'M76.3962 379.978C115.203 463.874 199.592 515.177 289.524 515.177C309.851 515.177 330.179 512.762 351.122 507.33C461.998 477.756 534.683 375.149 523.595 262.886L493.413 265.903C503.268 363.681 439.823 453.613 342.498 478.963C250.718 503.105 155.241 462.666 109.659 381.788L132.45 372.131C147.85 398.688 170.641 421.624 198.976 437.317C227.311 453.613 258.725 461.459 289.524 461.459C338.186 461.459 386.233 442.145 421.343 404.724L431.815 393.256L389.312 357.646C396.704 347.989 402.864 336.521 407.176 324.449C424.423 275.56 408.408 220.636 366.521 188.647L348.042 211.582C379.457 236.329 391.776 277.371 378.841 314.792C365.905 352.214 329.563 376.96 289.524 377.563V407.138C319.091 407.138 346.81 396.878 368.369 378.77L387.465 395.067C339.418 436.713 269.813 443.956 213.759 411.967C211.911 410.76 209.447 409.552 207.599 408.345L241.478 366.699L229.774 357.646C198.36 332.899 186.04 291.857 198.976 254.436C211.911 217.014 248.254 192.268 288.292 191.665V162.09C258.725 162.09 230.39 172.954 208.831 190.457L190.968 174.161C239.014 132.515 308.62 125.272 365.289 157.261C426.271 191.665 454.606 262.282 433.663 328.071L462.614 336.521C487.869 257.453 453.99 172.954 380.689 131.308C307.388 89.6617 215.607 103.544 157.705 164.504L147.234 175.368L189.12 211.582C181.728 221.239 175.568 232.104 171.873 244.175C156.473 288.235 168.177 337.124 201.439 370.32L185.424 389.635C145.386 351.61 129.37 294.875 146.618 240.554L117.667 232.104C105.347 270.128 107.195 309.964 120.131 344.971L69.0045 366.096L76.3962 379.978Z'
].map(d => new Path2D(d));
function drawLogo(g, x, y, size, color){ g.save(); g.translate(x, y); g.scale(size/581, size/581); g.fillStyle = color; LOGO_PATHS.forEach(p => g.fill(p)); g.restore(); }
function slideTex(title, sub, idle){
  const st = tex((g) => { const W = 512; g.fillStyle = '#170B3D'; g.fillRect(0,0,W,W);
    if (idle){
      drawLogo(g, 40, 64, 160, '#F4F0FB');
      g.fillStyle = '#F4F0FB'; g.font = '700 46px "Be Vietnam Pro", sans-serif'; g.fillText('TELOS', 228, 128);
      g.fillStyle = '#E92F7C'; g.font = '600 24px Oswald, "Be Vietnam Pro", sans-serif'; g.fillText('ACADEMY', 230, 162);
      g.fillStyle = '#BEB3DA'; g.font = '500 20px "Be Vietnam Pro", sans-serif'; g.fillText(sub || '', 230, 200, 260);
      g.fillStyle = '#E92F7C'; g.fillRect(40, 256, 432, 6);
    } else {
      g.fillStyle = '#E92F7C'; g.fillRect(36,60,70,10); g.fillStyle = '#F4F0FB'; g.font = '700 38px "Be Vietnam Pro", sans-serif'; g.fillText(title, 36, 120, 380);
      g.fillStyle = '#BEB3DA'; g.font = '500 22px "Be Vietnam Pro", sans-serif'; g.fillText(sub || '', 36, 158, 380);
      drawLogo(g, 420, 40, 56, '#F4F0FB');
      [['#35C6E8',36],['#FFC53D',196],['#E92F7C',356]].forEach(([c,x]) => { g.fillStyle = '#241354'; g.fillRect(x,186,120,80); g.fillStyle = c; g.fillRect(x+12,198,96,14); g.fillStyle = '#3A2C68'; g.fillRect(x+12,222,70,10); g.fillRect(x+12,240,90,10); });
    }
  }, 512);
  st.repeat.set(1, .5625); st.offset.set(0, .4375); return st;
}
function cornerLogo(r){
  // one large faded logo in the south-east corner, about a third of it cropped by the walls
  const P = Math.min(r.w, r.d) * .55;
  const t = tex((g) => { const S = 512, L = S * 1.05; drawLogo(g, S - L*2/3, S - L*.8, L, 'rgba(36,23,117,.15)'); }, 512);
  t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(P, P), new THREE.MeshBasicMaterial({ map:t, transparent:true, depthWrite:false }));
  m.rotation.x = -Math.PI/2; m.position.set(r.x + r.w/2 - P/2 - .11, .02, r.z + r.d/2 - P/2 - .11); world.add(m);
}
function chair(x, z, rot){
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  const seat = box(.5,.07,.46,'#3A2C68'); seat.position.y = .44; g.add(seat);
  const back = box(.5,.46,.07,'#3A2C68'); back.position.set(0,.7,-.5); g.add(back);
  const post = cyl(.035,.035,.42,'#5B5270'); post.position.set(0,.22,-.1); g.add(post);
  const foot = cyl(.22,.22,.03,'#5B5270',12); foot.position.set(0,.02,-.1); g.add(foot);
  world.add(g);
}
function deskGear(x, z, rot, i, group){
  const g = new THREE.Group(); g.position.set(x, .68, z); g.rotation.y = rot + Math.PI;
  const smat = new THREE.MeshBasicMaterial({ map: screenTex(SCREEN_KIND[group] || 'board') });
  const pc = group === 'engineering' || group === 'data' || (group === 'design' && i % 2 === 0);
  let screen;
  if (pc){
    const base = box(.24,.02,.16,'#5B5270'); base.position.set(0,.01,-.05); g.add(base);
    const st = cyl(.03,.03,.22,'#5B5270'); st.position.set(0,.12,-.05); g.add(st);
    const fr = box(.58,.36,.035,'#1C1033'); fr.position.set(0,.37,-.05); g.add(fr);
    screen = new THREE.Mesh(new THREE.PlaneGeometry(.54,.32), smat); screen.position.set(0,.37,-.03); g.add(screen);
    const kb = box(.42,.02,.13,'#FFFFFF'); kb.position.set(0,.01,.22); g.add(kb);
    const ms = ball(.035,'#FFFFFF'); ms.scale.set(.035,.02,.05); ms.position.set(.3,.015,.24); g.add(ms);
  } else {
    const base = box(.42,.025,.28,'#D9D6E6'); base.position.set(0,.012,.12); g.add(base);
    const lid = new THREE.Group(); lid.position.set(0,.02,-.02); lid.rotation.x = -.28; g.add(lid);
    const fr = box(.42,.28,.018,'#D9D6E6'); fr.position.y = .14; lid.add(fr);
    screen = new THREE.Mesh(new THREE.PlaneGeometry(.38,.24), smat); screen.position.set(0,.14,.011); lid.add(screen);
  }
  const mug = cyl(.045,.04,.1,['#E92F7C','#FFC53D','#35C6E8'][i % 3],12); mug.position.set(pc ? -.38 : .32, .05, .15); g.add(mug);
  world.add(g); return screen;
}
function addTV(r, off){
  const x = r.x + off, z = r.z - r.d/2 + .45;
  const cab = box(2.3,.5,.42,'#FFFFFF'); cab.position.set(x,.25,z); world.add(cab); blockRect(x, z, 2.3, .42, .1);
  const fr = box(2.7,1.55,.08,'#1C1033'); fr.position.set(x,1.35,z); world.add(fr);
  const idle = slideTex('TELOS', r.name, true);
  const sm = new THREE.MeshBasicMaterial({ map: idle });
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.5,1.4), sm); sc.position.set(x,1.35,z+.045); world.add(sc);
  r.tv = { mat:sm, idle }; r.presentSpot = nearestFree(x + 1.9, z + 1.1); addHide(r, x - 1.7, z + .4);
}
// điểm nấp cho trốn tìm: cạnh chậu cây, sau beanbag, sau TV, đầu bàn (ô đi tới được, lệch về phía trong phòng)
function addHide(r, x, z){ const dx = r.x - x, dz = r.z - z, d = Math.hypot(dx, dz) || 1, [hx, hz] = nearestFree(x + dx/d*.75, z + dz/d*.75);
  if (Math.abs(hx - r.x) < r.w/2 - .3 && Math.abs(hz - r.z) < r.d/2 - .3) (r.hideSpots = r.hideSpots || []).push([hx, hz]); }
function decor(r){
  if (r.kind === 'locked') return;
  const cx = s => r.x + s*(r.w/2 - .85), cz = s => r.z + s*(r.d/2 - .85);
  const tvWest = TV_ROOMS[r.id] !== undefined;
  if (r.kind === 'lounge'){ beanbag(cx(-1)+.2, cz(-1)+.2, '#E92F7C'); beanbag(cx(-1)+1.2, cz(-1)+.1, '#FFC53D'); beanbag(cx(1)-.3, cz(1)-.2, '#35C6E8'); plant(cx(1), cz(-1)); plant(cx(-1), cz(1)); return; }
  if (r.kind === 'glass'){ plant(r.x + r.w/2 - .8, r.z - r.d/2 + .8); plant(r.x + r.w/2 - .8, r.z + r.d/2 - .8); beanbag(r.x + r.w/2 - 1, r.z - 4.5, '#FFC53D'); beanbag(r.x + r.w/2 - 1, r.z + 5.5, '#E92F7C'); return; }
  plant(cx(1), cz(1));
  if (!tvWest) plant(cx(-1), cz(-1)); else plant(cx(1), cz(-1));
  beanbag(cx(-1), cz(1), ['#E92F7C','#FFC53D','#35C6E8'][Math.abs(Math.round(r.x+r.z)) % 3]);
}
function beanbag(x, z, c){ if (decorRoom) addHide(decorRoom, x, z); const b = ball(1, c); b.scale.set(.5,.3,.5); b.position.set(x,.28,z); b.castShadow = true; world.add(b);
  const d = ball(1, c); d.scale.set(.36,.2,.36); d.position.set(x - .05,.5,z - .05); world.add(d); blockRect(x, z, .9, .9, .1); }
function floorText(code, name, x, z, w){
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const g = c.getContext('2d');
  g.textBaseline = 'middle';
  g.font = '500 44px Oswald, "Be Vietnam Pro", sans-serif'; const cw = g.measureText(code + '   ').width;
  g.font = '700 64px "Be Vietnam Pro", Oswald, sans-serif'; const nw = g.measureText(name).width;
  const total = cw + nw, scale = Math.min(1, 980 / total); g.save(); g.translate(512 - total*scale/2, 80); g.scale(scale, scale);
  g.font = '500 44px Oswald, "Be Vietnam Pro", sans-serif'; g.fillStyle = 'rgba(74,63,140,.55)'; g.fillText(code, 0, 0);
  g.font = '700 64px "Be Vietnam Pro", Oswald, sans-serif'; g.fillStyle = 'rgba(46,36,112,.8)'; g.fillText(name, cw, 0); g.restore();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w*160/1024), new THREE.MeshBasicMaterial({ map:t, transparent:true, depthWrite:false }));
  m.rotation.x = -Math.PI/2; m.position.set(x, .03, z); world.add(m);
}
function plant(x,z){ if (decorRoom) addHide(decorRoom, x, z); const p = cyl(.22,.17,.42,'#FFFFFF'); p.position.set(x,.21,z); world.add(p); const rim = cyl(.24,.24,.06,'#E92F7C'); rim.position.set(x,.42,z); world.add(rim);
  [[0,.85,0,.3],[.16,.7,.08,.22],[-.14,.72,-.06,.22],[.02,.62,-.16,.2]].forEach(([dx,y,dz,r]) => { const b = ball(r,'#3FA87A'); b.position.set(x+dx,y,z+dz); b.castShadow = true; world.add(b); });
  blockRect(x,z,.5,.5,.1); }

function addChar(roleId, room, x, z, rot){
  const role = ROLES[roleId]; const isPlayer = roleId === PLAYER_ID;
  const obj = makeChar(role, isPlayer); world.add(obj.root);
  obj.body.userData.inst = chars.length;
  const [fx,fz] = nearestFree(x,z);
  const c = { idx:chars.length, id: roleId + '@' + room.id, role, room, isPlayer, obj, seat:{ x:fx, z:fz, rot }, path:[], speed: isPlayer ? 4.6 : 3.6, phase:Math.random()*6, seed:Math.random()*6, faceT:0, onArrive:null, walking:false };
  chars.push(c);
  c.roamer = !!role.special; c.guest = !!role.guest; c.fixed = !!(room.fixed && room.fixed.includes(roleId)); // fixed: ngồi yên, không đi dạo / tập hợp
  c.label = addLabel(isPlayer ? `${L('Bạn', 'You')} · ${role.title}` : c.roamer ? `${role.title}${role.special.tag ? ' · ' + role.special.tag.split(' · ')[0] : ''}` : c.guest ? `${role.title} · ${L('Người dùng', 'User')}` : role.title, 'name-lbl' + (isPlayer ? ' me' : c.roamer ? ' vip' : ''), new THREE.Vector3(), { inst:c });
  c.marker = addLabel('', 'qm', new THREE.Vector3(), { inst:c, marker:true }); c.marker.el.hidden = true;
  c.chatEl = addLabel('', 'chat', new THREE.Vector3(), { inst:c, chat:true }); c.chatEl.el.hidden = true;
  return c;
}
function inst(ref){ if (!ref) return null; if (ref.includes('@')) return chars.find(c => c.id === ref) || inst(ref.split('@')[0]);
  return chars.find(c => c.role.id === ref && !c.isPlayer) || null; }

// ---------- camera ----------
// Camera: always centred on the player, fixed 3/4 view; Q / E rotate in 90° steps
const camY = { yaw:Math.PI/4, yawT:Math.PI/4, dist:18, distT:18, polar:.86, target:new THREE.Vector3(), overview:false };
const controls = { target:camY.target, getAzimuthalAngle:() => camY.yaw };
const cam = { follow:true };
function applyCam(){ const p = camY.polar, t = camY.target;
  camera.position.set(t.x + Math.sin(camY.yaw)*Math.sin(p)*camY.dist, t.y + Math.cos(p)*camY.dist, t.z + Math.cos(camY.yaw)*Math.sin(p)*camY.dist); camera.lookAt(t); }
function placeCamera(pos, d){ camY.target.set(pos.x, .6, pos.z); camY.dist = camY.distT = d; applyCam(); }
function rotateCam(dir){ camY.yawT += dir*Math.PI/2; }
function dolly(f){ camY.distT = Math.min(camY.overview ? 160 : 42, Math.max(8, camY.distT*f)); }
function updateCamera(dt){
  const k = 1 - Math.exp(-dt*7);
  camY.yaw += (camY.yawT - camY.yaw)*k; camY.dist += (camY.distT - camY.dist)*k;
  const wx = camY.overview ? (bounds.x0+bounds.x1)/2 : player.obj.root.position.x, wz = camY.overview ? (bounds.z0+bounds.z1)/2 : player.obj.root.position.z;
  const kt = camY.overview ? k : 1 - Math.exp(-dt*12);
  camY.target.x += (wx - camY.target.x)*kt; camY.target.z += (wz - camY.target.z)*kt;
  applyCam();
}
canvas.addEventListener('wheel', e => { e.preventDefault(); dolly(1 + e.deltaY*.0012); }, { passive:false });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---------- input ----------
const keys = {};
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (HX && HX.onKey(e, true)) return;
  const k = e.key.toLowerCase(); keys[k] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  if (k === 'f' || k === ' ' || k === 'enter'){ if (!(e.target.closest && e.target.closest('button,a'))) interact(); }
  if (k === 'q') rotateCam(-1);
  if (k === 'e') rotateCam(1);
  if (k === 'escape'){ closePanel(); closeDialog(); }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (HX) HX.onKey(e, false); });
let drag = null;
// hai ngón tay: pinch để zoom (mobile)
const touches = new Map(); let pinch = null;
const touchGap = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
canvas.addEventListener('pointerdown', e => {
  touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (touches.size === 2){ drag = null; pinch = { gap:touchGap(), dist:camY.distT }; return; }
  if (touches.size > 2) return;
  drag = { x:e.clientX, y:e.clientY, lx:e.clientX, moved:false, button:e.button }; });
const dropTouch = e => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
addEventListener('pointercancel', e => { dropTouch(e); drag = null; });
addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (pinch && touches.size === 2){ camY.distT = Math.min(camY.overview ? 160 : 42, Math.max(8, pinch.dist * pinch.gap / touchGap())); return; }
  if (drag){ if (!drag.moved && Math.hypot(e.clientX-drag.x, e.clientY-drag.y) > 6){ drag.moved = true; canvas.style.cursor = 'grabbing'; }
    if (drag.moved){ camY.yaw -= (e.clientX - drag.lx)*.008; camY.yawT = camY.yaw; } drag.lx = e.clientX; }
  else if (e.target === canvas) hover(e);
});
addEventListener('pointerup', e => { const wasPinch = !!pinch; dropTouch(e); if (wasPinch){ drag = null; return; }
  if (drag && !drag.moved && drag.button === 0){ if (!$('#reader').hidden) closeReader(); else if (sheetOpen()) closeSheets(); click(e); } if (drag && drag.moved) canvas.style.cursor = ''; drag = null; });
$('#zin').onclick = () => dolly(.8);
$('#zout').onclick = () => dolly(1.25);
$('#rotl').onclick = () => rotateCam(-1);
$('#rotr').onclick = () => rotateCam(1);

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
function pick(e){ const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(chars.map(c => c.obj.body)); return hits.length ? chars[hits[0].object.userData.inst] : null; }
let hovered = null;
function hover(e){ const c = pick(e); hovered = c && !c.isPlayer ? c : null; canvas.style.cursor = hovered ? 'pointer' : ''; }
function groundPoint(e){ pick(e); const p = new THREE.Vector3(); return ray.ray.intersectPlane(ground, p) ? p : null; }
function click(e){
  if (HX && HX.onClick(e)) return;
  const c = pick(e);
  if (c && !c.isPlayer){ walkTo(player, c.obj.root.position.x, c.obj.root.position.z, () => talk(c), 1.3); return; }
  const p = new THREE.Vector3(); if (ray.ray.intersectPlane(ground, p)){
    const lr = rooms.find(r => r.kind === 'locked' && Math.abs(p.x-r.x) < r.w/2 && Math.abs(p.z-r.z) < r.d/2);
    if (lr){ walkTo(player, lr.doorPoint[0], lr.doorPoint[1], () => openLocked(lr)); return; }
    walkTo(player, p.x, p.z);
  }
}
function walkTo(c, x, z, onArrive, stopDist=0){
  const sx = c.obj.root.position.x, sz = c.obj.root.position.z;
  let tx = x, tz = z;
  if (stopDist){ const d = Math.hypot(x-sx, z-sz); if (d < stopDist + .2){ c.path = []; onArrive && onArrive(); return; } }
  c.path = findPath(sx, sz, tx, tz); c.stopDist = stopDist; c.stopAt = stopDist ? [x,z] : null; c.onArrive = onArrive || null;
}

// ---------- update loop ----------
const clock = new THREE.Clock(); let t = 0, frame = 0;
function stepChar(c, dt){
  const o = c.obj; let moving = false;
  if (c.frozenUntil && t < c.frozenUntil){ c.path = []; c.walking = false; return; }
  if (c.isPlayer){
    const f = (keys['w']||keys['arrowup']?1:0) - (keys['s']||keys['arrowdown']?1:0), s = (keys['d']||keys['arrowright']?1:0) - (keys['a']||keys['arrowleft']?1:0);
    if (f || s){ c.path = []; c.onArrive = null; c.sitting = false; const y = camY.yaw; let mx = -Math.sin(y)*f + Math.cos(y)*s, mz = -Math.cos(y)*f - Math.sin(y)*s; const L = Math.hypot(mx,mz); mx /= L; mz /= L;
      const p = o.root.position, nx = p.x + mx*c.speed*dt, nz = p.z + mz*c.speed*dt;
      if (free(nx, p.z)) p.x = nx; if (free(p.x, nz)) p.z = nz; c.heading = Math.atan2(mx, mz); moving = true; }
  }
  if (c.path.length){
    const p = o.root.position, [tx,tz] = c.path[0]; let dx = tx-p.x, dz = tz-p.z, d = Math.hypot(dx,dz);
    if (c.stopAt && Math.hypot(c.stopAt[0]-p.x, c.stopAt[1]-p.z) < c.stopDist){ c.path = []; d = 0; }
    else if (d < .08){ c.path.shift(); }
    else { const st = Math.min(d, c.speed*dt); p.x += dx/d*st; p.z += dz/d*st; c.heading = Math.atan2(dx,dz); moving = true; }
    if (!c.path.length){ const cb = c.onArrive; c.onArrive = null; if (c.restRot !== undefined){ c.heading = c.restRot; c.restRot = undefined; } cb && cb(); }
  }
  if (c.heading !== undefined){ let d = c.heading - o.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.root.rotation.y += d * Math.min(1, dt*10); }
  c.walking = moving;
  const amp = reduceMotion ? .3 : 1;
  if (moving){ c.phase += dt*c.speed*3.2; const sw = Math.sin(c.phase)*.6*amp; o.legs[0].rotation.x = sw; o.legs[1].rotation.x = -sw; o.inner.position.y = Math.abs(Math.sin(c.phase))*.07*amp; o.hands[0].position.z = .1 - sw*.15; o.hands[1].position.z = .1 + sw*.15; }
  else if (c.sitting){ o.legs[0].rotation.x += (-1.45 - o.legs[0].rotation.x)*.2; o.legs[1].rotation.x += (-1.45 - o.legs[1].rotation.x)*.2; o.inner.position.y = Math.sin(t*1.6 + c.seed)*.01*amp;
    const ty = c.isPlayer ? (Q.prog && Q.prog.kind === 'work') : true;
    o.hands.forEach((h,k) => { h.position.z += ((ty ? .34 : .1) - h.position.z)*.2; h.position.y = .82 + (ty ? Math.max(0, Math.sin(t*16 + c.seed + k*2))*.035*amp - .04 : 0); }); }
  else { o.legs[0].rotation.x *= .8; o.legs[1].rotation.x *= .8; o.inner.position.y = Math.sin(t*2.2 + c.seed)*.018*amp; o.hands.forEach(h => { h.position.z += (.1 - h.position.z)*.2; h.position.y += (.82 - h.position.y)*.2; }); }
  if (c.faceT > 0){ c.faceT -= dt; if (c.faceT <= 0) setFace(o, 'open', 'mO'); }
}
function project(v){ const p = v.clone().project(camera); return { x:(p.x*.5+.5)*canvas.clientWidth, y:(-p.y*.5+.5)*canvas.clientHeight, ok: p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 }; }
let near = null; const bubble = document.createElement('div'); bubble.className = 'lbl bubble'; bubble.hidden = true; overlay.appendChild(bubble);
function updateLabels(){
  const pp = player.obj.root.position;
  // nearest NPC
  near = null; let best = 2.1;
  chars.forEach(c => { if (c.isPlayer) return; const d = c.obj.root.position.distanceTo(pp); if (d < best){ best = d; near = c; } });
  const lockNear = rooms.find(r => r.kind === 'locked' && Math.hypot(pp.x-r.doorPoint[0], pp.z-r.doorPoint[1]) < 2);
  labels.forEach(L => {
    let pos = L.pos, show = true;
    if (L.custom){ const r = L.custom(); show = !!(r && r.show); if (show) pos = r.pos; }
    else if (L.inst && L.inst.hidden) show = false;
    else if (L.inst){ const c = L.inst, rp = c.obj.root.position;
      if (L.marker){ show = !!c.markerKind && mode === 'quest'; pos = new THREE.Vector3(rp.x, 1.72, rp.z); }
      else if (L.chat){ const a = c.ai; show = a && a.s === 'chat' && a.conv.speaker === c; pos = new THREE.Vector3(rp.x, 2.05, rp.z);
        if (show && L.el.dataset.k !== a.conv.icon){ L.el.dataset.k = a.conv.icon; L.el.innerHTML = a.conv.icon === '•••' ? '<span class="dots"><i></i><i></i><i></i></span>' : a.conv.icon; } }
      else { pos = new THREE.Vector3(rp.x, 1.62, rp.z); const d = rp.distanceTo(pp);
        show = c.isPlayer || c === hovered || (d < 6.5 && c !== near);
        if (mode === 'quest' && c.markerKind) show = false; if (c.ai && c.ai.s === 'chat' && c.ai.conv.speaker === c && d > 3) show = false; } }
    else if (L.spotL){ show = mode === 'quest' && spot && spot.ring.visible; if (show) pos = new THREE.Vector3(spot.ring.position.x, 1.1, spot.ring.position.z); }
    if (!show){ if (!L.el.hidden) L.el.hidden = true; return; }
    const s = project(pos); if (!s.ok){ L.el.hidden = true; return; }
    L.el.hidden = false; L.el.style.transform = `translate(${s.x|0}px,${s.y|0}px) translate(-50%,-100%)`;
  });
  const bTarget = near || null;
  if (bTarget && !bTarget.hidden && !(HX && HX.playing()) && $('#dialog').hidden && $('#panel').hidden){
    const rp = bTarget.obj.root.position, s = project(new THREE.Vector3(rp.x, 1.62, rp.z));
    const html = `<small>${bTarget.role.title}</small><span class="b-long">${bTarget.role.doing}<br></span><span class="b-key" style="color:var(--ink-faint)">${L('Bấm <kbd>F</kbd> hoặc click để nói chuyện', 'Press <kbd>F</kbd> or click to talk')}</span><span class="b-touch">${L('Chạm để nói chuyện', 'Tap to talk')}</span>`;
    if (bubble.dataset.k !== bTarget.id){ bubble.innerHTML = html; bubble.dataset.k = bTarget.id; }
    bubble.hidden = false; bubble.style.transform = `translate(${s.x|0}px,${s.y|0}px) translate(-50%,-100%)`;
  } else if (lockNear && $('#panel').hidden){
    const s = project(new THREE.Vector3(lockNear.doorPoint[0], 1.9, lockNear.doorPoint[1] + .3));
    bubble.innerHTML = L('<small>Phòng ban khác</small><span class="b-long">Ở công ty product nhỏ chưa có các vai trò này.<br></span><span class="b-key" style="color:var(--ink-faint)">Bấm <kbd>F</kbd> để xem bên trong</span><span class="b-touch">Chạm cửa để xem bên trong</span>',
      '<small>Other departments</small><span class="b-long">A small product company doesn\'t have these roles yet.<br></span><span class="b-key" style="color:var(--ink-faint)">Press <kbd>F</kbd> to look inside</span><span class="b-touch">Tap the door to look inside</span>'); bubble.dataset.k = 'lock';
    bubble.hidden = false; bubble.style.transform = `translate(${s.x|0}px,${s.y|0}px) translate(-50%,-100%)`;
  } else bubble.hidden = true;
}
function interact(){
  if (!$('#dialog').hidden){ const b = $('#dialog .btn-primary'); b && b.click(); return; }
  if (near) return talk(near);
  const pp = player.obj.root.position; const lr = rooms.find(r => r.kind === 'locked' && Math.hypot(pp.x-r.doorPoint[0], pp.z-r.doorPoint[1]) < 2);
  if (lr) openLocked(lr);
}
function faceEach(a, b){ const pa = a.obj.root.position, pb = b.obj.root.position; a.heading = Math.atan2(pb.x-pa.x, pb.z-pa.z); b.heading = Math.atan2(pa.x-pb.x, pa.z-pb.z); }
function talk(c){
  if (c.sitting){ const pa = player.obj.root.position, pb = c.obj.root.position; player.heading = Math.atan2(pb.x-pa.x, pb.z-pa.z); } else faceEach(player, c);
  if (!c.busy && !c.guest && !c.fixed){ if (c.ai && c.ai.conv) endConv(c.ai.conv, c); c.path = []; c.onArrive = null; c.ai = { s:'pause', t:5 }; } setFace(c.obj, 'happy', 'mSmile'); c.faceT = 3; setFace(player.obj, 'look', 'mO'); player.faceT = 2;
  if (!c.roamer && !c.guest){ met[scaleKey].add(c.role.id); updateMet(); }
  if (HX && HX.onTalk(c)) return;
  if (mode === 'quest' && questTalk(c)) return;
  openPanel(c);
}
function updateMet(){ $('#metc').textContent = $('#map-metc').textContent = met[scaleKey].size; saveProgress(); }

// ---------- office life ----------
const CHAT_ICONS = ['•••','?','!','✓','+1','•••','✎','•••'];
function sitDown(c, wait){ c.sitting = true; c.path = []; c.obj.root.position.set(c.seat.x, 0, c.seat.z); c.heading = c.seat.rot; c.ai = { s:'sit', t: wait ?? (5 + Math.random()*9) }; }
function goHome(c, cb){ c.sitting = false; c.ai = { s:'home' }; c.restRot = c.seat.rot; walkTo(c, c.seat.x, c.seat.z, () => { sitDown(c); cb && cb(); }); }
function randomSpot(r){ for (let k=0;k<14;k++){ const x = r.x + (Math.random()-.5)*(r.w-2.4), z = r.z + (Math.random()-.5)*(r.d-2.4); if (free(x,z)) return [x,z]; } return null; }
function endConv(conv, except){ [conv.a, conv.b].forEach(c => { if (c === except || c.busy) return; if (c.roamer){ c.ai = { s:'idle', t:1 }; return; } if (c.ai && c.ai.conv === conv) goHome(c); }); conv.done = true; }
function startChat(a, b){
  const p = randomSpot(a.room); if (!p) return false;
  const ang = Math.random()*6.28, q = nearestFree(p[0] + Math.cos(ang)*1.2, p[1] + Math.sin(ang)*1.2);
  const conv = { a, b, arrived:0, t: 5 + Math.random()*4, speaker:a, swap:1.3, icon:'•••' };
  [a, b].forEach((c, i) => { c.sitting = false; c.ai = { s:'tochat', conv }; const [x, z] = i ? q : p;
    walkTo(c, x, z, () => { if (conv.done || !c.ai || c.ai.conv !== conv) return; conv.arrived++; if (conv.arrived === 2){ faceEach(a, b); a.ai = { s:'chat', conv }; b.ai = { s:'chat', conv }; } }); });
  return true;
}
function nextRoam(c){
  const rs = rooms.filter(r => r.kind !== 'locked'), r = rs[Math.floor(Math.random()*rs.length)];
  const cands = chars.filter(o => !o.isPlayer && !o.roamer && !o.fixed && !o.busy && o.room === r && o.ai && o.ai.s === 'sit');
  if (cands.length && Math.random() < .75){ const b = cands[Math.floor(Math.random()*cands.length)];
    const [x, z] = nearestFree(b.seat.x + Math.cos(b.seat.rot)*1.15, b.seat.z - Math.sin(b.seat.rot)*1.15);
    c.ai = { s:'go' }; walkTo(c, x, z, () => { if (b.busy || !b.ai || b.ai.s !== 'sit'){ c.ai = { s:'idle', t:1 }; return; }
      const conv = { a:c, b, t: 5 + Math.random()*4, speaker:c, swap:1.2, icon:'•••' }; c.ai = { s:'rchat', conv }; b.ai = { s:'chat', conv };
      const pb = b.obj.root.position, pc = c.obj.root.position; c.heading = Math.atan2(pb.x - pc.x, pb.z - pc.z); });
    return; }
  const p = randomSpot(r); if (!p){ c.ai = { s:'idle', t:1 }; return; }
  c.ai = { s:'go' }; walkTo(c, p[0], p[1], () => { c.ai = { s:'idle', t: 1.5 + Math.random()*2.5 }; });
}
function roam(c, dt){
  const a = c.ai;
  if (a.s === 'idle' || a.s === 'pause'){ a.t -= dt; if (a.t <= 0) nextRoam(c); }
  else if (a.s === 'go' && !c.path.length){ c.ai = { s:'idle', t:1 }; }
  else if (a.s === 'rchat'){ const v = a.conv;
    if (v.done || v.b.busy || !v.b.ai || v.b.ai.conv !== v){ v.done = true; c.ai = { s:'idle', t:1 }; return; }
    v.t -= dt; v.swap -= dt;
    if (v.swap <= 0){ v.swap = 1.1 + Math.random()*1.2; v.speaker = v.speaker === v.a ? v.b : v.a; v.icon = CHAT_ICONS[Math.floor(Math.random()*CHAT_ICONS.length)];
      setFace(v.speaker.obj, Math.random() < .3 ? 'happy' : 'open', 'mSmile'); v.speaker.faceT = 1; }
    if (v.t <= 0){ v.done = true; v.b.ai = { s:'sit', t: 4 + Math.random()*6 }; c.ai = { s:'idle', t:.6 }; } }
}
function think(c, dt){
  if (c.guest || c.fixed) return;
  if (c.roamer && c.ai) return roam(c, dt);
  if (c.isPlayer || c.busy || !c.ai) return;
  const a = c.ai;
  if (a.s === 'sit' || a.s === 'pause'){
    a.t -= dt; if (a.t > 0) return;
    if (a.s === 'pause'){ if (c.sitting) c.ai = { s:'sit', t: 4 + Math.random()*6 }; else goHome(c); return; }
    const roll = Math.random();
    if (roll < .45){ const mates = chars.filter(o => o !== c && !o.isPlayer && !o.fixed && !o.busy && o.room === c.room && o.ai && o.ai.s === 'sit');
      if (mates.length && startChat(c, mates[Math.floor(Math.random()*mates.length)])) return; }
    if (roll < .75){ const p = randomSpot(c.room); if (p){ c.sitting = false; c.ai = { s:'wander' }; walkTo(c, p[0], p[1], () => { if (c.ai && c.ai.s === 'wander'){ c.ai = { s:'pause', t: 2 + Math.random()*3 }; c.heading = Math.random()*6.28; } }); return; } }
    a.t = 4 + Math.random()*8;
  } else if (a.s === 'chat' && a.conv.a === c){
    const v = a.conv; if (v.done) return;
    v.t -= dt; v.swap -= dt;
    if (v.swap <= 0){ v.swap = 1.1 + Math.random()*1.2; v.speaker = v.speaker === v.a ? v.b : v.a; v.icon = CHAT_ICONS[Math.floor(Math.random()*CHAT_ICONS.length)];
      setFace(v.speaker.obj, Math.random() < .3 ? 'happy' : 'open', 'mSmile'); v.speaker.faceT = 1; setFace((v.speaker === v.a ? v.b : v.a).obj, 'look', 'mO'); }
    if (v.t <= 0) endConv(v);
  } else if (a.s === 'tochat' && a.conv.done){ goHome(c); }
}

// ---------- quest spots (work at your desk, present on the TV) ----------
let spot = null;
function makeSpot(){
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.55,.06,10,40), new THREE.MeshBasicMaterial({ color:'#E92F7C' }));
  ring.rotation.x = -Math.PI/2; ring.position.y = .06; ring.visible = false; world.add(ring);
  const L = addLabel('<div class="qmark step">◆</div>', 'qm', new THREE.Vector3(), { spotL:true }); L.el.hidden = true;
  return { ring, L };
}
function showSpot(x, z){ spot.ring.position.set(x, .06, z); spot.ring.visible = true; }
function hideSpot(){ if (spot) spot.ring.visible = false; }
function stepSpot(s, q){ if (s.type === 'work') return [player.seat.x, player.seat.z]; if (s.type === 'present') return roomOf(q.room).presentSpot; return null; }
function setStepTarget(q){
  clearMarkers(); hideSpot();
  const s = q.steps[Q.step]; const sp = stepSpot(s, q);
  if (sp) showSpot(sp[0], sp[1]); else setMarker(inst(s.who), '◆');
}
function advanceStep(q){
  Q.step++; Q.prog = null;
  if (Q.step < q.steps.length) setStepTarget(q); else { Q.phase = 'return'; clearMarkers(); hideSpot(); setMarker(Q.giver, '?'); }
  renderQuest();
}
function questTick(dt){
  if (spot && spot.ring.visible){ const k = 1 + Math.sin(t*4)*.12; spot.ring.scale.set(k,k,k); }
  if (mode !== 'quest' || Q.phase !== 'step') return;
  const q = qlist()[Q.idx[scaleKey]]; if (!q) return; const s = q.steps[Q.step]; const sp = stepSpot(s, q); if (!sp) return;
  const pp = player.obj.root.position;
  if (!Q.prog){
    if (Math.hypot(pp.x - sp[0], pp.z - sp[1]) < 1.0 && !player.path.length){
      Q.prog = { kind:s.type, t:0, dur:s.secs || 5 }; hideSpot();
      if (s.type === 'work'){ player.sitting = true; player.obj.root.position.set(player.seat.x, 0, player.seat.z); player.heading = player.seat.rot; if (player.screen) player.screen.material.map = screenTex('figma'); }
      else { const r = roomOf(q.room); player.heading = Math.atan2(r.x - pp.x, r.z + 2 - pp.z); if (r.tv) r.tv.mat.map = slideTex(q.title, L('Trình bày bởi UI/UX Designer', 'Presented by the UI/UX Designer'));
        [...new Set([...Q.people, ...chars.filter(c => c.fixed && c.room === r)])].forEach(c => { const pc = c.obj.root.position; c.heading = Math.atan2(pp.x - pc.x, pp.z - pc.z); setFace(c.obj, 'look', 'mO'); c.faceT = s.secs || 5; }); setFace(player.obj, 'happy', 'mSmile'); player.faceT = s.secs || 5; }
      renderQuest();
    }
    return;
  }
  if (player.walking || player.path.length){ Q.prog = null; player.sitting = false; showSpot(sp[0], sp[1]); renderQuest(); return; }
  Q.prog.t += dt; const bar = document.querySelector('#quest .qbar i'); if (bar) bar.style.width = Math.min(100, Q.prog.t / Q.prog.dur * 100) + '%';
  if (Q.prog.t >= Q.prog.dur){ const kind = Q.prog.kind; Q.prog = { kind:'done', t:0, dur:1e9 };
    if (kind === 'work') player.sitting = false;
    dialog(Q.giver, s.line, L('Tiếp tục', 'Continue'), () => { const r = roomOf(q.room); if (r.tv) r.tv.mat.map = r.tv.idle; advanceStep(q); }); }
}

// ---------- room intro ----------
let lastRoom, introOff = false, introTimer = null; const introSeen = new Set();
function roomAt(x, z){ return rooms.find(r => r.kind !== 'locked' && Math.abs(x - r.x) <= r.w/2 && Math.abs(z - r.z) <= r.d/2) || null; }
function checkRoom(){
  if (!$('#welcome').hidden || !player || (mode === 'quest' && small())) return;
  const r = roomAt(player.obj.root.position.x, player.obj.root.position.z);
  if (r === lastRoom) return; lastRoom = r;
  if (!r || introOff || !ROOM_INFO[r.id] || introSeen.has(scaleKey + r.id)) return;
  if (!$('#panel').hidden || !$('#modal').hidden || !$('#list').hidden || sheetOpen()) return;
  introSeen.add(scaleKey + r.id); showIntro(r);
}
function showIntro(r){
  const n = new Set(r.members).size, el = $('#roomintro');
  el.classList.remove('open');
  el.innerHTML = `<button class="ri-compact" aria-label="${L('Xem giới thiệu', 'About')} ${r.name}"><span class="ri-i" aria-hidden="true">i</span><span>${L('Bạn vừa vào', 'You just entered')} <b>${r.name}</b></span></button><button class="close" aria-label="${L('Đóng giới thiệu', 'Close')}">×</button><div class="sheet-body"><p class="eyebrow">${L('Bạn vừa vào', 'You just entered')} · ${r.code}</p><h3>${r.name}</h3><p>${ROOM_INFO[r.id]}</p>
    <div class="ri-foot"><span>${n ? n + L(' vai trò trong phòng', n === 1 ? ' role in this room' : ' roles in this room') : L('Khu vực chung', 'Shared space')}</span></div></div>`;
  el.hidden = false;
  el.querySelector('.close').onclick = hideIntro;
  el.querySelector('.ri-compact').onclick = () => { closeSheets('intro'); clearTimeout(introTimer); el.hidden = false; el.classList.add('open'); };
  clearTimeout(introTimer); introTimer = setTimeout(hideIntro, isMobile() ? 6000 : 12000);
}
function hideIntro(){ const el = $('#roomintro'); el.hidden = true; el.classList.remove('open'); clearTimeout(introTimer); }

// ---------- mobile: popups are bottom sheets, one at a time ----------
// Desktop giữ nguyên cách cũ. Trên mobile mọi popup nằm ở chân màn hình, cao tối đa ~1/3,
// mở cái này thì cái kia đóng, chạm ra ngoài thì đóng.
const mqMobile = matchMedia('(max-width:760px)'), isMobile = () => mqMobile.matches;
function sheetOpen(){
  if (!isMobile()) return false;
  return !$('#panel').hidden || !$('#dialog').hidden || !$('#welcome').hidden || !$('#modal').hidden || !$('#reader').hidden || !!(HX && HX.sheetOpen())
    || ['#roomintro', '#mini', '#quest'].some(id => $(id).classList.contains('open'));
}
function closeSheets(except){
  if (!isMobile()) return;
  if (except !== 'panel') closePanel();
  if (except !== 'reader') closeReader();
  if (except !== 'hourly' && HX) HX.closeSheet();
  if (except !== 'dialog') closeDialog();
  if (except !== 'intro') hideIntro();
  if (except !== 'mini') $('#mini').classList.remove('open');
  if (except !== 'quest') $('#quest').classList.remove('open');
  if (except !== 'welcome' && !$('#welcome').hidden) $('#start').click();
  if (except !== 'modal' && !$('#modal').hidden){ const n = $('#next-q'); if (n) n.click(); else $('#modal').hidden = true; }
}
const SHEET_SEL = '#h-sheet:not([hidden]),#h-bar,#h-act,#badges:not([hidden]),#reader:not([hidden]),#panel:not([hidden]),#dialog:not([hidden]),#welcome:not([hidden]),#modal .card,#roomintro.open,#mini.open,#quest.open,#list,#nav-overlay';
document.addEventListener('click', e => {
  if (!isMobile() || e.target === canvas || !e.target.closest) return;
  if (!$('#reader').hidden){ if (!e.target.closest('#reader')) closeReader(); return; }
  if (e.target.closest(SHEET_SEL)) return;
  if (sheetOpen()) closeSheets();
}, true);
mqMobile.addEventListener && mqMobile.addEventListener('change', () => ['#roomintro', '#mini', '#quest'].forEach(id => $(id).classList.remove('open')));

// ---------- panel ----------
const ctaButtons = links => links.map((b, i) => `<a class="btn ${(links.some(x => x.primary) ? b.primary : !i) ? 'btn-primary' : 'btn-ghost'}" href="${b.url}" target="_blank" rel="noopener">${b.label}</a>`).join('');
const statusChip = s => s === 'pub' ? `<span class="chip pub">${L('Đã có bài', 'Article')}</span>` : s === 'draft' ? `<span class="chip draft">${L('Bản nháp', 'Draft')}</span>` : `<span class="chip todo">${L('Sắp ra mắt', 'Coming soon')}</span>`;
function openPanel(c){
  hideIntro(); closeSheets('panel');
  track('tm_character_open', { character_id: c.role.id, character_title: c.role.title, character_kind: c.roamer ? 'author' : c.guest ? 'guest' : c.isPlayer ? 'player' : 'role',
    has_article: !!c.role.url, room_id: c.room.id });
  if (c.roamer){ const sp = c.role.special;
    $('#panel').innerHTML = `<button class="close" aria-label="${L('Đóng', 'Close')}">×</button><div class="sheet-body">
      <p class="eyebrow">${L('Tác giả của game', 'Author of this game')}</p><h2>${c.role.title}</h2>
      <div class="chips"><span class="chip pub">${sp.tag}</span></div>
      <div class="sec"><p>${c.role.summary}</p></div>
      <div class="sec"><h4>${L('Ổng có thể giúp gì cho bạn?', 'How can he help you?')}</h4><p>${c.role.withDesigner}</p></div>
      ${HX ? '' : `<div class="sec"><h4>${L('Nhiệm vụ hằng ngày', 'Daily quest')}</h4><p style="color:var(--ink-faint)">${L('Sắp ra mắt. Ổng sẽ giao cho bạn một nhiệm vụ nhỏ mỗi ngày.', 'Coming soon. He will give you a small quest every day.')}</p></div>`}
      ${HX ? HX.authorCard() : ''}
      <div class="row">${ctaButtons(sp.links)}</div></div>`;
    $('#panel').hidden = false; $('#panel .close').onclick = closePanel; if (HX) HX.bindPanel(c); return; }
  if (c.guest){ const gs = c.role.guest;
    $('#panel').innerHTML = `<button class="close" aria-label="${L('Đóng', 'Close')}">×</button><div class="sheet-body">
      <p class="eyebrow">${c.room.name}</p><h2>${c.role.title}</h2>
      <div class="chips"><span class="chip draft">${gs.tag}</span></div>
      <div class="sec"><p>${c.role.summary}</p></div>
      <div class="sec"><h4>${L('Đang làm', 'Doing now')}</h4><p>${c.role.doing}</p></div>
      <div class="sec"><h4>${L('Vì sao nên nói chuyện với User', 'Why talk to the User')}</h4><p>${c.role.withDesigner}</p></div>
      ${gs.links.length ? `<div class="sec"><h4>${L('Bài nên đọc', 'Worth reading')}</h4></div>
      <div class="row" style="margin-top:6px">${ctaButtons(gs.links)}</div>` : ''}</div>`;
    $('#panel').hidden = false; $('#panel .close').onclick = closePanel; return; }
  const r = c.role, g = GROUPS[r.group], boss = reportName(c);
  $('#panel').innerHTML = `<button class="close" aria-label="${L('Đóng', 'Close')}">×</button><div class="sheet-body">
    <p class="eyebrow">${c.room.code} · ${c.room.name}</p>
    <h2>${r.title}</h2>
    <div class="chips"><span class="chip"><i class="sw" style="background:${g.color}"></i>${g.name}</span>${statusChip(r.status)}</div>
    <div class="sec"><h4>${L('Họ là ai', 'Who they are')}</h4><p>${r.summary}</p></div>
    <div class="sec"><h4>${L('Đang làm', 'Doing now')}</h4><p>${r.doing}</p></div>
    <div class="sec"><h4>${L('Làm việc với bạn thế nào', 'How they work with you')}</h4><p>${r.withDesigner}</p></div>
    ${boss ? `<div class="sec"><h4>${L('Báo cáo cho', 'Reports to')}</h4><p>${boss}</p></div>` : ''}
    <div class="row">${r.url ? `<a class="btn btn-primary" href="${r.url}" target="_blank" rel="noopener">${L('Đọc bài đầy đủ', 'Read the article (Vietnamese)')}</a>` : `<span class="btn btn-primary is-disabled">${L('Bài viết sắp ra mắt', 'Article coming soon')}</span>`}<button class="btn btn-ghost" id="p-close">${L('Tiếp tục đi dạo', 'Keep exploring')}</button></div>${HX ? HX.panelExtra(c) : ''}</div>`;
  $('#panel').hidden = false; if (HX) HX.bindPanel(c);
  $('#panel .close').onclick = closePanel; $('#p-close').onclick = closePanel;
}
function openLocked(r){
  track('tm_locked_room_open'); closeSheets('panel');
  const items = LOCKED_ROLES.map(id => ROLES[id]).filter(Boolean).map(x => `<li style="display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:13px">${x.url ? `<a href="${x.url}" target="_blank" rel="noopener" style="color:var(--ink)">${x.title}</a>` : x.title}${statusChip(x.status)}</li>`).join('');
  $('#panel').innerHTML = `<button class="close" aria-label="${L('Đóng', 'Close')}">×</button><div class="sheet-body"><p class="eyebrow">${L('Cửa đóng', 'Closed door')}</p><h2>${L('Phòng ban khác', 'Other departments')}</h2>
    <div class="sec"><p>${L('Ở công ty product nhỏ, những vai trò này chưa có bàn riêng. Việc của họ thường do PM, designer hoặc dev kiêm nhiệm. Khi công ty lớn lên, từng vai trò sẽ có phòng riêng.', 'In a small product company these roles don\'t have their own desks yet. Their work is usually covered by the PM, designers or developers. As the company grows, each role gets its own room.')}</p></div>
    <ul style="list-style:none;padding:0;margin:14px 0 0;display:grid;gap:7px">${items}</ul>
    <div class="row"><button class="btn btn-primary" id="go-large">${L('Gặp họ ở tập đoàn product 100+ nhân sự', 'Meet them at the 100+ person product company')}</button></div></div>`;
  $('#panel').hidden = false; $('#panel .close').onclick = closePanel; $('#go-large').onclick = () => { closePanel(); setScale('large'); };
}
function closePanel(){ $('#panel').hidden = true; }
// báo cáo cho ai ở quy mô hiện tại: bảng riêng của quy mô (nếu có) rồi mới tới reports_to
function bossOf(id){ const sr = SCALE_REPORTS[scaleKey]; return sr && sr[id] !== undefined ? sr[id] : (ROLES[id] ? ROLES[id].reportsTo : null); }
function reportTarget(c){
  let id = bossOf(c.role.id), guard = 0;
  while (id && guard++ < 6){ const t = inst(id + '@' + c.room.id) && chars.find(x => x.id === id + '@' + c.room.id) || inst(id); if (t && t !== c) return t; id = bossOf(id); }
  return null;
}
function reportName(c){ const t = reportTarget(c); return t ? `${t.role.title}${t.room !== c.room ? ` (${t.room.name})` : ''}` : (bossOf(c.role.id) && ROLES[bossOf(c.role.id)] ? ROLES[bossOf(c.role.id)].title : ''); }


// ---------- quest mode ----------
const Q = { idx:perScale(() => 0), phase:null, step:0, people:[], cards:perScale(() => []) };
function qlist(){ return QUESTS[scaleKey]; }
function clearMarkers(){ chars.forEach(c => { c.markerKind = null; c.marker.el.hidden = true; }); }
function setMarker(c, kind){ c.markerKind = kind; c.marker.el.innerHTML = `<div class="qmark ${kind === '?' ? 'turn' : kind === '◆' ? 'step' : ''}">${kind}</div>`; }
function roomOf(id){ return rooms.find(r => r.id === id); }
function startQuest(){
  clearMarkers(); closeDialog();
  const list = qlist(), i = Q.idx[scaleKey];
  if (i >= list.length){ Q.phase = 'finished'; renderQuest(); return; }
  const q = list[i], room = roomOf(q.room);
  track('tm_quest_start', { quest_id: q.id, quest_title: q.title, quest_index: i + 1, quest_total: list.length });
  const giver = inst(q.giver), people = [giver, ...q.gather.map(inst)].filter(Boolean);
  Q.people = people; Q.phase = 'gather'; Q.step = 0; Q.giver = giver; Q.prog = null; hideSpot();
  // nhân vật ngồi cố định (vd Client) ở yên tại ghế, chỉ những người còn lại đi tới điểm tập hợp
  const movers = people.filter(c => !c.fixed);
  people.forEach(c => { if (c.ai && c.ai.conv) endConv(c.ai.conv, c); c.busy = true; if (!c.fixed){ c.sitting = false; c.ai = { s:'quest' }; } });
  const spots = room.gather(movers.length);
  const ready = () => { if (Q.phase !== 'gather') return; Q.phase = 'offer'; people.forEach(p => { if (p !== giver && !p.fixed) faceEach(p, giver); }); setMarker(giver, '!'); renderQuest(); };
  let arrived = 0;
  movers.forEach((c, k) => { const [sx, sz] = nearestFree(spots[k][0], spots[k][1]);
    walkTo(c, sx, sz, () => { arrived++; if (arrived === movers.length) ready(); }); });
  renderQuest();
  if (!movers.length) ready();
  clearTimeout(Q.timer); Q.timer = setTimeout(() => { if (Q.phase === 'gather'){ movers.forEach((c,k) => { const [sx,sz] = nearestFree(spots[k][0], spots[k][1]); c.path = []; c.obj.root.position.set(sx,0,sz); }); ready(); } }, 12000);
}
function sendHome(list){ list.forEach(c => { if (c.isPlayer || !c.busy) return; if (c.fixed){ c.busy = false; c.heading = c.seat.rot; return; } goHome(c, () => { c.busy = false; }); }); }
function questTalk(c){
  const q = qlist()[Q.idx[scaleKey]]; if (!q) return false;
  if (c === Q.giver && Q.phase === 'offer' && HX && HX.holdsMain()){
    dialog(c, L('Làm xong nhiệm vụ giờ này của Nhân Lưu đã rồi qua nhận việc nha.', 'Finish Nhân Lưu\'s quest of the hour first, then come and get this task.'), 'Ok', () => {}); return true; }
  if (c === Q.giver && Q.phase === 'offer'){
    dialog(c, q.offer, L('Nhận việc', 'Accept'), () => { Q.step = 0; clearMarkers(); if (q.steps.length){ Q.phase = 'step'; setStepTarget(q); } else { Q.phase = 'return'; setMarker(Q.giver, '?'); } renderQuest(); });
    return true; }
  if (Q.phase === 'step' && !q.steps[Q.step].type && c === inst(q.steps[Q.step].who)){
    dialog(c, q.steps[Q.step].line, L('Tiếp tục', 'Continue'), () => advanceStep(q));
    return true; }
  if (Q.phase === 'return' && c === Q.giver){
    dialog(c, q.done, L('Trả việc', 'Hand it in'), () => { clearMarkers(); setFace(player.obj, 'happy', 'mSmile'); player.faceT = 3; Q.cards[scaleKey].push(...q.rewards);
      track('tm_quest_complete', { quest_id: q.id, quest_title: q.title, quest_index: Q.idx[scaleKey] + 1, quest_total: qlist().length }); showRewards(q); });
    return true; }
  if (Q.phase === 'gather' && Q.people.includes(c)){ dialog(c, L('Mọi người đang tập hợp, chờ chút nhé.', 'Everyone is still gathering, hang on a moment.'), 'Ok', () => {}); return true; }
  return false;
}
function cardFor(name){ if (ROLES[name]){ const r = ROLES[name]; return { title:r.title, kind:L('Vai trò', 'Role'), url:r.url }; } return { title:name, kind:L('Thuật ngữ', 'Term'), url: TERMS[name] || null }; }
function showRewards(q){
  const list = qlist(), last = Q.idx[scaleKey] >= list.length - 1;
  const cards = q.rewards.map(cardFor).map(c => `<div class="reward"><span>${c.kind}</span><b>${c.title}</b>${c.url ? `<a href="${c.url}" target="_blank" rel="noopener">${L('Đọc bài', 'Read (Vietnamese)')}</a>` : `<span>${L('Bài viết sắp ra mắt', 'Article coming soon')}</span>`}</div>`).join('');
  closeSheets('modal');
  $('#modal').innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-label="${L('Phần thưởng quest', 'Quest rewards')}"><p class="eyebrow">${L('Hoàn thành quest', 'Quest complete')} ${Q.idx[scaleKey]+1}/${list.length}</p><h2>${q.title}</h2>
    <p style="margin:0;color:var(--ink-soft)">${L(`Bạn mở khoá ${q.rewards.length} thẻ kiến thức. Đọc ngay hoặc để dành, thẻ sẽ nằm trong bộ sưu tập cuối game.`, `You unlocked ${q.rewards.length} knowledge cards. Read them now or later, they stay in your collection at the end of the game.`)}</p>
    <div class="rewards">${cards}</div><div class="row"><button class="btn btn-primary" id="next-q">${last ? L('Xem tổng kết', 'See summary') : L('Quest tiếp theo', 'Next quest')}</button></div></div>`;
  $('#modal').hidden = false;
  saveProgress();
  $('#next-q').onclick = () => { $('#modal').hidden = true; sendHome(Q.people); Q.idx[scaleKey]++; Q.phase = 'between'; saveProgress(); renderQuest(); setTimeout(() => mode === 'quest' && startQuest(), 1400); };
  $('#next-q').focus();
}
const chainTracked = new Set();
function showSummary(){
  const all = [...new Set(Q.cards[scaleKey])].map(cardFor);
  if (Q.idx[scaleKey] >= qlist().length && !chainTracked.has(scaleKey)){ chainTracked.add(scaleKey);
    track('tm_quest_chain_complete', { quests: qlist().length, cards: all.length, met: met[scaleKey].size }); }
  closeSheets('modal');
  $('#modal').innerHTML = `<div class="card sheet" role="dialog" aria-modal="true" aria-label="${L('Tổng kết', 'Summary')}"><button class="close" aria-label="${L('Đóng', 'Close')}">×</button><div class="sheet-body"><p class="eyebrow">${L('Tổng kết sprint', 'Sprint summary')}</p><h2>${L(`Bạn đã hoàn thành ${qlist().length} quest`, `You completed ${qlist().length} quests`)}</h2>
    <p style="margin:0;color:var(--ink-soft)">${L(`Đã gặp ${met[scaleKey].size}/${$('#mett').textContent} vai trò và mở khoá ${all.length} thẻ kiến thức.`, `You met ${met[scaleKey].size}/${$('#mett').textContent} roles and unlocked ${all.length} knowledge cards.`)}${scaleKey === 'small' ? L(' Thử tiếp ở tập đoàn product 100+ nhân sự để gặp Design Manager, UX Researcher và team Design System.', ' Next, try the 100+ person product company to meet the Design Manager, UX Researcher and the Design System team.') : scaleKey === 'agency' ? L(' Bạn vừa đi hết một dự án ở agency. Thử so với cách làm việc ở công ty sản phẩm xem khác gì nhé.', ' You just went through a whole agency project. Compare it with how a product company works and see what is different.') : ''}</p>
    <div class="rewards">${all.map(c => `<div class="reward"><span>${c.kind}</span><b>${c.title}</b>${c.url ? `<a href="${c.url}" target="_blank" rel="noopener">${L('Đọc bài', 'Read (Vietnamese)')}</a>` : `<span>${L('Sắp ra mắt', 'Coming soon')}</span>`}</div>`).join('')}</div>
    <div class="row">${scaleKey === 'small' ? `<button class="btn btn-primary" id="sum-large">${L('Chơi ở tập đoàn 100+ nhân sự', 'Play at the 100+ person company')}</button>` : scaleKey === 'agency' && SCALES.large ? `<button class="btn btn-primary" id="sum-large">${L('So với tập đoàn product 100+ nhân sự', 'Compare with the 100+ person product company')}</button>` : ''}<a class="btn btn-ghost" href="https://academy.telos.vn/" target="_blank" rel="noopener">${L('Khám phá khoá học TELOS', 'Explore TELOS courses')}</a></div></div></div>`;
  $('#modal').hidden = false; $('#modal .close').onclick = () => $('#modal').hidden = true;
  const b = $('#sum-large'); if (b) b.onclick = () => { $('#modal').hidden = true; setScale('large'); };
}
function renderQuest(){
  const el = $('#quest'); updateFab(); if (mode !== 'quest'){ el.hidden = true; return; }
  const list = qlist(), i = Q.idx[scaleKey], q = list[i];
  const prog = list.map((_,k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('');
  const go = ['offer', 'step', 'return'].includes(Q.phase) && !Q.prog ? `<button class="q-go" aria-label="${L('Tự đi tới chỗ cần tới', 'Walk there automatically')}">${L('Tới đó', 'Go there')}</button>` : '';
  const pill = (n, text) => `<div class="q-pill"><button class="q-compact" aria-label="${L('Xem chi tiết nhiệm vụ', 'Quest details')}"><span class="qc-n">${n}</span><span class="qc-t">${text}</span><span class="qc-more" aria-hidden="true">›</span></button>${go}</div><button class="close q-close" aria-label="${L('Thu nhỏ nhiệm vụ', 'Collapse quest')}">×</button>`;
  if (!q){ el.innerHTML = pill('✓', L('Đã xong mọi quest · xem tổng kết', 'All quests done · see summary')) + `<div class="q-full"><p class="eyebrow">${L('Hoàn thành', 'Complete')}</p><h3>${L('Bạn đã xong mọi quest', 'You finished every quest')}</h3><p>${L('Mở lại tổng kết để xem các thẻ kiến thức.', 'Open the summary again to see your knowledge cards.')}</p><div class="qprog">${prog}</div><div class="row" style="margin-top:12px"><button class="btn btn-primary" id="q-sum">${L('Xem tổng kết', 'See summary')}</button><button class="btn btn-ghost" id="q-reset">${L('Chơi lại', 'Play again')}</button></div></div>`;
    el.hidden = false; $('#q-sum').onclick = showSummary; $('#q-reset').onclick = () => { Q.idx[scaleKey] = 0; Q.cards[scaleKey] = []; saveProgress(); startQuest(); }; if (Q.phase === 'finished' && !Q.summaryShown){ Q.summaryShown = true; showSummary(); } return; }
  const room = roomOf(q.room), gname = Q.giver ? Q.giver.role.title : '';
  let obj = '';
  if (Q.phase === 'gather') obj = L(`Mọi người đang tập hợp ở ${room.name}…`, `Everyone is gathering in ${room.name}…`);
  else if (Q.phase === 'offer') obj = L(`Tới gặp ${gname} ở ${room.name} để nhận việc`, `Meet ${gname} in ${room.name} to get your task`);
  else if (Q.phase === 'step') { const s = q.steps[Q.step], tg = s.type ? null : inst(s.who); obj = `${s.task}${tg && tg.room !== room ? ` (${tg.room.name})` : ''}`;
    if (s.type) obj += Q.prog ? `<div class="qbar"><i></i></div>` : `<br><span class="objhint">${s.type === 'work' ? L('Đi tới vòng tròn hồng ở chỗ ngồi của bạn', 'Walk to the pink circle at your desk') : L('Đi tới vòng tròn hồng cạnh TV', 'Walk to the pink circle by the TV')}</span>`; }
  else if (Q.phase === 'return') obj = L(`Quay lại báo cáo với ${gname}`, `Go back and report to ${gname}`);
  else obj = L('Chuẩn bị quest tiếp theo…', 'Getting the next quest ready…');
  const plain = obj.replace(/<div class="qbar">.*$/, L(' · đang làm…', ' · working…')).replace(/<br>.*$/, '').replace(/<[^>]+>/g, '');
  el.innerHTML = pill(`${i+1}/${list.length}`, plain) + `<div class="q-full"><p class="eyebrow">Quest ${i+1}/${list.length}</p><h3>${q.title}</h3><div class="objective">${obj}</div><div class="qprog">${prog}</div></div>`;
  el.hidden = false;
}
// "Tới đó": tự đi tới người / vòng tròn hồng của bước hiện tại (mobile, khi đích nằm ngoài màn hình)
function goToQuestTarget(){
  if (spot && spot.ring.visible) return walkTo(player, spot.ring.position.x, spot.ring.position.z);
  const c = chars.find(x => x.markerKind && !x.isPlayer); if (!c) return;
  const p = c.obj.root.position; walkTo(player, p.x, p.z, () => talk(c), 1.3);
}
$('#quest').addEventListener('click', e => {
  if (e.target.closest('.q-go')){ $('#quest').classList.remove('open'); goToQuestTarget(); }
  else if (e.target.closest('.q-compact')){ closeSheets('quest'); $('#quest').classList.add('open'); }
  else if (e.target.closest('.q-close')) $('#quest').classList.remove('open');
});
function dialog(c, text, cta, onOk){
  hideIntro(); closeSheets('dialog');
  const d = $('#dialog');
  d.innerHTML = `<div class="who">${c.role.title} · ${c.room.name}</div><p>${text}</p><div class="row"><button class="btn btn-primary">${cta}</button></div>`;
  d.hidden = false; closePanel();
  const b = d.querySelector('.btn-primary'); b.onclick = () => { closeDialog(); onOk && onOk(); }; b.focus();
}
function closeDialog(){ $('#dialog').hidden = true; }

// ---------- modes & scale ----------
function setMode(m){
  if (HX && HX.playing()){ HX.flashLocked(); $('#quest-fab').setAttribute('aria-pressed', mode === 'quest'); return; }
  const prev = mode; mode = m;
  $('#quest-fab').setAttribute('aria-pressed', m === 'quest');
  if (prev === 'quest' && m !== 'quest'){ clearMarkers(); hideSpot(); closeDialog(); sendHome(chars); clearTimeout(Q.timer); Q.phase = null; Q.prog = null; player.sitting = false; rooms.forEach(r => r.tv && (r.tv.mat.map = r.tv.idle)); }
  if (m !== prev && (m === 'quest' || prev === 'quest')) track('tm_quest_mode', { state: m === 'quest' ? 'on' : 'off' });
  if (m === 'quest' && prev !== 'quest'){ closePanel(); if (small()) hideIntro(); Q.summaryShown = false; startQuest(); }
  renderQuest(); updateFab(); saveProgress();
}
function setScale(k){
  if (k === scaleKey && world) return;
  if (HX && HX.playing()){ HX.flashLocked(); $('#scale-select').value = scaleKey; return; }
  if (world) track('tm_scale_change', { tm_scale: k, from_scale: scaleKey });
  ['small','large','agency'].forEach(x => $('#sc-' + x).setAttribute('aria-pressed', k === x)); $('#scale-select').value = k;
  closePanel(); closeDialog(); clearTimeout(Q.timer); Q.phase = null;
  buildWorld(k);
  if (mode === 'quest'){ Q.summaryShown = false; startQuest(); }
  renderQuest(); updateFab(); if (!$('#list').hidden) renderList(); saveProgress(); if (HX) HX.onWorld();
}
['small','large','agency'].forEach(k => { const b = $('#sc-' + k), o = $(`#scale-select option[value="${k}"]`);
  if (SCALES[k]){ b.onclick = () => setScale(k); return; }
  b.classList.add('soon'); b.setAttribute('aria-disabled', 'true'); b.title = L('Sắp ra mắt', 'Coming soon'); b.insertAdjacentHTML('beforeend', ` <span class="soon-chip">${L('Sắp ra mắt', 'Coming soon')}</span>`);
  o.disabled = true; o.textContent += ' · ' + L('Sắp ra mắt', 'Coming soon'); });
$('#scale-select').onchange = e => { if (SCALES[e.target.value]) setScale(e.target.value); else e.target.value = scaleKey; };
// Nút "Nhiệm vụ" cạnh bản đồ: bật / tắt chế độ quest
function updateFab(){
  const list = QUESTS[scaleKey] || [], i = Math.min(Q.idx[scaleKey], list.length), b = $('#qf-badge');
  b.textContent = mode === 'quest' ? `${i}/${list.length}` : list.length; b.hidden = !list.length;
  $('#quest-fab').title = mode === 'quest' ? L('Đang làm nhiệm vụ · bấm để quay lại khám phá', 'Quest mode on · click to go back to exploring') : L(`${list.length} nhiệm vụ đang chờ bạn`, `${list.length} quests are waiting for you`);
}
$('#quest-fab').onclick = () => { $('#welcome').hidden = true; setMode(mode === 'quest' ? 'explore' : 'quest'); };
updateFab();
$('#start').onclick = () => { $('#welcome').hidden = true; track('tm_start', { start_action: 'explore' }); saveProgress(); canvas.focus(); };
$('#start-quest').onclick = () => { $('#welcome').hidden = true; track('tm_start', { start_action: 'quest' }); setMode('quest'); };

// ---------- list view (SEO / screen readers) ----------
// Hai cách xem: theo phòng ban, và "Báo cáo cho ai" dạng cây thư mục 2D (thay cho chế độ đường nối 3D cũ).
let listTab = 'rooms'; const treeGroups = new Set(Object.keys(GROUPS));
const roleLink = x => x.url ? `<a href="${x.url}" target="_blank" rel="noopener">${x.title}</a>` : `<span>${x.title}</span>`;
function reportTree(){
  // vai trò có mặt ở quy mô hiện tại (bỏ tác giả, khách) + các phòng họ ngồi
  const here = new Map(), dot = DOTTED && DOTTED[scaleKey];
  chars.forEach(c => { if (c.roamer || c.guest) return; const e = here.get(c.role.id) || { role:c.role, rooms:new Set(), squad:false };
    e.rooms.add(c.room.name); if (dot && dot.rooms.includes(c.room.id)) e.squad = true; here.set(c.role.id, e); });
  const parentOf = id => { let p = bossOf(id), guard = 0;
    while (p && !here.has(p) && guard++ < 8) p = bossOf(p); return p && p !== id && here.has(p) ? p : null; };
  const kids = {}; const roots = [];
  here.forEach((e, id) => { const p = parentOf(id); (p ? (kids[p] = kids[p] || []) : roots).push(id); });
  const byTitle = (a, b) => ROLES[a].title.localeCompare(ROLES[b].title, LANG);
  const node = id => { const e = here.get(id), x = e.role, g = GROUPS[x.group], me = id === PLAYER_ID, ch = (kids[id] || []).sort(byTitle);
    const dim = !treeGroups.has(x.group) ? ' dim' : '';
    const label = `<span class="tnode${me ? ' me' : ''}${dim}"><i class="sw" style="background:${g.color}"></i><b>${me ? `${L('Bạn', 'You')} · ${x.title}` : roleLink(x)}</b>
      <small>${[...e.rooms].join(' · ')}</small>${e.squad && ![dot.target, ...(dot.also || [])].includes(id) && parentOf(id) !== dot.target ? `<em class="dotted" title="${dot.title}">┄ ${dot.label}</em>` : ''}${me ? '' : statusChip(x.status)}</span>`;
    return ch.length ? `<li><details open><summary>${label}<span class="tcount">${ch.length}</span></summary><ul>${ch.map(node).join('')}</ul></details></li>` : `<li>${label}</li>`; };
  return `<div class="tree-head"><div class="tree-legend"><span><i class="ln"></i>${L('Báo cáo chuyên môn (solid line)', 'Craft reporting line (solid line)')}</span>${dot ? `<span><em class="dotted">┄ ${dot.label}</em> ${scaleKey === 'agency' ? L('Nhận việc theo dự án từ Project Manager (dotted line)', 'Gets project work from the Project Manager (dotted line)') : L('Nhận ưu tiên công việc từ PM squad (dotted line)', 'Gets work priorities from the squad PM (dotted line)')}</span>` : ''}</div>
      <div class="tree-tools"><div class="gfilter">${Object.entries(GROUPS).map(([k, g]) => `<button data-g="${k}" aria-pressed="${treeGroups.has(k)}"><i class="sw" style="background:${g.color}"></i>${g.name}</button>`).join('')}</div>
      <button class="btn btn-ghost tree-all" data-open="1">${L('Mở hết', 'Expand all')}</button><button class="btn btn-ghost tree-all" data-open="0">${L('Thu gọn', 'Collapse')}</button></div></div>
    <ul class="tree">${roots.sort(byTitle).map(node).join('')}</ul>`;
}
function renderList(){
  const sc = SCALES[scaleKey];
  const roomCards = sc.rooms.filter(r => r.kind !== 'lounge').map(r => {
    const ids = r.kind === 'locked' ? LOCKED_ROLES : [...new Set(r.members)];
    return `<section class="card room"><p class="eyebrow">${r.code}</p><h3>${r.name}</h3><ul>${ids.filter(id => ROLES[id]).map(id => { const x = ROLES[id]; return `<li>${roleLink(x)}${statusChip(x.status)}</li>`; }).join('') || `<li><span style="color:var(--ink-faint)">${L('Phòng dùng chung cho các buổi họp', 'Shared room for meetings')}</span></li>`}</ul></section>`; }).join('');
  const tabs = [['rooms', L('Theo phòng ban', 'By department')], ['report', L('Báo cáo cho ai', 'Who reports to whom')]];
  $('#list').innerHTML = `<button class="btn btn-ghost close-list" id="list-close">${L('Quay lại mô hình 3D', 'Back to the 3D map')}</button><div class="inner"><p class="eyebrow">${sc.name}</p>
    <h1>${listTab === 'report' ? L('Ai báo cáo cho ai trong team sản phẩm', 'Who reports to whom in a product team') : L('Ai ngồi ở đâu trong team sản phẩm', 'Who sits where in a product team')}</h1>
    <p class="lead">${listTab === 'report' ? L('Đường báo cáo chuyên môn (solid line) khác với người đặt ưu tiên công việc hằng ngày (dotted line). Mỗi nhánh là một người quản lý và những người báo cáo cho họ.', 'The craft reporting line (solid line) is different from the person who sets your daily priorities (dotted line). Each branch is a manager and the people who report to them.') : L('Danh sách các phòng và vai trò trong mô hình. Mỗi vai trò dẫn tới bài viết chi tiết trong thư viện thuật ngữ của TELOS Academy.', 'Every room and role in the map. Each role links to a detailed article (in Vietnamese) in the TELOS Academy glossary.')}</p>
    <div class="seg list-tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" data-tab="${k}" aria-pressed="${listTab === k}" aria-selected="${listTab === k}">${t}</button>`).join('')}</div>
    ${listTab === 'report' ? reportTree() : `<div class="grid">${roomCards}</div>`}</div>`;
  $('#list-close').onclick = () => { $('#list').hidden = true; };
  $('#list').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { listTab = b.dataset.tab; track('tm_list_view', { list_tab: listTab }); renderList(); });
  $('#list').querySelectorAll('.gfilter button').forEach(b => b.onclick = () => { const k = b.dataset.g; treeGroups.has(k) ? treeGroups.delete(k) : treeGroups.add(k); renderList(); });
  $('#list').querySelectorAll('.tree-all').forEach(b => b.onclick = () => $('#list').querySelectorAll('.tree details').forEach(d => d.open = b.dataset.open === '1'));
}
$('#btn-list').onclick = () => { renderList(); $('#list').hidden = false; track('tm_list_view', { list_tab: listTab }); $('#list-close').focus(); };

// Bấm đọc bài (link ra academy.telos.vn…) và bấm vào vai trò chưa có bài — để biết nên viết bài nào trước
$('#app').addEventListener('click', e => {
  const where = el => el.closest('#reader') ? 'preview' : el.closest('#panel') ? 'panel' : el.closest('#modal') ? 'reward' : el.closest('#list') ? (listTab === 'report' ? 'tree' : 'list') : 'other';
  const a = e.target.closest('a[href]');
  if (a && isMobile() && isAcademy(a) && !a.closest('#reader')){
    e.preventDefault(); const src = where(a);
    track('tm_article_preview', { link_url: a.href, link_text: a.textContent.trim().slice(0, 100), click_source: src });
    return openReader(a, src); }
  if (a && /^https?:/.test(a.href)) return track('tm_article_click', { link_url: a.href, link_text: a.textContent.trim().slice(0, 100), click_source: where(a) });
  const off = e.target.closest('.is-disabled');
  if (off && off.closest('#panel')){ const h = $('#panel h2'); track('tm_article_missing', { character_title: h ? h.textContent : '' }); }
});

// ---------- minimap ----------
const mm = $('#minimap'), mx = mm.getContext('2d');
function drawMini(){
  const W = mm.width, H = mm.height, bw = bounds.x1-bounds.x0, bd = bounds.z1-bounds.z0, s = Math.min(W/bw, H/bd);
  const ox = (W - bw*s)/2, oz = (H - bd*s)/2, X = x => ox + (x-bounds.x0)*s, Z = z => oz + (z-bounds.z0)*s;
  mx.clearRect(0,0,W,H);
  rooms.forEach(r => { mx.fillStyle = r.kind === 'locked' ? 'rgba(138,130,160,.35)' : 'rgba(118,118,184,.18)'; mx.strokeStyle = 'rgba(118,118,184,.6)'; mx.lineWidth = 1;
    mx.fillRect(X(r.x-r.w/2), Z(r.z-r.d/2), r.w*s, r.d*s); mx.strokeRect(X(r.x-r.w/2)+.5, Z(r.z-r.d/2)+.5, r.w*s-1, r.d*s-1); });
  chars.forEach(c => { if (c.isPlayer) return; const p = c.obj.root.position, m = met[scaleKey].has(c.role.id);
    mx.beginPath(); mx.arc(X(p.x), Z(p.z), c.markerKind && mode === 'quest' ? 3.4 : 2.2, 0, 7);
    if (c.markerKind && mode === 'quest'){ mx.fillStyle = '#FFC53D'; mx.fill(); }
    else if (m){ mx.fillStyle = GROUPS[c.role.group].color; mx.fill(); } else { mx.strokeStyle = GROUPS[c.role.group].color; mx.lineWidth = 1.2; mx.stroke(); } });
  if (spot && spot.ring.visible && mode === 'quest'){ mx.beginPath(); mx.arc(X(spot.ring.position.x), Z(spot.ring.position.z), 4, 0, 7); mx.strokeStyle = '#E92F7C'; mx.lineWidth = 2; mx.stroke(); }
  const p = player.obj.root.position; mx.beginPath(); mx.arc(X(p.x), Z(p.z), 4, 0, 7); mx.fillStyle = '#E92F7C'; mx.fill(); mx.strokeStyle = '#fff'; mx.lineWidth = 1.5; mx.stroke();
}
mm.addEventListener('click', e => { const r = mm.getBoundingClientRect(), W = mm.width, H = mm.height, bw = bounds.x1-bounds.x0, bd = bounds.z1-bounds.z0, s = Math.min(W/bw, H/bd);
  const x = bounds.x0 + ((e.clientX-r.left)*(W/r.width) - (W-bw*s)/2)/s, z = bounds.z0 + ((e.clientY-r.top)*(H/r.height) - (H-bd*s)/2)/s; walkTo(player, x, z);
  if (isMobile()) $('#mini').classList.remove('open'); });
$('#map-btn').onclick = () => { closeSheets('mini'); $('#mini').classList.add('open'); };
$('#mini-close').onclick = () => $('#mini').classList.remove('open');

// ---------- lưu tiến độ (localStorage của trình duyệt) ----------
// Chỉ lưu sau khi người chơi đã bấm bắt đầu. Rời game giữa một quest thì khi quay lại chơi lại từ đầu quest đó.
const SAVE_KEY = 'tm-progress-v1', SAVE_MAX_AGE = 30 * 864e5;
function saveProgress(){
  if (!player || !$('#welcome').hidden) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v:1, t:Date.now(), scale:scaleKey, mode, idx:Q.idx, cards:Q.cards,
    met:Object.fromEntries(Object.entries(met).map(([k, set]) => [k, [...set]])), intro:[...introSeen] })); } catch (e) {}
}
function loadProgress(){
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    return d && d.v === 1 && Date.now() - d.t < SAVE_MAX_AGE ? d : null; } catch (e) { return null; }
}
function resumeFrom(d){
  SCALE_KEYS.forEach(k => {
    const list = QUESTS[k] || [];
    Q.idx[k] = Math.max(0, Math.min(list.length, (d.idx && +d.idx[k]) || 0));
    Q.cards[k] = Array.isArray(d.cards && d.cards[k]) ? d.cards[k].filter(x => typeof x === 'string') : [];
    met[k] = new Set(((d.met && d.met[k]) || []).filter(id => ROLES[id]));
  });
  (d.intro || []).forEach(x => introSeen.add(x));
  $('#welcome').hidden = true; updateMet();
  if (d.mode === 'quest' && (QUESTS[scaleKey] || []).length){
    mode = 'quest'; $('#quest-fab').setAttribute('aria-pressed', 'true');
    Q.summaryShown = true; startQuest();
  }
  renderQuest(); updateFab();
  const list = QUESTS[scaleKey] || [], i = Q.idx[scaleKey];
  const where = mode === 'quest' ? (i >= list.length ? L('đã xong mọi quest', 'all quests done') : `quest ${i + 1}/${list.length}`) : L(`đã gặp ${met[scaleKey].size}/${$('#mett').textContent} người`, `met ${met[scaleKey].size}/${$('#mett').textContent} people`);
  const el = $('#resume');
  el.innerHTML = `<span>${L('Tiếp tục từ lần trước', 'Picking up where you left off')} · ${where}</span><button class="ri-off" id="resume-reset">${L('Chơi lại từ đầu', 'Start over')}</button>`;
  el.hidden = false;
  const timer = setTimeout(() => el.hidden = true, 9000);
  $('#resume-reset').onclick = () => { clearTimeout(timer); el.hidden = true; resetProgress(); };
}
function resetProgress(){
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  SCALE_KEYS.forEach(k => { Q.idx[k] = 0; Q.cards[k] = []; met[k].clear(); }); introSeen.clear(); chainTracked.clear();
  updateMet();
  if (mode === 'quest'){ Q.summaryShown = false; startQuest(); } else renderQuest();
  updateFab(); saveProgress();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveProgress(); });
addEventListener('pagehide', saveProgress);

// ---------- xem trước bài viết (mobile) ----------
// Trên mobile, bấm link bài của academy.telos.vn sẽ mở phần xem trước trong sheet (lấy qua WordPress REST API),
// người học muốn đọc kỹ mới sang trang TELOS Academy. Desktop vẫn mở tab mới như cũ.
const ACADEMY = 'https://academy.telos.vn', previewCache = new Map();
const isAcademy = a => { try { const u = new URL(a.href); return u.origin === ACADEMY && u.pathname.length > 1; } catch (e) { return false; } };
const plainText = html => { const b = new DOMParser().parseFromString(html || '', 'text/html').body; b.querySelectorAll('script,style,noscript').forEach(x => x.remove()); return b.textContent.replace(/\s+/g, ' ').trim(); };
const escapeHtml = t => String(t).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
async function fetchPreview(url){
  if (previewCache.has(url)) return previewCache.get(url);
  const slug = new URL(url).pathname.split('/').filter(Boolean).pop();
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 7000);
  const q = `?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia&_fields=title,excerpt,_links,_embedded`;
  try {
    for (const type of ['posts', 'pages']){
      const r = await fetch(`${ACADEMY}/wp-json/wp/v2/${type}${q}`, { signal:ctl.signal }); if (!r.ok) continue;
      const [p] = await r.json(); if (!p) continue;
      const m = p._embedded && p._embedded['wp:featuredmedia'] && p._embedded['wp:featuredmedia'][0], sz = m && m.media_details && m.media_details.sizes;
      const img = (sz && (sz.medium || sz.thumbnail || {}).source_url) || (m && m.source_url) || '';
      const out = { title:plainText(p.title && p.title.rendered), excerpt:plainText(p.excerpt && p.excerpt.rendered), img: /^https:\/\//.test(img) ? img : '' };
      previewCache.set(url, out); return out;
    }
  } catch (e) {} finally { clearTimeout(timer); }
  return null;
}
function openReader(a, source){
  const url = a.href, label = a.textContent.trim(), el = $('#reader');
  const out = new URL(url); out.searchParams.set('utm_source', 'uiux-library'); out.searchParams.set('utm_medium', 'product-map'); out.searchParams.set('utm_content', source);
  const shell = body => `<button class="close" aria-label="${L('Đóng', 'Close')}">×</button><div class="sheet-body"><p class="eyebrow">${L('Bài viết · TELOS Academy', 'Article in Vietnamese · TELOS Academy')}</p>${body}
    <div class="row"><a class="btn btn-primary" href="${escapeHtml(out.href)}" target="_blank" rel="noopener">${L('Đọc tiếp trên TELOS Academy', 'Read on TELOS Academy')}</a><p class="rd-note">${L('Tiến độ game đã được lưu. Đọc xong quay lại đây để chơi tiếp.', 'Your progress is saved. Come back here when you are done reading.')}</p></div></div>`;
  // mở từ sheet phần thưởng / tổng kết thì chồng lên trên, đóng xem trước sẽ quay lại đó
  if (!a.closest('#modal')) closeSheets('reader');
  el.dataset.url = url;
  el.innerHTML = shell(`<div class="rd-head"><div class="rd-img sk"></div><h3>${escapeHtml(label)}</h3></div><p class="rd-ex sk-line"></p><p class="rd-ex sk-line short"></p>`);
  el.hidden = false; el.querySelector('.close').onclick = closeReader;
  saveProgress();
  fetchPreview(url).then(p => {
    if (el.hidden || el.dataset.url !== url) return;
    el.innerHTML = shell(p
      ? `<div class="rd-head">${p.img ? `<img class="rd-img" src="${escapeHtml(p.img)}" alt="" loading="lazy">` : ''}<h3>${escapeHtml(p.title || label)}</h3></div><p class="rd-ex">${escapeHtml(p.excerpt)}</p>`
      : `<div class="rd-head"><h3>${escapeHtml(label)}</h3></div><p class="rd-ex" style="color:var(--ink-faint)">${L('Chưa tải được phần xem trước. Bạn vẫn có thể mở bài đầy đủ.', 'Could not load the preview. You can still open the full article.')}</p>`);
    el.querySelector('.close').onclick = closeReader;
  });
}
function closeReader(){ $('#reader').hidden = true; }

// ---------- nhiệm vụ theo giờ ----------
if (window.TM_HOURLY_GAMES && D.HOURLY){
  try {
    HX = window.TM_HOURLY_GAMES({ D, L, LANG, $, track, THREE, Q, camera, canvas, overlay, keys, labels,
      get world(){ return world; }, get chars(){ return chars; }, get player(){ return player; }, get rooms(){ return rooms; },
      get scaleKey(){ return scaleKey; }, get mode(){ return mode; }, get t(){ return t; }, get camYaw(){ return camY.yaw; },
      setYaw:y => { camY.yawT = y; }, addLabel, walkTo, nearestFree, free, roomAt, roomOf, setFace, dialog, closeDialog, closePanel, openPanel,
      closeSheets, isMobile, goHome, sitDown, bossOf, mat, ball, box, cyl, groundPoint, pick, inst, drawLogo, faceEach, talk,
      setScale, project, mainBusy:() => mode === 'quest' && (['step','return'].includes(Q.phase) || !!Q.prog) });
  } catch (e) { console.error('[Team Map] Không khởi động được nhiệm vụ theo giờ:', e); HX = null; }
}

// ---------- boot ----------
const DEBUG = location.hash === '#debug' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? Object.assign(document.createElement('div'), { id:'dbg' }) : null; if (DEBUG) $('#app').appendChild(DEBUG);
if (DEBUG && HX) window.__tmHX = HX;   // chỉ khi chạy thử trên máy (localhost + #debug), dùng cho test tự động
function resize(){ const app = $('#app'), r = app.getBoundingClientRect(), w = Math.round(r.width) || innerWidth, h = Math.round(r.height) || innerHeight; if (w === resize.w && h === resize.h) return; resize.w = w; resize.h = h; renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe($('#app'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
resize();
Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))]).then(() => {
  const saved = loadProgress();
  buildWorld(saved && SCALES[saved.scale] ? saved.scale : SCALES.small ? 'small' : SCALE_KEYS[0]);
  ['small','large','agency'].forEach(x => $('#sc-' + x).setAttribute('aria-pressed', scaleKey === x)); $('#scale-select').value = scaleKey;
  if (saved) resumeFrom(saved); else renderQuest();
  if (HX) HX.onWorld();
  loop(); });
function loop(){
  const dt = Math.min(.05, clock.getDelta()); t += dt; frame++;
  chars.forEach(c => { think(c, dt); stepChar(c, dt); });
  questTick(dt);
  if (HX) HX.tick(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  updateLabels();
  if (frame % 3 === 0) drawMini();
  if (frame % 8 === 0) checkRoom();
  if (DEBUG && frame % 15 === 0){ const r = $('#app').getBoundingClientRect(), pp = project(new THREE.Vector3(player.obj.root.position.x, 1, player.obj.root.position.z));
    DEBUG.textContent = `window ${innerWidth}×${innerHeight}  dpr ${devicePixelRatio}\napp ${Math.round(r.width)}×${Math.round(r.height)} @ ${Math.round(r.left)},${Math.round(r.top)}\ncanvas css ${canvas.clientWidth}×${canvas.clientHeight}  buffer ${canvas.width}×${canvas.height}\nplayer on screen ${Math.round(pp.x)},${Math.round(pp.y)}\nvisualViewport ${window.visualViewport ? Math.round(visualViewport.width)+'×'+Math.round(visualViewport.height) : '-'}\ndrag ${drag ? (drag.moved ? 'rotating' : 'down') : 'none'}  yaw ${camY.yaw.toFixed(2)}\n${navigator.userAgent.slice(-60)}`; }
  requestAnimationFrame(loop);
}
};
