import asyncio
import html
import json
import re
import time
import urllib.parse
import uuid
from typing import Any, Dict, List, Optional
import httpx
from ytmusicapi import YTMusic
import yt_dlp

from backend.config import settings

# Initialize YTMusic client
ytmusic = YTMusic()

# In-memory stream cache: {video_id: {"url": str, "expires_at": float, "title": str, "duration": int}}
STREAM_CACHE: Dict[str, Dict[str, Any]] = {}

# Mappings for Spotify synthetic tracks: synthetic_id -> real_yt_id
RESOLVED_YT_ID_MAP: Dict[str, str] = {}
# Synthetic track metadata: synthetic_id -> {"title": ..., "artist": ..., "spotify_id": ...}
SYNTHETIC_TRACK_MAP: Dict[str, Dict[str, str]] = {}

def is_short_or_snippet(title: str, artist: str = "", duration_sec: int = 0) -> bool:
    """
    Detects whether a video is a YouTube Short, status clip, or non-song teaser snippet.
    Filters out videos under 70 seconds and any titles with shorts/reels/status hashtags.
    """
    if 0 < duration_sec < 70:
        return True

    text = f"{title} {artist}".lower()
    short_markers = [
        "#shorts", "#short", "shorts", "#reel", "#reels", "reels",
        "tiktok", "whatsapp status", "status video", "30 sec status",
        "30 second status", "4k status", "fullscreen status", "lyrics motion",
        "#viralshort", "#ytshorts", "short video"
    ]
    for marker in short_markers:
        if marker in text:
            return True

    return False

def parse_iso8601_duration(duration_str: str) -> int:
    """Parses ISO 8601 duration format (e.g. PT3M45S or PT1H2M10S) into seconds."""
    if not duration_str:
        return 0
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds

def format_duration(seconds: int) -> str:
    """Formats seconds into mm:ss or hh:mm:ss."""
    if not seconds:
        return "0:00"
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

class YouTubeService:
    def __init__(self):
        self.api_key = settings.YOUTUBE_API_KEY
        self.base_url = "https://www.googleapis.com/youtube/v3"

    async def _fetch_video_durations(self, client: httpx.AsyncClient, video_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Batch fetches duration and channel/view details for a list of video IDs."""
        if not video_ids:
            return {}
        
        details: Dict[str, Dict[str, Any]] = {}
        # Chunk into groups of 50
        chunks = [video_ids[i:i + 50] for i in range(0, len(video_ids), 50)]
        for chunk in chunks:
            url = f"{self.base_url}/videos"
            params = {
                "part": "contentDetails,snippet,statistics",
                "id": ",".join(chunk),
                "key": self.api_key
            }
            try:
                res = await client.get(url, params=params, timeout=10.0)
                if res.status_code == 200:
                    data = res.json()
                    for item in data.get("items", []):
                        vid = item.get("id")
                        content_details = item.get("contentDetails", {})
                        duration_iso = content_details.get("duration", "")
                        duration_sec = parse_iso8601_duration(duration_iso)
                        details[vid] = {
                            "duration": duration_sec,
                            "durationFormatted": format_duration(duration_sec),
                            "viewCount": item.get("statistics", {}).get("viewCount", "0")
                        }
            except Exception as e:
                print(f"Error fetching video details: {e}")
        return details

    async def search(self, query: str, search_type: str = "all", page_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Search YouTube using YouTube Data API v3 with music category optimization.
        filter_type can be 'all', 'songs', 'playlists'.
        """
        async with httpx.AsyncClient(timeout=15.0) as client:
            type_param = "video,playlist"
            video_category = "10"  # Music category
            if search_type == "songs" or search_type == "video":
                type_param = "video"
            elif search_type == "playlists":
                type_param = "playlist"
                video_category = None

            params = {
                "part": "snippet",
                "q": query,
                "type": type_param,
                "maxResults": 50,
                "key": self.api_key
            }
            if video_category:
                params["videoCategoryId"] = video_category
            if page_token:
                params["pageToken"] = page_token

            res = await client.get(f"{self.base_url}/search", params=params)
            if res.status_code != 200:
                # If error, fallback to ytmusicapi search
                return await self._fallback_ytmusic_search(query, search_type)

            data = res.json()
            items = data.get("items", [])
            video_ids = [item["id"]["videoId"] for item in items if item.get("id", {}).get("videoId")]

            # Batch fetch durations
            durations = await self._fetch_video_durations(client, video_ids)

            results: List[Dict[str, Any]] = []
            for item in items:
                id_info = item.get("id", {})
                snippet = item.get("snippet", {})
                thumbnails = snippet.get("thumbnails", {})
                thumbnail_url = (
                    thumbnails.get("high", {}).get("url") or
                    thumbnails.get("medium", {}).get("url") or
                    thumbnails.get("default", {}).get("url") or ""
                )

                if "videoId" in id_info:
                    vid = id_info["videoId"]
                    dur_info = durations.get(vid, {"duration": 0, "durationFormatted": "0:00", "viewCount": "0"})
                    raw_title = html.unescape(snippet.get("title", ""))
                    raw_artist = html.unescape(snippet.get("channelTitle", ""))
                    dur_sec = dur_info["duration"]

                    # Filter out YouTube Shorts, status videos, and non-song clips
                    if is_short_or_snippet(raw_title, raw_artist, dur_sec):
                        continue

                    results.append({
                        "id": vid,
                        "title": raw_title,
                        "artist": raw_artist,
                        "channelId": snippet.get("channelId", ""),
                        "thumbnail": thumbnail_url,
                        "duration": dur_sec,
                        "durationFormatted": dur_info["durationFormatted"],
                        "views": dur_info.get("viewCount", "0"),
                        "type": "song"
                    })
                elif "playlistId" in id_info:
                    pid = id_info["playlistId"]
                    raw_title = html.unescape(snippet.get("title", ""))
                    raw_artist = html.unescape(snippet.get("channelTitle", ""))
                    if is_short_or_snippet(raw_title, raw_artist, 999):
                        continue

                    results.append({
                        "id": pid,
                        "title": raw_title,
                        "artist": raw_artist,
                        "channelId": snippet.get("channelId", ""),
                        "thumbnail": thumbnail_url,
                        "type": "playlist"
                    })

            return {
                "results": results,
                "nextPageToken": data.get("nextPageToken"),
                "totalResults": data.get("pageInfo", {}).get("totalResults", len(results))
            }

    async def _fallback_ytmusic_search(self, query: str, search_type: str) -> Dict[str, Any]:
        """Fallback to ytmusicapi search."""
        loop = asyncio.get_event_loop()
        filter_val = None
        if search_type == "songs":
            filter_val = "songs"
        elif search_type == "playlists":
            filter_val = "playlists"
        
        try:
            results_raw = await loop.run_in_executor(None, lambda: ytmusic.search(query, filter=filter_val))
            formatted = []
            for r in results_raw[:40]:
                artists = ", ".join([a["name"] for a in r.get("artists", [])]) if r.get("artists") else (r.get("author") or "")
                thumbnails = r.get("thumbnails", [])
                thumb = thumbnails[-1]["url"] if thumbnails else ""
                vid = r.get("videoId")
                pid = r.get("browseId") or r.get("playlistId")
                title = html.unescape(r.get("title", ""))
                
                if vid:
                    dur = r.get("duration_seconds") or 0
                    if is_short_or_snippet(title, artists, dur):
                        continue

                    formatted.append({
                        "id": vid,
                        "title": title,
                        "artist": artists,
                        "thumbnail": thumb,
                        "duration": dur,
                        "durationFormatted": r.get("duration") or format_duration(dur),
                        "type": "song"
                    })
                elif pid or r.get("resultType") == "playlist":
                    if is_short_or_snippet(title, artists, 999):
                        continue

                    formatted.append({
                        "id": pid,
                        "title": title,
                        "artist": artists,
                        "thumbnail": thumb,
                        "type": "playlist"
                    })
            return {"results": formatted, "nextPageToken": None}
        except Exception as e:
            print("ytmusic fallback error:", e)
            return {"results": [], "nextPageToken": None}

    async def get_spotify_playlist(self, spotify_id: str) -> Dict[str, Any]:
        """
        Fetches and extracts a public Spotify playlist by ID or URL.
        Resolves top tracks to high-res YouTube audio streams and creates
        seamless fallback stream mappings for remaining tracks.
        """
        clean_id = spotify_id.replace("spotify:playlist:", "").replace("spotify:", "").strip()
        if "?" in clean_id:
            clean_id = clean_id.split("?")[0]
        if "/" in clean_id:
            clean_id = clean_id.split("/")[-1]

        url = f"https://open.spotify.com/embed/playlist/{clean_id}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
        }

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers=headers) as client:
            res = await client.get(url)
            if res.status_code != 200:
                raise ValueError(f"Failed to fetch Spotify playlist (HTTP {res.status_code}). Please verify it is a public playlist.")

            content = res.content.decode("utf-8", errors="replace")
            m = re.search(r'<script id="__NEXT_DATA__" type="application/json">([^<]+)</script>', content)
            if not m:
                raise ValueError("Could not parse Spotify playlist structure. The playlist might be private or region-locked.")

            try:
                data = json.loads(m.group(1))
            except Exception as e:
                raise ValueError(f"Failed to parse Spotify metadata: {e}")

            entity = data.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})
            raw_title = entity.get("title") or entity.get("name") or "Spotify Playlist"
            title = html.unescape(raw_title).replace("\ufffd", "'").replace("â€™", "'").replace("’", "'").strip()
            subtitle = entity.get("subtitle") or "Spotify"
            description = entity.get("description") or f"Public playlist imported from {subtitle}"

            # Playlist cover
            thumbnail = ""
            cover_art = entity.get("coverArt", {}).get("sources", [])
            if cover_art:
                thumbnail = cover_art[0].get("url", "")
            if not thumbnail:
                visual_identity = entity.get("visualIdentity", {}).get("image", [])
                if visual_identity:
                    thumbnail = visual_identity[-1].get("url", "")

            track_list = entity.get("trackList", [])
            playlist_info = {
                "id": f"spotify:{clean_id}",
                "title": title,
                "description": description,
                "author": subtitle,
                "thumbnail": thumbnail,
                "itemCount": len(track_list)
            }

            raw_tracks = []
            for t in track_list:
                t_title = html.unescape(t.get("title", "")).replace("\ufffd", "'").replace("â€™", "'").replace("’", "'").strip()
                t_artist = html.unescape(t.get("subtitle", "") or "Unknown Artist").replace("\ufffd", "'").replace("â€™", "'").replace("’", "'").strip()
                duration_ms = t.get("duration", 0) or 0
                dur_sec = duration_ms // 1000
                dur_fmt = format_duration(dur_sec) if dur_sec > 0 else "3:30"
                uri = t.get("uri", "")
                t_sp_id = uri.split(":")[-1] if ":" in uri else (t.get("uid") or str(uuid.uuid4())[:8])

                raw_tracks.append({
                    "spotify_id": t_sp_id,
                    "title": t_title,
                    "artist": t_artist,
                    "duration": dur_sec,
                    "durationFormatted": dur_fmt,
                    "thumbnail": thumbnail
                })

            # Concurrently resolve top 12 tracks to real YouTube IDs
            top_count = min(12, len(raw_tracks))
            sem = asyncio.Semaphore(6)

            async def resolve_one(item: Dict[str, Any]) -> Dict[str, Any]:
                q = f"{item['title']} {item['artist']} audio"
                encoded_title = urllib.parse.quote(item["title"][:40])
                encoded_artist = urllib.parse.quote(item["artist"][:40])
                synth_id = f"sp__{item['spotify_id']}__{encoded_title}__{encoded_artist}"
                SYNTHETIC_TRACK_MAP[synth_id] = {
                    "title": item["title"],
                    "artist": item["artist"],
                    "spotify_id": item["spotify_id"]
                }
                try:
                    async with sem:
                        s_res = await self.search(query=q, search_type="songs")
                        results = s_res.get("results", [])
                        if results:
                            best = results[0]
                            real_id = best["id"]
                            RESOLVED_YT_ID_MAP[synth_id] = real_id
                            return {
                                "id": real_id,
                                "title": item["title"],
                                "artist": item["artist"],
                                "thumbnail": best.get("thumbnail") or item["thumbnail"],
                                "duration": best.get("duration") or item["duration"],
                                "durationFormatted": best.get("durationFormatted") or item["durationFormatted"],
                                "type": "song"
                            }
                except Exception as err:
                    print("Error resolving track:", err)

                return {
                    "id": synth_id,
                    "title": item["title"],
                    "artist": item["artist"],
                    "thumbnail": item["thumbnail"],
                    "duration": item["duration"],
                    "durationFormatted": item["durationFormatted"],
                    "type": "song"
                }

            resolved_top = await asyncio.gather(*[resolve_one(t) for t in raw_tracks[:top_count]])

            formatted_tracks = list(resolved_top)
            for item in raw_tracks[top_count:]:
                encoded_title = urllib.parse.quote(item["title"][:40])
                encoded_artist = urllib.parse.quote(item["artist"][:40])
                synth_id = f"sp__{item['spotify_id']}__{encoded_title}__{encoded_artist}"
                SYNTHETIC_TRACK_MAP[synth_id] = {
                    "title": item["title"],
                    "artist": item["artist"],
                    "spotify_id": item["spotify_id"]
                }
                formatted_tracks.append({
                    "id": synth_id,
                    "title": item["title"],
                    "artist": item["artist"],
                    "thumbnail": item["thumbnail"],
                    "duration": item["duration"],
                    "durationFormatted": item["durationFormatted"],
                    "type": "song"
                })

            if not playlist_info.get("thumbnail") and formatted_tracks:
                playlist_info["thumbnail"] = formatted_tracks[0]["thumbnail"]

            return {
                "info": playlist_info,
                "tracks": formatted_tracks
            }

    async def get_playlist(self, playlist_id: str) -> Dict[str, Any]:
        """Fetches metadata and all tracks of a playlist via YouTube Data API v3, Spotify embed, or ytmusicapi."""
        clean_id = playlist_id.strip()
        if clean_id.startswith("spotify:") or clean_id.startswith("spotify_") or "open.spotify.com" in clean_id or (len(clean_id) == 22 and not "_" in clean_id and not "-" in clean_id):
            return await self.get_spotify_playlist(clean_id)

        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Fetch playlist metadata
            p_res = await client.get(
                f"{self.base_url}/playlists",
                params={"part": "snippet,contentDetails", "id": playlist_id, "key": self.api_key}
            )
            playlist_info = {}
            if p_res.status_code == 200 and p_res.json().get("items"):
                item = p_res.json()["items"][0]
                snippet = item.get("snippet", {})
                thumbs = snippet.get("thumbnails", {})
                thumb = (thumbs.get("maxres") or thumbs.get("high") or thumbs.get("medium") or {}).get("url", "")
                playlist_info = {
                    "id": playlist_id,
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description", ""),
                    "author": snippet.get("channelTitle", ""),
                    "thumbnail": thumb,
                    "itemCount": item.get("contentDetails", {}).get("itemCount", 0)
                }

            # 2. Fetch playlist items
            tracks = []
            page_token = None
            for _ in range(2):  # up to 100 items
                params = {
                    "part": "snippet,contentDetails",
                    "playlistId": playlist_id,
                    "maxResults": 50,
                    "key": self.api_key
                }
                if page_token:
                    params["pageToken"] = page_token
                
                pi_res = await client.get(f"{self.base_url}/playlistItems", params=params)
                if pi_res.status_code != 200:
                    break
                
                pi_data = pi_res.json()
                items = pi_data.get("items", [])
                if not items:
                    break

                video_ids = [it.get("contentDetails", {}).get("videoId") for it in items if it.get("contentDetails", {}).get("videoId")]
                durations = await self._fetch_video_durations(client, video_ids)

                for it in items:
                    snippet = it.get("snippet", {})
                    vid = it.get("contentDetails", {}).get("videoId") or snippet.get("resourceId", {}).get("videoId")
                    if not vid:
                        continue
                    
                    # Ignore deleted/private videos
                    if snippet.get("title") in ["Private video", "Deleted video"]:
                        continue

                    thumbs = snippet.get("thumbnails", {})
                    thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url", "")
                    dur_info = durations.get(vid, {"duration": 0, "durationFormatted": "0:00"})

                    tracks.append({
                        "id": vid,
                        "title": snippet.get("title", ""),
                        "artist": snippet.get("videoOwnerChannelTitle") or snippet.get("channelTitle") or "Unknown Artist",
                        "thumbnail": thumb,
                        "duration": dur_info["duration"],
                        "durationFormatted": dur_info["durationFormatted"],
                        "type": "song"
                    })
                
                page_token = pi_data.get("nextPageToken")
                if not page_token:
                    break

            if tracks or playlist_info:
                if not playlist_info.get("thumbnail") and tracks:
                    playlist_info["thumbnail"] = tracks[0]["thumbnail"]
                return {
                    "info": playlist_info,
                    "tracks": tracks
                }

        # Fallback to ytmusicapi if API key failed or empty
        return await self._fallback_ytmusic_playlist(playlist_id)

    async def _fallback_ytmusic_playlist(self, playlist_id: str) -> Dict[str, Any]:
        """Fallback to ytmusicapi to get playlist tracks."""
        loop = asyncio.get_event_loop()
        try:
            data = await loop.run_in_executor(None, lambda: ytmusic.get_playlist(playlist_id, limit=100))
            thumbs = data.get("thumbnails", [])
            thumb = thumbs[-1]["url"] if thumbs else ""
            author = data.get("author", {})
            author_name = author.get("name", "") if isinstance(author, dict) else str(author)
            
            tracks = []
            for t in data.get("tracks", []):
                vid = t.get("videoId")
                if not vid:
                    continue
                t_thumbs = t.get("thumbnails", [])
                t_thumb = t_thumbs[-1]["url"] if t_thumbs else ""
                artists = ", ".join([a["name"] for a in t.get("artists", [])]) if t.get("artists") else ""
                dur = t.get("duration_seconds") or 0
                tracks.append({
                    "id": vid,
                    "title": t.get("title", ""),
                    "artist": artists,
                    "thumbnail": t_thumb,
                    "duration": dur,
                    "durationFormatted": t.get("duration") or format_duration(dur),
                    "type": "song"
                })

            return {
                "info": {
                    "id": playlist_id,
                    "title": data.get("title", ""),
                    "description": data.get("description", ""),
                    "author": author_name,
                    "thumbnail": thumb,
                    "itemCount": len(tracks)
                },
                "tracks": tracks
            }
        except Exception as e:
            print("ytmusic fallback playlist error:", e)
            return {"info": {"id": playlist_id, "title": "Playlist", "thumbnail": ""}, "tracks": []}

    async def get_home_feed(self) -> Dict[str, Any]:
        """Fetches top charts, trending music, and curated mood/genre playlists for the Home screen."""
        trending_songs: List[Dict[str, Any]] = []

        # 1. Fetch live top trending music using YouTube Data API v3
        async with httpx.AsyncClient(timeout=12.0) as client:
            try:
                url = f"{self.base_url}/videos"
                params = {
                    "part": "snippet,contentDetails,statistics",
                    "chart": "mostPopular",
                    "videoCategoryId": "10",  # Music category
                    "maxResults": 16,
                    "key": self.api_key
                }
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    for item in res.json().get("items", []):
                        vid = item.get("id")
                        snippet = item.get("snippet", {})
                        thumbs = snippet.get("thumbnails", {})
                        thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url", "")
                        dur_iso = item.get("contentDetails", {}).get("duration", "")
                        dur_sec = parse_iso8601_duration(dur_iso)
                        trending_songs.append({
                            "id": vid,
                            "title": snippet.get("title", ""),
                            "artist": snippet.get("channelTitle", "Unknown Artist"),
                            "thumbnail": thumb,
                            "duration": dur_sec,
                            "durationFormatted": format_duration(dur_sec),
                            "type": "song"
                        })
            except Exception as e:
                print("Error loading YouTube trending:", e)

        # 2. Curated playlists / genre shelves
        curated_shelves = [
            {
                "title": "Popular Playlists & Mixes",
                "items": [
                    {
                        "id": "RDCLAK5uy_kmPRjFGN7YstCHdnuf3vqKcgG5wNIo",
                        "title": "Today's Hits",
                        "artist": "Tides Music",
                        "thumbnail": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80",
                        "type": "playlist"
                    },
                    {
                        "id": "RDCLAK5uy_kPX4GZqX9vP9iU8yQkFk0X8hLgK7Fv7eU",
                        "title": "Chill & Lofi Beats",
                        "artist": "Tides Music",
                        "thumbnail": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&q=80",
                        "type": "playlist"
                    },
                    {
                        "id": "RDCLAK5uy_n9FBDqV6bF7R7W9nK0oM6pZ3a1kX2j9wE",
                        "title": "Deep Focus",
                        "artist": "Tides Music",
                        "thumbnail": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&q=80",
                        "type": "playlist"
                    },
                    {
                        "id": "RDCLAK5uy_kLWShQJjH0BvL4a3mD5uF7mE6cM8wP2qR",
                        "title": "Rock & Alternative Classics",
                        "artist": "Tides Music",
                        "thumbnail": "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80",
                        "type": "playlist"
                    }
                ]
            }
        ]
        return {"shelves": curated_shelves, "trending": trending_songs}


    async def get_up_next(self, video_id: str) -> List[Dict[str, Any]]:
        """Fetches up-next / radio tracks related to a video for infinite seamless playback."""
        if video_id in RESOLVED_YT_ID_MAP:
            video_id = RESOLVED_YT_ID_MAP[video_id]
        elif video_id.startswith("sp__") or video_id.startswith("sp_"):
            meta = SYNTHETIC_TRACK_MAP.get(video_id)
            if meta:
                try:
                    s_res = await self.search(query=f"{meta['title']} {meta['artist']} audio", search_type="songs")
                    if s_res.get("results"):
                        video_id = s_res["results"][0]["id"]
                        RESOLVED_YT_ID_MAP[video_id] = video_id
                except Exception:
                    pass

        loop = asyncio.get_event_loop()
        def fetch_upnext():
            try:
                watch = ytmusic.get_watch_playlist(video_id)
                tracks = []
                for t in watch.get("tracks", [])[1:20]:
                    vid = t.get("videoId")
                    if not vid:
                        continue
                    artists = ", ".join([a["name"] for a in t.get("artists", [])]) if t.get("artists") else (t.get("author") or "")
                    thumbs = t.get("thumbnail", [])
                    thumb = thumbs[-1]["url"] if thumbs else ""
                    dur = t.get("length_seconds") or 0
                    tracks.append({
                        "id": vid,
                        "title": t.get("title", ""),
                        "artist": artists,
                        "thumbnail": thumb,
                        "duration": dur,
                        "durationFormatted": t.get("duration") or format_duration(dur),
                        "type": "song"
                    })
                return tracks
            except Exception as e:
                print("Error in up_next:", e)
                return []
        return await loop.run_in_executor(None, fetch_upnext)

    async def get_lyrics(self, video_id: str) -> Dict[str, Any]:
        """Fetches lyrics if available for the given track."""
        if video_id in RESOLVED_YT_ID_MAP:
            video_id = RESOLVED_YT_ID_MAP[video_id]
        elif video_id.startswith("sp__") or video_id.startswith("sp_"):
            meta = SYNTHETIC_TRACK_MAP.get(video_id)
            if meta:
                try:
                    s_res = await self.search(query=f"{meta['title']} {meta['artist']} audio", search_type="songs")
                    if s_res.get("results"):
                        video_id = s_res["results"][0]["id"]
                        RESOLVED_YT_ID_MAP[video_id] = video_id
                except Exception:
                    pass

        loop = asyncio.get_event_loop()
        def fetch_lyrics():
            try:
                watch = ytmusic.get_watch_playlist(video_id)
                lyrics_id = watch.get("lyrics")
                if lyrics_id:
                    lyrics_data = ytmusic.get_lyrics(lyrics_id)
                    return {
                        "available": True,
                        "lyrics": lyrics_data.get("lyrics", ""),
                        "source": lyrics_data.get("source", "")
                    }
                return {"available": False, "lyrics": "Lyrics not available for this track."}
            except Exception as e:
                print("Error fetching lyrics:", e)
                return {"available": False, "lyrics": "Lyrics could not be loaded."}
        return await loop.run_in_executor(None, fetch_lyrics)

    async def get_stream_info(self, video_id: str) -> Dict[str, Any]:
        """
        Resolves the best direct audio stream URL using yt-dlp.
        Supports standard YouTube video IDs and Spotify synthetic IDs (sp__...)
        Caches URLs for up to 1 hour to optimize seeking and repeated plays.
        """
        now = time.time()
        orig_video_id = video_id
        search_query_for_synth = None

        if video_id in RESOLVED_YT_ID_MAP:
            video_id = RESOLVED_YT_ID_MAP[video_id]
        elif video_id.startswith("sp__") or video_id.startswith("sp_"):
            if video_id in SYNTHETIC_TRACK_MAP:
                meta = SYNTHETIC_TRACK_MAP[video_id]
                search_query_for_synth = f"{meta['title']} {meta['artist']} audio"
            else:
                parts = video_id.split("__")
                if len(parts) >= 4:
                    search_query_for_synth = f"{urllib.parse.unquote(parts[2])} {urllib.parse.unquote(parts[3])} audio"
                elif len(parts) >= 3:
                    search_query_for_synth = f"{urllib.parse.unquote(parts[1])} {urllib.parse.unquote(parts[2])} audio"
                else:
                    search_query_for_synth = video_id

            try:
                s_res = await self.search(query=search_query_for_synth, search_type="songs")
                if s_res.get("results"):
                    real_id = s_res["results"][0]["id"]
                    RESOLVED_YT_ID_MAP[orig_video_id] = real_id
                    video_id = real_id
            except Exception as e:
                print("Synthetic ID search error:", e)

        if video_id in STREAM_CACHE:
            cached = STREAM_CACHE[video_id]
            if cached["expires_at"] > now:
                return cached
        if orig_video_id in STREAM_CACHE:
            cached = STREAM_CACHE[orig_video_id]
            if cached["expires_at"] > now:
                return cached

        loop = asyncio.get_event_loop()
        def extract():
            ydl_opts = {
                "format": "bestaudio/best",
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "extractor_args": {
                    "youtube": {
                        "player_client": ["android", "ios", "mweb"]
                    }
                },
                "socket_timeout": 15,
            }
            if (video_id.startswith("sp__") or video_id.startswith("sp_")) and search_query_for_synth:
                target_url = f"ytsearch1:{search_query_for_synth}"
            else:
                target_url = f"https://www.youtube.com/watch?v={video_id}"

            info = None
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(target_url, download=False)
            except Exception as e:
                print(f"Direct stream extraction error for {target_url}: {e}. Retrying with search fallback...")
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        fallback_query = search_query_for_synth or f"{video_id} audio"
                        info = ydl.extract_info(f"ytsearch1:{fallback_query}", download=False)
                except Exception as e2:
                    print(f"Fallback search extraction failed: {e2}")
                    raise

            if not info:
                raise Exception("Could not extract stream info")

            if "entries" in info and info["entries"]:
                info = info["entries"][0]

            stream_url = info.get("url")
            extracted_id = info.get("id") or video_id
            RESOLVED_YT_ID_MAP[orig_video_id] = extracted_id

            res_info = {
                "id": orig_video_id,
                "realId": extracted_id,
                "url": stream_url,
                "title": info.get("title", ""),
                "artist": info.get("uploader", ""),
                "duration": info.get("duration", 0),
                "durationFormatted": format_duration(info.get("duration", 0)),
                "format": info.get("ext", "m4a"),
                "abr": info.get("abr", 128),
                "expires_at": now + settings.STREAM_CACHE_TTL
            }
            STREAM_CACHE[orig_video_id] = res_info
            STREAM_CACHE[extracted_id] = res_info
            return res_info

        info = await loop.run_in_executor(None, extract)
        return info

youtube_service = YouTubeService()
