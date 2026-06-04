# SEO Pro Tool — Deployment & Config

## URLs

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://your-app.vercel.app |
| Backend (Railway) | https://seo-tool-production-99c0.up.railway.app |
| Health check | https://seo-tool-production-99c0.up.railway.app/health |

---

## Stack

- **Frontend**: React + Vite + TailwindCSS → deploy trên **Vercel**
- **Backend**: Node.js + Express (ESM) → deploy trên **Railway**
- **AI**: cx/gpt-5.5 (`cx/gpt-5.5`)

---

## Chạy local

```bash
# Terminal 1 — Backend (port 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

Mở trình duyệt: http://localhost:5173

---

## Environment Variables

### Backend (`backend/.env`)

```env
GPT_CHAT_BASE_URL=https://khoaapi.duckdns.org/v1
GPT_CHAT_MODEL=cx/gpt-5.5
GPT_CHAT_API_KEY=sk-...
FRONTEND_URL=https://your-app.vercel.app
PORT=3001

# Google Search Console (tùy chọn)
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://seo-tool-production-99c0.up.railway.app/api/gsc/callback
```

### Frontend (`frontend/.env.local` hoặc Vercel dashboard)

```env
VITE_API_URL=https://seo-tool-production-99c0.up.railway.app
```

> **Quan trọng**: `VITE_API_URL` phải có `https://` ở đầu, không có dấu `/` ở cuối.

---

## Railway (Backend)

- **URL**: https://railway.app
- **Project**: seo-tool
- **Region**: asia-southeast1
- **Root Directory**: backend (set trong Settings → Source)
- **Start command**: `node server.js` (từ `railway.json`)
- **PORT**: Railway tự inject, KHÔNG set thủ công

### Khi backend lỗi
1. Vào Railway → service → tab **Logs**
2. Kiểm tra `https://seo-tool-production-99c0.up.railway.app/health`
3. Nếu thấy `{"status":"ok"}` → backend ổn

### Redeploy Railway
- Push code lên GitHub → Railway tự deploy
- Hoặc Railway dashboard → **Redeploy**

---

## Vercel (Frontend)

- **URL**: https://vercel.com
- **Root Directory**: `frontend`
- **Build command**: `vite build` (tự detect)
- **Output directory**: `dist`

### Khi frontend lỗi
- **404 khi refresh**: đã fix bằng `frontend/vercel.json`
- **API không gọi được**: kiểm tra `VITE_API_URL` trong Settings → Environment Variables
- Sau khi sửa env var → phải **Redeploy** (tắt "Use existing Build Cache")

### Redeploy Vercel sạch (không cache)
Vercel → Deployments → "..." → Redeploy → tắt "Use existing Build Cache"

---

## API Routes (Backend)

| Method | Route | Chức năng |
|--------|-------|-----------|
| POST | `/api/keywords/research` | Nghiên cứu từ khóa |
| POST | `/api/keywords/analyze` | Phân tích SERP |
| POST | `/api/audit/url` | Technical SEO audit |
| POST | `/api/competitors/analyze` | Phân tích đối thủ |
| POST | `/api/competitors/backlinks` | Backlink analysis |
| POST | `/api/content/optimize` | Tối ưu nội dung |
| POST | `/api/content/outline` | Tạo content outline |
| POST | `/api/blog/generate` | Viết bài hoàn chỉnh |
| POST | `/api/blog/stream` | Viết bài streaming (SSE) |
| POST | `/api/blog/titles` | Gợi ý tiêu đề |
| GET  | `/api/gsc/auth` | Lấy Google OAuth URL |
| GET  | `/api/gsc/callback` | OAuth callback |
| GET  | `/api/gsc/status` | Trạng thái kết nối GSC |
| POST | `/api/gsc/performance` | Dữ liệu GSC |
| GET  | `/health` | Health check |

---

## Cấu trúc thư mục

```
tool SEO for web/
├── backend/
│   ├── server.js               # Entry point
│   ├── .env                    # API keys (không commit)
│   ├── .env.example            # Template
│   └── src/
│       ├── services/
│       │   └── openai.js       # Wrapper cx/gpt-5.5
│       └── routes/
│           ├── keywords.js
│           ├── audit.js
│           ├── competitors.js
│           ├── content.js
│           ├── blog.js
│           └── gsc.js
├── frontend/
│   ├── vercel.json             # SPA routing fix
│   ├── vite.config.js          # Proxy /api → localhost:3001
│   └── src/
│       ├── pages/              # 7 trang
│       ├── components/         # Layout, Sidebar
│       └── utils/api.js        # Axios client
├── railway.json                # Railway deploy config
└── DEPLOYMENT.md               # File này
```

---

## Lấy API Keys

### GPT Chat API
1. Cấu hình `GPT_CHAT_BASE_URL=https://khoaapi.duckdns.org/v1`
2. Model dùng: `cx/gpt-5.5`
3. Thêm API key vào `GPT_CHAT_API_KEY`

### Google OAuth (cho GSC)
1. console.cloud.google.com → New Project
2. Enable "Google Search Console API"
3. Credentials → Create OAuth 2.0 Client ID
4. Redirect URI: `https://seo-tool-production-99c0.up.railway.app/api/gsc/callback`
5. Thêm email vào "Test users" nếu app đang ở chế độ Testing

---

## Các lỗi đã gặp & cách fix

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `PORT variable must be integer` | Set PORT thủ công trong Railway | Xóa PORT khỏi Railway Variables |
| `CORS not allowed` | FRONTEND_URL sai hoặc dùng tunnel tạm thời | Đã fix: cho phép `*.vercel.app`, `*.trycloudflare.com`, hoặc thêm origin vào `CORS_ORIGINS` |
| URL sai dạng `vercel.app/railway.app/api/...` | VITE_API_URL thiếu `https://` | Thêm `https://` vào đầu |
| `404` khi refresh trang | Vercel không biết xử lý SPA routes | Đã fix bằng `frontend/vercel.json` |
| `[object Object]` error | Axios error không parse đúng | Đã fix trong api.js interceptor |
