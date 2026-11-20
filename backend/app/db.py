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
        c.executescript(CASES_SCHEMA)
        c.executescript(DEMO_CLOCK_SCHEMA)


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


# ---------- Cases tracked by Praja Raksha (our side, not the portal's) ----------
CASES_SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
    ack_no TEXT PRIMARY KEY,
    filed_at TEXT NOT NULL,
    payload TEXT NOT NULL,
    escalation_level INTEGER NOT NULL DEFAULT 0,
    letters TEXT NOT NULL DEFAULT '[]',
    last_checked TEXT,
    last_status TEXT
);
"""


def init_cases():
    with conn() as c:
        c.executescript(CASES_SCHEMA)


def save_case(ack: str, payload: dict):
    with conn() as c:
        c.execute("INSERT OR REPLACE INTO cases (ack_no, filed_at, payload) VALUES (?,?,?)",
                  (ack, datetime.now().isoformat(timespec="seconds"), json.dumps(payload, ensure_ascii=False)))


def get_case(ack: str) -> dict | None:
    with conn() as c:
        row = c.execute("SELECT * FROM cases WHERE ack_no = ?", (ack,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["payload"] = json.loads(d["payload"])
    d["letters"] = json.loads(d["letters"])
    return d


def all_case_acks() -> list[str]:
    with conn() as c:
        return [r[0] for r in c.execute("SELECT ack_no FROM cases")]


def update_case(ack: str, **fields):
    if "letters" in fields:
        fields["letters"] = json.dumps(fields["letters"], ensure_ascii=False)
    sets = ", ".join(f"{k} = ?" for k in fields)
    with conn() as c:
        c.execute(f"UPDATE cases SET {sets} WHERE ack_no = ?", (*fields.values(), ack))


# ---------- Demo-only controls that simulate police activity on the portal ----------
def set_status(ack: str, status: str, note: str):
    c0 = get_complaint(ack)
    if not c0:
        return False
    history = c0["history"] + [{"at": now_for(ack).isoformat(timespec="seconds"), "status": status, "note": note}]
    with conn() as c:
        c.execute("UPDATE complaints SET status = ?, history = ? WHERE ack_no = ?", (status, json.dumps(history), ack))
    return True


DEMO_CLOCK_SCHEMA = "CREATE TABLE IF NOT EXISTS demo_clock (ack_no TEXT PRIMARY KEY, days INTEGER NOT NULL);"


def demo_days(ack: str) -> int:
    """Demo only: how many days the clock has been fast-forwarded for this complaint."""
    with conn() as c:
        row = c.execute("SELECT days FROM demo_clock WHERE ack_no = ?", (ack,)).fetchone()
    return row[0] if row else 0


def now_for(ack: str) -> datetime:
    from datetime import timedelta
    return datetime.now() + timedelta(days=demo_days(ack))


def fast_forward(ack: str, days: int) -> bool:
    if not get_complaint(ack):
        return False
    with conn() as c:
        c.execute("INSERT INTO demo_clock (ack_no, days) VALUES (?, ?) "
                  "ON CONFLICT(ack_no) DO UPDATE SET days = days + excluded.days", (ack, days))
    return True
