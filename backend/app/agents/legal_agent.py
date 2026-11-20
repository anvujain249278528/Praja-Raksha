"""Legal Analysis Agent: understands the complaint and maps it to verified sections + legal actions."""
from typing import Literal

from google.genai import types
from pydantic import BaseModel, Field

from ..llm import generate
from ..knowledge import kb_for_prompt, load_kb, sections_by_id


class MatchedSection(BaseModel):
    id: str = Field(description="Exact id from the knowledge base, e.g. BNS-78")
    why: str = Field(description="One sentence linking the user's facts to this section")


class LegalAction(BaseModel):
    action: str = Field(description="Short title of the step, e.g. 'File a Zero FIR'")
    detail: str = Field(description="What to do and where, in simple words")


class LegalAnalysis(BaseModel):
    detected_language: str = Field(description="Language the user wrote in, e.g. Kannada, Hindi, English")
    category: Literal[
        "cyber_crime", "harassment_women", "domestic_violence", "physical_assault",
        "threat_intimidation", "fraud_cheating", "property_theft", "workplace_harassment",
        "child_abuse", "caste_atrocity", "consumer", "other",
    ]
    severity: Literal["low", "medium", "high", "emergency"]
    summary: str = Field(description="2-3 line neutral summary of the incident in English")
    summary_local: str = Field(description="Same summary in the user's language")
    sections: list[MatchedSection]
    actions: list[LegalAction] = Field(description="Ordered legal actions the user can take")
    actions_local: list[str] = Field(description="The same actions, one line each, in the user's language")
    missing_info: list[str] = Field(description="Important facts still missing (dates, place, accused identity)")


SYSTEM_PROMPT = """You are the Legal Analysis Agent of Praja Raksha, an AI legal first-aid service for Indian citizens.
Read the citizen's complaint (it may be in Kannada, Hindi, English or mixed) and:
1. Identify every offence or legal issue in it.
2. Map them ONLY to sections from the KNOWLEDGE BASE below. Use the exact id. Never cite a section that is not listed.
   Always include BNSS-173 when police action is relevant.
   Cite a section only if its acts have ACTUALLY happened per the facts. A threat to do something
   (e.g. "will leak photos") is intimidation/extortion, not the completed act (do not cite IT-66E/67/67A
   unless content was actually captured without consent or published). Mention in actions what
   further sections would apply if the threat is carried out.
3. List practical legal actions in order: emergency help first if anyone is in danger, then FIR/Zero FIR,
   online portals (cybercrime.gov.in, 1930), protection orders, platform takedown, free legal aid (15100), escalation.
4. Rate severity: 'emergency' if there is immediate danger to life or a child; 'high' for sexual offences,
   violence, threats to life or large fraud; 'medium' for harassment, stalking, defamation; 'low' otherwise.
Use simple language a person with little education can follow. Be factual and supportive, never judgmental.

KNOWLEDGE BASE (id | law | title | summary):
"""


def analyze(complaint: str, evidence_notes: str = "") -> dict:
    """Run the agent and return a validated result enriched with full section details."""
    user_msg = f"COMPLAINT:\n{complaint}"
    if evidence_notes:
        user_msg += f"\n\nEVIDENCE FOUND BY EVIDENCE AGENT:\n{evidence_notes}"

    response = generate(
        contents=user_msg,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT + kb_for_prompt(),
            response_mime_type="application/json",
            response_schema=LegalAnalysis,
            temperature=0.2,
        ),
    )
    result: LegalAnalysis = response.parsed
    return _ground(result)


def _ground(result: LegalAnalysis) -> dict:
    """Guardrail: drop any section the AI invented and attach verified details from the KB."""
    known = sections_by_id()
    data = result.model_dump()
    grounded, rejected = [], []
    for m in result.sections:
        if m.id in known:
            grounded.append({**known[m.id], "why": m.why})
        else:
            rejected.append(m.id)
    data["sections"] = grounded
    data["rejected_ids"] = rejected
    data["helplines"] = load_kb()["help"]
    return data
