import json
import logging
import os
import shutil
import sqlite3
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from backend.config import settings

logger = logging.getLogger("tides.database")

def get_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with WAL mode and directory auto-creation."""
    db_path = settings.DATABASE_PATH
    db_dir = os.path.dirname(os.path.abspath(db_path))
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(db_path, timeout=20.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

def get_data_dir() -> str:
    """Returns the dedicated data directory for backups and disaster recovery."""
    db_dir = os.path.dirname(os.path.abspath(settings.DATABASE_PATH))
    if not db_dir or not os.path.exists(db_dir):
        # Fallback to project root / data
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        db_dir = os.path.join(root_dir, "data")
        os.makedirs(db_dir, exist_ok=True)
    return db_dir

def get_backups_dir() -> str:
    backups_dir = os.path.join(get_data_dir(), "backups")
    os.makedirs(backups_dir, exist_ok=True)
    return backups_dir

def get_disaster_recovery_path() -> str:
    return os.path.join(get_data_dir(), "tides_disaster_recovery.json")

def init_db():
    """Initializes the database schema, migrates legacy data, and performs safety backups."""
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

    CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO users (id, username, email, password_hash)
    VALUES ('tides_public', 'Tides Community', 'public@tidesmusic.online', 'system_public_account_tides_music');
    """)
    conn.commit()
    conn.close()

    # Step 1: Auto-migrate from any legacy soundflow.db files found in workspace/server
    auto_migrate_legacy_db()

    # Step 2: Auto-recover from disaster recovery JSON if database is empty
    auto_recover_if_empty()

    # Step 3: Create rolling backup and fresh disaster recovery snapshot
    create_rolling_backup()
    export_disaster_recovery_snapshot()

def auto_migrate_legacy_db():
    """Scans for legacy soundflow.db files and imports any missing users/playlists."""
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    candidate_paths = [
        os.path.join(root_dir, "soundflow.db"),
        os.path.join(root_dir, "backend", "soundflow.db"),
        os.path.join(root_dir, "data", "soundflow.db"),
    ]

    dest_db = os.path.abspath(settings.DATABASE_PATH)

    for cand in candidate_paths:
        if os.path.exists(cand) and os.path.abspath(cand) != dest_db:
            try:
                cand_conn = sqlite3.connect(cand)
                cand_conn.row_factory = sqlite3.Row
                # Check if it has users
                users = cand_conn.execute("SELECT * FROM users").fetchall()
                if users:
                    dest_conn = get_connection()
                    for u in users:
                        dest_conn.execute(
                            "INSERT OR IGNORE INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                            (u["id"], u["username"], u["email"], u["password_hash"], u["created_at"])
                        )
                    # Playlists
                    try:
                        pls = cand_conn.execute("SELECT * FROM playlists").fetchall()
                        for p in pls:
                            dest_conn.execute(
                                "INSERT OR IGNORE INTO playlists (id, user_id, title, description, thumbnail, is_local, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                                (p["id"], p["user_id"], p["title"], p["description"], p["thumbnail"], p["is_local"], p["created_at"], p["updated_at"])
                            )
                        tracks = cand_conn.execute("SELECT * FROM playlist_tracks").fetchall()
                        for t in tracks:
                            dest_conn.execute(
                                "INSERT OR IGNORE INTO playlist_tracks (id, playlist_id, track_id, title, artist, thumbnail, duration, duration_formatted, position, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                (t["id"], t["playlist_id"], t["track_id"], t["title"], t["artist"], t["thumbnail"], t["duration"], t["duration_formatted"], t["position"], t["added_at"])
                            )
                    except Exception:
                        pass

                    # Favorites
                    try:
                        favs = cand_conn.execute("SELECT * FROM user_favorites").fetchall()
                        for f in favs:
                            dest_conn.execute(
                                "INSERT OR IGNORE INTO user_favorites (id, user_id, track_id, title, artist, thumbnail, duration, duration_formatted, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                (f["id"], f["user_id"], f["track_id"], f["title"], f["artist"], f["thumbnail"], f["duration"], f["duration_formatted"], f["added_at"])
                            )
                    except Exception:
                        pass

                    dest_conn.commit()
                    dest_conn.close()
                cand_conn.close()
            except Exception as e:
                logger.warning(f"Error checking legacy database {cand}: {e}")

def create_rolling_backup():
    """Creates a timestamped snapshot of the current SQLite database and retains the last 30."""
    try:
        db_path = settings.DATABASE_PATH
        if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
            return

        backups_dir = get_backups_dir()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"tides_backup_{timestamp}.db"
        target_path = os.path.join(backups_dir, backup_filename)

        # Use sqlite3 online backup API for ACID consistency
        source_conn = get_connection()
        dest_conn = sqlite3.connect(target_path)
        source_conn.backup(dest_conn)
        dest_conn.close()
        source_conn.close()

        # Clean old backups, keep last 30
        backups = sorted(
            [f for f in os.listdir(backups_dir) if f.startswith("tides_backup_") and f.endswith(".db")],
            reverse=True
        )
        for old_backup in backups[30:]:
            try:
                os.remove(os.path.join(backups_dir, old_backup))
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"Failed to create rolling backup: {e}")

def export_disaster_recovery_snapshot():
    """Exports full database contents to JSON disaster recovery file."""
    try:
        data = export_full_database_json()
        if data.get("users"):
            snapshot_path = get_disaster_recovery_path()
            temp_path = snapshot_path + ".tmp"
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            shutil.move(temp_path, snapshot_path)
    except Exception as e:
        logger.warning(f"Failed to export disaster recovery snapshot: {e}")

def auto_recover_if_empty():
    """If database has 0 users, automatically restores from disaster recovery JSON or newest backup."""
    conn = get_connection()
    user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()

    if user_count == 0:
        snapshot_path = get_disaster_recovery_path()
        if os.path.exists(snapshot_path):
            try:
                with open(snapshot_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if data.get("users"):
                    import_full_database_json(data)
                    logger.info("Successfully auto-restored database from disaster recovery snapshot!")
                    return
            except Exception as e:
                logger.error(f"Error restoring from disaster recovery JSON: {e}")

        # Check newest rolling backup file
        backups_dir = get_backups_dir()
        backups = sorted(
            [f for f in os.listdir(backups_dir) if f.startswith("tides_backup_") and f.endswith(".db")],
            reverse=True
        )
        if backups:
            try:
                newest = os.path.join(backups_dir, backups[0])
                shutil.copy2(newest, settings.DATABASE_PATH)
                logger.info(f"Auto-restored database from rolling backup {backups[0]}")
            except Exception as e:
                logger.error(f"Error restoring from backup file: {e}")

# --- User Management Helpers ---

def create_user(username: str, email: str, password_hash: str) -> Dict[str, Any]:
    user_id = str(uuid.uuid4())
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
            (user_id, username.strip(), email.strip().lower(), password_hash)
        )
        conn.commit()
        export_disaster_recovery_snapshot()
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

def update_user_password(email: str, new_password_hash: str) -> bool:
    conn = get_connection()
    try:
        cursor = conn.execute(
            "UPDATE users SET password_hash = ? WHERE LOWER(email) = ?",
            (new_password_hash, email.strip().lower())
        )
        conn.commit()
        export_disaster_recovery_snapshot()
        return cursor.rowcount > 0
    finally:
        conn.close()

# --- Password Reset Helpers ---

def create_password_reset_code(email: str, code: str, expires_minutes: int = 15) -> str:
    reset_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)
    conn = get_connection()
    try:
        # Invalidate old unused codes for this email
        conn.execute("UPDATE password_resets SET used = 1 WHERE LOWER(email) = ? AND used = 0", (email.strip().lower(),))
        conn.execute(
            "INSERT INTO password_resets (id, email, code, expires_at, used) VALUES (?, ?, ?, ?, 0)",
            (reset_id, email.strip().lower(), code.strip(), expires_at)
        )
        conn.commit()
        return reset_id
    finally:
        conn.close()

def verify_and_consume_reset_code(email: str, code: str) -> bool:
    conn = get_connection()
    try:
        cursor = conn.execute(
            "SELECT id, expires_at FROM password_resets WHERE LOWER(email) = ? AND code = ? AND used = 0 ORDER BY created_at DESC LIMIT 1",
            (email.strip().lower(), code.strip())
        )
        row = cursor.fetchone()
        if not row:
            return False

        # Check expiration
        expires_at_str = row["expires_at"]
        try:
            # Handle both string and datetime formats from sqlite
            if isinstance(expires_at_str, str):
                expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            else:
                expires_at = expires_at_str
            # If naive, compare with utcnow
            if expires_at.tzinfo is None and datetime.utcnow() > expires_at:
                return False
        except Exception:
            pass

        # Mark code as consumed
        conn.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (row["id"],))
        conn.commit()
        return True
    finally:
        conn.close()

# --- Playlist Helpers ---

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

def create_user_playlist(
    playlist_id: str,
    user_id: str,
    title: str,
    description: str = "",
    thumbnail: str = "",
    tracks: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO playlists (id, user_id, title, description, thumbnail) VALUES (?, ?, ?, ?, ?)",
            (playlist_id, user_id, title, description, thumbnail)
        )
        
        inserted_tracks = []
        if tracks:
            for idx, tr in enumerate(tracks):
                track_row_id = str(uuid.uuid4())
                conn.execute(
                    """INSERT INTO playlist_tracks (id, playlist_id, track_id, title, artist, thumbnail, duration, duration_formatted, position)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        track_row_id,
                        playlist_id,
                        tr["id"],
                        tr.get("title", ""),
                        tr.get("artist", ""),
                        tr.get("thumbnail", ""),
                        tr.get("duration", 0),
                        tr.get("durationFormatted", "0:00"),
                        idx
                    )
                )
                inserted_tracks.append(tr)

            if not thumbnail and inserted_tracks and inserted_tracks[0].get("thumbnail"):
                conn.execute("UPDATE playlists SET thumbnail = ? WHERE id = ?", (inserted_tracks[0]["thumbnail"], playlist_id))
                thumbnail = inserted_tracks[0]["thumbnail"]

        conn.commit()
        export_disaster_recovery_snapshot()
        return {
            "id": playlist_id,
            "title": title,
            "description": description,
            "thumbnail": thumbnail,
            "tracks": inserted_tracks,
            "itemCount": len(inserted_tracks)
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
        export_disaster_recovery_snapshot()
    finally:
        conn.close()

def delete_user_playlist(playlist_id: str, user_id: str):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM playlists WHERE id = ? AND user_id = ?", (playlist_id, user_id))
        conn.commit()
        export_disaster_recovery_snapshot()
    finally:
        conn.close()

def add_track_to_playlist(playlist_id: str, user_id: str, track: Dict[str, Any]) -> bool:
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT id, thumbnail FROM playlists WHERE id = ? AND user_id = ?", (playlist_id, user_id))
        pl = cursor.fetchone()
        if not pl:
            return False

        existing = conn.execute(
            "SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
            (playlist_id, track["id"])
        ).fetchone()
        if existing:
            return True

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
        if not pl["thumbnail"] and track.get("thumbnail"):
            conn.execute("UPDATE playlists SET thumbnail = ? WHERE id = ?", (track.get("thumbnail"), playlist_id))

        conn.commit()
        export_disaster_recovery_snapshot()
        return True
    finally:
        conn.close()

def add_batch_tracks_to_playlist(playlist_id: str, user_id: str, tracks: List[Dict[str, Any]]) -> int:
    """Inserts a large list of tracks (e.g. 100-500 songs) in a single atomic transaction."""
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT id, thumbnail FROM playlists WHERE id = ? AND user_id = ?", (playlist_id, user_id))
        pl = cursor.fetchone()
        if not pl:
            return 0

        # Fetch existing track IDs in playlist to avoid duplicates
        existing_tracks = set(
            row[0] for row in conn.execute("SELECT track_id FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,)).fetchall()
        )

        pos = conn.execute("SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,)).fetchone()[0]

        inserted_count = 0
        first_thumb = pl["thumbnail"]

        for tr in tracks:
            tid = tr.get("id")
            if not tid or tid in existing_tracks:
                continue

            track_row_id = str(uuid.uuid4())
            thumb = tr.get("thumbnail", "")
            if not first_thumb and thumb:
                first_thumb = thumb

            conn.execute(
                """INSERT INTO playlist_tracks (id, playlist_id, track_id, title, artist, thumbnail, duration, duration_formatted, position)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    track_row_id,
                    playlist_id,
                    tid,
                    tr.get("title", ""),
                    tr.get("artist", ""),
                    thumb,
                    tr.get("duration", 0),
                    tr.get("durationFormatted", "0:00"),
                    pos
                )
            )
            existing_tracks.add(tid)
            pos += 1
            inserted_count += 1

        if first_thumb and first_thumb != pl["thumbnail"]:
            conn.execute("UPDATE playlists SET thumbnail = ? WHERE id = ?", (first_thumb, playlist_id))

        conn.commit()
        export_disaster_recovery_snapshot()
        return inserted_count
    finally:
        conn.close()

def remove_track_from_playlist(playlist_id: str, track_id: str, user_id: str) -> bool:
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT id FROM playlists WHERE id = ? AND user_id = ?", (playlist_id, user_id))
        if not cursor.fetchone():
            return False

        conn.execute("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?", (playlist_id, track_id))
        conn.commit()
        export_disaster_recovery_snapshot()
        return True
    finally:
        conn.close()

def get_playlist_by_id(playlist_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves any user or shared playlist by its ID, with all tracks and creator info."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            """SELECT p.id, p.title, p.description, p.thumbnail, p.user_id, p.created_at,
                      COALESCE(u.username, 'Tides Creator') as author
               FROM playlists p
               LEFT JOIN users u ON p.user_id = u.id
               WHERE p.id = ?""",
            (playlist_id,)
        )
        row = cursor.fetchone()
        if not row:
            return None

        pl = dict(row)
        track_cursor = conn.execute(
            """SELECT track_id as id, title, artist, thumbnail, duration, duration_formatted as durationFormatted
               FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, added_at ASC""",
            (playlist_id,)
        )
        pl["tracks"] = [dict(tr) for tr in track_cursor.fetchall()]
        pl["itemCount"] = len(pl["tracks"])
        if not pl.get("thumbnail") and pl["tracks"]:
            pl["thumbnail"] = pl["tracks"][0]["thumbnail"]
        return pl
    finally:
        conn.close()

def save_shared_playlist(
    playlist_id: str,
    title: str,
    description: str = "",
    thumbnail: str = "",
    tracks: Optional[List[Dict[str, Any]]] = None,
    user_id: Optional[str] = None,
    author: Optional[str] = None
) -> Dict[str, Any]:
    """Saves or publishes any playlist so it is permanently accessible via a shared link."""
    conn = get_connection()
    try:
        owner_id = user_id if user_id else 'tides_public'
        user_check = conn.execute("SELECT id FROM users WHERE id = ?", (owner_id,)).fetchone()
        if not user_check:
            owner_id = 'tides_public'

        existing = conn.execute("SELECT id, thumbnail FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        final_thumb = thumbnail or (existing["thumbnail"] if existing else "")

        if existing:
            conn.execute(
                "UPDATE playlists SET title = ?, description = ?, thumbnail = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (title, description, final_thumb, playlist_id)
            )
        else:
            conn.execute(
                "INSERT INTO playlists (id, user_id, title, description, thumbnail) VALUES (?, ?, ?, ?, ?)",
                (playlist_id, owner_id, title, description, final_thumb)
            )

        inserted_tracks = []
        if tracks:
            existing_track_ids = set(
                r[0] for r in conn.execute("SELECT track_id FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,)).fetchall()
            )
            pos = conn.execute("SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,)).fetchone()[0]

            for idx, tr in enumerate(tracks):
                tid = tr.get("id")
                if not tid:
                    continue
                tr_thumb = tr.get("thumbnail", "")
                if not final_thumb and tr_thumb:
                    final_thumb = tr_thumb
                    conn.execute("UPDATE playlists SET thumbnail = ? WHERE id = ?", (final_thumb, playlist_id))

                if tid not in existing_track_ids:
                    track_row_id = str(uuid.uuid4())
                    conn.execute(
                        """INSERT INTO playlist_tracks (id, playlist_id, track_id, title, artist, thumbnail, duration, duration_formatted, position)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            track_row_id,
                            playlist_id,
                            tid,
                            tr.get("title", ""),
                            tr.get("artist", ""),
                            tr_thumb,
                            tr.get("duration", 0),
                            tr.get("durationFormatted", "0:00"),
                            pos + idx
                        )
                    )
                    existing_track_ids.add(tid)
                inserted_tracks.append(tr)

        conn.commit()
        export_disaster_recovery_snapshot()
        return {
            "id": playlist_id,
            "title": title,
            "description": description,
            "thumbnail": final_thumb,
            "tracks": inserted_tracks,
            "itemCount": len(inserted_tracks),
            "author": author or "Tides Creator"
        }
    finally:
        conn.close()


# --- Favorites Helpers ---

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
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM user_favorites WHERE user_id = ? AND track_id = ?",
            (user_id, track["id"])
        ).fetchone()

        if existing:
            conn.execute("DELETE FROM user_favorites WHERE user_id = ? AND track_id = ?", (user_id, track["id"]))
            conn.commit()
            export_disaster_recovery_snapshot()
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
            export_disaster_recovery_snapshot()
            return True
    finally:
        conn.close()

# --- History Helpers ---

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
        export_disaster_recovery_snapshot()
    finally:
        conn.close()

def clear_user_history(user_id: str):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM user_history WHERE user_id = ?", (user_id,))
        conn.commit()
        export_disaster_recovery_snapshot()
    finally:
        conn.close()

# --- Full User Library Sync ---

def sync_full_user_library(
    user_id: str,
    local_playlists: List[Dict[str, Any]],
    local_favorites: List[Dict[str, Any]],
    local_history: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Merges any guest playlists, favorites, and history into the user's permanent database account."""
    conn = get_connection()
    try:
        # Merge local playlists
        for lp in local_playlists:
            title = lp.get("title", "").strip()
            if not title:
                continue
            pid = lp.get("id") or str(uuid.uuid4())
            # Check if playlist with this title already exists in user's account
            existing_pl = conn.execute(
                "SELECT id FROM playlists WHERE user_id = ? AND LOWER(title) = ?",
                (user_id, title.lower())
            ).fetchone()
            
            target_pl_id = existing_pl["id"] if existing_pl else pid
            if not existing_pl:
                conn.execute(
                    "INSERT INTO playlists (id, user_id, title, description, thumbnail) VALUES (?, ?, ?, ?, ?)",
                    (target_pl_id, user_id, title, lp.get("description", ""), lp.get("thumbnail", ""))
                )
            
            # Insert tracks
            tracks = lp.get("tracks", [])
            for idx, tr in enumerate(tracks):
                tid = tr.get("id")
                if not tid:
                    continue
                has_track = conn.execute(
                    "SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
                    (target_pl_id, tid)
                ).fetchone()
                if not has_track:
                    track_row_id = str(uuid.uuid4())
                    conn.execute(
                        """INSERT INTO playlist_tracks (id, playlist_id, track_id, title, artist, thumbnail, duration, duration_formatted, position)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            track_row_id,
                            target_pl_id,
                            tid,
                            tr.get("title", ""),
                            tr.get("artist", ""),
                            tr.get("thumbnail", ""),
                            tr.get("duration", 0),
                            tr.get("durationFormatted", "0:00"),
                            idx
                        )
                    )

        # Merge local favorites
        for lf in local_favorites:
            tid = lf.get("id")
            if not tid:
                continue
            has_fav = conn.execute(
                "SELECT id FROM user_favorites WHERE user_id = ? AND track_id = ?",
                (user_id, tid)
            ).fetchone()
            if not has_fav:
                fav_row_id = str(uuid.uuid4())
                conn.execute(
                    """INSERT INTO user_favorites (id, user_id, track_id, title, artist, thumbnail, duration, duration_formatted)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        fav_row_id,
                        user_id,
                        tid,
                        lf.get("title", ""),
                        lf.get("artist", ""),
                        lf.get("thumbnail", ""),
                        lf.get("duration", 0),
                        lf.get("durationFormatted", "0:00")
                    )
                )

        # Merge local history
        for lh in local_history:
            tid = lh.get("id")
            if not tid:
                continue
            has_hist = conn.execute(
                "SELECT id FROM user_history WHERE user_id = ? AND track_id = ?",
                (user_id, tid)
            ).fetchone()
            if not has_hist:
                hist_row_id = str(uuid.uuid4())
                conn.execute(
                    """INSERT INTO user_history (id, user_id, track_id, title, artist, thumbnail, duration, duration_formatted)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        hist_row_id,
                        user_id,
                        tid,
                        lh.get("title", ""),
                        lh.get("artist", ""),
                        lh.get("thumbnail", ""),
                        lh.get("duration", 0),
                        lh.get("durationFormatted", "0:00")
                    )
                )

        conn.commit()
    finally:
        conn.close()

    export_disaster_recovery_snapshot()
    return {
        "playlists": get_user_playlists(user_id),
        "favorites": get_user_favorites(user_id),
        "history": get_user_history(user_id)
    }

# --- Database Backup / Restore JSON Helpers ---

def export_full_database_json() -> Dict[str, Any]:
    """Exports full database to a clean JSON object for backups."""
    conn = get_connection()
    try:
        users = [dict(r) for r in conn.execute("SELECT * FROM users").fetchall()]
        playlists = [dict(r) for r in conn.execute("SELECT * FROM playlists").fetchall()]
        playlist_tracks = [dict(r) for r in conn.execute("SELECT * FROM playlist_tracks").fetchall()]
        user_favorites = [dict(r) for r in conn.execute("SELECT * FROM user_favorites").fetchall()]
        user_history = [dict(r) for r in conn.execute("SELECT * FROM user_history").fetchall()]
        return {
            "version": "2.0",
            "exported_at": datetime.utcnow().isoformat(),
            "users": users,
            "playlists": playlists,
            "playlist_tracks": playlist_tracks,
            "user_favorites": user_favorites,
            "user_history": user_history
        }
    finally:
        conn.close()

def import_full_database_json(data: Dict[str, Any]) -> Dict[str, int]:
    """Imports users, playlists, tracks, favorites, and history from a backup JSON."""
    conn = get_connection()
    counts = {"users": 0, "playlists": 0, "playlist_tracks": 0, "user_favorites": 0, "user_history": 0}
    try:
        # Users
        for u in data.get("users", []):
            conn.execute(
                "INSERT OR REPLACE INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (u["id"], u["username"], u["email"], u["password_hash"], u.get("created_at", datetime.utcnow().isoformat()))
            )
            counts["users"] += 1

        # Playlists
        for p in data.get("playlists", []):
            conn.execute(
                "INSERT OR REPLACE INTO playlists (id, user_id, title, description, thumbnail, is_local, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (p["id"], p["user_id"], p["title"], p.get("description", ""), p.get("thumbnail", ""), p.get("is_local", 0), p.get("created_at", datetime.utcnow().isoformat()), p.get("updated_at", datetime.utcnow().isoformat()))
            )
            counts["playlists"] += 1

        # Playlist Tracks
        for pt in data.get("playlist_tracks", []):
            conn.execute(
                "INSERT OR REPLACE INTO playlist_tracks (id, playlist_id, track_id, title, artist, thumbnail, duration, duration_formatted, position, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (pt["id"], pt["playlist_id"], pt["track_id"], pt.get("title", ""), pt.get("artist", ""), pt.get("thumbnail", ""), pt.get("duration", 0), pt.get("duration_formatted", "0:00"), pt.get("position", 0), pt.get("added_at", datetime.utcnow().isoformat()))
            )
            counts["playlist_tracks"] += 1

        # Favorites
        for f in data.get("user_favorites", []):
            conn.execute(
                "INSERT OR REPLACE INTO user_favorites (id, user_id, track_id, title, artist, thumbnail, duration, duration_formatted, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (f["id"], f["user_id"], f["track_id"], f.get("title", ""), f.get("artist", ""), f.get("thumbnail", ""), f.get("duration", 0), f.get("duration_formatted", "0:00"), f.get("added_at", datetime.utcnow().isoformat()))
            )
            counts["user_favorites"] += 1

        # History
        for h in data.get("user_history", []):
            conn.execute(
                "INSERT OR REPLACE INTO user_history (id, user_id, track_id, title, artist, thumbnail, duration, duration_formatted, played_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (h["id"], h["user_id"], h["track_id"], h.get("title", ""), h.get("artist", ""), h.get("thumbnail", ""), h.get("duration", 0), h.get("duration_formatted", "0:00"), h.get("played_at", datetime.utcnow().isoformat()))
            )
            counts["user_history"] += 1

        conn.commit()
        return counts
    finally:
        conn.close()
