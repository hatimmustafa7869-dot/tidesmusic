# 🌊 Tides Music

A modern, high-performance music streaming web application and PWA inspired by Spotify desktop and mobile, built with **React 19**, **FastAPI**, **YouTube Data API v3**, and direct audio streaming with **native background playback**, **click-to-play lyrics**, and **real-time collaborative Jams**.

---

## ✨ Features

- 🎧 **Native Background Audio Playback**: Unlike official web players that pause when you switch tabs or lock your screen, Tides Music streams audio seamlessly across tabs, minimized windows, and phone lock screens.
- 🎤 **Interactive Click-to-Play Lyrics**:
  - Live synchronized lyrics with the active singing line highlighted with an animated audio equalizer visualizer.
  - **Click any part of the lyrics** to jump to and play that exact timestamp immediately!
  - Smart auto-scroll with snap-back indicator when manually scrolling.
- 📻 **Real-Time Collaborative "Tides Jam"**:
  - Start a live Jam session and invite friends with a 5-letter code or direct link (`?jam=JAM-XXXXX`).
  - Play, pause, seek, and queue changes synchronize across all participants' devices in real-time via WebSockets.
  - Live floating emoji reactions (🔥, ❤️, 🎵, 👏, 🥳) broadcast instantly to all listeners.
- 📱 **Download App (Phone APK & PC)**:
  - Direct 1-click download of the Android APK (`TidesMusic.apk`) or install as an offline-capable PWA.
  - Windows Setup installer (`TidesMusic-Setup.exe`) and native desktop app support.
- 🔐 **User Accounts & Cloud Persistence**:
  - Fast JWT authentication (Login / Register) with 90-day persistent session.
  - Custom playlists saved and synchronized to SQLite database (ready for deployment on Hostinger or any VPS).
- 📜 **Playlist Management & Importer**:
  - Import public Spotify or YouTube playlists directly by link or ID.
  - Create and manage custom user playlists with instant additions and deletions.
- 🔄 **Auto-Queue & Infinite Radio**:
  - Continuous playback keeps recommending and queuing related tracks so the music never stops.

---

## 🚀 Quick Start

### 1. Unified Launch (Frontend + Backend)
```powershell
# Run the FastAPI server which also serves the compiled frontend:
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Open **`http://127.0.0.1:8000`** in your browser.

### 2. Frontend Development Mode
```powershell
cd frontend
npm run dev
```
Open **`http://localhost:5173`** for hot-reloading development.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, WebSockets
- **Backend**: Python 3.11+, FastAPI, Uvicorn, SQLite, HTTPX, WebSockets, JWT Authentication
- **Streaming & Metadata**: YouTube Data API v3, `ytmusicapi`, `yt-dlp` (mobile client bypass)

---

## 🌐 Hostinger / VPS Deployment
Refer to `HOSTINGER_DEPLOYMENT.md` for full instructions on running Tides Music on Ubuntu / Hostinger VPS with Docker or systemd + Nginx.
