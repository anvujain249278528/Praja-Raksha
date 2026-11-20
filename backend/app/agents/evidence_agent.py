"""Evidence Agent: reads screenshots/photos/audio, extracts facts and builds a tamper-evident timeline."""
import hashlib
from datetime import datetime, timezone

from google.genai import types
from pydantic import BaseModel, Field

from ..llm import generate

ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/webp",
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac",
}
MAX_FILE_BYTES = 10 * 1024 * 1024


class EvidenceItem(BaseModel):
    file_index: int = Field(description="0-based index of the file in the order given")
    kind: str = Field(description="e.g. WhatsApp chat screenshot, Instagram DM, call recording, photo of injury")
    extracted_text: str = Field(description="Key text/speech found, translated to English if needed")
    findings: list[str] = Field(description="Legally relevant facts: threats, demands, abuse, admissions")


class TimelineEvent(BaseModel):
    when: str = Field(description="Date/time as seen in the evidence, or 'unknown'")
    event: str


class EvidenceReport(BaseModel):
    items: list[EvidenceItem]
    accused_identifiers: list[str] = Field(description="Names, usernames, phone numbers, UPI IDs, links of the accused")
    timeline: list[TimelineEvent] = Field(description="Chronological events across all evidence")
    overall_summary: str
    strength: str = Field(description="'strong', 'moderate' or 'weak' evidence, with a short reason")


PROMPT = """You are the Evidence Agent of Praja Raksha. A citizen uploaded these files as evidence of abuse or a crime.
For each file, describe what it is and extract the exact words of threats, demands, abuse, and any dates, times,
usernames, phone numbers, UPI IDs or links. Then build a chronological timeline across all files.
Be precise and factual: only report what is visible or audible. Translate non-English content to English.
Context from the citizen: {context}"""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def analyze(files: list[tuple[str, str, bytes]], context: str = "") -> dict:
    """files: list of (filename, mime_type, bytes)."""
    parts = [types.Part.from_bytes(data=data, mime_type=mime) for _, mime, data in files]
    parts.append(PROMPT.format(context=context or "none given"))

    response = generate(
        contents=parts,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=EvidenceReport,
            temperature=0.1,
        ),
    )
    report = response.parsed.model_dump()

    # Integrity record: SHA-256 fingerprint proves the file was not altered after upload.
    received = datetime.now(timezone.utc).isoformat(timespec="seconds")
    report["files"] = [
        {"index": i, "name": name, "type": mime, "size": len(data), "sha256": sha256(data), "received_utc": received}
        for i, (name, mime, data) in enumerate(files)
    ]
    return report


def notes_for_legal_agent(report: dict) -> str:
    """Condensed evidence text passed on to the Legal Analysis Agent."""
    lines = [report["overall_summary"]]
    for item in report["items"]:
        lines += [f"- {f}" for f in item["findings"]]
    if report["accused_identifiers"]:
        lines.append("Accused identifiers: " + ", ".join(report["accused_identifiers"]))
    return "\n".join(lines)
