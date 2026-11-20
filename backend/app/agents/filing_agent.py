"""Filing Agent: operates a complaint portal in a real (headless) browser.

Loop: OBSERVE the page (fields, options, error messages) -> DECIDE with Gemini what to fill and click
-> ACT with Playwright -> VERIFY (errors? acknowledgement?) -> repeat until filed or blocked.
It never invents personal facts; if something required is missing it stops and asks the user.
"""
import json
import threading
import time
import uuid

from google.genai import types
from playwright.sync_api import sync_playwright
from pydantic import BaseModel, Field

from ..config import PORTAL_URL
from ..llm import generate

MAX_STEPS = 8
_browser_lock = threading.Semaphore(1)  # one browser at a time keeps memory use low
JOBS: dict[str, dict] = {}


class FieldFill(BaseModel):
    id: str = Field(description="Exact field id from the page")
    value: str = Field(description="Text value; 'true'/'false' for checkboxes; option value for selects; YYYY-MM-DD for dates")


class Decision(BaseModel):
    thought: str = Field(description="One short sentence describing what you are doing on this page, for the user")
    fills: list[FieldFill]
    click: str = Field(description="Exact text of the button to click next, or '' if blocked")
    blocked: bool = Field(description="True only if a REQUIRED field needs information that is not in the case")
    blocked_reason: str = Field(description="If blocked: which information the user must provide, in simple words")


PROMPT = """You are the Filing Agent of Praja Raksha. You are operating an online complaint portal on behalf of a citizen.
Decide what to type into the visible form fields and which button to click next.

RULES
- Use ONLY facts from the CASE. Never invent names, phone numbers, addresses or dates.
- Phone numbers: digits only, without +91 or spaces. Placeholders like "[Your Phone]" or values with X are NOT real data.
- If CASE.anonymous is true, tick the anonymous checkbox and leave identity fields empty.
- Dates: use the first incident date found in the complaint or evidence timeline, as YYYY-MM-DD.
- Description: write a clear, factual, first-person account of at least 150 characters from the case.
- Place of incident: where the offence happened, NOT the complainant's home. For offences done through
  phone/internet use "Online - <platform>" (e.g. "Online - WhatsApp / Instagram").
- Category: anything done through phone, internet, social media or UPI (online threats, sextortion,
  online harassment, online fraud) is "Cyber crime".
- Accused details: include names, phone numbers, social media IDs and UPI IDs found in the case.
- Tick the declaration checkbox ONLY if CASE.user_confirmed is true.
- If there are ERROR MESSAGES, fix the fields they mention.
- If a REQUIRED field cannot be filled from the case (and is not hidden by anonymity), set blocked=true and explain
  exactly what the user must provide. Do not guess.
- Fill only fields that are visible. Click the button that moves the form forward (Next / Submit).

CASE
{case}

CURRENT PAGE
{page}
"""

OBSERVE_JS = """() => {
  const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const label = el => { const l = document.querySelector(`label[for="${el.id}"]`); return l ? l.innerText.trim() : ''; };
  const fields = [...document.querySelectorAll('input, select, textarea')].filter(el => el.id && visible(el)).map(el => ({
    id: el.id, label: label(el), type: el.tagName === 'SELECT' ? 'select' : (el.type || 'text'),
    required: !!(document.querySelector(`label[for="${el.id}"]`)?.classList.contains('req')),
    value: el.type === 'checkbox' ? String(el.checked) : el.value,
    options: el.tagName === 'SELECT' ? [...el.options].filter(o => o.value).map(o => ({ value: o.value, text: o.text })) : undefined,
  }));
  const errors = [...document.querySelectorAll('.error, [role=alert]')].filter(visible).map(e => e.innerText.trim()).filter(Boolean);
  const buttons = [...document.querySelectorAll('button')].filter(visible).map(b => b.innerText.trim());
  const ack = document.getElementById('ack-number');
  return { title: document.title, heading: document.querySelector('fieldset.on legend, h2')?.innerText || '',
           fields, errors: [...new Set(errors)], buttons, ack: ack && visible(ack) ? ack.innerText.trim() : null };
}"""


def _log(job: dict, text: str, page=None):
    entry = {"t": round(time.time() - job["started"], 1), "text": text, "shot": None}
    if page is not None:
        job["shots"].append(page.screenshot(full_page=True))
        entry["shot"] = len(job["shots"]) - 1
    job["steps"].append(entry)


def _apply(page, fills: list[FieldFill]):
    # Checkboxes first: ticking "anonymous" hides identity fields, so later fills must re-check visibility.
    ordered = sorted(fills, key=lambda f: page.locator(f"#{f.id}").get_attribute("type") != "checkbox")
    for f in ordered:
        el = page.locator(f"#{f.id}")
        if el.count() == 0 or not el.is_visible():
            continue
        tag = el.evaluate("e => e.tagName")
        kind = el.get_attribute("type")
        if kind == "checkbox":
            el.set_checked(f.value.strip().lower() == "true")
        elif tag == "SELECT":
            el.select_option(f.value)
        else:
            el.fill(f.value)


def _run(job: dict, case: dict):
    with _browser_lock, sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(viewport={"width": 900, "height": 1000})
            page.goto(PORTAL_URL, wait_until="networkidle")
            _log(job, "Opened the e-Complaint Portal", page)
            last_errors = None
            for _ in range(MAX_STEPS):
                state = page.evaluate(OBSERVE_JS)
                if state["ack"]:
                    job["ack_no"] = state["ack"]
                    _log(job, f"Complaint registered. Acknowledgement number {state['ack']}", page)
                    job["status"] = "done"
                    return
                if state["errors"] and state["errors"] == last_errors:
                    raise RuntimeError("The portal keeps rejecting the form: " + "; ".join(state["errors"]))
                last_errors = state["errors"]
                if state["errors"]:
                    _log(job, "Portal showed errors, fixing: " + "; ".join(state["errors"])[:200])

                resp = generate(
                    contents=PROMPT.format(case=json.dumps(case, ensure_ascii=False, indent=1),
                                           page=json.dumps(state, ensure_ascii=False, indent=1)),
                    config=types.GenerateContentConfig(response_mime_type="application/json",
                                                       response_schema=Decision, temperature=0.1),
                )
                d: Decision = resp.parsed
                if d.blocked:
                    job["status"] = "blocked"
                    job["blocked_reason"] = d.blocked_reason
                    _log(job, "Needs your help: " + d.blocked_reason, page)
                    return
                _apply(page, d.fills)
                _log(job, d.thought, page)
                if d.click:
                    page.get_by_role("button", name=d.click, exact=True).first.click()
                    page.wait_for_timeout(1200)
            raise RuntimeError("Could not finish filing within the step limit.")
        finally:
            browser.close()


def start(case: dict) -> str:
    job_id = uuid.uuid4().hex[:12]
    job = {"id": job_id, "status": "running", "steps": [], "shots": [], "ack_no": None,
           "blocked_reason": None, "error": None, "started": time.time()}
    JOBS[job_id] = job

    def worker():
        try:
            _run(job, case)
        except Exception as e:  # report any failure to the user instead of crashing
            job["status"] = "error"
            job["error"] = str(e)[:300]
            job["steps"].append({"t": round(time.time() - job["started"], 1), "text": "Stopped: " + job["error"], "shot": None})

    threading.Thread(target=worker, daemon=True).start()
    return job_id


def public_view(job: dict) -> dict:
    return {k: v for k, v in job.items() if k not in ("shots", "started")}
