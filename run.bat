@echo off
title SoundFlow YouTube Music Web Player
echo Starting SoundFlow...
if not exist ".venv\Scripts\python.exe" (
    echo Virtual environment not found. Initializing...
    python -m venv .venv
    .\.venv\Scripts\pip install -r requirements.txt
)
.\.venv\Scripts\python.exe run.py
pause
