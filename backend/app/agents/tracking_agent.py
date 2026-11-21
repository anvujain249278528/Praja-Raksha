"""Tracking + Escalation Agent: checks a filed complaint on the portal and escalates when police do not act.

1. CHECK   - opens the portal's tracking page in a browser and reads the status and history.
2. DECIDE  - applies a fixed legal escalation policy (deterministic rules, not AI guesses):
             FIR registered          -> no escalation; tell the user the next step
             no action for 14+ days  -> letter to the Superintendent of Police, BNSS 173(4)
             no action for 30+ days,
             or complaint closed     -> application to the Judicial Magistrate, BNSS 175(3)
3. ACT     - asks the Drafting Agent to write the escalation letter with the real dates and ack number.
"""
import threading
from datetime import datetime

from playwright.sync_api import sync_playwright

from .. import db
from ..config import PORTAL_URL
from . import drafting_agent
from .filing_agent import BROWSER_ARGS, _browser_lock

SP_AFTER_DAYS = 14          # police may take up to 14 days for a preliminary enquiry (BNSS 173(3))
MAGISTRATE_AFTER_DAYS = 30  # if the SP also does not act
LEVELS = {1: ("sp_escalation", "Letter to the Superintendent of Police (BNSS 173(4))"),
          2: ("magistrate_application", "Application to the Judicial Magistrate (BNSS 175(3))")}


def check_portal(ack: str) -> dict:
    """Read the complaint's status from the portal's public tracking page, like a person would."""
    with _browser_lock, sync_playwright() as p:
        browser = p.chromium.launch(args=BROWSER_ARGS)
        try:
            page = browser.new_page()
            page.goto(PORTAL_URL.rstrip("/") + "/track", wait_until="networkidle")
            page.fill("#track-ack", ack)
            page.click("#track-btn")
            page.wait_for_selector("#track-result:not(.hidden), #track-error:visible", timeout=15000)
            if page.locator("#track-error").is_visible():
                raise RuntimeError(page.inner_text("#track-error"))
            history = [{"at": r.locator("td").nth(0).inner_text(), "event": r.locator("td").nth(1).inner_text()}
                       for r in page.locator("#track-history tr").all()]
            return {"status": page.inner_text("#track-status"), "filed_at": page.inner_text("#track-filed"), "history": history}
        finally:
            browser.close()


def decide(portal: dict, level: int, now: datetime) -> dict:
    filed = datetime.fromisoformat(portal["filed_at"].replace(" ", "T"))
    days = (now - filed).days
    status = portal["status"].lower()
    if "fir registered" in status:
        return {"days": days, "target_level": level, "action": "none",
                "reason": "Police have registered an FIR. No escalation needed.",
                "next_step": "Ask the police station for a free copy of the FIR (your right under BNSS 173(2)) and keep it safe."}
    if "closed" in status or "rejected" in status or days >= MAGISTRATE_AFTER_DAYS:
        why = ("The complaint was closed without an FIR." if ("closed" in status or "rejected" in status)
               else f"No FIR after {days} days, even after escalation to the SP.")
        return {"days": days, "target_level": 2, "action": "escalate", "reason": why,
                "next_step": "Submit the Magistrate application at the court of the Judicial Magistrate with jurisdiction."}
    if days >= SP_AFTER_DAYS:
        return {"days": days, "target_level": 1, "action": "escalate",
                "reason": f"No action for {days} days. Police get up to {SP_AFTER_DAYS} days for a preliminary enquiry; that time is over.",
                "next_step": "Send the letter to the Superintendent of Police by post or email, and keep the receipt."}
    return {"days": days, "target_level": level, "action": "wait",
            "reason": f"Filed {days} day(s) ago. Police have up to {SP_AFTER_DAYS} days to act.",
            "next_step": f"Praja Raksha will check again. If nothing happens by day {SP_AFTER_DAYS}, it will draft a letter to the SP."}


def run(ack: str) -> dict:
    case = db.get_case(ack)
    if not case:
        raise LookupError("This complaint was not filed through Praja Raksha, so it cannot be tracked here.")
    portal = check_portal(ack)
    now = db.now_for(ack)  # real time (fast-forwarded only in the demo)
    decision = decide(portal, case["escalation_level"], now)
    letters = case["letters"]

    if decision["action"] == "escalate" and decision["target_level"] > case["escalation_level"]:
        doc_type, title = LEVELS[decision["target_level"]]
        p = case["payload"]
        context = (f"{p['complaint']}\n\nPROCEDURAL HISTORY: Complaint filed online on {portal['filed_at'][:10]} with "
                   f"acknowledgement number {ack}. Status as of {now:%d-%m-%Y} ({decision['days']} days later): "
                   f"'{portal['status']}'. {decision['reason']}")
        if decision["target_level"] == 2 and any(l["level"] == 1 for l in letters):
            context += " A letter was already sent to the Superintendent of Police and no action followed."
        d = drafting_agent.draft(doc_type, p["analysis"], drafting_agent.Complainant(**p["complainant"]),
                                 p.get("evidence_summary", ""), context, as_of=now.date())
        letters = letters + [{"level": decision["target_level"], "title": title, "doc_type": doc_type,
                              "created_at": now.isoformat(timespec="seconds"), "text": drafting_agent.to_text(d)}]
        db.update_case(ack, escalation_level=decision["target_level"], letters=letters)
        decision["new_letter"] = True

    db.update_case(ack, last_checked=now.isoformat(timespec="seconds"), last_status=portal["status"])
    return {"ack_no": ack, "portal": portal, "decision": decision, "letters": letters}


def start_background_checks(interval_minutes: int):
    """Keep watching every tracked complaint, without the user having to come back."""
    if interval_minutes <= 0:
        return

    def loop():
        while True:
            threading.Event().wait(interval_minutes * 60)
            for ack in db.all_case_acks():
                try:
                    run(ack)
                except Exception as e:
                    print(f"[tracking] {ack}: {e}")

    threading.Thread(target=loop, daemon=True).start()
