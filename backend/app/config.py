import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
DATA_DIR = BASE_DIR / "data"
PORT = int(os.getenv("PORT", "8000"))
# The Filing Agent's browser opens this portal (our demo portal, served by this same app).
PORTAL_URL = os.getenv("PORTAL_URL", f"http://127.0.0.1:{PORT}/portal/")
