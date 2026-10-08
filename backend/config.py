import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "AIzaSyBD3kLZd4PMOhNKS0k6qQOlig_svmqmtGY")
    HOST: str = os.getenv("HOST", "0.0.0.0" if os.getenv("HOST") else "127.0.0.1")
    PORT: int = int(os.getenv("PORT", 8000))
    STREAM_CACHE_TTL: int = 3600  # 1 hour cache for resolved stream URLs
    
    # Auth & Database Settings
    JWT_SECRET: str = os.getenv("JWT_SECRET", "soundflow-secret-super-secure-key-2026-v1")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_DAYS: int = 90  # 90 days persistent login
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "soundflow.db")

settings = Settings()
