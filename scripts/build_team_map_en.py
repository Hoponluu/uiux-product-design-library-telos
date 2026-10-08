#!/usr/bin/env python3
"""Sinh trang tiếng Anh en/team-map.html từ team-map.html:

    python3 scripts/build_team_map_en.py

Trang EN dùng chung CSS / JS với trang tiếng Việt, chỉ khác phần chữ cố định trong HTML
(thẻ meta, header, lời chào, nhãn nút…) và window.TM_LANG = 'en'.
Chữ trong game (engine) nằm trong team-map.engine.js dạng L('vi', 'en');
nội dung (nhân vật, phòng, nhiệm vụ) lấy từ cột i18n.en trong DB.

Sửa team-map.html xong thì chạy lại script này. Nếu một chuỗi tiếng Việt bên dưới
không còn trong team-map.html, script dừng và báo chuỗi đó để cập nhật bảng REPLACE.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'team-map.html')
OUT = os.path.join(ROOT, 'en', 'team-map.html')
SITE = 'https://uiux-library.nhanluu.com'

TITLE_VI = 'Product Company Map Simulation - Một game nhập vai làm UI/UX Designer để hiểu một ngày làm việc của các phòng ban Product'
TITLE_EN = 'Product Company Map Simulation - A role-playing game where you are a UI/UX Designer and live a day with every Product department'
SHORT_VI = 'Game nhập vai UI/UX Designer: một ngày ở công ty Product | TELOS'
SHORT_EN = 'UI/UX Designer role-playing game: a day at a Product company | TELOS'
DESC_VI = 'Một game nhập vai làm UI/UX Designer để hiểu một ngày làm việc của các phòng ban Product: designer ngồi ở đâu, làm việc với ai, báo cáo cho ai.'
DESC_EN = 'A role-playing game where you are a UI/UX Designer and live a day with every Product department: where designers sit, who they work with and who they report to.'

# (chuỗi trong team-map.html, chuỗi tiếng Anh, số lần xuất hiện)
REPLACE = [
    ('<html lang="vi"', '<html lang="en"', 1),
    (f'<title>{SHORT_VI}</title>', f'<title>{SHORT_EN}</title>', 1),
    (f'content="{TITLE_VI}"', f'content="{TITLE_EN}"', 2),
    (f'content="{DESC_VI}"', f'content="{DESC_EN}"', 3),
    # JSON-LD (VideoGame + BreadcrumbList)
    (f'"@id": "{SITE}/team-map#game"', f'"@id": "{SITE}/en/team-map#game"', 1),
    (f'"url": "{SITE}/team-map"', f'"url": "{SITE}/en/team-map"', 1),
    (f'"description": "{DESC_VI}"', f'"description": "{DESC_EN}"', 1),
    ('"inLanguage": "vi"', '"inLanguage": "en"', 1),
    ('"name": "Thư viện thuật ngữ UI/UX"', '"name": "UI/UX Glossary"', 1),
    (f'"item": "{SITE}/team-map"', f'"item": "{SITE}/en/team-map"', 1),
    (f'<link rel="canonical" href="{SITE}/team-map">', f'<link rel="canonical" href="{SITE}/en/team-map">', 1),
    (f'<meta property="og:url" content="{SITE}/team-map">', f'<meta property="og:url" content="{SITE}/en/team-map">', 1),
    ('<meta property="og:locale" content="vi_VN">\n<meta property="og:locale:alternate" content="en_US">',
     '<meta property="og:locale" content="en_US">\n<meta property="og:locale:alternate" content="vi_VN">', 1),
    ('content="Bản đồ 3D văn phòng Product: UI/UX Designer đi gặp Dev team trong quest Handoff"',
     'content="3D map of a Product office: the UI/UX Designer meets the Dev team in the Handoff quest"', 1),
    ("window.TM_LANG = 'vi';", "window.TM_LANG = 'en';", 1),
    # header
    ('aria-label="Công cụ trong thư viện"', 'aria-label="Library tools"', 1),
    ('<span class="tb-label">Về dự án</span>', '<span class="tb-label">About</span>', 1),
    ('<a class="tab-btn active" href="/team-map" aria-current="page">', '<a class="tab-btn active" href="/en/team-map" aria-current="page">', 1),
    ('<a class="tab-btn" href="/hanh-trinh-ui-ux">', '<a class="tab-btn" href="/hanh-trinh-ui-ux" hreflang="vi">', 1),
    ('<span class="tb-label">Hành trình</span>', '<span class="tb-label">Learning path</span>', 1),
    ('<span>Dùng lại nhân vật mặc định</span>', '<span>Use the default character</span>', 1),
    ('aria-label="Đóng menu"', 'aria-label="Close menu"', 1),
    ('<span id="nav-mode-label">Chế độ tối</span>', '<span id="nav-mode-label">Dark mode</span>', 1),
    ("dark ? 'Chế độ sáng' : 'Chế độ tối'", "dark ? 'Light mode' : 'Dark mode'", 1),
    # game shell
    ('<div id="tm-loading" role="status"><div><i></i>Đang dựng văn phòng…</div></div>',
     '<div id="tm-loading" role="status"><div><i></i>Building the office…</div></div>', 1),
    ('aria-label="Mô hình 3D văn phòng Product & Tech"', 'aria-label="3D model of a Product & Tech office"', 1),
    ('aria-label="Mô hình công ty"', 'aria-label="Company model"', 1),
    ('<span class="sr-only">Mô hình công ty</span>', '<span class="sr-only">Company model</span>', 1),
    ('>Công ty product nhỏ</button>', '>Small product company</button>', 1),
    ('>Tập đoàn product 100+ nhân sự</button>', '>100+ person product company</button>', 1),
    ('<option value="small" selected>Công ty product nhỏ</option>', '<option value="small" selected>Small product company</option>', 1),
    ('<option value="large">Tập đoàn product 100+ nhân sự</option>', '<option value="large">100+ person product company</option>', 1),
    ('<span class="hide-sm">Xem dạng danh sách</span><span class="show-sm">Danh sách</span>',
     '<span class="hide-sm">View as a list</span><span class="show-sm">List</span>', 1),
    ('<a class="icon-btn lang-switch" href="/en/team-map" hreflang="en" lang="en" title="English version" aria-label="English version">EN</a>',
     '<a class="icon-btn lang-switch" href="/team-map" hreflang="vi" lang="vi" title="Bản tiếng Việt" aria-label="Bản tiếng Việt">VI</a>', 1),
    ('<span><kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd> đi</span>', '<span><kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd> walk</span>', 1),
    ('<span>Click sàn để tới</span>', '<span>Click the floor to go there</span>', 1),
    ('<span><kbd>F</kbd> nói chuyện</span>', '<span><kbd>F</kbd> talk</span>', 1),
    ('<span>Kéo chuột hoặc <kbd>Q</kbd> <kbd>E</kbd> để xoay</span><span>Cuộn để zoom</span>',
     '<span>Drag or <kbd>Q</kbd> <kbd>E</kbd> to rotate</span><span>Scroll to zoom</span>', 1),
    ('aria-label="Nhiệm vụ"', 'aria-label="Quests"', 1),
    ('<span class="qf-label">Nhiệm vụ</span>', '<span class="qf-label">Quests</span>', 1),
    ('aria-label="Mở bản đồ nhỏ"', 'aria-label="Open the minimap"', 1),
    ('<span>Bản đồ · chạm để đi tới</span>', '<span>Map · tap to walk there</span>', 1),
    ('aria-label="Đóng bản đồ"', 'aria-label="Close the map"', 1),
    ('aria-label="Bản đồ nhỏ"', 'aria-label="Minimap"', 1),
    ('<span>Đã gặp <b id="metc">0</b>/<b id="mett">0</b></span>', '<span>Met <b id="metc">0</b>/<b id="mett">0</b></span>', 1),
    ('aria-label="Xoay trái (Q)" title="Xoay trái (Q)"', 'aria-label="Rotate left (Q)" title="Rotate left (Q)"', 1),
    ('aria-label="Xoay phải (E)" title="Xoay phải (E)"', 'aria-label="Rotate right (E)" title="Rotate right (E)"', 1),
    ('aria-label="Phóng to"', 'aria-label="Zoom in"', 1),
    ('aria-label="Thu nhỏ"', 'aria-label="Zoom out"', 1),
    ('<p class="eyebrow">Ngày đầu đi làm</p>', '<p class="eyebrow">Your first day</p>', 1),
    ('<h1>Bạn là UI/UX Designer mới của công ty</h1>', '<h1>You are the company\'s new UI/UX Designer</h1>', 1),
    ('<p>Đi một vòng văn phòng, gặp từng người để biết họ đang làm gì và làm việc với bạn ra sao. Bấm vào ai cũng có bài viết chi tiết về vai trò đó.</p>',
     '<p>Walk around the office and meet everyone to learn what they do and how they work with you. Every role links to a detailed article about it (in Vietnamese).</p>', 1),
    ('<p>Bắt đầu với <b>công ty product nhỏ</b> (3 team). Khi đã quen, chuyển sang <b>tập đoàn product 100+ nhân sự</b>, <b>outsource agency</b>, hoặc bấm nút <b>Nhiệm vụ</b> cạnh bản đồ.</p>',
     '<p>Start with the <b>small product company</b> (3 teams). Once you are comfortable, switch to the <b>100+ person product company</b> or the <b>outsource agency</b>, or press the <b>Quests</b> button next to the map.</p>', 1),
    ('<button class="btn btn-primary" id="start">Vào văn phòng</button><button class="btn btn-ghost" id="start-quest">Làm nhiệm vụ luôn</button>',
     '<button class="btn btn-primary" id="start">Enter the office</button><button class="btn btn-ghost" id="start-quest">Start the quests</button>', 1),
    ('aria-label="Xem trước bài viết"', 'aria-label="Article preview"', 1),
    ("'Không tải được Team Map. Vui lòng tải lại trang.'", "'Could not load the map. Please reload the page.'", 1),
]


def main():
    s = open(SRC, encoding='utf-8').read()
    missing = []
    for vi, en, n in REPLACE:
        if s.count(vi) != n:
            missing.append(f'  ({s.count(vi)}/{n}) {vi[:100]}')
            continue
        s = s.replace(vi, en)
    if missing:
        sys.exit('Không tìm thấy (hoặc sai số lần) trong team-map.html:\n' + '\n'.join(missing))
    s = s.replace('<!DOCTYPE html>\n', '<!DOCTYPE html>\n<!-- SINH TỰ ĐỘNG từ team-map.html bởi scripts/build_team_map_en.py. Đừng sửa tay. -->\n', 1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(s)
    print('Đã ghi', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
