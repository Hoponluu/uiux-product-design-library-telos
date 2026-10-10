// Nút "⋯" của menu chính: mở / đóng danh sách công cụ phụ (Flashcard Quiz, UI Challenge, Về dự án). Xem nav/site-nav.css.
(function(){
  const btn = document.querySelector('#tab-pill .tab-more-btn'), menu = document.getElementById('tab-more-menu');
  if (!btn || !menu) return;
  const items = () => [...menu.querySelectorAll('.tm-item')];
  function open(v, focus){
    menu.hidden = !v; btn.setAttribute('aria-expanded', String(v)); btn.classList.toggle('open', v);
    if (v && focus && items()[0]) items()[0].focus({ preventScroll:true });
  }
  btn.addEventListener('click', e => { e.stopPropagation(); open(menu.hidden, e.detail === 0); });   // mở bằng bàn phím thì đưa focus vào mục đầu
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('.tab-more')) open(false); });
  menu.addEventListener('click', e => { if (e.target.closest('.tm-item')) open(false); });
  document.addEventListener('keydown', e => {
    if (menu.hidden) return;
    if (e.key === 'Escape'){ e.stopPropagation(); open(false); btn.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      const it = items(); let i = it.indexOf(document.activeElement);
      i = e.key === 'ArrowDown' ? (i + 1) % it.length : (i - 1 + it.length) % it.length;
      it[i].focus(); e.preventDefault();
    }
  }, true);
  window.closeTabMore = () => open(false);
})();
