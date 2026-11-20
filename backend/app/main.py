from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from typing import Literal

from pydantic import BaseModel, Field

from . import db
from . import news, places, tts
from .agents import drafting_agent, evidence_agent, filing_agent, legal_agent, moderation_agent, tracking_agent
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
    language: str = ""  # language the user chose for answers, e.g. "Tamil"


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    if len(req.complaint.strip()) < 10:
        raise HTTPException(400, "Please describe the problem in a little more detail.")
    return _run(legal_agent.analyze, req.complaint, req.evidence_notes, req.language)


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


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    lang: str = Field(pattern=r"^[a-z]{2}-IN$")


@app.post("/api/tts")
def text_to_speech(req: TtsRequest):
    """Voice-over in Indian languages. 404 when we have no server voice (frontend then uses the device voice)."""
    try:
        audio = tts.synthesize(req.text, req.lang)
    except Exception as e:
        raise HTTPException(503, f"Voice service unavailable: {str(e)[:80]}")
    if audio is None:
        raise HTTPException(404, "No server voice for this language")
    return Response(audio, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"})


# ---------- Website: news, stats, nearby help, reviews ----------
@app.get("/api/news")
def get_news(place: str = "Karnataka"):
    return news.latest(place)


@app.get("/api/geo/place")
def geo_place(lat: float, lon: float):
    """City/district name for the user's coordinates (OpenStreetMap Nominatim)."""
    try:
        return places.reverse_geocode(lat, lon)
    except Exception:
        raise HTTPException(503, "Could not find your city right now.")


@app.get("/api/stats")
def stats():
    return db.platform_stats()


@app.get("/api/places/police")
def nearby_police(lat: float, lon: float, radius_km: float = 8):
    try:
        return places.police_stations(lat, lon, int(min(radius_km, 25) * 1000))
    except Exception as e:
        raise HTTPException(503, f"Map service is busy, please retry. ({str(e)[:80]})")


@app.get("/api/places/lawyers")
def nearby_lawyers(lat: float, lon: float, category: str = ""):
    return places.lawyers(lat, lon, category)


@app.get("/api/reviews/{target_type}/{target_id}")
def get_reviews(target_type: Literal["police", "lawyer"], target_id: str):
    return db.reviews_for(target_type, target_id)


class ReviewRequest(BaseModel):
    target_type: Literal["police", "lawyer"]
    target_id: str = Field(max_length=80)
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=10, max_length=1500)
    case_category: str = ""


@app.post("/api/reviews")
def post_review(r: ReviewRequest):
    verdict = moderation_agent.check(r.text, r.rating)
    if not verdict.allowed:
        raise HTTPException(422, f"Review not published: {verdict.reason}")
    return db.add_review(r.target_type, r.target_id, r.rating, r.text.strip(), r.case_category)


class FeedbackRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    kind: Literal["praise", "idea", "problem"] = "praise"
    text: str = Field(min_length=5, max_length=1500)
    page: str = Field(default="", max_length=40)


@app.post("/api/feedback")
def post_feedback(f: FeedbackRequest):
    verdict = moderation_agent.check(f.text, f.rating)
    if not verdict.allowed:
        raise HTTPException(422, f"Feedback not saved: {verdict.reason}")
    return db.add_feedback(f.rating, f.kind, f.text.strip(), f.page)


@app.get("/api/feedback/summary")
def feedback_summary():
    return db.feedback_summary()


# Serve the built React app (frontend/dist) so the whole product runs from one URL.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = FRONTEND_DIST / path
        if path and file.is_file() and FRONTEND_DIST in file.resolve().parents:
            return FileResponse(file)
        # index.html must never be cached, or browsers keep showing an old version after an update.
        # (JS/CSS files have content hashes in their names, so they can be cached safely.)
        return FileResponse(FRONTEND_DIST / "index.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
