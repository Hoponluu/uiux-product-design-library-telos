// Smoke test (mức 1–2): mở các trang ở nhiều cỡ màn hình, báo lỗi JS, chụp ảnh nếu cần.
//   node tests/smoke.js [--base http://localhost:8799] [--paths /,/team-map,/hanh-trinh-ui-ux] [--sizes 1440x900,390x844] [--shots <thư mục>]
// Chặn Supabase thật và Google Analytics: trang dùng dữ liệu mẫu (khi server chạy bằng tests/local-server.js) và không gửi số liệu giả.
// Playwright có sẵn trong môi trường cloud: NP=$(dirname $(dirname $(which node)))/lib/node_modules, Chromium ở /opt/pw-browsers (đừng chạy "playwright install").
const NP = process.env.NP || require('path').join(require('path').dirname(process.execPath), '..', 'lib', 'node_modules');
const { chromium } = require(NP + '/playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:8799'), PATHS = arg('paths', '/,/team-map,/hanh-trinh-ui-ux,/thuat-ngu').split(','),
  SIZES = arg('sizes', '1440x900,390x844').split(',').map(s => s.split('x').map(Number)), SHOTS = arg('shots', '');
(async () => {
  const b = await chromium.launch({ args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });   // WebGL phần mềm cho Three.js
  let fail = 0;
  for (const path of PATHS) for (const [w, h] of SIZES){
    const p = await b.newPage({ viewport:{ width:w, height:h }, isMobile:w < 500, hasTouch:w < 500 }); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.route(/supabase\.co|googletagmanager|google-analytics|doubleclick/, r => r.abort());
    const r = await p.goto(BASE + path, { waitUntil:'load', timeout:45000 }).catch(e => ({ status:() => 'ERR ' + e.message.split('\n')[0] }));
    await p.waitForTimeout(2500);
    const st = r.status(), ok = st === 200 && !errs.length; if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${path} @${w}x${h} — HTTP ${st}${errs.length ? ' · lỗi JS: ' + errs.join(' | ') : ''}`);
    if (SHOTS){ require('fs').mkdirSync(SHOTS, { recursive:true }); await p.screenshot({ path:`${SHOTS}/${path.replace(/\W+/g, '_') || 'home'}_${w}.png` }); }
    await p.close();
  }
  await b.close();
  console.log(fail ? `RESULT: ${fail} FAIL` : 'RESULT: ALL PASS'); process.exit(fail ? 1 : 0);
})();
