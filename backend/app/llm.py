"""Shared Gemini caller with model fallback, so a busy model never breaks the demo."""
from google import genai
from google.genai import errors, types

from .config import GEMINI_API_KEY, GEMINI_MODEL

FALLBACK_MODELS = [GEMINI_MODEL, "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"]

_client = None


def client() -> genai.Client:
    global _client
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in backend/.env")
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def generate(contents, config: types.GenerateContentConfig):
    """Try each model in order; move on when a model is overloaded or unavailable."""
    last_error = None
    for model in dict.fromkeys(FALLBACK_MODELS):  # de-duplicate, keep order
        try:
            return client().models.generate_content(model=model, contents=contents, config=config)
        except (errors.ServerError, errors.ClientError) as e:
            if getattr(e, "code", None) in (404, 429, 500, 503):
                last_error = e
                continue
            raise
    raise RuntimeError(f"All AI models are busy right now. Please retry. ({last_error})")
