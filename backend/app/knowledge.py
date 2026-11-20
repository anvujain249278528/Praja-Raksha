"""Loads the verified legal knowledge base. Agents may only cite sections listed here."""
import json
from functools import lru_cache

from .config import DATA_DIR


@lru_cache
def load_kb() -> dict:
    with open(DATA_DIR / "legal_kb.json", encoding="utf-8") as f:
        return json.load(f)


def sections_by_id() -> dict[str, dict]:
    return {s["id"]: s for s in load_kb()["sections"]}


def kb_for_prompt() -> str:
    """Compact one-line-per-section text given to the AI as its only allowed source."""
    lines = []
    for s in load_kb()["sections"]:
        lines.append(f'{s["id"]} | {s["law"]} s.{s["section"]} | {s["title"]} | {s["summary"]}')
    return "\n".join(lines)
