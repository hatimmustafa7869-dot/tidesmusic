const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Global Error Handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.stack || err.message);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Configuration
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'tides_jwt_secret_key_2026_99a8b7c6d5e4f3';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyBD3kLZd4PMOhNKS0k6qQOlig_svmqmtGY';
const DB_FILE = path.join(__dirname, 'tides_data.json');

app.use(cors());
app.use(express.json());

// In-Memory & File-backed Database
let db = {
  users: [],
  playlists: [],
  favorites: {},
  history: {}
};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading db file:', err.message);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving db file:', err.message);
  }
}

loadDb();

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ detail: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ detail: 'Invalid or expired session token' });
    req.user = decoded;
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) req.user = decoded;
      next();
    });
  } else {
    next();
  }
}

// Helpers
function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function parseIsoDuration(durationStr) {
  if (!durationStr) return 0;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || 0, 10);
  const m = parseInt(match[2] || 0, 10);
  const s = parseInt(match[3] || 0, 10);
  return h * 3600 + m * 60 + s;
}

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ detail: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ detail: 'Password must be at least 6 characters' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ detail: 'Valid email required' });
  }

  const existing = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ detail: 'Username or email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: username.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  saveDb();

  const token = jwt.sign({ sub: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '90d' });
  const userRes = { id: user.id, username: user.username, email: user.email, created_at: user.createdAt };
  res.json({ token, user: userRes });
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ detail: 'Identifier and password required' });
  }

  const user = db.users.find(u => u.username.toLowerCase() === identifier.toLowerCase() || u.email.toLowerCase() === identifier.toLowerCase());
  if (!user) {
    return res.status(400).json({ detail: 'Invalid username/email or password' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(400).json({ detail: 'Invalid username/email or password' });
  }

  const token = jwt.sign({ sub: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '90d' });
  const userRes = { id: user.id, username: user.username, email: user.email, created_at: user.createdAt };
  res.json({ token, user: userRes });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.users.find(u => u.id === req.user.sub);
  if (!user) return res.status(404).json({ detail: 'User not found' });
  res.json({ user: { id: user.id, username: user.username, email: user.email, created_at: user.createdAt } });
});

// ==========================================
// 2. USER PLAYLISTS & LIBRARY
// ==========================================
app.get('/api/user/playlists', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const userPlaylists = db.playlists.filter(p => p.userId === userId);
  res.json({ playlists: userPlaylists });
});

app.post('/api/user/playlists', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const { title, description, thumbnail, id } = req.body;
  const newPlaylist = {
    id: id || `pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId,
    title: title || 'My Playlist',
    description: description || '',
    thumbnail: thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
    itemCount: 0,
    tracks: [],
    createdAt: new Date().toISOString()
  };

  db.playlists.push(newPlaylist);
  saveDb();
  res.json({ playlist: newPlaylist });
});

app.put('/api/user/playlists/:id', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const pl = db.playlists.find(p => p.id === req.params.id && p.userId === userId);
  if (!pl) return res.status(404).json({ detail: 'Playlist not found' });

  if (req.body.title !== undefined) pl.title = req.body.title;
  if (req.body.description !== undefined) pl.description = req.body.description;
  if (req.body.thumbnail !== undefined) pl.thumbnail = req.body.thumbnail;
  saveDb();
  res.json({ success: true, playlist: pl });
});

app.delete('/api/user/playlists/:id', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  db.playlists = db.playlists.filter(p => !(p.id === req.params.id && p.userId === userId));
  saveDb();
  res.json({ success: true });
});

app.post('/api/user/playlists/:id/tracks', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const pl = db.playlists.find(p => p.id === req.params.id && p.userId === userId);
  if (!pl) return res.status(404).json({ detail: 'Playlist not found' });

  const track = req.body;
  if (!track || !track.id) return res.status(400).json({ detail: 'Invalid track data' });

  if (!pl.tracks) pl.tracks = [];
  if (!pl.tracks.find(t => t.id === track.id)) {
    pl.tracks.push(track);
    pl.itemCount = pl.tracks.length;
    if (!pl.thumbnail || pl.thumbnail.includes('unsplash.com')) {
      pl.thumbnail = track.thumbnail || pl.thumbnail;
    }
    saveDb();
  }
  res.json({ success: true, count: pl.itemCount });
});

app.delete('/api/user/playlists/:id/tracks/:trackId', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const pl = db.playlists.find(p => p.id === req.params.id && p.userId === userId);
  if (!pl) return res.status(404).json({ detail: 'Playlist not found' });

  if (pl.tracks) {
    pl.tracks = pl.tracks.filter(t => t.id !== req.params.trackId);
    pl.itemCount = pl.tracks.length;
    saveDb();
  }
  res.json({ success: true, count: pl.itemCount });
});

// ==========================================
// 3. FAVORITES & HISTORY
// ==========================================
app.get('/api/user/favorites', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const favs = db.favorites[userId] || [];
  res.json({ favorites: favs });
});

app.post('/api/user/favorites', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const track = req.body;
  if (!track || !track.id) return res.status(400).json({ detail: 'Invalid track data' });

  if (!db.favorites[userId]) db.favorites[userId] = [];
  const list = db.favorites[userId];
  const idx = list.findIndex(t => t.id === track.id);
  let favorited = false;

  if (idx >= 0) {
    list.splice(idx, 1);
    favorited = false;
  } else {
    list.unshift(track);
    favorited = true;
  }
  saveDb();
  res.json({ favorited, count: list.length });
});

app.get('/api/user/history', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  res.json({ history: db.history[userId] || [] });
});

app.post('/api/user/history', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  const track = req.body;
  if (!track || !track.id) return res.json({ success: false });

  if (!db.history[userId]) db.history[userId] = [];
  db.history[userId] = db.history[userId].filter(t => t.id !== track.id);
  db.history[userId].unshift(track);
  if (db.history[userId].length > 50) db.history[userId].pop();
  saveDb();
  res.json({ success: true });
});

app.delete('/api/user/history', authenticateToken, (req, res) => {
  const userId = req.user.sub;
  db.history[userId] = [];
  saveDb();
  res.json({ success: true });
});

// ==========================================
// 4. MUSIC SEARCH & BROWSING (High-Res Scraper + API Fallback)
// ==========================================
async function scrapeSearch(query) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await res.text();
    const startIdx = html.indexOf('var ytInitialData = ');
    if (startIdx === -1) return [];
    const jsonStart = startIdx + 'var ytInitialData = '.length;
    const jsonEnd = html.indexOf(';</script>', jsonStart);
    if (jsonEnd === -1) return [];
    const data = JSON.parse(html.substring(jsonStart, jsonEnd));
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const items = [];
    for (const section of contents) {
      const renderers = section.itemSectionRenderer?.contents || [];
      for (const r of renderers) {
        const v = r.videoRenderer;
        if (v && v.videoId) {
          const durStr = v.lengthText?.simpleText || '0:00';
          let durSec = 0;
          if (durStr) {
            const parts = durStr.split(':').map(Number);
            durSec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : (parts[0] || 0) * 60 + (parts[1] || 0);
          }
          items.push({
            id: v.videoId,
            title: v.title?.runs?.[0]?.text || '',
            artist: v.ownerText?.runs?.[0]?.text || '',
            duration: durSec,
            durationFormatted: durStr,
            thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || '',
            type: 'song'
          });
        }
      }
    }
    return items;
  } catch (err) {
    console.error('YouTube scraper error:', err.message);
    return [];
  }
}

app.get('/api/home', async (req, res) => {
  let trending = [];

  // 1. Try YouTube Data API v3 if quota is available
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&chart=mostPopular&videoCategoryId=10&maxResults=16&key=${YOUTUBE_API_KEY}`;
    const ytRes = await fetch(url);
    const data = await ytRes.json();
    if (data.items && data.items.length > 0) {
      trending = data.items.map(item => {
        const dur = parseIsoDuration(item.contentDetails?.duration);
        return {
          id: item.id,
          title: item.snippet?.title || 'Unknown Title',
          artist: item.snippet?.channelTitle || 'Artist',
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
          duration: dur,
          durationFormatted: formatDuration(dur),
          type: 'song'
        };
      });
    }
  } catch {}

  // 2. Resilient Fallback: Scrape top hits if quota exceeded or empty
  if (!trending || trending.length === 0) {
    trending = await scrapeSearch('top hits trending songs 2026');
    if (trending.length > 16) trending = trending.slice(0, 16);
  }

  const shelves = [
    {
      title: 'Popular Playlists & Mixes',
      items: [
        {
          id: 'RDCLAK5uy_kmPRjFGN7YstCHdnuf3vqKcgG5wNIo',
          title: "Today's Hits",
          artist: 'Tides Music',
          thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
          type: 'playlist'
        },
        {
          id: 'RDCLAK5uy_kPX4GZqX9vP9iU8yQkFk0X8hLgK7Fv7eU',
          title: 'Chill & Lofi Beats',
          artist: 'Tides Music',
          thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&q=80',
          type: 'playlist'
        },
        {
          id: 'RDCLAK5uy_n9FBDqV6bF7R7W9nK0oM6pZ3a1kX2j9wE',
          title: 'Deep Focus',
          artist: 'Tides Music',
          thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&q=80',
          type: 'playlist'
        }
      ]
    }
  ];

  res.json({ trending, shelves });
});

app.get('/api/search', async (req, res) => {
  const query = req.query.q || '';
  if (!query.trim()) return res.json({ results: [] });

  // 1. Primary: Fast unlimited YouTube web search scraping (0 quota, instant)
  const scraped = await scrapeSearch(query);
  if (scraped.length > 0) {
    return res.json({ results: scraped });
  }

  // 2. Fallback: YouTube Data API v3 (if key has quota)
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=25&key=${YOUTUBE_API_KEY}`;
    const sRes = await fetch(searchUrl);
    const data = await sRes.json();
    if (data.items && data.items.length > 0) {
      const results = data.items.map(item => ({
        id: item.id?.videoId,
        title: item.snippet?.title || '',
        artist: item.snippet?.channelTitle || '',
        thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
        type: 'song'
      }));
      return res.json({ results, nextPageToken: data.nextPageToken });
    }
  } catch (err) {
    console.error('Search fallback error:', err.message);
  }

  res.json({ results: [] });
});

app.get('/api/playlist/:id', async (req, res) => {
  const playlistId = req.params.id;

  // Check if it's a user playlist first
  const userPl = db.playlists.find(p => p.id === playlistId);
  if (userPl) {
    return res.json({
      info: {
        id: userPl.id,
        title: userPl.title,
        description: userPl.description,
        thumbnail: userPl.thumbnail,
        itemCount: userPl.tracks?.length || 0
      },
      tracks: userPl.tracks || []
    });
  }

  // Fetch from YouTube Data API
  try {
    const pUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${YOUTUBE_API_KEY}`;
    const pRes = await fetch(pUrl);
    const pData = await pRes.json();
    const pItem = (pData.items || [])[0];

    const piUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}`;
    const piRes = await fetch(piUrl);
    const piData = await piRes.json();

    const videoIds = (piData.items || []).map(i => i.contentDetails?.videoId).filter(Boolean);
    let durationMap = {};
    if (videoIds.length > 0) {
      const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`;
      const vRes = await fetch(vUrl);
      const vData = await vRes.json();
      (vData.items || []).forEach(it => {
        durationMap[it.id] = parseIsoDuration(it.contentDetails?.duration);
      });
    }

    const tracks = (piData.items || []).map(item => {
      const vid = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      const dur = durationMap[vid] || 0;
      return {
        id: vid,
        title: item.snippet?.title || '',
        artist: item.snippet?.channelTitle || '',
        thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
        duration: dur,
        durationFormatted: formatDuration(dur),
        type: 'song'
      };
    });

    res.json({
      info: {
        id: playlistId,
        title: pItem?.snippet?.title || 'Playlist',
        description: pItem?.snippet?.description || '',
        thumbnail: pItem?.snippet?.thumbnails?.high?.url || '',
        itemCount: tracks.length
      },
      tracks
    });
  } catch (err) {
    res.json({ info: { id: playlistId, title: 'Playlist', thumbnail: '' }, tracks: [] });
  }
});

app.get('/api/upnext/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`;
    const sRes = await fetch(searchUrl);
    const data = await sRes.json();
    const tracks = (data.items || []).map(item => ({
      id: item.id?.videoId,
      title: item.snippet?.title || '',
      artist: item.snippet?.channelTitle || '',
      thumbnail: item.snippet?.thumbnails?.high?.url || '',
      type: 'song'
    }));
    res.json({ tracks });
  } catch {
    res.json({ tracks: [] });
  }
});

// ==========================================
// 5. LYRICS (LRCLIB & YouTube Fallback)
// ==========================================
app.get('/api/lyrics/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    // 1. Get video title & artist from YouTube Data API
    const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
    const vRes = await fetch(vUrl);
    const vData = await vRes.json();
    const item = (vData.items || [])[0];
    const rawTitle = item?.snippet?.title || '';
    const artist = item?.snippet?.channelTitle?.replace(/ - Topic|VEVO/g, '').trim() || '';

    // Clean title for lyrics match
    const cleanTitle = rawTitle
      .replace(/\(.*?\)|\[.*?\]/g, '')
      .replace(/ft\..*|feat\..*|official video|lyric video/gi, '')
      .trim();

    // 2. Fetch timestamped synced lyrics from LRCLIB
    const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(artist)}`;
    const lrcRes = await fetch(lrcUrl, { headers: { 'User-Agent': 'TidesMusic/1.0 (webd.tech)' } });

    if (lrcRes.ok) {
      const lrcData = await lrcRes.json();
      if (lrcData.syncedLyrics) {
        return res.json({ available: true, lyrics: lrcData.syncedLyrics, source: 'LRCLIB (Synced)' });
      }
      if (lrcData.plainLyrics) {
        return res.json({ available: true, lyrics: lrcData.plainLyrics, source: 'LRCLIB' });
      }
    }

    // Secondary search on LRCLIB
    const searchLrc = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`;
    const slRes = await fetch(searchLrc, { headers: { 'User-Agent': 'TidesMusic/1.0 (webd.tech)' } });
    if (slRes.ok) {
      const items = await slRes.json();
      if (items && items.length > 0) {
        const top = items[0];
        return res.json({
          available: true,
          lyrics: top.syncedLyrics || top.plainLyrics || 'Lyrics unavailable',
          source: 'LRCLIB'
        });
      }
    }

    res.json({ available: false, lyrics: 'Lyrics not available for this track.' });
  } catch (err) {
    res.json({ available: false, lyrics: 'Lyrics could not be loaded.' });
  }
});

// ==========================================
// 6. HIGH-PERFORMANCE AUDIO STREAM PROXY (yt-dlp Bot-Bypass Engine)
// ==========================================
const streamCache = new Map(); // videoId -> { url, expiresAt }

function getYtDlpBin() {
  const isWin = process.platform === 'win32';
  const candidates = [
    path.join(__dirname, 'node_modules', '@distube', 'yt-dlp', 'bin', isWin ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(__dirname, 'bin', isWin ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(__dirname, '.venv', 'Scripts', 'yt-dlp.exe'),
    isWin ? 'yt-dlp.exe' : 'yt-dlp'
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return isWin ? 'yt-dlp.exe' : 'yt-dlp';
}

function ensureYtDlpBinary() {
  const isWin = process.platform === 'win32';
  const binDir = path.join(__dirname, 'bin');
  const targetBin = path.join(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');

  if (fs.existsSync(targetBin)) return Promise.resolve(targetBin);
  const candidate = getYtDlpBin();
  if (fs.existsSync(candidate)) return Promise.resolve(candidate);

  if (!fs.existsSync(binDir)) {
    try { fs.mkdirSync(binDir, { recursive: true }); } catch {}
  }

  const binaryUrl = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  return new Promise((resolve) => {
    function fetchBin(url) {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchBin(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return resolve(candidate);
        }
        const stream = fs.createWriteStream(targetBin);
        res.pipe(stream);
        stream.on('finish', () => {
          stream.close(() => {
            if (!isWin) {
              try { fs.chmodSync(targetBin, 0o755); } catch {}
            }
            console.log('yt-dlp binary downloaded successfully to:', targetBin);
            resolve(targetBin);
          });
        });
      }).on('error', () => resolve(candidate));
    }
    fetchBin(binaryUrl);
  });
}

// Proactively verify / download yt-dlp in the background
ensureYtDlpBinary();

function resolveStreamUrl(videoId) {
  const cached = streamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.url);
  }

  return new Promise((resolve, reject) => {
    const bin = getYtDlpBin();
    if (process.platform !== 'win32' && fs.existsSync(bin)) {
      try { fs.chmodSync(bin, 0o755); } catch {}
    }

    execFile(bin, [
      '--no-warnings',
      '--no-playlist',
      '--extractor-args', 'youtube:player_client=android,ios,mweb',
      '-f', 'bestaudio/best',
      '--get-url',
      `https://www.youtube.com/watch?v=${videoId}`
    ], { timeout: 20000 }, (err, stdout) => {
      if (err) {
        // Fallback: search query resolution
        execFile(bin, [
          '--no-warnings',
          '--no-playlist',
          '--extractor-args', 'youtube:player_client=android,ios,mweb',
          '-f', 'bestaudio/best',
          '--get-url',
          `ytsearch1:${videoId} audio`
        ], { timeout: 20000 }, (err2, stdout2) => {
          if (err2) return reject(err2);
          const u2 = (stdout2 || '').trim().split('\n')[0];
          if (!u2 || !u2.startsWith('http')) return reject(new Error('No stream URL extracted'));
          streamCache.set(videoId, { url: u2, expiresAt: Date.now() + 3600 * 1000 });
          resolve(u2);
        });
        return;
      }

      const u = (stdout || '').trim().split('\n')[0];
      if (!u || !u.startsWith('http')) return reject(new Error('No stream URL extracted'));
      streamCache.set(videoId, { url: u, expiresAt: Date.now() + 3600 * 1000 });
      resolve(u);
    });
  });
}

app.get('/api/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;

  try {
    const streamUrl = await resolveStreamUrl(videoId);

    // Forward range request to GoogleVideo
    const headers = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    const audioReq = https.get(streamUrl, { headers }, (audioRes) => {
      res.writeHead(audioRes.statusCode, {
        'Content-Type': audioRes.headers['content-type'] || 'audio/mp4',
        'Content-Length': audioRes.headers['content-length'],
        'Content-Range': audioRes.headers['content-range'],
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });
      audioRes.pipe(res);
    });

    audioReq.on('error', (err) => {
      console.error('Audio stream pipe error:', err.message);
      if (!res.headersSent) res.status(502).json({ detail: 'Failed to stream audio' });
    });
  } catch (err) {
    console.error('Audio stream error for video', videoId, ':', err.message);
    res.status(500).json({ detail: 'Failed to resolve audio stream' });
  }
});

// ==========================================
// 7. REAL-TIME JAM SESSIONS (REST + WEBSOCKETS)
// ==========================================
const jamSessions = new Map();

app.post('/api/jam/create', optionalAuth, (req, res) => {
  const hostId = req.user?.sub || req.body?.user_id || `user_${Math.random().toString(36).substring(2, 8)}`;
  const hostName = req.user?.username || req.body?.user_name || 'Host Listener';
  const jamId = Math.random().toString(36).substring(2, 8).toUpperCase();

  const session = {
    id: jamId,
    hostId,
    hostName,
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    queue: [],
    participants: new Map(),
    createdAt: Date.now()
  };

  jamSessions.set(jamId, session);
  res.json({
    jam_id: jamId,
    host_id: hostId,
    host_name: hostName,
    share_url: `/jam/${jamId}`
  });
});

app.get('/api/jam/:jamId', (req, res) => {
  const session = jamSessions.get(req.params.jamId.toUpperCase());
  if (!session) return res.status(404).json({ detail: 'Jam session not found or expired' });

  res.json({
    jam_id: session.id,
    host_id: session.hostId,
    host_name: session.hostName,
    is_playing: session.isPlaying,
    current_track: session.currentTrack,
    current_time: session.currentTime,
    participant_count: session.participants.size
  });
});

// WebSocket Server for Jam
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname.startsWith('/ws/jam/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const jamId = url.pathname.split('/').pop().toUpperCase();
  const userId = url.searchParams.get('user_id') || `anon_${Math.random().toString(36).substring(2, 6)}`;
  const userName = url.searchParams.get('user_name') || 'Guest Listener';

  let session = jamSessions.get(jamId);
  if (!session) {
    session = {
      id: jamId,
      hostId: userId,
      hostName: userName,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      queue: [],
      participants: new Map(),
      createdAt: Date.now()
    };
    jamSessions.set(jamId, session);
  }

  const participant = { id: userId, name: userName, isHost: session.hostId === userId, ws };
  session.participants.set(userId, participant);

  function broadcast(data) {
    const msg = JSON.stringify(data);
    for (const p of session.participants.values()) {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(msg);
      }
    }
  }

  function getParticipantsList() {
    return Array.from(session.participants.values()).map(p => ({
      user_id: p.id,
      name: p.name,
      is_host: p.isHost
    }));
  }

  // Send initial sync state to newcomer
  ws.send(JSON.stringify({
    type: 'SYNC_STATE',
    state: {
      jam_id: session.id,
      host_id: session.hostId,
      host_name: session.hostName,
      current_track: session.currentTrack,
      is_playing: session.isPlaying,
      current_time: session.currentTime,
      queue: session.queue,
      participants: getParticipantsList()
    }
  }));

  // Notify everyone a new listener joined
  broadcast({
    type: 'USER_JOINED',
    user_id: userId,
    user_name: userName,
    state: { participants: getParticipantsList() }
  });

  ws.on('message', (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw);
      const action = data.action;

      if (action === 'PLAY') {
        session.isPlaying = true;
        if (data.track) session.currentTrack = data.track;
        if (data.currentTime !== undefined) session.currentTime = data.currentTime;
        broadcast({
          type: 'PLAYBACK_UPDATE',
          action: 'PLAY',
          track: session.currentTrack,
          is_playing: true,
          current_time: session.currentTime,
          sender_id: userId
        });
      } else if (action === 'PAUSE') {
        session.isPlaying = false;
        if (data.currentTime !== undefined) session.currentTime = data.currentTime;
        broadcast({
          type: 'PLAYBACK_UPDATE',
          action: 'PAUSE',
          track: session.currentTrack,
          is_playing: false,
          current_time: session.currentTime,
          sender_id: userId
        });
      } else if (action === 'SEEK') {
        session.currentTime = data.currentTime || 0;
        broadcast({
          type: 'PLAYBACK_UPDATE',
          action: 'SEEK',
          current_time: session.currentTime,
          is_playing: session.isPlaying,
          sender_id: userId
        });
      } else if (action === 'CHANGE_TRACK') {
        session.currentTrack = data.track;
        session.currentTime = 0;
        session.isPlaying = true;
        broadcast({
          type: 'PLAYBACK_UPDATE',
          action: 'CHANGE_TRACK',
          track: session.currentTrack,
          current_time: 0,
          is_playing: true,
          sender_id: userId
        });
      } else if (action === 'REACTION') {
        broadcast({
          type: 'REACTION',
          emoji: data.emoji || '🔥',
          user_name: userName,
          sender_id: userId
        });
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err.message);
    }
  });

  ws.on('close', () => {
    session.participants.delete(userId);
    broadcast({
      type: 'USER_LEFT',
      user_id: userId,
      user_name: userName,
      state: { participants: getParticipantsList() }
    });
    if (session.participants.size === 0) {
      setTimeout(() => {
        if (session.participants.size === 0) {
          jamSessions.delete(jamId);
        }
      }, 180000); // 3 minutes grace period
    }
  });
});

// ==========================================
// 8. SERVE FRONTEND STATIC FILES (SPA)
// ==========================================
const distPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('<h1>Tides Music Server is Running</h1><p>Build the frontend using: <code>cd frontend && npm install && npm run build</code></p>');
  });
}

// Health check endpoint for hostinger & uptime monitors
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Start Server
if (typeof PhusionPassenger !== 'undefined') {
  server.listen('passenger');
} else {
  const port = process.env.PORT || 8000;
  server.listen(port, () => {
    console.log(`🌊 Tides Music Server is running on port ${port}`);
  });
}

module.exports = app;
