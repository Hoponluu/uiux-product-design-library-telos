// Nhân vật mascot dùng chung cho Team Map (/team-map) và trang Hành trình (/hanh-trinh-ui-ux).
// Nạp sau three.min.js, trước engine: <script src="/team-map/team-map.mascot.js">. Xuất ra window.TM_MASCOT.
(function(){
'use strict';

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
  ko: tex(g => { eyeBase(g); g.strokeStyle = PUPIL; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); g.moveTo(40,40); g.lineTo(88,88); g.moveTo(88,40); g.lineTo(40,88); g.stroke(); }),   // bị đánh gục: mắt chữ X
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
    g.position.set(.58,.9,.32); return g; },
  // ---- đồ nghề của trang Hành trình (dùng được cả ở Team Map) ----
  blocks(){ const g = new THREE.Group(); [['#E92F7C',0],['#35C6E8',.1],['#FFC53D',.2]].forEach(([c,y],i) => { const b = box(.2,.09,.13,c); b.position.set((i-1)*.025,y,0); b.rotation.y = (i-1)*.25; g.add(b);
      [-.05,.05].forEach(dx => { const s = cyl(.025,.025,.03,c,10); s.position.set((i-1)*.025+dx,y+.06,0); g.add(s); }); });
    g.position.set(.6,.8,.3); g.rotation.set(-.15,-.4,0); return g; },
  robot(){ const g = new THREE.Group(), base = new THREE.Vector3(-.74,1.42,.08);
    const b = ball(.14,'#F4F0FB'); g.add(b); const visor = ball(.1,'#241775'); visor.scale.set(.1,.07,.05); visor.position.set(0,.01,.11); g.add(visor);
    const eye = new THREE.Mesh(G.sphereLo, new THREE.MeshBasicMaterial({ color:'#5CF2FF' })); eye.scale.setScalar(.035); eye.position.set(0,.01,.155); g.add(eye);
    const ant = cyl(.01,.01,.1,'#5B5270',6); ant.position.y = .18; g.add(ant); const tip = new THREE.Mesh(G.sphereLo, new THREE.MeshBasicMaterial({ color:'#E92F7C' })); tip.scale.setScalar(.03); tip.position.y = .24; g.add(tip);
    [-1,1].forEach(s => { const w = box(.04,.08,.1,'#D9D6E6'); w.position.set(s*.15,0,0); g.add(w); });
    g.position.copy(base);
    // bay lơ lửng cạnh vai, nhấp nhô chậm (tự chạy, không cần vòng lặp của trang)
    b.onBeforeRender = () => { const t = performance.now() / 1000; g.position.y = base.y + Math.sin(t * 1.6) * .06; g.rotation.y = Math.sin(t * .7) * .4; };
    return g; },
  browser(){ const g = new THREE.Group(); g.add(box(.78,.54,.03,'#FFFFFF')); const bar = box(.78,.09,.035,'#241775'); bar.position.y = .225; g.add(bar);
    ['#E92F7C','#FFC53D','#35C6E8'].forEach((c,i) => { const d = cyl(.022,.022,.04,c,12); d.rotation.x = Math.PI/2; d.position.set(-.33+i*.065,.225,.02); g.add(d); });
    [[.5,.09,'#D9D6E6',-.02,.1],[.3,.05,'#35C6E8',-.12,-.02],[.4,.05,'#E92F7C',-.07,-.1]].forEach(([w,h,c,x,y]) => { const l = box(w,h,.01,c); l.position.set(x,y,.02); g.add(l); });
    g.position.set(0,1.32,-.72); g.rotation.set(-.12,Math.PI,0); return g; },
  codeLaptop(){ const g = new THREE.Group(); const base = box(.44,.025,.3,'#D9D6E6'); g.add(base);
    const scr = new THREE.Group(); scr.position.set(0,.012,-.15); scr.rotation.x = -1.2; g.add(scr);
    const lid = box(.44,.3,.02,'#D9D6E6'); lid.position.y = .15; scr.add(lid);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.38,.25), new THREE.MeshBasicMaterial({ map:codeTex })); face.position.set(0,.15,.012); scr.add(face);
    g.position.set(-.6,.74,.2); g.rotation.set(.35,.5,.15); return g; }
};
// màn hình laptop "</>" của codeLaptop
const codeTex = tex(g => { g.fillStyle = '#170B3D'; g.fillRect(0,0,256,168); g.fillStyle = '#5CF2FF'; g.font = 'bold 84px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('</>', 128, 84); }, 256);

// ---------- mascot character ----------
// buildMascot(role, { isPlayer, ringColor }) → { root, inner, body, eye, mouth, legs, hands, ring, propsG }
// role: { props, dark, bodyColor, outlineColor, outfit }. Đồ nghề nằm trong propsG để setProps thay được mà không dựng lại nhân vật.
function buildMascot(role, opts = {}){
  const isPlayer = !!opts.isPlayer;
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
  const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: isPlayer ? '#E92F7C' : (opts.ringColor || '#8B7FE0'), transparent:true, opacity: isPlayer ? .55 : .38, depthWrite:false }));
  ring.rotation.x = -Math.PI/2; ring.position.y = .02; root.add(ring);
  const propsG = new THREE.Group(); inner.add(propsG);
  const o = { root, inner, body, eye, mouth, legs, hands, ring, propsG };
  setProps(o, role.props || [], opts);
  body.userData.pick = true;
  return o;
}
function setFace(o, eye, mouth){ o.eye.material.map = FACE[eye]; o.mouth.material.map = FACE[mouth]; }

// ---------- đồ nghề: vị trí trên người ----------
// Mỗi vị trí có giới hạn (trang Hành trình): 2 món trên tay, 1 trên đầu, 1 trên mặt, 1 sau lưng, 1 món bay; đồ mặc không giới hạn.
const SLOT_OF = { cap:'head', hair:'head', headset:'head', glasses:'face', monocle:'face', backpack:'back', browser:'back', robot:'float', blazer:'body', necklace:'body' };
const SLOT_MAX = { hand:2, head:1, face:1, back:1, float:1, body:99 };
const LEFT_HAND = new Set(['codeLaptop']);   // món cầm tay trái sẵn
const slotOf = p => SLOT_OF[p] || 'hand';
// list: mã đồ nghề theo thứ tự cũ → mới. Trùng vị trí thì món mới hơn được giữ.
function resolveProps(list){
  const used = {}, keep = new Set();
  for (let i = list.length - 1; i >= 0; i--){ const p = list[i]; if (!PROPS[p] || keep.has(p)) continue; const s = slotOf(p);
    if ((used[s] || 0) < SLOT_MAX[s]){ used[s] = (used[s] || 0) + 1; keep.add(p); } }
  return list.filter((p, i) => keep.has(p) && list.indexOf(p) === i);
}
// Thay toàn bộ đồ nghề. opts.arrange: hai món cầm tay cùng bên thì món cũ hơn chuyển sang tay trái (soi gương).
function setProps(o, props, opts = {}){
  while (o.propsG.children.length) o.propsG.remove(o.propsG.children[0]);
  const hands = opts.arrange ? props.filter(p => PROPS[p] && slotOf(p) === 'hand') : [];
  const mirror = new Set();
  if (hands.length === 2){ const [a, b] = hands; if (!LEFT_HAND.has(a) && !LEFT_HAND.has(b)) mirror.add(a); }
  props.forEach(p => { if (!PROPS[p]) return; const m = PROPS[p]();
    if (mirror.has(p)){ const w = new THREE.Group(); w.scale.x = -1; w.add(m); o.propsG.add(w); } else o.propsG.add(m); });
  o.props = props.slice();
  return o;
}
// Hào quang Product Designer quanh chân (giữ mãi về sau)
function addHalo(o){
  if (o.halo) return o.halo;
  const g = new THREE.Group(); g.position.y = .04;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.72, .035, 8, 48), new THREE.MeshBasicMaterial({ color:'#FFD54A', transparent:true, opacity:.85 })); ring.rotation.x = Math.PI/2; g.add(ring);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(.9, 40), new THREE.MeshBasicMaterial({ color:'#FFE58A', transparent:true, opacity:.28, depthWrite:false })); glow.rotation.x = -Math.PI/2; glow.position.y = -.02; g.add(glow);
  for (let i = 0; i < 6; i++){ const s = new THREE.Mesh(G.sphereLo, new THREE.MeshBasicMaterial({ color: i % 2 ? '#E92F7C' : '#35C6E8' })); s.scale.setScalar(.045); const a = i / 6 * Math.PI * 2; s.position.set(Math.cos(a) * .72, .02, Math.sin(a) * .72); g.add(s); }
  ring.onBeforeRender = () => { const t = performance.now() / 1000; g.rotation.y = t * .8; glow.material.opacity = .22 + Math.sin(t * 2.4) * .08; };
  o.root.add(g); o.halo = g; return g;
}

window.TM_MASCOT = { buildMascot, setProps, resolveProps, slotOf, addHalo, setFace, PROPS, PROP_LIST: Object.keys(PROPS), FACE, G, mat, tex, box, cyl, torus, ball, INK, PUPIL, BODY, OUTLINE, DARK_BODY, DARK_OUTLINE };
})();
