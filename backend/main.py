import asyncio
import json
import os
import random
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import httpx

from backend.auth import create_access_token, decode_access_token, get_current_user, get_optional_user, hash_password, verify_password
from backend.config import settings
from backend.jam import jam_manager
from backend.database import (
    add_batch_tracks_to_playlist,
    add_track_to_playlist,
    add_user_history,
    clear_user_history,
    create_password_reset_code,
    create_rolling_backup,
    create_user,
    create_user_playlist,
    delete_user_playlist,
    export_disaster_recovery_snapshot,
    export_full_database_json,
    get_playlist_by_id,
    get_user_by_id,
    get_user_by_username_or_email,
    get_user_favorites,
    get_user_history,
    get_user_playlists,
    import_full_database_json,
    init_db,
    remove_track_from_playlist,
    save_shared_playlist,
    sync_full_user_library,
    toggle_user_favorite,
    update_user_password,
    update_user_playlist,
    verify_and_consume_reset_code,
)
from backend.email_service import send_password_reset_email
from backend.yt_service import youtube_service

# Initialize Database Schema, Migrations and Automated Backups
init_db()

app = FastAPI(
    title="Tides Music API",
    description="Tides Music - High-Fidelity Web & Desktop Streaming API with Persistent Auth, Cloud Sync, and Background Audio Streaming."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    identifier: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    newPassword: str

class TrackPayload(BaseModel):
    id: str
    title: str
    artist: Optional[str] = "Unknown Artist"
    thumbnail: Optional[str] = ""
    duration: Optional[int] = 0
    durationFormatted: Optional[str] = "0:00"

class CreatePlaylistRequest(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = ""
    thumbnail: Optional[str] = ""
    tracks: Optional[List[TrackPayload]] = None

class UpdatePlaylistRequest(BaseModel):
    title: str
    description: Optional[str] = None
    thumbnail: Optional[str] = None

class BatchTracksRequest(BaseModel):
    tracks: List[TrackPayload]

class PublishPlaylistRequest(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = ""
    thumbnail: Optional[str] = ""
    tracks: Optional[List[TrackPayload]] = []
    author: Optional[str] = "Tides Creator"

class SyncLibraryRequest(BaseModel):
    localPlaylists: Optional[List[Dict[str, Any]]] = []
    localFavorites: Optional[List[Dict[str, Any]]] = []
    localHistory: Optional[List[Dict[str, Any]]] = []

# --- Authentication Endpoints ---

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    if len(req.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if "@" not in req.email or "." not in req.email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    existing = get_user_by_username_or_email(req.username) or get_user_by_username_or_email(req.email)
    if existing:
        raise HTTPException(status_code=400, detail="Username or email is already registered")

    pw_hash = hash_password(req.password)
    user = create_user(username=req.username, email=req.email, password_hash=pw_hash)
    token = create_access_token({"sub": user["id"], "username": user["username"], "email": user["email"]})
    return {"token": token, "user": user}

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = get_user_by_username_or_email(req.identifier)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid username/email or password")

    user_data = {"id": user["id"], "username": user["username"], "email": user["email"]}
    token = create_access_token({"sub": user["id"], "username": user["username"], "email": user["email"]})
    return {"token": token, "user": user_data}

@app.get("/api/auth/me")
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {"user": current_user}

@app.post("/api/auth/forgot-password")
async def forgot_password_endpoint(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    user = get_user_by_username_or_email(email)
    if not user:
        return {"success": True, "message": "If this email is registered, a 6-digit verification code has been sent."}

    # Generate secure 6-digit verification code
    code = f"{random.randint(100000, 999999)}"
    create_password_reset_code(email, code, expires_minutes=15)

    # Dispatch email via Hostinger SMTP (smtp.hostinger.com)
    result = send_password_reset_email(email, code)
    return result

@app.post("/api/auth/reset-password")
async def reset_password_endpoint(req: ResetPasswordRequest):
    email = req.email.strip().lower()
    code = req.code.strip()
    if len(req.newPassword) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    valid = verify_and_consume_reset_code(email, code)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code. Please request a new code.")

    pw_hash = hash_password(req.newPassword)
    updated = update_user_password(email, pw_hash)
    if not updated:
        raise HTTPException(status_code=404, detail="User account not found")

    return {"success": True, "message": "Password successfully reset! You can now log in with your new password."}

# --- Cloud-Synced User Playlists (Hostinger Persistence) ---

@app.get("/api/user/playlists")
async def list_user_playlists(current_user: Dict[str, Any] = Depends(get_current_user)):
    playlists = get_user_playlists(current_user["id"])
    return {"playlists": playlists}

@app.post("/api/user/playlists")
async def create_playlist_endpoint(
    req: CreatePlaylistRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    pid = req.id or f"pl-{uuid.uuid4()}"
    tracks_data = [t.model_dump() for t in req.tracks] if req.tracks else None
    pl = create_user_playlist(
        playlist_id=pid,
        user_id=current_user["id"],
        title=req.title.strip(),
        description=req.description or "",
        thumbnail=req.thumbnail or "",
        tracks=tracks_data
    )
    return {"playlist": pl}

@app.put("/api/user/playlists/{playlist_id}")
async def update_playlist_endpoint(
    playlist_id: str,
    req: UpdatePlaylistRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    update_user_playlist(
        playlist_id=playlist_id,
        user_id=current_user["id"],
        title=req.title.strip(),
        description=req.description,
        thumbnail=req.thumbnail
    )
    return {"status": "ok"}

@app.delete("/api/user/playlists/{playlist_id}")
async def delete_playlist_endpoint(
    playlist_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    delete_user_playlist(playlist_id=playlist_id, user_id=current_user["id"])
    return {"status": "ok"}

@app.post("/api/user/playlists/{playlist_id}/tracks")
async def add_track_endpoint(
    playlist_id: str,
    req: TrackPayload,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    success = add_track_to_playlist(
        playlist_id=playlist_id,
        user_id=current_user["id"],
        track=req.model_dump()
    )
    if not success:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"status": "ok"}

@app.post("/api/user/playlists/{playlist_id}/batch-tracks")
async def batch_add_tracks_endpoint(
    playlist_id: str,
    req: BatchTracksRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    count = add_batch_tracks_to_playlist(
        playlist_id=playlist_id,
        user_id=current_user["id"],
        tracks=[t.model_dump() for t in req.tracks]
    )
    return {"status": "ok", "addedCount": count}

@app.delete("/api/user/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_endpoint(
    playlist_id: str,
    track_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    remove_track_from_playlist(
        playlist_id=playlist_id,
        track_id=track_id,
        user_id=current_user["id"]
    )
    return {"status": "ok"}

@app.post("/api/playlist/share")
@app.post("/api/playlist/publish")
async def share_playlist_endpoint(
    req: PublishPlaylistRequest,
    authorization: Optional[str] = Header(None)
):
    user_id = None
    author = req.author or "Tides Creator"
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")
            if payload.get("username"):
                author = payload.get("username")

    pid = req.id
    if not pid or pid.startswith("local-pl-"):
        pid = f"pl-{uuid.uuid4().hex[:12]}"

    tracks_data = [t.model_dump() for t in req.tracks] if req.tracks else []
    pl = save_shared_playlist(
        playlist_id=pid,
        title=req.title.strip(),
        description=req.description or "",
        thumbnail=req.thumbnail or "",
        tracks=tracks_data,
        user_id=user_id,
        author=author
    )
    return {
        "status": "ok",
        "id": pid,
        "playlist": pl,
        "shareUrl": f"/?playlist={pid}"
    }

# --- Full User Library Sync (Merges Guest Playlists on Sign In) ---

@app.post("/api/user/sync")
async def sync_library_endpoint(
    req: SyncLibraryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    result = sync_full_user_library(
        user_id=current_user["id"],
        local_playlists=req.localPlaylists or [],
        local_favorites=req.localFavorites or [],
        local_history=req.localHistory or []
    )
    return result

# --- Database Backup & Admin Disaster Recovery ---

@app.get("/api/admin/export-database")
async def export_database_endpoint():
    data = export_full_database_json()
    return data

@app.post("/api/admin/restore-database")
async def restore_database_endpoint(req: Dict[str, Any]):
    counts = import_full_database_json(req)
    return {"status": "ok", "restored": counts}

@app.get("/api/admin/database-status")
async def database_status_endpoint():
    db_path = settings.DATABASE_PATH
    exists = os.path.exists(db_path)
    size_bytes = os.path.getsize(db_path) if exists else 0
    return {
        "status": "healthy",
        "databasePath": db_path,
        "exists": exists,
        "sizeBytes": size_bytes,
        "backupAvailable": os.path.exists(os.path.join(os.path.dirname(db_path), "tides_disaster_recovery.json"))
    }

# --- Cloud-Synced User Favorites & History ---

@app.get("/api/user/favorites")
async def list_favorites(current_user: Dict[str, Any] = Depends(get_current_user)):
    favs = get_user_favorites(current_user["id"])
    return {"favorites": favs}

@app.post("/api/user/favorites")
async def toggle_favorite_endpoint(
    req: TrackPayload,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    is_fav = toggle_user_favorite(current_user["id"], req.model_dump())
    return {"favorited": is_fav}

@app.get("/api/user/history")
async def list_history(current_user: Dict[str, Any] = Depends(get_current_user)):
    history = get_user_history(current_user["id"])
    return {"history": history}

@app.post("/api/user/history")
async def add_history_endpoint(
    req: TrackPayload,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    add_user_history(current_user["id"], req.model_dump())
    return {"status": "ok"}

@app.delete("/api/user/history")
async def clear_history_endpoint(current_user: Dict[str, Any] = Depends(get_current_user)):
    clear_user_history(current_user["id"])
    return {"status": "ok"}

# --- YouTube & Music Streaming Endpoints ---

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "Tides Music Web & Desktop Player"}

@app.get("/api/search")
async def search(
    q: str = Query(..., description="Search query string"),
    type: str = Query("all", description="Search filter: all, songs, playlists"),
    pageToken: Optional[str] = Query(None, description="Page token for pagination")
):
    try:
        data = await youtube_service.search(query=q, search_type=type, page_token=pageToken)
        return data
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "results": []})

@app.get("/api/home")
async def get_home():
    try:
        data = await youtube_service.get_home_feed()
        return data
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "shelves": []})

@app.get("/api/playlist/{playlist_id}")
async def get_playlist(playlist_id: str):
    try:
        clean_id = playlist_id.strip()

        # 1. Check if it's an app user or shared playlist in our SQLite database
        local_pl = get_playlist_by_id(clean_id)
        if local_pl:
            return {
                "info": {
                    "id": local_pl["id"],
                    "title": local_pl["title"],
                    "description": local_pl.get("description", ""),
                    "thumbnail": local_pl.get("thumbnail", ""),
                    "author": local_pl.get("author") or "Tides Creator",
                    "itemCount": local_pl.get("itemCount", len(local_pl.get("tracks", []))),
                    "isAppPlaylist": True
                },
                "tracks": local_pl.get("tracks", [])
            }

        # 2. Check Spotify playlist
        if clean_id.startswith("spotify:") or clean_id.startswith("spotify_") or "open.spotify.com" in clean_id or (len(clean_id) == 22 and not "_" in clean_id and not "-" in clean_id):
            data = await youtube_service.get_spotify_playlist(clean_id)
            return data

        # 3. Fallback to YouTube Music playlist
        data = await youtube_service.get_playlist(clean_id)
        return data
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "tracks": []})

@app.get("/api/upnext/{video_id}")
async def get_up_next(video_id: str):
    try:
        tracks = await youtube_service.get_up_next(video_id)
        return {"tracks": tracks}
    except Exception as e:
        return {"tracks": []}

@app.get("/api/lyrics/{video_id}")
async def get_lyrics(video_id: str):
    try:
        lyrics = await youtube_service.get_lyrics(video_id)
        return lyrics
    except Exception as e:
        return {"available": False, "lyrics": "Lyrics unavailable"}

@app.get("/api/stream-info/{video_id}")
async def get_stream_info(video_id: str):
    try:
        info = await youtube_service.get_stream_info(video_id)
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stream/{video_id}")
async def stream_audio(
    video_id: str,
    request: Request,
    range: Optional[str] = Header(None)
):
    """
    Audio streaming proxy endpoint with full HTTP Range request (RFC 7233) support.
    Streams directly to HTML5 <audio> tag for native background playback and lockscreen media controls.
    """
    try:
        info = await youtube_service.get_stream_info(video_id)
        stream_url = info.get("url")
        if not stream_url:
            raise HTTPException(status_code=404, detail="Audio stream not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve audio stream: {e}")

    upstream_headers = {}
    if range:
        upstream_headers["Range"] = range

    client = httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(connect=10.0, read=None, write=10.0, pool=None))
    try:
        upstream_req = client.build_request("GET", stream_url, headers=upstream_headers)
        upstream_res = await client.send(upstream_req, stream=True)
    except Exception as e:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Upstream stream error: {e}")

    downstream_headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": upstream_res.headers.get("content-type", "audio/mp4"),
        "Cache-Control": "public, max-age=3600"
    }
    if "content-length" in upstream_res.headers:
        downstream_headers["Content-Length"] = upstream_res.headers["content-length"]
    if "content-range" in upstream_res.headers:
        downstream_headers["Content-Range"] = upstream_res.headers["content-range"]

    async def stream_iterator():
        try:
            async for chunk in upstream_res.aiter_bytes(chunk_size=65536):
                if await request.is_disconnected():
                    break
                yield chunk
        finally:
            await upstream_res.aclose()
            await client.aclose()

    return StreamingResponse(
        stream_iterator(),
        status_code=upstream_res.status_code,
        headers=downstream_headers
    )

# --- Real-Time Spotify Jam Endpoints ---

class CreateJamRequest(BaseModel):
    user_id: Optional[str] = None
    user_name: Optional[str] = None

@app.post("/api/jam/create")
async def create_jam_endpoint(req: CreateJamRequest):
    uid = req.user_id or f"user-{uuid.uuid4().hex[:6]}"
    uname = req.user_name or "Host"
    session = jam_manager.create_session(uid, uname)
    return {
        "jam_id": session.jam_id,
        "state": session.to_state_dict()
    }

@app.get("/api/jam/{jam_id}")
async def get_jam_endpoint(jam_id: str):
    session = jam_manager.get_session(jam_id)
    if not session:
        raise HTTPException(status_code=404, detail="Jam session not found")
    return {"state": session.to_state_dict()}

@app.websocket("/ws/jam/{jam_id}")
async def jam_websocket_endpoint(websocket: WebSocket, jam_id: str):
    await websocket.accept()
    query_params = dict(websocket.query_params)
    user_id = query_params.get("user_id") or f"user-{uuid.uuid4().hex[:6]}"
    user_name = query_params.get("user_name") or f"Listener {random.randint(100, 999)}"

    session = jam_manager.get_session(jam_id)
    if not session:
        # If joining a fresh session code, create it on demand
        clean_code = jam_id.strip().upper()
        session = jam_manager.create_session(user_id, user_name)
        session.jam_id = clean_code
        jam_manager.sessions[clean_code] = session

    await jam_manager.register_connection(session.jam_id, websocket, user_id, user_name)

    # Send full current state to newly joined user
    await websocket.send_text(json.dumps({
        "type": "SYNC_STATE",
        "state": session.to_state_dict()
    }))

    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
            except Exception:
                continue

            msg_type = data.get("type")

            if msg_type == "PLAY_TRACK":
                track = data.get("track")
                session.current_track = track
                session.is_playing = True
                session.current_time = float(data.get("start_time", 0.0))
                session.last_update_ts = time.time()
                if "queue" in data and isinstance(data["queue"], list):
                    session.queue = data["queue"]
                    session.queue_index = data.get("queue_index", 0)
                await session.broadcast({
                    "type": "PLAY_TRACK",
                    "track": track,
                    "is_playing": True,
                    "current_time": session.current_time,
                    "queue": session.queue,
                    "queue_index": session.queue_index,
                    "sender_id": user_id
                })

            elif msg_type == "TOGGLE_PLAY":
                session.is_playing = bool(data.get("is_playing", not session.is_playing))
                session.current_time = float(data.get("current_time", session.get_estimated_current_time()))
                session.last_update_ts = time.time()
                await session.broadcast({
                    "type": "TOGGLE_PLAY",
                    "is_playing": session.is_playing,
                    "current_time": session.current_time,
                    "sender_id": user_id
                })

            elif msg_type == "SEEK":
                session.current_time = float(data.get("current_time", 0.0))
                session.last_update_ts = time.time()
                await session.broadcast({
                    "type": "SEEK",
                    "current_time": session.current_time,
                    "sender_id": user_id
                })

            elif msg_type == "ADD_TO_QUEUE":
                track = data.get("track")
                if track:
                    session.queue.append(track)
                    await session.broadcast({
                        "type": "QUEUE_UPDATED",
                        "queue": session.queue,
                        "sender_id": user_id
                    })

            elif msg_type == "REACTION":
                emoji = data.get("emoji", "❤️")
                await session.broadcast({
                    "type": "REACTION",
                    "emoji": emoji,
                    "user_name": user_name,
                    "sender_id": user_id
                })

    except WebSocketDisconnect:
        await jam_manager.unregister_connection(session.jam_id, websocket, user_id)
    except Exception:
        await jam_manager.unregister_connection(session.jam_id, websocket, user_id)

# Direct App Downloads
downloads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "downloads"))

@app.get("/downloads/TidesMusic.apk")
@app.get("/download/apk")
async def download_apk():
    apk_path = os.path.join(downloads_dir, "TidesMusic.apk")
    if os.path.exists(apk_path):
        return FileResponse(
            path=apk_path,
            filename="TidesMusic.apk",
            media_type="application/vnd.android.package-archive"
        )
    from starlette.responses import RedirectResponse
    return RedirectResponse(url="https://github.com/hatimmustafa7869-dot/tidesmusic/releases/download/v1.0.0/TidesMusic.apk")

@app.get("/downloads/TidesMusic-Setup.exe")
@app.get("/download/pc")
async def download_pc():
    exe_path = os.path.join(downloads_dir, "TidesMusic-Setup.exe")
    if os.path.exists(exe_path):
        return FileResponse(
            path=exe_path,
            filename="TidesMusic-Setup.exe",
            media_type="application/octet-stream"
        )
    raise HTTPException(status_code=404, detail="Setup file not found")

# Mount frontend/dist if available so the whole app runs from a single unified server
dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

@app.get("/playlist/{playlist_id}")
async def serve_playlist_spa(playlist_id: str):
    index_file = os.path.join(dist_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    from starlette.responses import RedirectResponse
    return RedirectResponse(f"/?playlist={playlist_id}")

if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
