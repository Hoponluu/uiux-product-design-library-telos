// Trang Hành trình UI/UX (/hanh-trinh-ui-ux) — docs/SPEC-journey.md.
// Phần lộ trình dạng chữ render phía server (cách (b) ở mục 4.2): mỗi request đọc tm_journey_checkpoints + tm_journey_settings
// từ Supabase (CDN cache vài phút), nên sửa trong CMS là HTML cho Google cập nhật theo. Supabase lỗi thì dùng seed đi kèm repo.
// Game 3D (journey/journey.js) đọc cùng dữ liệu (nhúng trong trang) rồi tự tải lại bản mới nhất từ Supabase.

const SITE = 'https://uiux-library.nhanluu.com';
const PATH = '/hanh-trinh-ui-ux';
const REST = process.env.SB_REST || 'https://vvpqhsglgtfwjklvlvuh.supabase.co/rest/v1';
const KEY = process.env.SB_KEY || 'sb_publishable_slwezFWl9SM0ngQiVdIZuQ_XvVkhmCU';
const TTL = 2 * 60 * 1000;
const SEED = require('../../team-map/seed-journey.json');
const DEFAULTS = {
  seo_title:'Lộ trình học UI/UX Designer và Product Designer | TELOS Academy',
  seo_description:'Lộ trình từ con số 0 tới Product Designer tại TELOS Academy: Figma, UI, UX, Design System, A.I. và Product Design & Manage, cùng hai nhánh Web Design và Code for Designer. Chơi thử dạng game 3D hoặc đọc từng chặng.',
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
  const data = { checkpoints, settings, source };
  if (source === 'db') cache = { at:Date.now(), data };
  return data;
}

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

function section(c, n){
  const kind = c.kind, url = safeUrl(c.course_url);
  const course = c.course_title ? `<p class="jx-course">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" data-ga="journey_course_click" data-cp="${esc(c.id)}">${esc(c.course_title)}</a>` : esc(c.course_title)}${c.sessions ? ` · <span>${esc(c.sessions)} buổi</span>` : ''}</p>` : '';
  const know = (c.knowledge || []).filter(Boolean);
  const tag = kind === 'branch' ? '<p class="jx-tag jx-tag-branch">Nhánh tuỳ chọn</p>' : kind === 'main' ? `<p class="jx-tag">Trạm ${n}${c.is_milestone ? ' · Mốc nghề' : ''}</p>` : kind === 'start' ? '<p class="jx-tag jx-tag-start">Xuất phát</p>' : '<p class="jx-tag jx-tag-finish">Đích</p>';
  return `<section id="${esc(c.id)}" class="jx-cp jx-${esc(kind)}" data-cp="${esc(c.id)}">
  <div class="jx-cp-dot" aria-hidden="true"></div>
  <div class="jx-cp-body">
    ${tag}
    <h2>${esc(c.name)}</h2>
    ${course}
    ${c.description ? `<p class="jx-desc">${esc(c.description)}</p>` : ''}
    ${know.length ? `<h3>Bạn sẽ học</h3><ul>${know.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
    ${c.outcome ? `<p class="jx-out"><b>Học xong bạn sẽ:</b> ${esc(c.outcome)}</p>` : ''}
    <p class="jx-form"><span>${kind === 'finish' ? 'Vào văn phòng với tư cách' : kind === 'start' ? 'Bạn bắt đầu là' : 'Hình thái đạt được'}</span> <b>${esc(c.form_title)}</b>${c.form_description ? ` — ${esc(c.form_description)}` : ''}</p>
    <button class="jx-fly" type="button" data-cp="${esc(c.id)}" hidden>Xem trên bản đồ ↑</button>
  </div>
</section>`;
}

function render(d, opts = {}){
  const s = d.settings, list = ordered(d.checkpoints), embed = !!opts.embed;
  let n = 0;
  const sections = list.map(c => section(c, c.kind === 'main' ? ++n : n)).join('\n');
  const courses = list.filter(c => (c.kind === 'main' || c.kind === 'branch') && c.course_title);
  const og = safeUrl(s.og_image_url) || `${SITE}/Thumb.png`;
  const ld = { '@context':'https://schema.org', '@graph':[
    { '@type':'ItemList', '@id':SITE + PATH + '#lo-trinh', name:'Lộ trình trở thành UI/UX Designer và Product Designer', numberOfItems:courses.length,
      itemListElement:courses.map((c, i) => ({ '@type':'ListItem', position:i + 1, item:{ '@type':'Course', name:c.course_title, description:c.description || c.name,
        ...(safeUrl(c.course_url) ? { url:c.course_url } : {}), provider:{ '@type':'Organization', name:'TELOS Academy', sameAs:'https://academy.telos.vn' } } })) },
    { '@type':'BreadcrumbList', itemListElement:[{ '@type':'ListItem', position:1, name:'Thư viện UI/UX', item:SITE + '/' }, { '@type':'ListItem', position:2, name:'Hành trình UI/UX', item:SITE + PATH }] },
  ] };
  // dữ liệu cho game (đọc trong journey/journey.js)
  const boot = { checkpoints:d.checkpoints, settings:{ workplaces:s.workplaces || SEED.workplaces }, combos:SEED.branch_combos, embed };

  const tab = (href, icon, label, active) => `<a class="tab-btn${active ? ' active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}><span class="tb-icon">${icon}</span><span class="tb-label">${label}</span></a>`;
  const shell = embed ? '' : `<div id="tabs">
  <a id="header-logo" href="https://nhanluu.com" target="_blank" rel="noopener" title="nhanluu.com" aria-label="Nhân Lưu">${LOGO}</a>
  <button id="menu-btn" onclick="openNav()" aria-label="Menu" title="Menu"><span class="mdot mdot-l"></span><span class="mdot mdot-c"></span><span class="mdot mdot-r"></span></button>
</div>
<nav id="tab-pill" aria-label="Công cụ trong thư viện">${[tab('/', '🗺', 'Graph view'), tab('/?tab=glossary', '🔤', 'A-Z'), tab('/?tab=flashcard', '🃏', 'Flashcard Quiz'),
    tab('/?tab=challenge', '🎲', 'UI Challenge'), tab('/team-map', '🏢', 'Product Map'), tab(PATH, '🧭', 'Hành trình', true), tab('/?tab=about', 'ℹ️', 'Về dự án')].join('')}</nav>
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
<section id="jx-game" class="jx-game" aria-label="Game hành trình 3D">
  <canvas id="jx-canvas" aria-label="Bản đồ 3D lộ trình học UI/UX" role="img"></canvas>
  <div id="jx-labels" aria-hidden="true"></div>
  <div class="jx-hud" id="jx-hud"></div>
  <div class="jx-top-actions"><button class="jx-chip" id="jx-skip" type="button">Bỏ qua game, đọc lộ trình ↓</button></div>
  <div class="jx-controls"><button id="jx-rotl" aria-label="Xoay trái (Q)" title="Xoay trái (Q)">↺</button><button id="jx-rotr" aria-label="Xoay phải (E)" title="Xoay phải (E)">↻</button><button id="jx-zin" aria-label="Phóng to">+</button><button id="jx-zout" aria-label="Thu nhỏ">−</button></div>
  <p class="jx-hint" id="jx-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> đi · bấm đường để tới · kéo hoặc <kbd>Q</kbd><kbd>E</kbd> để xoay</p>
  <div class="jx-dim" id="jx-dim" hidden></div>
  <div class="jx-flash" id="jx-flash" hidden></div>
  <div class="jx-confetti" id="jx-confetti" aria-hidden="true"></div>
  <div class="jx-banner" id="jx-banner" hidden></div>
  <aside class="jx-sheet" id="jx-sheet" hidden aria-live="polite"></aside>
  <div class="jx-fade" id="jx-fade" hidden></div>
  <div class="jx-loading" id="jx-loading"><span></span>Đang dựng con đường…</div>
</section>

<article class="jx-route" id="jx-route">
  <header class="jx-head">
    <p class="jx-eyebrow">TELOS Academy · Từ Newbie tới Product Designer</p>
    <h1>Lộ trình trở thành UI/UX Designer và Product Designer</h1>
    ${s.intro_text ? `<p class="jx-intro">${esc(s.intro_text)}</p>` : ''}
  </header>
  <div class="jx-line">
${sections}
  </div>
  <aside class="jx-end">
    <h2>Bắt đầu từ trạm nào cũng được</h2>
    <p>Mỗi khoá học có thể học riêng. Xem lịch khai giảng và chọn lớp phù hợp với bạn tại TELOS Academy.</p>
    <div class="jx-end-actions"><a class="gx-btn" href="https://academy.telos.vn/" target="_blank" rel="noopener" data-ga="journey_course_click" data-cp="all">Khám phá khoá học TELOS</a>${embed ? '' : '<a class="gx-btn gx-btn-ghost" href="/team-map">Vào Product Map</a>'}</div>
  </aside>
</article>
</main>
<script type="application/json" id="jx-data">${JSON.stringify(boot).replace(/</g, '\\u003c')}</script>
${embed ? '' : `<script>
function setModeUI(d){document.body.classList.toggle('dark',d);document.documentElement.classList.toggle('jx-dark',d);var i=document.getElementById('nav-mode-icon'),l=document.getElementById('nav-mode-label');if(i){i.textContent=d?'☀️':'🌙';l.textContent=d?'Chế độ sáng':'Chế độ tối';}window.dispatchEvent(new Event('jx-theme'));}
function toggleMode(){var d=!document.body.classList.contains('dark');setModeUI(d);try{localStorage.setItem('telos-theme',d?'dark':'light')}catch(e){}}
function openNav(){document.getElementById('nav-overlay').classList.add('open')}
function closeNav(){document.getElementById('nav-overlay').classList.remove('open')}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeNav()});
setModeUI(document.body.classList.contains('dark'));
</script>`}
<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-ga]');if(!a)return;try{gtag('event',a.getAttribute('data-ga'),{link_url:a.href,cp_id:a.getAttribute('data-cp')||'',click_source:'journey_text'})}catch(_){}});</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" defer></script>
<script src="/supabase.config.js" defer></script>
<script src="/team-map/team-map.mascot.js" defer></script>
<script src="/journey/journey.form.js" defer></script>
<script src="/journey/journey.js" defer></script>
</body>
</html>`;
}

const LOGO = `<svg fill="none" preserveAspectRatio="xMidYMid meet" viewBox="0 0 59.2927 68" style="width:100%;height:100%;"><path d="M6.01217 51.8294C5.42909 51.8294 4.97559 51.4134 4.97559 50.8785V34.5363C4.97559 34.0014 5.42909 33.5855 6.01217 33.5855C6.59525 33.5855 7.04876 34.0014 7.04876 34.5363V50.8191C7.04876 51.4134 6.59525 51.8294 6.01217 51.8294Z" fill="#282935"/><path d="M4.59018 60.2257L0.749669 63.9689C0.0181436 64.7176 0.566789 65.9269 1.60312 65.9269H10.3814C11.4787 65.9269 12.0274 64.66 11.2349 63.9689L7.27244 60.2257C6.54092 59.5346 5.32171 59.5346 4.59018 60.2257Z" fill="#282935"/><path d="M18.2095 2.48779H5.27699C3.47812 2.48779 1.56488 3.00049 0.733673 4.5942C-0.386691 6.74233 -0.247232 9.44754 1.31306 11.4884L42.7211 65.4923C44.8629 68.2938 48.9086 68.8303 51.7048 66.6845C52.5377 66.0288 53.0732 65.0155 53.0732 63.9425V46.9546C53.0732 46.1797 52.8352 45.4644 52.3592 44.8683L20.9462 3.85875C20.2918 3.02426 19.2804 2.48779 18.2095 2.48779Z" fill="#282935"/><path d="M43.0069 14.9041C44.6607 16.3014 46.9256 17 49.8017 17C52.8934 17 55.2302 16.2237 56.8121 14.6712C58.4658 13.1963 59.2927 11.1005 59.2927 8.38357C59.2927 5.58905 58.5018 3.49315 56.9199 2.09589C55.3381 0.698633 53.0732 0 50.1252 0C47.0334 0 44.6607 0.737447 43.0069 2.21233C41.4251 3.76484 40.6342 5.89954 40.6342 8.61644C40.6342 11.411 41.4251 13.5069 43.0069 14.9041Z" fill="#282935"/></svg>`;

module.exports = { load, render, ordered, PATH, _reset:() => { cache = null; } };
