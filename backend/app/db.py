"""SQLite storage for complaints received by the demo portal (also used for tracking and the dashboard)."""
import json
import random
import sqlite3
from contextlib import contextmanager
from datetime import datetime

from .config import DATA_DIR

DB_PATH = DATA_DIR / "praja_raksha.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS complaints (
    ack_no TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    anonymous INTEGER NOT NULL,
    name TEXT, mobile TEXT, email TEXT, address TEXT,
    district TEXT NOT NULL,
    category TEXT NOT NULL,
    incident_date TEXT,
    place TEXT,
    police_station TEXT,
    accused TEXT,
    sections TEXT,
    description TEXT NOT NULL,
    evidence TEXT,
    status TEXT NOT NULL DEFAULT 'Received',
    history TEXT NOT NULL DEFAULT '[]'
);
"""


@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init():
    with conn() as c:
        c.executescript(SCHEMA)


def new_ack_no(district: str) -> str:
    code = "".join(ch for ch in district.upper() if ch.isalpha())[:3] or "KA"
    return f"KA-{code}-{datetime.now():%Y%m%d}-{random.randint(100000, 999999)}"


def add_complaint(data: dict) -> str:
    ack = new_ack_no(data["district"])
    now = datetime.now().isoformat(timespec="seconds")
    history = [{"at": now, "status": "Received", "note": "Complaint received online"}]
    with conn() as c:
        c.execute(
            """INSERT INTO complaints (ack_no, created_at, anonymous, name, mobile, email, address, district, category,
               incident_date, place, police_station, accused, sections, description, evidence, status, history)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (ack, now, int(data["anonymous"]), data.get("name"), data.get("mobile"), data.get("email"),
             data.get("address"), data["district"], data["category"], data.get("incident_date"), data.get("place"),
             data.get("police_station"), data.get("accused"), data.get("sections"), data["description"],
             data.get("evidence"), "Received", json.dumps(history)),
        )
    return ack


def get_complaint(ack: str) -> dict | None:
    with conn() as c:
        row = c.execute("SELECT * FROM complaints WHERE ack_no = ?", (ack,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["history"] = json.loads(d["history"])
    return d
