# Nguồn đọc truyện cho Zangetsu (iOS)

Bộ nguồn JavaScript dành cho app **Zangetsu** (github.com/Spyou/Zangetsu). Trên iOS,
app không nạp được extension Mihon/Aniyomi/CloudStream, chỉ chạy được **nguồn
JavaScript riêng của Zangetsu**. Bộ này viết theo đúng định dạng đó.

| Nguồn | Loại | Nội dung | Đã chạy thử |
|---|---|---|---|
| **MangaDex** | Truyện tranh | Manga/manhwa do nhóm dịch đăng, mọi lứa tuổi; mặc định tiếng Việt | Logic: có (dữ liệu giả lập). Mạng thật: **chưa**, vì nhà mạng VN chặn MangaDex |
| **MangaDex 18+** | Truyện tranh | Chỉ truyện 18+/21+; mặc định tiếng Việt + English | Như trên |
| **Wikisource Tiếng Việt** | Truyện chữ | Văn học VN thuộc phạm vi công cộng: Nam Cao, Hồ Biểu Chánh, Tam quốc, Truyện Kiều… | Có |
| **Project Gutenberg (sách ngoại văn)** | Truyện chữ | 70.000+ sách kinh điển tiếng Anh, Pháp, Đức, Trung… (**không có sách tiếng Việt**) | Có |

## Cài vào app

1. Đưa cả thư mục này lên một chỗ có link https công khai, ví dụ một repo GitHub.
   Link cần dùng là link **raw** tới `index.json`:
   `https://raw.githubusercontent.com/<tài-khoản>/<repo>/main/index.json`
2. Trong Zangetsu: **Sources → Zangetsu → Repositories → Add**, dán link trên.
3. Bấm **Install** từng nguồn. Nguồn truyện tranh hiện ở chế độ **Manga**,
   nguồn truyện chữ hiện ở chế độ **Novel**.

Các file `.js` phải nằm cùng thư mục với `index.json`, vì app ghép đường dẫn tương đối.

## Cài đặt từng nguồn (bấm vào nguồn → Settings)

**MangaDex / MangaDex 18+** (hai nguồn dùng chung file `mangadex.js`, cài đặt riêng từng nguồn)
- *Ngôn ngữ bản dịch*: MangaDex mặc định Tiếng Việt; MangaDex 18+ mặc định Tiếng Việt + English,
  vì truyện 18+ có bản dịch tiếng Việt rất ít.
- *Mức nội dung hiển thị*: MangaDex mặc định An toàn + Gợi cảm; MangaDex 18+ mặc định
  Nhạy cảm (18+) + Người lớn (21+).
- *Ưu tiên chương tiếng Việt* (mặc định bật): chương nào có bản tiếng Việt thì chỉ hiện bản đó,
  bản tiếng Anh chỉ lấp các chương còn thiếu. Khi chọn từ 2 ngôn ngữ, chương được gắn 🇻🇳 hoặc [EN].
- *Tiết kiệm dữ liệu*: dùng ảnh nén khi đi 4G.
- Khi chọn tiếng Việt cùng ngôn ngữ khác, trang chủ có thêm 3 kệ **🇻🇳 … (tiếng Việt)** ở trên cùng.
  Truyện có bản dịch tiếng Việt hiện tên tiếng Việt (nếu có) và nhãn **🇻🇳 VI** ở góc bìa
  (cần bật huy hiệu trên ảnh bìa trong cài đặt của app).
- MangaDex 18+ có bộ kệ thể loại riêng: Tình cảm, Công sở, Học đường, Harem, Quái vật…
- Ở mọi mức, truyện gắn tag Loli/Shota đều bị loại. Nguồn không có tuỳ chọn tắt bộ lọc này.
- Dán link `mangadex.org/title/...` vào ô tìm kiếm để mở thẳng truyện đó.
- Không đặt `"nsfw": true` cho MangaDex 18+ trong `index.json`: app xếp nguồn có cờ nsfw vào
  nhóm NSFW của chế độ xem phim, nên nguồn sẽ không hiện ở chế độ Manga.

**Wikisource Tiếng Việt**: bìa lấy từ ảnh Wikisource, rồi đến ảnh bài Wikipedia; tác phẩm
không có ảnh thì dùng bìa chữ tự tạo (tên truyện trên nền màu, qua placehold.co).

**Project Gutenberg**: *Ngôn ngữ sách*, mặc định English. Gutenberg gần như không có sách
tiếng Việt; truyện chữ tiếng Việt hợp pháp nằm ở nguồn Wikisource.

## Xem hết truyện của một nguồn

Zangetsu không có nút "Xem tất cả" cho kệ của nguồn JavaScript, nên mỗi kệ trên trang
chủ chỉ có số truyện nguồn trả về (MangaDex 100/kệ, Wikisource tới 60/kệ, Gutenberg 75/kệ).
Muốn xem hết thì dùng **ô tìm kiếm bên trong nguồn**, cuộn xuống để tải tiếp:

| Gõ | Kết quả |
|---|---|
| `*` (hoặc `tất cả`) | Toàn bộ kho, truyện phổ biến trước |
| `#tình cảm`, `#hành động`, `#xuyên không`, `#Romance`… | Toàn bộ một thể loại (MangaDex) |
| Tên truyện / tác giả | Tất cả kết quả, cuộn để tải thêm (MangaDex: truyện có tiếng Việt xếp trước) |
| `* vi`, `#tình cảm vi`, `🇻🇳` | Như trên nhưng **chỉ truyện có bản tiếng Việt** (MangaDex) |

Thể loại tiếng Việt có sẵn cho MangaDex: tình cảm, hành động, hài hước, giả tưởng, xuyên không,
chính kịch, đời thường, học đường, phiêu lưu, trinh thám, kinh dị, tâm lý, khoa học viễn tưởng,
lịch sử, thể thao, siêu nhiên, võ thuật, bi kịch, harem, công sở, quái vật, ma cà rồng, phép thuật,
trò chơi, nấu ăn. Tên tag tiếng Anh của MangaDex cũng gõ được (`#Romance`, `#Ecchi`…).

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
