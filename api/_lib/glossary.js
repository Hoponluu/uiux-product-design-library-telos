// Trang thuật ngữ render phía server (Vercel Function).
//   /thuat-ngu            → mục lục A–Z (vi)      /en/glossary        → mục lục (en)
//   /thuat-ngu/<slug>     → trang thuật ngữ (vi)  /en/glossary/<slug> → trang thuật ngữ (en)
//   /sitemap.xml          → sitemap gồm mọi trang thuật ngữ
// Dữ liệu đọc thẳng từ Supabase (key công khai, chỉ đọc) nên sửa trong CMS là trang tự cập nhật
// sau tối đa ~10 phút (cache CDN). Vai trò lấy thêm nội dung từ modal nhân vật của Product Map.

const SITE = 'https://uiux-library.nhanluu.com';
const REST = process.env.SB_REST || 'https://vvpqhsglgtfwjklvlvuh.supabase.co/rest/v1';
const KEY = process.env.SB_KEY || 'sb_publishable_slwezFWl9SM0ngQiVdIZuQ_XvVkhmCU';
const COURSE_URL = 'https://academy.telos.vn/';
const TTL = 5 * 60 * 1000;

// ---------- dữ liệu ----------
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
  const [cats, cons, chars] = await Promise.all([
    get('categories?select=*&order=sort_order'),
    get('concepts?select=*&is_published=eq.true&order=name'),
    get('tm_characters?select=id,title,kind,group,summary,doing,with_designer,reports_to,term_id,i18n,related_term_ids,is_active&is_active=eq.true').catch(() => []),
  ]);
  const catById = Object.fromEntries(cats.map(c => [c.id, c]));
  const rootOf = c => { let x = c, g = 0; while (x && x.parent_id && catById[x.parent_id] && g++ < 5) x = catById[x.parent_id]; return x; };
  const terms = cons.filter(t => t.slug && t.name && /^[a-z0-9][a-z0-9-]*$/.test(t.slug) && catById[t.category_id]);
  const byId = Object.fromEntries(terms.map(t => [t.id, t]));
  const bySlug = Object.fromEntries(terms.map(t => [t.slug, t]));
  const charById = Object.fromEntries(chars.map(c => [c.id, c]));
  const charByTerm = {};
  chars.forEach(c => { if (c.term_id && (c.kind === 'role' || c.kind === 'player') && !charByTerm[c.term_id]) charByTerm[c.term_id] = c; });
  const data = { cats, catById, rootOf, terms, byId, bySlug, chars, charById, charByTerm };
  cache = { at:Date.now(), data };
  return data;
}

// ---------- tiện ích ----------
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const base = lang => lang === 'en' ? '/en/glossary' : '/thuat-ngu';
const termUrl = (lang, slug) => `${base(lang)}/${slug}`;
const nameOf = (t, lang) => (lang === 'en' && t.name_en) || t.name;
const descOf = (t, lang) => (lang === 'en' && t.description_en) || t.description || '';
const catName = (c, lang) => c ? ((lang === 'en' && c.name_en) || c.name) : '';
const chr = (c, f, lang) => (lang === 'en' && c.i18n && c.i18n.en && c.i18n.en[f]) || c[f] || '';
const COLORS = { 'tieu-chi':{ bg:'#FEE3EC', fg:'#C4245E', dot:'#EF4A81' }, 'cong-cu':{ bg:'#E0F3FB', fg:'#1A6E9E', dot:'#40B0E0' },
  'khai-niem':{ bg:'#FFF8E0', fg:'#8A6800', dot:'#FFC845' }, 'vai-tro':{ bg:'#EDE8FA', fg:'#3D2080', dot:'#7B56BF' } };
const colorOf = root => COLORS[root && root.slug] || { bg:'#EEE', fg:'#444', dot:'#999' };
const sortByName = lang => (a, b) => nameOf(a, lang).localeCompare(nameOf(b, lang), lang === 'en' ? 'en' : 'vi');
const isRole = (d, t) => { const r = d.rootOf(d.catById[t.category_id]); return !!r && r.slug === 'vai-tro'; };
const article = n => /^[AEIO]/i.test(n) ? 'an' : 'a';

const S = {
  vi:{ lib:'Thư viện thuật ngữ UI/UX', libShort:'Thư viện thuật ngữ', whatIs:n => `${n} là gì?`, whoIs:n => `${n} là ai?`,
    titleSuffix:'Thư viện thuật ngữ UI/UX', read:'Đọc bài viết đầy đủ', soon:'Sắp có bài viết', graph:'Xem trên đồ thị 3D',
    inMap:'Trong Product Map', doing:'Đang làm', withYou:'Làm việc với UI/UX Designer thế nào', reportsTo:'Báo cáo cho', reports:'Báo cáo cho họ',
    meet:n => `Gặp ${n} trong Product Map`, play:n => `Vào vai ${n} trong Product Map`, playerNote:'Đây là vai bạn đóng trong Product Map: đi một vòng văn phòng, gặp từng phòng ban để hiểu họ làm gì và làm việc với bạn ra sao.',
    related:'Thuật ngữ liên quan', usedBy:n => `Vai trò hay dùng ${n}`, same:c => `Cùng nhóm ${c}`, prev:'Trước', next:'Tiếp theo', all:'Tất cả thuật ngữ A–Z',
    ctaTitle:'Học UI/UX bài bản cùng TELOS Academy', ctaText:'Hiểu thuật ngữ là bước đầu. Áp dụng được vào dự án thật mới là kỹ năng.', ctaBtn:'Khám phá khoá học TELOS',
    back:'Về thư viện thuật ngữ', other:'English', idxTitle:'Thư viện thuật ngữ UI/UX từ A đến Z',
    idxLead:n => `${n} thuật ngữ UI/UX Product Design giải thích bằng tiếng Việt: công cụ UX, khái niệm, tiêu chí sản phẩm và các vai trò trong team Product.`,
    idxMeta:n => `Tra cứu ${n} thuật ngữ UI/UX Product Design bằng tiếng Việt: định nghĩa ngắn gọn, vai trò trong team Product và bài viết chi tiết.`,
    idxGraph:'Xem dạng đồ thị 3D', nf:'Không tìm thấy thuật ngữ', nfText:'Thuật ngữ này không tồn tại hoặc đã được ẩn.',
    err:'Chưa tải được dữ liệu', errText:'Vui lòng thử lại sau ít phút.', tabs:'Công cụ trong thư viện', menu:'Đóng menu', dark:'Chế độ tối', light:'Chế độ sáng', home:'Thư viện' },
  en:{ lib:'UI/UX Glossary', libShort:'Glossary', whatIs:n => `What is ${n}?`, whoIs:n => `What is ${article(n)} ${n}?`,
    titleSuffix:'UI/UX Glossary', read:'Read the full article (Vietnamese)', soon:'Article coming soon', graph:'See it on the 3D graph',
    inMap:'In the Product Map', doing:'Doing now', withYou:'How they work with a UI/UX Designer', reportsTo:'Reports to', reports:'Reports to them',
    meet:n => `Meet the ${n} in the Product Map`, play:n => `Play as the ${n} in the Product Map`, playerNote:'This is the role you play in the Product Map: walk around the office and meet every department to learn what they do and how they work with you.',
    related:'Related terms', usedBy:n => `Roles that use ${n}`, same:c => `More in ${c}`, prev:'Previous', next:'Next', all:'All terms A–Z',
    ctaTitle:'Learn UI/UX the structured way with TELOS Academy', ctaText:'Knowing the terms is step one. Using them on real projects is the skill. (Courses are in Vietnamese.)', ctaBtn:'Explore TELOS courses',
    back:'Back to the glossary', other:'Tiếng Việt', idxTitle:'UI/UX Glossary from A to Z',
    idxLead:n => `${n} UI/UX and Product Design terms explained in plain English: UX tools, concepts, product criteria and the roles in a Product team.`,
    idxMeta:n => `Look up ${n} UI/UX and Product Design terms: short definitions, the roles in a Product team and links to in-depth articles.`,
    idxGraph:'See the 3D graph (Vietnamese)', nf:'Term not found', nfText:'This term does not exist or has been hidden.',
    err:'Could not load the data', errText:'Please try again in a few minutes.', tabs:'Library tools', menu:'Close menu', dark:'Dark mode', light:'Light mode', home:'Glossary' },
};

// ---------- khung trang (header dùng chung với trang chủ / Product Map) ----------
const LOGO = `<svg fill="none" preserveAspectRatio="xMidYMid meet" viewBox="0 0 59.2927 68" style="width:100%;height:100%;"><path d="M6.01217 51.8294C5.42909 51.8294 4.97559 51.4134 4.97559 50.8785V34.5363C4.97559 34.0014 5.42909 33.5855 6.01217 33.5855C6.59525 33.5855 7.04876 34.0014 7.04876 34.5363V50.8191C7.04876 51.4134 6.59525 51.8294 6.01217 51.8294Z" fill="#282935"/><path d="M4.59018 60.2257L0.749669 63.9689C0.0181436 64.7176 0.566789 65.9269 1.60312 65.9269H10.3814C11.4787 65.9269 12.0274 64.66 11.2349 63.9689L7.27244 60.2257C6.54092 59.5346 5.32171 59.5346 4.59018 60.2257Z" fill="#282935"/><path d="M18.2095 2.48779H5.27699C3.47812 2.48779 1.56488 3.00049 0.733673 4.5942C-0.386691 6.74233 -0.247232 9.44754 1.31306 11.4884L42.7211 65.4923C44.8629 68.2938 48.9086 68.8303 51.7048 66.6845C52.5377 66.0288 53.0732 65.0155 53.0732 63.9425V46.9546C53.0732 46.1797 52.8352 45.4644 52.3592 44.8683L20.9462 3.85875C20.2918 3.02426 19.2804 2.48779 18.2095 2.48779Z" fill="#282935"/><path d="M43.0069 14.9041C44.6607 16.3014 46.9256 17 49.8017 17C52.8934 17 55.2302 16.2237 56.8121 14.6712C58.4658 13.1963 59.2927 11.1005 59.2927 8.38357C59.2927 5.58905 58.5018 3.49315 56.9199 2.09589C55.3381 0.698633 53.0732 0 50.1252 0C47.0334 0 44.6607 0.737447 43.0069 2.21233C41.4251 3.76484 40.6342 5.89954 40.6342 8.61644C40.6342 11.411 41.4251 13.5069 43.0069 14.9041Z" fill="#282935"/></svg>`;

function tabs(lang){
  const t = (href, icon, label, active) => `<a class="tab-btn${active ? ' active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}><span class="tb-icon">${icon}</span><span class="tb-label">${label}</span></a>`;
  if (lang === 'en') return [t('/', '🗺', 'Graph view'), t('/en/glossary', '🔤', 'A-Z', true), t('/en/team-map', '🏢', 'Product Map')].join('');
  return [t('/', '🗺', 'Graph view'), t('/?tab=glossary', '🔤', 'A-Z', true), t('/?tab=flashcard', '🃏', 'Flashcard Quiz'),
    t('/?tab=challenge', '🎲', 'UI Challenge'), t('/team-map', '🏢', 'Product Map'), t('/hanh-trinh-ui-ux', '🧭', 'Hành trang học tập'), t('/?tab=about', 'ℹ️', 'Về dự án')].join('');
}

function page({ lang, title, desc, path, alt, body, ld, noindex, ogType, term }){
  const s = S[lang], url = SITE + path;
  const alts = alt ? `<link rel="alternate" hreflang="vi" href="${SITE + alt.vi}">\n<link rel="alternate" hreflang="en" href="${SITE + alt.en}">\n<link rel="alternate" hreflang="x-default" href="${SITE + alt.vi}">` : '';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="author" content="Nhân Lưu — TELOS Academy">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
${noindex ? '' : `<link rel="canonical" href="${url}">\n${alts}`}
<link rel="icon" type="image/png" href="/Fav.png">
<link rel="apple-touch-icon" href="/Fav.png">
<meta property="og:type" content="${ogType || 'article'}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/Thumb.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'vi_VN'}">
<meta property="og:site_name" content="TELOS Academy">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/Thumb.png">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PFSCQRQZM6"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-PFSCQRQZM6');</script>
<link rel="stylesheet" href="/glossary/glossary.css">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body${term ? ` data-term="${esc(term)}"` : ''}>
<script>try{if(localStorage.getItem('telos-theme')==='dark')document.body.classList.add('dark')}catch(e){}</script>
<div id="tabs">
  <a id="header-logo" href="https://nhanluu.com" target="_blank" rel="noopener" title="nhanluu.com" aria-label="Nhân Lưu">${LOGO}</a>
  <button id="menu-btn" onclick="openNav()" aria-label="Menu" title="Menu"><span class="mdot mdot-l"></span><span class="mdot mdot-c"></span><span class="mdot mdot-r"></span></button>
</div>
<nav id="tab-pill" aria-label="${s.tabs}">${tabs(lang)}</nav>
<div id="nav-overlay" role="dialog" aria-modal="true" aria-label="Navigation">
  <div id="nav-backdrop" onclick="closeNav()"></div>
  <nav id="nav-panel">
    <button id="nav-close" onclick="closeNav()" aria-label="${s.menu}"><span class="nav-x-line"></span><span class="nav-x-line"></span></button>
    <div class="nav-divider"></div>
    <a class="nav-link" href="https://nhanluu.com/about-me/" target="_blank" rel="noopener">ABOUT ME</a>
    <a class="nav-link" href="https://nhanluu.com/portfolio/" target="_blank" rel="noopener">PORTFOLIO</a>
    <a class="nav-link" href="https://nhanluu.com/blog/" target="_blank" rel="noopener">BLOG</a>
    <a class="nav-link" href="https://nhanluu.com/contact/" target="_blank" rel="noopener">CONTACT</a>
    <button class="nav-dark-toggle" onclick="toggleMode()"><span class="nav-dark-icon" id="nav-mode-icon">🌙</span><span id="nav-mode-label">${s.dark}</span></button>
  </nav>
</div>
<main id="gx">
${body}
</main>
<script>
function setModeUI(d){document.body.classList.toggle('dark',d);document.getElementById('nav-mode-icon').textContent=d?'☀️':'🌙';document.getElementById('nav-mode-label').textContent=d?${JSON.stringify(s.light)}:${JSON.stringify(s.dark)};}
function toggleMode(){var d=!document.body.classList.contains('dark');setModeUI(d);try{localStorage.setItem('telos-theme',d?'dark':'light')}catch(e){}}
function openNav(){document.getElementById('nav-overlay').classList.add('open')}
function closeNav(){document.getElementById('nav-overlay').classList.remove('open')}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeNav()});
setModeUI(document.body.classList.contains('dark'));
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-ga]');if(!a)return;try{gtag('event',a.getAttribute('data-ga'),{link_url:a.href,link_text:a.textContent.trim().slice(0,80),click_source:'term_page',term_slug:document.body.getAttribute('data-term')||''})}catch(_){}});
</script>
</body>
</html>`;
}

const chip = (lang, d, t) => { const c = colorOf(d.rootOf(d.catById[t.category_id])); return `<a class="gx-chip" href="${termUrl(lang, t.slug)}"><i style="background:${c.dot}"></i>${esc(nameOf(t, lang))}</a>`; };
const chipList = (lang, d, list) => list.length ? `<div class="gx-chips">${list.map(t => chip(lang, d, t)).join('')}</div>` : '';

// ---------- trang thuật ngữ ----------
function renderTerm(d, lang, slug){
  const s = S[lang], t = d.bySlug[slug];
  if (!t) return null;
  const cat = d.catById[t.category_id], root = d.rootOf(cat), col = colorOf(root), role = isRole(d, t);
  const name = nameOf(t, lang), desc = descOf(t, lang), h1 = role ? s.whoIs(name) : s.whatIs(name);
  const catLabel = root && root !== cat ? `${catName(root, lang)} · ${catName(cat, lang)}` : catName(cat, lang);
  const ch = d.charByTerm[t.id];
  const shown = new Set([t.id]);

  // Product Map: nội dung modal nhân vật
  let mapSec = '';
  if (ch && ch.kind === 'role'){
    const boss = ch.reports_to && d.charById[ch.reports_to];
    const bossTerm = boss && boss.term_id && d.byId[boss.term_id];
    const reports = d.chars.filter(x => x.kind === 'role' && x.reports_to === ch.id).sort((a, b) => a.title.localeCompare(b.title));
    const who = x => { const tt = x.term_id && d.byId[x.term_id]; return tt ? `<a href="${termUrl(lang, tt.slug)}">${esc(nameOf(tt, lang))}</a>` : esc(x.title); };
    const summary = chr(ch, 'summary', lang);
    mapSec = `<section class="gx-card gx-map">
      <h2>${s.inMap}</h2>
      ${summary && summary !== desc ? `<p>${esc(summary)}</p>` : ''}
      <dl>
        ${chr(ch, 'doing', lang) ? `<div><dt>${s.doing}</dt><dd>${esc(chr(ch, 'doing', lang))}</dd></div>` : ''}
        ${chr(ch, 'with_designer', lang) ? `<div><dt>${s.withYou}</dt><dd>${esc(chr(ch, 'with_designer', lang))}</dd></div>` : ''}
        ${boss ? `<div><dt>${s.reportsTo}</dt><dd>${bossTerm ? `<a href="${termUrl(lang, bossTerm.slug)}">${esc(nameOf(bossTerm, lang))}</a>` : esc(boss.title)}</dd></div>` : ''}
        ${reports.length ? `<div><dt>${s.reports}</dt><dd>${reports.map(who).join(', ')}</dd></div>` : ''}
      </dl>
      <a class="gx-btn gx-btn-ghost" href="${lang === 'en' ? '/en/team-map' : '/team-map'}" data-ga="term_map_click">${esc(s.meet(name))} →</a>
    </section>`;
    if (bossTerm) shown.add(bossTerm.id);
  } else if (ch && ch.kind === 'player'){
    mapSec = `<section class="gx-card gx-map"><h2>${s.inMap}</h2><p>${s.playerNote}</p>
      <a class="gx-btn gx-btn-ghost" href="${lang === 'en' ? '/en/team-map' : '/team-map'}" data-ga="term_map_click">${esc(s.play(name))} →</a></section>`;
  }

  // Liên quan: từ nhân vật (vai trò) hoặc các vai trò hay dùng thuật ngữ này
  const take = list => list.filter(x => x && !shown.has(x.id) && shown.add(x.id));
  const related = ch ? take((ch.related_term_ids || []).map(id => d.byId[id])) : [];
  const usedBy = role ? [] : take(d.chars.filter(x => x.kind === 'role' && x.term_id && (x.related_term_ids || []).includes(t.id)).map(x => d.byId[x.term_id])).sort(sortByName(lang)).slice(0, 12);
  const same = take(d.terms.filter(x => x.category_id === t.category_id)).sort(sortByName(lang)).slice(0, 12);

  const sorted = d.terms.slice().sort(sortByName(lang)), i = sorted.indexOf(t);
  const prev = sorted[(i - 1 + sorted.length) % sorted.length], next = sorted[(i + 1) % sorted.length];

  const body = `<div class="gx-wrap">
  <div class="gx-top">
    <nav class="gx-crumbs" aria-label="Breadcrumb"><a href="${base(lang)}">${s.libShort}</a><span>›</span><span>${esc(catLabel)}</span><span>›</span><span aria-current="page">${esc(name)}</span></nav>
    <a class="gx-lang" href="${termUrl(lang === 'en' ? 'vi' : 'en', t.slug)}" hreflang="${lang === 'en' ? 'vi' : 'en'}">${s.other}</a>
  </div>
  <article class="gx-term">
    <p class="gx-badge" style="background:${col.bg};color:${col.fg}">${esc(catLabel)}</p>
    <h1>${esc(h1)}</h1>
    ${desc ? `<p class="gx-lead">${esc(desc)}</p>` : ''}
    <div class="gx-actions">
      ${t.url ? `<a class="gx-btn" href="${esc(t.url)}" target="_blank" rel="noopener" data-ga="article_click">${s.read} ↗</a>` : `<span class="gx-btn is-disabled" aria-disabled="true">${s.soon}</span>`}
      <a class="gx-btn gx-btn-ghost" href="/?term=${esc(t.slug)}" data-ga="term_graph_click">${s.graph}</a>
    </div>
    ${mapSec}
    ${related.length ? `<section class="gx-sec"><h2>${s.related}</h2>${chipList(lang, d, related)}</section>` : ''}
    ${usedBy.length ? `<section class="gx-sec"><h2>${esc(s.usedBy(name))}</h2>${chipList(lang, d, usedBy)}</section>` : ''}
    ${same.length ? `<section class="gx-sec"><h2>${esc(s.same(catName(cat, lang)))}</h2>${chipList(lang, d, same)}</section>` : ''}
    <nav class="gx-pn" aria-label="A–Z">
      <a href="${termUrl(lang, prev.slug)}" rel="prev"><small>← ${s.prev}</small>${esc(nameOf(prev, lang))}</a>
      <a class="gx-pn-all" href="${base(lang)}">${s.all}</a>
      <a href="${termUrl(lang, next.slug)}" rel="next"><small>${s.next} →</small>${esc(nameOf(next, lang))}</a>
    </nav>
    <aside class="gx-cta">
      <div><h2>${s.ctaTitle}</h2><p>${s.ctaText}</p></div>
      <a class="gx-btn" href="${COURSE_URL}" target="_blank" rel="noopener" data-ga="course_click">${s.ctaBtn}</a>
    </aside>
  </article>
  <p class="gx-back"><a href="${base(lang)}">← ${s.back}</a></p>
</div>`;

  const path = termUrl(lang, t.slug);
  const crumbs = [{ n:s.lib, u:base(lang) }, { n:name, u:path }];
  const ld = { '@context':'https://schema.org', '@graph':[
    { '@type':'DefinedTerm', '@id':SITE + path + '#term', name, description:desc, termCode:t.slug, inLanguage:lang, url:SITE + path,
      inDefinedTermSet:{ '@type':'DefinedTermSet', '@id':`${SITE}/#glossary`, name:s.lib, url:SITE + base(lang) },
      ...(t.url ? { subjectOf:{ '@type':'Article', url:t.url, inLanguage:'vi', publisher:{ '@type':'Organization', name:'TELOS Academy', url:COURSE_URL } } } : {}) },
    { '@type':'BreadcrumbList', itemListElement:crumbs.map((c, k) => ({ '@type':'ListItem', position:k + 1, name:c.n, item:SITE + c.u })) },
  ] };
  return page({ lang, title:`${h1} | ${s.titleSuffix}`, desc:clip(desc || h1, 158), path, alt:{ vi:termUrl('vi', t.slug), en:termUrl('en', t.slug) }, body, ld, term:t.slug });
}

// ---------- mục lục A–Z ----------
function renderIndex(d, lang){
  const s = S[lang];
  const roots = d.cats.filter(c => !c.parent_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const card = t => `<a class="gx-item" href="${termUrl(lang, t.slug)}"><b>${esc(nameOf(t, lang))}</b><span>${esc(clip(descOf(t, lang), 120))}</span>${t.url ? '' : `<em>${s.soon}</em>`}</a>`;
  const sections = roots.map(r => {
    const col = colorOf(r);
    const subs = d.cats.filter(c => c.parent_id === r.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const own = d.terms.filter(t => t.category_id === r.id).sort(sortByName(lang));
    const blocks = (own.length ? [`<div class="gx-grid">${own.map(card).join('')}</div>`] : [])
      .concat(subs.map(sc => { const l = d.terms.filter(t => t.category_id === sc.id).sort(sortByName(lang)); return l.length ? `<h3>${esc(catName(sc, lang))}</h3><div class="gx-grid">${l.map(card).join('')}</div>` : ''; }));
    const n = own.length + subs.reduce((k, sc) => k + d.terms.filter(t => t.category_id === sc.id).length, 0);
    return n ? `<section class="gx-group" id="${esc(r.slug)}"><h2><i style="background:${col.dot}"></i>${esc(catName(r, lang))} <small>${n}</small></h2>${blocks.join('')}</section>` : '';
  }).join('');
  const n = d.terms.length, path = base(lang);
  const body = `<div class="gx-wrap gx-wide">
  <div class="gx-top"><nav class="gx-crumbs" aria-label="Breadcrumb"><a href="/">${s.home}</a><span>›</span><span aria-current="page">A–Z</span></nav>
    <a class="gx-lang" href="${base(lang === 'en' ? 'vi' : 'en')}" hreflang="${lang === 'en' ? 'vi' : 'en'}">${s.other}</a></div>
  <header class="gx-idx-head"><h1>${s.idxTitle}</h1><p class="gx-lead">${esc(s.idxLead(n))}</p>
    <div class="gx-actions"><a class="gx-btn gx-btn-ghost" href="/">${s.idxGraph}</a></div>
    <nav class="gx-jump">${roots.map(r => `<a href="#${esc(r.slug)}">${esc(catName(r, lang))}</a>`).join('')}</nav></header>
  ${sections}
</div>`;
  const ld = { '@context':'https://schema.org', '@type':'DefinedTermSet', '@id':`${SITE}/#glossary`, name:s.lib, inLanguage:lang, url:SITE + path,
    hasDefinedTerm:d.terms.slice().sort(sortByName(lang)).map(t => ({ '@type':'DefinedTerm', name:nameOf(t, lang), url:SITE + termUrl(lang, t.slug) })) };
  return page({ lang, title:`${s.idxTitle} | ${lang === 'en' ? 'TELOS Academy' : 'by Nhân Lưu'}`, desc:s.idxMeta(n), path, alt:{ vi:base('vi'), en:base('en') }, body, ld, ogType:'website' });
}

function renderMessage(lang, h, p){
  const s = S[lang];
  return page({ lang, title:`${h} | ${s.titleSuffix}`, desc:p, path:base(lang), noindex:true,
    body:`<div class="gx-wrap"><article class="gx-term gx-msg"><h1>${esc(h)}</h1><p class="gx-lead">${esc(p)}</p>
      <div class="gx-actions"><a class="gx-btn" href="${base(lang)}">${s.all}</a><a class="gx-btn gx-btn-ghost" href="/">${s.idxGraph}</a></div></article></div>` });
}

// ---------- sitemap ----------
const STATIC = [
  { loc:'/', pr:'1.0', alt:null },
  { loc:'/team-map', pr:'0.8', alt:{ vi:'/team-map', en:'/en/team-map' } },
  { loc:'/en/team-map', pr:'0.7', alt:{ vi:'/team-map', en:'/en/team-map' } },
  { loc:'/hanh-trinh-ui-ux', pr:'0.9', alt:null },
  { loc:'/thuat-ngu', pr:'0.9', alt:{ vi:'/thuat-ngu', en:'/en/glossary' } },
  { loc:'/en/glossary', pr:'0.8', alt:{ vi:'/thuat-ngu', en:'/en/glossary' } },
];
function renderSitemap(d){
  const urls = STATIC.slice();
  if (d) d.terms.slice().sort((a, b) => a.slug.localeCompare(b.slug)).forEach(t => {
    const alt = { vi:termUrl('vi', t.slug), en:termUrl('en', t.slug) };
    urls.push({ loc:alt.vi, pr:'0.7', alt }, { loc:alt.en, pr:'0.6', alt });
  });
  const x = u => `  <url>\n    <loc>${SITE + u.loc}</loc>\n${u.alt ? `    <xhtml:link rel="alternate" hreflang="vi" href="${SITE + u.alt.vi}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${SITE + u.alt.en}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE + u.alt.vi}"/>\n` : ''}    <priority>${u.pr}</priority>\n  </url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.map(x).join('\n')}\n</urlset>\n`;
}

module.exports = { load, renderTerm, renderIndex, renderMessage, renderSitemap, S, _reset:() => { cache = null; } };
