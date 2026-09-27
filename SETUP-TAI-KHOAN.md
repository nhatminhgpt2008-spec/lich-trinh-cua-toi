# Hệ thống tài khoản cho "Lịch trình của tôi"

## 1. Kiến trúc hiện tại (trước khi sửa)

- **Công nghệ:** một file `index.html` duy nhất (HTML+CSS+JS thuần, không framework, không build step). `sw.js` chỉ lo cache/offline + click-thông-báo. `manifest.webmanifest` cho phép "Thêm vào màn hình chính".
- **Lưu trữ dữ liệu:** toàn bộ lịch/deadline/ghi chú/tag/hàng tùy chỉnh nằm trong **một object `state` duy nhất**, lưu ở `localStorage['uit-planner-v2']`. Có thêm `localStorage['uit-planner-v2:ts']` (thời điểm sửa gần nhất) và một bản sao lưu tự động vào IndexedDB (`uit-planner-fs`) chỉ để giữ tay cầm file khi bật "Tự động sao lưu ra .json".
- **Đồng bộ nhiều thiết bị (trước khi sửa):** đã có **Firebase** (Firestore) từ trước, dùng một trong hai cách:
  1. `SYNC_KEY` (một chuỗi bí mật hard-code) → mọi thiết bị biết chuỗi này đọc/ghi chung **một** tài liệu `planner/{SYNC_KEY}`, **không cần đăng nhập** — ai có link/khóa là vào được, không có khái niệm tài khoản.
  2. Nếu bỏ trống `SYNC_KEY` → dùng Firebase Auth (chỉ Google) nhưng **mọi tài khoản Google lại cùng đọc/ghi một tài liệu `planner/main`** — nghĩa là dù có "đăng nhập", hai người dùng Google khác nhau vẫn nhìn thấy và ghi đè dữ liệu của nhau. Đây không phải hệ thống nhiều tài khoản thật.
- Vì vậy: trang đã có sẵn hạ tầng Firebase (project `lich-trinh-cua-toi`) nhưng **chưa có tách dữ liệu theo người dùng, chưa có đăng ký, chưa có mật khẩu, chưa có reset mật khẩu, chưa có Security Rules**.

## 2. Kiến trúc đề xuất và đã triển khai

Theo đúng ưu tiên đã nêu ("nếu đã có Firebase/Supabase thì tái sử dụng"), tôi **giữ nguyên Firebase** (không thêm Supabase) và bổ sung:

- **Firebase Authentication**: bật thêm phương thức **Email/Mật khẩu**, giữ nguyên **Google**. Cả hai cùng một hệ thống Auth, không tạo hệ thống thứ hai.
- **Cloud Firestore**: đổi từ tài liệu dùng chung `planner/main` sang **`users/{uid}/planner/main`** — mỗi tài khoản một tài liệu riêng, khóa bằng `uid` do Firebase Auth cấp phía server.
- **Firestore Security Rules** (`firestore.rules`): chỉ cho phép đọc/ghi khi `request.auth.uid == uid` của tài liệu. Đây là chốt chặn thật ở server — không thể vượt qua bằng cách sửa JS ở trình duyệt.
- **Tài liệu cũ `planner/{SYNC_KEY}`**: được giữ lại **chỉ để đọc một lần** (di chuyển dữ liệu cũ), không cho ghi mới. Có nút "Nhập dữ liệu từ bản đồng bộ cũ" trong menu ⋯ (chỉ hiện khi đã đăng nhập) để bạn tự bấm import — không tự động gán cho bất kỳ ai đăng ký mới, tránh lộ dữ liệu cũ cho người lạ.
- **Không dùng server key/service-role key**: Firebase Web SDK dùng `apiKey` công khai theo thiết kế của Firebase (không phải bí mật) — bảo mật thật sự nằm ở Security Rules, không nằm ở việc giấu `apiKey`. Vì vậy **không cần file `.env`** cho project tĩnh này.

### File đã sửa
- `index.html` — thêm giao diện Đăng nhập/Đăng ký/Quên mật khẩu, "Tài khoản của tôi" (đổi tên hiển thị, đổi mật khẩu, gửi lại email xác minh, xuất dữ liệu, xóa tài khoản), khối JS quản lý Auth + Firestore theo từng `uid`, hộp thoại xử lý dữ liệu cục bộ khi đăng nhập lần đầu / khi có xung đột.

### File tạo mới
- `firestore.rules` — Security Rules, cần dán vào Firebase Console (hoặc deploy bằng Firebase CLI).
- `SETUP-TAI-KHOAN.md` — file hướng dẫn này.

### Giữ nguyên hoàn toàn
- Toàn bộ tính năng lịch/deadline/ghi chú/tag/bảng/danh sách, sao lưu-khôi phục `.json`, xuất `.ics`, thông báo, in, undo/redo, Tự động sao lưu ra file `.json` bằng File System Access API, `sw.js`, `manifest.webmanifest`.
- Cấu trúc dữ liệu `state` (không đổi schema) — vẫn đồng bộ nguyên khối JSON như cũ, chỉ đổi **nơi lưu** (theo `uid` thay vì dùng chung).

## 3. Cách hoạt động

- **Chưa đăng nhập:** hoạt động như trước — chỉ lưu `localStorage`.
- **Đăng nhập (Email/Mật khẩu hoặc Google):**
  - Nếu tài khoản **chưa có dữ liệu trên cloud** và thiết bị **đang có dữ liệu** → hỏi: đồng bộ dữ liệu thiết bị lên tài khoản, hay giữ tài khoản trống (mục 13).
  - Nếu tài khoản **đã có dữ liệu** và thiết bị **cũng có dữ liệu chưa từng đồng bộ với tài khoản này** → hỏi: giữ bản trên thiết bị hay giữ bản trên tài khoản (mục 14), không tự động ghi đè.
  - Sau đó đồng bộ hai chiều theo thời gian (`ts`), giống cơ chế cũ.
  - Đăng xuất → ngừng lắng nghe/ghi lên Firestore ngay lập tức, dữ liệu local vẫn còn nguyên trên thiết bị.
- **Quên mật khẩu:** gửi email đặt lại qua Firebase (mẫu email cấu hình trong Firebase Console → Authentication → Templates).
- **Xác minh email:** gửi khi đăng ký; nếu chưa xác minh, "Tài khoản của tôi" hiện nút gửi lại. (Việc *bắt buộc* xác minh mới cho dùng cloud là tuỳ chọn — hiện tại app không chặn, chỉ nhắc; nói cho tôi biết nếu bạn muốn chặn ghi Firestore với email chưa xác minh, tôi sẽ thêm điều kiện đó vào Rules.)
- **Đổi mật khẩu / Xóa tài khoản:** yêu cầu xác thực lại (`reauthenticateWithCredential`) trước khi đổi mật khẩu; xóa tài khoản yêu cầu gõ đúng "XÓA TÀI KHOẢN" + xác nhận, sau đó xóa tài liệu Firestore của user rồi xóa tài khoản Auth. Dữ liệu trên thiết bị **không** bị xóa.

## 4. Cấu hình cần làm trên Firebase Console (project `lich-trinh-cua-toi`)

1. **Authentication → Sign-in method**: bật **Email/Password** (đã có sẵn Google). Không cần bật "Email link".
2. **Authentication → Settings → Authorized domains**: thêm domain GitHub Pages của bạn, ví dụ `nhatminhgpt2008-spec.github.io` (không phải toàn bộ URL, chỉ domain).
3. **Authentication → Templates**: có thể chỉnh nội dung email xác minh / đặt lại mật khẩu sang tiếng Việt nếu muốn (Firebase hỗ trợ đổi ngôn ngữ mặc định ở đây).
4. **Firestore Database → Rules**: dán nội dung file `firestore.rules` (Publish). Có thể deploy qua Firebase CLI: `firebase deploy --only firestore:rules` nếu bạn dùng CLI, hoặc dán trực tiếp trong tab Rules trên Console — cả hai cách đều được, không cần CLI nếu bạn không quen dùng.
5. Không cần thêm biến môi trường/secret nào khác — `FIREBASE_CONFIG` trong `index.html` là cấu hình công khai theo đúng thiết kế của Firebase.

## 5. Checklist deploy lên GitHub Pages

- [ ] Thay `index.html` hiện tại bằng bản mới, giữ nguyên `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`.
- [ ] Bật Email/Password trong Firebase Authentication (mục 4.1).
- [ ] Thêm domain GitHub Pages vào Authorized domains (mục 4.2).
- [ ] Dán `firestore.rules` vào Firestore Rules và Publish (mục 4.4).
- [ ] Commit & push, đợi GitHub Pages build xong, mở lại `https://nhatminhgpt2008-spec.github.io/lich-trinh-cua-toi/`.
- [ ] Đăng nhập bằng tài khoản Google bạn đã dùng để đồng bộ trước đây (hoặc đăng ký email mới), sau đó vào menu ⋯ → "Nhập dữ liệu từ bản đồng bộ cũ" **một lần** để lấy lại dữ liệu đã lưu trước khi có hệ thống tài khoản.
- [ ] Sau khi xác nhận dữ liệu đã chuyển đúng, cân nhắc xóa tài liệu `planner/{LEGACY_SYNC_KEY}` cũ trên Firestore Console cho gọn (không bắt buộc).

## 6. Checklist kiểm thử (theo đúng 20 mục bạn yêu cầu)

| # | Kịch bản | Cách kiểm tra |
|---|---|---|
| 1 | Chưa đăng nhập vẫn dùng được | Mở trang ẩn danh, thêm/sửa lịch bình thường |
| 2 | Đăng ký tài khoản mới | Menu ⋯ → chip "Đăng nhập/Đăng ký" → tab Đăng ký |
| 3 | Xác minh email | Kiểm tra hộp thư sau khi đăng ký, bấm liên kết |
| 4 | Đăng nhập | Tab Đăng nhập với email/mật khẩu vừa tạo |
| 5 | Đăng xuất | "Tài khoản của tôi" → Đăng xuất |
| 6 | Quên mật khẩu | "Quên mật khẩu?" trong hộp Đăng nhập |
| 7 | Đăng nhập lại sau reload | Reload trang, kiểm tra vẫn còn đăng nhập (Firebase Auth tự lưu phiên) |
| 8 | Tạo lịch sau khi đăng nhập | Thêm một sự kiện, kiểm tra Firestore Console có tài liệu `users/{uid}/planner/main` |
| 9 | Reload → dữ liệu còn | Reload, dữ liệu vừa thêm vẫn hiển thị |
| 10 | Tài khoản khác không thấy dữ liệu cũ | Đăng xuất, đăng nhập bằng tài khoản thứ hai, kiểm tra lịch trống (trừ khi đã đồng bộ) |
| 11 | Đăng nhập lại tài khoản cũ | Dữ liệu tài khoản 1 vẫn còn nguyên |
| 12 | Có dữ liệu local trước khi đăng ký | Thêm lịch khi chưa đăng nhập, sau đó đăng ký — kiểm tra hộp thoại hỏi đồng bộ hiện ra |
| 13 | Mất mạng | Tắt mạng, vẫn sửa được lịch (Firestore SDK có cache offline) |
| 14 | Có mạng lại | Bật mạng, đợi vài giây, kiểm tra Firestore Console cập nhật |
| 15 | Backup .json | Menu ⋯ → Sao lưu (.json) |
| 16 | Restore .json | Menu ⋯ → Khôi phục từ file .json |
| 17 | Google Login | Nút "Đăng nhập bằng Google" trong hộp Đăng nhập |
| 18 | Xóa tài khoản | "Tài khoản của tôi" → gõ "XÓA TÀI KHOẢN" → Xóa tài khoản |
| 19 | Responsive mobile | Mở bằng điện thoại hoặc DevTools chế độ mobile |
| 20 | Console không lỗi nghiêm trọng | Mở DevTools → Console khi thao tác các bước trên |

## 6. Giới hạn đã biết / có thể mở rộng thêm nếu bạn cần

- App vẫn đồng bộ **toàn bộ state** dưới dạng một JSON blob (đúng như thiết kế gốc), nên xung đột được xử lý ở mức "cả file" chứ chưa merge từng sự kiện riêng lẻ. Muốn merge chi tiết hơn (theo từng event/todo) sẽ cần tách `state` thành nhiều tài liệu nhỏ — đổi khá nhiều so với kiến trúc gốc, nói tôi biết nếu bạn muốn làm bước đó.
- Chưa chặn ghi Firestore khi email chưa xác minh (chỉ nhắc nhở) — nếu muốn bắt buộc, cần thêm điều kiện `request.auth.token.email_verified == true` vào `firestore.rules` và tôi sẽ cập nhật cả UI cho khớp.
- Avatar ảnh đại diện: hiện dùng chữ cái đầu tên; nếu muốn cho tải ảnh lên cần thêm Firebase Storage (chưa có trong phạm vi lần này).
