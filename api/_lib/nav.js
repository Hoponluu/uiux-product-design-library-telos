// Menu chính dùng chung cho mọi trang: 4 mục lớn + nút "⋯" gom các công cụ còn lại.
// Trang chủ (TELOS_Knowledge_Graph.html), Product Map (team-map.html, en/team-map.html) dán sẵn markup sinh từ đây
// (scripts/build_site_nav.js); trang thuật ngữ và Hành trình gọi tabPill() lúc render. Kiểu dáng: nav/site-nav.css, hành vi: nav/site-nav.js.

// [key, href, icon, nhãn desktop, nhãn mobile, mô tả (tooltip)]
const NAV = {
  vi: {
    aria:'Công cụ trong thư viện', more:'Thêm', moreTitle:'Thêm công cụ: Flashcard Quiz, UI Challenge, Về dự án',
    main:[
      ['graph', '/', '🗺', 'Graph', 'Graph', 'Các thuật ngữ UI/UX nối với nhau thế nào'],
      ['glossary', '/?tab=glossary', '🔤', 'Từ điển A–Z', 'Từ điển', 'Tra nghĩa từng thuật ngữ'],
      ['map', '/team-map', '🏢', 'Product Map', 'Map', 'Ai làm gì trong một team sản phẩm'],
      ['journey', '/hanh-trinh-ui-ux', '🧭', 'Hành trình', 'Hành trình', 'Lộ trình học từ Newbie tới Product Designer'],
    ],
    extra:[
      ['flashcard', '/?tab=flashcard', '🃏', 'Flashcard Quiz', 'Ôn thuật ngữ bằng thẻ lật'],
      ['challenge', '/?tab=challenge', '🎲', 'UI Challenge', 'Bốc đề thiết kế ngẫu nhiên để luyện tay'],
      ['about', '/?tab=about', 'ℹ️', 'Về dự án', 'Thư viện này là gì, ai làm'],
    ],
  },
  en: {
    aria:'Library tools', more:'More', moreTitle:'More tools: Flashcard Quiz, UI Challenge, About',
    main:[
      ['graph', '/', '🗺', 'Graph', 'Graph', 'How UI/UX terms connect (Vietnamese)'],
      ['glossary', '/en/glossary', '🔤', 'Glossary A–Z', 'Glossary', 'Look up any term'],
      ['map', '/en/team-map', '🏢', 'Product Map', 'Map', 'Who does what in a product team'],
      ['journey', '/hanh-trinh-ui-ux', '🧭', 'Learning path', 'Path', 'From newbie to Product Designer (Vietnamese)'],
    ],
    extra:[
      ['flashcard', '/?tab=flashcard', '🃏', 'Flashcard Quiz', 'Flip cards to review terms (Vietnamese)'],
      ['challenge', '/?tab=challenge', '🎲', 'UI Challenge', 'Random design briefs to practise (Vietnamese)'],
      ['about', '/?tab=about', 'ℹ️', 'About', 'What this library is and who made it (Vietnamese)'],
    ],
  },
};
const IN_PAGE = ['graph', 'glossary', 'flashcard', 'challenge', 'about'];   // trên trang chủ: đổi tab tại chỗ (switchTab), không tải lại trang

// lang: 'vi' | 'en'; active: key của trang hiện tại; home: true khi là trang chủ
function tabPill(lang = 'vi', active = '', home = false){
  const L = NAV[lang] || NAV.vi, vi = lang !== 'en';
  const attrs = (key, href, extra) => home && vi && IN_PAGE.includes(key)
    ? { tag:'button', a:`type="button" data-tab="${key}" onclick="switchTab('${key}',this)"${extra}` }
    : { tag:'a', a:`href="${href}" data-tab="${key}"${!vi && href.startsWith('/hanh-trinh') ? ' hreflang="vi"' : ''}${extra}` };
  const main = L.main.map(([key, href, icon, label, short, desc]) => {
    const on = key === active, t = attrs(key, href, ` title="${desc}"${on && t0(home, key) ? ' aria-current="page"' : ''}`);
    return `  <${t.tag} class="tab-btn${on ? ' active' : ''}" ${t.a}>
    <span class="tb-icon">${icon}</span><span class="tb-label">${label}</span><span class="tb-short" aria-hidden="true">${short}</span>
  </${t.tag}>`;
  }).join('\n');
  const moreOn = L.extra.some(x => x[0] === active);
  const extra = L.extra.map(([key, href, icon, label, desc]) => {
    const t = attrs(key, href, ''), on = key === active;
    return `      <${t.tag} class="tm-item${on ? ' active' : ''}" ${t.a}><span class="tm-ic" aria-hidden="true">${icon}</span><span class="tm-tx"><b>${label}</b><small>${desc}</small></span></${t.tag}>`;
  }).join('\n');
  return `<nav id="tab-pill" aria-label="${L.aria}">
${main}
  <div class="tab-more">
    <button type="button" class="tab-btn tab-more-btn${moreOn ? ' active' : ''}" aria-haspopup="true" aria-expanded="false" aria-controls="tab-more-menu" title="${L.moreTitle}">
      <span class="tb-icon" aria-hidden="true">⋯</span><span class="tb-label">${L.more}</span><span class="tb-short" aria-hidden="true">${L.more}</span>
    </button>
    <div class="tab-more-menu" id="tab-more-menu" hidden>
${extra}
    </div>
  </div>
</nav>`;
}
// aria-current chỉ cho link sang trang khác (nút đổi tab tại chỗ dùng class active)
const t0 = (home, key) => !(home && IN_PAGE.includes(key));

module.exports = { tabPill, NAV };
