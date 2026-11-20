"""Moderation Agent: checks citizen reviews before they are published."""
from google.genai import types
from pydantic import BaseModel, Field

from ..llm import generate


class Verdict(BaseModel):
    allowed: bool
    reason: str = Field(description="If not allowed: a short, polite reason for the user")


PROMPT = """You moderate citizen reviews of police stations and lawyers on Praja Raksha, a public legal-help platform.
ALLOW honest experiences, including strong criticism (e.g. "they refused to file my FIR", "very helpful lawyer").
REJECT reviews that contain: abusive or obscene language, threats, hate speech or caste/religion slurs,
personal phone numbers or addresses, names of private individuals involved in a case, spam/ads, or text unrelated to the service.
Review (rating {rating}/5): \"\"\"{text}\"\"\""""


def check(text: str, rating: int) -> Verdict:
    try:
        resp = generate(contents=PROMPT.format(text=text[:1500], rating=rating),
                        config=types.GenerateContentConfig(response_mime_type="application/json",
                                                           response_schema=Verdict, temperature=0))
        return resp.parsed
    except RuntimeError:
        # AI unavailable: hold back reviews that look risky instead of publishing unchecked
        return Verdict(allowed=False, reason="Our review checker is busy. Please try again in a minute.")
