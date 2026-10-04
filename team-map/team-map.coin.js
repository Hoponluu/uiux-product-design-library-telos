// Team Map — đồng xu huy hiệu 3D (Three.js r128). Dùng chung cho game (bộ sưu tập, bảng kết quả) và CMS (xem trước).
// CylinderGeometry bán kính 1, dày 0,12, 64 cạnh; viền theo rim_color có ánh kim; mặt trước dán hình admin upload
// (cắt tròn theo UV của nắp trụ); mặt sau là nền rim_color + logo + ngày đạt.
(function(){
  // mặt mặc định khi chưa có hình: nền màu viền + logo (drawLogo của engine nếu có, không thì chữ TELOS)
  function logoFace(rim, size = 512, drawLogo){
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    g.fillStyle = rim; g.fillRect(0, 0, size, size); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(size/2, size/2, size*.42, 0, 7); g.fill();
    if (drawLogo) drawLogo(g, size*.24, size*.24, size*.52, '#1C1033');
    else { g.fillStyle = '#1C1033'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${size*.16}px "Be Vietnam Pro", sans-serif`; g.fillText('TELOS', size/2, size/2); }
    return c;
  }
  function textures(b, iso, o){
    const make = c => { const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };
    const back = document.createElement('canvas'); back.width = back.height = 512; const g = back.getContext('2d');
    g.fillStyle = b.rim; g.fillRect(0, 0, 512, 512);
    if (o.drawLogo) o.drawLogo(g, 176, 120, 160, '#1C1033');
    g.fillStyle = '#1C1033'; g.textAlign = 'center'; g.font = '700 34px "Be Vietnam Pro", sans-serif'; g.fillText('TELOS ACADEMY', 256, 340);
    g.font = '500 28px "Be Vietnam Pro", sans-serif'; g.fillText(iso && o.dateText ? o.dateText(iso) : '', 256, 384);
    if (o.serial){ g.font = '700 30px "JetBrains Mono", ui-monospace, monospace'; g.fillText(o.serial, 256, 430); }   // mã huy hiệu ở mặt sau
    const front = make(logoFace(b.rim, 512, o.drawLogo)), backT = make(back);
    backT.wrapS = THREE.RepeatWrapping; backT.repeat.x = -1;   // nhìn từ phía sau: lật ngang để chữ không ngược
    if (b.image){ const ld = new THREE.TextureLoader(); ld.setCrossOrigin('anonymous');
      ld.load(b.image, t => { front.image = t.image; front.needsUpdate = true; o.onImage && o.onImage(true); }, undefined, () => { o.onImage && o.onImage(false); }); }
    return { front, back:backT };
  }
  function make(b, iso, o){
    const geo = new THREE.CylinderGeometry(1, 1, .12, 64); geo.rotateX(Math.PI / 2);
    // UV của hai mặt tròn tính lại theo mặt phẳng XY sau khi xoay: ảnh đứng thẳng (UV gốc của nắp trụ bị lệch 90°)
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) if (Math.abs(nor.getZ(i)) > .9) uv.setXY(i, pos.getX(i) / 2 + .5, pos.getY(i) / 2 + .5);
    uv.needsUpdate = true;
    const tx = textures(b, iso, o);
    const side = new THREE.MeshStandardMaterial({ color:b.rim, metalness:.75, roughness:.32 });
    const front = new THREE.MeshStandardMaterial({ map:tx.front, metalness:.15, roughness:.45 });
    const back = new THREE.MeshStandardMaterial({ map:tx.back, metalness:.35, roughness:.4 });
    // [thân, nắp trên, nắp dưới]; sau rotateX nắp trên quay về +Z (mặt trước)
    const mesh = new THREE.Mesh(geo, [side, front, back]);
    return { mesh, dispose:() => { geo.dispose(); [side, front, back].forEach(x => { if (x.map) x.map.dispose(); x.dispose(); }); } };
  }
  // o: { intro, mini, drawLogo, dateText, reduceMotion, onImage }
  function scene(canvas, b, iso, o = {}){
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, preserveDrawingBuffer:true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .1, 50); cam.position.set(0, 0, 4.4);
    sc.add(new THREE.AmbientLight(0xffffff, .75)); const dl = new THREE.DirectionalLight(0xffffff, .9); dl.position.set(2, 3, 4); sc.add(dl);
    const rl = new THREE.DirectionalLight(0xffe7b0, .45); rl.position.set(-3, -1, 2); sc.add(rl);
    let coin = make(b, iso, o); sc.add(coin.mesh);
    let vel = o.intro ? 18 : 0, rot = o.intro ? -Math.PI * 2 : 0, scale = o.intro ? .2 : 1, dragging = null, alive = true, last = performance.now();
    const auto = o.reduceMotion ? 0 : (o.mini ? 1.2 : .6);
    const size = () => { const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    size();
    const frame = now => { if (!alive) return; const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!dragging){ vel += (auto - vel) * Math.min(1, dt * 1.6); rot += vel * dt; }
      scale += (1 - scale) * Math.min(1, dt * 4);
      coin.mesh.rotation.y = rot; coin.mesh.scale.setScalar(scale); renderer.render(sc, cam); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    if (!o.mini){
      const down = e => { dragging = { x:e.clientX, t:performance.now(), r:rot }; vel = 0; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} };
      const move = e => { if (!dragging) return; const nr = dragging.r + (e.clientX - dragging.x) * .012, dtm = Math.max(1, performance.now() - dragging.t);
        vel = (nr - rot) / (dtm / 1000) * .5; rot = nr; dragging.t = performance.now(); dragging.r = rot; dragging.x = e.clientX; };
      const up = () => { dragging = null; };
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.style.touchAction = 'none';
    }
    return { renderer, render:() => renderer.render(sc, cam), resize:size, angle:() => rot,
      // đổi huy hiệu đang xem (CMS: sửa màu / hình xong cập nhật ngay)
      update:nb => { sc.remove(coin.mesh); coin.dispose(); coin = make(nb, iso, o); sc.add(coin.mesh); },
      destroy:() => { alive = false; coin.dispose(); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } };
  }
  window.TM_COIN = { logoFace, scene };
})();
