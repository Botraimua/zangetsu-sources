# Nguồn đọc truyện cho Zangetsu (iOS)

Bộ nguồn JavaScript dành cho app **Zangetsu** (github.com/Spyou/Zangetsu). Trên iOS,
app không nạp được extension Mihon/Aniyomi/CloudStream, chỉ chạy được **nguồn
JavaScript riêng của Zangetsu**. Bộ này viết theo đúng định dạng đó.

| Nguồn | Loại | Nội dung | Đã chạy thử |
|---|---|---|---|
| **MangaDex** | Truyện tranh | Manga/manhwa do nhóm dịch đăng; có tiếng Việt; có mức 18+/21+ | Logic: có (dữ liệu giả lập). Mạng thật: **chưa**, vì nhà mạng VN chặn MangaDex |
| **Wikisource Tiếng Việt** | Truyện chữ | Văn học VN thuộc phạm vi công cộng: Nam Cao, Hồ Biểu Chánh, Tam quốc, Truyện Kiều… | Có |
| **Project Gutenberg** | Truyện chữ | 70.000+ sách kinh điển (Anh, Pháp, Đức, Trung…) | Có |

## Cài vào app

1. Đưa cả thư mục này lên một chỗ có link https công khai, ví dụ một repo GitHub.
   Link cần dùng là link **raw** tới `index.json`:
   `https://raw.githubusercontent.com/<tài-khoản>/<repo>/main/index.json`
2. Trong Zangetsu: **Sources → Zangetsu → Repositories → Add**, dán link trên.
3. Bấm **Install** từng nguồn. Nguồn truyện tranh hiện ở chế độ **Manga**,
   nguồn truyện chữ hiện ở chế độ **Novel**.

Các file `.js` phải nằm cùng thư mục với `index.json`, vì app ghép đường dẫn tương đối.

## Cài đặt từng nguồn (bấm vào nguồn → Settings)

**MangaDex**
- *Ngôn ngữ bản dịch*: mặc định Tiếng Việt. Thêm English sẽ có nhiều truyện hơn.
- *Mức nội dung hiển thị*: mặc định An toàn + Gợi cảm. Muốn xem 18+/21+ thì
  tích thêm **Nhạy cảm (18+)** và **Người lớn (21+)**.
- *Tiết kiệm dữ liệu*: dùng ảnh nén khi đi 4G.
- Ở mọi mức, truyện gắn tag Loli/Shota đều bị loại. Nguồn không có tuỳ chọn tắt bộ lọc này.
- Dán link `mangadex.org/title/...` vào ô tìm kiếm để mở thẳng truyện đó.

**Project Gutenberg**: *Ngôn ngữ sách*, mặc định English.

## Lưu ý về mạng ở Việt Nam

MangaDex bị nhà mạng chặn (DNS trả về địa chỉ giả, kết nối bị ngắt giữa chừng). Trên
iPhone cần bật VPN, ví dụ app **1.1.1.1 (WARP)** miễn phí, thì MangaDex mới tải được.
Khi bị chặn, nguồn sẽ báo lỗi "không kết nối được… thử bật VPN".
Wikisource và Gutenberg không bị chặn.

## Truyện chữ: thêm kho plugin LNReader

Zangetsu đọc được cả kho plugin của **LNReader** (cũng là JavaScript, chạy được trên
iOS) ở **Sources → LNReader → Add repo**. Mỗi plugin là một trang web khác nhau, chị
tự cân nhắc trang nào hợp pháp.

## Cấu trúc file

```
index.json        manifest: {name, description, sources:[{id,name,version,type,lang,file,logo,nsfw}]}
mangadex.js       type "manga": getHome, popular, search, getDetail, getPages, getSettings
wikisource-vi.js  type "novel": getHome, popular, search, getDetail, getText
gutenberg.js      type "novel": getHome, popular, search, getDetail, getText, getSettings
```

Khi sửa một nguồn, nhớ tăng `version` ở cả `getInfo()` lẫn `index.json` để app nhận bản cập nhật.
