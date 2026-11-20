from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import db
from .agents import drafting_agent, evidence_agent, filing_agent, legal_agent, tracking_agent
from .config import AUTO_TRACK_MINUTES
from .portal.routes import router as portal_router

db.init()
app = FastAPI(title="Praja Raksha API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(portal_router)
tracking_agent.start_background_checks(AUTO_TRACK_MINUTES)


def _run(fn, *args):
    """Turn agent failures into clean API errors instead of crashes."""
    try:
        return fn(*args)
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.get("/api/health")
def health():
    return {"status": "ok"}


class AnalyzeRequest(BaseModel):
    complaint: str
    evidence_notes: str = ""


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    if len(req.complaint.strip()) < 10:
        raise HTTPException(400, "Please describe the problem in a little more detail.")
    return _run(legal_agent.analyze, req.complaint, req.evidence_notes)


@app.post("/api/evidence")
async def evidence(files: list[UploadFile] = File(...), context: str = Form("")):
    if not files or len(files) > 6:
        raise HTTPException(400, "Upload between 1 and 6 files.")
    loaded = []
    for f in files:
        mime = (f.content_type or "").lower()
        if mime not in evidence_agent.ALLOWED_TYPES:
            raise HTTPException(400, f"{f.filename}: only images (PNG/JPG/WEBP) and audio files are supported.")
        data = await f.read()
        if len(data) > evidence_agent.MAX_FILE_BYTES:
            raise HTTPException(400, f"{f.filename} is larger than 10 MB.")
        loaded.append((f.filename, mime, data))
    report = _run(evidence_agent.analyze, loaded, context)
    report["notes_for_legal_agent"] = evidence_agent.notes_for_legal_agent(report)
    return report


class DraftRequest(BaseModel):
    doc_type: drafting_agent.DocType = "fir_complaint"
    analysis: dict
    complainant: drafting_agent.Complainant = drafting_agent.Complainant()
    evidence_summary: str = ""
    complaint: str = ""


@app.post("/api/draft")
def draft(req: DraftRequest):
    d = _run(drafting_agent.draft, req.doc_type, req.analysis, req.complainant, req.evidence_summary, req.complaint)
    d["text"] = drafting_agent.to_text(d)
    return d


class PdfRequest(BaseModel):
    text: str
    title: str = "Complaint"


@app.post("/api/pdf")
def pdf(req: PdfRequest):
    data = drafting_agent.to_pdf(req.text, req.title)
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="praja-raksha-complaint.pdf"'})


class FileRequest(BaseModel):
    user_confirmed: bool
    anonymous: bool = False
    complaint: str
    complainant: dict = {}
    analysis: dict
    evidence: dict | None = None
    extra_info: str = ""


@app.post("/api/file")
def file_complaint(req: FileRequest):
    if not req.user_confirmed:
        raise HTTPException(400, "Please confirm the details are true before the agent files on your behalf.")
    a = req.analysis
    case = {
        "user_confirmed": True,
        "anonymous": req.anonymous,
        # Anonymous: share only location (needed to route the complaint), never identity.
        "complainant": {k: v for k, v in req.complainant.items()
                        if v and (not req.anonymous or k in ("district", "police_station"))},
        "complaint_in_own_words": req.complaint,
        "summary": a.get("summary"),
        "category": a.get("category"),
        "sections": [f'{s["law"]} s.{s["section"]} ({s["title"]})' for s in a.get("sections", [])],
        "additional_info_from_user": req.extra_info,
    }
    if req.evidence:
        case["evidence"] = {k: req.evidence.get(k) for k in ("overall_summary", "accused_identifiers", "timeline")}
    # Remember the case so the Tracking Agent can follow up and draft escalation letters later.
    payload = {"analysis": a, "complainant": case["complainant"], "complaint": req.complaint,
               "anonymous": req.anonymous, "evidence_summary": (req.evidence or {}).get("overall_summary", "")}
    return {"job_id": filing_agent.start(case, on_done=lambda ack: db.save_case(ack, payload))}


@app.post("/api/track/{ack}")
def track(ack: str):
    try:
        return tracking_agent.run(ack.strip())
    except LookupError as e:
        raise HTTPException(404, str(e))
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.get("/api/file/{job_id}")
def filing_status(job_id: str):
    job = filing_agent.JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown filing job")
    return filing_agent.public_view(job)


@app.get("/api/file/{job_id}/shot/{n}")
def filing_screenshot(job_id: str, n: int):
    job = filing_agent.JOBS.get(job_id)
    if not job or not 0 <= n < len(job["shots"]):
        raise HTTPException(404, "No such screenshot")
    return Response(job["shots"][n], media_type="image/png")


# Serve the built React app (frontend/dist) so the whole product runs from one URL.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = FRONTEND_DIST / path
        if path and file.is_file() and FRONTEND_DIST in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
