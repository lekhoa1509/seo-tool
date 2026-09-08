# SEO Tool — macOS app

Đóng gói toàn bộ UI (React) + backend (Express) hiện có thành 1 app macOS chạy
offline trên máy, không cần deploy Vercel/Railway nữa. Backend chạy nhúng
ngay trong app (dùng chính Electron làm runtime Node, không cần cài Node
trên máy người dùng), UI được serve từ cùng origin với backend.

## Build ra file .pkg / .dmg

Máy Windows/Linux **không build được** app macOS (cần công cụ ký/đóng gói của
Xcode chỉ có trên macOS). Có 2 cách:

### Cách 1 — GitHub Actions (khuyên dùng, không cần máy Mac)

1. Push nhánh này lên GitHub (repo hiện đã có sẵn workflow
   `.github/workflows/build-macos.yml`).
2. Vào tab **Actions** trên GitHub → chọn workflow **Build macOS App** →
   **Run workflow** (hoặc tạo tag `desktop-v1.0.0` rồi push tag để tự chạy).
3. Đợi build xong (~3-5 phút), tải artifact **seo-tool-macos** — bên trong có
   file `.pkg` (installer, cài vào /Applications) và `.dmg` (kéo-thả).

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

## Icon app

Chưa có icon riêng (`desktop/build/icon.icns`) — app build sẽ dùng icon mặc
định của Electron. Muốn có icon riêng: tạo file `.icns` rồi khai báo
`"mac": { "icon": "build/icon.icns" }` trong `desktop/package.json`.
