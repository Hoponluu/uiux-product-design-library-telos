// Server local mô phỏng Vercel cho việc test: đọc rewrites trong vercel.json, chạy hàm trong api/, còn lại trả file tĩnh.
//   node tests/local-server.js [port]            (mặc định 8799)
// Mặc định TẮT Supabase (SB_REST trỏ tới cổng chết) → trang thuật ngữ / Hành trình dùng dữ liệu mẫu trong repo.
// Muốn dùng DB local qua PostgREST: SB_REST=http://localhost:3300 SB_KEY=sb_local node tests/local-server.js
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = +process.argv[2] || 8799;
if (!process.env.SB_REST){ process.env.SB_REST = 'http://127.0.0.1:9/rest/v1'; process.env.SB_KEY = 'sb_test'; }
const REWRITES = (JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).rewrites || []).map(r => {
  const names = []; const re = new RegExp('^' + r.source.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '/?$');
  return { re, names, dest:r.destination };
});
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png',
  '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.xml':'application/xml', '.woff2':'font/woff2' };
function rewrite(p){
  for (const r of REWRITES){ const m = p.match(r.re); if (!m) continue; let d = r.dest; r.names.forEach((n, i) => { d = d.split(':' + n).join(encodeURIComponent(decodeURIComponent(m[i + 1]))); }); return d; }
  return null;
}
http.createServer(async (req, res) => {
  try {
    let u = new URL(req.url, 'http://local'); const to = rewrite(u.pathname);
    if (to){ const t = new URL(to, 'http://local'); u.searchParams.forEach((v, k) => { if (!t.searchParams.has(k)) t.searchParams.set(k, v); }); u = t; }
    if (u.pathname.startsWith('/api/')){
      const f = path.join(ROOT, u.pathname.replace(/\/$/, '') + '.js'); if (!fs.existsSync(f)){ res.statusCode = 404; return res.end('no api'); }
      req.query = Object.fromEntries(u.searchParams);
      res.status = c => { res.statusCode = c; return res; }; res.send = b => res.end(b); res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      return await require(f)(req, res);
    }
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); res.statusCode = 500; res.end(String(e)); }
}).listen(PORT, () => console.log(`local-server: http://localhost:${PORT} (Supabase: ${process.env.SB_REST})`));
