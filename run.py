import os
import sys
import webbrowser
import threading
import time
import uvicorn

def open_browser():
    time.sleep(1.5)
    webbrowser.open("http://127.0.0.1:8000")

def main():
    print("=" * 65)
    print("  🌊 Tides Music - Web & Desktop Music Player")
    print("  ✓ Spotify-grade UI with live soundwave equalizer animations")
    print("  ✓ Background Audio Playback & MediaSession API active")
    print("  ✓ Persistent Login & Cloud-synced Playlists")
    print("  ✓ YouTube Data API v3 & Infinite Auto-Radio active")
    print("=" * 65)
    print("  🌐 Live on: http://127.0.0.1:8000")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 65)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)

if __name__ == "__main__":
    main()
