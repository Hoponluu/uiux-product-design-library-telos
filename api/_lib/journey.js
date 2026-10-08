// Trang Hành trang học tập (/hanh-trinh-ui-ux) — docs/SPEC-journey.md (bản 2: game 2D đi theo nấc; bấm trạm để đi, bản đồ phủ màn hình, hai bảng Vai trò / Khóa học dàn cột ở đáy).
// Render phía server mỗi request từ tm_journey_checkpoints + tm_journey_settings (CDN cache vài phút): meta, JSON-LD,
// bản đồ trạm và hai bảng Vai trò / Khóa học ở trạm xuất phát. Supabase lỗi thì dùng seed đi kèm repo.
// Game (journey/journey.js) đọc cùng dữ liệu (nhúng trong trang) rồi tự tải lại bản mới nhất từ Supabase.

const SITE = 'https://uiux-library.nhanluu.com';
const PATH = '/hanh-trinh-ui-ux';
const REST = process.env.SB_REST || 'https://vvpqhsglgtfwjklvlvuh.supabase.co/rest/v1';
const KEY = process.env.SB_KEY || 'sb_publishable_slwezFWl9SM0ngQiVdIZuQ_XvVkhmCU';
const TTL = 2 * 60 * 1000;
const SEED = require('../../team-map/seed-journey.json');
const DEFAULTS = {
  seo_title:'Lộ trình học UI/UX Designer và Product Designer | TELOS Academy',
  seo_description:'Lộ trình từ con số 0 tới Product Designer tại TELOS Academy: Figma, UI, UX, Design System, A.I. và Product Design & Manage, cùng hai nhánh Web Design và Code for Designer. Chơi thử dạng game, mỗi trạm là một khoá học.',
  intro_text:'Sáu trạm chính và hai nhánh tuỳ chọn, mỗi trạm là một khoá học tại TELOS Academy. Đi qua trạm nào, bạn biết mình sẽ học gì, học xong làm được gì, và lên đời thành phiên bản nào của một designer.',
  og_image_url:null, workplaces:SEED.workplaces,
};

let cache = null;
async function get(path){
  const h = { apikey:KEY };
  if (!KEY.startsWith('sb_')) h.Authorization = 'Bearer ' + KEY;
  const r = await fetch(`${REST}/${path}`, { headers:h });
  if (!r.ok) throw new Error(`Supabase ${path.split('?')[0]}: ${r.status}`);
  return r.json();
}
async function load(){
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  let checkpoints = SEED.checkpoints, settings = DEFAULTS, source = 'seed';
  try {
    const [cps, st] = await Promise.all([get('tm_journey_checkpoints?select=*&order=sort_order'), get('tm_journey_settings?select=*&id=eq.1')]);
    if (Array.isArray(cps) && cps.length){ checkpoints = cps; source = 'db'; }
    if (Array.isArray(st) && st[0]) settings = Object.assign({}, DEFAULTS, Object.fromEntries(Object.entries(st[0]).filter(([, v]) => v !== '' && v != null)));
  } catch (e) { console.error('[journey]', e.message); }
  checkpoints = checkpoints.map(c => Object.assign({}, c, { name:cleanName(c.name) }));
  const data = { checkpoints, settings, source };
  if (source === 'db') cache = { at:Date.now(), data };
  return data;
}

// tên nhánh cũ có tiền tố "Rẽ trái: / Rẽ phải:" — bỏ đi khi hiển thị (DB chưa chạy lại SQL vẫn hiện đúng)
const cleanName = n => { const t = String(n == null ? '' : n).replace(/^\s*rẽ\s+(trái|phải)\s*:\s*/i, ''); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? u : null;

// Thứ tự trên đường: xuất phát → trạm chính theo sort_order, nhánh đặt ngay sau trạm rẽ ra → đích
function ordered(cps){
  const on = cps.filter(c => c.kind !== 'branch' || c.is_active !== false);
  const mains = on.filter(c => c.kind === 'main').sort((a, b) => a.sort_order - b.sort_order);
  const out = on.filter(c => c.kind === 'start');
  mains.forEach(m => { out.push(m); on.filter(c => c.kind === 'branch' && c.branch_after === m.id).sort((a, b) => a.sort_order - b.sort_order).forEach(b => out.push(b)); });
  return out.concat(on.filter(c => c.kind === 'finish'));
}

// Màu ô trạm: Figma (và trạm cuối) xanh dương TELOS, UI + UX vàng, Design System + A.I. trắng viền xanh, nhánh rẽ hồng.
// Trạm chính mới tạo trong CMS mà chưa có ở đây thì dùng kiểu trắng viền xanh.
const TONE = { figma:'blue', ui:'yellow', ux:'yellow', ds:'line', ai:'line', pdm:'blue' };
const tone = c => c.kind === 'branch' ? 'pink' : c.kind === 'main' ? (TONE[c.id] || 'line') : 'plain';

// Bảng "Vai trò" và "Khóa học" của một trạm (server render trạng thái ban đầu; journey.js vẽ lại khi đi tới trạm khác)
function rolePanel(c){
  const skills = (c.role_skills || []).filter(Boolean), link = c.role_link && /^(\/|https?:\/\/)/.test(c.role_link) ? c.role_link : null;
  return `<div class="jx-col"><p class="jx-k">${c.kind === 'start' ? 'Bạn bắt đầu là' : c.kind === 'finish' ? 'Bạn vào văn phòng là' : 'Vai trò sau trạm này'}</p>
    <h2 class="jx-role-t">${esc(c.form_title)}</h2>
    ${c.form_description ? `<p class="jx-quote">${esc(c.form_description)}</p>` : ''}
    ${c.role_summary ? `<p>${esc(c.role_summary)}</p>` : ''}
</div>
    <div class="jx-col">${skills.length ? `<h3>Kiến thức cần có</h3><ul class="jx-skills">${skills.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
    ${link ? `<a class="jx-link" href="${esc(link)}" target="_blank" rel="noopener">Tìm hiểu vai trò này →</a>` : ''}</div>`;
}
function coursePanel(c){
  if (c.kind === 'start' || c.kind === 'finish') return `<div class="jx-col"><p class="jx-k">${c.kind === 'start' ? 'Bắt đầu' : 'Đích'}</p><h2>${esc(c.name)}</h2></div>
    <div class="jx-col">${c.description ? `<p>${esc(c.description)}</p>` : ''}</div><div class="jx-col">${c.outcome ? `<p class="jx-out">${esc(c.outcome)}</p>` : ''}</div>`;
  const url = safeUrl(c.course_url), img = safeUrl(c.course_image_url), know = (c.knowledge || []).filter(Boolean);
  return `<div class="jx-col">${img ? `<a class="jx-thumb" href="${esc(url || '#')}" target="_blank" rel="noopener" data-ga="journey_course_click" data-cp="${esc(c.id)}"><img src="${esc(img)}" alt="${esc(c.course_title || c.name)}" width="1200" height="630" onload="this.parentNode.classList.add('ok')" onerror="this.parentNode.hidden=true"></a>` : ''}
    ${url ? `<a class="gx-btn" href="${esc(url)}" target="_blank" rel="noopener" data-ga="journey_course_click" data-cp="${esc(c.id)}">Xem khóa học tại TELOS ↗</a>` : ''}</div>
    <div class="jx-col"><p class="jx-k">${c.kind === 'branch' ? 'Nhánh rẽ · ' : ''}Khóa học${c.sessions ? ` · ${esc(c.sessions)} buổi` : ''}</p>
    <h2>${esc(c.course_title || c.name)}</h2>${c.description ? `<p>${esc(c.description)}</p>` : ''}</div>
    <div class="jx-col jx-col-list">${know.length ? `<h3>Bạn sẽ học</h3><ul>${know.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}${c.outcome ? `<p class="jx-out"><b>Học xong bạn sẽ:</b> ${esc(c.outcome)}</p>` : ''}</div>`;
}

function render(d, opts = {}){
  const s = d.settings, list = ordered(d.checkpoints), embed = !!opts.embed;
  const start = list.find(c => c.kind === 'start') || list[0];
  const courses = list.filter(c => (c.kind === 'main' || c.kind === 'branch') && c.course_title);
  const og = safeUrl(s.og_image_url) || `${SITE}/Thumb.png`;
  const ld = { '@context':'https://schema.org', '@graph':[
    { '@type':'ItemList', '@id':SITE + PATH + '#lo-trinh', name:'Lộ trình trở thành UI/UX Designer và Product Designer', numberOfItems:courses.length,
      itemListElement:courses.map((c, i) => ({ '@type':'ListItem', position:i + 1, item:{ '@type':'Course', name:c.course_title, description:c.description || c.name,
        ...(safeUrl(c.course_url) ? { url:c.course_url } : {}), ...(safeUrl(c.course_image_url) ? { image:c.course_image_url } : {}),
        provider:{ '@type':'Organization', name:'TELOS Academy', sameAs:'https://academy.telos.vn' } } })) },
    { '@type':'BreadcrumbList', itemListElement:[{ '@type':'ListItem', position:1, name:'Thư viện UI/UX', item:SITE + '/' }, { '@type':'ListItem', position:2, name:'Hành trang học tập', item:SITE + PATH }] },
  ] };
  // dữ liệu cho game (đọc trong journey/journey.js)
  const boot = { checkpoints:d.checkpoints, settings:{ workplaces:s.workplaces || SEED.workplaces }, combos:SEED.branch_combos, embed };
  // các trạm trên bản đồ (journey.js đặt vị trí + vẽ đường)
  let n = 0;
  const nodes = list.map(c => `<button class="jx-node jx-${esc(c.kind)} jx-t-${tone(c)}" type="button" data-cp="${esc(c.id)}" aria-label="${esc(c.name)}${c.course_title ? ' · ' + esc(c.course_title) : ''}">
      <span class="jx-dot">${c.kind === 'start' ? '🐔' : c.kind === 'finish' ? '🏢' : c.kind === 'main' ? ++n : '+'}</span><span class="jx-lbl">${esc(c.name)}</span></button>`).join('');

  const tab = (href, icon, label, active) => `<a class="tab-btn${active ? ' active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}><span class="tb-icon">${icon}</span><span class="tb-label">${label}</span></a>`;
  const shell = embed ? '' : `<div id="tabs">
  <a id="header-logo" href="https://nhanluu.com" target="_blank" rel="noopener" title="nhanluu.com" aria-label="Nhân Lưu">${LOGO}</a>
  <button id="menu-btn" onclick="openNav()" aria-label="Menu" title="Menu"><span class="mdot mdot-l"></span><span class="mdot mdot-c"></span><span class="mdot mdot-r"></span></button>
</div>
<nav id="tab-pill" aria-label="Công cụ trong thư viện">${[tab('/', '🗺', 'Graph view'), tab('/?tab=glossary', '🔤', 'A-Z'), tab('/?tab=flashcard', '🃏', 'Flashcard Quiz'),
    tab('/?tab=challenge', '🎲', 'UI Challenge'), tab('/team-map', '🏢', 'Product Map'), tab(PATH, '🧭', 'Hành trang học tập', true), tab('/?tab=about', 'ℹ️', 'Về dự án')].join('')}</nav>
<div id="nav-overlay" role="dialog" aria-modal="true" aria-label="Navigation">
  <div id="nav-backdrop" onclick="closeNav()"></div>
  <nav id="nav-panel">
    <button id="nav-close" onclick="closeNav()" aria-label="Đóng menu"><span class="nav-x-line"></span><span class="nav-x-line"></span></button>
    <div class="nav-divider"></div>
    <a class="nav-link" href="https://nhanluu.com/about-me/" target="_blank" rel="noopener">ABOUT ME</a>
    <a class="nav-link" href="https://nhanluu.com/portfolio/" target="_blank" rel="noopener">PORTFOLIO</a>
    <a class="nav-link" href="https://nhanluu.com/blog/" target="_blank" rel="noopener">BLOG</a>
    <a class="nav-link" href="https://nhanluu.com/contact/" target="_blank" rel="noopener">CONTACT</a>
    <button class="nav-dark-toggle" onclick="toggleMode()"><span class="nav-dark-icon" id="nav-mode-icon">🌙</span><span id="nav-mode-label">Chế độ tối</span></button>
  </nav>
</div>`;

  return `<!DOCTYPE html>
<html lang="vi" class="no-js${embed ? ' jx-embed' : ''}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(s.seo_title)}</title>
<meta name="description" content="${esc(s.seo_description)}">
<meta name="author" content="Nhân Lưu — TELOS Academy">
<meta name="robots" content="${embed ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<link rel="canonical" href="${SITE + PATH}">
${embed ? '<base target="_blank">' : ''}
<link rel="icon" type="image/png" href="/Fav.png">
<link rel="apple-touch-icon" href="/Fav.png">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE + PATH}">
<meta property="og:title" content="${esc(s.seo_title)}">
<meta property="og:description" content="${esc(s.seo_description)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="TELOS Academy">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(s.seo_title)}">
<meta name="twitter:description" content="${esc(s.seo_description)}">
<meta name="twitter:image" content="${esc(og)}">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PFSCQRQZM6"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-PFSCQRQZM6');
document.documentElement.classList.remove('no-js');try{if(localStorage.getItem('telos-theme')==='dark')document.documentElement.classList.add('jx-dark')}catch(e){}</script>
<link rel="preconnect" href="https://vvpqhsglgtfwjklvlvuh.supabase.co">
<link rel="stylesheet" href="/glossary/glossary.css">
<link rel="stylesheet" href="/journey/journey.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<script>if(document.documentElement.classList.contains('jx-dark'))document.body.classList.add('dark')</script>
${shell}
<main id="jx">
<section class="jx-game" id="jx-game" aria-label="Game hành trang học tập">
  <header class="jx-head">
    <div><p class="jx-eyebrow">TELOS Academy · Từ Newbie tới Product Designer</p><h1>Hành trình trở thành Product Designer</h1></div>
    <button class="jx-reset" id="jx-reset" type="button" data-act="reset" hidden>↺ Đi lại từ đầu</button>
  </header>
  <div class="jx-board" id="jx-board">
    <svg class="jx-track" id="jx-track" aria-hidden="true"></svg>
    ${nodes}
    <div class="jx-token" id="jx-token" aria-hidden="true"><canvas id="jx-avatar" width="220" height="260"></canvas><span class="jx-emoji">🧑‍💻</span><span class="jx-tag" id="jx-tag">${esc(start.form_title)}</span></div>
    <div class="jx-confetti" id="jx-confetti" aria-hidden="true"></div>
    <div class="jx-banner" id="jx-banner" hidden></div>
    <div class="jx-hint" id="jx-hint" aria-hidden="true">Bấm để đi tiếp</div>
  </div>
  <p class="jx-sr" id="jx-live" aria-live="polite">Bấm vào trạm kế tiếp trên bản đồ để đi.</p>
  <div class="jx-panels">
    <article class="jx-panel jx-role" id="jx-role">${rolePanel(start)}</article>
    <article class="jx-panel jx-course" id="jx-course">${coursePanel(start)}</article>
  </div>
  <noscript><p class="jx-noscript">Bật JavaScript để chơi. Các khóa học trên lộ trình: ${courses.map(c => safeUrl(c.course_url) ? `<a href="${esc(c.course_url)}">${esc(c.course_title)}</a>` : esc(c.course_title)).join(' → ')}.</p></noscript>
  <div class="jx-modal" id="jx-modal" hidden><div class="jx-sheet" id="jx-sheet" role="dialog" aria-modal="true"></div></div>
  <div class="jx-fade" id="jx-fade" hidden></div>
</section>
</main>
<script type="application/json" id="jx-data">${JSON.stringify(boot).replace(/</g, '\\u003c')}</script>
${embed ? '' : `<script>
function setModeUI(d){document.body.classList.toggle('dark',d);document.documentElement.classList.toggle('jx-dark',d);var i=document.getElementById('nav-mode-icon'),l=document.getElementById('nav-mode-label');if(i){i.textContent=d?'☀️':'🌙';l.textContent=d?'Chế độ sáng':'Chế độ tối';}}
function toggleMode(){var d=!document.body.classList.contains('dark');setModeUI(d);try{localStorage.setItem('telos-theme',d?'dark':'light')}catch(e){}}
function openNav(){document.getElementById('nav-overlay').classList.add('open')}
function closeNav(){document.getElementById('nav-overlay').classList.remove('open')}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeNav()});
setModeUI(document.body.classList.contains('dark'));
</script>`}
<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-ga]');if(!a)return;try{gtag('event',a.getAttribute('data-ga'),{link_url:a.href,cp_id:a.getAttribute('data-cp')||'',click_source:'journey'})}catch(_){}});</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" defer></script>
<script src="/supabase.config.js" defer></script>
<script src="/team-map/team-map.mascot.js" defer></script>
<script src="/journey/journey.form.js" defer></script>
<script src="/journey/journey.js" defer></script>
</body>
</html>`;
}

const LOGO = `<svg fill="none" preserveAspectRatio="xMidYMid meet" viewBox="0 0 59.2927 68" style="width:100%;height:100%;"><path d="M6.01217 51.8294C5.42909 51.8294 4.97559 51.4134 4.97559 50.8785V34.5363C4.97559 34.0014 5.42909 33.5855 6.01217 33.5855C6.59525 33.5855 7.04876 34.0014 7.04876 34.5363V50.8191C7.04876 51.4134 6.59525 51.8294 6.01217 51.8294Z" fill="#282935"/><path d="M4.59018 60.2257L0.749669 63.9689C0.0181436 64.7176 0.566789 65.9269 1.60312 65.9269H10.3814C11.4787 65.9269 12.0274 64.66 11.2349 63.9689L7.27244 60.2257C6.54092 59.5346 5.32171 59.5346 4.59018 60.2257Z" fill="#282935"/><path d="M18.2095 2.48779H5.27699C3.47812 2.48779 1.56488 3.00049 0.733673 4.5942C-0.386691 6.74233 -0.247232 9.44754 1.31306 11.4884L42.7211 65.4923C44.8629 68.2938 48.9086 68.8303 51.7048 66.6845C52.5377 66.0288 53.0732 65.0155 53.0732 63.9425V46.9546C53.0732 46.1797 52.8352 45.4644 52.3592 44.8683L20.9462 3.85875C20.2918 3.02426 19.2804 2.48779 18.2095 2.48779Z" fill="#282935"/><path d="M43.0069 14.9041C44.6607 16.3014 46.9256 17 49.8017 17C52.8934 17 55.2302 16.2237 56.8121 14.6712C58.4658 13.1963 59.2927 11.1005 59.2927 8.38357C59.2927 5.58905 58.5018 3.49315 56.9199 2.09589C55.3381 0.698633 53.0732 0 50.1252 0C47.0334 0 44.6607 0.737447 43.0069 2.21233C41.4251 3.76484 40.6342 5.89954 40.6342 8.61644C40.6342 11.411 41.4251 13.5069 43.0069 14.9041Z" fill="#282935"/></svg>`;

module.exports = { load, render, ordered, rolePanel, coursePanel, PATH, _reset:() => { cache = null; } };
