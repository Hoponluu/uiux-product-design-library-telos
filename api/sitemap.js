// /sitemap.xml (rewrite trong vercel.json): trang tĩnh + mọi trang thuật ngữ vi/en.
const G = require('./_lib/glossary');

module.exports = async (req, res) => {
  let d = null;
  try { d = await G.load(); } catch (e) { console.error('[sitemap]', e); }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', d ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'public, s-maxage=60');
  res.statusCode = 200;
  res.end(G.renderSitemap(d));
};
