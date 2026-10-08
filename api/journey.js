// /hanh-trinh-ui-ux (rewrite trong vercel.json) → HTML render phía server. ?embed=1: bản nhúng iframe (ẩn header thư viện).
const J = require('./_lib/journey');

module.exports = async (req, res) => {
  const q = req.query || {};
  const d = await J.load();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // CDN giữ 2 phút (dữ liệu từ seed khi Supabase lỗi thì chỉ 30 giây), hết hạn vẫn trả bản cũ trong lúc làm mới
  res.setHeader('Cache-Control', d.source === 'db' ? 'public, s-maxage=120, stale-while-revalidate=86400' : 'public, s-maxage=30');
  res.statusCode = 200;
  res.end(J.render(d, { embed:q.embed === '1' }));
};
