"""Demo e-Complaint Portal: a stand-in for a government online complaint website.
The Filing Agent operates this portal through a real browser, exactly as it would a real site."""
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .. import db

router = APIRouter(prefix="/portal")
PAGE = Path(__file__).parent / "index.html"


class PortalSubmission(BaseModel):
    anonymous: bool = False
    name: str = ""
    mobile: str = ""
    email: str = ""
    address: str = ""
    district: str
    category: str
    incident_date: str = ""
    place: str = ""
    police_station: str = ""
    accused: str = ""
    sections: str = ""
    description: str
    evidence: str = ""
    declaration: bool


@router.get("/", include_in_schema=False)
@router.get("/track", include_in_schema=False)
@router.get("/receipt/{ack}", include_in_schema=False)
def page(ack: str = ""):
    return FileResponse(PAGE)


@router.post("/api/submit")
def submit(s: PortalSubmission):
    # Server-side checks, like a real portal
    if not s.declaration:
        raise HTTPException(400, "Declaration must be accepted.")
    if not s.anonymous and (not s.name.strip() or not re.fullmatch(r"[6-9]\d{9}", s.mobile)):
        raise HTTPException(400, "Name and a valid 10-digit mobile number are required.")
    if len(s.description.strip()) < 100:
        raise HTTPException(400, "Description must be at least 100 characters.")
    data = s.model_dump()
    if s.anonymous:
        data.update(name=None, mobile=None, email=None, address=None)
    return {"ack_no": db.add_complaint(data)}


@router.get("/api/complaint/{ack}")
def complaint(ack: str):
    c = db.get_complaint(ack)
    if not c:
        raise HTTPException(404, "No complaint found with this acknowledgement number.")
    return c


# ---- Demo-only "police side" controls, used to simulate what happens after filing ----
class DemoStatus(BaseModel):
    status: str
    note: str = ""


@router.post("/api/demo/{ack}/status")
def demo_status(ack: str, s: DemoStatus):
    if not db.set_status(ack, s.status, s.note):
        raise HTTPException(404, "Unknown acknowledgement number")
    return {"ok": True}


@router.post("/api/demo/{ack}/age/{days}")
def demo_age(ack: str, days: int):
    """Fast-forward the clock for this complaint (filing date stays real)."""
    if not 0 < days <= 90 or not db.fast_forward(ack, days):
        raise HTTPException(400, "Unknown acknowledgement number or invalid days")
    return {"ok": True}
