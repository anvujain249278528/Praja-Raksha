import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env")


def _clean_key(raw: str) -> str:
    """Accept a key pasted with extra text (e.g. a whole .env file): keep only the key itself."""
    for line in raw.replace("\r", "\n").split("\n"):
        line = line.strip().strip('"').strip("'")
        if line.startswith("GEMINI_API_KEY="):
            line = line.split("=", 1)[1].strip().strip('"').strip("'")
        if line and "=" not in line:
            return line
    return ""


GEMINI_API_KEY = _clean_key(os.getenv("GEMINI_API_KEY", ""))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
DATA_DIR = BASE_DIR / "data"
PORT = int(os.getenv("PORT", "8000"))
# The Filing Agent's browser opens this portal (our demo portal, served by this same app).
PORTAL_URL = os.getenv("PORTAL_URL", f"http://127.0.0.1:{PORT}/portal/")
# How often the Tracking Agent re-checks every filed complaint in the background (0 = off)
AUTO_TRACK_MINUTES = int(os.getenv("AUTO_TRACK_MINUTES", "60"))
