# 🚀 Hostinger Deployment & Zero-Data-Loss Database Guide for Tides Music

This guide covers deploying, maintaining, and updating your **Tides Music** instance on **Hostinger VPS** with **guaranteed zero data loss** across redeployments, updates, and restarts.

---

## 🛡️ Why Data Was Getting Lost Before & How It Is Solved Forever

### 1. The Root Cause of Old Data Loss:
- Previously, the database was stored using a relative path inside the repository (`soundflow.db`).
- Because `.db` files are ignored in `.gitignore`, whenever `git clean -fd`, `git checkout -f`, or fresh pulls occurred, or when PM2 started from a different working directory, the database file was either deleted or created fresh in a new location!

### 2. The 3-Tier Zero-Data-Loss Protection:
1. **Isolated Persistent System Directory**:
   - On Linux VPS, the database is stored at `/var/lib/tides-music/tides.db` (outside `/var/www/` or any git repository).
   - Even if you run `git pull`, `git clean -fd`, or completely delete and re-clone the repository, `/var/lib/tides-music/tides.db` is **never touched**.
2. **Automated Rolling Backups**:
   - Every time the application boots and whenever library updates happen, a physical SQLite snapshot is stored in `data/backups/tides_backup_<timestamp>.db`.
   - The last 30 backups are permanently maintained.
3. **Disaster Recovery JSON Snapshot**:
   - A complete JSON snapshot (`data/tides_disaster_recovery.json`) containing all users, passwords, playlists, playlist tracks, favorites, and history is continuously updated.
   - If the database is ever found empty or missing on server start, Tides Music **automatically restores 100% of all data** from the snapshot!

---

## 📧 Hostinger SMTP Configuration (Password Reset)

To enable the **Forgot Password** feature with direct email delivery to your users:

1. Open or create `.env` in `/var/www/soundflow/.env`:
   ```bash
   nano /var/www/soundflow/.env
   ```

2. Add your Hostinger Email SMTP credentials:
   ```ini
   # Hostinger SMTP Configuration
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465
   SMTP_USER=support@yourdomain.com
   SMTP_PASSWORD=your_hostinger_email_password
   SMTP_FROM_EMAIL=support@yourdomain.com
   SMTP_FROM_NAME=Tides Music
   SMTP_USE_SSL=true

   # Persistent Database Location (Default is /var/lib/tides-music/tides.db)
   DATABASE_PATH=/var/lib/tides-music/tides.db

   # Security Secret
   JWT_SECRET=production-secret-replace-with-random-hex-string
   ```

3. Save with `Ctrl+O` then `Enter`, exit with `Ctrl+X`.

*(Note: If SMTP credentials are not yet set, the app will log the 6-digit verification code to the console/response so you can still test password resets without blocking).*

---

## 🔄 How to Safely Redeploy (Zero Data Loss)

When you make changes to the app and want to deploy them to your Hostinger server, run this 1-line command:

```bash
cd /var/www/soundflow && git pull origin main && cd frontend && npm install && npm run build && cd .. && pm2 restart all
```

Because your database is safely housed in `/var/lib/tides-music/tides.db` with dual-layer backups, all user accounts, playlists, favorites, and queue data will remain **100% intact**.

---

## 💾 Manual Backup & Disaster Recovery Commands

### Export Database Backup via API:
You can download your entire database as a clean JSON backup at any time:
```bash
curl http://localhost:8000/api/admin/export-database > my_backup_$(date +%F).json
```

### Check Database Health & File Size:
```bash
curl http://localhost:8000/api/admin/database-status
```

---

## 📱 Full Setup Guide from Scratch (If Setting Up Fresh VPS)

### Step 1: Install System Dependencies
```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv nodejs npm ffmpeg nginx certbot python3-certbot-nginx
```

### Step 2: Create Persistent System Data Directory
```bash
sudo mkdir -p /var/lib/tides-music
sudo chown -R $USER:$USER /var/lib/tides-music
```

### Step 3: Clone Repository & Setup Virtualenv
```bash
mkdir -p /var/www/soundflow
git clone https://github.com/hatimmustafa7869-dot/tidesmusic.git /var/www/soundflow
cd /var/www/soundflow
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

### Step 4: Build Frontend
```bash
cd /var/www/soundflow/frontend
npm install
npm run build
cd /var/www/soundflow
```

### Step 5: Start with PM2
```bash
sudo npm install -g pm2
pm2 start "./.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000" --name tides-music
pm2 save
pm2 startup
```

### Step 6: Configure Nginx Domain & SSL
Create `/etc/nginx/sites-available/tides`:
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
Enable and get SSL:
```bash
sudo ln -s /etc/nginx/sites-available/tides /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d music.yourdomain.com
```
