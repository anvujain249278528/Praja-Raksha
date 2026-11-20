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
        c.executescript(REVIEWS_SCHEMA)
        cols = [r[1] for r in c.execute("PRAGMA table_info(reviews)")]
        if "sample" not in cols:  # upgrade databases created before this column existed
            c.execute("ALTER TABLE reviews ADD COLUMN sample INTEGER NOT NULL DEFAULT 0")
    seed_sample_reviews()


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


# ---------- Citizen ratings & reviews of police stations and lawyers ----------
REVIEWS_SCHEMA = """
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,          -- 'police' or 'lawyer'
    target_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text TEXT NOT NULL,
    case_category TEXT,
    created_at TEXT NOT NULL,
    sample INTEGER NOT NULL DEFAULT 0   -- 1 = clearly-labelled sample review on a demo listing
);
"""


def add_review(target_type: str, target_id: str, rating: int, text: str, case_category: str = "") -> dict:
    now = datetime.now().isoformat(timespec="seconds")
    with conn() as c:
        cur = c.execute("INSERT INTO reviews (target_type, target_id, rating, text, case_category, created_at) VALUES (?,?,?,?,?,?)",
                        (target_type, target_id, rating, text, case_category, now))
    return {"id": cur.lastrowid, "rating": rating, "text": text, "case_category": case_category, "created_at": now}


def reviews_for(target_type: str, target_id: str) -> list[dict]:
    with conn() as c:
        rows = c.execute("SELECT id, rating, text, case_category, created_at, sample FROM reviews "
                         "WHERE target_type = ? AND target_id = ? ORDER BY id DESC LIMIT 50", (target_type, target_id))
        return [dict(r) for r in rows]


def rating_summary(target_type: str, target_id: str) -> dict:
    with conn() as c:
        avg, n, samples = c.execute("SELECT AVG(rating), COUNT(*), SUM(sample) FROM reviews WHERE target_type = ? AND target_id = ?",
                                    (target_type, target_id)).fetchone()
    return {"rating": round(avg, 1) if avg else None, "review_count": n, "has_sample_reviews": bool(samples)}


def platform_stats() -> dict:
    with conn() as c:
        total = c.execute("SELECT COUNT(*) FROM complaints").fetchone()[0]
        anon = c.execute("SELECT COUNT(*) FROM complaints WHERE anonymous = 1").fetchone()[0]
        fir = c.execute("SELECT COUNT(*) FROM complaints WHERE status LIKE 'FIR%'").fetchone()[0]
        escalated = c.execute("SELECT COUNT(*) FROM cases WHERE escalation_level > 0").fetchone()[0]
        by_cat = [dict(r) for r in c.execute("SELECT category, COUNT(*) AS n FROM complaints GROUP BY category ORDER BY n DESC")]
        by_district = [dict(r) for r in c.execute("SELECT district, COUNT(*) AS n FROM complaints GROUP BY district ORDER BY n DESC")]
        reviews = c.execute("SELECT COUNT(*) FROM reviews WHERE sample = 0").fetchone()[0]
    return {"complaints_filed": total, "anonymous": anon, "fir_registered": fir, "escalations": escalated,
            "reviews": reviews, "by_category": by_cat, "by_district": by_district}


def seed_sample_reviews():
    """Add clearly-labelled SAMPLE reviews to DEMO listings only (never to real police stations or offices)."""
    path = DATA_DIR / "sample_reviews.json"
    if not path.exists():
        return
    with conn() as c:
        c.execute("DELETE FROM reviews WHERE sample = 1")  # samples are static; refresh them on start
        for r in json.loads(path.read_text(encoding="utf-8"))["reviews"]:
            c.execute("INSERT INTO reviews (target_type, target_id, rating, text, case_category, created_at, sample) "
                      "VALUES (?, ?, ?, ?, ?, ?, 1)", (r.get("target_type", "lawyer"), r["target_id"], r["rating"],
                                                     r["text"], r["case_category"], r["created_at"]))
