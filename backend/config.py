import os
from dotenv import load_dotenv

load_dotenv()

def resolve_database_path() -> str:
    # 1. Explicit DATABASE_PATH env var
    env_path = os.getenv("DATABASE_PATH")
    if env_path:
        abs_p = os.path.abspath(env_path)
        os.makedirs(os.path.dirname(abs_p), exist_ok=True)
        return abs_p

    # 2. On Linux/Unix VPS (Hostinger): use persistent system folder outside code repository
    if os.name != "nt":
        # First priority: /var/lib/tides-music (isolated from /var/www/ and immune to git clean/pull)
        try:
            var_lib = "/var/lib/tides-music"
            os.makedirs(var_lib, exist_ok=True)
            return os.path.join(var_lib, "tides.db")
        except Exception:
            pass

        # Second priority: ~/.tides_music
        try:
            home_dir = os.path.expanduser("~/.tides_music")
            os.makedirs(home_dir, exist_ok=True)
            return os.path.join(home_dir, "tides.db")
        except Exception:
            pass

    # 3. Default safe persistent project data directory
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_dir = os.path.join(root_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "tides.db")

class Settings:
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "AIzaSyBD3kLZd4PMOhNKS0k6qQOlig_svmqmtGY")
    HOST: str = os.getenv("HOST", "0.0.0.0" if os.getenv("HOST") else "127.0.0.1")
    PORT: int = int(os.getenv("PORT", 8000))
    STREAM_CACHE_TTL: int = 3600  # 1 hour cache for resolved stream URLs
    
    # Auth & Database Settings
    JWT_SECRET: str = os.getenv("JWT_SECRET", "soundflow-secret-super-secure-key-2026-v1")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_DAYS: int = 90  # 90 days persistent login
    
    # Database Persistence Settings
    DATABASE_PATH: str = resolve_database_path()
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")  # e.g. mysql+pymysql://user:pass@host/db
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", 3306))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DATABASE: str = os.getenv("MYSQL_DATABASE", "")
    
    # Hostinger SMTP Password Reset Settings
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.hostinger.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", 465))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USER", "noreply@tidesmusic.com"))
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Tides Music")
    SMTP_USE_SSL: bool = os.getenv("SMTP_USE_SSL", "true").lower() in ("true", "1", "yes")

settings = Settings()

