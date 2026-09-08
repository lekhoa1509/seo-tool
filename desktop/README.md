# SEO Tool — macOS app

Đóng gói toàn bộ UI (React) + backend (Express) hiện có thành 1 app macOS chạy
offline trên máy, không cần deploy Vercel/Railway nữa. Backend chạy nhúng
ngay trong app (dùng chính Electron làm runtime Node, không cần cài Node
trên máy người dùng), UI được serve từ cùng origin với backend.

## Build ra file .pkg / .dmg

Máy Windows/Linux **không build được** app macOS (cần công cụ ký/đóng gói của
Xcode chỉ có trên macOS). Có 2 cách:

### Cách 1 — GitHub Actions (khuyên dùng, không cần máy Mac)

Build test (không publish release), tải file thủ công:
1. Vào tab **Actions** trên GitHub → chọn workflow **Build macOS App** →
   **Run workflow**.
2. Đợi build xong (~3-5 phút), tải artifact **seo-tool-macos** — bên trong có
   file `.pkg` (installer, cài vào /Applications) và `.dmg` (kéo-thả).

Phát hành bản chính thức (để nút **Kiểm tra cập nhật** trong app thấy được) —
xem mục [Phát hành bản cập nhật mới](#phát-hành-bản-cập-nhật-mới) bên dưới.

Build này **không ký code** (không có Apple Developer certificate), nên khi
mở lần đầu trên máy Mac, macOS sẽ cảnh báo "không xác định được nhà phát
triển". Cách mở: chuột phải vào app/file cài đặt → **Open**, hoặc vào
**System Settings → Privacy & Security** → **Open Anyway**.

### Cách 2 — Tự build trên máy Mac

```bash
npm install --prefix backend --omit=dev
npm install --prefix frontend
npm run build --prefix frontend
npm install --prefix desktop
npm run dist:mac --prefix desktop
```

File kết quả nằm ở `desktop/dist/*.pkg` và `desktop/dist/*.dmg`.

## Chạy thử ở chế độ dev (trên máy đang có sẵn Node)

```bash
npm run build --prefix frontend
npm install --prefix desktop
npm start --prefix desktop
```

## Cấu hình API key trong app

App có màn hình **Cài đặt** (chỉ hiện khi chạy dưới dạng app desktop) để
nhập OpenAI/GPT chat key, GPT image key, Google OAuth client... File cài đặt
được lưu tại `~/Library/Application Support/SEO Tool/settings.json` trên máy
người dùng — **không** nằm trong file `.pkg`/`.dmg`, nên chia sẻ file cài đặt
cho người khác không lộ key của bạn.

Nếu dùng Google Search Console trong app, cần thêm redirect URI
`http://localhost:4573/api/gsc/callback` vào Google Cloud OAuth client.

## Phát hành bản cập nhật mới

Trong app (màn hình **Cài đặt**) có nút **Kiểm tra cập nhật**: app so phiên
bản đang chạy với bản phát hành mới nhất trên GitHub Releases của repo này,
nếu có bản mới thì tải file `.pkg` về `~/Downloads` và tự mở trình cài đặt —
người dùng không cần được gửi file thủ công nữa.

Quy trình phát hành bản mới:

```bash
# 1. Sửa version trong desktop/package.json, ví dụ 1.0.1 -> 1.0.2
# 2. Commit thay đổi
git add -A && git commit -m "Release v1.0.2"

# 3. Tạo tag đúng version (bắt buộc có tiền tố "v") và push
git tag v1.0.2
git push origin main --tags
```

Push tag `v*` sẽ tự kích hoạt workflow `build-macos.yml` build **và** publish
lên GitHub Releases (assets `.pkg`/`.dmg`) của repo. Vài phút sau, bất kỳ ai
đang mở app cũ đều có thể bấm **Kiểm tra cập nhật** để thấy bản mới.

Lưu ý: nút cập nhật gọi GitHub Releases API công khai (không cần token), nên
repo phải ở chế độ public hoặc người dùng phải có quyền đọc repo.

## Icon app

Chưa có icon riêng (`desktop/build/icon.icns`) — app build sẽ dùng icon mặc
định của Electron. Muốn có icon riêng: tạo file `.icns` rồi khai báo
`"mac": { "icon": "build/icon.icns" }` trong `desktop/package.json`.
