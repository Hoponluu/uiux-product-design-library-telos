// Team Map — phần CỐ ĐỊNH TRONG CODE (CMS không sửa được):
// hình học phòng theo id, bảng màu nhóm nghề, danh sách đồ nghề, loại màn hình theo nhóm.
// Nội dung phòng (mã hiển thị, tên, giới thiệu) nằm trong bảng tm_rooms.
// Đổi bố cục phòng = sửa file này (và giữ id khớp với tm_rooms).
window.TM_LAYOUT = {
  scales: {
    small: { name:'Công ty nhỏ' },
    large: { name:'Công ty vài trăm người' }
  },
  // kind: pod | meeting | lounge | locked | glass · tv = vị trí TV (lệch theo trục x), chỉ phòng có tv mới dùng được bước "present"
  rooms: [
    {"id":"P1", "scale":"small", "kind":"pod", "x":-13, "z":-6, "w":11, "d":9, "floor":"#F9D3E3"},
    {"id":"P2", "scale":"small", "kind":"pod", "x":0, "z":-6, "w":11, "d":9, "floor":"#CDEFF8"},
    {"id":"P3", "scale":"small", "kind":"pod", "x":13, "z":-6, "w":11, "d":9, "floor":"#DCD6F7"},
    {"id":"P4", "scale":"small", "kind":"meeting", "x":-13, "z":7, "w":11, "d":9, "floor":"#FFEAB8", "tv":-3.4},
    {"id":"P5", "scale":"small", "kind":"lounge", "x":0, "z":7, "w":9, "d":7, "floor":"#E6DFF6"},
    {"id":"P6", "scale":"small", "kind":"locked", "x":13, "z":7, "w":11, "d":9, "floor":"#D8D2E4"},
    {"id":"R01", "scale":"large", "kind":"meeting", "x":-14, "z":-12, "w":11, "d":9, "floor":"#DCD6F7", "tv":-3.4},
    {"id":"R07", "scale":"large", "kind":"pod", "x":0, "z":-12, "w":11, "d":9, "floor":"#CBEEDF"},
    {"id":"R08", "scale":"large", "kind":"meeting", "x":14, "z":-12, "w":11, "d":9, "floor":"#FFEAB8", "tv":-3.4},
    {"id":"R02", "scale":"large", "kind":"pod", "x":-14, "z":0, "w":11, "d":9, "floor":"#F9D3E3"},
    {"id":"R03", "scale":"large", "kind":"pod", "x":0, "z":0, "w":11, "d":9, "floor":"#F9D3E3"},
    {"id":"R04", "scale":"large", "kind":"pod", "x":14, "z":0, "w":11, "d":9, "floor":"#F9D3E3"},
    {"id":"R05", "scale":"large", "kind":"pod", "x":-14, "z":12, "w":11, "d":9, "floor":"#CDEFF8"},
    {"id":"R06", "scale":"large", "kind":"pod", "x":0, "z":12, "w":11, "d":9, "floor":"#F7C9DD", "tv":-3.4},
    {"id":"R09", "scale":"large", "kind":"pod", "x":14, "z":12, "w":11, "d":9, "floor":"#FFDCC4"},
    {"id":"R11", "scale":"large", "kind":"lounge", "x":-27, "z":0, "w":9, "d":7, "floor":"#E6DFF6"},
    {"id":"R10", "scale":"large", "kind":"glass", "x":29, "z":0, "w":9, "d":33, "floor":"#DEF3F8", "doors":[{"side":"w", "off":-12}, {"side":"w", "off":0}, {"side":"w", "off":12}]}
  ],
  groups: {
    design:      {"name":"Design", "color":"#E92F7C"},
    product:     {"name":"Product", "color":"#FFC53D"},
    engineering: {"name":"Engineering", "color":"#35C6E8"},
    data:        {"name":"Data", "color":"#2FBF8F"},
    delivery:    {"name":"Delivery", "color":"#FF8A3D"},
    business:    {"name":"Business", "color":"#8B7FE0"}
  },
  screenKind: {"design":"figma", "engineering":"code", "data":"chart", "product":"board", "delivery":"board", "business":"chart"},
  props: ["briefcase", "flag", "laptop", "glasses", "pointer", "chart", "headset", "clipboard", "cards", "cap", "tablet", "palette", "pencil", "backpack", "monocle", "play", "database", "phone", "magnifier", "scroll", "gear", "pie", "flask", "timer", "calendar", "megaphone", "blazer", "necklace", "laptopCarry", "phoneUse"],
  roleCategoryByGroup: { design:'vt-design', product:'vt-product', engineering:'vt-engineering', business:'vt-business', data:'vt-cross', delivery:'vt-cross' }
};
