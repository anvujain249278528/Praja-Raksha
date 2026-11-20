from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .agents import drafting_agent, evidence_agent, legal_agent

app = FastAPI(title="Praja Raksha API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


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
