"""Drafting Agent: writes a formal police complaint / escalation letter and renders it as PDF."""
import io
import re
from datetime import date
from typing import Literal
from xml.sax.saxutils import escape

from google.genai import types
from pydantic import BaseModel, Field
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from ..llm import generate

_NUM = re.compile(r"^\s*\(?\d+[.)]\s*")
_SALUTATION = re.compile(r"^\s*(respected\s+)?(sir|madam)(\s*/\s*(sir|madam))?\s*,\s*", re.IGNORECASE)
_INLINE_NUM = re.compile(r"(?<=[.:])\s+(?=\d{1,2}\.\s)")

DocType = Literal["fir_complaint", "sp_escalation", "magistrate_application"]

DOC_BRIEFS = {
    "fir_complaint": "A complaint to the Station House Officer requesting registration of an FIR under BNSS Section 173 "
                     "(mention that a Zero FIR may be registered if the station lacks jurisdiction).",
    "sp_escalation": "A letter to the Superintendent of Police under BNSS Section 173(4) stating that the police station "
                     "failed/refused to register the FIR, and requesting the SP to investigate or direct registration.",
    "magistrate_application": "An application to the Judicial Magistrate under BNSS Section 175(3) praying for a direction "
                              "to police to register the FIR and investigate, since police and SP did not act.",
}


class Complainant(BaseModel):
    name: str = "[Your Name]"
    address: str = "[Your Address]"
    phone: str = "[Your Phone]"
    email: str = ""
    police_station: str = "[Police Station Name]"
    district: str = "[District]"


class Draft(BaseModel):
    to_block: str = Field(description="Addressee lines, e.g. 'To,\\nThe Station House Officer,\\n...'")
    subject: str
    body_paragraphs: list[str] = Field(description="Formal paragraphs: introduction, numbered facts, offences, evidence")
    prayer: list[str] = Field(description="Numbered requests to the authority")
    enclosures: list[str] = Field(description="List of evidence attached")


PROMPT = """You are the Drafting Agent of Praja Raksha. Write a formal, respectful legal document in English, as used in
Indian police stations and courts.
DOCUMENT TYPE: {brief}
COMPLAINANT: {complainant}
CITIZEN'S OWN WORDS: {complaint}
INCIDENT SUMMARY: {summary}
APPLICABLE SECTIONS (cite exactly these, no others): {sections}
EVIDENCE: {evidence}
Rules: state facts in numbered order with dates where known; use placeholders like [date] for unknown facts;
do not exaggerate or add facts not given; keep it under one and a half pages."""


def draft(doc_type: DocType, analysis: dict, complainant: Complainant, evidence_summary: str = "",
          complaint: str = "") -> dict:
    sections = "; ".join(f'{s["law"]} Section {s["section"]} ({s["title"]})' for s in analysis.get("sections", []))
    prompt = PROMPT.format(
        brief=DOC_BRIEFS[doc_type],
        complainant=complainant.model_dump_json(),
        complaint=complaint or "not given",
        summary=analysis.get("summary", ""),
        sections=sections or "as applicable",
        evidence=evidence_summary or "screenshots and messages to be produced",
    )
    response = generate(
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=Draft, temperature=0.3),
    )
    d = response.parsed.model_dump()
    d["to_block"] = d["to_block"].replace("\\n", "\n")  # AI sometimes returns literal "\n"
    if "\n" not in d["to_block"]:  # put each address part on its own line
        d["to_block"] = d["to_block"].replace(", ", ",\n")
    # "facts: 1. x 2. y" -> each numbered fact on its own line
    d["body_paragraphs"] = [_INLINE_NUM.sub("\n", p) for p in d["body_paragraphs"]]
    # We add the salutation ourselves; drop it if the AI also wrote one
    d["body_paragraphs"] = [_SALUTATION.sub("", p) for p in d["body_paragraphs"]]
    d["body_paragraphs"] = [p for p in d["body_paragraphs"] if p.strip()]
    for key in ("prayer", "enclosures"):  # remove numbering the AI added; we number ourselves
        d[key] = [_NUM.sub("", x) for x in d[key]]
    d["doc_type"] = doc_type
    d["complainant"] = complainant.model_dump()
    d["date"] = date.today().strftime("%d-%m-%Y")
    return d


def to_text(d: dict) -> str:
    c = d["complainant"]
    parts = [
        f'From,\n{c["name"]}\n{c["address"]}\nPhone: {c["phone"]}' + (f'\nEmail: {c["email"]}' if c.get("email") else ""),
        d["to_block"],
        f'Date: {d["date"]}',
        f'Subject: {d["subject"]}',
        "Respected Sir/Madam,",
        *d["body_paragraphs"],
        "PRAYER:\n" + "\n".join(f"{i}. {p}" for i, p in enumerate(d["prayer"], 1)),
        "Enclosures:\n" + "\n".join(f"{i}. {e}" for i, e in enumerate(d["enclosures"], 1)),
        f'Yours faithfully,\n\n\n({c["name"]})\nSignature',
    ]
    return "\n\n".join(parts)


def to_pdf(text: str, title: str = "Complaint") -> bytes:
    """Render (possibly user-edited) draft text to an A4 PDF."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                            topMargin=1.5 * cm, bottomMargin=1.5 * cm, title=title)
    styles = getSampleStyleSheet()
    body = styles["BodyText"]
    body.fontSize, body.leading = 10.5, 14
    story = []
    for block in text.split("\n\n"):
        html = escape(block).replace("\n", "<br/>")
        if block.startswith("Subject:"):
            html = f"<b>{html}</b>"
        story += [Paragraph(html, body), Spacer(1, 5)]
    story.append(Spacer(1, 10))
    story.append(Paragraph("<font size=8 color='#666666'>Drafted with Praja Raksha (AI legal first-aid). "
                           "Review all facts before signing. Not a substitute for advice from a lawyer.</font>", body))
    doc.build(story)
    return buf.getvalue()
