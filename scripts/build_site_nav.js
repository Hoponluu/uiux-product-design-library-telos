// Dán menu chính (api/_lib/nav.js) vào các trang HTML tĩnh và gắn nav/site-nav.{css,js}.
// Chạy: node scripts/build_site_nav.js  (sau đó: python3 scripts/build_team_map_en.py để sinh lại bản tiếng Anh của Product Map)
const fs = require('fs'), path = require('path');
const { tabPill } = require('../api/_lib/nav.js');
const ROOT = path.join(__dirname, '..');
const PAGES = [
  { file:'TELOS_Knowledge_Graph.html', lang:'vi', active:'graph', home:true },
  { file:'team-map.html', lang:'vi', active:'map', home:false },
];
for (const p of PAGES){
  const f = path.join(ROOT, p.file); let s = fs.readFileSync(f, 'utf8');
  const start = s.search(/<(nav|div) id="tab-pill"/); if (start < 0) throw new Error(p.file + ': không thấy #tab-pill');
  const tag = s.slice(start + 1, start + 4) === 'nav' ? 'nav' : 'div';
  // tìm thẻ đóng khớp (đếm lồng nhau cùng loại)
  let depth = 0;
  const tok = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g'); tok.lastIndex = start; let m, end = -1;
  while ((m = tok.exec(s))){ if (m[0].startsWith('</')) { depth--; if (depth === 0){ end = m.index + m[0].length; break; } } else depth++; }
  if (end < 0) throw new Error(p.file + ': không thấy thẻ đóng');
  s = s.slice(0, start) + tabPill(p.lang, p.active, p.home) + s.slice(end);
  if (!s.includes('/nav/site-nav.css')) s = s.replace('</head>', '<link rel="stylesheet" href="/nav/site-nav.css">\n</head>');
  if (!s.includes('/nav/site-nav.js')) s = s.replace('</body>', '<script src="/nav/site-nav.js" defer></script>\n</body>');
  fs.writeFileSync(f, s); console.log('đã cập nhật', p.file);
}
