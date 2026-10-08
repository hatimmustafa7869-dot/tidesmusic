FROM python:3.11-slim

# Install system dependencies (Node.js for yt-dlp extraction, curl, ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Build frontend production bundle
WORKDIR /app/frontend
RUN npm install && npm run build
WORKDIR /app

# Ensure SQLite database directory is writable
VOLUME ["/app/data"]
ENV DATABASE_PATH=/app/data/soundflow.db
ENV HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
