# Video to Audio Converter – Server
CloudConvert-style FFmpeg backend. Node.js + Express.

### Features
- POST /api/convert – simple upload → download MP3
- POST /api/convert-stream + GET /api/progress/:jobId (SSE) – real-time progress
- Supports: MP4, WebM, MKV, MOV, AVI, FLV … → MP3 / AAC / WAV / OGG / FLAC
- Auto cleanup – files delete after 10 min
- CORS ready
- Docker ready – Railway / Render one-click deploy

### Local run
```bash
# 1. Install FFmpeg
# Ubuntu/Debian: sudo apt install ffmpeg
# macOS: brew install ffmpeg
# Windows: choco install ffmpeg

# 2. Install deps
npm install

# 3. Start
npm start
# → http://localhost:3000
```

Test:
```bash
curl -F "file=@test.mp4" -F "bitrate=192" http://localhost:3000/api/convert -o audio.mp3
```

### Deploy

**Railway.app (free, easiest)**
1. Push this folder to GitHub
2. railway.app → New Project → Deploy from GitHub
3. Done – Railway auto-detects Dockerfile, installs FFmpeg
4. Copy your Railway URL → put in frontend `SERVER_URL`

**Render.com**
- New Web Service → Docker → point to repo
- Free tier works

**VPS (Hetzner / Contabo – $4/mo)**
```bash
git clone <repo>
cd video-converter-server
docker build -t converter .
docker run -p 3000:3000 -e FRONTEND_URL=https://your-site.com converter
```

### Frontend config
In your HTML, set:
```js
const SERVER_URL = 'https://your-railway-app.up.railway.app';
```

The frontend will:
1. Try instant AAC remux client-side (MP4/AAC → 1-2s)
2. If fail → upload to SERVER_URL/api/convert-stream → real progress → download

No more 24% stuck.

### API
- `GET /api/health` – health check
- `POST /api/convert` – form-data: file, bitrate=192, format=mp3 → returns audio file directly
- `POST /api/convert-stream` – returns { jobId }
- `GET /api/progress/:jobId` – SSE progress stream
- `GET /api/download/:jobId` – download result

MIT – by Rabbi Islam


---

## 🇧🇩 বাংলা Quick Start – Rabbi ভাইয়ের জন্য

### 1. Local এ চালানো
```bash
cd video-converter-server
npm install
npm start
```
তারপর ব্রাউজারে: http://localhost:3000
– Frontend + Backend একসাথে চলবে, কোনো SERVER_URL সেট করা লাগবে না।

### 2. Railway এ Deploy (ফ্রি)
1. এই `video-converter-server` ফোল্ডারটা GitHub এ push করো
2. railway.app → New Project → Deploy from GitHub
3. Deploy হয়ে গেলে যে URL দেবে (যেমন `https://converter-xxx.up.railway.app`) – ওটাই তোমার সাইট
4. Frontend auto-detect করবে, আলাদা config লাগবে না

### 3. Frontend আলাদা host করতে চাইলে
`public/index.html` ফাইলটা Vercel / Netlify এ দাও, আর ব্রাউজার console এ একবার চালাও:
```js
localStorage.setItem('converter_server_url', 'https://your-railway-app.up.railway.app')
location.reload()
```

### কিভাবে কাজ করে
- MP4 + AAC ভিডিও → Browser এই instant convert (1-2s), server এ যায় না
- WebM / MKV / অন্য format → Server এ FFmpeg দিয়ে convert, cloudconvert এর মতো fast
- আর 24% এ আটকাবে না – fail করলে clear error দেখাবে

কোনো সমস্যা হলে: aliahsanrabbi13@gmail.com
