// Cấu hình Supabase dùng chung cho mọi trang (trang chủ, /team-map, /adminCMS).
// CHỈ chứa key công khai. Tuyệt đối không đặt secret key / service_role key ở đây.
window.SB_CONFIG = {
  url: 'https://vvpqhsglgtfwjklvlvuh.supabase.co',
  // Publishable key: Supabase → Settings → API Keys (dạng sb_publishable_...).
  // Tạm thời vẫn là anon key cũ; dán publishable key vào đây rồi mới tắt legacy API keys.
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cHFoc2dsZ3Rmd2prbHZsdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjkyMDQsImV4cCI6MjA5NzYwNTIwNH0.tpa9hfNxcdN_Fu67NLSdMGUbUUrvCGX9v4jDqqyC4JA',
};

// Header cho request tới Supabase.
// - Key mới (sb_publishable_...) không phải JWT: chỉ đặt ở `apikey`.
// - Anon key cũ là JWT: đặt thêm ở Authorization như trước.
// - Admin đã đăng nhập: Authorization mang access token của người đó (RLS dựa vào token này).
window.SB_CONFIG.headers = function(userToken) {
  const k = window.SB_CONFIG.key, h = { apikey: k };
  if (userToken) h.Authorization = 'Bearer ' + userToken;
  else if (!k.startsWith('sb_')) h.Authorization = 'Bearer ' + k;
  return h;
};
