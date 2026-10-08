# 🚀 Hostinger Deployment Guide for SoundFlow (Spotify Web & Desktop Player)

This guide walks you through deploying your SoundFlow instance to **Hostinger VPS** so that:
- Anyone can access the app from their web browser or install it as an app on phone/PC.
- Users can register, log in once, and stay permanently logged in.
- All user playlists, liked songs, and listening histories are saved in your Hostinger database.

---

## 📋 Prerequisites on Hostinger

- A **Hostinger KVM VPS** (Ubuntu 22.04 or 24.04 LTS recommended)
- Your domain or subdomain pointing to your Hostinger VPS IP (e.g., `music.yourdomain.com`)

---

## Method 1: Instant Docker Deployment (Recommended)

### Step 1: Connect to your Hostinger VPS via SSH
```bash
ssh root@YOUR_HOSTINGER_SERVER_IP
```

### Step 2: Install Docker & Docker Compose (if not already installed)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### Step 3: Upload or Clone the Project
```bash
# Upload via Git or SFTP to /var/www/soundflow
mkdir -p /var/www/soundflow
cd /var/www/soundflow
# Copy project files here
```

### Step 4: Launch the App
```bash
docker compose up -d --build
```
Your app is now running in the background on port `8000` with automated container restarts and a persistent database volume (`soundflow_data`).

---

## Method 2: Direct Python Service Deployment

If you prefer running without Docker:

### Step 1: Install Python & Node.js
```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv nodejs npm ffmpeg
```

### Step 2: Set up Virtual Environment & Install Dependencies
```bash
cd /var/www/soundflow
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

### Step 3: Build the Frontend
```bash
cd /var/www/soundflow/frontend
npm install
npm run build
cd /var/www/soundflow
```

### Step 4: Create a Systemd Service (Auto-Start on Boot)
Create `/etc/systemd/system/soundflow.service`:
```ini
[Unit]
Description=SoundFlow Spotify Web App
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/soundflow
ExecStart=/var/www/soundflow/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
Environment="YOUTUBE_API_KEY=AIzaSyBD3kLZd4PMOhNKS0k6qQOlig_svmqmtGY"
Environment="JWT_SECRET=YOUR_PRODUCTION_SECRET_KEY_HERE"
Environment="DATABASE_PATH=/var/www/soundflow/soundflow.db"

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable soundflow
sudo systemctl start soundflow
```

---

## 🔒 Step 5: Configure Domain, Nginx & Free SSL (HTTPS)

To enable background playing on mobile Safari and Chrome, HTTPS is recommended.

1. **Install Nginx & Certbot**:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Configure Nginx Site**:
   Create `/etc/nginx/sites-available/soundflow`:
   ```nginx
   server {
       server_name music.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_buffering off;
       }
   }
   ```

3. **Enable Site & Obtain SSL**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/soundflow /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d music.yourdomain.com
   ```

Now visit `https://music.yourdomain.com`!

---

## 📱 How Users Experience It "Same to Same as Spotify App"

1. **Persistent Sign In**: Users can click **Sign up** or **Log in**. The app issues a 90-day cryptographically signed JWT token stored in browser storage. Users remain logged in permanently.
2. **Cloud Database Sync**: Any playlist created, track added, or song liked is immediately saved in SQLite (`soundflow.db`) on your Hostinger server.
3. **Install as App**:
   - **On Android**: Chrome shows an automatic "Install App" banner or "Add to Home screen".
   - **On iPhone / iOS**: Tap Share -> "Add to Home Screen" for a full native app icon and full-screen experience.
   - **On Desktop (Chrome/Edge)**: Click the Install icon in the URL bar to run as a standalone Spotify-like desktop window.
