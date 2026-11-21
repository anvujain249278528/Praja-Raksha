"""Shared Gemini caller with model fallback, so a busy model never breaks the demo."""
import time

from google import genai
from google.genai import errors, types

from .config import GEMINI_API_KEY, GEMINI_MODEL

# Best model first, then the fast lite model (reliable under load), then others.
FALLBACK_MODELS = [GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.5-flash"]

COOLDOWN_SECONDS = 300
_cooldown_until: dict[str, float] = {}  # model -> time until which we avoid it
_client = None


def client() -> genai.Client:
    global _client
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in backend/.env")
    if _client is None:
        # 30 s timeout and no hidden SDK retries: we fail fast and switch model ourselves.
        _client = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=30_000, retry_options=types.HttpRetryOptions(attempts=1)),
        )
    return _client


def generate(contents, config: types.GenerateContentConfig):
    """Try each model in order; move on when a model is busy, unavailable, or the network drops."""
    last_error = None
    models = list(dict.fromkeys(FALLBACK_MODELS))  # de-duplicate, keep order
    now = time.time()
    # Healthy models first; models that failed recently go to the back of the queue.
    models.sort(key=lambda m: _cooldown_until.get(m, 0) > now)
    for attempt, model in enumerate(models + models):  # two passes: load spikes are short
        if attempt == len(models):
            time.sleep(2)
        try:
            response = client().models.generate_content(model=model, contents=contents, config=config)
            if config.response_schema is not None and response.parsed is None:
                raise ValueError(f"{model} returned unreadable JSON")
            _cooldown_until.pop(model, None)
            print(f"[llm] answered by {model}")
            return response
        except errors.APIError as e:
            if e.code not in (404, 408, 429, 500, 502, 503, 504):
                raise
            last_error = e
        except Exception as e:  # network errors, timeouts, bad JSON
            last_error = e
        _cooldown_until[model] = time.time() + COOLDOWN_SECONDS
        print(f"[llm] {model} failed, cooling down: {_safe(last_error)}")
    # Never put the underlying error in the user-facing message: it can contain request details.
    raise RuntimeError("All AI models are busy right now. Please try again in a minute.")


def _safe(err) -> str:
    """Error text for server logs only, with the API key removed and length limited."""
    text = str(err)
    if GEMINI_API_KEY:
        text = text.replace(GEMINI_API_KEY, "***")
    return type(err).__name__ + ": " + text[:120]
