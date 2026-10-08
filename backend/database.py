import os
import sqlite3
import uuid
from typing import Any, Dict, List, Optional
from backend.config import settings

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.DATABASE_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    """Initializes the database schema."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        thumbnail TEXT DEFAULT '',
        is_local INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        thumbnail TEXT DEFAULT '',
        duration INTEGER DEFAULT 0,
        duration_formatted TEXT DEFAULT '0:00',
        position INTEGER DEFAULT 0,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_favorites (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        thumbnail TEXT DEFAULT '',
        duration INTEGER DEFAULT 0,
        duration_formatted TEXT DEFAULT '0:00',
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, track_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        thumbnail TEXT DEFAULT '',
        duration INTEGER DEFAULT 0,
        duration_formatted TEXT DEFAULT '0:00',
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)
    conn.commit()
    conn.close()

# User Helpers
def create_user(username: str, email: str, password_hash: str) -> Dict[str, Any]:
    user_id = str(uuid.uuid4())
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
            (user_id, username.strip(), email.strip().lower(), password_hash)
        )
        conn.commit()
        return {"id": user_id, "username": username.strip(), "email": email.strip().lower()}
    finally:
        conn.close()

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT id, username, email, created_at FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def get_user_by_username_or_email(identifier: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        ident = identifier.strip().lower()
        cursor = conn.execute(
            "SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?",
            (ident, ident)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

# Playlist Helpers
def get_user_playlists(user_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cursor = conn.execute(
            "SELECT id, title, description, thumbnail, is_local, created_at FROM playlists WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        playlists = [dict(row) for row in cursor.fetchall()]

        for pl in playlists:
            track_cursor = conn.execute(
                "SELECT track_id as id, title, artist, thumbnail, duration, duration_formatted as durationFormatted FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, added_at ASC",
                (pl["id"],)
            )
            pl["tracks"] = [dict(tr) for tr in track_cursor.fetchall()]
            pl["itemCount"] = len(pl["tracks"])
            if not pl.get("thumbnail") and pl["tracks"]:
                pl["thumbnail"] = pl["tracks"][0]["thumbnail"]
        return playlists
    finally:
        conn.close()

def create_user_playlist(playlist_id: str, user_id: str, title: str, description: str = "", thumbnail: str = "") -> Dict[str, Any]:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO playlists (id, user_id, title, description, thumbnail) VALUES (?, ?, ?, ?, ?)",
            (playlist_id, user_id, title, description, thumbnail)
        )
        conn.commit()
        return {
            "id": playlist_id,
            "title": title,
            "description": description,
            "thumbnail": thumbnail,
            "tracks": [],
            "itemCount": 0
        }
    finally:
        conn.close()

def update_user_playlist(playlist_id: str, user_id: str, title: str, description: Optional[str] = None, thumbnail: Optional[str] = None):
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE playlists SET title = ?, description = COALESCE(?, description), thumbnail = COALESCE(?, thumbnail), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (title, description, thumbnail, playlist_id, user_id)
        )
        conn.commit()
    finally:
        conn.close()

def delete_user_playlist(playlist_id: str, user_id: str):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM playlists WHERE id = ? AND user_id = ?", (playlist_id, user_id))
        conn.commit()
    finally:
        conn.close()

def add_track_to_playlist(playlist_id: str, user_id: str, track: Dict[str, Any]):
    conn = get_connection()
    try:
        # Verify ownership
        cursor = conn.execute("SELECT id, thumbnail FROM playlists WHERE id = ? AND user_id = ?", (playlist_id, user_id))
        pl = cursor.fetchone()
        if not pl:
            return False

        # Check if track already in playlist
        existing = conn.execute(
            "SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
            (playlist_id, track["id"])
        ).fetchone()
        if existing:
            return True

        # Get count for position
        pos = conn.execute("SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,)).fetchone()[0]

        track_row_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO playlist_tracks (id, playlist_id, track_id, title, artist, thumbnail, duration, duration_formatted, position)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                track_row_id,
                playlist_id,
                track["id"],
                track.get("title", ""),
                track.get("artist", ""),
                track.get("thumbnail", ""),
                track.get("duration", 0),
                track.get("durationFormatted", "0:00"),
                pos
            )
        )
        # Update playlist thumbnail if empty
        if not pl["thumbnail"] and track.get("thumbnail"):
            conn.execute("UPDATE playlists SET thumbnail = ? WHERE id = ?", (track.get("thumbnail"), playlist_id))

        conn.commit()
        return True
    finally:
        conn.close()

def remove_track_from_playlist(playlist_id: str, track_id: str, user_id: str):
    conn = get_connection()
    try:
        # Verify ownership
        cursor = conn.execute("SELECT id FROM playlists WHERE id = ? AND user_id = ?", (playlist_id, user_id))
        if not cursor.fetchone():
            return False

        conn.execute("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?", (playlist_id, track_id))
        conn.commit()
        return True
    finally:
        conn.close()

# Favorites Helpers
def get_user_favorites(user_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cursor = conn.execute(
            """SELECT track_id as id, title, artist, thumbnail, duration, duration_formatted as durationFormatted
               FROM user_favorites WHERE user_id = ? ORDER BY added_at DESC""",
            (user_id,)
        )
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()

def toggle_user_favorite(user_id: str, track: Dict[str, Any]) -> bool:
    """Toggles favorite. Returns True if now favored, False if removed."""
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM user_favorites WHERE user_id = ? AND track_id = ?",
            (user_id, track["id"])
        ).fetchone()

        if existing:
            conn.execute("DELETE FROM user_favorites WHERE user_id = ? AND track_id = ?", (user_id, track["id"]))
            conn.commit()
            return False
        else:
            row_id = str(uuid.uuid4())
            conn.execute(
                """INSERT INTO user_favorites (id, user_id, track_id, title, artist, thumbnail, duration, duration_formatted)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    row_id,
                    user_id,
                    track["id"],
                    track.get("title", ""),
                    track.get("artist", ""),
                    track.get("thumbnail", ""),
                    track.get("duration", 0),
                    track.get("durationFormatted", "0:00")
                )
            )
            conn.commit()
            return True
    finally:
        conn.close()

# History Helpers
def get_user_history(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cursor = conn.execute(
            """SELECT track_id as id, title, artist, thumbnail, duration, duration_formatted as durationFormatted
               FROM user_history WHERE user_id = ? ORDER BY played_at DESC LIMIT ?""",
            (user_id, limit)
        )
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()

def add_user_history(user_id: str, track: Dict[str, Any]):
    conn = get_connection()
    try:
        # Delete prior entry for same track to keep history fresh
        conn.execute("DELETE FROM user_history WHERE user_id = ? AND track_id = ?", (user_id, track["id"]))
        row_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO user_history (id, user_id, track_id, title, artist, thumbnail, duration, duration_formatted)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                row_id,
                user_id,
                track["id"],
                track.get("title", ""),
                track.get("artist", ""),
                track.get("thumbnail", ""),
                track.get("duration", 0),
                track.get("durationFormatted", "0:00")
            )
        )
        conn.commit()
    finally:
        conn.close()

def clear_user_history(user_id: str):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM user_history WHERE user_id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()
