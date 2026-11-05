#!/bin/bash
# Postgres local để thử các file SQL (migration, seed) trước khi chạy trên Supabase. KHÔNG đụng production.
#   bash tests/db-local.sh start                 dựng DB trống ở /tmp/telos-pg (cổng 5434) + stub hàm/role của Supabase
#   bash tests/db-local.sh sql <file.sql> [...]  chạy lần lượt các file (dừng ở lỗi đầu tiên)
#   bash tests/db-local.sh psql "<câu lệnh>"     chạy một câu SQL, in kết quả
#   bash tests/db-local.sh stop                  tắt và xoá DB
# Lưu ý: Postgres chạy bằng user postgres nên KHÔNG đặt dữ liệu trong thư mục nháp của agent (không có quyền vào) → dùng /tmp/telos-pg.
# Để thử migration trên "trạng thái production cũ": lấy file SQL bản cũ bằng git show <nhánh>:<file> rồi chạy trước, sau đó chạy bản mới.
set -e
D=/tmp/telos-pg; PG=/usr/lib/postgresql/16/bin; PORT=5434
P="psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
case "$1" in
  start)
    rm -rf $D && mkdir -p $D && chown postgres $D
    su postgres -c "$PG/initdb -D $D/data -A trust >/dev/null && $PG/pg_ctl -D $D/data -o '-p $PORT -k $D' -l $D/log start >/dev/null"
    sleep 1
    # stub tối thiểu những thứ có sẵn trên Supabase mà các file SQL của repo dùng tới
    $P -c "create role anon; create role authenticated; create schema if not exists auth;
      create function auth.uid() returns uuid language sql as \$\$ select null::uuid \$\$;
      create function tm_touch() returns trigger language plpgsql as \$\$ begin new.updated_at = now(); return new; end \$\$;
      create function is_admin() returns boolean language sql as \$\$ select true \$\$;
      create function tm_require_admin() returns void language plpgsql as \$\$ begin end \$\$;"
    echo "DB local sẵn sàng: $D (cổng $PORT)";;
  sql) shift; for f in "$@"; do echo "-- $f"; $P -f "$f" 2>&1 | grep -v NOTICE || true; done;;
  psql) shift; $P -tAc "$1";;
  stop) su postgres -c "$PG/pg_ctl -D $D/data stop" >/dev/null 2>&1 || true; rm -rf $D; echo "đã tắt";;
  *) echo "dùng: $0 start | sql <file...> | psql \"<sql>\" | stop"; exit 1;;
esac
