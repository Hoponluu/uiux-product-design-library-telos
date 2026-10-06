// /thuat-ngu[/<slug>] và /en/glossary[/<slug>] (rewrite trong vercel.json) → HTML render phía server.
const G = require('./_lib/glossary');

module.exports = async (req, res) => {
  const q = req.query || {};
  const lang = q.lang === 'en' ? 'en' : 'vi';
  const slug = String(q.slug || '').toLowerCase();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  let d;
  try { d = await G.load(); }
  catch (e) {
    console.error('[term]', e);
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 503;
    return res.end(G.renderMessage(lang, G.S[lang].err, G.S[lang].errText));
  }
  const html = slug ? G.renderTerm(d, lang, slug) : G.renderIndex(d, lang);
  if (!html){
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.statusCode = 404;
    return res.end(G.renderMessage(lang, G.S[lang].nf, G.S[lang].nfText));
  }
  // CDN giữ 10 phút, hết hạn vẫn trả bản cũ trong lúc làm mới → sửa trong CMS hiện ra sau tối đa ~10 phút
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.statusCode = 200;
  res.end(html);
};
